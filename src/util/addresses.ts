import {
  CHAIN_TO_ADDRESSES_MAP,
  ChainId,
  Currency,
  Token,
} from '@baseswapfi/sdk-core';
import { WRAPPED_NATIVE_CURRENCY } from './chains';
import { ADDRESS_ZERO } from '@baseswapfi/v3-sdk2';

export type AddressMap = { [chainId: number]: string | undefined };

export const SWAP_ROUTER_02_ADDRESSES = (chainId: number): string => {
  console.log(`SWAP_ROUTER_02_ADDRESSES: not implemented. chain id ${chainId}`);
  return '';
};

export const OVM_GASPRICE_ADDRESS =
  '0x420000000000000000000000000000000000000F';
export const ARB_GASINFO_ADDRESS = '0x000000000000000000000000000000000000006C';

export const WETH9: {
  [chainId in ChainId]: Token;
} = WRAPPED_NATIVE_CURRENCY;

export const NEW_QUOTER_V2_ADDRESSES: AddressMap = {
  [ChainId.BASE]: '0x220EC69378ceE35C3862A38D2B01f0ec26A0E24C',
  [ChainId.OPTIMISM]: '0xcd0013Fe2a9389b904aC8Cc22362a067e3d30ede',
};

export const BEACON_CHAIN_DEPOSIT_ADDRESS =
  '0x00000000219ab540356cBB839Cbe05303d7705Fa';

export function getAddressLowerCase(currency: Currency): string {
  if (currency.isToken) {
    return currency.address.toLowerCase();
  } else {
    return ADDRESS_ZERO;
  }
}

export function getAddress(currency: Currency): string {
  if (currency.isToken) {
    return currency.address;
  } else {
    return ADDRESS_ZERO;
  }
}
