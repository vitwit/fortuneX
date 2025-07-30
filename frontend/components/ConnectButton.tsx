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
import {useToast} from './providers/ToastProvider';

type Props = {
  title?: string;
  style?: ViewStyle;
};

export default function ConnectButton({
  title = 'Connect Wallet',
  style,
}: Props) {
  const {authorizeSession} = useAuthorization();
  const toast = useToast();
  const [authorizationInProgress, setAuthorizationInProgress] = useState(false);

  const handleConnectPress = useCallback(async () => {
    if (authorizationInProgress) return;
    setAuthorizationInProgress(true);
    try {
      await transact(async wallet => {
        await authorizeSession(wallet);
      });
    } catch (err: any) {
      toast.show({
        message: err instanceof Error ? err.message : err,
        type: 'error',
      });
    } finally {
      setAuthorizationInProgress(false);
    }
  }, [authorizationInProgress, authorizeSession]);

  return (
    <TouchableOpacity
      style={[
        styles.button,
        authorizationInProgress && styles.buttonDisabled,
        style,
      ]}
      onPress={handleConnectPress}
      disabled={authorizationInProgress}>
      {authorizationInProgress ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <Text style={styles.buttonText}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: '#10B981',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
    minWidth: 150,
    display: 'flex',
    justifyContent: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#cccccc',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
