import React from 'react';
import {StyleSheet, View, Text, TouchableOpacity} from 'react-native';
import {LAMPORTS_PER_SOL, PublicKey} from '@solana/web3.js';

import DisconnectButton from './DisconnectButton';
import RequestAirdropButton from './RequestAirdropButton';
import {formatNumber, formatToSOL, formatWithKM} from '../util/utils';

interface Account {
  address: string;
  label?: string;
  publicKey: PublicKey;
}

type Props = {
  selectedAccount: Account;
  balance: number | null;
  usdcBalance: number | null;
  fetchAndUpdateBalance: (account: Account) => void;
};

function formatAddress(address: string): string {
  if (address.length <= 8) return address;
  return `${address.slice(0, 6)}...${address.slice(-6)}`;
}

export default function AccountInfo({
  selectedAccount,
  balance,
  usdcBalance,
  fetchAndUpdateBalance,
}: Props) {
  return (
    <View style={styles.container}>
      {/* Balance Display Section */}
      <View style={styles.balanceSection}>
        <Text style={styles.balanceLabel}>Wallet Balances</Text>

        {/* SOL Balance */}
        <View style={styles.balanceContainer}>
          <Text style={styles.balanceAmount}>
            {balance !== null ? formatToSOL(balance, 4) : '0.0000'}
          </Text>
          <Text style={styles.balanceCurrency}>SOL</Text>
        </View>

        {/* USDC Balance */}
        <View style={styles.balanceContainer}>
          <Text style={styles.balanceAmountSecondary}>
            {usdcBalance !== null ? formatNumber(usdcBalance) : '0.00'}
          </Text>
          <Text style={styles.balanceCurrencySecondary}>USDC</Text>
        </View>
      </View>

      {/* Wallet Info Row */}
      <View style={styles.walletInfoRow}>
        <View style={styles.walletDetails}>
          <View style={styles.walletIcon}>
            <Text style={styles.walletIconText}>👛</Text>
          </View>
          <View style={styles.walletInfo}>
            <Text style={styles.walletLabel}>
              {selectedAccount.label || 'Connected Wallet'}
            </Text>
            <Text style={styles.walletAddress}>
              {formatAddress(selectedAccount.publicKey.toBase58())}
            </Text>
          </View>
        </View>

        <TouchableOpacity style={styles.copyButton}>
          <Text style={styles.copyButtonText}>📋</Text>
        </TouchableOpacity>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        <View style={styles.buttonWrapper}>
          <RequestAirdropButton
            selectedAccount={selectedAccount}
            onAirdropComplete={() => fetchAndUpdateBalance(selectedAccount)}
          />
        </View>
        <View style={styles.buttonWrapper}>
          <DisconnectButton />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'transparent',
  },
  balanceSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  balanceLabel: {
    fontSize: 14,
    color: '#9CA3AF',
    marginBottom: 8,
  },
  balanceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 6,
  },
  balanceAmount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#10B981',
    marginRight: 8,
  },
  balanceCurrency: {
    fontSize: 16,
    color: '#10B981',
    fontWeight: '600',
  },
  balanceAmountSecondary: {
    fontSize: 24,
    fontWeight: '600',
    color: '#3B82F6',
    marginRight: 8,
  },
  balanceCurrencySecondary: {
    fontSize: 14,
    color: '#3B82F6',
    fontWeight: '600',
  },
  walletInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#16213E',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2D2D44',
    marginBottom: 16,
  },
  walletDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  walletIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  walletIconText: {
    fontSize: 18,
  },
  walletInfo: {
    flex: 1,
  },
  walletLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  walletAddress: {
    fontSize: 13,
    color: '#9CA3AF',
    fontFamily: 'monospace',
  },
  copyButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#374151',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#4B5563',
  },
  copyButtonText: {
    fontSize: 16,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  buttonWrapper: {
    flex: 1,
  },
});
