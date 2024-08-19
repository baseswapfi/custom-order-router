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
import NodeCache from 'node-cache';
import { OnChainTokenFeeFetcher } from '../../providers/token-fee-fetcher';

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

  /**
   * A provider for getting token properties for special tokens like fee-on-transfer tokens.
   */
  tokenPropertiesProvider?: ITokenPropertiesProvider;

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
  protected provider: BaseProvider;
  protected tokenPropertiesProvider: ITokenPropertiesProvider;

  constructor({ chainId, tokenPropertiesProvider, provider }: AlphaRouterParams) {
    this.chainId = chainId;
    this.provider = provider;

    if (tokenPropertiesProvider) {
      this.tokenPropertiesProvider = tokenPropertiesProvider;
    } else {
      this.tokenPropertiesProvider = new TokenPropertiesProvider(
        this.chainId,
        new NodeJSCache(new NodeCache({ stdTTL: 86400, useClones: false })),
        new OnChainTokenFeeFetcher(this.chainId, provider)
      );
    }
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

    // const tokenOutProperties = await this.tokenPropertiesProvider.getTokensProperties(
    //   [tokenOut],
    //   partialRoutingConfig
    // );

    // const feeTakenOnTransfer =
    //   tokenOutProperties[tokenOut.address.toLowerCase()]?.tokenFeeResult?.feeTakenOnTransfer;
    // const externalTransferFailed =
    //   tokenOutProperties[tokenOut.address.toLowerCase()]?.tokenFeeResult?.externalTransferFailed;

    // // We want to log the fee on transfer output tokens that we are taking fee or not
    // // Ideally the trade size (normalized in USD) would be ideal to log here, but we don't have spot price of output tokens here.
    // // We have to make sure token out is FOT with either buy/sell fee bps > 0
    // if (tokenOutProperties[tokenOut.address.toLowerCase()]?.tokenFeeResult?.buyFeeBps?.gt(0) ||
    //     tokenOutProperties[tokenOut.address.toLowerCase()]?.tokenFeeResult?.sellFeeBps?.gt(0)) {
    //   if (feeTakenOnTransfer || externalTransferFailed) {
    //     // also to be extra safe, in case of FOT with feeTakenOnTransfer or externalTransferFailed,
    //     // we nullify the fee and flat fee to avoid any potential issues.
    //     // although neither web nor wallet should use the calldata returned from routing/SOR
    //     if (swapConfig?.type === SwapType.UNIVERSAL_ROUTER) {
    //       swapConfig.fee = undefined;
    //       swapConfig.flatFee = undefined;
    //     }

    //     metric.putMetric(
    //       'TokenOutFeeOnTransferNotTakingFee',
    //       1,
    //       MetricLoggerUnit.Count
    //     );
    //   } else {
    //     metric.putMetric(
    //       'TokenOutFeeOnTransferTakingFee',
    //       1,
    //       MetricLoggerUnit.Count
    //     );
    //   }
    // }

    if (tradeType === TradeType.EXACT_OUTPUT) {
    }

    return null;
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
}
