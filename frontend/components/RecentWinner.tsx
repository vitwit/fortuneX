import {useEffect, useState} from 'react';
import {PublicKey} from '@solana/web3.js';
import {useConnection} from './providers/ConnectionProvider';
import {useAuthorization} from './providers/AuthorizationProvider';
import {
  Text,
  View,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  TouchableOpacity,
} from 'react-native';
import {PROGRAM_ID, SYSTEM_PROGRAM_ADDRESS} from '../util/constants';
import {useLotteryPool} from '../hooks/useLotteryPools';

type ParsedDrawHistory = {
  pubkey: PublicKey;
  pool: PublicKey;
  poolId: bigint;
  winner: PublicKey;
  prizeAmount: bigint;
  totalTickets: bigint;
  drawTimestamp: bigint;
  winningTicket: bigint;
  randomSeed: Buffer;
  bump: number;
};

const calculateROI = (winner: ParsedDrawHistory, poolInfo: any) => {
  const winnerAddress = winner.winner.toBase58();

  // Count how many tickets the winner bought
  const ticketsBought = poolInfo?.ticketsSold.filter(
    (ticket: PublicKey) => ticket.toBase58() === winnerAddress,
  ).length;

  // Calculate investment amount
  const investmentAmount = ticketsBought * (poolInfo.ticketPrice / 1e6); // Convert from lamports to SOL

  // Calculate ROI
  const prizeAmountSOL = Number(winner.prizeAmount) / 1e6; // Convert from lamports to SOL
  const roi = prizeAmountSOL - investmentAmount;
  const roiPercentage =
    investmentAmount > 0 ? (roi / investmentAmount) * 100 : 0;

  return {
    ticketsBought,
    investmentAmount,
    roi,
    roiPercentage,
  };
};

