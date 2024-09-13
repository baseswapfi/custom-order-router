import { Protocol } from '@baseswapfi/router-sdk';
import { ChainId, Token, TradeType } from '@baseswapfi/sdk-core';
import { ADDRESS_ZERO, FeeAmount } from '@baseswapfi/v3-sdk2';
import _ from 'lodash';

import {
  ITokenListProvider,
  ITokenProvider,
  IV2PoolProvider,
  IV2SubgraphProvider,
  IV3PoolProvider,
  V2PoolAccessor,
  V2SubgraphPool,
  V3PoolAccessor,
  V3SubgraphPool,
} from '../../../providers';
import { metric, MetricLoggerUnit } from '../../../util/metric';
import { log } from '../../../util/log';
import { AlphaRouterConfig } from '../alpha-router';
import { parseFeeAmount } from '../../../util';

export type SubgraphPool = V2SubgraphPool | V3SubgraphPool;
export type CandidatePoolsBySelectionCriteria = {
  protocol: Protocol;
  selections: CandidatePoolsSelections;
};

export type V2CandidatePools = {
  poolAccessor: V2PoolAccessor;
  candidatePools: CandidatePoolsBySelectionCriteria;
  subgraphPools: V2SubgraphPool[];
};

export type V3CandidatePools = {
  poolAccessor: V3PoolAccessor;
  candidatePools: CandidatePoolsBySelectionCriteria;
  subgraphPools: V3SubgraphPool[];
};

export type SupportedCandidatePools = V2CandidatePools | V3CandidatePools;

/// Utility type for allowing us to use `keyof CandidatePoolsSelections` to map
export type CandidatePoolsSelections = {
  topByBaseWithTokenIn: SubgraphPool[];
  topByBaseWithTokenOut: SubgraphPool[];
  topByDirectSwapPool: SubgraphPool[];
  topByEthQuoteTokenPool: SubgraphPool[];
  topByTVL: SubgraphPool[];
  topByTVLUsingTokenIn: SubgraphPool[];
  topByTVLUsingTokenOut: SubgraphPool[];
  topByTVLUsingTokenInSecondHops: SubgraphPool[];
  topByTVLUsingTokenOutSecondHops: SubgraphPool[];
};

export type CrossLiquidityCandidatePools = {
  v2Pools: V2SubgraphPool[];
  v3Pools: V3SubgraphPool[];
};

export type MixedCandidatePools = {
  V2poolAccessor: V2PoolAccessor;
  V3poolAccessor: V3PoolAccessor;
  candidatePools: CandidatePoolsBySelectionCriteria;
  subgraphPools: SubgraphPool[];
};

export type MixedRouteGetCandidatePoolsParams = {
  v3CandidatePools: V3CandidatePools;
  v2CandidatePools: V2CandidatePools;
  crossLiquidityPools: CrossLiquidityCandidatePools;
  routingConfig: AlphaRouterConfig;
  tokenProvider: ITokenProvider;
  v2poolProvider: IV2PoolProvider;
  v3poolProvider: IV3PoolProvider;
  blockedTokenListProvider?: ITokenListProvider;
  chainId: ChainId;
};

