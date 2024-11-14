import { Interface } from '@ethersproject/abi';
import { BigNumber } from '@ethersproject/bignumber';
import { parseBytes32String } from '@ethersproject/strings';
import { ChainId, Token } from '@baseswapfi/sdk-core';
import _ from 'lodash';

import { IERC20Metadata__factory } from '../types/v3/factories/IERC20Metadata__factory';
import { log, WRAPPED_NATIVE_CURRENCY } from '../util';

import { IMulticallProvider, Result } from './multicall-provider';
import { ProviderConfig } from './provider';

/**
 * Provider for getting token data.
 *
 * @export
 * @interface ITokenProvider
 */
export interface ITokenProvider {
  /**
   * Gets the token at each address. Any addresses that are not valid ERC-20 are ignored.
   *
   * @param addresses The token addresses to get.
   * @param [providerConfig] The provider config.
   * @returns A token accessor with methods for accessing the tokens.
   */
  getTokens(addresses: string[], providerConfig?: ProviderConfig): Promise<TokenAccessor>;
}

export type TokenAccessor = {
  getTokenByAddress(address: string): Token | undefined;
  getTokenBySymbol(symbol: string): Token | undefined;
  getAllTokens: () => Token[];
};

// Optimism

export const USDC_OPTIMISM = new Token(
  ChainId.OPTIMISM,
  '0x7F5c764cBc14f9669B88837ca1490cCa17c31607',
  6,
  'USDC',
  'USD//C'
);
export const USDC_NATIVE_OPTIMISM = new Token(
  ChainId.OPTIMISM,
  '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
  6,
  'USDC',
  'USD//C'
);
export const USDT_OPTIMISM = new Token(
  ChainId.OPTIMISM,
  '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58',
  6,
  'USDT',
  'Tether USD'
);
export const WBTC_OPTIMISM = new Token(
  ChainId.OPTIMISM,
  '0x68f180fcCe6836688e9084f035309E29Bf0A2095',
  8,
  'WBTC',
  'Wrapped BTC'
);
export const DAI_OPTIMISM = new Token(
  ChainId.OPTIMISM,
  '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1',
  18,
  'DAI',
  'Dai Stablecoin'
);
export const OP_OPTIMISM = new Token(
  ChainId.OPTIMISM,
  '0x4200000000000000000000000000000000000042',
  18,
  'OP',
  'Optimism'
);

// Base Tokens

export const USDC_BASE = new Token(
  ChainId.BASE,
  '0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA',
  6,
  'USDbC',
  'USD Base Coin'
);

export const USDC_NATIVE_BASE = new Token(
  ChainId.BASE,
  '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  6,
  'USDC',
  'USD Coin'
);

export const USD_PLUS_BASE = new Token(
  ChainId.BASE,
  '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  6,
  'USD+',
  'Overnight.fi USD+'
);

export const cbBTC_BASE = new Token(
  ChainId.BASE,
  '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf',
  8,
  'cbBTC',
  'Coinbase Bitcoin'
);

export const USDT_BASE = new Token(ChainId.MODE, '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2', 6, 'USDT', 'Tether USD');

export const DAI_BASE = new Token(
  ChainId.BASE,
  '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb',
  18,
  'DAI',
  'DAI Stablecoin'
);

// Base Goerli Tokens
export const USDC_BASE_GOERLI = new Token(
  ChainId.BASE_GOERLI,
  '0x7b4Adf64B0d60fF97D672E473420203D52562A84',
  6,
  'USDC',
  'USD Coin'
);

// Arbitrum

export const USDC_ARBITRUM = new Token(
  ChainId.ARBITRUM,
  '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8',
  6,
  'USDC',
  'USD//C'
);
export const USDT_ARBITRUM = new Token(
  ChainId.ARBITRUM,
  '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
  6,
  'USDT',
  'Tether USD'
);
export const WBTC_ARBITRUM = new Token(
  ChainId.ARBITRUM,
  '0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f',
  8,
  'WBTC',
  'Wrapped BTC'
);
export const DAI_ARBITRUM = new Token(
  ChainId.ARBITRUM,
  '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1',
  18,
  'DAI',
  'Dai Stablecoin'
);

