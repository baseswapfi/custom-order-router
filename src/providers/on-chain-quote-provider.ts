import { Interface } from '@ethersproject/abi';
import { BigNumber, BigNumberish } from '@ethersproject/bignumber';
import { BytesLike } from '@ethersproject/bytes';
import { BaseProvider } from '@ethersproject/providers';
import { encodeMixedRouteToPath, MixedRouteSDK, Protocol } from '@baseswapfi/router-sdk';
import {
  CHAIN_TO_ADDRESSES_MAP,
  ChainId,
  Currency,
  MIXED_ROUTE_QUOTER_V1_ADDRESSES,
  Token,
} from '@baseswapfi/sdk-core';
import { encodeRouteToPath } from '@baseswapfi/v3-sdk2';
import retry, { Options as RetryOptions } from 'async-retry';
import _ from 'lodash';
import stats from 'stats-lite';

import { SupportedRoutes, V2Route, V3Route } from '../routers/router';
import { IMixedRouteQuoterV1__factory } from '../types/other/factories/IMixedRouteQuoterV1__factory';
import { IQuoterV2__factory } from '../types/v3/factories/IQuoterV2__factory';
import {
  ID_TO_NETWORK_NAME,
  metric,
  MetricLoggerUnit,
  NEW_QUOTER_V2_ADDRESSES,
  // PROTOCOL_V4_QUOTER_ADDRESSES,
} from '../util';
import { CurrencyAmount } from '../util/amounts';
import { log } from '../util/log';
import {
  DEFAULT_BLOCK_NUMBER_CONFIGS,
  DEFAULT_SUCCESS_RATE_FAILURE_OVERRIDES,
} from '../util/onchainQuoteProviderConfigs';
import { routeToString } from '../util/routes';

import { Result, SuccessResult } from './multicall-provider';
import { UniswapMulticallProvider } from './multicall-uniswap-provider';
import { ProviderConfig } from './provider';

/**
 * Emulate on-chain [PathKey](https://github.com/Uniswap/v4-periphery/blob/main/src/libraries/PathKey.sol#L8) struct
 */
export type PathKey = {
  intermediateCurrency: string;
  fee: BigNumberish;
  tickSpacing: BigNumberish;
  hooks: string;
  hookData: BytesLike;
};
export type SupportedPath = string | PathKey[];
/**
 * Emulate on-chain [QuoteExactParams](https://github.com/Uniswap/v4-periphery/blob/main/src/interfaces/IQuoter.sol#L34) struct
 */
export type QuoteExactParams = {
  exactCurrency: string;
  path: PathKey[];
  exactAmount: BigNumberish;
};
/**
 * An on chain quote for a swap.
 */
export type AmountQuote = {
  amount: CurrencyAmount;
  /**
   * Quotes can be null (e.g. pool did not have enough liquidity).
   */
  quote: BigNumber | null;
  /**
   * For each pool in the route, the sqrtPriceX96 after the swap.
   */
  sqrtPriceX96AfterList: BigNumber[] | null;
  /**
   * For each pool in the route, the number of ticks crossed.
   */
  initializedTicksCrossedList: number[] | null;
  /**
   * An estimate of the gas used by the swap. This is returned by the multicall
   * and is not necessarily accurate due to EIP-2929 causing gas costs to vary
   * depending on if the slot has already been loaded in the call.
   */
  gasEstimate: BigNumber | null;
  /**
   * Final attempted gas limit set by the on-chain quote provider
   */
  gasLimit: BigNumber | null;
};

export class BlockConflictError extends Error {
  public name = 'BlockConflictError';
}

export class SuccessRateError extends Error {
  public name = 'SuccessRateError';
}

export class ProviderBlockHeaderError extends Error {
  public name = 'ProviderBlockHeaderError';
}

export class ProviderTimeoutError extends Error {
  public name = 'ProviderTimeoutError';
}

/**
 * This error typically means that the gas used by the multicall has
 * exceeded the total call gas limit set by the node provider.
 *
 * This can be resolved by modifying BatchParams to request fewer
 * quotes per call, or to set a lower gas limit per quote.
 *
 * @export
 * @class ProviderGasError
 */
export class ProviderGasError extends Error {
  public name = 'ProviderGasError';
}

export type QuoteRetryOptions = RetryOptions;

/**
 * The V3 route and a list of quotes for that route.
 */
export type RouteWithQuotes<TRoute extends SupportedRoutes> = [TRoute, AmountQuote[]];

/**
 * Final consolidated return type of all on-chain quotes.
 */
export type OnChainQuotes<TRoute extends SupportedRoutes> = {
  routesWithQuotes: RouteWithQuotes<TRoute>[];
  blockNumber: BigNumber;
};

export type SupportedExactOutRoutes = V3Route;

type QuoteBatchSuccess<TQuoteParams> = {
  status: 'success';
  inputs: TQuoteParams[];
  results: {
    blockNumber: BigNumber;
    results: Result<[BigNumber, BigNumber[], number[], BigNumber]>[];
    approxGasUsedPerSuccessCall: number;
  };
};

type QuoteBatchFailed<TQuoteParams> = {
  status: 'failed';
  inputs: TQuoteParams[];
  reason: Error;
  results?: {
    blockNumber: BigNumber;
    results: Result<[BigNumber, BigNumber[], number[], BigNumber]>[];
    approxGasUsedPerSuccessCall: number;
  };
};

type QuoteBatchPending<TQuoteParams> = {
  status: 'pending';
  inputs: TQuoteParams[];
};

type QuoteBatchState<TQuoteParams> =
  | QuoteBatchSuccess<TQuoteParams>
  | QuoteBatchFailed<TQuoteParams>
  | QuoteBatchPending<TQuoteParams>;

/**
 * Provider for getting on chain quotes using routes containing V3 pools or V2 pools.
 *
 * @export
 * @interface IOnChainQuoteProvider
 */
