import { BigNumber } from '@ethersproject/bignumber';
import { BaseProvider } from '@ethersproject/providers';
import { ChainId } from '@baseswapfi/sdk-core';

import { TokenFeeDetector__factory } from '../types/other/factories/TokenFeeDetector__factory';
import { TokenFeeDetector } from '../types/other/TokenFeeDetector';
import {
  log,
  metric,
  MetricLoggerUnit,
  WRAPPED_NATIVE_CURRENCY,
} from '../util';

import { ProviderConfig } from './provider';

const DEFAULT_TOKEN_BUY_FEE_BPS = BigNumber.from(0);
const DEFAULT_TOKEN_SELL_FEE_BPS = BigNumber.from(0);

// on detector failure, assume no fee
export const DEFAULT_TOKEN_FEE_RESULT = {
  buyFeeBps: DEFAULT_TOKEN_BUY_FEE_BPS,
  sellFeeBps: DEFAULT_TOKEN_SELL_FEE_BPS,
};

type Address = string;

export type TokenFeeResult = {
  buyFeeBps?: BigNumber;
  sellFeeBps?: BigNumber;
  feeTakenOnTransfer?: boolean;
  externalTransferFailed?: boolean;
  sellReverted?: boolean;
};
export type TokenFeeMap = Record<Address, TokenFeeResult>;

// address at which the FeeDetector lens is deployed
const FEE_DETECTOR_ADDRESS = (chainId: ChainId) => {
  switch (chainId) {
    case ChainId.OPTIMISM:
      return '0x96F701640Ff6f1f7541bb9647BFB8c2E0e0d33B0';
    case ChainId.BASE:
      return '0x45ede445bf511f14cc4809d81355d4dbf8d97847';
    case ChainId.MODE:
      return '0xc09BF50ac5774f0F1a2406a2D08713683a2Bd3b9';
    case ChainId.ARBITRUM:
      return '0x1222766DA7a1CbCD8451dF214dcD41579a9fb60E';
    // case ChainId.SONIC_TESTNET:
    //   return '';
    case ChainId.SONEIUM_TESTNET:
      return '0xc1e624C810D297FD70eF53B0E08F44FABE468591';
    default:
      throw new Error(`No fee detector address for chain: ${chainId}`);
  }
};

// TODO: Will have to verify this for us
// Amount has to be big enough to avoid rounding errors, but small enough that
// most v2 pools will have at least this many token units
// 100000 is the smallest number that avoids rounding errors in bps terms
// 10000 was not sufficient due to rounding errors for rebase token (e.g. stETH)
const AMOUNT_TO_FLASH_BORROW = '100000';
// 1M gas limit per validate call, should cover most swap cases
const GAS_LIMIT_PER_VALIDATE = 1_000_000;

export interface ITokenFeeFetcher {
  fetchFees(
    addresses: Address[],
    providerConfig?: ProviderConfig
  ): Promise<TokenFeeMap>;
}

export class OnChainTokenFeeFetcher implements ITokenFeeFetcher {
  private BASE_TOKEN: string;
  private readonly contract: TokenFeeDetector;

  constructor(
    private chainId: ChainId,
    rpcProvider: BaseProvider,
    private tokenFeeAddress = FEE_DETECTOR_ADDRESS(chainId),
    private gasLimitPerCall = GAS_LIMIT_PER_VALIDATE,
    private amountToFlashBorrow = AMOUNT_TO_FLASH_BORROW
  ) {
    this.BASE_TOKEN = WRAPPED_NATIVE_CURRENCY[this.chainId]?.address;
    this.contract = TokenFeeDetector__factory.connect(
      this.tokenFeeAddress,
      rpcProvider
    );
  }

  public async fetchFees(
    addresses: Address[],
    providerConfig?: ProviderConfig
  ): Promise<TokenFeeMap> {
    const tokenToResult: TokenFeeMap = {};

    // const addressesWithoutBaseToken = addresses.filter(
    //   (address) => address.toLowerCase() !== this.BASE_TOKEN.toLowerCase()
    // );
    // const functionParams = addressesWithoutBaseToken.map((address) => [
    //   address,
    //   this.BASE_TOKEN,
    //   this.amountToFlashBorrow,
    // ]) as [string, string, string][];

    // const results = await Promise.all(
    //   functionParams.map(async ([address, baseToken, amountToBorrow]) => {
    //     try {
    //       // @note We ain't Uni. Surprise. But if we can leverage this fee check thing, it might be more useful to us than even them.
    //       // As we expand out on these chains. We do the degen things they wouldn't want or need to bother with.
    //       // If even partly like last bull run then there will definitely be some weird shit of some sort

    //       // We use the validate function instead of batchValidate to avoid poison pill problem.
    //       // One token that consumes too much gas could cause the entire batch to fail.
    //       const feeResult = await this.contract.callStatic.validate(
    //         address,
    //         baseToken,
    //         amountToBorrow,
    //         {
    //           gasLimit: this.gasLimitPerCall,
    //           blockTag: providerConfig?.blockNumber,
    //         }
    //       );

    //       metric.putMetric(
    //         'TokenFeeFetcherFetchFeesSuccess',
    //         1,
    //         MetricLoggerUnit.Count
    //       );

    //       return { address, ...feeResult };
    //     } catch (err) {
    //       log.error(
    //         { err },
    //         `Error calling validate on-chain for token ${address}`
    //       );

    //       metric.putMetric(
    //         'TokenFeeFetcherFetchFeesFailure',
    //         1,
    //         MetricLoggerUnit.Count
    //       );

    //       // in case of FOT token fee fetch failure, we return null
    //       // so that they won't get returned from the token-fee-fetcher
    //       // and thus no fee will be applied, and the cache won't cache on FOT tokens with failed fee fetching
    //       return {
    //         address,
    //         buyFeeBps: undefined,
    //         sellFeeBps: undefined,
    //         feeTakenOnTransfer: false,
    //         externalTransferFailed: false,
    //         sellReverted: false,
    //       };
    //     }
    //   })
    // );

    // results.forEach(
    //   ({
    //     address,
    //     buyFeeBps,
    //     sellFeeBps,
    //     feeTakenOnTransfer,
    //     externalTransferFailed,
    //     sellReverted,
    //   }) => {
    //     if (buyFeeBps || sellFeeBps) {
    //       tokenToResult[address] = {
    //         buyFeeBps,
    //         sellFeeBps,
    //         feeTakenOnTransfer,
    //         externalTransferFailed,
    //         sellReverted,
    //       };
    //     }
    //   }
    // );

    return tokenToResult;
  }
}
