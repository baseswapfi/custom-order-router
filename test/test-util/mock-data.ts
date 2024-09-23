import { BigNumber } from '@ethersproject/bignumber';
import { ChainId, Currency, Ether, Token, V3_CORE_FACTORY_ADDRESSES } from '@baseswapfi/sdk-core';
import { Pair } from '@baseswapfi/v2-sdk';
import {
  encodeSqrtRatioX96,
  FeeAmount,
  POOL_INIT_CODE_HASH_MAP,
  Pool as V3Pool,
} from '@baseswapfi/v3-sdk2';
import _ from 'lodash';
import {
  AlphaRouterConfig,
  CurrencyAmount,
  DAI_BASE,
  TokenAccessor,
  TokenList,
  USD_PLUS_BASE,
  // UNI_MAINNET,
  // USDC_NATIVE_BASE as USDC,
  USDC_BASE,
  // USDT_MAINNET as USDT,
  V2PoolAccessor,
  V2SubgraphPool,
  V3PoolAccessor,
  V3SubgraphPool,
  cbBTC_BASE,
  WRAPPED_NATIVE_CURRENCY,
} from '../../src';

export const mockBlock = 19944732; // BASE 9/18 ~1:00PM
export const mockGasPriceWeiBN = BigNumber.from(100000);
export const mockBlockBN = BigNumber.from(mockBlock);

export const TEST_CHAIN_ID = ChainId.BASE;
export const TEST_CHAIN_WETH = WRAPPED_NATIVE_CURRENCY[TEST_CHAIN_ID]!;
export const TEST_CHAIN_USDC = USDC_BASE;
export const TEST_CHAIN_DAI = DAI_BASE;
export const TEST_CHAIN_USD_PLUS = USD_PLUS_BASE;
export const TEST_CHAIN_WBTC = cbBTC_BASE;

export const mockRoutingConfig: AlphaRouterConfig = {
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
  maxSplits: 4,
  distributionPercent: 5,
  forceCrossProtocol: false,
};

// Mock 0 decimal token
export const MOCK_ZERO_DEC_TOKEN = new Token(
  TEST_CHAIN_ID,
  '0x11fe4b6ae13d2a6055c8d9cf65c55bac32b5d844',
  0,
  'MOCK',
  'Mock Zero Dec'
);

// Mock V3 Pools
export const USDC_MOCK_LOW = new V3Pool(
  TEST_CHAIN_USDC,
  MOCK_ZERO_DEC_TOKEN,
  FeeAmount.LOW,
  encodeSqrtRatioX96(1, 1),
  500,
  0
);

export const USDC_WETH_LOW = new V3Pool(
  TEST_CHAIN_USDC,
  TEST_CHAIN_WETH,
  FeeAmount.LOW,
  encodeSqrtRatioX96(1, 1),
  FeeAmount.LOW,
  0
);

export const USDC_WETH_MEDIUM = new V3Pool(
  TEST_CHAIN_USDC,
  TEST_CHAIN_WETH,
  FeeAmount.MEDIUM,
  encodeSqrtRatioX96(1, 1),
  500,
  0
);

// Mock USDC weth pools with different liquidity

export const USDC_WETH_LOW_LIQ_LOW = new V3Pool(
  TEST_CHAIN_USDC,
  TEST_CHAIN_WETH,
  FeeAmount.LOW,
  encodeSqrtRatioX96(1, 1),
  100,
  0
);

export const USDC_WETH_MED_LIQ_MEDIUM = new V3Pool(
  TEST_CHAIN_USDC,
  TEST_CHAIN_WETH,
  FeeAmount.MEDIUM,
  encodeSqrtRatioX96(1, 1),
  500,
  0
);

export const USDC_WETH_HIGH_LIQ_HIGH = new V3Pool(
  TEST_CHAIN_USDC,
  TEST_CHAIN_WETH,
  FeeAmount.HIGH,
  encodeSqrtRatioX96(1, 1),
  1000,
  0
);