export interface IOnChainQuoteProvider {
  /**
   * For every route, gets an exactIn quotes for every amount provided.
   * @notice While passing in exactIn V2Routes is supported, we recommend using the V2QuoteProvider to compute off chain quotes for V2 whenever possible
   *
   * @param amountIns The amounts to get quotes for.
   * @param routes The routes to get quotes for.
   * @param [providerConfig] The provider config.
   * @returns For each route returns a RouteWithQuotes object that contains all the quotes.
   * @returns The blockNumber used when generating the quotes.
   */
  getQuotesManyExactIn<TRoute extends SupportedRoutes>(
    amountIns: CurrencyAmount[],
    routes: TRoute[],
    providerConfig?: ProviderConfig
  ): Promise<OnChainQuotes<TRoute>>;

  /**
   * For every route, gets ane exactOut quote for every amount provided.
   * @notice This does not support quotes for MixedRoutes (routes with both V3 and V2 pools/pairs) or pure V2 routes
   *
   * @param amountOuts The amounts to get quotes for.
   * @param routes The routes to get quotes for.
   * @param [providerConfig] The provider config.
   * @returns For each route returns a RouteWithQuotes object that contains all the quotes.
   * @returns The blockNumber used when generating the quotes.
   */
  getQuotesManyExactOut<TRoute extends SupportedExactOutRoutes>(
    amountOuts: CurrencyAmount[],
    routes: TRoute[],
    providerConfig?: ProviderConfig
  ): Promise<OnChainQuotes<TRoute>>;
}

/**
 * The parameters for the multicalls we make.
 *
 * It is important to ensure that (gasLimitPerCall * multicallChunk) < providers gas limit per call.
 *
 * On chain quotes can consume a lot of gas (if the swap is so large that it swaps through a large
 * number of ticks), so there is a risk of exceeded gas limits in these multicalls.
 */
export type BatchParams = {
  /**
   * The number of quotes to fetch in each multicall.
   */
  multicallChunk: number;
  /**
   * The maximum call to consume for each quote in the multicall.
   */
  gasLimitPerCall: number;
  /**
   * The minimum success rate for all quotes across all multicalls.
   * If we set our gasLimitPerCall too low it could result in a large number of
   * quotes failing due to out of gas. This parameters will fail the overall request
   * in this case.
   */
  quoteMinSuccessRate: number;
};

/**
 * The fallback values for gasLimit and multicallChunk if any failures occur.
 *
 */

export type FailureOverrides = {
  multicallChunk: number;
  gasLimitOverride: number;
};

export type BlockHeaderFailureOverridesDisabled = { enabled: false };
export type BlockHeaderFailureOverridesEnabled = {
  enabled: true;
  // Offset to apply in the case of a block header failure. e.g. -10 means rollback by 10 blocks.
  rollbackBlockOffset: number;
  // Number of batch failures due to block header before trying a rollback.
  attemptsBeforeRollback: number;
};
export type BlockHeaderFailureOverrides =
  | BlockHeaderFailureOverridesDisabled
  | BlockHeaderFailureOverridesEnabled;

/**
 * Config around what block number to query and how to handle failures due to block header errors.
 */
export type BlockNumberConfig = {
  // Applies an offset to the block number specified when fetching quotes. e.g. -10 means rollback by 10 blocks.
  // Useful for networks where the latest block may not be available on all nodes, causing frequent 'header not found' errors.
  baseBlockOffset: number;
  // Config for handling header not found errors.
  rollback: BlockHeaderFailureOverrides;
};

const DEFAULT_BATCH_RETRIES = 2;

/**
 * Computes on chain quotes for swaps. For pure V3 routes, quotes are computed on-chain using
 * the 'QuoterV2' smart contract. For exactIn mixed and V2 routes, quotes are computed using the 'MixedRouteQuoterV1' contract
 * This is because computing quotes off-chain would require fetching all the tick data for each pool, which is a lot of data.
 *
 * To minimize the number of requests for quotes we use a Multicall contract. Generally
 * the number of quotes to fetch exceeds the maximum we can fit in a single multicall
 * while staying under gas limits, so we also batch these quotes across multiple multicalls.
 *
 * The biggest challenge with the quote provider is dealing with various gas limits.
 * Each provider sets a limit on the amount of gas a call can consume (on Infura this
 * is approximately 10x the block max size), so we must ensure each multicall does not
 * exceed this limit. Additionally, each quote on V3 can consume a large number of gas if
 * the pool lacks liquidity and the swap would cause all the ticks to be traversed.
 *
 * To ensure we don't exceed the node's call limit, we limit the gas used by each quote to
 * a specific value, and we limit the number of quotes in each multicall request. Users of this
 * class should set BatchParams such that multicallChunk * gasLimitPerCall is less than their node
 * providers total gas limit per call.
 *
 * @export
 * @class OnChainQuoteProvider
 */
