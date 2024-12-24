import { Protocol } from '@baseswapfi/router-sdk';
import {
  ChainId,
  Currency,
  Percent,
  V3_CORE_FACTORY_ADDRESSES,
} from '@baseswapfi/sdk-core';
import { POOL_INIT_CODE_HASH_MAP, Pool as V3Pool } from '@baseswapfi/v3-sdk2';
import { Pair } from '@baseswapfi/v2-sdk';
import _ from 'lodash';

import {
  AlphaRouterConfig,
  RouteWithValidQuote,
} from '../routers/alpha-router';
import { MixedRoute, SupportedRoutes } from '../routers/router';

import { CurrencyAmount, log } from '.';
import { CachedRoutes } from '../providers';

export const routeToTokens = (route: SupportedRoutes): Currency[] => {
  switch (route.protocol) {
    case Protocol.V3:
      return route.tokenPath;
    case Protocol.V2:
    case Protocol.MIXED:
      return route.path;
    default:
      throw new Error(`Unsupported route ${JSON.stringify(route)}`);
  }
};

export const routeToPools = (route: SupportedRoutes): (V3Pool | Pair)[] => {
  log.info('routeToPools', { route });
  switch (route.protocol) {
    case Protocol.V3:
    case Protocol.MIXED:
      return route.pools as (V3Pool | Pair)[];
    case Protocol.V2:
      return route.pairs;
    default:
      throw new Error(`Unsupported route ${JSON.stringify(route)}`);
  }
};

export const poolToString = (p: V3Pool | Pair): string => {
  return `${p.token0.symbol}/${p.token1.symbol}${
    p instanceof V3Pool ? `/${p.fee / 10000}%` : ``
  }`;
};

export const routeToString = (route: SupportedRoutes): string => {
  const routeStr = [];
  const tokens = routeToTokens(route);
  const tokenPath = _.map(tokens, (token) => `${token.symbol}`);
  const pools = routeToPools(route);
  const poolFeePath = _.map(pools, (pool) => {
    if (pool instanceof Pair) {
      return ` -- [${Pair.getAddress(
        (pool as Pair).token0,
        (pool as Pair).token1
      )}]`;
    } else if (pool instanceof V3Pool) {
      return ` -- ${pool.fee / 10000}% [${V3Pool.getAddress(
        pool.token0,
        pool.token1,
        pool.fee,
        POOL_INIT_CODE_HASH_MAP[pool.chainId as ChainId],
        V3_CORE_FACTORY_ADDRESSES[pool.chainId]
      )}]`;
    } else {
      throw new Error(`Unsupported pool ${JSON.stringify(pool)}`);
    }
  });

  for (let i = 0; i < tokenPath.length; i++) {
    routeStr.push(tokenPath[i]);
    if (i < poolFeePath.length) {
      routeStr.push(poolFeePath[i]);
    }
  }

  return routeStr.join('');
};

export const routeAmountsToString = (
  routeAmounts: RouteWithValidQuote[]
): string => {
  const total = _.reduce(
    routeAmounts,
    (total: CurrencyAmount, cur: RouteWithValidQuote) => {
      return total.add(cur.amount);
    },
    CurrencyAmount.fromRawAmount(routeAmounts[0]!.amount.currency, 0)
  );

  const routeStrings = _.map(routeAmounts, ({ protocol, route, amount }) => {
    const portion = amount.divide(total);
    const percent = new Percent(portion.numerator, portion.denominator);
    /// @dev special case for MIXED routes we want to show user friendly V2+V3 instead
    return `[${
      protocol == Protocol.MIXED ? 'V2 + V3' : protocol
    }] ${percent.toFixed(2)}% = ${routeToString(route)}`;
  });

  return _.join(routeStrings, ', ');
};

export const routeAmountToString = (
  routeAmount: RouteWithValidQuote
): string => {
  const { route, amount } = routeAmount;
  return `${amount.toExact()} = ${routeToString(route)}`;
};

export function shouldWipeoutCachedRoutes(
  cachedRoutes?: CachedRoutes,
  routingConfig?: AlphaRouterConfig
): boolean {
  // In case of optimisticCachedRoutes, we don't want to wipe out the cache
  // This is because the upstream client will indicate that it's a perf sensitive (likely online) request,
  // such that we should still use the cached routes.
  // In case of routing-api,
  // when intent=quote, optimisticCachedRoutes will be true, it means it's an online quote request, and we should use the cached routes.
  // when intent=caching, optimisticCachedRoutes will be false, it means it's an async routing lambda invocation for the benefit of
  // non-perf-sensitive, so that we can nullify the retrieved cached routes, if certain condition meets.
  if (routingConfig?.optimisticCachedRoutes) {
    return false;
  }

  const containsExcludedProtocolPools = cachedRoutes?.routes.find((route) => {
    switch (route.protocol) {
      case Protocol.MIXED:
        return (
          (route.route as MixedRoute).pools.filter((pool) => {
            return poolIsInExcludedProtocols(
              pool as V3Pool | Pair,
              routingConfig?.excludedProtocolsFromMixed
            );
          }).length > 0
        );
      default:
        return false;
    }
  });

  return containsExcludedProtocolPools !== undefined;
}

export function excludeProtocolPoolRouteFromMixedRoute(
  mixedRoutes: MixedRoute[],
  excludedProtocolsFromMixed?: Protocol[]
): MixedRoute[] {
  return mixedRoutes.filter((route) => {
    return (
      route.pools.filter((pool) => {
        return poolIsInExcludedProtocols(
          pool as V3Pool | Pair,
          excludedProtocolsFromMixed
        );
      }).length == 0
    );
  });
}

function poolIsInExcludedProtocols(
  pool: V3Pool | Pair,
  excludedProtocolsFromMixed?: Protocol[]
): boolean {
  if (pool instanceof V3Pool) {
    return excludedProtocolsFromMixed?.includes(Protocol.V3) ?? false;
  } else if (pool instanceof Pair) {
    return excludedProtocolsFromMixed?.includes(Protocol.V2) ?? false;
  } else {
    return false;
  }
}
