import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';

import DisconnectButton from './DisconnectButton';
import RequestAirdropButton from './RequestAirdropButton';

interface Account {
  address: string;
  label?: string;
  publicKey: PublicKey;
}

type Props = {
  selectedAccount: Account;
  balance: number | null;
  fetchAndUpdateBalance: (account: Account) => void;
};

function lamportsToSol(lamports: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 4 }).format(
    lamports / LAMPORTS_PER_SOL
  );
}

function formatAddress(address: string): string {
  if (address.length <= 8) return address;
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

export default function AccountInfo({ selectedAccount, balance, fetchAndUpdateBalance }: Props) {
  return (
    <View style={styles.container}>
      {/* Header with Balance */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>💼 {selectedAccount.label || 'Wallet'}</Text>
          <View style={styles.balanceContainer}>
            <Text style={styles.balanceAmount}>
              {balance !== null ? lamportsToSol(balance) : '0.0000'}
            </Text>
            <Text style={styles.balanceCurrency}>SOL</Text>
          </View>
        </View>
        <View style={styles.statusIndicator}>
          <View style={styles.statusDot} />
          <Text style={styles.statusText}>ACTIVE</Text>
        </View>
      </View>

      {/* Address */}
      <View style={styles.addressContainer}>
        <Text style={styles.addressText}>
          {formatAddress(selectedAccount.address)}
        </Text>
        <TouchableOpacity style={styles.copyButton}>
          <Text style={styles.copyButtonText}>📋</Text>
        </TouchableOpacity>
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <RequestAirdropButton
          selectedAccount={selectedAccount}
          onAirdropComplete={() => fetchAndUpdateBalance(selectedAccount)}
        />
        <DisconnectButton />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'transparent',
    borderRadius: 0,
    padding: 0,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  balanceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  balanceAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#10B981',
    marginRight: 6,
  },
  balanceCurrency: {
    fontSize: 14,
    color: '#10B981',
    fontWeight: '600',
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10B981',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
    marginRight: 6,
  },
  statusText: {
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  addressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16213E',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2D2D44',
    marginBottom: 12,
  },
  addressText: {
    flex: 1,
    fontSize: 13,
    color: '#D1D5DB',
    fontFamily: 'monospace',
  },
  copyButton: {
    padding: 4,
  },
  copyButtonText: {
    fontSize: 14,
  },
  actions: {
    flexDirection: 'row-reverse',
    gap: 12,
  },
});