export class OnChainQuoteProvider implements IOnChainQuoteProvider {
  /**
   * Creates an instance of OnChainQuoteProvider.
   *
   * @param chainId The chain to get quotes for.
   * @param provider The web 3 provider.
   * @param multicall2Provider The multicall provider to use to get the quotes on-chain.
   * Only supports the Uniswap Multicall contract as it needs the gas limitting functionality.
   * @param retryOptions The retry options for each call to the multicall.
   * @param batchParams The parameters for each batched call to the multicall.
   * @param gasErrorFailureOverride The gas and chunk parameters to use when retrying a batch that failed due to out of gas.
   * @param successRateFailureOverrides The parameters for retries when we fail to get quotes.
   * @param blockNumberConfig Parameters for adjusting which block we get quotes from, and how to handle block header not found errors.
   * @param [quoterAddressOverride] Overrides the address of the quoter contract to use.
   * @param metricsPrefix metrics prefix to differentiate between different instances of the quote provider.
   */
  constructor(
    protected chainId: ChainId,
    protected provider: BaseProvider,
    // Only supports Uniswap Multicall as it needs the gas limitting functionality.
    protected multicall2Provider: UniswapMulticallProvider,
    // retryOptions, batchParams, and gasErrorFailureOverride are always override in alpha-router
    // so below default values are always not going to be picked up in prod.
    // So we will not extract out below default values into constants.
    protected retryOptions: QuoteRetryOptions = {
      retries: DEFAULT_BATCH_RETRIES,
      minTimeout: 25,
      maxTimeout: 250,
    },
    protected batchParams: (
      optimisticCachedRoutes: boolean,
      useMixedRouteQuoter: boolean
    ) => BatchParams = (_optimisticCachedRoutes, _useMixedRouteQuoter) => {
      return {
        multicallChunk: 150,
        gasLimitPerCall: 1_000_000,
        quoteMinSuccessRate: 0.2,
      };
    },
    protected gasErrorFailureOverride: FailureOverrides = {
      gasLimitOverride: 1_500_000,
      multicallChunk: 100,
    },
    // successRateFailureOverrides and blockNumberConfig are not always override in alpha-router.
    // So we will extract out below default values into constants.
    // In alpha-router default case, we will also define the constants with same values as below.
    protected successRateFailureOverrides: FailureOverrides = DEFAULT_SUCCESS_RATE_FAILURE_OVERRIDES,
    protected blockNumberConfig: BlockNumberConfig = DEFAULT_BLOCK_NUMBER_CONFIGS,
    protected quoterAddressOverride?: (
      useMixedRouteQuoter: boolean,
      protocol: Protocol
    ) => string | undefined,
    protected metricsPrefix: (
      chainId: ChainId,
      useMixedRouteQuoter: boolean,
      optimisticCachedRoutes: boolean
    ) => string = (chainId, useMixedRouteQuoter, optimisticCachedRoutes) =>
      useMixedRouteQuoter
        ? `ChainId_${chainId}_MixedQuoter_OptimisticCachedRoutes${optimisticCachedRoutes}_`
        : `ChainId_${chainId}_V3Quoter_OptimisticCachedRoutes${optimisticCachedRoutes}_`
  ) {}

  private getQuoterAddress(useMixedRouteQuoter: boolean, protocol: Protocol): string {
    if (this.quoterAddressOverride) {
      const quoterAddress = this.quoterAddressOverride(useMixedRouteQuoter, protocol);

      if (!quoterAddress) {
        throw new Error(`No address for the quoter contract on chain id: ${this.chainId}`);
      }
      return quoterAddress;
    }
    // const quoterAddress = useMixedRouteQuoter
    //   ? MIXED_ROUTE_QUOTER_V1_ADDRESSES[this.chainId]
    //   : protocol === Protocol.V3
    //   ? NEW_QUOTER_V2_ADDRESSES[this.chainId]
    //   : PROTOCOL_V4_QUOTER_ADDRESSES[this.chainId];

    const quoterAddress = useMixedRouteQuoter
      ? MIXED_ROUTE_QUOTER_V1_ADDRESSES[this.chainId]
      : CHAIN_TO_ADDRESSES_MAP[this.chainId]?.quoterAddress;

    if (!quoterAddress) {
      throw new Error(`No address for the quoter contract on chain id: ${this.chainId}`);
    }
    return quoterAddress;
  }

  public async getQuotesManyExactIn<TRoute extends SupportedRoutes>(
    amountIns: CurrencyAmount[],
    routes: TRoute[],
    providerConfig?: ProviderConfig
  ): Promise<OnChainQuotes<TRoute>> {
    return this.getQuotesManyData(amountIns, routes, 'quoteExactInput', providerConfig);
  }

  public async getQuotesManyExactOut<TRoute extends SupportedExactOutRoutes>(
    amountOuts: CurrencyAmount[],
    routes: TRoute[],
    providerConfig?: ProviderConfig
  ): Promise<OnChainQuotes<TRoute>> {
    return this.getQuotesManyData(amountOuts, routes, 'quoteExactOutput', providerConfig);
  }

  private encodeRouteToPath<TRoute extends SupportedRoutes, TPath extends SupportedPath>(
    route: TRoute,
    functionName: string
  ): TPath {
    switch (route.protocol) {
      case Protocol.V3:
        return encodeRouteToPath(
          route,
          functionName == 'quoteExactOutput' // For exactOut must be true to ensure the routes are reversed.
        ) as TPath;
      // case Protocol.V4:
      //   return this.convertV4RouteToPathKey(
      //     route,
      //     functionName == 'quoteExactOutput'
      //   ) as TPath;
      // We don't have onchain V2 quoter, but we do have a mixed quoter that can quote against v2 routes onchain
      // Hence in case of V2 or mixed, we explicitly encode into mixed routes.
      case Protocol.V2:
      case Protocol.MIXED:
        return encodeMixedRouteToPath(
          route instanceof V2Route
            ? new MixedRouteSDK(route.pairs, route.input, route.output)
            : route
        ) as TPath;
      default:
        throw new Error(`Unsupported protocol for the route: ${JSON.stringify(route)}`);
    }
  }

  // public convertV4RouteToPathKey(route: V4Route, exactOut: boolean): PathKey[] {
  //   const firstInputToken: Token = route.input.wrapped;

  //   const { path } = route.pools.reduce(
  //     (
  //       { inputToken, path }: { inputToken: Currency; path: PathKey[] },
  //       pool: Pool,
  //       index
  //     ): { inputToken: Currency; path: PathKey[] } => {
  //       const outputToken = pool.token0.equals(inputToken)
  //         ? pool.token1
  //         : pool.token0;

  //       const pathKey: PathKey = {
  //         intermediateCurrency: exactOut
  //           ? inputToken.wrapped.address
  //           : outputToken.wrapped.address,
  //         hookData: '0x',
  //         ...pool,
  //       };

