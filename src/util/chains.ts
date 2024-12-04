import { ChainId, Ether, NativeCurrency, Token } from '@baseswapfi/sdk-core';

export const OP_STACKS_CHAINS = [
  ChainId.BASE,
  ChainId.BASE_GOERLI,
  ChainId.MODE,
  ChainId.OPTIMISM,
  ChainId.SONEIUM_TESTNET,
];
export const SUPPORTED_CHAINS: ChainId[] = [...OP_STACKS_CHAINS, ChainId.ARBITRUM, ChainId.SONIC_TESTNET];

export const V2_SUPPORTED = [...OP_STACKS_CHAINS, ChainId.SONIC_TESTNET];

export const MIXED_SUPPORTED = [ChainId.BASE];

export const HAS_L1_FEE = [...OP_STACKS_CHAINS, ChainId.ARBITRUM];

export const ID_TO_CHAIN_ID = (id: number): ChainId => {
  switch (id) {
    // case 1:
    //   return ChainId.MAINNET;
    // case 5:
    //   return ChainId.GOERLI;
    // case 11155111:
    //   return ChainId.SEPOLIA;
    // case 56:
    //   return ChainId.BNB;
    case 10:
      return ChainId.OPTIMISM;
    // case 420:
    //   return ChainId.OPTIMISM_GOERLI;
    // case 11155420:
    //   return ChainId.OPTIMISM_SEPOLIA;
    case 42161:
      return ChainId.ARBITRUM;
    // case 421613:
    //   return ChainId.ARBITRUM_GOERLI;
    // case 421614:
    //   return ChainId.ARBITRUM_SEPOLIA;
    // case 137:
    //   return ChainId.POLYGON;
    // case 80001:
    //   return ChainId.POLYGON_MUMBAI;
    // case 42220:
    //   return ChainId.CELO;
    // case 44787:
    //   return ChainId.CELO_ALFAJORES;
    // case 100:
    //   return ChainId.GNOSIS;
    // case 1284:
    //   return ChainId.MOONBEAM;
    // case 43114:
    //   return ChainId.AVALANCHE;
    case 8453:
      return ChainId.BASE;
    case 84531:
      return ChainId.BASE_GOERLI;
    // case 81457:
    //   return ChainId.BLAST;
    // case 7777777:
    //   return ChainId.ZORA;
    // case 324:
    //   return ChainId.ZKSYNC;
    case 1946:
      return ChainId.SONEIUM_TESTNET;
    case 64165:
      return ChainId.SONIC_TESTNET;
    default:
      throw new Error(`Unknown chain id: ${id}`);
  }
};

export enum ChainName {
  MAINNET = 'mainnet',
  GOERLI = 'goerli',
  SEPOLIA = 'sepolia',
  OPTIMISM = 'optimism-mainnet',
  OPTIMISM_GOERLI = 'optimism-goerli',
  OPTIMISM_SEPOLIA = 'optimism-sepolia',
  ARBITRUM_ONE = 'arbitrum-mainnet',
  ARBITRUM_GOERLI = 'arbitrum-goerli',
  ARBITRUM_SEPOLIA = 'arbitrum-sepolia',
  POLYGON = 'polygon-mainnet',
  POLYGON_MUMBAI = 'polygon-mumbai',
  CELO = 'celo-mainnet',
  CELO_ALFAJORES = 'celo-alfajores',
  GNOSIS = 'gnosis-mainnet',
  MOONBEAM = 'moonbeam-mainnet',
  BNB = 'bnb-mainnet',
  AVALANCHE = 'avalanche-mainnet',
  BASE = 'base-mainnet',
  BASE_GOERLI = 'base-goerli',
  MODE = 'mode-mainnet',
  MODE_TESTNET = 'mode-testnet',
  BLAST = 'blast-mainnet',
  ZORA = 'zora-mainnet',
  ZKSYNC = 'zksync-mainnet',
  SONIC_TESTNET = 'sonic-testnet',
  SONEIUM_TESTNET = 'soneium-testnet',
}

export enum NativeCurrencyName {
  // Strings match input for CLI
  ETHER = 'ETH',
  MATIC = 'MATIC',
  CELO = 'CELO',
  GNOSIS = 'XDAI',
  MOONBEAM = 'GLMR',
  BNB = 'BNB',
  AVALANCHE = 'AVAX',
  S = 'S',
}

