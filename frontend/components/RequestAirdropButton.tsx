import {useConnection} from '../components/providers/ConnectionProvider';
import React, {useState, useCallback} from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
} from 'react-native';
import {Account} from './providers/AuthorizationProvider';
import {alertAndLog} from '../util/alertAndLog';
import {LAMPORTS_PER_SOL} from '@solana/web3.js';

type Props = Readonly<{
  selectedAccount: Account;
  onAirdropComplete: (account: Account) => void;
  style?: ViewStyle;
}>;

const LAMPORTS_PER_AIRDROP = 1_000_000_000;

function convertLamportsToSOL(lamports: number) {
  return new Intl.NumberFormat(undefined, {maximumFractionDigits: 1}).format(
    lamports / LAMPORTS_PER_SOL,
  );
}

export default function RequestAirdropButton({
  selectedAccount,
  onAirdropComplete,
  style,
}: Props) {
  const {connection} = useConnection();
  const [airdropInProgress, setAirdropInProgress] = useState(false);

  const requestAirdrop = useCallback(async () => {
    const signature = await connection.requestAirdrop(
      selectedAccount.publicKey,
      LAMPORTS_PER_AIRDROP,
    );
    return await connection.confirmTransaction(signature, 'confirmed');
  }, [connection, selectedAccount]);

  const handlePress = async () => {
    if (airdropInProgress) return;
    setAirdropInProgress(true);
    try {
      await requestAirdrop();
      alertAndLog(
        'Funding successful:',
        `${convertLamportsToSOL(LAMPORTS_PER_AIRDROP)} SOL added to ${
          selectedAccount.publicKey
        }`,
      );
      onAirdropComplete(selectedAccount);
    } catch (err: any) {
      alertAndLog(
        'Failed to fund account:',
        err instanceof Error ? err.message : err,
      );
    } finally {
      setAirdropInProgress(false);
    }
  };

  return (
    <TouchableOpacity
      style={[styles.button, airdropInProgress && styles.buttonDisabled, style]}
      onPress={handlePress}
      disabled={airdropInProgress}>
      {airdropInProgress ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <Text style={styles.buttonText}>Airdrop</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: '#10B981',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },

  buttonDisabled: {
    backgroundColor: '#a0d6a0',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