  //       if (index === 0) {
  //         return {
  //           inputToken: outputToken,
  //           path: [pathKey],
  //         };
  //       } else {
  //         return {
  //           inputToken: outputToken,
  //           path: [...path, pathKey],
  //         };
  //       }
  //     },
  //     { inputToken: firstInputToken, path: [] as PathKey[] }
  //   );

  //   return path;
  // }

  private getContractInterface(useMixedRouteQuoter: boolean, protocol: Protocol): Interface {
    if (useMixedRouteQuoter) {
      return IMixedRouteQuoterV1__factory.createInterface();
    }

    switch (protocol) {
      case Protocol.V3:
        return IQuoterV2__factory.createInterface();
      // case Protocol.V4:
      //   return V4Quoter__factory.createInterface();
      default:
        throw new Error(`Unsupported protocol: ${protocol}`);
    }
  }

  private async consolidateResults(
    protocol: Protocol,
    useMixedRouteQuoter: boolean,
    functionName: string,
    inputs: (QuoteExactParams[] | [string, string])[],
    providerConfig?: ProviderConfig,
    gasLimitOverride?: number
  ): Promise<{
    blockNumber: BigNumber;
    results: Result<[BigNumber, BigNumber[], number[], BigNumber]>[];
    approxGasUsedPerSuccessCall: number;
  }> {
    switch (protocol) {
      // case Protocol.V4:
      //   // eslint-disable-next-line no-case-declarations
      //   const results = await this.multicall2Provider.callSameFunctionOnContractWithMultipleParams<
      //     QuoteExactParams[],
      //     [BigNumber[], BigNumber[], number[]] // deltaAmounts, sqrtPriceX96AfterList, initializedTicksCrossedList
      //   >({
      //     address: this.getQuoterAddress(useMixedRouteQuoter, protocol),
      //     contractInterface: this.getContractInterface(useMixedRouteQuoter, protocol),
      //     functionName,
      //     functionParams: inputs as QuoteExactParams[][],
      //     providerConfig,
      //     additionalConfig: {
      //       gasLimitPerCallOverride: gasLimitOverride,
      //     },
      //   });

      //   return {
      //     blockNumber: results.blockNumber,
      //     approxGasUsedPerSuccessCall: results.approxGasUsedPerSuccessCall,
      //     results: results.results.map((result) => {
      //       if (result.success) {
      //         let deltaAmountsSum = BigNumber.from(0);
      //         result.result[0].forEach((result) => {
      //           deltaAmountsSum = deltaAmountsSum.add(result as BigNumber);
      //         });

      //         switch (functionName) {
      //           case 'quoteExactInput':
      //             return {
      //               success: true,
      //               result: [
      //                 result.result[0][result.result[0].length - 1]?.mul(-1), // we need to negate the negative amount out in case of exact in
      //                 result.result[1],
      //                 result.result[2],
      //                 BigNumber.from(0),
      //               ],
      //             } as SuccessResult<[BigNumber, BigNumber[], number[], BigNumber]>;
      //           case 'quoteExactOutput':
      //             return {
      //               success: true,
      //               result: [
      //                 // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      //                 result.result[0][0]!, // amount in is the first element in the array, with positive sign
      //                 result.result[1],
      //                 result.result[2],
      //                 BigNumber.from(0),
      //               ],
      //             } as SuccessResult<[BigNumber, BigNumber[], number[], BigNumber]>;
      //           default:
      //             throw new Error(`Unsupported function name: ${functionName}`);
      //         }
      //       } else {
      //         return result;
      //       }
      //     }),
      //   };
      default:
        return await this.multicall2Provider.callSameFunctionOnContractWithMultipleParams<
          [string, string],
          [BigNumber, BigNumber[], number[], BigNumber] // amountIn/amountOut, sqrtPriceX96AfterList, initializedTicksCrossedList, gasEstimate
        >({
          address: this.getQuoterAddress(useMixedRouteQuoter, protocol),
          contractInterface: useMixedRouteQuoter
            ? IMixedRouteQuoterV1__factory.createInterface()
            : IQuoterV2__factory.createInterface(),
          functionName,
          functionParams: inputs as [string, string][],
          providerConfig,
          additionalConfig: {
            gasLimitPerCallOverride: gasLimitOverride,
          },
        });
    }
  }

