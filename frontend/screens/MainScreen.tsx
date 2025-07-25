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
} from 'react-native';

import {
  useAuthorization,
  Account,
} from '../components/providers/AuthorizationProvider';
import {useConnection} from '../components/providers/ConnectionProvider';
import LotteryPoolsComponent from '../components/LotteryPool';
import History from '../components/History';
import Profile from '../components/Profile';
import RecentWinner from '../components/RecentWinner';
import AllPools from '../components/AllPools';
import {useGlobalState} from '../components/providers/NavigationProvider';
import ConnectButton from '../components/ConnectButton';
import LoadingIndicator from '../components/LoadingIndicator';

const {width, height} = Dimensions.get('window');

// Calculate bottom navigation height
const BOTTOM_NAV_HEIGHT = 80; // Approximate height of bottom navigation
const BOTTOM_SAFE_AREA = 20; // Safe area for devices with home indicator

export default function MainScreen() {
  const {connection} = useConnection();
  const {selectedAccount} = useAuthorization();
  const [balance, setBalance] = useState<number | null>(null);
  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(50));
  const [activeTab, setActiveTab] = useState('Home');
  const [pulseAnim] = useState(new Animated.Value(1));
  const {refreshGlobalState, isLoadingGlobalState} = useGlobalState();

  const fetchAndUpdateBalance = useCallback(
    async (account: Account) => {
      const fetchedBalance = await connection.getBalance(account.publicKey);
      console.log('Balance fetched: ' + fetchedBalance);
      setBalance(fetchedBalance);
    },
    [connection],
  );

  useEffect(() => {
    refreshGlobalState();
  }, []);

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

    // Pulse animation for active elements
    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
      ]),
    );
    pulseAnimation.start();

    return () => pulseAnimation.stop();
  }, [fadeAnim, slideAnim, pulseAnim]);

  const handleTabPress = (tab: string) => {
    setActiveTab(tab);
  };

  const renderTabContent = () => {
    if (activeTab === 'Home') {
      return (
        <View style={styles.homeContent}>
          {/* Active Pools Section */}
          <View style={styles.poolsSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Live Pools</Text>
              <TouchableOpacity
                style={styles.viewAllButton}
                onPress={() => {
                  setActiveTab('Pools');
                }}>
                <Text style={styles.viewAllText}>View All</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.poolsScroll}>
              <LotteryPoolsComponent isMainScreen={true} />
            </ScrollView>
          </View>

          <RecentWinner />
        </View>
      );
    }

    if (activeTab === 'History') {
      return (
        <View style={styles.historySection}>
          <History />
        </View>
      );
    }

    if (activeTab === 'Profile') {
      return (
        <View>
          <Profile />
        </View>
      );
    }

    if (activeTab === 'Pools') {
      return (
        <View>
          <AllPools />
        </View>
      );
    }

    return null;
  };

  const TabIcon = ({name, isActive}: {name: string; isActive: boolean}) => {
    const icons = {
      Home: '🏠',
      History: '📊',
      Pools: '🎫',
      Profile: '👤',
    };

    return (
      <View style={[styles.tabIcon, isActive && styles.activeTabIcon]}>
        <Text
          style={[styles.tabIconText, isActive && styles.activeTabIconText]}>
          {icons[name as keyof typeof icons]}
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0A0A" />

      {/* Background Effects */}
      <View style={styles.backgroundEffects}>
        <View style={styles.gradientOrb1} />
        <View style={styles.gradientOrb2} />
        <View style={styles.gradientOrb3} />
      </View>

      {/* Header */}
      <Animated.View
        style={[
          styles.header,
          {
            opacity: fadeAnim,
            transform: [{translateY: slideAnim}],
          },
        ]}>
        <View style={styles.headerContent}>
          <View style={styles.headerLeft}>
            <Text style={styles.appTitle}>FortuneX</Text>
            <Text style={styles.appSubtitle}>A Millionaire Daily</Text>
          </View>

          {selectedAccount ? null : (
            <View style={styles.headerRight}>
              <ConnectButton />
            </View>
          )}
        </View>
      </Animated.View>

      {/* Main Content */}
      {isLoadingGlobalState ? (
        <View style={{marginTop: 100}}>
          <LoadingIndicator text="Loading..." />
        </View>
      ) : (
        <View style={styles.mainContent}>
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContainer}
            showsVerticalScrollIndicator={false}>
            {/* Wallet Card */}

            {/* Tab Content */}
            <Animated.View
              style={[
                styles.contentContainer,
                {
                  opacity: fadeAnim,
                  transform: [{translateY: slideAnim}],
                },
              ]}>
              {renderTabContent()}
            </Animated.View>
          </ScrollView>
        </View>
      )}

      {/* Bottom Navigation */}
      <View style={styles.bottomNav}>
        <View style={styles.bottomNavContent}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'Home' && styles.activeTab]}
            onPress={() => handleTabPress('Home')}>
            <TabIcon name="Home" isActive={activeTab === 'Home'} />
            <Text
              style={[
                styles.tabLabel,
                activeTab === 'Home' && styles.activeTabLabel,
              ]}>
              Home
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tabButton,
              activeTab === 'History' && styles.activeTab,
            ]}
            onPress={() => handleTabPress('History')}>
            <TabIcon name="History" isActive={activeTab === 'History'} />
            <Text
              style={[
                styles.tabLabel,
                activeTab === 'History' && styles.activeTabLabel,
              ]}>
              History
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tabButton,
              activeTab === 'Pools' && styles.activeTab,
            ]}
            onPress={() => handleTabPress('Pools')}>
            <TabIcon name="Pools" isActive={activeTab === 'Pools'} />
            <Text
              style={[
                styles.tabLabel,
                activeTab === 'Pools' && styles.activeTabLabel,
              ]}>
              Pools
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tabButton,
              activeTab === 'Profile' && styles.activeTab,
            ]}
            onPress={() => handleTabPress('Profile')}>
            <TabIcon name="Profile" isActive={activeTab === 'Profile'} />
            <Text
              style={[
                styles.tabLabel,
                activeTab === 'Profile' && styles.activeTabLabel,
              ]}>
              Profile
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  backgroundEffects: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    zIndex: 0,
  },
  gradientOrb1: {
    position: 'absolute',
    top: -100,
    right: -100,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    opacity: 0.8,
  },
  gradientOrb2: {
    position: 'absolute',
    top: height * 0.3,
    left: -150,
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: 'rgba(139, 69, 19, 0.1)',
    opacity: 0.6,
  },
  gradientOrb3: {
    position: 'absolute',
    bottom: -100,
    right: -50,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
    opacity: 0.7,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
    zIndex: 1,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flex: 1,
  },
  appTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  appSubtitle: {
    fontSize: 14,
    color: '#10B981',
    fontWeight: '500',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  notificationButton: {
    position: 'relative',
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1A1A1A',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  notificationIcon: {
    fontSize: 20,
  },
  notificationBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
  mainContent: {
    flex: 1,
    marginBottom: BOTTOM_NAV_HEIGHT + BOTTOM_SAFE_AREA,
  },
  scrollView: {
    flex: 1,
    zIndex: 1,
  },
  scrollContainer: {
    paddingBottom: 20,
  },
  walletCard: {
    marginHorizontal: 20,
    marginTop: 20,
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  homeContent: {
    flex: 1,
    paddingTop: 20,
  },
  heroSection: {
    marginBottom: 30,
  },
  heroContent: {
    alignItems: 'center',
  },
  heroTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  heroSubtitle: {
    fontSize: 16,
    color: '#9CA3AF',
    marginBottom: 30,
    textAlign: 'center',
  },
  jackpotContainer: {
    position: 'relative',
    backgroundColor: '#1A1A1A',
    borderRadius: 24,
    padding: 30,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#10B981',
    overflow: 'hidden',
  },
  jackpotGlow: {
    position: 'absolute',
    top: -20,
    left: -20,
    right: -20,
    bottom: -20,
    backgroundColor: '#10B981',
    borderRadius: 30,
    opacity: 0.1,
  },
  jackpotContent: {
    alignItems: 'center',
    zIndex: 1,
  },
  jackpotLabel: {
    fontSize: 14,
    color: '#10B981',
    fontWeight: '600',
    marginBottom: 8,
    letterSpacing: 1,
  },
  jackpotAmount: {
    fontSize: 42,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  jackpotSubtext: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
    paddingHorizontal: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginHorizontal: 6,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#10B981',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  poolsSection: {
    marginBottom: 30,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  viewAllButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#2A2A2A',
    borderRadius: 8,
  },
  viewAllText: {
    fontSize: 14,
    color: '#10B981',
    fontWeight: '500',
  },
  poolsScroll: {
    flexDirection: 'row',
  },
  poolCard: {
    width: 280,
    backgroundColor: '#1A1A1A',
    borderRadius: 20,
    padding: 20,
    marginRight: 16,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  poolHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  poolType: {
    backgroundColor: '#10B981',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  poolTypeText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  poolStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
    marginRight: 6,
  },
  poolStatusText: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: '600',
  },
  poolPrize: {
    alignItems: 'center',
    marginBottom: 20,
  },
  poolPrizeAmount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  poolPrizeLabel: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  poolInfo: {
    marginBottom: 20,
  },
  poolInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  poolInfoLabel: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  poolInfoValue: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  buyButton: {
    backgroundColor: '#10B981',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  buyButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  winnersSection: {
    marginBottom: 30,
  },
  winnersList: {
    marginTop: 16,
  },
  winnerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  winnerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  winnerInitials: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  winnerInfo: {
    flex: 1,
  },
  winnerName: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
    marginBottom: 2,
  },
  winnerTime: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  winnerAmount: {
    fontSize: 16,
    color: '#10B981',
    fontWeight: 'bold',
  },
  historySection: {
    flex: 1,
    paddingTop: 20,
  },
  bottomNav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#1A1A1A',
    borderTopWidth: 1,
    borderTopColor: '#2A2A2A',
    paddingBottom: BOTTOM_SAFE_AREA,
    height: BOTTOM_NAV_HEIGHT + BOTTOM_SAFE_AREA,
    zIndex: 1000,
  },
  bottomNavContent: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 12,
    justifyContent: 'space-around',
    height: BOTTOM_NAV_HEIGHT,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    borderRadius: 12,
  },
  activeTab: {
    backgroundColor: '#2A2A2A',
  },
  tabIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  activeTabIcon: {
    backgroundColor: '#10B981',
  },
  tabIconText: {
    fontSize: 16,
    opacity: 0.6,
  },
  activeTabIconText: {
    opacity: 1,
  },
  tabLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  activeTabLabel: {
    color: '#10B981',
    fontWeight: '600',
  },
});