export const WETH9_USD_PLUS_LOW = new V3Pool(
  TEST_CHAIN_WETH,
  TEST_CHAIN_USD_PLUS,
  FeeAmount.LOW,
  encodeSqrtRatioX96(1, 1),
  200,
  0
);
export const USDC_DAI_LOW = new V3Pool(
  TEST_CHAIN_USDC,
  TEST_CHAIN_DAI,
  FeeAmount.LOW,
  encodeSqrtRatioX96(1, 1),
  10,
  0
);
export const USDC_DAI_MEDIUM = new V3Pool(
  TEST_CHAIN_USDC,
  TEST_CHAIN_DAI,
  FeeAmount.MEDIUM,
  encodeSqrtRatioX96(1, 1),
  8,
  0
);
// export const USDC_USDT_MEDIUM = new V3Pool(
//   USDC,
//   USDT,
//   FeeAmount.MEDIUM,
//   encodeSqrtRatioX96(1, 1),
//   8,
//   0
// );

export const USDC_USD_PLUS_LOW = new V3Pool(
  TEST_CHAIN_USDC,
  TEST_CHAIN_USD_PLUS,
  FeeAmount.LOW,
  encodeSqrtRatioX96(1, 1),
  10,
  0
);

export const DAI_USD_PLUS_LOW = new V3Pool(
  TEST_CHAIN_DAI,
  TEST_CHAIN_USD_PLUS,
  FeeAmount.LOW,
  encodeSqrtRatioX96(1, 1),
  10,
  0
);
export const DAI_USD_PLUS_MEDIUM = new V3Pool(
  TEST_CHAIN_DAI,
  TEST_CHAIN_USD_PLUS,
  FeeAmount.MEDIUM,
  encodeSqrtRatioX96(1, 1),
  10,
  0
);
// export const DAI_USDT_LOW = new V3Pool(
//   DAI,
//   USDT,
//   FeeAmount.LOW,
//   encodeSqrtRatioX96(1, 1),
//   10,
//   0
// );
// export const DAI_USDT_MEDIUM = new V3Pool(
//   DAI,
//   USDT,
//   FeeAmount.MEDIUM,
//   encodeSqrtRatioX96(1, 1),
//   10,
//   0
// );
export const DAI_WETH_MEDIUM = new V3Pool(
  TEST_CHAIN_DAI,
  TEST_CHAIN_WETH,
  FeeAmount.MEDIUM,
  encodeSqrtRatioX96(1, 1),
  10,
  0
);

export const WBTC_USD_PLUS_MEDIUM = new V3Pool(
  TEST_CHAIN_USD_PLUS,
  TEST_CHAIN_WBTC,
  FeeAmount.MEDIUM,
  encodeSqrtRatioX96(1, 1),
  500,
  0
);
// export const WBTC_USDT_MEDIUM = new V3Pool(
//   USDT,
//   WBTC,
//   FeeAmount.MEDIUM,
//   encodeSqrtRatioX96(1, 1),
//   500,
//   0
// );
export const WBTC_WETH_MEDIUM = new V3Pool(
  TEST_CHAIN_WETH,
  TEST_CHAIN_WBTC,
  FeeAmount.MEDIUM,
  encodeSqrtRatioX96(1, 1),
  500,
  0
);
// export const UNI_WETH_MEDIUM = new V3Pool(
//   TEST_CHAIN_WETH,
//   UNI_MAINNET,
//   FeeAmount.MEDIUM,
//   encodeSqrtRatioX96(1, 1),
//   500,
//   0
// );

// Mock V2 Pools
// export const DAI_USDT = new Pair(
//   CurrencyAmount.fromRawAmount(DAI, 10000000000),
//   CurrencyAmount.fromRawAmount(USDT, 10000000000)
// );