  private async getQuotesManyData<TRoute extends SupportedRoutes>(
    amounts: CurrencyAmount[],
    routes: TRoute[],
    functionName: 'quoteExactInput' | 'quoteExactOutput',
    _providerConfig?: ProviderConfig
  ): Promise<OnChainQuotes<TRoute>> {
    const useMixedRouteQuoter =
      routes.some((route) => route.protocol === Protocol.V2) ||
      routes.some((route) => route.protocol === Protocol.MIXED);
    // const useV4RouteQuoter = routes.some((route) => route.protocol === Protocol.V4);
    const optimisticCachedRoutes = _providerConfig?.optimisticCachedRoutes ?? false;

    /// Validate that there are no incorrect routes / function combinations
    this.validateRoutes(routes, functionName, useMixedRouteQuoter);

    let multicallChunk = this.batchParams(
      optimisticCachedRoutes,
      useMixedRouteQuoter
    ).multicallChunk;
    let gasLimitOverride = this.batchParams(
      optimisticCachedRoutes,
      useMixedRouteQuoter
    ).gasLimitPerCall;
    const { baseBlockOffset, rollback } = this.blockNumberConfig;

    // Apply the base block offset if provided
    const originalBlockNumber = await this.provider.getBlockNumber();
    const providerConfig: ProviderConfig = {
      ..._providerConfig,
      blockNumber: _providerConfig?.blockNumber ?? originalBlockNumber + baseBlockOffset,
    };

    const inputs: (QuoteExactParams[] | [string, string])[] = _(routes)
      .flatMap((route) => {
        const encodedRoute = this.encodeRouteToPath(route, functionName);

        const routeInputs: (QuoteExactParams[] | [string, string])[] = amounts.map((amount) => {
          // if (route.protocol === Protocol.V4) {
          //   return [
          //     {
          //       exactCurrency: amount.currency.wrapped.address,
          //       path: encodedRoute as PathKey[],
          //       exactAmount: amount.quotient.toString(),
          //     },
          //   ] as QuoteExactParams[];
          // } else {
          //   return [encodedRoute as string, `0x${amount.quotient.toString(16)}`];
          // }

          return [encodedRoute as string, `0x${amount.quotient.toString(16)}`];
        });
        return routeInputs;
      })
      .value();

    const normalizedChunk = Math.ceil(inputs.length / Math.ceil(inputs.length / multicallChunk));
    const inputsChunked = _.chunk(inputs, normalizedChunk);
    let quoteStates: QuoteBatchState<QuoteExactParams[] | [string, string]>[] = _.map(
      inputsChunked,
      (inputChunk) => {
        return {
          status: 'pending',
          inputs: inputChunk,
        };
      }
    );

    log.info(
      `About to get ${inputs.length} quotes in chunks of ${normalizedChunk} [${_.map(
        inputsChunked,
        (i) => i.length
      ).join(',')}] ${
        gasLimitOverride ? `with a gas limit override of ${gasLimitOverride}` : ''
      } and block number: ${await providerConfig.blockNumber} [Original before offset: ${originalBlockNumber}].`
    );

    metric.putMetric(
      `${this.metricsPrefix(
        this.chainId,
        useMixedRouteQuoter,
        optimisticCachedRoutes
      )}QuoteBatchSize`,
      inputs.length,
      MetricLoggerUnit.Count
    );
    metric.putMetric(
      `${this.metricsPrefix(
        this.chainId,
        useMixedRouteQuoter,
        optimisticCachedRoutes
      )}QuoteBatchSize_${ID_TO_NETWORK_NAME(this.chainId)}`,
      inputs.length,
      MetricLoggerUnit.Count
    );

    const startTime = Date.now();

    let haveRetriedForSuccessRate = false;
    let haveRetriedForBlockHeader = false;
    let blockHeaderRetryAttemptNumber = 0;
    let haveIncrementedBlockHeaderFailureCounter = false;
    let blockHeaderRolledBack = false;
    let haveRetriedForBlockConflictError = false;
    let haveRetriedForOutOfGas = false;
    let haveRetriedForTimeout = false;
    let haveRetriedForUnknownReason = false;
    let finalAttemptNumber = 1;
    const expectedCallsMade = quoteStates.length;
    let totalCallsMade = 0;

    const {
      results: quoteResults,
      blockNumber,
      approxGasUsedPerSuccessCall,
    } = await retry(
      async (_bail, attemptNumber) => {
        haveIncrementedBlockHeaderFailureCounter = false;
        finalAttemptNumber = attemptNumber;

        const [success, failed, pending] = this.partitionQuotes(quoteStates);

        log.info(
          `Starting attempt: ${attemptNumber}.
          Currently ${success.length} success, ${failed.length} failed, ${pending.length} pending.
          Gas limit override: ${gasLimitOverride} Block number override: ${providerConfig.blockNumber}.`
        );

        quoteStates = await Promise.all(
          _.map(
            quoteStates,
            async (
              quoteState: QuoteBatchState<QuoteExactParams[] | [string, string]>,
              idx: number
            ) => {
              if (quoteState.status == 'success') {
                return quoteState;
              }

              // QuoteChunk is pending or failed, so we try again
              const { inputs } = quoteState;

              try {
                totalCallsMade = totalCallsMade + 1;

                // const protocol = useMixedRouteQuoter
                //   ? Protocol.MIXED
                //   : useV4RouteQuoter
                //   ? Protocol.V4
                //   : Protocol.V3;

                const protocol = useMixedRouteQuoter ? Protocol.MIXED : Protocol.V3;
                const results = await this.consolidateResults(
                  protocol,
                  useMixedRouteQuoter,
                  functionName,
                  inputs,
                  providerConfig,
                  gasLimitOverride
                );

                const successRateError = this.validateSuccessRate(
                  results.results,
                  haveRetriedForSuccessRate,
                  useMixedRouteQuoter,
                  optimisticCachedRoutes
                );

                if (successRateError) {
                  return {
                    status: 'failed',
                    inputs,
                    reason: successRateError,
                    results,
                  } as QuoteBatchFailed<QuoteExactParams[] | [string, string]>;
                }

                return {
                  status: 'success',
                  inputs,
                  results,
                } as QuoteBatchSuccess<QuoteExactParams[] | [string, string]>;
              } catch (err: any) {
                // Error from providers have huge messages that include all the calldata and fill the logs.
                // Catch them and rethrow with shorter message.
                if (err.message.includes('header not found')) {
                  return {
                    status: 'failed',
                    inputs,
                    reason: new ProviderBlockHeaderError(err.message.slice(0, 500)),
                  } as QuoteBatchFailed<QuoteExactParams[] | [string, string]>;
                }

                if (err.message.includes('timeout')) {
                  return {
                    status: 'failed',
                    inputs,
                    reason: new ProviderTimeoutError(
                      `Req ${idx}/${quoteStates.length}. Request had ${
                        inputs.length
                      } inputs. ${err.message.slice(0, 500)}`
                    ),
                  } as QuoteBatchFailed<QuoteExactParams[] | [string, string]>;
                }

                if (err.message.includes('out of gas')) {
                  return {
                    status: 'failed',
                    inputs,
                    reason: new ProviderGasError(err.message.slice(0, 500)),
                  } as QuoteBatchFailed<QuoteExactParams[] | [string, string]>;
                }

                return {
                  status: 'failed',
                  inputs,
                  reason: new Error(`Unknown error from provider: ${err.message.slice(0, 500)}`),
                } as QuoteBatchFailed<QuoteExactParams[] | [string, string]>;
              }
            }
          )
        );

        const [successfulQuoteStates, failedQuoteStates, pendingQuoteStates] =
          this.partitionQuotes(quoteStates);

        if (pendingQuoteStates.length > 0) {
          throw new Error('Pending quote after waiting for all promises.');
        }

        let retryAll = false;

        const blockNumberError = this.validateBlockNumbers<QuoteExactParams[] | [string, string]>(
          successfulQuoteStates,
          inputsChunked.length,
          gasLimitOverride
        );

        // If there is a block number conflict we retry all the quotes.
        if (blockNumberError) {
          retryAll = true;
        }

        const reasonForFailureStr = _.map(
          failedQuoteStates,
          (failedQuoteState) => failedQuoteState.reason.name
        ).join(', ');

        if (failedQuoteStates.length > 0) {
          log.info(
            `On attempt ${attemptNumber}: ${failedQuoteStates.length}/${quoteStates.length} quotes failed. Reasons: ${reasonForFailureStr}`
          );

          for (const failedQuoteState of failedQuoteStates) {
            const { reason: error } = failedQuoteState;

            log.info({ error }, `[QuoteFetchError] Attempt ${attemptNumber}. ${error.message}`);

            if (error instanceof BlockConflictError) {
              if (!haveRetriedForBlockConflictError) {
                metric.putMetric(
                  `${this.metricsPrefix(
                    this.chainId,
                    useMixedRouteQuoter,
                    optimisticCachedRoutes
                  )}QuoteBlockConflictErrorRetry`,
                  1,
                  MetricLoggerUnit.Count
                );
                haveRetriedForBlockConflictError = true;
              }

              retryAll = true;
            } else if (error instanceof ProviderBlockHeaderError) {
              if (!haveRetriedForBlockHeader) {
                metric.putMetric(
                  `${this.metricsPrefix(
                    this.chainId,
                    useMixedRouteQuoter,
                    optimisticCachedRoutes
                  )}QuoteBlockHeaderNotFoundRetry`,
                  1,
                  MetricLoggerUnit.Count
                );
                haveRetriedForBlockHeader = true;
              }

              // Ensure that if multiple calls fail due to block header in the current pending batch,
              // we only count once.
              if (!haveIncrementedBlockHeaderFailureCounter) {
                blockHeaderRetryAttemptNumber = blockHeaderRetryAttemptNumber + 1;
                haveIncrementedBlockHeaderFailureCounter = true;
              }

              if (rollback.enabled) {
                const { rollbackBlockOffset, attemptsBeforeRollback } = rollback;

                if (
                  blockHeaderRetryAttemptNumber >= attemptsBeforeRollback &&
                  !blockHeaderRolledBack
                ) {
                  log.info(
                    `Attempt ${attemptNumber}. Have failed due to block header ${
                      blockHeaderRetryAttemptNumber - 1
                    } times. Rolling back block number by ${rollbackBlockOffset} for next retry`
                  );
                  providerConfig.blockNumber = providerConfig.blockNumber
                    ? (await providerConfig.blockNumber) + rollbackBlockOffset
                    : (await this.provider.getBlockNumber()) + rollbackBlockOffset;

                  retryAll = true;
                  blockHeaderRolledBack = true;
                }
              }
            } else if (error instanceof ProviderTimeoutError) {
              if (!haveRetriedForTimeout) {
                metric.putMetric(
                  `${this.metricsPrefix(
                    this.chainId,
                    useMixedRouteQuoter,
                    optimisticCachedRoutes
                  )}QuoteTimeoutRetry`,
                  1,
                  MetricLoggerUnit.Count
                );
                haveRetriedForTimeout = true;
              }
            } else if (error instanceof ProviderGasError) {
              if (!haveRetriedForOutOfGas) {
                metric.putMetric(
                  `${this.metricsPrefix(
                    this.chainId,
                    useMixedRouteQuoter,
                    optimisticCachedRoutes
                  )}QuoteOutOfGasExceptionRetry`,
                  1,
                  MetricLoggerUnit.Count
                );
                haveRetriedForOutOfGas = true;
              }
              gasLimitOverride = this.gasErrorFailureOverride.gasLimitOverride;
              multicallChunk = this.gasErrorFailureOverride.multicallChunk;
              retryAll = true;
            } else if (error instanceof SuccessRateError) {
              if (!haveRetriedForSuccessRate) {
                metric.putMetric(
                  `${this.metricsPrefix(
                    this.chainId,
                    useMixedRouteQuoter,
                    optimisticCachedRoutes
                  )}QuoteSuccessRateRetry`,
                  1,
                  MetricLoggerUnit.Count
                );
                haveRetriedForSuccessRate = true;

                // Low success rate can indicate too little gas given to each call.
                gasLimitOverride = this.successRateFailureOverrides.gasLimitOverride;
                multicallChunk = this.successRateFailureOverrides.multicallChunk;
                retryAll = true;
              }
            } else {
              if (!haveRetriedForUnknownReason) {
                metric.putMetric(
                  `${this.metricsPrefix(
                    this.chainId,
                    useMixedRouteQuoter,
                    optimisticCachedRoutes
                  )}QuoteUnknownReasonRetry`,
                  1,
                  MetricLoggerUnit.Count
                );
                haveRetriedForUnknownReason = true;
              }
            }
          }
        }

        if (retryAll) {
          log.info(`Attempt ${attemptNumber}. Resetting all requests to pending for next attempt.`);

          const normalizedChunk = Math.ceil(
            inputs.length / Math.ceil(inputs.length / multicallChunk)
          );

          const inputsChunked = _.chunk(inputs, normalizedChunk);
          quoteStates = _.map(inputsChunked, (inputChunk) => {
            return {
              status: 'pending',
              inputs: inputChunk,
            };
          });
        }

        if (failedQuoteStates.length > 0) {
          // TODO: Work with Arbitrum to find a solution for making large multicalls with gas limits that always
          // successfully.
          //
          // On Arbitrum we can not set a gas limit for every call in the multicall and guarantee that
          // we will not run out of gas on the node. This is because they have a different way of accounting
          // for gas, that seperates storage and compute gas costs, and we can not cover both in a single limit.
          //
          // To work around this and avoid throwing errors when really we just couldn't get a quote, we catch this
          // case and return 0 quotes found.
          if (
            this.chainId == ChainId.ARBITRUM &&
            _.every(
              failedQuoteStates,
              (failedQuoteState) => failedQuoteState.reason instanceof ProviderGasError
            ) &&
            attemptNumber == this.retryOptions.retries
          ) {
            log.error(
              `Failed to get quotes on Arbitrum due to provider gas error issue. Overriding error to return 0 quotes.`
            );
            return {
              results: [],
              blockNumber: BigNumber.from(0),
              approxGasUsedPerSuccessCall: 0,
            };
          }
          throw new Error(
            `Failed to get ${failedQuoteStates.length} quotes. Reasons: ${reasonForFailureStr}`
          );
        }

        const callResults = _.map(successfulQuoteStates, (quoteState) => quoteState.results);

        return {
          results: _.flatMap(callResults, (result) => result.results),
          blockNumber: BigNumber.from(callResults[0]!.blockNumber),
          approxGasUsedPerSuccessCall: stats.percentile(
            _.map(callResults, (result) => result.approxGasUsedPerSuccessCall),
            100
          ),
        };
      },
      {
        retries: DEFAULT_BATCH_RETRIES,
        ...this.retryOptions,
      }
    );

    const routesQuotes = this.processQuoteResults(
      quoteResults,
      routes,
      amounts,
      BigNumber.from(gasLimitOverride)
    );

    const endTime = Date.now();
    metric.putMetric(
      `${this.metricsPrefix(
        this.chainId,
        useMixedRouteQuoter,
        optimisticCachedRoutes
      )}QuoteLatency`,
      endTime - startTime,
      MetricLoggerUnit.Milliseconds
    );

    metric.putMetric(
      `${this.metricsPrefix(
        this.chainId,
        useMixedRouteQuoter,
        optimisticCachedRoutes
      )}QuoteApproxGasUsedPerSuccessfulCall`,
      approxGasUsedPerSuccessCall,
      MetricLoggerUnit.Count
    );

    metric.putMetric(
      `${this.metricsPrefix(
        this.chainId,
        useMixedRouteQuoter,
        optimisticCachedRoutes
      )}QuoteNumRetryLoops`,
      finalAttemptNumber - 1,
      MetricLoggerUnit.Count
    );

    metric.putMetric(
      `${this.metricsPrefix(
        this.chainId,
        useMixedRouteQuoter,
        optimisticCachedRoutes
      )}QuoteTotalCallsToProvider`,
      totalCallsMade,
      MetricLoggerUnit.Count
    );

    metric.putMetric(
      `${this.metricsPrefix(
        this.chainId,
        useMixedRouteQuoter,
        optimisticCachedRoutes
      )}QuoteExpectedCallsToProvider`,
      expectedCallsMade,
      MetricLoggerUnit.Count
    );

    metric.putMetric(
      `${this.metricsPrefix(
        this.chainId,
        useMixedRouteQuoter,
        optimisticCachedRoutes
      )}QuoteNumRetriedCalls`,
      totalCallsMade - expectedCallsMade,
      MetricLoggerUnit.Count
    );

    const [successfulQuotes, failedQuotes] = _(routesQuotes)
      .flatMap((routeWithQuotes: RouteWithQuotes<TRoute>) => routeWithQuotes[1])
      .partition((quote) => quote.quote != null)
      .value();

    log.info(
      `Got ${successfulQuotes.length} successful quotes, ${
        failedQuotes.length
      } failed quotes. Took ${
        finalAttemptNumber - 1
      } attempt loops. Total calls made to provider: ${totalCallsMade}. Have retried for timeout: ${haveRetriedForTimeout}`
    );

    return {
      routesWithQuotes: routesQuotes,
      blockNumber,
    } as OnChainQuotes<TRoute>;
  }