export const ARB_ARBITRUM = new Token(
  ChainId.ARBITRUM,
  '0x912CE59144191C1204E64559FE8253a0e49E6548',
  18,
  'ARB',
  'Arbitrum'
);

export const USDC_NATIVE_ARBITRUM = new Token(
  ChainId.ARBITRUM,
  '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
  6,
  'USDC',
  'USD//C'
);

// MODE

export const USDC_MODE = new Token(ChainId.MODE, '0xd988097fb8612cc24eeC14542bC03424c656005f', 6, 'USDC', 'USDC');
export const USDT_MODE = new Token(ChainId.MODE, '0xf0F161fDA2712DB8b566946122a5af183995e2eD', 6, 'USDT', 'Tether USD');
export const DAI_MODE = new Token(
  ChainId.MODE,
  '0xE7798f023fC62146e8Aa1b36Da45fb70855a77Ea',
  18,
  'DAI',
  'Dai Stablecoin'
);
export const WBTC_MODE = new Token(
  ChainId.MODE,
  '0xcDd475325D6F564d27247D1DddBb0DAc6fA0a5CF',
  8,
  'WBTC',
  'Wrapped BTC'
);

// Soneium testnet

export const USDC_SONEIUM_TESTNET = new Token(
  ChainId.SONEIUM_TESTNET,
  '0xE9A198d38483aD727ABC8b0B1e16B2d338CF0391',
  6,
  'USDC',
  'USDC'
);

export const USDT_SONEIUM_TESTNET = new Token(
  ChainId.SONEIUM_TESTNET,
  '0xE4c743036C74026649C9Dc1b8C2Abb028BBf4C14',
  6,
  'USDT',
  'Tether USD'
);

export const wstETH_SONEIUM_TESTNET = new Token(
  ChainId.SONEIUM_TESTNET,
  '0x5717D6A621aA104b0b4cAd32BFe6AD3b659f269E',
  18,
  'wstETH',
  'Wrapped Staked Ether'
);

export const WBTC_SONEIUM_TESTNET = new Token(
  ChainId.SONEIUM_TESTNET,
  '0x32b8254f669a5fa56fd4acfa141ed7243eb767b5',
  8,
  'WBTC',
  'Wrapped BTC'
);

export class TokenProvider implements ITokenProvider {
  constructor(private chainId: ChainId, protected multicall2Provider: IMulticallProvider) {}

  private async getTokenSymbol(
    addresses: string[],
    providerConfig?: ProviderConfig
  ): Promise<{
    result: {
      blockNumber: BigNumber;
      results: Result<[string]>[];
    };
    isBytes32: boolean;
  }> {
    let result;
    let isBytes32 = false;

    try {
      result = await this.multicall2Provider.callSameFunctionOnMultipleContracts<undefined, [string]>({
        addresses,
        contractInterface: IERC20Metadata__factory.createInterface(),
        functionName: 'symbol',
        providerConfig,
      });
    } catch (error) {
      log.error({ addresses }, `TokenProvider.getTokenSymbol[string] failed with error ${error}. Trying with bytes32.`);

      const bytes32Interface = new Interface([
        {
          inputs: [],
          name: 'symbol',
          outputs: [
            {
              internalType: 'bytes32',
              name: '',
              type: 'bytes32',
            },
          ],
          stateMutability: 'view',
          type: 'function',
        },
      ]);

      try {
        result = await this.multicall2Provider.callSameFunctionOnMultipleContracts<undefined, [string]>({
          addresses,
          contractInterface: bytes32Interface,
          functionName: 'symbol',
          providerConfig,
        });
        isBytes32 = true;
      } catch (error) {
        log.fatal({ addresses }, `TokenProvider.getTokenSymbol[bytes32] failed with error ${error}.`);

        throw new Error('[TokenProvider.getTokenSymbol] Impossible to fetch token symbol.');
      }
    }

    return { result, isBytes32 };
  }

