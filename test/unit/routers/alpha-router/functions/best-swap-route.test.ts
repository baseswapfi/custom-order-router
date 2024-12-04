import { BigNumber } from '@ethersproject/bignumber';
import { ChainId, Fraction, TradeType } from '@baseswapfi/sdk-core';
import { Pair } from '@baseswapfi/v2-sdk';
import { Pool } from '@baseswapfi/v3-sdk2';
import JSBI from 'jsbi';
import _ from 'lodash';
import sinon from 'sinon';
import {
  CurrencyAmount,
  IGasModel,
  RouteWithValidQuote,
  V2Route,
  V2RouteWithValidQuote,
  V3PoolProvider,
  V3Route,
  V3RouteWithValidQuote,
} from '../../../../../src';
import { IPortionProvider, PortionProvider } from '../../../../../src/providers/portion-provider';
import { V2PoolProvider } from '../../../../../src/providers/v2/pool-provider';
import { getBestSwapRoute } from '../../../../../src/routers/alpha-router/functions/best-swap-route';
import {
  buildMockV2PoolAccessor,
  buildMockV3PoolAccessor,
  // DAI_USDT,
  // DAI_USDT_LOW,
  // DAI_USDT_MEDIUM,
  mockRoutingConfig,
  TEST_CHAIN_USDC as USDC,
  TEST_CHAIN_WETH,
  USDC_DAI,
  USDC_DAI_LOW,
  USDC_DAI_MEDIUM,
  USDC_USD_PLUS_LOW,
  USDC_WETH,
  USDC_WETH_LOW,
  USDC_WETH_MEDIUM,
  // WBTC_USDT_MEDIUM,
  WBTC_WETH,
  DAI_USD_PLUS_LOW,
  DAI_USD_PLUS_MEDIUM,
  WBTC_USD_PLUS_MEDIUM,
  WBTC_WETH_MEDIUM,
  DAI_USD_PLUS,
  WETH_USD_PLUS,
  WETH9_USD_PLUS_LOW,
  TEST_CHAIN_ID,
  // WBTC_WETH_MEDIUM,
  // WETH9_USDT_LOW,
  // WETH_USDT,
} from '../../../../test-util/mock-data';

const v3Route1 = new V3Route(
  // [USDC_DAI_LOW, DAI_USDT_LOW, WETH9_USDT_LOW],
  [USDC_DAI_LOW, DAI_USD_PLUS_LOW, USDC_WETH_LOW],
  USDC,
  TEST_CHAIN_WETH
);

const v3Route2 = new V3Route([USDC_WETH_LOW], USDC, TEST_CHAIN_WETH);
const v3Route3 = new V3Route(
  // [USDC_DAI_MEDIUM, DAI_USDT_MEDIUM, WBTC_USDT_MEDIUM, WBTC_WETH_MEDIUM],
  [USDC_DAI_MEDIUM, DAI_USD_PLUS_MEDIUM, WBTC_USD_PLUS_MEDIUM, WBTC_WETH_MEDIUM],
  USDC,
  TEST_CHAIN_WETH
);
// const v3Route4 = new V3Route([USDC_WETH_MEDIUM], USDC, TEST_CHAIN_WETH);

// const v2Route1 = new V2Route(
//   // [USDC_DAI, DAI_USDT, WETH_USDT],
//   [USDC_DAI, DAI_USD_PLUS, WETH_USD_PLUS],
//   USDC,
//   TEST_CHAIN_WETH
// );
// const v2Route2 = new V2Route([USDC_WETH], USDC, TEST_CHAIN_WETH);
// const v2Route3 = new V2Route(
//   // [USDC_DAI, DAI_USDT, WETH_USDT, WBTC_WETH],
//   [USDC_DAI, DAI_USD_PLUS, WETH_USD_PLUS, WBTC_WETH],
//   USDC,
//   TEST_CHAIN_WETH
// );

const mockPools = [
  USDC_DAI_LOW,
  DAI_USD_PLUS_LOW,
  WETH9_USD_PLUS_LOW,
  USDC_DAI_MEDIUM,
  DAI_USD_PLUS_MEDIUM,
  WBTC_USD_PLUS_MEDIUM,
  WBTC_WETH_MEDIUM,
  USDC_WETH_LOW,
  USDC_WETH_MEDIUM,
];

