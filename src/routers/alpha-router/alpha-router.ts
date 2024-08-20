import { ChainId, Currency, TradeType } from '@baseswapfi/sdk-core';
import { ZERO } from '@baseswapfi/router-sdk';
import { Position } from '@baseswapfi/v3-sdk2';

import { BigNumber } from '@ethersproject/bignumber';
import { BaseProvider, JsonRpcProvider } from '@ethersproject/providers';

import retry from 'async-retry';
import NodeCache from 'node-cache';
import _ from 'lodash';

import { IV3SubgraphProvider } from '../../providers/v3/subgraph-provider';
import {
  IV3PoolProvider,
  // CachedRoutes,
  // CacheMode,
  // CachingGasStationProvider,
  // CachingTokenProviderWithFallback,
  // CachingV2PoolProvider,
  // CachingV2SubgraphProvider,
  // CachingV3PoolProvider,
  // CachingV3SubgraphProvider,
  // EIP1559GasPriceProvider,
  // ETHGasStationInfoProvider,
  // IOnChainQuoteProvider,
  // IRouteCachingProvider,
  // ISwapRouterProvider,
  ITokenPropertiesProvider,
  // IV2QuoteProvider,
  // IV2SubgraphProvider,
  // LegacyGasPriceProvider,
  // NodeJSCache,
  // OnChainGasPriceProvider,
  // OnChainQuoteProvider,
  // Simulator,
  // StaticV2SubgraphProvider,
  // StaticV3SubgraphProvider,
  // SwapRouterProvider,
  TokenPropertiesProvider,
  UniswapMulticallProvider,
  NodeJSCache,
  EIP1559GasPriceProvider,
  LegacyGasPriceProvider,
  OnChainGasPriceProvider,
  CachingGasStationProvider,
  ETHGasStationInfoProvider,
  ITokenProvider,
  TokenProvider,
  CachingTokenProviderWithFallback,
  // URISubgraphProvider,
  // V2QuoteProvider,
  // V2SubgraphProviderWithFallBacks,
  // V3SubgraphProviderWithFallBacks,
} from '../../providers';

import { GasPrice, IGasPriceProvider } from '../../providers/gas-price-provider';
import {
  GasModelProviderConfig,
  GasModelType,
  IGasModel,
  IOnChainGasModelFactory,
  IV2GasModelFactory,
  LiquidityCalculationPools,
} from './gas-models/gas-model';
import { IPortionProvider, PortionProvider } from '../../providers/portion-provider';

import { CurrencyAmount } from '../../util/amounts';
import {
  IRouter,
  ISwapToRatio,
  SwapAndAddConfig,
  SwapAndAddOptions,
  SwapOptions,
  SwapRoute,
  SwapToRatioResponse,
  SwapType,
} from '../router';
import { DEFAULT_ROUTING_CONFIG_BY_CHAIN, ETH_GAS_STATION_API_URL } from './config';
import { OnChainTokenFeeFetcher } from '../../providers/token-fee-fetcher';
import { log, metric, MetricLoggerUnit } from '../../util';
import { NATIVE_OVERHEAD } from './gas-models/v3/gas-costs';