export const DAI_WETH = new Pair(
  CurrencyAmount.fromRawAmount(TEST_CHAIN_DAI, 10000000000),
  CurrencyAmount.fromRawAmount(TEST_CHAIN_WETH, 10000000000)
);

export const USDC_WETH = new Pair(
  CurrencyAmount.fromRawAmount(TEST_CHAIN_USDC, 10000000000),
  CurrencyAmount.fromRawAmount(TEST_CHAIN_WETH, 10000000000)
);

// export const USDC_USDT = new Pair(
//   CurrencyAmount.fromRawAmount(USDC, 10000000000),
//   CurrencyAmount.fromRawAmount(USDT, 10000000000)
// );

// export const WETH_USDT = new Pair(
//   CurrencyAmount.fromRawAmount(USDT, 10000000000),
//   CurrencyAmount.fromRawAmount(TEST_CHAIN_WETH, 10000000000)
// );

export const WETH_USD_PLUS = new Pair(
  CurrencyAmount.fromRawAmount(TEST_CHAIN_USD_PLUS, 10000000000),
  CurrencyAmount.fromRawAmount(TEST_CHAIN_WETH, 10000000000)
);

export const USDC_DAI = new Pair(
  CurrencyAmount.fromRawAmount(TEST_CHAIN_USDC, 10000000000),
  CurrencyAmount.fromRawAmount(TEST_CHAIN_DAI, 10000000000)
);

export const DAI_USD_PLUS = new Pair(
  CurrencyAmount.fromRawAmount(TEST_CHAIN_DAI, 10000000000),
  CurrencyAmount.fromRawAmount(TEST_CHAIN_USD_PLUS, 10000000000)
);

export const WETH_DAI = new Pair(
  CurrencyAmount.fromRawAmount(TEST_CHAIN_DAI, 10000000000),
  CurrencyAmount.fromRawAmount(TEST_CHAIN_WETH, 10000000000)
);

export const WBTC_WETH = new Pair(
  CurrencyAmount.fromRawAmount(TEST_CHAIN_WBTC, 10000000000),
  CurrencyAmount.fromRawAmount(TEST_CHAIN_WETH, 10000000000)
);

export const poolToV3SubgraphPool = (pool: V3Pool, idx: number | string): V3SubgraphPool => {
  return {
    id: idx.toString(),
    feeTier: pool.fee.toString(),
    liquidity: pool.liquidity.toString(),
    token0: {
      id: pool.token0.address,
    },
    token1: {
      id: pool.token1.address,
    },
    tvlETH: parseFloat(pool.liquidity.toString()),
    tvlUSD: parseFloat(pool.liquidity.toString()),
  };
};

export const pairToV2SubgraphPool = (pool: Pair, idx: number | string): V2SubgraphPool => {
  return {
    id: idx.toString(),
    token0: {
      id: pool.token0.address,
    },
    token1: {
      id: pool.token1.address,
    },
    reserve: 1000,
    supply: 100,
    reserveUSD: 100,
  };
};

export const buildMockV3PoolAccessor: (pools: V3Pool[]) => V3PoolAccessor = (pools: V3Pool[]) => {
  return {
    getAllPools: () => pools,
    getPoolByAddress: (address: string) =>
      _.find(
        pools,
        (p) =>
          V3Pool.getAddress(
            p.token0,
            p.token1,
            p.fee,
            POOL_INIT_CODE_HASH_MAP[TEST_CHAIN_ID],
            V3_CORE_FACTORY_ADDRESSES[TEST_CHAIN_ID]
          ).toLowerCase() == address.toLowerCase()
      ),
    getPool: (tokenA, tokenB, fee) =>
      _.find(
        pools,
        (p) =>
          V3Pool.getAddress(
            p.token0,
            p.token1,
            p.fee,
            POOL_INIT_CODE_HASH_MAP[TEST_CHAIN_ID],
            V3_CORE_FACTORY_ADDRESSES[TEST_CHAIN_ID]
          ) == V3Pool.getAddress(tokenA, tokenB, fee)
      ),
  };
};

