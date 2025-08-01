import {ConnectionProvider} from './components/providers/ConnectionProvider';
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
import {ToastProvider} from './components/providers/ToastProvider';
import {RPC_URL} from './util/constants';

export default function App() {
  return (
    <ToastProvider>
      <ConnectionProvider config={{commitment: 'processed'}} endpoint={RPC_URL}>
        <AuthorizationProvider>
          <NavigationProvider>
            <SafeAreaView style={styles.shell}>
              <MainScreen />
            </SafeAreaView>
          </NavigationProvider>
        </AuthorizationProvider>
      </ConnectionProvider>
    </ToastProvider>
  );
}

const styles = StyleSheet.create({
  shell: {
    height: '100%',
  },
});