export type AlphaRouterParams = {
  /**
   * The chain id for this instance of the Alpha Router.
   */

  chainId: ChainId;

  /**
   * The Web3 provider for getting on-chain data.
   */
  provider: BaseProvider;

  /**
   * The provider to use for making multicalls. Used for getting on-chain data
   * like pools, tokens, quotes in batch.
   */
  multicall2Provider?: UniswapMulticallProvider;
  /**
   * The provider for getting all pools that exist on V3 from the Subgraph. The pools
   * from this provider are filtered during the algorithm to a set of candidate pools.
   */
  v3SubgraphProvider?: IV3SubgraphProvider;
  /**
   * The provider for getting data about V3 pools.
   */
  v3PoolProvider?: IV3PoolProvider;
  // /**
  //  * The provider for getting V3 quotes.
  //  */
  // onChainQuoteProvider?: IOnChainQuoteProvider;
  // /**
  //  * The provider for getting all pools that exist on V2 from the Subgraph. The pools
  //  * from this provider are filtered during the algorithm to a set of candidate pools.
  //  */
  // v2SubgraphProvider?: IV2SubgraphProvider;
  // /**
  //  * The provider for getting data about V2 pools.
  //  */
  // v2PoolProvider?: IV2PoolProvider;
  // /**
  //  * The provider for getting V3 quotes.
  //  */
  // v2QuoteProvider?: IV2QuoteProvider;
  /**
   * The provider for getting data about Tokens.
   */
  tokenProvider?: ITokenProvider;
  /**
   * The provider for getting the current gas price to use when account for gas in the
   * algorithm.
   */
  gasPriceProvider?: IGasPriceProvider;
  // /**
  //  * A factory for generating a gas model that is used when estimating the gas used by
  //  * V3 routes.
  //  */
  // v3GasModelFactory?: IOnChainGasModelFactory;
  // /**
  //  * A factory for generating a gas model that is used when estimating the gas used by
  //  * V2 routes.
  //  */
  // v2GasModelFactory?: IV2GasModelFactory;
  // /**
  //  * A factory for generating a gas model that is used when estimating the gas used by
  //  * V3 routes.
  //  */
  // mixedRouteGasModelFactory?: IOnChainGasModelFactory;
  // /**
  //  * A token list that specifies Token that should be blocked from routing through.
  //  * Defaults to Uniswap's unsupported token list.
  //  */
  // blockedTokenListProvider?: ITokenListProvider;

  // /**
  //  * Calls lens function on SwapRouter02 to determine ERC20 approval types for
  //  * LP position tokens.
  //  */
  // swapRouterProvider?: ISwapRouterProvider;

  // /**
  //  * A token validator for detecting fee-on-transfer tokens or tokens that can't be transferred.
  //  */
  // tokenValidatorProvider?: ITokenValidatorProvider;

  // /**
  //  * Calls the arbitrum gas data contract to fetch constants for calculating the l1 fee.
  //  */
  // arbitrumGasDataProvider?: IL2GasDataProvider<ArbitrumGasData>;

  // /**
  //  * Simulates swaps and returns new SwapRoute with updated gas estimates.
  //  */
  // simulator?: Simulator;

  // /**
  //  * A provider for caching the best route given an amount, quoteToken, tradeType
  //  */
  // routeCachingProvider?: IRouteCachingProvider;

  /**
   * A provider for getting token properties for special tokens like fee-on-transfer tokens.
   */
  tokenPropertiesProvider?: ITokenPropertiesProvider;

  /**
   * A provider for computing the portion-related data for routes and quotes.
   */
  portionProvider?: IPortionProvider;

  // /**
  //  * All the supported v2 chains configuration
  //  */
  // v2Supported?: ChainId[];
};

