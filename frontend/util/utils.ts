import {LAMPORTS_PER_SOL} from '@solana/web3.js';

export function formatNumber(
  amount: number,
  tokenDecimals: number = 6,
  displayDecimals: number = 2,
): string {
  const actualAmount = amount / Math.pow(10, tokenDecimals);

  if (actualAmount >= 1000000) {
    return (actualAmount / 1000000).toFixed(displayDecimals) + 'M';
  } else if (actualAmount >= 1000) {
    return (actualAmount / 1000).toFixed(displayDecimals) + 'K';
  } else {
    return actualAmount.toFixed(displayDecimals);
  }
}

export function formatWithKM(
  amount: number,
  displayDecimals: number = 2,
): string {
  if (amount >= 1000000) {
    return (amount / 1000000).toFixed(displayDecimals) + 'M';
  } else if (amount >= 1000) {
    return (amount / 1000).toFixed(displayDecimals) + 'K';
  } else {
    return amount.toFixed(displayDecimals);
  }
}

export function formatToSOL(lamports: number, displayDecimals: number) {
  const solAmount = lamports / LAMPORTS_PER_SOL;
  return formatWithKM(solAmount, displayDecimals);
}