  private partitionQuotes<TQuoteParams>(
    quoteStates: QuoteBatchState<TQuoteParams>[]
  ): [
    QuoteBatchSuccess<TQuoteParams>[],
    QuoteBatchFailed<TQuoteParams>[],
    QuoteBatchPending<TQuoteParams>[]
  ] {
    const successfulQuoteStates: QuoteBatchSuccess<TQuoteParams>[] = _.filter<
      QuoteBatchState<TQuoteParams>,
      QuoteBatchSuccess<TQuoteParams>
    >(
      quoteStates,
      (quoteState): quoteState is QuoteBatchSuccess<TQuoteParams> => quoteState.status == 'success'
    );

    const failedQuoteStates: QuoteBatchFailed<TQuoteParams>[] = _.filter<
      QuoteBatchState<TQuoteParams>,
      QuoteBatchFailed<TQuoteParams>
    >(
      quoteStates,
      (quoteState): quoteState is QuoteBatchFailed<TQuoteParams> => quoteState.status == 'failed'
    );

    const pendingQuoteStates: QuoteBatchPending<TQuoteParams>[] = _.filter<
      QuoteBatchState<TQuoteParams>,
      QuoteBatchPending<TQuoteParams>
    >(
      quoteStates,
      (quoteState): quoteState is QuoteBatchPending<TQuoteParams> => quoteState.status == 'pending'
    );

    return [successfulQuoteStates, failedQuoteStates, pendingQuoteStates];
  }

