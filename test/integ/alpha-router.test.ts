import dotenv from 'dotenv';

import { ChainId, TradeType } from '@baseswapfi/sdk-core';
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

  // it('gets gas price estimates', async () => {
  //   // const blockNumber = await provider.getBlockNumber();
  //   // const gasPriceWei = await router.getGasPriceWei(blockNumber, blockNumber);
  //   // console.log(formatUnits(gasPriceWei));
  //   // expect(gasPriceWei.gt(0));
  // });

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
    const amountIn = 100;
    const currencyIn = USDC_NATIVE_BASE;
    const currencyOut = WRAPPED_NATIVE_CURRENCY[CHAIN_ID];
    const amount = CurrencyAmount.fromRawAmount(currencyIn, amountIn);
    // const protocols = [Protocol.V3];
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
    console.log(quote?.route[0].tokenPath);
    console.log(quote?.trade.outputAmount.toSignificant());
  });
});