export async function getMixedRouteCandidatePools({
  v3CandidatePools,
  v2CandidatePools,
  crossLiquidityPools,
  routingConfig,
  tokenProvider,
  v3poolProvider,
  v2poolProvider,
}: MixedRouteGetCandidatePoolsParams): Promise<MixedCandidatePools> {
  const beforeSubgraphPools = Date.now();
  const [
    { subgraphPools: V3subgraphPools, candidatePools: V3candidatePools },
    { subgraphPools: V2subgraphPools, candidatePools: V2candidatePools },
  ] = [v3CandidatePools, v2CandidatePools];

  // Injects the liquidity pools found by the getMixedCrossLiquidityCandidatePools function
  V2subgraphPools.push(...crossLiquidityPools.v2Pools);
  V3subgraphPools.push(...crossLiquidityPools.v3Pools);

  metric.putMetric(
    'MixedSubgraphPoolsLoad',
    Date.now() - beforeSubgraphPools,
    MetricLoggerUnit.Milliseconds
  );
  const beforePoolsFiltered = Date.now();

  /**
   * Main heuristic for pruning mixedRoutes:
   * - we pick V2 pools with higher liq than respective V3 pools, or if the v3 pool doesn't exist
   *
   * This way we can reduce calls to our provider since it's possible to generate a lot of mixed routes
   */
  /// We only really care about pools involving the tokenIn or tokenOut explictly,
  /// since there's no way a long tail token in V2 would be routed through as an intermediary
  const V2topByTVLPoolIds = new Set(
    [
      ...V2candidatePools.selections.topByTVLUsingTokenIn,
      ...V2candidatePools.selections.topByBaseWithTokenIn,
      /// tokenOut:
      ...V2candidatePools.selections.topByTVLUsingTokenOut,
      ...V2candidatePools.selections.topByBaseWithTokenOut,
      /// Direct swap:
      ...V2candidatePools.selections.topByDirectSwapPool,
      // Cross Liquidity (has to be added to be considered):
      ...crossLiquidityPools.v2Pools,
    ].map((poolId) => poolId.id)
  );

  const V2topByTVLSortedPools = _(V2subgraphPools)
    .filter((pool) => V2topByTVLPoolIds.has(pool.id))
    .sortBy((pool) => -pool.reserveUSD)
    .value();

  /// we consider all returned V3 pools for this heuristic to "fill in the gaps"
  const V3sortedPools = _(V3subgraphPools)
    .sortBy((pool) => -pool.tvlUSD)
    .value();

  /// Finding pools with greater reserveUSD on v2 than tvlUSD on v3, or if there is no v3 liquidity
  const buildV2Pools: V2SubgraphPool[] = [];
  V2topByTVLSortedPools.forEach((V2subgraphPool) => {
    const V3subgraphPool = V3sortedPools.find(
      (pool) =>
        (pool.token0.id == V2subgraphPool.token0.id &&
          pool.token1.id == V2subgraphPool.token1.id) ||
        (pool.token0.id == V2subgraphPool.token1.id && pool.token1.id == V2subgraphPool.token0.id)
    );

    if (V3subgraphPool) {
      if (V2subgraphPool.reserveUSD > V3subgraphPool.tvlUSD) {
        log.info(
          {
            token0: V2subgraphPool.token0.id,
            token1: V2subgraphPool.token1.id,
            v2reserveUSD: V2subgraphPool.reserveUSD,
            v3tvlUSD: V3subgraphPool.tvlUSD,
          },
          `MixedRoute heuristic, found a V2 pool with higher liquidity than its V3 counterpart`
        );
        buildV2Pools.push(V2subgraphPool);
      }
    } else {
      log.info(
        {
          token0: V2subgraphPool.token0.id,
          token1: V2subgraphPool.token1.id,
          v2reserveUSD: V2subgraphPool.reserveUSD,
        },
        `MixedRoute heuristic, found a V2 pool with no V3 counterpart`
      );
      buildV2Pools.push(V2subgraphPool);
    }
  });

  log.info(buildV2Pools.length, `Number of V2 candidate pools that fit first heuristic`);

  const subgraphPools = [...buildV2Pools, ...V3sortedPools];

  const tokenAddresses = _(subgraphPools)
    .flatMap((subgraphPool) => [subgraphPool.token0.id, subgraphPool.token1.id])
    .compact()
    .uniq()
    .value();

  log.info(
    `Getting the ${tokenAddresses.length} tokens within the ${subgraphPools.length} pools we are considering`
  );

  const tokenAccessor = await tokenProvider.getTokens(tokenAddresses, routingConfig);

  const V3tokenPairsRaw = _.map<V3SubgraphPool, [Token, Token, FeeAmount] | undefined>(
    V3sortedPools,
    (subgraphPool) => {
      const tokenA = tokenAccessor.getTokenByAddress(subgraphPool.token0.id);
      const tokenB = tokenAccessor.getTokenByAddress(subgraphPool.token1.id);
      let fee: FeeAmount;
      try {
        fee = parseFeeAmount(subgraphPool.feeTier);
      } catch (err) {
        log.info(
          { subgraphPool },
          `Dropping candidate pool for ${subgraphPool.token0.id}/${subgraphPool.token1.id}/${subgraphPool.feeTier} because fee tier not supported`
        );
        return undefined;
      }

      if (!tokenA || !tokenB) {
        log.info(
          `Dropping candidate pool for ${subgraphPool.token0.id}/${
            subgraphPool.token1.id
          }/${fee} because ${
            tokenA ? subgraphPool.token1.id : subgraphPool.token0.id
          } not found by token provider`
        );
        return undefined;
      }

      return [tokenA, tokenB, fee];
    }
  );

  const V3tokenPairs = _.compact(V3tokenPairsRaw);

  const V2tokenPairsRaw = _.map<V2SubgraphPool, [Token, Token] | undefined>(
    buildV2Pools,
    (subgraphPool) => {
      const tokenA = tokenAccessor.getTokenByAddress(subgraphPool.token0.id);
      const tokenB = tokenAccessor.getTokenByAddress(subgraphPool.token1.id);

      if (!tokenA || !tokenB) {
        log.info(`Dropping candidate pool for ${subgraphPool.token0.id}/${subgraphPool.token1.id}`);
        return undefined;
      }

      return [tokenA, tokenB];
    }
  );

  const V2tokenPairs = _.compact(V2tokenPairsRaw);

  metric.putMetric(
    'MixedPoolsFilterLoad',
    Date.now() - beforePoolsFiltered,
    MetricLoggerUnit.Milliseconds
  );

  const beforePoolsLoad = Date.now();

  const [V2poolAccessor, V3poolAccessor] = await Promise.all([
    v2poolProvider.getPools(V2tokenPairs, routingConfig),
    v3poolProvider.getPools(V3tokenPairs, routingConfig),
  ]);

  metric.putMetric('MixedPoolsLoad', Date.now() - beforePoolsLoad, MetricLoggerUnit.Milliseconds);

  /// @dev a bit tricky here since the original V2CandidateSelections object included pools that we may have dropped
  /// as part of the heuristic. We need to reconstruct a new object with the v3 pools too.
  const buildPoolsBySelection = (key: keyof CandidatePoolsSelections) => {
    return [
      ...buildV2Pools.filter((pool) =>
        V2candidatePools.selections[key].map((p) => p.id).includes(pool.id)
      ),
      ...V3candidatePools.selections[key],
    ];
  };

  const poolsBySelection: CandidatePoolsBySelectionCriteria = {
    protocol: Protocol.MIXED,
    selections: {
      topByBaseWithTokenIn: buildPoolsBySelection('topByBaseWithTokenIn'),
      topByBaseWithTokenOut: buildPoolsBySelection('topByBaseWithTokenOut'),
      topByDirectSwapPool: buildPoolsBySelection('topByDirectSwapPool'),
      topByEthQuoteTokenPool: buildPoolsBySelection('topByEthQuoteTokenPool'),
      topByTVL: buildPoolsBySelection('topByTVL'),
      topByTVLUsingTokenIn: buildPoolsBySelection('topByTVLUsingTokenIn'),
      topByTVLUsingTokenOut: buildPoolsBySelection('topByTVLUsingTokenOut'),
      topByTVLUsingTokenInSecondHops: buildPoolsBySelection('topByTVLUsingTokenInSecondHops'),
      topByTVLUsingTokenOutSecondHops: buildPoolsBySelection('topByTVLUsingTokenOutSecondHops'),
    },
  };

  return {
    V2poolAccessor,
    V3poolAccessor,
    candidatePools: poolsBySelection,
    subgraphPools,
  };
}