export const NATIVE_NAMES_BY_ID: { [chainId: number]: string[] } = {
  [ChainId.BASE]: ['ETH', 'ETHER', '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'],
  [ChainId.MODE]: ['ETH', 'ETHER', '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'],
  // [ChainId.MAINNET]: [
  //   'ETH',
  //   'ETHER',
  //   '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
  // ],
  // [ChainId.GOERLI]: [
  //   'ETH',
  //   'ETHER',
  //   '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
  // ],
  // [ChainId.SEPOLIA]: [
  //   'ETH',
  //   'ETHER',
  //   '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
  // ],
  [ChainId.OPTIMISM]: ['ETH', 'ETHER', '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'],
  // [ChainId.OPTIMISM_GOERLI]: [
  //   'ETH',
  //   'ETHER',
  //   '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
  // ],
  // [ChainId.OPTIMISM_SEPOLIA]: [
  //   'ETH',
  //   'ETHER',
  //   '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
  // ],
  [ChainId.ARBITRUM]: ['ETH', 'ETHER', '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'],
  // [ChainId.ARBITRUM_GOERLI]: [
  //   'ETH',
  //   'ETHER',
  //   '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
  // ],
  // [ChainId.ARBITRUM_SEPOLIA]: [
  //   'ETH',
  //   'ETHER',
  //   '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
  // ],
  // [ChainId.POLYGON]: ['MATIC', '0x0000000000000000000000000000000000001010'],
  // [ChainId.POLYGON_MUMBAI]: [
  //   'MATIC',
  //   '0x0000000000000000000000000000000000001010',
  // ],
  // [ChainId.CELO]: ['CELO'],
  // [ChainId.CELO_ALFAJORES]: ['CELO'],
  // [ChainId.GNOSIS]: ['XDAI'],
  // [ChainId.MOONBEAM]: ['GLMR'],
  // [ChainId.BNB]: ['BNB', 'BNB', '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'],
  // [ChainId.AVALANCHE]: [
  //   'AVAX',
  //   'AVALANCHE',
  //   '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
  // ],
  // [ChainId.BLAST]: [
  //   'ETH',
  //   'ETHER',
  //   '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
  // ],
  // [ChainId.ZORA]: [
  //   'ETH',
  //   'ETHER',
  //   '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
  // ],
  // [ChainId.ZKSYNC]: [
  //   'ETH',
  //   'ETHER',
  //   '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
  // ],
  [ChainId.SONIC_TESTNET]: ['S', 'Sonic', '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'],
  [ChainId.SONEIUM_TESTNET]: ['ETH', 'ETHER', '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'],
};

export const NATIVE_CURRENCY: { [chainId: number]: NativeCurrencyName } = {
  [ChainId.BASE]: NativeCurrencyName.ETHER,
  [ChainId.MODE]: NativeCurrencyName.ETHER,
  // [ChainId.MAINNET]: NativeCurrencyName.ETHER,
  // [ChainId.GOERLI]: NativeCurrencyName.ETHER,
  // [ChainId.SEPOLIA]: NativeCurrencyName.ETHER,
  [ChainId.OPTIMISM]: NativeCurrencyName.ETHER,
  // [ChainId.OPTIMISM_GOERLI]: NativeCurrencyName.ETHER,
  // [ChainId.OPTIMISM_SEPOLIA]: NativeCurrencyName.ETHER,
  [ChainId.ARBITRUM]: NativeCurrencyName.ETHER,
  // [ChainId.ARBITRUM_GOERLI]: NativeCurrencyName.ETHER,
  // [ChainId.ARBITRUM_SEPOLIA]: NativeCurrencyName.ETHER,
  // [ChainId.POLYGON]: NativeCurrencyName.MATIC,
  // [ChainId.POLYGON_MUMBAI]: NativeCurrencyName.MATIC,
  // [ChainId.CELO]: NativeCurrencyName.CELO,
  // [ChainId.CELO_ALFAJORES]: NativeCurrencyName.CELO,
  // [ChainId.GNOSIS]: NativeCurrencyName.GNOSIS,
  // [ChainId.MOONBEAM]: NativeCurrencyName.MOONBEAM,
  // [ChainId.BNB]: NativeCurrencyName.BNB,
  // [ChainId.AVALANCHE]: NativeCurrencyName.AVALANCHE,
  // [ChainId.BLAST]: NativeCurrencyName.ETHER,
  // [ChainId.ZORA]: NativeCurrencyName.ETHER,
  // [ChainId.ZKSYNC]: NativeCurrencyName.ETHER,
  [ChainId.SONIC_TESTNET]: NativeCurrencyName.S,
  [ChainId.SONEIUM_TESTNET]: NativeCurrencyName.ETHER,
};

export const ID_TO_NETWORK_NAME = (id: number): ChainName => {
  switch (id) {
    case 1:
      return ChainName.MAINNET;
    case 5:
      return ChainName.GOERLI;
    case 11155111:
      return ChainName.SEPOLIA;
    case 56:
      return ChainName.BNB;
    case 10:
      return ChainName.OPTIMISM;
    case 420:
      return ChainName.OPTIMISM_GOERLI;
    case 11155420:
      return ChainName.OPTIMISM_SEPOLIA;
    case 42161:
      return ChainName.ARBITRUM_ONE;
    case 421613:
      return ChainName.ARBITRUM_GOERLI;
    case 421614:
      return ChainName.ARBITRUM_SEPOLIA;
    case 137:
      return ChainName.POLYGON;
    case 80001:
      return ChainName.POLYGON_MUMBAI;
    case 42220:
      return ChainName.CELO;
    case 44787:
      return ChainName.CELO_ALFAJORES;
    case 100:
      return ChainName.GNOSIS;
    case 1284:
      return ChainName.MOONBEAM;
    case 43114:
      return ChainName.AVALANCHE;
    case 8453:
      return ChainName.BASE;
    case 84531:
      return ChainName.BASE_GOERLI;
    case 81457:
      return ChainName.BLAST;
    case 7777777:
      return ChainName.ZORA;
    case 324:
      return ChainName.ZKSYNC;
    case 8453:
      return ChainName.BASE;
    case 84531:
      return ChainName.BASE_GOERLI;
    case 34443:
      return ChainName.MODE;
    case 919:
      return ChainName.MODE_TESTNET;
    case 1946:
      return ChainName.SONEIUM_TESTNET;
    case 64165:
      return ChainName.SONIC_TESTNET;
    default:
      throw new Error(`Unknown chain id: ${id}`);
  }
};

