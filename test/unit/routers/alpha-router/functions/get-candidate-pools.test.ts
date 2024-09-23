import { Protocol } from '@baseswapfi/router-sdk';
import {
  ChainId,
  Currency,
  Token,
  TradeType,
  V3_CORE_FACTORY_ADDRESSES,
} from '@baseswapfi/sdk-core';
import { Pair } from '@baseswapfi/v2-sdk';
import {
  encodeSqrtRatioX96,
  FeeAmount,
  POOL_INIT_CODE_HASH_MAP,
  Pool as V3Pool,
} from '@baseswapfi/v3-sdk2';
import _ from 'lodash';
import sinon from 'sinon';
import {
  AlphaRouterConfig,
  CachingTokenListProvider,
  sortsBefore,
  TokenProvider,
  // USDT_MAINNET as USDT,
  V2PoolProvider,
  V2SubgraphPool,
  V2SubgraphProvider,
  V3PoolProvider,
  V3SubgraphPool,
  V3SubgraphProvider,
  WRAPPED_NATIVE_CURRENCY,
} from '../../../../../src';
import {
  getMixedCrossLiquidityCandidatePools,
  getV3CandidatePools,
  V2CandidatePools,
  V3CandidatePools,
} from '../../../../../src/routers/alpha-router/functions/get-candidate-pools';
import {
  buildMockTokenAccessor,
  buildMockV2PoolAccessor,
  buildMockV3PoolAccessor,
  DAI_WETH,
  DAI_WETH_MEDIUM,
  pairToV2SubgraphPool,
  poolToV3SubgraphPool,
  TEST_CHAIN_DAI,
  TEST_CHAIN_ID,
  TEST_CHAIN_USDC,
  TEST_CHAIN_WETH,
  USDC_DAI,
  USDC_DAI_LOW,
  USDC_DAI_MEDIUM,
  USDC_WETH,
  USDC_WETH_LOW,
  WETH_DAI,
} from '../../../../test-util/mock-data';