export type AlphaRouterConfig = {
  /**
   * The block number to use for all on-chain data. If not provided, the router will
   * use the latest block returned by the provider.
   */
  blockNumber?: number | Promise<number>;
  //  /**
  //   * The protocols to consider when finding the optimal swap. If not provided all protocols
  //   * will be used.
  //   */
  //  protocols?: Protocol[];
  /**
   * Config for selecting which pools to consider routing via on V2.
   */
  v2PoolSelection: ProtocolPoolSelection;
  /**
   * Config for selecting which pools to consider routing via on V3.
   */
  v3PoolSelection: ProtocolPoolSelection;
  /**
   * For each route, the maximum number of hops to consider. More hops will increase latency of the algorithm.
   */
  maxSwapsPerPath: number;
  /**
   * The maximum number of splits in the returned route. A higher maximum will increase latency of the algorithm.
   */
  maxSplits: number;
  /**
   * The minimum number of splits in the returned route.
   * This parameters should always be set to 1. It is only included for testing purposes.
   */
  minSplits: number;
  /**
   * Forces the returned swap to route across all protocols.
   * This parameter should always be false. It is only included for testing purposes.
   */
  forceCrossProtocol: boolean;
  //  /**
  //   * Force the alpha router to choose a mixed route swap.
  //   * Default will be falsy. It is only included for testing purposes.
  //   */
  //  forceMixedRoutes?: boolean;
  /**
   * The minimum percentage of the input token to use for each route in a split route.
   * All routes will have a multiple of this value. For example is distribution percentage is 5,
   * a potential return swap would be:
   *
   * 5% of input => Route 1
   * 55% of input => Route 2
   * 40% of input => Route 3
   */
  distributionPercent: number;
  //  /**
  //   * Flag to indicate whether to use the cached routes or not.
  //   * By default, the cached routes will be used.
  //   */
  //  useCachedRoutes?: boolean;
  //  /**
  //   * Flag to indicate whether to write to the cached routes or not.
  //   * By default, the cached routes will be written to.
  //   */
  //  writeToCachedRoutes?: boolean;
  //  /**
  //   * Flag to indicate whether to use the CachedRoutes in optimistic mode.
  //   * Optimistic mode means that we will allow blocksToLive greater than 1.
  //   */
  //  optimisticCachedRoutes?: boolean;
  /**
   * Debug param that helps to see the short-term latencies improvements without impacting the main path.
   */
  debugRouting?: boolean;
  //  /**
  //   * Flag that allow us to override the cache mode.
  //   */
  //  overwriteCacheMode?: CacheMode;
  //  /**
  //   * Flag for token properties provider to enable fetching fee-on-transfer tokens.
  //   */
  //  enableFeeOnTransferFeeFetching?: boolean;
  //  /**
  //   * Tenderly natively support save simulation failures if failed,
  //   * we need this as a pass-through flag to enable/disable this feature.
  //   */
  //  saveTenderlySimulationIfFailed?: boolean;
  /**
   * Include an additional response field specifying the swap gas estimation in terms of a specific gas token.
   * This requires a suitable Native/GasToken pool to exist on V3. If one does not exist this field will return null.
   */
  gasToken?: string;
};

export class MapWithLowerCaseKey<V> extends Map<string, V> {
  override set(key: string, value: V): this {
    return super.set(key.toLowerCase(), value);
  }
}

export class LowerCaseStringArray extends Array<string> {
  constructor(...items: string[]) {
    // Convert all items to lowercase before calling the parent constructor
    super(...items.map((item) => item.toLowerCase()));
  }
}

/**
 * Determines the pools that the algorithm will consider when finding the optimal swap.
 *
 * All pools on each protocol are filtered based on the heuristics specified here to generate
 * the set of candidate pools. The Top N pools are taken by Total Value Locked (TVL).
 *
 * Higher values here result in more pools to explore which results in higher latency.
 */
