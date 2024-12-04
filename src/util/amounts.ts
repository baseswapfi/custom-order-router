import { parseUnits } from '@ethersproject/units';
import { ChainId, Currency, CurrencyAmount as CurrencyAmountRaw, Fraction } from '@baseswapfi/sdk-core';
import { FeeAmount } from '@baseswapfi/v3-sdk2';
import JSBI from 'jsbi';
import { FEE_TIERS } from '../providers/v3/fee-tiers';
import { AlphaRouterConfig } from '../routers';

export class CurrencyAmount extends CurrencyAmountRaw<Currency> {}

export const MAX_UINT160 = '0xffffffffffffffffffffffffffffffffffffffff';

// Try to parse a user entered amount for a given token
export function parseAmount(value: string, currency: Currency): CurrencyAmount {
  const typedValueParsed = parseUnits(value, currency.decimals).toString();
  return CurrencyAmount.fromRawAmount(currency, JSBI.BigInt(typedValueParsed));
}

export function parseFeeAmount(feeAmountStr: string) {
  switch (feeAmountStr) {
    case '10000':
      return FeeAmount.HIGH;
    case '2500':
      return FeeAmount.MEDIUM;
    case '450':
      return FeeAmount.LOW;
    case '350':
      return FeeAmount.LOWER;
    case '80':
      return FeeAmount.LOWEST;
    case '1':
      return FeeAmount.EXTRA_LOWEST;
    default:
      throw new Error(`Fee amount ${feeAmountStr} not supported.`);
  }
}

export function unparseFeeAmount(feeAmount: FeeAmount) {
  switch (feeAmount) {
    case FeeAmount.HIGH:
      return '10000';
    case FeeAmount.MEDIUM:
      return '2500';
    case FeeAmount.LOW:
      return '450';
    case FeeAmount.LOWER:
      return '350';
    case FeeAmount.LOWEST:
      return '80';
    case FeeAmount.EXTRA_LOWEST:
      return '1';
    default:
      throw new Error(`Fee amount ${feeAmount} not supported.`);
  }
}

export function getApplicableV3FeeAmounts(chainId: ChainId): FeeAmount[] {
  const feeAmounts = FEE_TIERS;

  // if (chainId === ChainId.BASE) {
  //   feeAmounts.push(FeeAmount.LOW_200, FeeAmount.LOW_300, FeeAmount.LOW_400);
  // }

  return feeAmounts;
}

// Note multiplications here can result in a loss of precision in the amounts (e.g. taking 50% of 101)
// This is reconcilled at the end of the algorithm by adding any lost precision to one of
// the splits in the route.
export function getAmountDistribution(
  amount: CurrencyAmount,
  routingConfig: AlphaRouterConfig
): [number[], CurrencyAmount[]] {
  const { distributionPercent } = routingConfig;
  const percents = [];
  const amounts = [];

  for (let i = 1; i <= 100 / distributionPercent; i++) {
    percents.push(i * distributionPercent);
    amounts.push(amount.multiply(new Fraction(i * distributionPercent, 100)));
  }

  return [percents, amounts];
}