export const buildMockV2PoolAccessor: (pools: Pair[]) => V2PoolAccessor = (pools: Pair[]) => {
  return {
    getAllPools: () => pools,
    getPoolByAddress: (address: string) =>
      _.find(
        pools,
        (p) => Pair.getAddress(p.token0, p.token1).toLowerCase() == address.toLowerCase()
      ),
    getPool: (tokenA, tokenB) =>
      _.find(pools, (p) => Pair.getAddress(p.token0, p.token1) == Pair.getAddress(tokenA, tokenB)),
  };
};

export const buildMockTokenAccessor: (tokens: Token[]) => TokenAccessor = (tokens) => {
  return {
    getAllTokens: () => tokens,
    getTokenByAddress: (address) =>
      _.find(tokens, (t) => t.address.toLowerCase() == address.toLowerCase()),
    getTokenBySymbol: (symbol) =>
      _.find(tokens, (t) => t.symbol!.toLowerCase() == symbol.toLowerCase()),
  };
};

// export const mockTokenList: TokenList = {
//   name: 'Tokens',
//   timestamp: '2021-01-05T20:47:02.923Z',
//   version: {
//     major: 1,
//     minor: 0,
//     patch: 0,
//   },
//   tags: {},
//   logoURI: 'ipfs://QmNa8mQkrNKp1WEEeGjFezDmDeodkWRevGFN8JCV7b4Xir',
//   keywords: ['uniswap'],
//   tokens: [
//     {
//       name: 'USDC',
//       address: USDC_BASE.address,
//       symbol: 'USDC',
//       decimals: 6,
//       chainId: TEST_CHAIN_ID,
//       logoURI: '',
//     },
//     // {
//     //   name: 'USDT',
//     //   address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
//     //   symbol: 'USDT',
//     //   decimals: 6,
//     //   chainId:  testChainid,
//     //   logoURI: '',
//     // },
//     {
//       name: 'DAI',
//       address: DAI_BASE.address,
//       symbol: 'DAI',
//       decimals: 18,
//       chainId: TEST_CHAIN_ID,
//       logoURI: '',
//     },
//     {
//       name: 'USDT',
//       address: '0x110a13FC3efE6A245B50102D2d79B3E76125Ae83',
//       symbol: 'USDT',
//       decimals: 18,
//       chainId: 2,
//       logoURI: '',
//     },
//     {
//       name: 'WBTC',
//       address: '0x577D296678535e4903D59A4C929B718e1D575e0A',
//       symbol: 'WBTC',
//       decimals: 18,
//       chainId: 777,
//       logoURI: '',
//     },
//   ],
// };

export const PORTION_BIPS = 12;
export const PORTION_RECIPIENT = '0xd8da6bf26964af9d7eed9e03e53415d37aa96045';
export const PORTION_TYPE = 'flat';

export type Portion = {
  bips: number;
  recipient: string;
  type: string;
};

export const FLAT_PORTION: Portion = {
  bips: PORTION_BIPS,
  recipient: PORTION_RECIPIENT,
  type: PORTION_TYPE,
};

export const GREENLIST_TOKEN_PAIRS: Array<[Currency, Currency]> = [
  [Ether.onChain(TEST_CHAIN_ID), TEST_CHAIN_USDC],
  [WRAPPED_NATIVE_CURRENCY[TEST_CHAIN_ID], TEST_CHAIN_USDC],
  [TEST_CHAIN_DAI, TEST_CHAIN_WBTC],
];

export const GREENLIST_CARVEOUT_PAIRS: Array<[Currency, Currency]> = [
  [TEST_CHAIN_USDC, TEST_CHAIN_DAI],
  [WRAPPED_NATIVE_CURRENCY[TEST_CHAIN_ID], Ether.onChain(TEST_CHAIN_ID)],
];