export type ProtocolPoolSelection = {
  /**
   * The top N pools by TVL out of all pools on the protocol.
   */
  topN: number;
  /**
   * The top N pools by TVL of pools that consist of tokenIn and tokenOut.
   */
  topNDirectSwaps: number;
  /**
   * The top N pools by TVL of pools where one token is tokenIn and the
   * top N pools by TVL of pools where one token is tokenOut tokenOut.
   */
  topNTokenInOut: number;
  /**
   * Given the topNTokenInOut pools, gets the top N pools that involve the other token.
   * E.g. for a WETH -> USDC swap, if topNTokenInOut found WETH -> DAI and WETH -> USDT,
   * a value of 2 would find the top 2 pools that involve DAI and top 2 pools that involve USDT.
   */
  topNSecondHop: number;
  /**
   * Given the topNTokenInOut pools and a token address,
   * gets the top N pools that involve the other token.
   * If token address is not on the list, we default to topNSecondHop.
   * E.g. for a WETH -> USDC swap, if topNTokenInOut found WETH -> DAI and WETH -> USDT,
   * and there's a mapping USDT => 4, but no mapping for DAI
   * it would find the top 4 pools that involve USDT, and find the topNSecondHop pools that involve DAI
   */
  topNSecondHopForTokenAddress?: MapWithLowerCaseKey<number>;
  /**
   * List of token addresses to avoid using as a second hop.
   * There might be multiple reasons why we would like to avoid a specific token,
   *   but the specific reason that we are trying to solve is when the pool is not synced properly
   *   e.g. when the pool has a rebasing token that isn't syncing the pool on every rebase.
   */
  tokensToAvoidOnSecondHops?: LowerCaseStringArray;
  /**
   * The top N pools for token in and token out that involve a token from a list of
   * hardcoded 'base tokens'. These are standard tokens such as WETH, USDC, DAI, etc.
   * This is similar to how the legacy routing algorithm used by Uniswap would select
   * pools and is intended to make the new pool selection algorithm close to a superset
   * of the old algorithm.
   */
  topNWithEachBaseToken: number;
  /**
   * Given the topNWithEachBaseToken pools, takes the top N pools from the full list.
   * E.g. for a WETH -> USDC swap, if topNWithEachBaseToken found WETH -0.05-> DAI,
   * WETH -0.01-> DAI, WETH -0.05-> USDC, WETH -0.3-> USDC, a value of 2 would reduce
   * this set to the top 2 pools from that full list.
   */
  topNWithBaseToken: number;
};

