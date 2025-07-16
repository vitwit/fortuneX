import {
  ConnectionProvider,
  RPC_ENDPOINT,
} from './components/providers/ConnectionProvider';
import {clusterApiUrl} from '@solana/web3.js';
import React from 'react';
import {SafeAreaView, StyleSheet, Text} from 'react-native';
import {AuthorizationProvider} from './components/providers/AuthorizationProvider';
import {TextEncoder, TextDecoder} from 'text-encoding';

if (typeof global.TextEncoder === 'undefined') {
  global.TextEncoder = TextEncoder as any;
}

if (typeof global.TextDecoder === 'undefined') {
  global.TextDecoder = TextDecoder as any;
}

import MainScreen from './screens/MainScreen';
import {NavigationProvider} from './components/providers/NavigationProvider';

export default function App() {
  return (
    <ConnectionProvider
      config={{commitment: 'processed'}}
      endpoint={'http://10.0.2.2:8899'}>
      <AuthorizationProvider>
        <NavigationProvider>
          <SafeAreaView style={styles.shell}>
            <MainScreen />
          </SafeAreaView>
        </NavigationProvider>
      </AuthorizationProvider>
    </ConnectionProvider>
  );
}

const styles = StyleSheet.create({
  shell: {
    height: '100%',
  },
});
