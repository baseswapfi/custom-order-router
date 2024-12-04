import { ChainId, Currency, Fraction, Token, TradeType } from '@baseswapfi/sdk-core';
import { Protocol, ZERO } from '@baseswapfi/router-sdk';
import { Position } from '@baseswapfi/v3-sdk2';

import { BigNumber } from '@ethersproject/bignumber';
import { BaseProvider, JsonRpcProvider } from '@ethersproject/providers';
import DEFAULT_TOKEN_LIST from '@baseswapfi/default-token-list';
import retry from 'async-retry';
import NodeCache from 'node-cache';
import _ from 'lodash';

import { BestSwapRoute, getBestSwapRoute } from './functions/best-swap-route';
import { ProviderConfig } from '../../providers/provider';
import { log } from '../../util/log';
import { IV3SubgraphProvider } from '../../providers/v3/subgraph-provider';
import {
  IV3PoolProvider,
  IRouteCachingProvider,
  ITokenPropertiesProvider,
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
  CachingV3PoolProvider,
  V3PoolProvider,
  IOnChainQuoteProvider,
  OnChainQuoteProvider,
  CachingTokenListProvider,
  IV2PoolProvider,
  V2PoolProvider,
  V2SubgraphProvider,
  CachingV2PoolProvider,
  CacheMode,
  CachedRoutes,
  IV2SubgraphProvider,
  IV2QuoteProvider,
  V2QuoteProvider,
  ITokenListProvider,
  ITokenValidatorProvider,
  TokenList,
  CachingV2SubgraphProvider,
  CachingV3SubgraphProvider,
  V3SubgraphProvider,
  TokenValidatorProvider,
  ISwapRouterProvider,
  SwapRouterProvider,
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
import { MixedRouteHeuristicGasModelFactory } from './gas-models/mixedRoute/mixed-route-heuristic-gas-model';
import { V2HeuristicGasModelFactory } from './gas-models/v2/v2-heuristic-gas-model';
import { V3HeuristicGasModelFactory } from './gas-models/v3/v3-heuristic-gas-model';
import { IPortionProvider, PortionProvider } from '../../providers/portion-provider';

import { CurrencyAmount, getAmountDistribution } from '../../util/amounts';
import {
  // IRouter,
  // ISwapToRatio,
  MethodParameters,
  MixedRoute,
  // SwapAndAddConfig,
  // SwapAndAddOptions,
  SwapOptions,
  SwapRoute,
  SwapToRatioResponse,
  SwapType,
  V2Route,
  V3Route,
} from '../router';
import { DEFAULT_ROUTING_CONFIG_BY_CHAIN, ETH_GAS_STATION_API_URL } from './config';
import { OnChainTokenFeeFetcher } from '../../providers/token-fee-fetcher';
import {
  getAddress,
  getAddressLowerCase,
  ID_TO_CHAIN_ID,
  INTENT,
  metric,
  MetricLoggerUnit,
  MIXED_SUPPORTED,
  shouldWipeoutCachedRoutes,
  V2_SUPPORTED,
  WRAPPED_NATIVE_CURRENCY,
} from '../../util';
import { IL2GasDataProvider, ArbitrumGasData, ArbitrumGasDataProvider } from '../../providers/v3/gas-data-provider';
import {
  MixedRouteWithValidQuote,
  RouteWithValidQuote,
  V2RouteWithValidQuote,
  V3RouteWithValidQuote,
} from './entities/route-with-valid-quote';
import {
  CandidatePoolsBySelectionCriteria,
  getV2CandidatePools,
  getMixedCrossLiquidityCandidatePools,
  getV3CandidatePools,
  SubgraphPool,
  V2CandidatePools,
  V3CandidatePools,
} from './functions/get-candidate-pools';
import { NATIVE_OVERHEAD } from './gas-models/gas-costs';
import { UNSUPPORTED_TOKENS } from '../../util/unsupported-tokens';
import {
  DEFAULT_RETRY_OPTIONS,
  DEFAULT_BATCH_PARAMS,
  DEFAULT_GAS_ERROR_FAILURE_OVERRIDES,
  DEFAULT_SUCCESS_RATE_FAILURE_OVERRIDES,
  DEFAULT_BLOCK_NUMBER_CONFIGS,
} from '../../util/onchainQuoteProviderConfigs';
import { GetQuotesResult, MixedQuoter, V2Quoter, V3Quoter } from './quoters';
import { getBaseswapContractAddress } from '@baseswapfi/contracts/dist/utils/contract.utils';
import {
  getHighestLiquidityV3NativePool,
  getHighestLiquidityV3USDPool,
  // getV2GasModel,
  // getV3GasModel,
} from '../../util/gas-factory-helpers';
import { UniversalRouterVersion } from '@baseswapfi/universal-router-sdk';
import { buildSwapMethodParameters, buildTrade } from '../../util/methodParameters';

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

  /**
   * The provider for getting V3 quotes.
   */
  onChainQuoteProvider?: IOnChainQuoteProvider;

  /**
   * The provider for getting all pools that exist on V2 from the Subgraph. The pools
   * from this provider are filtered during the algorithm to a set of candidate pools.
   */
  v2SubgraphProvider?: IV2SubgraphProvider;

  /**
   * The provider for getting data about V2 pools.
   */
  v2PoolProvider?: IV2PoolProvider;

  /**
   * The provider for getting V3 quotes.
   */
  v2QuoteProvider?: IV2QuoteProvider;

  /**
   * The provider for getting data about Tokens.
   */
  tokenProvider?: ITokenProvider;

  /**
   * The provider for getting the current gas price to use when account for gas in the
   * algorithm.
   */
  gasPriceProvider?: IGasPriceProvider;

  /**
   * A factory for generating a gas model that is used when estimating the gas used by
   * V3 routes.
   */
  v3GasModelFactory?: IOnChainGasModelFactory<V3RouteWithValidQuote>;

  /**
   * A factory for generating a gas model that is used when estimating the gas used by
   * V2 routes.
   */
  v2GasModelFactory?: IV2GasModelFactory;

  /**
   * A factory for generating a gas model that is used when estimating the gas used by
   * V3 routes.
   */
  mixedRouteGasModelFactory?: IOnChainGasModelFactory<MixedRouteWithValidQuote>;

  /**
   * A token list that specifies Token that should be blocked from routing through.
   * Defaults to Uniswap's unsupported token list.
   */
  blockedTokenListProvider?: ITokenListProvider;

  /**
   * Calls lens function on SwapRouter02 to determine ERC20 approval types for
   * LP position tokens.
   */
  swapRouterProvider?: ISwapRouterProvider;

  /**
   * A token validator for detecting fee-on-transfer tokens or tokens that can't be transferred.
   */
  tokenValidatorProvider?: ITokenValidatorProvider;

  /**
   * Calls the arbitrum gas data contract to fetch constants for calculating the l1 fee.
   */
  arbitrumGasDataProvider?: IL2GasDataProvider<ArbitrumGasData>;

  // /**
  //  * Simulates swaps and returns new SwapRoute with updated gas estimates.
  //  */
  // simulator?: Simulator;

  /**
   * A provider for caching the best route given an amount, quoteToken, tradeType
   */
  routeCachingProvider?: IRouteCachingProvider;

  /**
   * A provider for getting token properties for special tokens like fee-on-transfer tokens.
   */
  tokenPropertiesProvider?: ITokenPropertiesProvider;

  /**
   * A provider for computing the portion-related data for routes and quotes.
   */
  portionProvider?: IPortionProvider;

  /**
   * All the supported v2 chains configuration
   */
  v2Supported?: ChainId[];

  /**
   * All the supported mixed chains configuration
   */
  mixedSupported?: ChainId[];

  /**
   * We want to rollout the cached routes cache invalidation carefully.
   * Because a wrong fix might impact prod success rate and/or latency.
   */
  cachedRoutesCacheInvalidationFixRolloutPercentage?: number;
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

export type AlphaRouterConfig = {
  /**
   * The block number to use for all on-chain data. If not provided, the router will
   * use the latest block returned by the provider.
   */
  blockNumber?: number | Promise<number>;
  /**
   * The protocols to consider when finding the optimal swap. If not provided all protocols
   * will be used.
   */
  protocols?: Protocol[];
  /**
   * The protocols-version pools to be excluded from the mixed routes.
   */
  excludedProtocolsFromMixed?: Protocol[];

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

  /**
   * Force the alpha router to choose a mixed route swap.
   * Default will be falsy. It is only included for testing purposes.
   */
  forceMixedRoutes?: boolean;

  /**
   * The minimum percentage of the input token to use for each route in a split route.
   * All routes will have a multiple of this value. For example if distribution percentage is 5,
   * a potential return swap would be:
   *
   * 5% of input => Route 1
   * 55% of input => Route 2
   * 40% of input => Route 3
   */
  distributionPercent: number;

  /**
   * Flag to indicate whether to use the cached routes or not.
   * By default, the cached routes will be used.
   */
  useCachedRoutes?: boolean;

  /**
   * Flag to indicate whether to write to the cached routes or not.
   * By default, the cached routes will be written to.
   */
  writeToCachedRoutes?: boolean;

  /**
   * Flag to indicate whether to use the CachedRoutes in optimistic mode.
   * Optimistic mode means that we will allow blocksToLive greater than 1.
   */
  optimisticCachedRoutes?: boolean;

  /**
   * Debug param that helps to see the short-term latencies improvements without impacting the main path.
   */
  debugRouting?: boolean;

  /**
   * Flag that allow us to override the cache mode.
   */
  overwriteCacheMode?: CacheMode;

  /**
   * Flag for token properties provider to enable fetching fee-on-transfer tokens.
   */
  enableFeeOnTransferFeeFetching?: boolean;

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

  /**
   * The version of the universal router to use.
   */
  universalRouterVersion?: UniversalRouterVersion;
  /**
   * pass in routing-api intent to align the intent between routing-api and SOR
   */
  intent?: INTENT;
};

export class AlphaRouter {
  protected chainId: ChainId;
  protected provider: BaseProvider;
  protected multicall2Provider: UniswapMulticallProvider;
  protected v3SubgraphProvider: IV3SubgraphProvider;
  protected v3PoolProvider: IV3PoolProvider;
  protected v2PoolProvider: IV2PoolProvider;
  protected v2SubgraphProvider: IV2SubgraphProvider;
  protected v2QuoteProvider: IV2QuoteProvider;
  protected onChainQuoteProvider: IOnChainQuoteProvider;
  protected tokenProvider: ITokenProvider;

  protected l2GasDataProvider?: IL2GasDataProvider<ArbitrumGasData>;
  // protected simulator?: Simulator;
  protected mixedRouteGasModelFactory: IOnChainGasModelFactory<MixedRouteWithValidQuote>;
  protected v3GasModelFactory: IOnChainGasModelFactory<V3RouteWithValidQuote>;
  protected v2GasModelFactory: IV2GasModelFactory;
  protected tokenValidatorProvider?: ITokenValidatorProvider;
  protected blockedTokenListProvider?: ITokenListProvider;
  protected v2Quoter: V2Quoter;
  protected v3Quoter: V3Quoter;
  protected mixedQuoter: MixedQuoter;
  protected routeCachingProvider?: IRouteCachingProvider;
  protected tokenPropertiesProvider: ITokenPropertiesProvider;
  protected gasPriceProvider: IGasPriceProvider;
  protected swapRouterProvider: ISwapRouterProvider;
  protected portionProvider: IPortionProvider;
  protected v2Supported?: ChainId[];
  protected mixedSupported?: ChainId[];
  protected cachedRoutesCacheInvalidationFixRolloutPercentage?: number;

  constructor({
    chainId,
    provider,
    multicall2Provider,
    tokenProvider,
    gasPriceProvider,
    v3GasModelFactory,
    v2GasModelFactory,
    mixedRouteGasModelFactory,
    tokenPropertiesProvider,
    v2SubgraphProvider,
    v2PoolProvider,
    v2QuoteProvider,
    v3PoolProvider,
    v3SubgraphProvider,
    routeCachingProvider,
    onChainQuoteProvider,
    v2Supported,
    mixedSupported,
    blockedTokenListProvider,
    tokenValidatorProvider,
    portionProvider,
    arbitrumGasDataProvider,
    swapRouterProvider,
    cachedRoutesCacheInvalidationFixRolloutPercentage,
  }: AlphaRouterParams) {
    this.chainId = chainId;
    this.provider = provider;
    this.multicall2Provider = multicall2Provider ?? new UniswapMulticallProvider(chainId, provider, 375_000);

    this.routeCachingProvider = routeCachingProvider;
    this.cachedRoutesCacheInvalidationFixRolloutPercentage = cachedRoutesCacheInvalidationFixRolloutPercentage;

    this.v2Supported = v2Supported ?? V2_SUPPORTED;
    this.mixedSupported = mixedSupported ?? MIXED_SUPPORTED;

    if (tokenPropertiesProvider) {
      this.tokenPropertiesProvider = tokenPropertiesProvider;
    } else {
      this.tokenPropertiesProvider = new TokenPropertiesProvider(
        this.chainId,
        new NodeJSCache(new NodeCache({ stdTTL: 86400, useClones: false })),
        new OnChainTokenFeeFetcher(this.chainId, provider)
      );
    }

    const valitdatorAddress = getBaseswapContractAddress(this.chainId, 'TokenValidator');
    if (tokenValidatorProvider) {
      this.tokenValidatorProvider = tokenValidatorProvider;
    } else if (valitdatorAddress) {
      this.tokenValidatorProvider = new TokenValidatorProvider(
        this.chainId,
        this.multicall2Provider,
        new NodeJSCache(new NodeCache({ stdTTL: 30000, useClones: false })),
        valitdatorAddress
      );
    }
    this.tokenProvider =
      tokenProvider ??
      new CachingTokenProviderWithFallback(
        chainId,
        new NodeJSCache(new NodeCache({ stdTTL: 3600, useClones: false })),
        new CachingTokenListProvider(
          chainId,
          DEFAULT_TOKEN_LIST,
          new NodeJSCache(new NodeCache({ stdTTL: 3600, useClones: false }))
        ),
        new TokenProvider(chainId, this.multicall2Provider)
      );

    this.portionProvider = portionProvider ?? new PortionProvider();

    this.v2PoolProvider =
      v2PoolProvider ??
      new CachingV2PoolProvider(
        chainId,
        new V2PoolProvider(chainId, this.multicall2Provider, this.tokenPropertiesProvider),
        new NodeJSCache(new NodeCache({ stdTTL: 60, useClones: false }))
      );

    this.v2SubgraphProvider =
      v2SubgraphProvider ??
      new CachingV2SubgraphProvider(
        chainId,
        new V2SubgraphProvider(chainId),
        new NodeJSCache(new NodeCache({ stdTTL: 300, useClones: false }))
      );

    this.v2QuoteProvider = v2QuoteProvider ?? new V2QuoteProvider();

    this.v3PoolProvider =
      v3PoolProvider ??
      new CachingV3PoolProvider(
        this.chainId,
        new V3PoolProvider(ID_TO_CHAIN_ID(chainId), this.multicall2Provider),
        new NodeJSCache(new NodeCache({ stdTTL: 360, useClones: false }))
      );

    this.v3SubgraphProvider =
      v3SubgraphProvider ??
      new CachingV3SubgraphProvider(
        chainId,
        new V3SubgraphProvider(chainId),
        new NodeJSCache(new NodeCache({ stdTTL: 300, useClones: false }))
      );

    this.blockedTokenListProvider =
      blockedTokenListProvider ??
      new CachingTokenListProvider(
        chainId,
        UNSUPPORTED_TOKENS as TokenList,
        new NodeJSCache(new NodeCache({ stdTTL: 3600, useClones: false }))
      );

    if (onChainQuoteProvider) {
      this.onChainQuoteProvider = onChainQuoteProvider;
    } else {
      switch (chainId) {
        case ChainId.OPTIMISM:
          this.onChainQuoteProvider = new OnChainQuoteProvider(
            chainId,
            provider,
            this.multicall2Provider,
            {
              retries: 2,
              minTimeout: 100,
              maxTimeout: 1000,
            },
            (_) => {
              return {
                multicallChunk: 110,
                gasLimitPerCall: 1_200_000,
                quoteMinSuccessRate: 0.1,
              };
            },
            {
              gasLimitOverride: 3_000_000,
              multicallChunk: 45,
            },
            {
              gasLimitOverride: 3_000_000,
              multicallChunk: 45,
            },
            {
              baseBlockOffset: -10,
              rollback: {
                enabled: true,
                attemptsBeforeRollback: 1,
                rollbackBlockOffset: -10,
              },
            }
          );
          break;
        case ChainId.BASE:
        case ChainId.BASE_GOERLI:
        case ChainId.MODE:
        case ChainId.SONEIUM_TESTNET:
          this.onChainQuoteProvider = new OnChainQuoteProvider(
            chainId,
            provider,
            this.multicall2Provider,
            {
              retries: 2,
              minTimeout: 100,
              maxTimeout: 1000,
            },
            (_) => {
              return {
                multicallChunk: 80,
                gasLimitPerCall: 1_200_000,
                quoteMinSuccessRate: 0.1,
              };
            },
            {
              gasLimitOverride: 3_000_000,
              multicallChunk: 45,
            },
            {
              gasLimitOverride: 3_000_000,
              multicallChunk: 45,
            },
            {
              baseBlockOffset: -10,
              rollback: {
                enabled: true,
                attemptsBeforeRollback: 1,
                rollbackBlockOffset: -10,
              },
            }
          );
          break;
        case ChainId.ARBITRUM:
          this.onChainQuoteProvider = new OnChainQuoteProvider(
            chainId,
            provider,
            this.multicall2Provider,
            {
              retries: 2,
              minTimeout: 100,
              maxTimeout: 1000,
            },
            (_) => {
              return {
                multicallChunk: 10,
                gasLimitPerCall: 12_000_000,
                quoteMinSuccessRate: 0.1,
              };
            },
            {
              gasLimitOverride: 30_000_000,
              multicallChunk: 6,
            },
            {
              gasLimitOverride: 30_000_000,
              multicallChunk: 6,
            }
          );
          break;
        default:
          this.onChainQuoteProvider = new OnChainQuoteProvider(
            chainId,
            provider,
            this.multicall2Provider,
            DEFAULT_RETRY_OPTIONS,
            (_) => DEFAULT_BATCH_PARAMS,
            DEFAULT_GAS_ERROR_FAILURE_OVERRIDES,
            DEFAULT_SUCCESS_RATE_FAILURE_OVERRIDES,
            DEFAULT_BLOCK_NUMBER_CONFIGS
          );
          break;
      }
    }

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

    this.v3GasModelFactory = v3GasModelFactory ?? new V3HeuristicGasModelFactory(this.provider);
    this.v2GasModelFactory = v2GasModelFactory ?? new V2HeuristicGasModelFactory(this.provider);
    this.mixedRouteGasModelFactory = mixedRouteGasModelFactory ?? new MixedRouteHeuristicGasModelFactory();

    this.swapRouterProvider = swapRouterProvider ?? new SwapRouterProvider(this.multicall2Provider, this.chainId);

    if (chainId === ChainId.ARBITRUM) {
      this.l2GasDataProvider = arbitrumGasDataProvider ?? new ArbitrumGasDataProvider(chainId, this.provider);
    }

    // Initialize the Quoters.
    // Quoters are an abstraction encapsulating the business logic of fetching routes and quotes.
    this.v2Quoter = new V2Quoter(
      this.v2SubgraphProvider,
      this.v2PoolProvider,
      this.v2QuoteProvider,
      this.v2GasModelFactory,
      this.tokenProvider,
      this.chainId,
      this.blockedTokenListProvider,
      this.tokenValidatorProvider,
      this.l2GasDataProvider
    );

    this.v3Quoter = new V3Quoter(
      this.v3SubgraphProvider,
      this.v3PoolProvider,
      this.onChainQuoteProvider,
      this.tokenProvider,
      this.chainId,
      this.blockedTokenListProvider,
      this.tokenValidatorProvider
    );

    this.mixedQuoter = new MixedQuoter(
      this.v3SubgraphProvider,
      this.v3PoolProvider,
      this.v2SubgraphProvider,
      this.v2PoolProvider,
      this.onChainQuoteProvider,
      this.tokenProvider,
      this.chainId,
      this.blockedTokenListProvider,
      this.tokenValidatorProvider
    );
  }

  /**
   * @inheritdoc IRouter
   */
  public async route(
    amount: CurrencyAmount,
    quoteCurrency: Token,
    tradeType: TradeType,
    swapConfig?: SwapOptions,
    partialRoutingConfig: Partial<AlphaRouterConfig> = {}
  ): Promise<SwapRoute | null> {
    const originalAmount = amount;

    const { currencyIn, currencyOut } = this.determineCurrencyInOutFromTradeType(tradeType, amount, quoteCurrency);

    const tokenOutProperties = await this.tokenPropertiesProvider.getTokensProperties(
      [currencyOut],
      partialRoutingConfig
    );

    const feeTakenOnTransfer = tokenOutProperties[getAddressLowerCase(currencyOut)]?.tokenFeeResult?.feeTakenOnTransfer;
    const externalTransferFailed =
      tokenOutProperties[getAddressLowerCase(currencyOut)]?.tokenFeeResult?.externalTransferFailed;

    // We want to log the fee on transfer output tokens that we are taking fee or not
    // Ideally the trade size (normalized in USD) would be ideal to log here, but we don't have spot price of output tokens here.
    // We have to make sure token out is FOT with either buy/sell fee bps > 0
    if (
      tokenOutProperties[getAddressLowerCase(currencyOut)]?.tokenFeeResult?.buyFeeBps?.gt(0) ||
      tokenOutProperties[getAddressLowerCase(currencyOut)]?.tokenFeeResult?.sellFeeBps?.gt(0)
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
    metric.setProperty('pair', `${currencyIn.symbol}/${currencyOut.symbol}`);
    metric.setProperty('tokenIn', getAddress(currencyIn));
    metric.setProperty('tokenOut', getAddress(currencyOut));
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

    const gasPriceWei = await this.getGasPriceWei(await blockNumber, await partialRoutingConfig.blockNumber);

    // TODO: Will need the gasToken property set for chains like Sonic that do that use ETH
    // Will need to provide the gas token in the config for the router
    // const gasTokenAccessor = await this.tokenProvider.getTokens([routingConfig.gasToken!]);
    const gasToken = routingConfig.gasToken
      ? (await this.tokenProvider.getTokens([routingConfig.gasToken])).getTokenByAddress(routingConfig.gasToken)
      : undefined;

    const providerConfig: GasModelProviderConfig = {
      ...routingConfig,
      blockNumber,
      additionalGasOverhead: NATIVE_OVERHEAD(this.chainId, amount.currency, quoteCurrency),
      gasToken,
      externalTransferFailed,
      feeTakenOnTransfer,
    };

    const {
      v2GasModel: v2GasModel,
      v3GasModel: v3GasModel,
      mixedRouteGasModel: mixedRouteGasModel,
    } = await this.getGasModels(gasPriceWei, amount.currency.wrapped, quoteCurrency.wrapped, providerConfig);

    // Create a Set to sanitize the protocols input, a Set of undefined becomes an empty set,
    // Then create an Array from the values of that Set.
    const protocols: Protocol[] = Array.from(new Set(routingConfig.protocols).values());

    // @note There is no check here that we actually have a routeCachingProvider
    // So it assumed one was passed in even though the field is marked as optional
    // Currently (11/27/2024) made it a required field for now due to this
    // TODO: See how they set configs on frontend and in routing API for this
    const cacheMode =
      routingConfig.overwriteCacheMode ??
      (await this.routeCachingProvider?.getCacheMode(this.chainId, amount, quoteCurrency, tradeType, protocols));

    // Fetch CachedRoutes
    let cachedRoutes: CachedRoutes | undefined;
    if (routingConfig.useCachedRoutes && cacheMode !== CacheMode.Darkmode) {
      cachedRoutes = await this.routeCachingProvider?.getCachedRoute(
        this.chainId,
        amount,
        quoteCurrency,
        tradeType,
        protocols,
        await blockNumber,
        routingConfig.optimisticCachedRoutes
      );
    }

    if (shouldWipeoutCachedRoutes(cachedRoutes, routingConfig)) {
      cachedRoutes = undefined;
    }

    metric.putMetric(
      routingConfig.useCachedRoutes ? 'GetQuoteUsingCachedRoutes' : 'GetQuoteNotUsingCachedRoutes',
      1,
      MetricLoggerUnit.Count
    );

    if (cacheMode && routingConfig.useCachedRoutes && cacheMode !== CacheMode.Darkmode && !cachedRoutes) {
      metric.putMetric(`GetCachedRoute_miss_${cacheMode}`, 1, MetricLoggerUnit.Count);
      log.info(
        {
          currencyIn: currencyIn.symbol,
          currencyInAddress: getAddress(currencyIn),
          currencyOut: currencyOut.symbol,
          currencyOutAddress: getAddress(currencyOut),
          cacheMode,
          amount: amount.toExact(),
          chainId: this.chainId,
          tradeType: this.tradeTypeStr(tradeType),
        },
        `GetCachedRoute miss ${cacheMode} for ${this.tokenPairSymbolTradeTypeChainId(
          currencyIn,
          currencyOut,
          tradeType
        )}`
      );
    } else if (cachedRoutes && routingConfig.useCachedRoutes) {
      metric.putMetric(`GetCachedRoute_hit_${cacheMode}`, 1, MetricLoggerUnit.Count);
      log.info(
        {
          currencyIn: currencyIn.symbol,
          currencyInAddress: getAddress(currencyIn),
          currencyOut: currencyOut.symbol,
          currencyOutAddress: getAddress(currencyOut),
          cacheMode,
          amount: amount.toExact(),
          chainId: this.chainId,
          tradeType: this.tradeTypeStr(tradeType),
        },
        `GetCachedRoute hit ${cacheMode} for ${this.tokenPairSymbolTradeTypeChainId(
          currencyIn,
          currencyOut,
          tradeType
        )}`
      );
    }

    let swapRouteFromCachePromise: Promise<BestSwapRoute | null> = Promise.resolve(null);
    if (cachedRoutes) {
      swapRouteFromCachePromise = this.getSwapRouteFromCache(
        currencyIn,
        currencyOut,
        cachedRoutes,
        await blockNumber,
        amount,
        quoteCurrency,
        tradeType,
        routingConfig,
        v3GasModel,
        mixedRouteGasModel,
        gasPriceWei,
        v2GasModel,
        swapConfig,
        providerConfig
      );
    }

    let swapRouteFromChainPromise: Promise<BestSwapRoute | null> = Promise.resolve(null);
    if (!cachedRoutes || cacheMode !== CacheMode.Livemode) {
      swapRouteFromChainPromise = this.getSwapRouteFromChain(
        amount,
        currencyIn,
        currencyOut,
        protocols,
        quoteCurrency,
        tradeType,
        routingConfig,
        v3GasModel,
        mixedRouteGasModel,
        gasPriceWei,
        v2GasModel,
        swapConfig,
        providerConfig
      );
    }

    const [swapRouteFromCache, swapRouteFromChain] = await Promise.all([
      swapRouteFromCachePromise,
      swapRouteFromChainPromise,
    ]);

    let swapRouteRaw: BestSwapRoute | null;
    let hitsCachedRoute = false;
    if (cacheMode === CacheMode.Livemode && swapRouteFromCache) {
      log.info(`CacheMode is ${cacheMode}, and we are using swapRoute from cache`);
      hitsCachedRoute = true;
      swapRouteRaw = swapRouteFromCache;
    } else {
      log.info(`CacheMode is ${cacheMode}, and we are using materialized swapRoute`);
      swapRouteRaw = swapRouteFromChain;
    }

    if (cacheMode === CacheMode.Tapcompare && swapRouteFromCache && swapRouteFromChain) {
      const quoteDiff = swapRouteFromChain.quote.subtract(swapRouteFromCache.quote);
      const quoteGasAdjustedDiff = swapRouteFromChain.quoteGasAdjusted.subtract(swapRouteFromCache.quoteGasAdjusted);
      const gasUsedDiff = swapRouteFromChain.estimatedGasUsed.sub(swapRouteFromCache.estimatedGasUsed);

      // Only log if quoteDiff is different from 0, or if quoteGasAdjustedDiff and gasUsedDiff are both different from 0
      if (!quoteDiff.equalTo(0) || !(quoteGasAdjustedDiff.equalTo(0) || gasUsedDiff.eq(0))) {
        try {
          // Calculates the percentage of the difference with respect to the quoteFromChain (not from cache)
          const misquotePercent = quoteGasAdjustedDiff.divide(swapRouteFromChain.quoteGasAdjusted).multiply(100);

          metric.putMetric(
            `TapcompareCachedRoute_quoteGasAdjustedDiffPercent`,
            Number(misquotePercent.toExact()),
            MetricLoggerUnit.Percent
          );

          log.warn(
            {
              quoteFromChain: swapRouteFromChain.quote.toExact(),
              quoteFromCache: swapRouteFromCache.quote.toExact(),
              quoteDiff: quoteDiff.toExact(),
              quoteGasAdjustedFromChain: swapRouteFromChain.quoteGasAdjusted.toExact(),
              quoteGasAdjustedFromCache: swapRouteFromCache.quoteGasAdjusted.toExact(),
              quoteGasAdjustedDiff: quoteGasAdjustedDiff.toExact(),
              gasUsedFromChain: swapRouteFromChain.estimatedGasUsed.toString(),
              gasUsedFromCache: swapRouteFromCache.estimatedGasUsed.toString(),
              gasUsedDiff: gasUsedDiff.toString(),
              routesFromChain: swapRouteFromChain.routes.toString(),
              routesFromCache: swapRouteFromCache.routes.toString(),
              amount: amount.toExact(),
              originalAmount: cachedRoutes?.originalAmount,
              pair: this.tokenPairSymbolTradeTypeChainId(currencyIn, currencyOut, tradeType),
              blockNumber,
            },
            `Comparing quotes between Chain and Cache for ${this.tokenPairSymbolTradeTypeChainId(
              currencyIn,
              currencyOut,
              tradeType
            )}`
          );
        } catch (error) {
          // This is in response to the 'division by zero' error
          // during https://uniswapteam.slack.com/archives/C059TGEC57W/p1723997015399579
          if (error instanceof RangeError && error.message.includes('Division by zero')) {
            log.error(
              {
                quoteGasAdjustedDiff: quoteGasAdjustedDiff.toExact(),
                swapRouteFromChainQuoteGasAdjusted: swapRouteFromChain.quoteGasAdjusted.toExact(),
              },
              'Error calculating misquote percent'
            );

            metric.putMetric(`TapcompareCachedRoute_quoteGasAdjustedDiffPercent_divzero`, 1, MetricLoggerUnit.Count);
          }

          // Log but don't throw here - this is only for logging.
        }
      }
    }

    let newSetCachedRoutesPath = false;
    const shouldEnableCachedRoutesCacheInvalidationFix =
      Math.random() * 100 < (this.cachedRoutesCacheInvalidationFixRolloutPercentage ?? 0);

    // we have to write cached routes right before checking swapRouteRaw is null or not
    // because getCachedRoutes in routing-api do not use the blocks-to-live to filter out the expired routes at all
    // there's a possibility the cachedRoutes is always populated, but swapRouteFromCache is always null, because we don't update cachedRoutes in this case at all,
    // as long as it's within 24 hours sliding window TTL
    if (shouldEnableCachedRoutesCacheInvalidationFix) {
      // theoretically, when routingConfig.intent === INTENT.CACHING, optimisticCachedRoutes should be false
      // so that we can always pass in cachedRoutes?.notExpired(await blockNumber, !routingConfig.optimisticCachedRoutes)
      // but just to be safe, we just hardcode true when checking the cached routes expiry for write update
      // we decide to not check cached routes expiry in the read path anyway
      if (!cachedRoutes?.notExpired(await blockNumber, true)) {
        // optimisticCachedRoutes === false means at routing-api level, we only want to set cached routes during intent=caching, not intent=quote
        // this means during the online quote endpoint path, we should not reset cached routes
        if (routingConfig.intent === INTENT.CACHING) {
          // due to fire and forget nature, we already take note that we should set new cached routes during the new path
          newSetCachedRoutesPath = true;
          metric.putMetric(`SetCachedRoute_NewPath`, 1, MetricLoggerUnit.Count);

          // there's a chance that swapRouteFromChain might be populated already,
          // when there's no cachedroutes in the dynamo DB.
          // in that case, we don't try to swap route from chain again
          const swapRouteFromChainAgain =
            swapRouteFromChain ??
            // we have to intentionally await here, because routing-api lambda has a chance to return the swapRoute/swapRouteWithSimulation
            // before the routing-api quote handler can finish running getSwapRouteFromChain (getSwapRouteFromChain is runtime intensive)
            (await this.getSwapRouteFromChain(
              amount,
              currencyIn,
              currencyOut,
              protocols,
              quoteCurrency,
              tradeType,
              routingConfig,
              v3GasModel,
              mixedRouteGasModel,
              gasPriceWei,
              v2GasModel,
              swapConfig,
              providerConfig
            ));

          if (swapRouteFromChainAgain) {
            const routesToCache = CachedRoutes.fromRoutesWithValidQuotes(
              swapRouteFromChainAgain.routes,
              this.chainId,
              currencyIn,
              currencyOut,
              protocols.sort(),
              await blockNumber,
              tradeType,
              amount.toExact()
            );

            await this.setCachedRoutesAndLog(
              amount,
              currencyIn,
              currencyOut,
              tradeType,
              'SetCachedRoute_NewPath',
              routesToCache
            );
          }
        }
      }
    }

    if (!swapRouteRaw) {
      return null;
    }

    const {
      quote,
      quoteGasAdjusted,
      estimatedGasUsed,
      routes: routeAmounts,
      estimatedGasUsedQuoteToken,
      estimatedGasUsedUSD,
      estimatedGasUsedGasToken,
    } = swapRouteRaw;

    // we intentionally dont add shouldEnableCachedRoutesCacheInvalidationFix in if condition below
    // because we know cached routes in prod dont filter by blocks-to-live
    // so that we know that swapRouteFromChain is always not populated, because
    // if (!cachedRoutes || cacheMode !== CacheMode.Livemode) above always have the cachedRoutes as populated
    if (
      this.routeCachingProvider &&
      routingConfig.writeToCachedRoutes &&
      cacheMode !== CacheMode.Darkmode &&
      swapRouteFromChain
    ) {
      if (newSetCachedRoutesPath) {
        // SetCachedRoute_NewPath and SetCachedRoute_OldPath metrics might have counts during short timeframe.
        // over time, we should expect to see less SetCachedRoute_OldPath metrics count.
        // in AWS metrics, one can investigate, by:
        // 1) seeing the overall metrics count of SetCachedRoute_NewPath and SetCachedRoute_OldPath. SetCachedRoute_NewPath should steadily go up, while SetCachedRoute_OldPath should go down.
        // 2) using the same requestId, one should see eventually when SetCachedRoute_NewPath metric is logged, SetCachedRoute_OldPath metric should not be called.
        metric.putMetric(`SetCachedRoute_OldPath_INTENT_${routingConfig.intent}`, 1, MetricLoggerUnit.Count);
      }

      // Generate the object to be cached
      const routesToCache = CachedRoutes.fromRoutesWithValidQuotes(
        swapRouteFromChain.routes,
        this.chainId,
        currencyIn,
        currencyOut,
        protocols.sort(),
        await blockNumber,
        tradeType,
        amount.toExact()
      );

      await this.setCachedRoutesAndLog(
        amount,
        currencyIn,
        currencyOut,
        tradeType,
        'SetCachedRoute_OldPath',
        routesToCache
      );
    }

    metric.putMetric(`QuoteFoundForChain${this.chainId}`, 1, MetricLoggerUnit.Count);

    // Build Trade object that represents the optimal swap.
    const trade = buildTrade<typeof tradeType>(currencyIn, currencyOut, tradeType, routeAmounts);

    let methodParameters: MethodParameters | undefined;

    // If user provided recipient, deadline etc. we also generate the calldata required to execute
    // the swap and return it too.
    if (swapConfig) {
      methodParameters = buildSwapMethodParameters(trade, swapConfig, this.chainId);
    }

    const tokenOutAmount =
      tradeType === TradeType.EXACT_OUTPUT
        ? originalAmount // we need to pass in originalAmount instead of amount, because amount already added portionAmount in case of exact out swap
        : quote;
    const portionAmount = this.portionProvider.getPortionAmount(
      tokenOutAmount,
      tradeType,
      feeTakenOnTransfer,
      externalTransferFailed,
      swapConfig
    );
    const portionQuoteAmount = this.portionProvider.getPortionQuoteAmount(
      tradeType,
      quote,
      amount, // we need to pass in amount instead of originalAmount here, because amount here needs to add the portion for exact out
      portionAmount
    );

    // we need to correct quote and quote gas adjusted for exact output when portion is part of the exact out swap
    const correctedQuote = this.portionProvider.getQuote(tradeType, quote, portionQuoteAmount);

    const correctedQuoteGasAdjusted = this.portionProvider.getQuoteGasAdjusted(
      tradeType,
      quoteGasAdjusted,
      portionQuoteAmount
    );
    const quoteGasAndPortionAdjusted = this.portionProvider.getQuoteGasAndPortionAdjusted(
      tradeType,
      quoteGasAdjusted,
      portionAmount
    );
    const swapRoute: SwapRoute = {
      quote: correctedQuote,
      quoteGasAdjusted: correctedQuoteGasAdjusted,
      estimatedGasUsed,
      estimatedGasUsedQuoteToken,
      estimatedGasUsedUSD,
      estimatedGasUsedGasToken,
      gasPriceWei,
      route: routeAmounts,
      trade,
      methodParameters,
      blockNumber: BigNumber.from(await blockNumber),
      hitsCachedRoute: hitsCachedRoute,
      portionAmount: portionAmount,
      quoteGasAndPortionAdjusted: quoteGasAndPortionAdjusted,
    };

    // if (
    //   swapConfig &&
    //   swapConfig.simulate &&
    //   methodParameters &&
    //   methodParameters.calldata
    // ) {
    //   if (!this.simulator) {
    //     throw new Error('Simulator not initialized!');
    //   }

    //   log.info(
    //     JSON.stringify(
    //       { swapConfig, methodParameters, providerConfig },
    //       null,
    //       2
    //     ),
    //     `Starting simulation`
    //   );
    //   const fromAddress = swapConfig.simulate.fromAddress;
    //   const beforeSimulate = Date.now();
    //   const swapRouteWithSimulation = await this.simulator.simulate(
    //     fromAddress,
    //     swapConfig,
    //     swapRoute,
    //     amount,
    //     // Quote will be in WETH even if quoteCurrency is ETH
    //     // So we init a new CurrencyAmount object here
    //     CurrencyAmount.fromRawAmount(quoteCurrency, quote.quotient.toString()),
    //     providerConfig
    //   );
    //   metric.putMetric(
    //     'SimulateTransaction',
    //     Date.now() - beforeSimulate,
    //     MetricLoggerUnit.Milliseconds
    //   );
    //   return swapRouteWithSimulation;
    // }

    return swapRoute;
  }

  private async getSwapRouteFromCache(
    currencyIn: Currency,
    currencyOut: Currency,
    cachedRoutes: CachedRoutes,
    blockNumber: number,
    amount: CurrencyAmount,
    quoteCurrency: Currency,
    tradeType: TradeType,
    routingConfig: AlphaRouterConfig,
    v3GasModel: IGasModel<V3RouteWithValidQuote>,
    mixedRouteGasModel: IGasModel<MixedRouteWithValidQuote>,
    gasPriceWei: BigNumber,
    v2GasModel?: IGasModel<V2RouteWithValidQuote>,
    swapConfig?: SwapOptions,
    providerConfig?: ProviderConfig
  ): Promise<BestSwapRoute | null> {
    const tokenPairProperties = await this.tokenPropertiesProvider.getTokensProperties(
      [currencyIn, currencyOut],
      providerConfig
    );

    const sellTokenIsFot = tokenPairProperties[getAddressLowerCase(currencyIn)]?.tokenFeeResult?.sellFeeBps?.gt(0);
    const buyTokenIsFot = tokenPairProperties[getAddressLowerCase(currencyOut)]?.tokenFeeResult?.buyFeeBps?.gt(0);
    const fotInDirectSwap = sellTokenIsFot || buyTokenIsFot;

    log.info(
      {
        protocols: cachedRoutes.protocolsCovered,
        tradeType: cachedRoutes.tradeType,
        cachedBlockNumber: cachedRoutes.blockNumber,
        quoteBlockNumber: blockNumber,
      },
      'Routing across CachedRoute'
    );
    const quotePromises: Promise<GetQuotesResult>[] = [];

    const v3Routes = cachedRoutes.routes.filter((route) => route.protocol === Protocol.V3);
    const v2Routes = cachedRoutes.routes.filter((route) => route.protocol === Protocol.V2);
    const mixedRoutes = cachedRoutes.routes.filter((route) => route.protocol === Protocol.MIXED);

    let percents: number[];
    let amounts: CurrencyAmount[];
    if (cachedRoutes.routes.length > 1) {
      // If we have more than 1 route, we will quote the different percents for it, following the regular process
      [percents, amounts] = getAmountDistribution(amount, routingConfig);
    } else if (cachedRoutes.routes.length == 1) {
      [percents, amounts] = [[100], [amount]];
    } else {
      // In this case this means that there's no route, so we return null
      return Promise.resolve(null);
    }

    if (!fotInDirectSwap) {
      if (v3Routes.length > 0) {
        const v3RoutesFromCache: V3Route[] = v3Routes.map((cachedRoute) => cachedRoute.route as V3Route);
        metric.putMetric('SwapRouteFromCache_V3_GetQuotes_Request', 1, MetricLoggerUnit.Count);

        const beforeGetQuotes = Date.now();

        quotePromises.push(
          this.v3Quoter
            .getQuotes(
              v3RoutesFromCache,
              amounts,
              percents,
              quoteCurrency.wrapped,
              tradeType,
              routingConfig,
              undefined,
              v3GasModel
            )
            .then((result) => {
              metric.putMetric(
                `SwapRouteFromCache_V3_GetQuotes_Load`,
                Date.now() - beforeGetQuotes,
                MetricLoggerUnit.Milliseconds
              );

              return result;
            })
        );
      }
    }

    if (v2Routes.length > 0) {
      const v2RoutesFromCache: V2Route[] = v2Routes.map((cachedRoute) => cachedRoute.route as V2Route);
      metric.putMetric('SwapRouteFromCache_V2_GetQuotes_Request', 1, MetricLoggerUnit.Count);

      const beforeGetQuotes = Date.now();

      quotePromises.push(
        this.v2Quoter
          .refreshRoutesThenGetQuotes(
            cachedRoutes.currencyIn.wrapped,
            cachedRoutes.currencyOut.wrapped,
            v2RoutesFromCache,
            amounts,
            percents,
            quoteCurrency.wrapped,
            tradeType,
            routingConfig,
            gasPriceWei
          )
          .then((result) => {
            metric.putMetric(
              `SwapRouteFromCache_V2_GetQuotes_Load`,
              Date.now() - beforeGetQuotes,
              MetricLoggerUnit.Milliseconds
            );

            return result;
          })
      );
    }

    if (!fotInDirectSwap) {
      if (mixedRoutes.length > 0) {
        const mixedRoutesFromCache: MixedRoute[] = mixedRoutes.map((cachedRoute) => cachedRoute.route as MixedRoute);
        metric.putMetric('SwapRouteFromCache_Mixed_GetQuotes_Request', 1, MetricLoggerUnit.Count);

        const beforeGetQuotes = Date.now();

        quotePromises.push(
          this.mixedQuoter
            .getQuotes(
              mixedRoutesFromCache,
              amounts,
              percents,
              quoteCurrency.wrapped,
              tradeType,
              routingConfig,
              undefined,
              mixedRouteGasModel
            )
            .then((result) => {
              metric.putMetric(
                `SwapRouteFromCache_Mixed_GetQuotes_Load`,
                Date.now() - beforeGetQuotes,
                MetricLoggerUnit.Milliseconds
              );

              return result;
            })
        );
      }
    }

    const getQuotesResults = await Promise.all(quotePromises);
    const allRoutesWithValidQuotes = _.flatMap(getQuotesResults, (quoteResult) => quoteResult.routesWithValidQuotes);

    return getBestSwapRoute(
      amount,
      percents,
      allRoutesWithValidQuotes,
      tradeType,
      this.chainId,
      routingConfig,
      this.portionProvider,
      v2GasModel,
      v3GasModel,
      swapConfig,
      providerConfig
    );
  }

  async getSwapRouteFromChain(
    amount: CurrencyAmount,
    currencyIn: Token,
    currencyOut: Token,
    protocols: Protocol[],
    quoteCurrency: Token,
    tradeType: TradeType,
    routingConfig: AlphaRouterConfig,
    v3GasModel: IGasModel<V3RouteWithValidQuote>,
    mixedRouteGasModel: IGasModel<MixedRouteWithValidQuote>,
    gasPriceWei: BigNumber,
    v2GasModel?: IGasModel<V2RouteWithValidQuote>,
    swapConfig?: SwapOptions,
    providerConfig?: ProviderConfig
  ): Promise<BestSwapRoute | null> {
    const tokenPairProperties = await this.tokenPropertiesProvider.getTokensProperties(
      [currencyIn, currencyOut],
      providerConfig
    );

    const sellTokenIsFot = tokenPairProperties[currencyIn.address.toLowerCase()]?.tokenFeeResult?.sellFeeBps?.gt(0);
    const buyTokenIsFot = tokenPairProperties[currencyOut.address.toLowerCase()]?.tokenFeeResult?.buyFeeBps?.gt(0);
    const fotInDirectSwap = sellTokenIsFot || buyTokenIsFot;

    // Generate our distribution of amounts, i.e. fractions of the input amount.
    // We will get quotes for fractions of the input amount for different routes, then
    // combine to generate split routes.
    const [percents, amounts] = getAmountDistribution(amount, routingConfig);

    const noProtocolsSpecified = protocols.length === 0;
    const v3ProtocolSpecified = protocols.includes(Protocol.V3);
    const v2ProtocolSpecified = protocols.includes(Protocol.V2);
    const v2SupportedInChain = this.v2Supported?.includes(this.chainId);
    // TODO: Need to see if this breaks anything on our end.
    // They only use it on ETH Mainnet. Original V2 has so much liquidity, you could possibly find
    // a better price by comparing outputs from a v2/v3 pair.
    // But they wouldn't really apply for us. By nature you get much more "capital efficiency"
    // from v3 compared to v2. v3 requires multiples less liquidity to get the same output as a v2 pair
    // So... we dont need this "mixed quote" thing at all given our situation. BOOP
    const shouldQueryMixedProtocol = protocols.includes(Protocol.MIXED) || (noProtocolsSpecified && v2SupportedInChain);
    const mixedProtocolAllowed = this.mixedSupported?.includes(this.chainId) && tradeType === TradeType.EXACT_INPUT;

    const beforeGetCandidates = Date.now();

    let v3CandidatePoolsPromise: Promise<V3CandidatePools | undefined> = Promise.resolve(undefined);
    if (!fotInDirectSwap) {
      if (v3ProtocolSpecified || noProtocolsSpecified || (shouldQueryMixedProtocol && mixedProtocolAllowed)) {
        v3CandidatePoolsPromise = getV3CandidatePools({
          tokenIn: currencyIn,
          tokenOut: currencyOut,
          tokenProvider: this.tokenProvider,
          blockedTokenListProvider: this.blockedTokenListProvider,
          poolProvider: this.v3PoolProvider,
          routeType: tradeType,
          subgraphProvider: this.v3SubgraphProvider,
          routingConfig,
          chainId: this.chainId,
        }).then((candidatePools) => {
          metric.putMetric('GetV3CandidatePools', Date.now() - beforeGetCandidates, MetricLoggerUnit.Milliseconds);
          return candidatePools;
        });
      }
    }

    let v2CandidatePoolsPromise: Promise<V2CandidatePools | undefined> = Promise.resolve(undefined);
    if (
      (v2SupportedInChain && (v2ProtocolSpecified || noProtocolsSpecified)) ||
      (shouldQueryMixedProtocol && mixedProtocolAllowed)
    ) {
      const tokenIn = currencyIn.wrapped;
      const tokenOut = currencyOut.wrapped;

      // Fetch all the pools that we will consider routing via. There are thousands
      // of pools, so we filter them to a set of candidate pools that we expect will
      // result in good prices.
      v2CandidatePoolsPromise = getV2CandidatePools({
        tokenIn,
        tokenOut,
        tokenProvider: this.tokenProvider,
        blockedTokenListProvider: this.blockedTokenListProvider,
        poolProvider: this.v2PoolProvider,
        routeType: tradeType,
        subgraphProvider: this.v2SubgraphProvider,
        routingConfig,
        chainId: this.chainId,
      }).then((candidatePools) => {
        metric.putMetric('GetV2CandidatePools', Date.now() - beforeGetCandidates, MetricLoggerUnit.Milliseconds);
        return candidatePools;
      });
    }

    const quotePromises: Promise<GetQuotesResult>[] = [];

    if (!fotInDirectSwap) {
      // Maybe Quote V3 - if V3 is specified, or no protocol is specified
      if (v3ProtocolSpecified || noProtocolsSpecified) {
        log.info({ protocols, tradeType }, 'Routing across V3');

        metric.putMetric('SwapRouteFromChain_V3_GetRoutesThenQuotes_Request', 1, MetricLoggerUnit.Count);
        const beforeGetRoutesThenQuotes = Date.now();
        const tokenIn = currencyIn.wrapped;
        const tokenOut = currencyOut.wrapped;

        quotePromises.push(
          v3CandidatePoolsPromise.then((v3CandidatePools) =>
            this.v3Quoter
              .getRoutesThenQuotes(
                tokenIn,
                tokenOut,
                amount,
                amounts,
                percents,
                quoteCurrency.wrapped,
                v3CandidatePools!,
                tradeType,
                routingConfig,
                v3GasModel
              )
              .then((result) => {
                metric.putMetric(
                  `SwapRouteFromChain_V3_GetRoutesThenQuotes_Load`,
                  Date.now() - beforeGetRoutesThenQuotes,
                  MetricLoggerUnit.Milliseconds
                );

                return result;
              })
          )
        );
      }
    }

    // Maybe Quote V2 - if V2 is specified, or no protocol is specified AND v2 is supported in this chain
    if (v2SupportedInChain && (v2ProtocolSpecified || noProtocolsSpecified)) {
      log.info({ protocols, tradeType }, 'Routing across V2');

      metric.putMetric('SwapRouteFromChain_V2_GetRoutesThenQuotes_Request', 1, MetricLoggerUnit.Count);
      const beforeGetRoutesThenQuotes = Date.now();
      const tokenIn = currencyIn.wrapped;
      const tokenOut = currencyOut.wrapped;

      quotePromises.push(
        v2CandidatePoolsPromise.then((v2CandidatePools) =>
          this.v2Quoter
            .getRoutesThenQuotes(
              tokenIn,
              tokenOut,
              amount,
              amounts,
              percents,
              quoteCurrency.wrapped,
              v2CandidatePools!,
              tradeType,
              routingConfig,
              v2GasModel,
              gasPriceWei
            )
            .then((result) => {
              metric.putMetric(
                `SwapRouteFromChain_V2_GetRoutesThenQuotes_Load`,
                Date.now() - beforeGetRoutesThenQuotes,
                MetricLoggerUnit.Milliseconds
              );

              return result;
            })
        )
      );
    }

    if (!fotInDirectSwap) {
      // Maybe Quote mixed routes
      // if MixedProtocol is specified or no protocol is specified and v2 is supported AND tradeType is ExactIn
      // AND is Mainnet or Gorli
      if (shouldQueryMixedProtocol && mixedProtocolAllowed) {
        log.info({ protocols, tradeType }, 'Routing across MixedRoutes');

        metric.putMetric('SwapRouteFromChain_Mixed_GetRoutesThenQuotes_Request', 1, MetricLoggerUnit.Count);
        const beforeGetRoutesThenQuotes = Date.now();

        quotePromises.push(
          Promise.all([v3CandidatePoolsPromise, v2CandidatePoolsPromise]).then(
            async ([v3CandidatePools, v2CandidatePools]) => {
              const tokenIn = currencyIn.wrapped;
              const tokenOut = currencyOut.wrapped;

              const crossLiquidityPools = await getMixedCrossLiquidityCandidatePools({
                tokenIn,
                tokenOut,
                blockNumber: routingConfig.blockNumber,
                v2SubgraphProvider: this.v2SubgraphProvider,
                v3SubgraphProvider: this.v3SubgraphProvider,
                v2Candidates: v2CandidatePools,
                v3Candidates: v3CandidatePools,
              });

              return this.mixedQuoter
                .getRoutesThenQuotes(
                  tokenIn,
                  tokenOut,
                  amount,
                  amounts,
                  percents,
                  quoteCurrency.wrapped,
                  [v3CandidatePools!, v2CandidatePools!, crossLiquidityPools],
                  tradeType,
                  routingConfig,
                  mixedRouteGasModel
                )
                .then((result) => {
                  metric.putMetric(
                    `SwapRouteFromChain_Mixed_GetRoutesThenQuotes_Load`,
                    Date.now() - beforeGetRoutesThenQuotes,
                    MetricLoggerUnit.Milliseconds
                  );

                  return result;
                });
            }
          )
        );
      }
    }

    const getQuotesResults = await Promise.all(quotePromises);

    const allRoutesWithValidQuotes: RouteWithValidQuote[] = [];
    const allCandidatePools: CandidatePoolsBySelectionCriteria[] = [];
    getQuotesResults.forEach((getQuoteResult) => {
      allRoutesWithValidQuotes.push(...getQuoteResult.routesWithValidQuotes);
      if (getQuoteResult.candidatePools) {
        allCandidatePools.push(getQuoteResult.candidatePools);
      }
    });

    if (allRoutesWithValidQuotes.length === 0) {
      log.info({ allRoutesWithValidQuotes }, 'Received no valid quotes');
      return null;
    }

    // Given all the quotes for all the amounts for all the routes, find the best combination.
    const bestSwapRoute = await getBestSwapRoute(
      amount,
      percents,
      allRoutesWithValidQuotes,
      tradeType,
      this.chainId,
      routingConfig,
      this.portionProvider,
      v2GasModel,
      v3GasModel,
      swapConfig,
      providerConfig
    );

    if (bestSwapRoute) {
      this.emitPoolSelectionMetrics(bestSwapRoute, allCandidatePools);
    }

    return bestSwapRoute;
  }

  private async setCachedRoutesAndLog(
    amount: CurrencyAmount,
    currencyIn: Currency,
    currencyOut: Currency,
    tradeType: TradeType,
    metricsPrefix: string,
    routesToCache?: CachedRoutes
  ): Promise<void> {
    if (routesToCache) {
      await this.routeCachingProvider
        ?.setCachedRoute(routesToCache, amount)
        .then((success) => {
          const status = success ? 'success' : 'rejected';
          metric.putMetric(`${metricsPrefix}_${status}`, 1, MetricLoggerUnit.Count);
        })
        .catch((reason) => {
          log.error(
            {
              reason: reason,
              tokenPair: this.tokenPairSymbolTradeTypeChainId(currencyIn, currencyOut, tradeType),
            },
            `SetCachedRoute failure`
          );

          metric.putMetric(`${metricsPrefix}_failure`, 1, MetricLoggerUnit.Count);
        });
    } else {
      metric.putMetric(`${metricsPrefix}_unnecessary`, 1, MetricLoggerUnit.Count);
    }
  }

  private tradeTypeStr(tradeType: TradeType): string {
    return tradeType === TradeType.EXACT_INPUT ? 'ExactIn' : 'ExactOut';
  }

  private tokenPairSymbolTradeTypeChainId(currencyIn: Currency, currencyOut: Currency, tradeType: TradeType) {
    return `${currencyIn.symbol}/${currencyOut.symbol}/${this.tradeTypeStr(tradeType)}/${this.chainId}`;
  }

  private async getGasPriceWei(latestBlockNumber: number, requestBlockNumber?: number): Promise<BigNumber> {
    // Track how long it takes to resolve this async call.
    const beforeGasTimestamp = Date.now();

    // Get an estimate of the gas price to use when estimating gas cost of different routes.
    const { gasPriceWei } = await this.gasPriceProvider.getGasPrice(latestBlockNumber, requestBlockNumber);

    metric.putMetric('GasPriceLoad', Date.now() - beforeGasTimestamp, MetricLoggerUnit.Milliseconds);

    return gasPriceWei;
  }

  async getGasModels(
    gasPriceWei: BigNumber,
    amountToken: Token,
    quoteToken: Token,
    providerConfig?: GasModelProviderConfig
  ): Promise<GasModelType> {
    const beforeGasModel = Date.now();

    const usdPoolPromise = getHighestLiquidityV3USDPool(this.chainId, this.v3PoolProvider, providerConfig);
    const nativeCurrency = WRAPPED_NATIVE_CURRENCY[this.chainId];
    const nativeAndQuoteTokenV3PoolPromise = !quoteToken.equals(nativeCurrency)
      ? getHighestLiquidityV3NativePool(quoteToken, this.v3PoolProvider, providerConfig)
      : Promise.resolve(null);
    const nativeAndAmountTokenV3PoolPromise = !amountToken.equals(nativeCurrency)
      ? getHighestLiquidityV3NativePool(amountToken, this.v3PoolProvider, providerConfig)
      : Promise.resolve(null);

    // If a specific gas token is specified in the provider config
    // fetch the highest liq V3 pool with it and the native currency
    const nativeAndSpecifiedGasTokenV3PoolPromise =
      providerConfig?.gasToken && !providerConfig?.gasToken.equals(nativeCurrency)
        ? getHighestLiquidityV3NativePool(providerConfig?.gasToken, this.v3PoolProvider, providerConfig)
        : Promise.resolve(null);

    const [usdPool, nativeAndQuoteTokenV3Pool, nativeAndAmountTokenV3Pool, nativeAndSpecifiedGasTokenV3Pool] =
      await Promise.all([
        usdPoolPromise,
        nativeAndQuoteTokenV3PoolPromise,
        nativeAndAmountTokenV3PoolPromise,
        nativeAndSpecifiedGasTokenV3PoolPromise,
      ]);

    const pools: LiquidityCalculationPools = {
      usdPool: usdPool,
      nativeAndQuoteTokenV3Pool: nativeAndQuoteTokenV3Pool,
      nativeAndAmountTokenV3Pool: nativeAndAmountTokenV3Pool,
      nativeAndSpecifiedGasTokenV3Pool: nativeAndSpecifiedGasTokenV3Pool,
    };

    const v2GasModelPromise = this.v2Supported?.includes(this.chainId)
      ? this.v2GasModelFactory
          .buildGasModel({
            chainId: this.chainId,
            gasPriceWei,
            poolProvider: this.v2PoolProvider,
            token: quoteToken,
            l2GasDataProvider: this.l2GasDataProvider,
            providerConfig: providerConfig,
          })
          .catch((_) => undefined) // If v2 model throws uncaught exception, we return undefined v2 gas model, so there's a chance v3 route can go through
      : Promise.resolve(undefined);

    // const v2GasModelPromise = this.v2Supported?.includes(this.chainId)
    //   ? getV2GasModel(this.v2GasModelFactory, {
    //       chainId: this.chainId,
    //       gasPriceWei,
    //       poolProvider: this.v2PoolProvider,
    //       token: quoteToken,
    //       l2GasDataProvider: this.l2GasDataProvider,
    //       providerConfig: providerConfig,
    //     })
    //   : Promise.resolve(undefined);

    const v3GasModelPromise = this.v3GasModelFactory.buildGasModel({
      chainId: this.chainId,
      gasPriceWei,
      pools,
      amountToken,
      quoteToken,
      v2poolProvider: this.v2PoolProvider,
      l2GasDataProvider: this.l2GasDataProvider,
      providerConfig: providerConfig,
    });

    // const v3GasModelPromise = getV3GasModel(
    //   this.chainId,
    //   gasPriceWei,
    //   amountToken,
    //   quoteToken,
    //   this.v2PoolProvider,
    //   this.v3PoolProvider,
    //   this.v3GasModelFactory,
    //   this.l2GasDataProvider,
    //   providerConfig
    // );

    const mixedRouteGasModelPromise = this.mixedRouteGasModelFactory.buildGasModel({
      chainId: this.chainId,
      gasPriceWei,
      pools,
      amountToken,
      quoteToken,
      v2poolProvider: this.v2PoolProvider,
      providerConfig: providerConfig,
    });

    const [v2GasModel, v3GasModel, mixedRouteGasModel] = await Promise.all([
      v2GasModelPromise,
      v3GasModelPromise,
      mixedRouteGasModelPromise,
    ]);

    metric.putMetric('GasModelCreation', Date.now() - beforeGasModel, MetricLoggerUnit.Milliseconds);

    return {
      v2GasModel: v2GasModel,
      v3GasModel: v3GasModel,
      mixedRouteGasModel: mixedRouteGasModel,
    } as GasModelType;
  }

  private determineCurrencyInOutFromTradeType(tradeType: TradeType, amount: CurrencyAmount, quoteCurrency: Token) {
    if (tradeType === TradeType.EXACT_INPUT) {
      return {
        currencyIn: amount.currency as Token,
        currencyOut: quoteCurrency,
      };
    } else {
      return {
        currencyIn: quoteCurrency,
        currencyOut: amount.currency as Token,
      };
    }
  }

  private emitPoolSelectionMetrics(
    swapRouteRaw: {
      quote: CurrencyAmount;
      quoteGasAdjusted: CurrencyAmount;
      routes: RouteWithValidQuote[];
      estimatedGasUsed: BigNumber;
    },
    allPoolsBySelection: CandidatePoolsBySelectionCriteria[]
  ) {
    const poolAddressesUsed = new Set<string>();
    const { routes: routeAmounts } = swapRouteRaw;
    _(routeAmounts)
      .flatMap((routeAmount) => {
        const { poolIdentifiers: poolAddresses } = routeAmount;
        return poolAddresses;
      })
      .forEach((address: string) => {
        poolAddressesUsed.add(address.toLowerCase());
      });

    for (const poolsBySelection of allPoolsBySelection) {
      const { protocol } = poolsBySelection;
      _.forIn(poolsBySelection.selections, (pools: SubgraphPool[], topNSelection: string) => {
        const topNUsed = _.findLastIndex(pools, (pool) => poolAddressesUsed.has(pool.id.toLowerCase())) + 1;
        metric.putMetric(_.capitalize(`${protocol}${topNSelection}`), topNUsed, MetricLoggerUnit.Count);
      });
    }

    let hasV3Route = false;
    let hasV2Route = false;
    let hasMixedRoute = false;
    for (const routeAmount of routeAmounts) {
      if (routeAmount.protocol === Protocol.V3) {
        hasV3Route = true;
      }
      if (routeAmount.protocol === Protocol.V2) {
        hasV2Route = true;
      }
      if (routeAmount.protocol === Protocol.MIXED) {
        hasMixedRoute = true;
      }
    }

    if (hasMixedRoute && (hasV3Route || hasV2Route)) {
      let metricsPrefix = 'Mixed';

      if (hasV3Route) {
        metricsPrefix += 'AndV3';
      }

      if (hasV2Route) {
        metricsPrefix += 'AndV2';
      }

      metric.putMetric(`${metricsPrefix}SplitRoute`, 1, MetricLoggerUnit.Count);
      metric.putMetric(`${metricsPrefix}SplitRouteForChain${this.chainId}`, 1, MetricLoggerUnit.Count);
    } else if (hasMixedRoute) {
      if (routeAmounts.length > 1) {
        metric.putMetric(`MixedSplitRoute`, 1, MetricLoggerUnit.Count);
        metric.putMetric(`MixedSplitRouteForChain${this.chainId}`, 1, MetricLoggerUnit.Count);
      } else {
        metric.putMetric(`MixedRoute`, 1, MetricLoggerUnit.Count);
        metric.putMetric(`MixedRouteForChain${this.chainId}`, 1, MetricLoggerUnit.Count);
      }
    } else if (hasV3Route) {
      if (routeAmounts.length > 1) {
        metric.putMetric(`V3SplitRoute`, 1, MetricLoggerUnit.Count);
        metric.putMetric(`V3SplitRouteForChain${this.chainId}`, 1, MetricLoggerUnit.Count);
      } else {
        metric.putMetric(`V3Route`, 1, MetricLoggerUnit.Count);
        metric.putMetric(`V3RouteForChain${this.chainId}`, 1, MetricLoggerUnit.Count);
      }
    } else if (hasV2Route) {
      if (routeAmounts.length > 1) {
        metric.putMetric(`V2SplitRoute`, 1, MetricLoggerUnit.Count);
        metric.putMetric(`V2SplitRouteForChain${this.chainId}`, 1, MetricLoggerUnit.Count);
      } else {
        metric.putMetric(`V2Route`, 1, MetricLoggerUnit.Count);
        metric.putMetric(`V2RouteForChain${this.chainId}`, 1, MetricLoggerUnit.Count);
      }
    }
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