  private processQuoteResults<TRoute extends SupportedRoutes>(
    quoteResults: Result<[BigNumber, BigNumber[], number[], BigNumber]>[],
    routes: TRoute[],
    amounts: CurrencyAmount[],
    gasLimit: BigNumber
  ): RouteWithQuotes<TRoute>[] {
    const routesQuotes: RouteWithQuotes<TRoute>[] = [];

    const quotesResultsByRoute = _.chunk(quoteResults, amounts.length);

    const debugFailedQuotes: {
      amount: string;
      percent: number;
      route: string;
    }[] = [];

    for (let i = 0; i < quotesResultsByRoute.length; i++) {
      const route = routes[i]!;
      const quoteResults = quotesResultsByRoute[i]!;
      const quotes: AmountQuote[] = _.map(
        quoteResults,
        (quoteResult: Result<[BigNumber, BigNumber[], number[], BigNumber]>, index: number) => {
          const amount = amounts[index]!;
          if (!quoteResult.success) {
            const percent = (100 / amounts.length) * (index + 1);

            const amountStr = amount.toFixed(Math.min(amount.currency.decimals, 2));
            const routeStr = routeToString(route);
            debugFailedQuotes.push({
              route: routeStr,
              percent,
              amount: amountStr,
            });

            return {
              amount,
              quote: null,
              sqrtPriceX96AfterList: null,
              gasEstimate: quoteResult.gasUsed ?? null,
              gasLimit: gasLimit,
              initializedTicksCrossedList: null,
            };
          }

          return {
            amount,
            quote: quoteResult.result[0],
            sqrtPriceX96AfterList: quoteResult.result[1],
            initializedTicksCrossedList: quoteResult.result[2],
            gasEstimate: quoteResult.result[3],
            gasLimit: gasLimit,
          };
        }
      );

      routesQuotes.push([route, quotes]);
    }

    // For routes and amounts that we failed to get a quote for, group them by route
    // and batch them together before logging to minimize number of logs.
    const debugChunk = 80;
    _.forEach(_.chunk(debugFailedQuotes, debugChunk), (quotes, idx) => {
      const failedQuotesByRoute = _.groupBy(quotes, (q) => q.route);
      const failedFlat = _.mapValues(failedQuotesByRoute, (f) =>
        _(f)
          .map((f) => `${f.percent}%[${f.amount}]`)
          .join(',')
      );

      log.info(
        {
          failedQuotes: _.map(failedFlat, (amounts, routeStr) => `${routeStr} : ${amounts}`),
        },
        `Failed on chain quotes for routes Part ${idx}/${Math.ceil(
          debugFailedQuotes.length / debugChunk
        )}`
      );
    });

    return routesQuotes;
  }