describe('get best swap route', () => {
  let mockPoolProvider: sinon.SinonStubbedInstance<V3PoolProvider>;
  let mockV3GasModel: sinon.SinonStubbedInstance<IGasModel<V3RouteWithValidQuote>>;
  let mockV3PoolProvider: sinon.SinonStubbedInstance<V3PoolProvider>;
  let mockV2PoolProvider: sinon.SinonStubbedInstance<V2PoolProvider>;
  let mockV2GasModel: sinon.SinonStubbedInstance<IGasModel<V2RouteWithValidQuote>>;
  let portionProvider: IPortionProvider;

  beforeEach(() => {
    mockPoolProvider = sinon.createStubInstance(V3PoolProvider);
    mockPoolProvider.getPools.resolves(buildMockV3PoolAccessor(mockPools));
    mockPoolProvider.getPoolAddress.callsFake((tA, tB, fee) => ({
      poolAddress: Pool.getAddress(tA, tB, fee),
      token0: tA,
      token1: tB,
    }));

    mockV3GasModel = {
      estimateGasCost: sinon.stub(),
    };
    mockV3GasModel.estimateGasCost.callsFake((r) => {
      return {
        gasEstimate: BigNumber.from(10000),
        gasCostInToken: CurrencyAmount.fromRawAmount(r.quoteToken, 0),
        gasCostInUSD: CurrencyAmount.fromRawAmount(USDC, 0),
      };
    });

    mockV3PoolProvider = sinon.createStubInstance(V3PoolProvider);
    const v3MockPools = [USDC_DAI_LOW, USDC_DAI_MEDIUM, USDC_WETH_LOW, WETH9_USD_PLUS_LOW, DAI_USD_PLUS_LOW];
    mockV3PoolProvider.getPools.resolves(buildMockV3PoolAccessor(v3MockPools));
    mockV3PoolProvider.getPoolAddress.callsFake((tA, tB, fee) => ({
      poolAddress: Pool.getAddress(tA, tB, fee),
      token0: tA,
      token1: tB,
    }));

    const v2MockPools = [DAI_USD_PLUS, USDC_WETH, WETH_USD_PLUS, USDC_DAI, WBTC_WETH];
    mockV2PoolProvider = sinon.createStubInstance(V2PoolProvider);
    mockV2PoolProvider.getPools.resolves(buildMockV2PoolAccessor(v2MockPools));
    mockV2PoolProvider.getPoolAddress.callsFake((tA, tB) => ({
      poolAddress: Pair.getAddress(tA, tB),
      token0: tA,
      token1: tB,
    }));

    mockV2GasModel = {
      estimateGasCost: sinon.stub(),
    };
    mockV2GasModel.estimateGasCost.callsFake((r: V2RouteWithValidQuote) => {
      return {
        gasEstimate: BigNumber.from(10000),
        gasCostInToken: CurrencyAmount.fromRawAmount(r.quoteToken, 0),
        gasCostInUSD: CurrencyAmount.fromRawAmount(USDC, 0),
      };
    });
    portionProvider = new PortionProvider();
  });

  const buildV3RouteWithValidQuote = (
    route: V3Route,
    tradeType: TradeType,
    amount: CurrencyAmount,
    quote: number,
    percent: number
  ): V3RouteWithValidQuote => {
    const quoteToken = tradeType == TradeType.EXACT_OUTPUT ? route.output : route.input;
    return new V3RouteWithValidQuote({
      amount,
      rawQuote: BigNumber.from(quote),
      sqrtPriceX96AfterList: [BigNumber.from(1)],
      initializedTicksCrossedList: [1],
      quoterGasEstimate: BigNumber.from(100000),
      percent,
      route,
      gasModel: mockV3GasModel,
      quoteToken,
      tradeType,
      v3PoolProvider: mockV3PoolProvider,
    });
  };

  const buildV3RouteWithValidQuotes = (
    route: V3Route,
    tradeType: TradeType,
    inputAmount: CurrencyAmount,
    quotes: number[],
    percents: number[]
  ) => {
    return _.map(percents, (p, i) =>
      buildV3RouteWithValidQuote(route, tradeType, inputAmount.multiply(new Fraction(p, 100)), quotes[i]!, p)
    );
  };

  const buildV2RouteWithValidQuote = (
    route: V2Route,
    tradeType: TradeType,
    amount: CurrencyAmount,
    quote: number,
    percent: number
  ): V2RouteWithValidQuote => {
    const quoteToken = tradeType == TradeType.EXACT_OUTPUT ? route.output : route.input;
    return new V2RouteWithValidQuote({
      amount,
      rawQuote: BigNumber.from(quote),
      percent,
      route,
      gasModel: mockV2GasModel,
      quoteToken,
      tradeType,
      v2PoolProvider: mockV2PoolProvider,
    });
  };

  // const buildV2RouteWithValidQuotes = (
  //   route: V2Route,
  //   tradeType: TradeType,
  //   inputAmount: CurrencyAmount,
  //   quotes: number[],
  //   percents: number[]
  // ) => {
  //   return _.map(percents, (p, i) =>
  //     buildV2RouteWithValidQuote(route, tradeType, inputAmount.multiply(new Fraction(p, 100)), quotes[i]!, p)
  //   );
  // };

  test('succeeds to find 1 split best route', async () => {
    const amount = CurrencyAmount.fromRawAmount(USDC, 100000);
    const percents = [25, 50, 75, 100];
    const routesWithQuotes: RouteWithValidQuote[] = [
      ...buildV3RouteWithValidQuotes(v3Route1, TradeType.EXACT_INPUT, amount, [10, 20, 30, 40], percents),
      // ...buildV2RouteWithValidQuotes(
      //   v2Route2,
      //   TradeType.EXACT_INPUT,
      //   amount,
      //   [8, 19, 28, 38],
      //   percents
      // ),
      ...buildV3RouteWithValidQuotes(v3Route3, TradeType.EXACT_INPUT, amount, [14, 19, 23, 60], percents),
    ];

    const swapRouteType = await getBestSwapRoute(
      amount,
      percents,
      routesWithQuotes,
      TradeType.EXACT_INPUT,
      TEST_CHAIN_ID,
      { ...mockRoutingConfig, distributionPercent: 25 },
      portionProvider
    )!;

    const { quote, routes, quoteGasAdjusted, estimatedGasUsed, estimatedGasUsedUSD, estimatedGasUsedQuoteToken } =
      swapRouteType!;

    expect(quote.quotient.toString()).toBe('60');
    expect(quote.equalTo(quoteGasAdjusted)).toBeTruthy();
    expect(estimatedGasUsed.eq(BigNumber.from(10000))).toBeTruthy();
    expect(estimatedGasUsedUSD.equalTo(CurrencyAmount.fromRawAmount(USDC, 0))).toBeTruthy();
    expect(estimatedGasUsedQuoteToken.equalTo(CurrencyAmount.fromRawAmount(TEST_CHAIN_WETH, 0))).toBeTruthy();
    expect(routes).toHaveLength(1);
  });
});