export const CHAIN_IDS_LIST = Object.values(ChainId).map((c) => c.toString()) as string[];

export const ID_TO_PROVIDER = (id: ChainId): string => {
  const rpc = process.env[`RPC_${id}`];
  if (!rpc) throw new Error(`Chain id: ${id} not supported`);
  return rpc;

  // switch (id) {
  //   case ChainId.BASE:
  //     return process.env.JSON_RPC_PROVIDER_BASE!;
  //   default:
  //     throw new Error(`Chain id: ${id} not supported`);
  // }
};

export const WRAPPED_NATIVE_CURRENCY: { [chainId in ChainId]: Token } = {
  [ChainId.BASE]: new Token(ChainId.BASE, '0x4200000000000000000000000000000000000006', 18, 'WETH', 'Wrapped Ether'),
  [ChainId.BASE_GOERLI]: new Token(
    ChainId.BASE_GOERLI,
    '0x4200000000000000000000000000000000000006',
    18,
    'WETH',
    'Wrapped Ether'
  ),
  [ChainId.SCROLL]: new Token(
    ChainId.SCROLL,
    '0x5300000000000000000000000000000000000004',
    18,
    'WETH',
    'Wrapped Ether'
  ),
  [ChainId.SCROLL_SEPOLIA]: new Token(
    ChainId.SCROLL_SEPOLIA,
    '0x5300000000000000000000000000000000000004',
    18,
    'WETH',
    'Wrapped Ether'
  ),
  [ChainId.OPTIMISM]: new Token(
    ChainId.OPTIMISM,
    '0x4200000000000000000000000000000000000006',
    18,
    'WETH',
    'Wrapped Ether'
  ),
  [ChainId.ARBITRUM]: new Token(
    ChainId.ARBITRUM,
    '0x82af49447d8a07e3bd95bd0d56f35241523fbab1',
    18,
    'WETH',
    'Wrapped Ether'
  ),
  [ChainId.MODE]: new Token(ChainId.MODE, '0x4200000000000000000000000000000000000006', 18, 'WETH', 'Wrapped Ether'),
  [ChainId.MODE_TESTNET]: new Token(
    ChainId.MODE_TESTNET,
    '0xeb72756ee12309Eae82a0deb9787e69f5b62949c',
    18,
    'WETH',
    'Wrapped Ether'
  ),
  [ChainId.FRAX_TESTNET]: new Token(
    ChainId.FRAX_TESTNET,
    '0x4200000000000000000000000000000000000006',
    18,
    'WETH',
    'Wrapped Ether'
  ),
  [ChainId.SONEIUM_TESTNET]: new Token(
    ChainId.SONEIUM_TESTNET,
    '0x4200000000000000000000000000000000000006',
    18,
    'WETH',
    'Wrapped Ether'
  ),
  [ChainId.SONIC_TESTNET]: new Token(
    ChainId.SONIC_TESTNET,
    '0x591E027153ED4e536275984e1b7573367e11dac4',
    18,
    'WST',
    'Wrapped Sonic'
  ),
  [ChainId.WORLDCHAIN]: new Token(
    ChainId.WORLDCHAIN,
    '0x4200000000000000000000000000000000000006',
    18,
    'WETH',
    'Wrapped Ether'
  ),
  [ChainId.UNICHAIN]: new Token(
    ChainId.UNICHAIN,
    '0x4200000000000000000000000000000000000006',
    18,
    'WETH',
    'Wrapped Ether'
  ),
};
export class ExtendedEther extends Ether {
  public get wrapped(): Token {
    if (this.chainId in WRAPPED_NATIVE_CURRENCY) {
      return WRAPPED_NATIVE_CURRENCY[this.chainId as ChainId];
    }
    throw new Error('Unsupported chain ID');
  }

  private static _cachedExtendedEther: {
    [chainId: number]: NativeCurrency;
  } = {};

  public static onChain(chainId: number): ExtendedEther {
    return this._cachedExtendedEther[chainId] ?? (this._cachedExtendedEther[chainId] = new ExtendedEther(chainId));
  }
}

const cachedNativeCurrency: { [chainId: number]: NativeCurrency } = {};

export function nativeOnChain(chainId: number): NativeCurrency {
  if (cachedNativeCurrency[chainId] != undefined) {
    return cachedNativeCurrency[chainId]!;
  } else {
    cachedNativeCurrency[chainId] = ExtendedEther.onChain(chainId);
  }

  return cachedNativeCurrency[chainId]!;
}