xdescribe('get candidate pools', () => {
  // const poolToV3Subgraph = (pool: V3Pool) => {
  //   return poolToV3SubgraphPool(pool, ``);
  // };
  // const pairToV2Subgraph = (pair: Pair) => {
  //   return pairToV2SubgraphPool(
  //     pair,
  //     `${pair.token0.address.toLowerCase()}#${pair.token1.address.toLowerCase()}`
  //   );
  // };
  let mockTokenProvider: sinon.SinonStubbedInstance<TokenProvider>;
  let mockV3PoolProvider: sinon.SinonStubbedInstance<V3PoolProvider>;
  let mockV3SubgraphProvider: sinon.SinonStubbedInstance<V3SubgraphProvider>;
  let mockBlockTokenListProvider: sinon.SinonStubbedInstance<CachingTokenListProvider>;
  let mockV2PoolProvider: sinon.SinonStubbedInstance<V2PoolProvider>;
  let mockV2SubgraphProvider: sinon.SinonStubbedInstance<V2SubgraphProvider>;

  const ROUTING_CONFIG: AlphaRouterConfig = {
    v3PoolSelection: {
      topN: 0,
      topNDirectSwaps: 0,
      topNTokenInOut: 0,
      topNSecondHop: 0,
      topNWithEachBaseToken: 0,
      topNWithBaseToken: 0,
    },
    v2PoolSelection: {
      topN: 0,
      topNDirectSwaps: 0,
      topNTokenInOut: 0,
      topNSecondHop: 0,
      topNWithEachBaseToken: 0,
      topNWithBaseToken: 0,
    },
    maxSwapsPerPath: 3,
    minSplits: 1,
    maxSplits: 3,
    distributionPercent: 5,
    forceCrossProtocol: false,
  };

  const mockTokens = [TEST_CHAIN_USDC, TEST_CHAIN_DAI, TEST_CHAIN_WETH];

  const mockV3Pools = [
    USDC_DAI_LOW,
    USDC_DAI_MEDIUM,
    // USDC_WETH_LOW,
    // WETH9_USDT_LOW,
    // DAI_USDT_LOW,
  ];
  const mockV2Pools = [
    //DAI_USDT,
    DAI_WETH,
    USDC_WETH,
    //WETH_USDT,
    USDC_DAI,
  ];

  beforeEach(() => {
    mockTokenProvider = sinon.createStubInstance(TokenProvider);
    mockV3PoolProvider = sinon.createStubInstance(V3PoolProvider);
    mockV3SubgraphProvider = sinon.createStubInstance(V3SubgraphProvider);
    mockBlockTokenListProvider = sinon.createStubInstance(CachingTokenListProvider);
    mockV2PoolProvider = sinon.createStubInstance(V2PoolProvider);
    mockV2SubgraphProvider = sinon.createStubInstance(V2SubgraphProvider);

    const mockV3SubgraphPools: V3SubgraphPool[] = mockV3Pools.map((pool) =>
      poolToV3SubgraphPool(
        pool,
        `${pool.token0.address.toLowerCase()}#${pool.token1.address.toLowerCase()}`
      )
    );
    const mockV2SubgraphPools: V2SubgraphPool[] = mockV2Pools.map((pair) =>
      pairToV2SubgraphPool(
        pair,
        `${pair.token0.address.toLowerCase()}#${pair.token1.address.toLowerCase()}`
      )
    );

    mockV2SubgraphProvider.getPools.resolves(mockV2SubgraphPools);
    mockV2PoolProvider.getPools.resolves(buildMockV2PoolAccessor(mockV2Pools));

    mockV3SubgraphProvider.getPools.resolves(mockV3SubgraphPools);
    mockV3PoolProvider.getPools.resolves(buildMockV3PoolAccessor(mockV3Pools));
    mockV3PoolProvider.getPoolAddress.callsFake((t1: Token, t2: Token, f: FeeAmount) => {
      return {
        poolAddress: V3Pool.getAddress(
          t1,
          t2,
          f,
          POOL_INIT_CODE_HASH_MAP[TEST_CHAIN_ID],
          V3_CORE_FACTORY_ADDRESSES[TEST_CHAIN_ID]
        ),
        token0: t1.sortsBefore(t2) ? t1 : t2,
        token1: t1.sortsBefore(t2) ? t2 : t1,
      };
    });

    mockTokenProvider.getTokens.resolves(buildMockTokenAccessor(mockTokens));
  });

  // test(`succeeds to get top pools by liquidity for protocol V3`, async () => {
  //   await getV3CandidatePools({
  //     tokenIn: TEST_CHAIN_USDC,
  //     tokenOut: TEST_CHAIN_DAI,
  //     routeType: TradeType.EXACT_INPUT,
  //     routingConfig: {
  //       ...ROUTING_CONFIG,
  //       v3PoolSelection: {
  //         ...ROUTING_CONFIG.v3PoolSelection,
  //         topN: 2,
  //       },
  //     },
  //     poolProvider: mockV3PoolProvider,
  //     subgraphProvider: mockV3SubgraphProvider,
  //     tokenProvider: mockTokenProvider,
  //     blockedTokenListProvider: mockBlockTokenListProvider,
  //     chainId: TEST_CHAIN_ID,
  //   });

  //   // expect(
  //   //   mockV3PoolProvider.getPools.calledWithExactly(
  //   //     [
  //   //       [TEST_CHAIN_USDC, TEST_CHAIN_DAI, FeeAmount.LOW],
  //   //       [TEST_CHAIN_USDC, TEST_CHAIN_DAI, FeeAmount.MEDIUM],
  //   //     ],
  //   //     { blockNumber: undefined }
  //   //   )
  //   // ).toBeTruthy();
  // });

  test(`succeeds to get top pools directly swapping token in for token out for protocol V3`, async () => {
    await getV3CandidatePools({
      tokenIn: TEST_CHAIN_USDC,
      tokenOut: TEST_CHAIN_DAI,
      routeType: TradeType.EXACT_INPUT,
      routingConfig: {
        ...ROUTING_CONFIG,
        v3PoolSelection: {
          ...ROUTING_CONFIG.v3PoolSelection,
          topNDirectSwaps: 2,
        },
      },
      poolProvider: mockV3PoolProvider,
      subgraphProvider: mockV3SubgraphProvider,
      tokenProvider: mockTokenProvider,
      blockedTokenListProvider: mockBlockTokenListProvider,
      chainId: TEST_CHAIN_ID,
    });

    expect(
      mockV3PoolProvider.getPools.calledWithExactly(
        [
          [TEST_CHAIN_DAI, TEST_CHAIN_USDC, FeeAmount.LOW],
          [TEST_CHAIN_DAI, TEST_CHAIN_USDC, FeeAmount.MEDIUM],
        ],
        { blockNumber: undefined }
      )
    ).toBeTruthy();
  });
});
