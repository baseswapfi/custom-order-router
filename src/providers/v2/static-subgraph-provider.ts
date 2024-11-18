import { ChainId, Token } from '@baseswapfi/sdk-core';
import { Pair } from '@baseswapfi/v2-sdk';
import _ from 'lodash';

import { WRAPPED_NATIVE_CURRENCY } from '../../util/chains';
import { log } from '../../util/log';
import {
  ARB_ARBITRUM,
  // BTC_BNB,
  // BUSD_BNB,
  // CELO,
  // CEUR_CELO,
  // CUSD_CELO,
  DAI_ARBITRUM,
  DAI_BASE,
  DAI_MODE,
  // DAI_AVAX,
  // DAI_BNB,
  // DAI_CELO,
  // DAI_MAINNET,
  // DAI_MOONBEAM,
  DAI_OPTIMISM,
  // ETH_BNB,
  OP_OPTIMISM,
  // USDB_BLAST,
  // USDCE_ZKSYNC,
  USDC_ARBITRUM,
  // USDC_AVAX,
  USDC_BASE,
  USDC_MODE,
  // USDC_BNB,
  // USDC_MAINNET,
  // USDC_MOONBEAM,
  USDC_NATIVE_ARBITRUM,
  USDC_OPTIMISM,
  USDC_SONEIUM_TESTNET,
  // USDC_POLYGON,
  // USDC_ZKSYNC,
  USDT_ARBITRUM,
  USDT_BASE,
  // USDT_BNB,
  // USDT_MAINNET,
  USDT_OPTIMISM,
  WBTC_ARBITRUM,
  WBTC_MODE,
  // WBTC_MAINNET,
  // WBTC_MOONBEAM,
  WBTC_OPTIMISM,
  // WETH_POLYGON,
  // WMATIC_POLYGON,
  // WSTETH_MAINNET,
} from '../token-provider';

import { IV2SubgraphProvider, V2SubgraphPool } from './subgraph-provider';

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
    USDC_ARBITRUM,
    USDC_NATIVE_ARBITRUM,
    USDT_ARBITRUM,
    ARB_ARBITRUM,
  ],
  [ChainId.BASE]: [WRAPPED_NATIVE_CURRENCY[ChainId.BASE], USDC_BASE, USDT_BASE, DAI_BASE],
  [ChainId.MODE]: [WRAPPED_NATIVE_CURRENCY[ChainId.MODE], USDC_MODE, DAI_MODE, WBTC_MODE],
  // [ChainId.SONIC_TESTNET]: [WRAPPED_NATIVE_CURRENCY[ChainId.SONIC_TESTNET]],
  [ChainId.SONEIUM_TESTNET]: [WRAPPED_NATIVE_CURRENCY[ChainId.SONEIUM_TESTNET], USDC_SONEIUM_TESTNET],
};

/**
 * Provider that does not get data from an external source and instead returns
 * a hardcoded list of Subgraph pools.
 *
 * Since the pools are hardcoded, the liquidity/price values are dummys and should not
 * be depended on.
 *
 * Useful for instances where other data sources are unavailable. E.g. subgraph not available.
 *
 * @export
 * @class StaticV2SubgraphProvider
 */
export class StaticV2SubgraphProvider implements IV2SubgraphProvider {
  constructor(private chainId: ChainId) {}

  public async getPools(tokenIn?: Token, tokenOut?: Token): Promise<V2SubgraphPool[]> {
    log.info('In static subgraph provider for V2');
    const bases = BASES_TO_CHECK_TRADES_AGAINST[this.chainId];

    if (!bases) {
      throw new Error(`StaticV2SubgraphProvider: Missing BASES_TO_CHECK_TRADES_AGAINST for chainId: ${this.chainId}`);
    }

    const basePairs: [Token, Token][] = _.flatMap(bases, (base): [Token, Token][] =>
      bases.map((otherBase) => [base, otherBase])
    );

    if (tokenIn && tokenOut) {
      basePairs.push(
        [tokenIn, tokenOut],
        ...bases.map((base): [Token, Token] => [tokenIn, base]),
        ...bases.map((base): [Token, Token] => [tokenOut, base])
      );
    }

    const pairs: [Token, Token][] = _(basePairs)
      .filter((tokens): tokens is [Token, Token] => Boolean(tokens[0] && tokens[1]))
      .filter(([tokenA, tokenB]) => tokenA.address !== tokenB.address && !tokenA.equals(tokenB))
      .value();

    const poolAddressSet = new Set<string>();

    const subgraphPools: V2SubgraphPool[] = _(pairs)
      .map(([tokenA, tokenB]) => {
        const poolAddress = Pair.getAddress(tokenA, tokenB);

        if (poolAddressSet.has(poolAddress)) {
          return undefined;
        }
        poolAddressSet.add(poolAddress);

        const [token0, token1] = tokenA.sortsBefore(tokenB) ? [tokenA, tokenB] : [tokenB, tokenA];

        return {
          id: poolAddress,
          liquidity: '100',
          token0: {
            id: token0.address,
          },
          token1: {
            id: token1.address,
          },
          supply: 100,
          reserve: 100,
          reserveUSD: 100,
        };
      })
      .compact()
      .value();

    return subgraphPools;
  }
}
