import { ChainId, Token } from '@baseswapfi/sdk-core';
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
