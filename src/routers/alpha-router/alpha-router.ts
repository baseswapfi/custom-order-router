import { ChainId, Currency, TradeType } from '@baseswapfi/sdk-core';
import { BaseProvider } from '@ethersproject/providers';
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
  // ITokenPropertiesProvider,
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
  // TokenPropertiesProvider,
  UniswapMulticallProvider,
  // URISubgraphProvider,
  // V2QuoteProvider,
  // V2SubgraphProviderWithFallBacks,
  // V3SubgraphProviderWithFallBacks,
} from '../../providers';
import { CurrencyAmount } from '../../util/amounts';
import {
  IRouter,
  ISwapToRatio,
  SwapAndAddConfig,
  SwapAndAddOptions,
  SwapOptions,
  SwapRoute,
  SwapToRatioResponse,
} from '../router';
import { Position } from '@baseswapfi/v3-sdk2';
import { DEFAULT_ROUTING_CONFIG_BY_CHAIN } from './config';

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
  // /**
  //  * The provider for getting data about Tokens.
  //  */
  // tokenProvider?: ITokenProvider;
  // /**
  //  * The provider for getting the current gas price to use when account for gas in the
  //  * algorithm.
  //  */
  // gasPriceProvider?: IGasPriceProvider;
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

  // /**
  //  * A provider for getting token properties for special tokens like fee-on-transfer tokens.
  //  */
  // tokenPropertiesProvider?: ITokenPropertiesProvider;

  // /**
  //  * A provider for computing the portion-related data for routes and quotes.
  //  */
  // portionProvider?: IPortionProvider;

  // /**
  //  * All the supported v2 chains configuration
  //  */
  // v2Supported?: ChainId[];
};

export type AlphaRouterConfig = {};

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

export class AlphaRouter
  implements IRouter<AlphaRouterConfig>, ISwapToRatio<AlphaRouterConfig, SwapAndAddConfig>
{
  protected chainId: ChainId;

  constructor({ chainId }: AlphaRouterParams) {
    this.chainId = chainId;
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
    console.log(amount);
    console.log(quoteCurrency);
    console.log(tradeType);
    console.log(swapConfig);
    console.log(partialRoutingConfig);

    return null;
  }
}
