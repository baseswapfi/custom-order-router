import { Protocol } from '@baseswapfi/router-sdk';
import { ChainId, Token } from '@baseswapfi/sdk-core';

import { SubgraphPool } from '../routers/alpha-router/functions/get-candidate-pools';
import { WRAPPED_NATIVE_CURRENCY } from '../util';

import { ICache } from './cache';
import { ProviderConfig } from './provider';
import {
  ARB_ARBITRUM,
  cbBTC_BASE,
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
  USDT_MODE,
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
} from './token-provider';
import { V3SubgraphPool } from './v3/subgraph-provider';

type ChainTokenList = {
  readonly [chainId in ChainId]?: Token[];
};

export const BASES_TO_CHECK_TRADES_AGAINST: ChainTokenList = {
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
  [ChainId.BASE]: [WRAPPED_NATIVE_CURRENCY[ChainId.BASE]!, USDC_BASE, USDT_BASE, DAI_BASE, cbBTC_BASE],
  [ChainId.MODE]: [WRAPPED_NATIVE_CURRENCY[ChainId.MODE], USDC_MODE, DAI_MODE, WBTC_MODE, USDT_MODE],
  // [ChainId.SONIC_TESTNET]: [WRAPPED_NATIVE_CURRENCY[ChainId.SONIC_TESTNET]],
  [ChainId.SONEIUM_TESTNET]: [WRAPPED_NATIVE_CURRENCY[ChainId.SONEIUM_TESTNET], USDC_SONEIUM_TESTNET],
};

export interface IV3SubgraphProvider {
  getPools(tokenIn?: Token, tokenOut?: Token, providerConfig?: ProviderConfig): Promise<V3SubgraphPool[]>;
}

export interface ISubgraphProvider<TSubgraphPool extends SubgraphPool> {
  getPools(tokenIn?: Token, tokenOut?: Token, providerConfig?: ProviderConfig): Promise<TSubgraphPool[]>;
}

export abstract class CachingSubgraphProvider<TSubgraphPool extends SubgraphPool>
  implements ISubgraphProvider<TSubgraphPool>
{
  private SUBGRAPH_KEY = (chainId: ChainId) => `subgraph-pools-${this.protocol}-${chainId}`;

  /**
   * Creates an instance of CachingV3SubgraphProvider.
   * @param chainId The chain id to use.
   * @param subgraphProvider The provider to use to get the subgraph pools when not in the cache.
   * @param cache Cache instance to hold cached pools.
   * @param protocol Subgraph protocol version
   */
  constructor(
    private chainId: ChainId,
    protected subgraphProvider: ISubgraphProvider<TSubgraphPool>,
    private cache: ICache<TSubgraphPool[]>,
    private protocol: Protocol
  ) {}

  public async getPools(): Promise<TSubgraphPool[]> {
    const cachedPools = await this.cache.get(this.SUBGRAPH_KEY(this.chainId));

    if (cachedPools) {
      return cachedPools;
    }

    const pools = await this.subgraphProvider.getPools();

    await this.cache.set(this.SUBGRAPH_KEY(this.chainId), pools);

    return pools;
  }
}
