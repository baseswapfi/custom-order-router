import { Protocol } from '@baseswapfi/router-sdk';
import { ChainId, SUBGRAPH_URL_MAP, SupportedChainsType, Token } from '@baseswapfi/sdk-core';

import { ProviderConfig } from '../provider';
import { SubgraphProvider } from '../subgraph-provider';

export interface V3SubgraphPool {
  id: string;
  feeTier: string;
  liquidity: string;
  token0: {
    id: string;
  };
  token1: {
    id: string;
  };
  tvlETH: number;
  tvlUSD: number;
}

export type V3RawSubgraphPool = {
  id: string;
  feeTier: string;
  liquidity: string;
  token0: {
    symbol: string;
    id: string;
  };
  token1: {
    symbol: string;
    id: string;
  };
  totalValueLockedUSD: string;
  totalValueLockedETH: string;
  totalValueLockedUSDUntracked: string;
};

/**
 * Provider for getting V3 pools from the Subgraph
 *
 * @export
 * @interface IV3SubgraphProvider
 */
export interface IV3SubgraphProvider {
  getPools(
    tokenIn?: Token,
    tokenOut?: Token,
    providerConfig?: ProviderConfig
  ): Promise<V3SubgraphPool[]>;
}

export class V3SubgraphProvider
  extends SubgraphProvider<V3RawSubgraphPool, V3SubgraphPool>
  implements IV3SubgraphProvider
{
  constructor(
    chainId: ChainId,
    retries = 2,
    timeout = 30000,
    rollback = true,
    trackedEthThreshold = 0.01,
    untrackedUsdThreshold = Number.MAX_VALUE,
    subgraphUrlOverride?: string
  ) {
    super(
      Protocol.V3,
      chainId,
      retries,
      timeout,
      rollback,
      trackedEthThreshold,
      untrackedUsdThreshold,
      subgraphUrlOverride ?? SUBGRAPH_URL_MAP[chainId as SupportedChainsType]
    );
  }

  protected override subgraphQuery(blockNumber?: number): string {
    return `
    query getPools($pageSize: Int!, $id: String) {
      pools(
        first: $pageSize
        ${blockNumber ? `block: { number: ${blockNumber} }` : ``}
          where: { id_gt: $id }
        ) {
          id
          token0 {
            symbol
            id
          }
          token1 {
            symbol
            id
          }
          feeTier
          liquidity
          totalValueLockedUSD
          totalValueLockedETH
          totalValueLockedUSDUntracked
        }
      }
   `;
  }

  protected override mapSubgraphPool(rawPool: V3RawSubgraphPool): V3SubgraphPool {
    return {
      id: rawPool.id,
      feeTier: rawPool.feeTier,
      liquidity: rawPool.liquidity,
      token0: {
        id: rawPool.token0.id,
      },
      token1: {
        id: rawPool.token1.id,
      },
      tvlETH: parseFloat(rawPool.totalValueLockedETH),
      tvlUSD: parseFloat(rawPool.totalValueLockedUSD),
    };
  }
}
