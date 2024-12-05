import dotenv from 'dotenv';

import { ChainId, Token, TradeType } from '@baseswapfi/sdk-core';
import { AlphaRouter, AlphaRouterParams } from '../../src/routers/alpha-router';
import { JsonRpcProvider } from '@ethersproject/providers';
import {
  AlphaRouterConfig,
  CurrencyAmount,
  DAI_BASE,
  ID_TO_PROVIDER,
  USDC_NATIVE_BASE,
  usdGasTokensByChain,
  WRAPPED_NATIVE_CURRENCY,
} from '../../src';
import { Protocol } from '@baseswapfi/router-sdk';
import { ProviderConfig } from '../../src/providers/provider';
import { formatUnits } from 'ethers/lib/utils';

dotenv.config();
jest.setTimeout(30000);

const CHAIN_ID = ChainId.BASE;

describe('AlphaRouter', () => {
  let router: AlphaRouter;
  let provider: JsonRpcProvider;

  beforeEach(() => {
    provider = new JsonRpcProvider(ID_TO_PROVIDER(CHAIN_ID));
    const params: AlphaRouterParams = {
      chainId: CHAIN_ID,
      provider,
    };
    router = new AlphaRouter(params);
  });

  it('gets quotes', async () => {
    // async getSwapRouteFromChain(
    //   amount: CurrencyAmount,
    //   currencyIn: Token,
    //   currencyOut: Token,
    //   protocols: Protocol[],
    //   quoteCurrency: Token,
    //   tradeType: TradeType,
    //   routingConfig: AlphaRouterConfig,
    //   v3GasModel: IGasModel<V3RouteWithValidQuote>,
    //   mixedRouteGasModel: IGasModel<MixedRouteWithValidQuote>,
    //   gasPriceWei: BigNumber,
    //   v2GasModel?: IGasModel<V2RouteWithValidQuote>,
    //   swapConfig?: SwapOptions,
    //   providerConfig?: ProviderConfig
    // ): Promise<BestSwapRoute | null> {
    // console.log(usdGasTokensByChain[CHAIN_ID]);
    // const amountIn = 100e6;
    // const currencyIn = USDC_NATIVE_BASE;
    // const currencyOut = WRAPPED_NATIVE_CURRENCY[CHAIN_ID];

    // ETH-BSWAP test

    const currencyIn = WRAPPED_NATIVE_CURRENCY[CHAIN_ID];
    const currencyOut = new Token(
      CHAIN_ID,
      '0x78a087d713Be963Bf307b18F2Ff8122EF9A63ae9',
      18,
      'BSWAP'
    );
    const amountIn = 100 ** currencyIn.decimals;

    const amount = CurrencyAmount.fromRawAmount(currencyIn, amountIn);
    // const quoteCurrency = null;
    const tradeType = TradeType.EXACT_INPUT;
    // const routingConfig: AlphaRouterConfig = {};
    // const providerConfig: ProviderConfig = {};
    const protocols = [Protocol.V2, Protocol.V3, Protocol.MIXED];

    const quote = await router.route(
      amount,
      currencyOut,
      tradeType,
      undefined,
      {
        protocols,
      }
    );
    console.log(quote?.route);
    console.log(`
    tokenIn:           ${currencyIn.symbol}
    tokenOut:          ${currencyOut.symbol}
    amountIn:          ${amountIn}
    quote amount out:  ${quote?.trade.outputAmount.toSignificant()}
      `);
  });
});