export class AlphaRouter
  implements IRouter<AlphaRouterConfig>, ISwapToRatio<AlphaRouterConfig, SwapAndAddConfig>
{
  protected chainId: ChainId;
  protected provider: BaseProvider;
  protected multicall2Provider: UniswapMulticallProvider;
  protected tokenPropertiesProvider: ITokenPropertiesProvider;

  // protected tokenProvider: ITokenProvider;
  protected gasPriceProvider: IGasPriceProvider;

  protected portionProvider: IPortionProvider;

  constructor({
    chainId,
    provider,
    multicall2Provider,
    // tokenProvider,
    gasPriceProvider,
    tokenPropertiesProvider,
    portionProvider,
  }: AlphaRouterParams) {
    this.chainId = chainId;
    this.provider = provider;
    this.multicall2Provider =
      multicall2Provider ?? new UniswapMulticallProvider(chainId, provider, 375_000);

    if (tokenPropertiesProvider) {
      this.tokenPropertiesProvider = tokenPropertiesProvider;
    } else {
      this.tokenPropertiesProvider = new TokenPropertiesProvider(
        this.chainId,
        new NodeJSCache(new NodeCache({ stdTTL: 86400, useClones: false })),
        new OnChainTokenFeeFetcher(this.chainId, provider)
      );
    }

    // this.tokenProvider =
    //   tokenProvider ??
    //   new CachingTokenProviderWithFallback(
    //     chainId,
    //     new NodeJSCache(new NodeCache({ stdTTL: 3600, useClones: false })),
    //     new CachingTokenListProvider(
    //       chainId,
    //       DEFAULT_TOKEN_LIST,
    //       new NodeJSCache(new NodeCache({ stdTTL: 3600, useClones: false }))
    //     ),
    //     new TokenProvider(chainId, this.multicall2Provider)
    //   );

    this.portionProvider = portionProvider ?? new PortionProvider();

    let gasPriceProviderInstance: IGasPriceProvider;
    if (JsonRpcProvider.isProvider(this.provider)) {
      gasPriceProviderInstance = new OnChainGasPriceProvider(
        chainId,
        new EIP1559GasPriceProvider(this.provider as JsonRpcProvider),
        new LegacyGasPriceProvider(this.provider as JsonRpcProvider)
      );
    } else {
      gasPriceProviderInstance = new ETHGasStationInfoProvider(ETH_GAS_STATION_API_URL);
    }

    this.gasPriceProvider =
      gasPriceProvider ??
      new CachingGasStationProvider(
        chainId,
        gasPriceProviderInstance,
        new NodeJSCache<GasPrice>(new NodeCache({ stdTTL: 7, useClones: false }))
      );
  }

  /**
   * @inheritdoc IRouter
   */
  public async route(
    amount: CurrencyAmount,
    quoteCurrency: Currency,
    tradeType: TradeType,
    swapConfig?: SwapOptions,
    partialRoutingConfig: Partial<AlphaRouterConfig> = {}
  ): Promise<SwapRoute | null> {
    // const originalAmount = amount;

    const { currencyIn, currencyOut } = this.determineCurrencyInOutFromTradeType(
      tradeType,
      amount,
      quoteCurrency
    );

    const tokenIn = currencyIn.wrapped;
    const tokenOut = currencyOut.wrapped;

    console.log('tokenIn', tokenIn);
    console.log('tokenOut', tokenOut);

    const tokenOutProperties = await this.tokenPropertiesProvider.getTokensProperties(
      [tokenOut],
      partialRoutingConfig
    );

    const feeTakenOnTransfer =
      tokenOutProperties[tokenOut.address.toLowerCase()]?.tokenFeeResult?.feeTakenOnTransfer;
    const externalTransferFailed =
      tokenOutProperties[tokenOut.address.toLowerCase()]?.tokenFeeResult?.externalTransferFailed;

    // We want to log the fee on transfer output tokens that we are taking fee or not
    // Ideally the trade size (normalized in USD) would be ideal to log here, but we don't have spot price of output tokens here.
    // We have to make sure token out is FOT with either buy/sell fee bps > 0
    if (
      tokenOutProperties[tokenOut.address.toLowerCase()]?.tokenFeeResult?.buyFeeBps?.gt(0) ||
      tokenOutProperties[tokenOut.address.toLowerCase()]?.tokenFeeResult?.sellFeeBps?.gt(0)
    ) {
      if (feeTakenOnTransfer || externalTransferFailed) {
        // also to be extra safe, in case of FOT with feeTakenOnTransfer or externalTransferFailed,
        // we nullify the fee and flat fee to avoid any potential issues.
        // although neither web nor wallet should use the calldata returned from routing/SOR
        if (swapConfig?.type === SwapType.UNIVERSAL_ROUTER) {
          swapConfig.fee = undefined;
          swapConfig.flatFee = undefined;
        }

        metric.putMetric('TokenOutFeeOnTransferNotTakingFee', 1, MetricLoggerUnit.Count);
      } else {
        metric.putMetric('TokenOutFeeOnTransferTakingFee', 1, MetricLoggerUnit.Count);
      }
    }

    if (tradeType === TradeType.EXACT_OUTPUT) {
      const portionAmount = this.portionProvider.getPortionAmount(
        amount,
        tradeType,
        feeTakenOnTransfer,
        externalTransferFailed,
        swapConfig
      );
      if (portionAmount && portionAmount.greaterThan(ZERO)) {
        // In case of exact out swap, before we route, we need to make sure that the
        // token out amount accounts for flat portion, and token in amount after the best swap route contains the token in equivalent of portion.
        // In other words, in case a pool's LP fee bps is lower than the portion bps (0.01%/0.05% for v3), a pool can go insolvency.
        // This is because instead of the swapper being responsible for the portion,
        // the pool instead gets responsible for the portion.
        // The addition below avoids that situation.
        amount = amount.add(portionAmount);
      }
    }

    metric.setProperty('chainId', this.chainId);
    metric.setProperty('pair', `${tokenIn.symbol}/${tokenOut.symbol}`);
    metric.setProperty('tokenIn', tokenIn.address);
    metric.setProperty('tokenOut', tokenOut.address);
    metric.setProperty('tradeType', tradeType === TradeType.EXACT_INPUT ? 'ExactIn' : 'ExactOut');
    metric.putMetric(`QuoteRequestedForChain${this.chainId}`, 1, MetricLoggerUnit.Count);

    // Get a block number to specify in all our calls. Ensures data we fetch from chain is
    // from the same block.
    const blockNumber = partialRoutingConfig.blockNumber ?? this.getBlockNumberPromise();

    const routingConfig: AlphaRouterConfig = _.merge(
      {
        // These settings could be changed by the partialRoutingConfig
        useCachedRoutes: true,
        writeToCachedRoutes: true,
        optimisticCachedRoutes: false,
      },
      DEFAULT_ROUTING_CONFIG_BY_CHAIN(this.chainId),
      partialRoutingConfig,
      { blockNumber }
    );

    if (routingConfig.debugRouting) {
      log.warn(`Finalized routing config is ${JSON.stringify(routingConfig)}`);
    }

    const gasPriceWei = await this.getGasPriceWei(
      await blockNumber,
      await partialRoutingConfig.blockNumber
    );

    const quoteToken = quoteCurrency.wrapped;
    // const gasTokenAccessor = await this.tokenProvider.getTokens([routingConfig.gasToken!]);
    // const gasToken = routingConfig.gasToken
    //   ? (await this.tokenProvider.getTokens([routingConfig.gasToken])).getTokenByAddress(
    //       routingConfig.gasToken
    //     )
    //   : undefined;

    // const providerConfig: GasModelProviderConfig = {
    //   ...routingConfig,
    //   blockNumber,
    //   additionalGasOverhead: NATIVE_OVERHEAD(this.chainId, amount.currency, quoteCurrency),
    //   gasToken,
    //   externalTransferFailed,
    //   feeTakenOnTransfer,
    // };

    return null;
  }

  public async routeToRatio(
    token0Balance: CurrencyAmount,
    token1Balance: CurrencyAmount,
    position: Position,
    swapAndAddConfig: SwapAndAddConfig,
    swapAndAddOptions?: SwapAndAddOptions,
    routingConfig: Partial<AlphaRouterConfig> = DEFAULT_ROUTING_CONFIG_BY_CHAIN(this.chainId)
  ): Promise<SwapToRatioResponse> {
    console.log(token0Balance);
    console.log(token1Balance);
    console.log(position);
    console.log(swapAndAddConfig);
    console.log(swapAndAddOptions);
    console.log(routingConfig);

    throw new Error('Method not implemented.');
  }

  private determineCurrencyInOutFromTradeType(
    tradeType: TradeType,
    amount: CurrencyAmount,
    quoteCurrency: Currency
  ) {
    if (tradeType === TradeType.EXACT_INPUT) {
      return {
        currencyIn: amount.currency,
        currencyOut: quoteCurrency,
      };
    } else {
      return {
        currencyIn: quoteCurrency,
        currencyOut: amount.currency,
      };
    }
  }

  private async getGasPriceWei(
    latestBlockNumber: number,
    requestBlockNumber?: number
  ): Promise<BigNumber> {
    // Track how long it takes to resolve this async call.
    const beforeGasTimestamp = Date.now();

    // Get an estimate of the gas price to use when estimating gas cost of different routes.
    const { gasPriceWei } = await this.gasPriceProvider.getGasPrice(
      latestBlockNumber,
      requestBlockNumber
    );

    metric.putMetric(
      'GasPriceLoad',
      Date.now() - beforeGasTimestamp,
      MetricLoggerUnit.Milliseconds
    );

    return gasPriceWei;
  }

  private getBlockNumberPromise(): number | Promise<number> {
    return retry(
      async (_b, attempt) => {
        if (attempt > 1) {
          log.info(`Get block number attempt ${attempt}`);
        }
        return this.provider.getBlockNumber();
      },
      {
        retries: 2,
        minTimeout: 100,
        maxTimeout: 1000,
      }
    );
  }
}