  private validateBlockNumbers<TQuoteParams>(
    successfulQuoteStates: QuoteBatchSuccess<TQuoteParams>[],
    totalCalls: number,
    gasLimitOverride?: number
  ): BlockConflictError | null {
    if (successfulQuoteStates.length <= 1) {
      return null;
    }

    const results = _.map(successfulQuoteStates, (quoteState) => quoteState.results);

    const blockNumbers = _.map(results, (result) => result.blockNumber);

    const uniqBlocks = _(blockNumbers)
      .map((blockNumber) => blockNumber.toNumber())
      .uniq()
      .value();

    if (uniqBlocks.length == 1) {
      return null;
    }

    /* if (
      uniqBlocks.length == 2 &&
      Math.abs(uniqBlocks[0]! - uniqBlocks[1]!) <= 1
    ) {
      return null;
    } */

    return new BlockConflictError(
      `Quotes returned from different blocks. ${uniqBlocks}. ${totalCalls} calls were made with gas limit ${gasLimitOverride}`
    );
  }

  protected validateSuccessRate(
    allResults: Result<[BigNumber, BigNumber[], number[], BigNumber]>[],
    haveRetriedForSuccessRate: boolean,
    useMixedRouteQuoter: boolean,
    optimisticCachedRoutes: boolean
  ): void | SuccessRateError {
    const numResults = allResults.length;
    const numSuccessResults = allResults.filter((result) => result.success).length;

    const successRate = (1.0 * numSuccessResults) / numResults;

    const { quoteMinSuccessRate } = this.batchParams(optimisticCachedRoutes, useMixedRouteQuoter);
    if (successRate < quoteMinSuccessRate) {
      if (haveRetriedForSuccessRate) {
        log.info(
          `Quote success rate still below threshold despite retry. Continuing. ${quoteMinSuccessRate}: ${successRate}`
        );
        metric.putMetric(
          `${this.metricsPrefix(
            this.chainId,
            useMixedRouteQuoter,
            optimisticCachedRoutes
          )}QuoteRetriedSuccessRateLow`,
          successRate,
          MetricLoggerUnit.Percent
        );

        return;
      }

      metric.putMetric(
        `${this.metricsPrefix(
          this.chainId,
          useMixedRouteQuoter,
          optimisticCachedRoutes
        )}QuoteSuccessRateLow`,
        successRate,
        MetricLoggerUnit.Percent
      );
      return new SuccessRateError(
        `Quote success rate below threshold of ${quoteMinSuccessRate}: ${successRate}`
      );
    }
  }

  /**
   * Throw an error for incorrect routes / function combinations
   * @param routes Any combination of V3, V2, and Mixed routes.
   * @param functionName
   * @param useMixedRouteQuoter true if there are ANY V2Routes or MixedRoutes in the routes parameter
   */
  protected validateRoutes(
    routes: SupportedRoutes[],
    functionName: string,
    useMixedRouteQuoter: boolean
  ) {
    /// We do not send any V3Routes to new qutoer becuase it is not deployed on chains besides mainnet
    if (routes.some((route) => route.protocol === Protocol.V3) && useMixedRouteQuoter) {
      throw new Error(`Cannot use mixed route quoter with V3 routes`);
    }

    /// We cannot call quoteExactOutput with V2 or Mixed routes
    if (functionName === 'quoteExactOutput' && useMixedRouteQuoter) {
      throw new Error('Cannot call quoteExactOutput with V2 or Mixed routes');
    }
  }
}