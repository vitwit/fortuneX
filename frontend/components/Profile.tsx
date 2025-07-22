import React, {useCallback, useEffect, useState} from 'react';
import {Animated, ScrollView, StyleSheet, Text, View} from 'react-native';
import {TOKEN_PROGRAM_ID} from '@solana/spl-token';
import {PublicKey} from '@solana/web3.js';
import ConnectButton from './ConnectButton';
import AccountInfo from './AccountInfo';
import {
  useAuthorization,
  Account,
} from '../components/providers/AuthorizationProvider';
import {useConnection} from './providers/ConnectionProvider';
import {USDC_MINT} from '../util/constants';

const Profile = () => {
  const {connection} = useConnection();
  const [balance, setBalance] = useState<number | null>(null);
  const [usdcBalance, setUsdcBalance] = useState<number | null>(null);
  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(50));

  const {selectedAccount} = useAuthorization();

  const fetchUsdcBalance = useCallback(
    async (account: Account) => {
      try {
        // Get all token accounts for this wallet
        const tokenAccounts = await connection.getTokenAccountsByOwner(
          account.publicKey,
          {
            mint: USDC_MINT,
          },
        );

        if (tokenAccounts.value.length === 0) {
          console.log('No USDC token account found');
          setUsdcBalance(0);
          return;
        }

        // Get the balance of the first (usually only) USDC token account
        const tokenAccountInfo = await connection.getTokenAccountBalance(
          tokenAccounts.value[0].pubkey,
        );

        const usdcAmount = parseInt(tokenAccountInfo.value.amount);
        console.log('USDC balance fetched: ' + usdcAmount);
        setUsdcBalance(usdcAmount);
      } catch (error) {
        console.error('Error fetching USDC balance:', error);
        setUsdcBalance(0);
      }
    },
    [connection],
  );

  const fetchAndUpdateBalance = useCallback(
    async (account: Account) => {
      console.log('Fetching SOL balance for: ' + account.publicKey);
      try {
        // Fetch SOL balance
        const fetchedBalance = await connection.getBalance(account.publicKey);
        console.log('SOL balance fetched: ' + fetchedBalance);
        setBalance(fetchedBalance);

        // Fetch USDC balance
        await fetchUsdcBalance(account);
      } catch (error) {
        console.error('Error fetching balances:', error);
        setBalance(0);
        setUsdcBalance(0);
      }
    },
    [connection, fetchUsdcBalance],
  );

  useEffect(() => {
    if (!selectedAccount) {
      return;
    }
    fetchAndUpdateBalance(selectedAccount);
  }, [fetchAndUpdateBalance, selectedAccount]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <View style={styles.mainContent}>
      {selectedAccount ? (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}>
          {/* Wallet Card */}
          {selectedAccount && (
            <Animated.View
              style={[
                styles.walletCard,
                {
                  opacity: fadeAnim,
                  transform: [{translateY: slideAnim}],
                },
              ]}>
              <AccountInfo
                selectedAccount={selectedAccount}
                balance={balance}
                usdcBalance={usdcBalance}
                fetchAndUpdateBalance={fetchAndUpdateBalance}
              />
            </Animated.View>
          )}
        </ScrollView>
      ) : (
        <View
          style={{
            justifyContent: 'center',
            alignItems: 'center',
            marginTop: 20,
          }}>
          <ConnectButton />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  mainContent: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
    zIndex: 1,
  },
  scrollContainer: {
    paddingBottom: 20,
  },
  walletCard: {
    marginTop: 20,
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
});

export default Profile;
