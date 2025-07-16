import React, {useCallback, useEffect, useState} from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  StatusBar,
  Dimensions,
  Animated,
  SafeAreaView,
  TouchableOpacity,
  Button,
} from 'react-native';

import {Section} from '../components/Section';
import ConnectButton from '../components/ConnectButton';
import AccountInfo from '../components/AccountInfo';
import {
  useAuthorization,
  Account,
} from '../components/providers/AuthorizationProvider';
import {useConnection} from '../components/providers/ConnectionProvider';
import LotteryPoolsComponent from '../components/LotteryPool';
import {useNavigation} from '../components/providers/NavigationProvider';
import LotteryPoolInfo from '../components/LotteryPoolInfo';

export default function MainScreen() {
  const {connection} = useConnection();
  const {selectedAccount} = useAuthorization();
  const [balance, setBalance] = useState<number | null>(null);
  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(50));
  const {goBack, screen, params} = useNavigation();

  const fetchAndUpdateBalance = useCallback(
    async (account: Account) => {
      console.log('Fetching balance for: ' + account.publicKey);
      const fetchedBalance = await connection.getBalance(account.publicKey);
      console.log('Balance fetched: ' + fetchedBalance);
      setBalance(fetchedBalance);
    },
    [connection],
  );

  useEffect(() => {
    if (!selectedAccount) {
      return;
    }
    fetchAndUpdateBalance(selectedAccount);
  }, [fetchAndUpdateBalance, selectedAccount]);

  // Entrance animation
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0F0F23" />

      {/* Background Gradient Effect */}
      <View style={styles.backgroundGradient}>
        <View style={styles.gradientCircle1} />
        <View style={styles.gradientCircle2} />
      </View>

      {/* Header Section */}
      <Animated.View
        style={[
          styles.header,
          {
            opacity: fadeAnim,
            transform: [{translateY: slideAnim}],
          },
        ]}>
        <View style={styles.headerContent}>
          <Text style={styles.appTitle}>FortuneX</Text>
          <Text style={styles.appSubtitle}>A Millionaire Daily</Text>
        </View>

        {/* Network Status */}
        <View style={styles.networkStatus}>
          <View style={styles.networkDot} />
          <Text style={styles.networkText}>Devnet</Text>
        </View>
      </Animated.View>

      {/* <ScrollView> */}

      {/* </ScrollView> */}

      {/* Main Content */}
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
        style={styles.scrollView}>
        {selectedAccount ? (
          <View>
            {screen === 'Home' && (
              <Animated.View
                style={[
                  styles.contentContainer,
                  {
                    opacity: fadeAnim,
                    transform: [{translateY: slideAnim}],
                  },
                ]}>
                {/* Wallet Info Card */}
                <View style={styles.walletCard}>
                  <AccountInfo
                    selectedAccount={selectedAccount}
                    balance={balance}
                    fetchAndUpdateBalance={fetchAndUpdateBalance}
                  />
                </View>

                {/* Main Gaming Section */}
                <View style={styles.gamingSection}>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Join the Pool</Text>
                    <Text style={styles.sectionSubtitle}>
                      Experience the thrill of decentralized gaming
                    </Text>
                  </View>

                  {/* Lottery Game Card */}
                  <View style={styles.gameCard}>
                    <View style={styles.gameHeader}>
                      <View style={styles.gameIcon}>
                        <Text style={styles.gameIconText}>🎰</Text>
                      </View>
                      <View style={styles.gameInfo}>
                        <Text style={styles.gameTitle}>Active Pool</Text>
                        <Text style={styles.gameDescription}>
                          Join the pool and win big rewards
                        </Text>
                      </View>
                      <View style={styles.gameStatus}>
                        <Text style={styles.gameStatusText}>ACTIVE</Text>
                      </View>
                    </View>

                    <LotteryPoolsComponent />
                  </View>
                </View>
              </Animated.View>
            )}
            {screen === 'Pool' && (
              <Animated.View
                style={[
                  styles.contentContainer,
                  {
                    opacity: fadeAnim,
                    transform: [{translateY: slideAnim}],
                  },
                ]}>
                {/* Back Button at top-left */}
                <View style={styles.header}>
                  <Button title="← Back" onPress={goBack} />
                </View>
                <LotteryPoolInfo />
              </Animated.View>
            )}
          </View>
        ) : (
          <Animated.View
            style={[
              styles.welcomeContainer,
              {
                opacity: fadeAnim,
                transform: [{translateY: slideAnim}],
              },
            ]}>
            <View style={styles.welcomeContent}>
              <Text style={styles.welcomeIcon}>🚀</Text>
              <Text style={styles.welcomeTitle}>Welcome to FortuneX</Text>
              <Text style={styles.welcomeDescription}>
                Connect your wallet to start playing decentralized games and win
                amazing prizes on the Solana blockchain.
              </Text>

              <View style={styles.featuresList}>
                <View style={styles.featureItem}>
                  <Text style={styles.featureIcon}>⚡</Text>
                  <Text style={styles.featureText}>Fast & Secure</Text>
                </View>
                <View style={styles.featureItem}>
                  <Text style={styles.featureIcon}>🎯</Text>
                  <Text style={styles.featureText}>Fair Gaming</Text>
                </View>
                <View style={styles.featureItem}>
                  <Text style={styles.featureIcon}>💎</Text>
                  <Text style={styles.featureText}>Real Rewards</Text>
                </View>
              </View>
            </View>
          </Animated.View>
        )}
      </ScrollView>

      {/* Footer/Connection Section */}
      <View style={styles.footer}>
        {selectedAccount ? (
          <></>
        ) : (
          <View style={styles.connectionFooter}>
            <ConnectButton title="🔗 Connect Wallet" />
            <Text style={styles.footerNote}>
              Connect your Solana wallet to get started
            </Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F23',
  },
  backgroundGradient: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  gradientCircle1: {
    position: 'absolute',
    top: -100,
    right: -100,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  gradientCircle2: {
    position: 'absolute',
    bottom: -150,
    left: -150,
    width: 400,
    height: 400,
    borderRadius: 200,
    backgroundColor: 'rgba(59, 130, 246, 0.05)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#1F1F37',
  },
  headerContent: {
    flex: 1,
  },
  appTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  appSubtitle: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  networkStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F1F37',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2D2D44',
  },
  networkDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
    marginRight: 6,
  },
  networkText: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: 4,
  },
  walletCard: {
    backgroundColor: '#1F1F37',
    borderRadius: 16,
    padding: 20,
    marginVertical: 20,
    borderWidth: 1,
    borderColor: '#2D2D44',
  },
  gamingSection: {
    flex: 1,
  },
  sectionHeader: {
    marginBottom: 20,
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 5,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  gameCard: {
    backgroundColor: '#1F1F37',
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#2D2D44',
  },
  gameHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  gameIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  gameIconText: {
    fontSize: 24,
  },
  gameInfo: {
    flex: 1,
  },
  gameTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  gameDescription: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  gameStatus: {
    backgroundColor: '#10B981',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  gameStatusText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  gameContent: {
    marginTop: 10,
  },
  welcomeContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  welcomeContent: {
    alignItems: 'center',
    maxWidth: 350,
  },
  welcomeIcon: {
    fontSize: 80,
    marginBottom: 20,
  },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 15,
  },
  welcomeDescription: {
    fontSize: 16,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 40,
  },
  featuresList: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginTop: 20,
  },
  featureItem: {
    alignItems: 'center',
    flex: 1,
  },
  featureIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  featureText: {
    fontSize: 14,
    color: '#D1D5DB',
    fontWeight: '600',
    textAlign: 'center',
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderTopWidth: 1,
    borderTopColor: '#1F1F37',
  },
  connectedFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerButton: {
    backgroundColor: '#374151',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#4B5563',
  },
  footerButtonText: {
    color: '#9CA3AF',
    fontSize: 14,
    fontWeight: '600',
  },
  connectionFooter: {
    alignItems: 'center',
  },
  footerNote: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 10,
    textAlign: 'center',
  },
  content: {
    marginTop: 60,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  poolText: {
    fontSize: 20,
    fontWeight: 'bold',
  },
});