  private async getTokenDecimals(addresses: string[], providerConfig?: ProviderConfig) {
    return this.multicall2Provider.callSameFunctionOnMultipleContracts<undefined, [number]>({
      addresses,
      contractInterface: IERC20Metadata__factory.createInterface(),
      functionName: 'decimals',
      providerConfig,
    });
  }

  public async getTokens(_addresses: string[], providerConfig?: ProviderConfig): Promise<TokenAccessor> {
    const addressToToken: { [address: string]: Token } = {};
    const symbolToToken: { [symbol: string]: Token } = {};

    const addresses = _(_addresses)
      .map((address) => address.toLowerCase())
      .uniq()
      .value();

    if (addresses.length > 0) {
      const [symbolsResult, decimalsResult] = await Promise.all([
        this.getTokenSymbol(addresses, providerConfig),
        this.getTokenDecimals(addresses, providerConfig),
      ]);

      const isBytes32 = symbolsResult.isBytes32;
      const { results: symbols } = symbolsResult.result;
      const { results: decimals } = decimalsResult;

      for (let i = 0; i < addresses.length; i++) {
        const address = addresses[i]!;

        const symbolResult = symbols[i];
        const decimalResult = decimals[i];

        if (!symbolResult?.success || !decimalResult?.success) {
          log.info(
            {
              symbolResult,
              decimalResult,
            },
            `Dropping token with address ${address} as symbol or decimal are invalid`
          );
          continue;
        }

        const symbol = isBytes32 ? parseBytes32String(symbolResult.result[0]!) : symbolResult.result[0]!;
        const decimal = decimalResult.result[0]!;

        addressToToken[address.toLowerCase()] = new Token(this.chainId, address, decimal, symbol);
        symbolToToken[symbol.toLowerCase()] = addressToToken[address.toLowerCase()]!;
      }

      log.info(
        `Got token symbol and decimals for ${Object.values(addressToToken).length} out of ${
          addresses.length
        } tokens on-chain ${providerConfig ? `as of: ${providerConfig?.blockNumber}` : ''}`
      );
    }

    return {
      getTokenByAddress: (address: string): Token | undefined => {
        return addressToToken[address.toLowerCase()];
      },
      getTokenBySymbol: (symbol: string): Token | undefined => {
        return symbolToToken[symbol.toLowerCase()];
      },
      getAllTokens: (): Token[] => {
        return Object.values(addressToToken);
      },
    };
  }
}

export const DAI_ON = (chainId: ChainId): Token => {
  switch (chainId) {
    case ChainId.BASE:
      return DAI_BASE;
    case ChainId.MODE:
      return DAI_MODE;
    case ChainId.OPTIMISM:
      return DAI_OPTIMISM;
    case ChainId.ARBITRUM:
      return DAI_ARBITRUM;
    default:
      throw new Error(`Chain id: ${chainId} not supported`);
  }
};

export const USDT_ON = (chainId: ChainId): Token => {
  switch (chainId) {
    case ChainId.BASE:
      return USDT_BASE;
    case ChainId.MODE:
      return USDT_MODE;
    case ChainId.OPTIMISM:
      return USDT_OPTIMISM;
    case ChainId.ARBITRUM:
      return USDT_ARBITRUM;

    default:
      throw new Error(`Chain id: ${chainId} not supported`);
  }
};

export const USDC_ON = (chainId: ChainId): Token => {
  switch (chainId) {
    case ChainId.BASE:
      return USDC_BASE;
    case ChainId.BASE_GOERLI:
      return USDC_BASE_GOERLI;
    case ChainId.MODE:
      return USDC_MODE;
    case ChainId.OPTIMISM:
      return USDC_NATIVE_OPTIMISM;
    case ChainId.ARBITRUM:
      return USDC_ARBITRUM;

    case ChainId.SONEIUM_TESTNET:
      return USDC_SONEIUM_TESTNET;
    default:
      throw new Error(`Chain id: ${chainId} not supported`);
  }
};

export const WNATIVE_ON = (chainId: ChainId): Token => {
  return WRAPPED_NATIVE_CURRENCY[chainId];
};
