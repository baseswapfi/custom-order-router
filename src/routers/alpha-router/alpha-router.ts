import { ChainId } from '@baseswapfi/sdk-core';

export type AlphaRouterParams = {
  /**
   * The chain id for this instance of the Alpha Router.
   */

  chainId: ChainId;

  // /**
  //  * The Web3 provider for getting on-chain data.
  //  */
  // provider: BaseProvider;

  // /**
  //  * The provider to use for making multicalls. Used for getting on-chain data
  //  * like pools, tokens, quotes in batch.
  //  */
  // multicall2Provider?: UniswapMulticallProvider;
  // /**
  //  * The provider for getting all pools that exist on V3 from the Subgraph. The pools
  //  * from this provider are filtered during the algorithm to a set of candidate pools.
  //  */
  // v3SubgraphProvider?: IV3SubgraphProvider;
  // /**
  //  * The provider for getting data about V3 pools.
  //  */
  // v3PoolProvider?: IV3PoolProvider;
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

// export class AlphaRouter
//   implements
//     IRouter<AlphaRouterConfig>,
//     ISwapToRatio<AlphaRouterConfig, SwapAndAddConfig>
// {

// }

export class AlphaRouter {}
