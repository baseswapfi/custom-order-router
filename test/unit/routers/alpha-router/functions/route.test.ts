import {
  AlphaRouterConfig,
  CachedRoute,
  CachedRoutes,
  MixedRoute,
  shouldWipeoutCachedRoutes,
} from '../../../../../src';
import { Protocol } from '@baseswapfi/router-sdk';
import { ChainId, TradeType } from '@baseswapfi/sdk-core';
import {
  TEST_CHAIN_DAI,
  TEST_CHAIN_ID,
  TEST_CHAIN_USDC,
  USDC_DAI,
  USDC_DAI_LOW,
  USDC_DAI_MEDIUM,
} from '../../../../test-util/mock-data';
import { DEFAULT_ROUTING_CONFIG_BY_CHAIN } from '../../../../../src/routers/alpha-router/config';

xdescribe('routes', () => {
  const mixedRoutes1 = new MixedRoute([USDC_DAI, USDC_DAI_LOW], TEST_CHAIN_USDC, TEST_CHAIN_DAI);
  const cachedRoute1 = new CachedRoute({
    route: mixedRoutes1,
    percent: 50,
  });
  const mixedRoutes2 = new MixedRoute([USDC_DAI_LOW], TEST_CHAIN_USDC, TEST_CHAIN_DAI);
  const cachedRoute2 = new CachedRoute({
    route: mixedRoutes2,
    percent: 50,
  });
  const mixedRoutes3 = new MixedRoute(
    [USDC_DAI, USDC_DAI_LOW, USDC_DAI_MEDIUM],
    TEST_CHAIN_USDC,
    TEST_CHAIN_DAI
  );
  const cachedRoute3 = new CachedRoute({
    route: mixedRoutes3,
    percent: 50,
  });

  // const cachedRoutesIncludeRouteWithV4Pool = new CachedRoutes({
  //   routes: [cachedRoute1, cachedRoute2],
  //   chainId: TEST_CHAIN_ID,
  //   currencyIn: TEST_CHAIN_USDC,
  //   currencyOut: TEST_CHAIN_DAI,
  //   protocolsCovered: [Protocol.V2, Protocol.V3, Protocol.MIXED],
  //   blockNumber: 1,
  //   tradeType: TradeType.EXACT_INPUT,
  //   originalAmount: '100',
  //   blocksToLive: 100,
  // });

  const cachedRoutesIncludeRouteWithoutV4Pool = new CachedRoutes({
    routes: [cachedRoute1, cachedRoute3],
    chainId: TEST_CHAIN_ID,
    currencyIn: TEST_CHAIN_USDC,
    currencyOut: TEST_CHAIN_DAI,
    protocolsCovered: [Protocol.V2, Protocol.V3, Protocol.MIXED],
    blockNumber: 1,
    tradeType: TradeType.EXACT_INPUT,
    originalAmount: '100',
    blocksToLive: 100,
  });

  test(`do not exclude any cached route for empty excluded protocols list`, async () => {
    const routingConfig: AlphaRouterConfig = {
      // @ts-ignore[TS7053] - complaining about switch being non exhaustive
      ...DEFAULT_ROUTING_CONFIG_BY_CHAIN[TEST_CHAIN_ID],
      protocols: [Protocol.V2, Protocol.V3, Protocol.MIXED],
      excludedProtocolsFromMixed: [],
      optimisticCachedRoutes: false,
    };

    expect(
      shouldWipeoutCachedRoutes(cachedRoutesIncludeRouteWithoutV4Pool, routingConfig)
    ).toBeFalsy();
  });

  // test(`do not exclude cached route for V4 protocol`, async () => {
  //   const routingConfig: AlphaRouterConfig = {
  //     // @ts-ignore[TS7053] - complaining about switch being non exhaustive
  //     ...DEFAULT_ROUTING_CONFIG_BY_CHAIN[ChainId.MAINNET],
  //     protocols: [Protocol.V2, Protocol.V3, Protocol.V4, Protocol.MIXED],
  //     excludedProtocolsFromMixed: [Protocol.V4],
  //     optimisticCachedRoutes: false,
  //   };
  //   expect(shouldWipeoutCachedRoutes(cachedRoutesIncludeRouteWithoutV4Pool, routingConfig)).toBeFalsy();
  // });
});
