// components/RequestUSDCAirdropButton.tsx
import React, {useState} from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {PublicKey} from '@solana/web3.js';
import {AIRDROP_SERVICE_URL} from '../util/constants';
import {useToast} from './providers/ToastProvider';

interface Props {
  selectedAccount: {
    publicKey: PublicKey;
  };
  onAirdropComplete: () => void;
}

export default function RequestUSDCAirdropButton({
  selectedAccount,
  onAirdropComplete,
}: Props) {
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const handleUSDCAirdrop = async () => {
    try {
      setLoading(true);
      const address = selectedAccount.publicKey.toBase58();
      const response = await fetch(`${AIRDROP_SERVICE_URL}/airdrop/${address}`);

      if (!response.ok) {
        throw new Error('Airdrop request failed');
      }

      // Alert.alert('✅ Funding successful:', '100 USDC Airdropped!');
      toast.show({message: 'Airdrop successfull', type: 'success'});
      onAirdropComplete();
    } catch (err) {
      // Alert.alert('❌ Airdrop failed', (err as Error).message);
      toast.show({message: 'Failed to airdrop', type: 'error'});
    } finally {
      setLoading(false);
    }
  };

  return (
    <TouchableOpacity
      style={styles.button}
      onPress={handleUSDCAirdrop}
      disabled={loading}>
      {loading ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <Text style={styles.buttonText}>Airdrop</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: '#3B82F6', // Blue for USDC
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
