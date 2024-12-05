/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { ChainId, Token } from '@baseswapfi/sdk-core';
import { FeeAmount, Pool } from '@baseswapfi/v3-sdk2';
import JSBI from 'jsbi';
import _ from 'lodash';

import { unparseFeeAmount } from '../../util/amounts';
import { WRAPPED_NATIVE_CURRENCY } from '../../util/chains';
import { log } from '../../util/log';
import { ProviderConfig } from '../provider';
import {
  ARB_ARBITRUM,
  cbBTC_BASE,
  DAI_ARBITRUM,
  DAI_OPTIMISM,
  OP_OPTIMISM,
  USDC_ARBITRUM,
  USDC_BASE,
  USDC_MODE,
  USDC_NATIVE_ARBITRUM,
  USDC_OPTIMISM,
  USDC_SONEIUM_TESTNET,
  USDC_WORLDCHAIN,
  USDT_ARBITRUM,
  USDT_BASE,
  USDT_MODE,
  USDT_OPTIMISM,
  USDT_SONEIUM_TESTNET,
  WBTC_ARBITRUM,
  WBTC_OPTIMISM,
  WBTC_SONEIUM_TESTNET,
  WBTC_WORLDCHAIN,
  WLD_WORLDCHAIN,
} from '../token-provider';

import { IV3PoolProvider } from './pool-provider';
import { IV3SubgraphProvider, V3SubgraphPool } from './subgraph-provider';

type ChainTokenList = {
  readonly [chainId in ChainId]?: Token[];
};

const BASES_TO_CHECK_TRADES_AGAINST: ChainTokenList = {
  [ChainId.OPTIMISM]: [
    WRAPPED_NATIVE_CURRENCY[ChainId.OPTIMISM]!,
    USDC_OPTIMISM,
    DAI_OPTIMISM,
    USDT_OPTIMISM,
    WBTC_OPTIMISM,
    OP_OPTIMISM,
  ],
  [ChainId.ARBITRUM]: [
    WRAPPED_NATIVE_CURRENCY[ChainId.ARBITRUM]!,
    WBTC_ARBITRUM,
    DAI_ARBITRUM,
    USDC_NATIVE_ARBITRUM,
    USDC_ARBITRUM,
    USDT_ARBITRUM,
    ARB_ARBITRUM,
  ],
  [ChainId.BASE]: [
    WRAPPED_NATIVE_CURRENCY[ChainId.BASE],
    USDC_BASE,
    cbBTC_BASE,
    USDT_BASE,
  ],
  [ChainId.MODE]: [WRAPPED_NATIVE_CURRENCY[ChainId.MODE], USDC_MODE, USDT_MODE],
  [ChainId.SONIC_TESTNET]: [WRAPPED_NATIVE_CURRENCY[ChainId.SONIC_TESTNET]],
  [ChainId.SONEIUM_TESTNET]: [
    WRAPPED_NATIVE_CURRENCY[ChainId.SONEIUM_TESTNET],
    USDC_SONEIUM_TESTNET,
    USDT_SONEIUM_TESTNET,
    WBTC_SONEIUM_TESTNET,
  ],
  [ChainId.WORLDCHAIN]: [
    WRAPPED_NATIVE_CURRENCY[ChainId.WORLDCHAIN]!,
    USDC_WORLDCHAIN,
    WLD_WORLDCHAIN,
    WBTC_WORLDCHAIN,
  ],
};

/**
 * Provider that uses a hardcoded list of V3 pools to generate a list of subgraph pools.
 *
 * Since the pools are hardcoded and the data does not come from the Subgraph, the TVL values
 * are dummys and should not be depended on.
 *
 * Useful for instances where other data sources are unavailable. E.g. Subgraph not available.
 *
 * @export
 * @class StaticV3SubgraphProvider
 */
export class StaticV3SubgraphProvider implements IV3SubgraphProvider {
  constructor(
    private chainId: ChainId,
    private poolProvider: IV3PoolProvider
  ) {}

  public async getPools(
    tokenIn?: Token,
    tokenOut?: Token,
    providerConfig?: ProviderConfig
  ): Promise<V3SubgraphPool[]> {
    log.info('In static subgraph provider for V3');
    const bases = BASES_TO_CHECK_TRADES_AGAINST[this.chainId];

    if (!bases) {
      throw new Error(
        `StaticV3SubgraphProvider: Missing BASES_TO_CHECK_TRADES_AGAINST for chainId: ${this.chainId}`
      );
    }

    const basePairs: [Token, Token][] = _.flatMap(
      bases,
      (base): [Token, Token][] => bases.map((otherBase) => [base, otherBase])
    );

    if (tokenIn && tokenOut) {
      basePairs.push(
        [tokenIn, tokenOut],
        ...bases.map((base): [Token, Token] => [tokenIn, base]),
        ...bases.map((base): [Token, Token] => [tokenOut, base])
      );
    }

    const pairs: [Token, Token, FeeAmount][] = _(basePairs)
      .filter((tokens): tokens is [Token, Token] =>
        Boolean(tokens[0] && tokens[1])
      )
      .filter(
        ([tokenA, tokenB]) =>
          tokenA.address !== tokenB.address && !tokenA.equals(tokenB)
      )
      .flatMap<[Token, Token, FeeAmount]>(([tokenA, tokenB]) => {
        return [
          [tokenA, tokenB, FeeAmount.LOWER_50],
          [tokenA, tokenB, FeeAmount.LOWEST],
          [tokenA, tokenB, FeeAmount.LOWER],
          [tokenA, tokenB, FeeAmount.LOW],
          [tokenA, tokenB, FeeAmount.MEDIUM],
          [tokenA, tokenB, FeeAmount.HIGH],
        ];
      })
      .value();

    log.info(
      `V3 Static subgraph provider about to get ${pairs.length} pools on-chain`
    );
    const poolAccessor = await this.poolProvider.getPools(
      pairs,
      providerConfig
    );
    const pools = poolAccessor.getAllPools();

    const poolAddressSet = new Set<string>();
    const subgraphPools: V3SubgraphPool[] = _(pools)
      .map((pool) => {
        const { token0, token1, fee, liquidity } = pool;

        const poolAddress = Pool.getAddress(pool.token0, pool.token1, pool.fee);

        if (poolAddressSet.has(poolAddress)) {
          return undefined;
        }
        poolAddressSet.add(poolAddress);

        const liquidityNumber = JSBI.toNumber(liquidity);

        return {
          id: poolAddress,
          feeTier: unparseFeeAmount(fee),
          liquidity: liquidity.toString(),
          token0: {
            id: token0.address,
          },
          token1: {
            id: token1.address,
          },
          // As a very rough proxy we just use liquidity for TVL.
          tvlETH: liquidityNumber,
          tvlUSD: liquidityNumber,
        };
      })
      .compact()
      .value();

    return subgraphPools;
  }
}
