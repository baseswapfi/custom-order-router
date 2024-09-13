import { CHAIN_TO_ADDRESSES_MAP, ChainId, Token } from '@baseswapfi/sdk-core';
import { WRAPPED_NATIVE_CURRENCY } from './chains';

export type AddressMap = { [chainId: number]: string | undefined };

export const SWAP_ROUTER_02_ADDRESSES = (chainId: number): string => {
  console.log(`SWAP_ROUTER_02_ADDRESSES: not implemented. chain id ${chainId}`);
  return '';
};

export const OVM_GASPRICE_ADDRESS = '0x420000000000000000000000000000000000000F';
export const ARB_GASINFO_ADDRESS = '0x000000000000000000000000000000000000006C';

export const WETH9: {
  [chainId in ChainId]: Token;
} = WRAPPED_NATIVE_CURRENCY;

export const QUOTER_V2_ADDRESSES: AddressMap = {
  // [ChainId.CELO]: CHAIN_TO_ADDRESSES_MAP[ChainId.CELO].quoterAddress,
  // [ChainId.CELO_ALFAJORES]:
  //   CHAIN_TO_ADDRESSES_MAP[ChainId.CELO_ALFAJORES].quoterAddress,
  // [ChainId.OPTIMISM_GOERLI]:
  //   CHAIN_TO_ADDRESSES_MAP[ChainId.OPTIMISM_GOERLI].quoterAddress,
  // [ChainId.OPTIMISM_SEPOLIA]:
  //   CHAIN_TO_ADDRESSES_MAP[ChainId.OPTIMISM_SEPOLIA].quoterAddress,
  // [ChainId.SEPOLIA]: CHAIN_TO_ADDRESSES_MAP[ChainId.SEPOLIA].quoterAddress,
  // [ChainId.ARBITRUM_GOERLI]:
  //   CHAIN_TO_ADDRESSES_MAP[ChainId.ARBITRUM_GOERLI].quoterAddress,
  // [ChainId.ARBITRUM_SEPOLIA]:
  //   CHAIN_TO_ADDRESSES_MAP[ChainId.ARBITRUM_SEPOLIA].quoterAddress,
  // [ChainId.BNB]: CHAIN_TO_ADDRESSES_MAP[ChainId.BNB].quoterAddress,
  // [ChainId.AVALANCHE]: CHAIN_TO_ADDRESSES_MAP[ChainId.AVALANCHE].quoterAddress,
  [ChainId.BASE_GOERLI]: CHAIN_TO_ADDRESSES_MAP[ChainId.BASE_GOERLI].quoterAddress,
  [ChainId.BASE]: CHAIN_TO_ADDRESSES_MAP[ChainId.BASE].quoterAddress,
  // [ChainId.BLAST]: CHAIN_TO_ADDRESSES_MAP[ChainId.BLAST].quoterAddress,
  // [ChainId.ZORA]: CHAIN_TO_ADDRESSES_MAP[ChainId.ZORA].quoterAddress,
  // [ChainId.ZKSYNC]: CHAIN_TO_ADDRESSES_MAP[ChainId.ZKSYNC].quoterAddress,
  // TODO: Gnosis + Moonbeam contracts to be deployed
};

export const NEW_QUOTER_V2_ADDRESSES: AddressMap = {
  // [ChainId.CELO]: '0x5e55C9e631FAE526cd4B0526C4818D6e0a9eF0e3',
  // [ChainId.CELO_ALFAJORES]: '0x5e55C9e631FAE526cd4B0526C4818D6e0a9eF0e3',
  // [ChainId.OPTIMISM_SEPOLIA]: '0x5e55C9e631FAE526cd4B0526C4818D6e0a9eF0e3',
  // [ChainId.SEPOLIA]: '0xf0c802dcb0cf1c4f7b953756b49d940eed190221',
  // [ChainId.ARBITRUM_SEPOLIA]: '0x5e55C9e631FAE526cd4B0526C4818D6e0a9eF0e3',
  // [ChainId.BNB]: '0x5e55C9e631FAE526cd4B0526C4818D6e0a9eF0e3',
  // [ChainId.AVALANCHE]: '0xf0c802dcb0cf1c4f7b953756b49d940eed190221',
  // [ChainId.POLYGON_MUMBAI]: '0x60e06b92bC94a665036C26feC5FF2A92E2d04c5f',
  [ChainId.BASE]: '',
  // [ChainId.BLAST]: '0x9D0F15f2cf58655fDDcD1EE6129C547fDaeD01b1',
  // [ChainId.ZORA]: '0x9D0F15f2cf58655fDDcD1EE6129C547fDaeD01b1',
  // [ChainId.ZKSYNC]: '0x071Bd2063dF031EDd110E27C6F4CDe50A3DeF2d4',
};
