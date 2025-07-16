import {transact} from '@solana-mobile/mobile-wallet-adapter-protocol-web3js';
import React, {useState, useCallback} from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
} from 'react-native';

import {useAuthorization} from './providers/AuthorizationProvider';
import {alertAndLog} from '../util/alertAndLog';

type Props = {
  title?: string;
  style?: ViewStyle;
};

export default function DisconnectButton({title = 'Disconnect', style}: Props) {
  const {deauthorizeSession} = useAuthorization();
  const [disconnecting, setDisconnecting] = useState(false);

  const handleDisconnectPress = useCallback(async () => {
    if (disconnecting) return;
    setDisconnecting(true);
    try {
      await transact(async wallet => {
        await deauthorizeSession(wallet);
      });
    } catch (err: any) {
      alertAndLog(
        'Error during disconnect',
        err instanceof Error ? err.message : err,
      );
    } finally {
      setDisconnecting(false);
    }
  }, [disconnecting, deauthorizeSession]);

  return (
    <TouchableOpacity
      style={[styles.button, disconnecting && styles.buttonDisabled, style]}
      onPress={handleDisconnectPress}
      disabled={disconnecting}>
      {disconnecting ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <Text style={styles.buttonText}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: '#FF4D4D',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    alignItems: 'center',
    minWidth: 130,
  },
  buttonDisabled: {
    backgroundColor: '#FFB3B3',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