export default function RecentWinner() {
  const {connection} = useConnection();
  const {selectedAccount} = useAuthorization();
  const [loading, setLoading] = useState<boolean>(true);
  const [recentWinners, setRecentWinners] = useState<ParsedDrawHistory[]>([]);
  const [pulseAnim] = useState(new Animated.Value(1));
  const [slideAnim] = useState(new Animated.Value(0));

  const {getPoolById, fetchPoolData, fetchMultiplePools, poolsData} =
    useLotteryPool();

  const currentWallet = selectedAccount?.publicKey.toBase58();

  useEffect(() => {
    // Pulse animation for loading
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]),
    );

    if (loading) {
      pulse.start();
    } else {
      pulse.stop();
      // Slide in animation when loaded
      Animated.timing(slideAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }).start();
    }

    return () => pulse.stop();
  }, [loading, pulseAnim, slideAnim]);

  useEffect(() => {
    const fetchRecentWinners = async () => {
      setLoading(true);
      try {
        const accounts = await connection.getProgramAccounts(PROGRAM_ID);

        const parsed: ParsedDrawHistory[] = accounts
          .filter(acc => {
            const expectedSize = 8 + 137; // 8 bytes discriminator + 137 bytes struct
            return acc.account.data.length === expectedSize;
          })
          .map(acc => {
            const data = acc.account.data;

            const pool = new PublicKey(data.slice(8, 40));
            const poolId = data.readBigUInt64LE(40);
            const winner = new PublicKey(data.slice(48, 80));
            const prizeAmount = data.readBigUInt64LE(80);
            const totalTickets = data.readBigUInt64LE(88);
            const drawTimestamp = data.readBigInt64LE(96);
            const winningTicket = data.readBigUInt64LE(104);
            const randomSeed = data.slice(112, 144);
            const bump = data.readUInt8(144);

            return {
              pubkey: acc.pubkey,
              pool,
              poolId,
              winner,
              prizeAmount,
              totalTickets,
              drawTimestamp,
              winningTicket,
              randomSeed,
              bump,
            };
          })
          .filter(draw => isValidWinner(draw.winner));

        const sortedWinners = parsed
          .sort((a, b) => Number(b.drawTimestamp) - Number(a.drawTimestamp))
          .slice(0, 10);

        setRecentWinners(sortedWinners);
      } catch (err) {
        console.error('Failed to fetch recent winners:', err);
        Alert.alert('Error', 'Failed to fetch recent winners');
      } finally {
        setLoading(false);
      }
    };

    fetchRecentWinners();
  }, [connection]);

  useEffect(() => {
    if (recentWinners.length) {
      fetchMultiplePools(
        recentWinners.map(item => item.poolId.toString()).slice(0, 3),
      );
    }
  }, [recentWinners]);

  const formatAmount = (amount: bigint): string => {
    return (Number(amount) / 1e6).toFixed(2);
  };

  const formatDate = (timestamp: bigint): string => {
    const date = new Date(Number(timestamp) * 1000);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  const truncateAddress = (address: string): string => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const isCurrentUserWinner = (winner: ParsedDrawHistory): boolean => {
    return (
      currentWallet !== undefined && winner.winner.toBase58() === currentWallet
    );
  };

  const getWinnerEmoji = (): string => {
    const emojis = ['🎉', '🎊', '🎯', '🔥'];
    return emojis[Math.floor(Math.random() * emojis.length)];
  };

  const isValidWinner = (winner: PublicKey): boolean => {
    const winnerAddress = winner.toBase58();
    return winnerAddress !== SYSTEM_PROGRAM_ADDRESS && winnerAddress !== '';
  };

  const getWinnerColors = (isCurrentUser: boolean) => {
    if (isCurrentUser) {
      return {
        background: 'linear-gradient(135deg, #FFD700, #FFA500)',
        border: '#FFD700',
        glow: '#FFD700',
      };
    }

    // Random vibrant colors for each winner
    const colors = [
      {
        background: 'linear-gradient(135deg, #4A90E2, #357ABD)',
        border: '#4A90E2',
        glow: '#4A90E2',
      },
      {
        background: 'linear-gradient(135deg, #E74C3C, #C0392B)',
        border: '#E74C3C',
        glow: '#E74C3C',
      },
      {
        background: 'linear-gradient(135deg, #9B59B6, #8E44AD)',
        border: '#9B59B6',
        glow: '#9B59B6',
      },
      {
        background: 'linear-gradient(135deg, #1ABC9C, #16A085)',
        border: '#1ABC9C',
        glow: '#1ABC9C',
      },
      {
        background: 'linear-gradient(135deg, #F39C12, #E67E22)',
        border: '#F39C12',
        glow: '#F39C12',
      },
      {
        background: 'linear-gradient(135deg, #2ECC71, #27AE60)',
        border: '#2ECC71',
        glow: '#2ECC71',
      },
    ];

    return colors[Math.floor(Math.random() * colors.length)];
  };

  const formatROIPercentage = (percentage: number): string => {
    return `${percentage >= 0 ? '+' : ''}${percentage.toFixed(1)}%`;
  };

  const getROIColor = (roi: number): string => {
    if (roi > 0) return '#2ECC71'; // Green for positive ROI
    if (roi < 0) return '#E74C3C'; // Red for negative ROI
    return '#999'; // Gray for break-even
  };

  const renderWinnerCard = (winner: ParsedDrawHistory, index: number) => {
    const isCurrentUser = isCurrentUserWinner(winner);
    const winnerColors = getWinnerColors(isCurrentUser);
    const poolData = getPoolById(winner.poolId.toString());
    const roiData = poolData ? calculateROI(winner, poolData) : null;
    const roiColor = roiData ? getROIColor(roiData.roi) : '#999';

    return (
      <Animated.View
        key={winner.pubkey.toString()}
        style={[
          styles.winnerCard,
          isCurrentUser && styles.currentUserCard,
          {
            transform: [
              {
                translateY: slideAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [50, 0],
                }),
              },
            ],
            opacity: slideAnim,
          },
        ]}>
        {/* Glow effect for current user */}
        {isCurrentUser && (
          <View style={[styles.glowEffect, {shadowColor: winnerColors.glow}]} />
        )}

        {/* Current user badge */}
        {isCurrentUser && (
          <View style={styles.yourWinBadge}>
            <Text style={styles.yourWinText}>🎉 YOUR WIN!</Text>
          </View>
        )}

        <View style={styles.cardHeader}>
          <View
            style={[
              styles.winnerBadge,
              {backgroundColor: winnerColors.border},
            ]}>
            <Text style={styles.winnerEmoji}>{getWinnerEmoji()}</Text>
            <Text style={styles.winnerText}>WINNER</Text>
          </View>

          <View style={styles.prizeSection}>
            <Text
              style={[
                styles.prizeAmount,
                isCurrentUser && styles.currentUserPrize,
              ]}>
              ${formatAmount(winner.prizeAmount)}
            </Text>
            <Text style={styles.prizeLabel}>Prize Won</Text>
          </View>
        </View>

        <View style={styles.cardContent}>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>
                {winner.totalTickets.toString()}
              </Text>
              <Text style={styles.statLabel}>Players</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>
                {winner.totalTickets.toString()}
              </Text>
              <Text style={styles.statLabel}>Tickets</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>
                #{winner.winningTicket.toString()}
              </Text>
              <Text style={styles.statLabel}>Lucky #</Text>
            </View>
          </View>

          <View style={styles.detailsSection}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Winner</Text>
              <Text
                style={[
                  styles.detailValue,
                  isCurrentUser && styles.currentUserText,
                ]}>
                {isCurrentUser
                  ? 'You! 🎉'
                  : truncateAddress(winner.winner.toBase58())}
              </Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Pool #</Text>
              <Text style={styles.detailValue}>{winner.poolId.toString()}</Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Draw Date</Text>
              <Text style={styles.detailValue}>
                {formatDate(winner.drawTimestamp)}
              </Text>
            </View>
          </View>

          {poolData && roiData ? (
            <View style={styles.roiSection}>
              <View style={styles.roiStats}>
                <View style={styles.roiItem}>
                  <Text style={styles.roiLabel}>Invested</Text>
                  <Text style={styles.roiValue}>
                    ${roiData.investmentAmount.toFixed(2)}
                  </Text>
                </View>
                <View style={styles.roiItem}>
                  <Text style={styles.roiLabel}>ROI %</Text>
                  <Text style={[styles.roiPercentage, {color: roiColor}]}>
                    {formatROIPercentage(roiData.roiPercentage)}
                  </Text>
                </View>
              </View>
            </View>
          ) : null}
        </View>
      </Animated.View>
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.centered}>
          <Animated.View
            style={[
              styles.loadingContainer,
              {transform: [{scale: pulseAnim}]},
            ]}>
            <Text style={styles.loadingEmoji}>🎰</Text>
            <ActivityIndicator size="large" color="#e5c384" />
          </Animated.View>
          <Text style={styles.loadingText}>Loading recent winners...</Text>
          <Text style={styles.loadingSubtext}>Fetching the hall of fame!</Text>
        </View>
      </View>
    );
  }

  if (recentWinners.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.centered}>
          <Text style={styles.noWinnersEmoji}>🎯</Text>
          <Text style={styles.noWinnersTitle}>No Winners Yet</Text>
          <Text style={styles.noWinnersSubtitle}>
            Be the first legend to claim victory!
          </Text>
          <Text style={styles.noWinnersMotivation}>
            🚀 Your name could be here next! 🚀
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🎊 Recent Winners</Text>
        <Text style={styles.headerSubtitle}>
          {recentWinners.length} recent champion
          {recentWinners.length > 1 ? 's' : ''}
        </Text>
        <View style={styles.headerDecoration}>
          <Text style={styles.decorationText}>🎉 Every win counts! 🎉</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}>
        {recentWinners
          .slice(0, 2)
          .map((winner, index) => renderWinnerCard(winner, index))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 20,
    borderBottomWidth: 2,
    borderBottomColor: '#333',
    backgroundColor: '#1a1a1a',
  },
  headerTitle: {
    color: '#FFD700',
    fontSize: 26,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
    textShadowColor: '#FFD700',
    textShadowOffset: {width: 0, height: 0},
    textShadowRadius: 10,
  },
  headerSubtitle: {
    color: '#e5c384',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 12,
  },
  headerDecoration: {
    alignItems: 'center',
  },
  decorationText: {
    color: '#e5c384',
    fontSize: 14,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 30,
  },
  winnerCard: {
    backgroundColor: '#2a2a2a',
    borderRadius: 20,
    marginBottom: 20,
    padding: 20,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.4,
    shadowRadius: 8,
    borderWidth: 2,
    borderColor: '#404040',
    position: 'relative',
    overflow: 'hidden',
  },
  currentUserCard: {
    backgroundColor: '#3a2f1a',
    borderColor: '#FFD700',
    borderWidth: 3,
  },
  glowEffect: {
    position: 'absolute',
    top: -10,
    left: -10,
    right: -10,
    bottom: -10,
    borderRadius: 25,
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 0.8,
    shadowRadius: 20,
    elevation: 15,
  },
  yourWinBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#FFD700',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    transform: [{rotate: '16deg'}],
    zIndex: 10,
  },
  yourWinText: {
    color: '#1a1a1a',
    fontSize: 12,
    fontWeight: 'bold',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  winnerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 25,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  winnerEmoji: {
    fontSize: 20,
    marginRight: 8,
  },
  winnerText: {
    color: '#1a1a1a',
    fontSize: 14,
    fontWeight: 'bold',
  },
  prizeSection: {
    alignItems: 'flex-end',
  },
  prizeAmount: {
    color: '#e5c384',
    fontSize: 28,
    fontWeight: 'bold',
    textShadowColor: '#e5c384',
    textShadowOffset: {width: 0, height: 0},
    textShadowRadius: 5,
  },
  currentUserPrize: {
    color: '#FFD700',
    textShadowColor: '#FFD700',
  },
  prizeLabel: {
    color: '#ccc',
    fontSize: 12,
    marginTop: 4,
  },
  cardContent: {
    gap: 16,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 15,
    paddingVertical: 16,
    paddingHorizontal: 12,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statNumber: {
    color: '#e5c384',
    fontSize: 18,
    fontWeight: 'bold',
    fontFamily: 'monospace',
  },
  statLabel: {
    color: '#999',
    fontSize: 12,
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#404040',
    marginHorizontal: 8,
  },
  detailsSection: {
    gap: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    color: '#999',
    fontSize: 14,
    fontWeight: '500',
  },
  detailValue: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'monospace',
  },
  currentUserText: {
    color: '#FFD700',
    fontWeight: 'bold',
  },
  oddsSection: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
  },
  oddsText: {
    color: '#ccc',
    fontSize: 12,
    marginBottom: 8,
    textAlign: 'center',
  },
  oddsBar: {
    height: 4,
    backgroundColor: '#333',
    borderRadius: 2,
    overflow: 'hidden',
  },
  oddsBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  loadingContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  loadingEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  loadingText: {
    color: '#e5c384',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  loadingSubtext: {
    color: '#ccc',
    fontSize: 14,
    textAlign: 'center',
  },
  noWinnersEmoji: {
    fontSize: 72,
    marginBottom: 24,
  },
  noWinnersTitle: {
    color: '#e5c384',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  noWinnersSubtitle: {
    color: '#ccc',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
  },
  noWinnersMotivation: {
    color: '#FFD700',
    fontSize: 14,
    textAlign: 'center',
    fontWeight: 'bold',
  },
  roiSection: {
    backgroundColor: '#1a1a1a',
    borderRadius: 15,
    padding: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  roiHeader: {
    alignItems: 'center',
    marginBottom: 12,
  },
  roiTitle: {
    color: '#FFD700',
    fontSize: 16,
    fontWeight: 'bold',
  },
  roiStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  roiItem: {
    alignItems: 'center',
    flex: 1,
  },
  roiLabel: {
    color: '#999',
    fontSize: 12,
    marginBottom: 4,
  },
  roiValue: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: 'monospace',
  },
  roiPercentage: {
    fontSize: 18,
    fontWeight: 'bold',
    fontFamily: 'monospace',
  },
});
