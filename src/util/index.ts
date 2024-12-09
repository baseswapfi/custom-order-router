import { Token } from '@baseswapfi/sdk-core';

export * from './addresses';
export * from './amounts';
export * from './chains';
export * from './intent';
export * from './log';
export * from './metric';
export * from './protocols';
export * from './routes';

/**
 * Returns true if the address of this token sorts before the address of the other token
 * @param other other token to compare
 * @throws if the tokens have the same address
 * @throws if the tokens are on different chains
 */
export function sortsBefore(currencyA: Token, currencyB: Token): boolean {
  // invariant(currencyA.chainId === currencyB.chainId, 'CHAIN_IDS');
  // invariant(this.address.toLowerCase() !== other.address.toLowerCase(), 'ADDRESSES');

  if (currencyA.chainId !== currencyB.chainId) throw new Error('CHAIN_IDS');
  if (currencyA.address.toLowerCase() === currencyB.address.toLowerCase())
    throw new Error('ADDRESSES');

  return currencyA.address.toLowerCase() < currencyB.address.toLowerCase();
}
