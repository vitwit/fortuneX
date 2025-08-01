import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  Animated,
  ScrollView,
  BackHandler,
} from 'react-native';
import {useConnection} from '../components/providers/ConnectionProvider';
import {PublicKey} from '@solana/web3.js';
import {Buffer} from 'buffer';
import {useNavigation} from './providers/NavigationProvider';
import {PROGRAM_ID} from '../util/constants';

const LOTTERY_POOL_SEED = Buffer.from('lottery_pool');
const TICKET_PRICE = 10_000_000;

const LotteryPoolInfo = () => {
  const {connection} = useConnection();
  const {params, goBack} = useNavigation();
  const [loading, setLoading] = useState(true);
  const [poolData, setPoolData] = useState<any>(null);
  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(30));

  const poolId = params?.poolId;

  // Get Lottery Pool PDA
  const getLotteryPoolPDA = (poolId: number): PublicKey => {
    const poolIdBuffer = Buffer.alloc(8);
    poolIdBuffer.writeBigUInt64LE(BigInt(poolId), 0);
    const [pda] = PublicKey.findProgramAddressSync(
      [LOTTERY_POOL_SEED, poolIdBuffer],
      PROGRAM_ID,
    );
    return pda;
  };

  const formatUSDC = (amount: number) => (amount / 1_000_000).toFixed(2);

  // Calculate total potential prize pool (10 tickets × ticket price)
  const MAX_TICKETS = 10;
  const totalPotentialPrizePool = MAX_TICKETS * TICKET_PRICE;
  const currentPrizePool = poolData?.ticketsSold * TICKET_PRICE || 0;

  const getStatusText = (status: number) => {
    switch (status) {
      case 0:
        return 'OPEN';
      case 1:
        return 'DRAWING';
      case 2:
        return 'CLOSED';
      default:
        return 'UNKNOWN';
    }
  };

  const getStatusColor = (status: number) => {
    switch (status) {
      case 0:
        return '#10B981'; // Green for open
      case 1:
        return '#F59E0B'; // Yellow for drawing
      case 2:
        return '#EF4444'; // Red for closed
      default:
        return '#6B7280'; // Gray for unknown
    }
  };

  // Parse Buffer into Pool Data
  const parsePoolData = (data: Buffer): any => {
    const view = new DataView(data.buffer);
    let offset = 8;

    const poolId = view.getBigUint64(offset, true);
    offset += 8;

    const status = view.getUint8(offset);
    offset += 1;

    const prizePool = view.getBigUint64(offset, true);
    offset += 8;

    const participantsLength = view.getUint32(offset, true);
    offset += 4;

    const participants = [];
    for (let i = 0; i < participantsLength; i++) {
      const pubkeyBytes = new Uint8Array(data.buffer, offset, 32);
      participants.push(new PublicKey(pubkeyBytes).toString());
      offset += 32;
    }

    const ticketsSold = view.getBigUint64(offset, true);
    offset += 8;

    const drawInterval = view.getBigInt64(offset, true);
    offset += 8;

    const drawTime = view.getBigInt64(offset, true);
    offset += 8;

    const createdAt = view.getBigInt64(offset, true);
    offset += 8;

    const bump = view.getUint8(offset);

    return {
      poolId: Number(poolId),
      status,
      prizePool: Number(prizePool),
      participants,
      ticketsSold: Number(ticketsSold),
      drawInterval: Number(drawInterval),
      drawTime: Number(drawTime),
      createdAt: Number(createdAt),
      bump,
    };
  };

  const fetchPoolData = async () => {
    try {
      setLoading(true);
      const pda = getLotteryPoolPDA(poolId);
      const info = await connection.getAccountInfo(pda);

      if (info?.data) {
        const parsed = parsePoolData(info.data);
        setPoolData(parsed);
      } else {
        setPoolData(null);
      }
    } catch (err) {
      console.error('Error loading pool data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPoolData();
  }, [poolId]);

  // Entrance animation
  useEffect(() => {
    if (!loading) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [loading, fadeAnim, slideAnim]);

  useEffect(() => {
    const onBackPress = () => {
      goBack();
      return true; // prevent default behavior
    };

    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      onBackPress,
    );

    return () => backHandler.remove(); // cleanup
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.loadingCard}>
          <ActivityIndicator size="large" color="#10B981" />
          <Text style={styles.loadingText}>Loading Pool #{poolId}...</Text>
        </View>
      </View>
    );
  }

  if (!poolData) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.errorCard}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorTitle}>Pool Not Found</Text>
          <Text style={styles.errorText}>
            Pool #{poolId} could not be found.
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchPoolData}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Back Button */}
      <View style={styles.backButtonContainer}>
        <TouchableOpacity style={styles.backButton} onPress={goBack}>
          <Text style={styles.backButtonIcon}>←</Text>
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
      </View>

      <Animated.View
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [{translateY: slideAnim}],
          },
        ]}>
        {/* Pool Header Card */}
        <View style={styles.headerCard}>
          <View style={styles.poolHeader}>
            <View style={styles.poolIcon}>
              <Text style={styles.poolIconText}>🎰</Text>
            </View>
            <View style={styles.poolInfo}>
              <Text style={styles.poolTitle}>Pool #{poolData.poolId}</Text>
              <Text style={styles.poolSubtitle}>Lottery Pool Details</Text>
            </View>
            <View
              style={[
                styles.statusBadge,
                {backgroundColor: getStatusColor(poolData.status)},
              ]}>
              <Text style={styles.statusText}>
                {getStatusText(poolData.status)}
              </Text>
            </View>
          </View>
        </View>

        {/* Prize Pool Card */}
        <View style={styles.prizeCard}>
          <View style={styles.prizeHeader}>
            <Text style={styles.prizeLabel}>💰 Total Prize Pool</Text>
          </View>
          <Text style={styles.prizeAmount}>
            ${formatUSDC(currentPrizePool)}/$
            {formatUSDC(totalPotentialPrizePool)}
          </Text>
          <Text style={styles.prizeSubtext}>USDC</Text>

          {/* Progress Bar */}
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${Math.min(
                      (poolData.ticketsSold / MAX_TICKETS) * 100,
                      100,
                    )}%`,
                  },
                ]}
              />
            </View>
            <Text style={styles.progressText}>
              {((poolData.ticketsSold / MAX_TICKETS) * 100).toFixed(1)}%
              Complete
            </Text>
          </View>

          {/* Pool Stats */}
          <View style={styles.poolStats}>
            <View style={styles.poolStatItem}>
              <Text style={styles.poolStatLabel}>Participants:</Text>
              <Text style={styles.poolStatValue}>
                {poolData.participants.length}
              </Text>
            </View>
            <View style={styles.poolStatItem}>
              <Text style={styles.poolStatLabel}>Ticket Price:</Text>
              <Text style={styles.poolStatValue}>
                ${formatUSDC(TICKET_PRICE)}
              </Text>
            </View>
            <View style={styles.poolStatItem}>
              <Text style={styles.poolStatLabel}>Tickets Sold:</Text>
              <Text style={styles.poolStatValue}>
                {poolData.ticketsSold}/{MAX_TICKETS}
              </Text>
            </View>
            <View style={styles.poolStatItem}>
              <Text style={styles.poolStatLabel}>Draw Time:</Text>
              <Text style={styles.poolStatValue}>
                {new Date(poolData.drawTime * 1000).toLocaleDateString()}{' '}
                {new Date(poolData.drawTime * 1000).toLocaleTimeString()}
              </Text>
            </View>
          </View>
        </View>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statIcon}>🎯</Text>
            <Text style={styles.statValue}>
              {poolData.status === 0
                ? 'Open'
                : poolData.status === 1
                ? 'Drawing'
                : 'Closed'}
            </Text>
            <Text style={styles.statLabel}>Pool Status</Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statIcon}>⏳</Text>
            <Text style={styles.statValue}>
              {poolData.drawTime * 1000 > Date.now() ? 'Upcoming' : 'Completed'}
            </Text>
            <Text style={styles.statLabel}>Draw Status</Text>
          </View>
        </View>

        {/* Draw Time Card */}
        <View style={styles.drawTimeCard}>
          <View style={styles.drawTimeHeader}>
            <Text style={styles.drawTimeIcon}>⏰</Text>
            <Text style={styles.drawTimeLabel}>Next Draw</Text>
          </View>
          <Text style={styles.drawTimeValue}>
            {new Date(poolData.drawTime * 1000).toLocaleString()}
          </Text>
          <Text style={styles.drawTimeSubtext}>
            {poolData.drawTime * 1000 > Date.now()
              ? `${Math.ceil(
                  (poolData.drawTime * 1000 - Date.now()) / (1000 * 60 * 60),
                )} hours remaining`
              : 'Draw completed'}
          </Text>
        </View>

        {/* Participants Card */}
        {poolData.participants.length > 0 && (
          <View style={styles.participantsCard}>
            <Text style={styles.participantsTitle}>👥 Participants</Text>
            <View style={styles.participantsList}>
              {poolData.participants
                .slice(0, 5)
                .map((participant: string, index: number) => (
                  <View key={index} style={styles.participantItem}>
                    <Text style={styles.participantAddress}>
                      {participant.slice(0, 6)}...{participant.slice(-4)}
                    </Text>
                  </View>
                ))}
              {poolData.participants.length > 5 && (
                <Text style={styles.moreParticipants}>
                  +{poolData.participants.length - 5} more
                </Text>
              )}
            </View>
          </View>
        )}

        {/* Buy Ticket Button */}
        <TouchableOpacity
          style={[
            styles.buyTicketButton,
            poolData.status !== 0 && styles.buyTicketButtonDisabled,
          ]}
          onPress={() => console.log('Buy ticket for pool', poolData.poolId)}
          disabled={poolData.status !== 0}>
          <Text style={styles.buyTicketButtonText}>
            {poolData.status === 0 ? '🎟️ Buy Ticket' : '🔒 Pool Closed'}
          </Text>
          {poolData.status === 0 && (
            <Text style={styles.buyTicketPrice}>
              ${formatUSDC(TICKET_PRICE)}
            </Text>
          )}
        </TouchableOpacity>

        {/* Pool Details */}
        <View style={styles.detailsCard}>
          <Text style={styles.detailsTitle}>📊 Pool Details</Text>
          <View style={styles.detailsContent}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Created At:</Text>
              <Text style={styles.detailValue}>
                {new Date(poolData.createdAt * 1000).toLocaleDateString()}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Draw Interval:</Text>
              <Text style={styles.detailValue}>
                {Math.floor(poolData.drawInterval / 3600)} hours
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Ticket Price:</Text>
              <Text style={styles.detailValue}>
                ${formatUSDC(TICKET_PRICE)}
              </Text>
            </View>
          </View>
        </View>
      </Animated.View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F23',
  },
  backButtonContainer: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 10,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F1F37',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 12,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#2D2D44',
  },
  backButtonIcon: {
    fontSize: 18,
    color: '#10B981',
    marginRight: 8,
    fontWeight: 'bold',
  },
  backButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  content: {
    padding: 20,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0F0F23',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingCard: {
    backgroundColor: '#1F1F37',
    borderRadius: 16,
    padding: 30,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2D2D44',
  },
  loadingText: {
    color: '#FFFFFF',
    fontSize: 16,
    marginTop: 15,
    fontWeight: '600',
  },
  errorCard: {
    backgroundColor: '#1F1F37',
    borderRadius: 16,
    padding: 30,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2D2D44',
    maxWidth: 300,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 15,
  },
  errorTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  errorText: {
    color: '#9CA3AF',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#10B981',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  headerCard: {
    backgroundColor: '#1F1F37',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#2D2D44',
  },
  poolHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  poolIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  poolIconText: {
    fontSize: 24,
  },
  poolInfo: {
    flex: 1,
  },
  poolTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  poolSubtitle: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  statusText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  prizeCard: {
    backgroundColor: '#1F1F37',
    borderRadius: 16,
    padding: 25,
    marginBottom: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2D2D44',
  },
  prizeHeader: {
    marginBottom: 10,
  },
  prizeLabel: {
    fontSize: 16,
    color: '#9CA3AF',
    fontWeight: '600',
  },
  prizeAmount: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#10B981',
    marginBottom: 5,
  },
  prizeSubtext: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
    marginBottom: 20,
  },
  progressContainer: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 20,
  },
  progressBar: {
    width: '100%',
    height: 8,
    backgroundColor: '#2D2D44',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#10B981',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    color: '#9CA3AF',
    fontWeight: '600',
  },
  poolStats: {
    width: '100%',
    gap: 8,
  },
  poolStatItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  poolStatLabel: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  poolStatValue: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 15,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#1F1F37',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2D2D44',
  },
  statIcon: {
    fontSize: 24,
    marginBottom: 10,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 5,
  },
  statLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  drawTimeCard: {
    backgroundColor: '#1F1F37',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#2D2D44',
  },
  drawTimeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  drawTimeIcon: {
    fontSize: 20,
    marginRight: 10,
  },
  drawTimeLabel: {
    fontSize: 16,
    color: '#9CA3AF',
    fontWeight: '600',
  },
  drawTimeValue: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: '600',
    marginBottom: 5,
  },
  drawTimeSubtext: {
    fontSize: 14,
    color: '#6B7280',
  },
  participantsCard: {
    backgroundColor: '#1F1F37',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#2D2D44',
  },
  participantsTitle: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
    marginBottom: 15,
  },
  participantsList: {
    gap: 10,
  },
  participantItem: {
    backgroundColor: '#2D2D44',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 10,
  },
  participantAddress: {
    fontSize: 14,
    color: '#9CA3AF',
    fontFamily: 'monospace',
  },
  moreParticipants: {
    fontSize: 14,
    color: '#6B7280',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 5,
  },
  buyTicketButton: {
    backgroundColor: '#10B981',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#059669',
  },
  buyTicketButtonDisabled: {
    backgroundColor: '#374151',
    borderColor: '#4B5563',
  },
  buyTicketButtonText: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: 'bold',
    marginBottom: 5,
  },
  buyTicketPrice: {
    fontSize: 14,
    color: '#FFFFFF',
    opacity: 0.8,
  },
  detailsCard: {
    backgroundColor: '#1F1F37',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#2D2D44',
  },
  detailsTitle: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
    marginBottom: 15,
  },
  detailsContent: {
    gap: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  detailValue: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
  },
});

export default LotteryPoolInfo;
