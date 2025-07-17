import {PublicKey} from '@solana/web3.js';
import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  Dimensions,
} from 'react-native';

// Pool Status Enum
enum PoolStatus {
  Active = 0,
  Drawing = 1,
  Completed = 2,
  Cancelled = 3,
}

// Type definitions
interface LotteryPoolData {
  poolId: number;
  status: PoolStatus;
  prizePool: number;
  ticketsSold: PublicKey[];
  drawInterval: number;
  drawTime: number;
  createdAt: number;
  bump: number;
  address: string;
  ticketPrice: number;
  maxTickets: number;
  minTickets: number;
}

interface PoolInfoComponentProps {
  poolData: LotteryPoolData;
  onClose: () => void;
}

const {width, height} = Dimensions.get('window');

export default function PoolInfoComponent({
  poolData,
  onClose,
}: PoolInfoComponentProps): JSX.Element {
  const [pulseAnim] = useState(new Animated.Value(1));
  const [slideAnim] = useState(new Animated.Value(height));
  const [now, setNow] = useState(Date.now() / 1000);

  // Animate component entrance
  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 100,
      friction: 8,
    }).start();
  }, [slideAnim]);

  // Pulse animation for live status
  useEffect(() => {
    if (poolData.status === PoolStatus.Active) {
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
      pulse.start();
      return () => pulse.stop();
    }
  }, [pulseAnim, poolData.status]);

  // Update current time every second
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now() / 1000);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Function to get status text
  const getStatusText = (status: PoolStatus): string => {
    switch (status) {
      case PoolStatus.Active:
        return 'LIVE';
      case PoolStatus.Drawing:
        return 'DRAWING';
      case PoolStatus.Completed:
        return 'COMPLETED';
      case PoolStatus.Cancelled:
        return 'CANCELLED';
      default:
        return 'UNKNOWN';
    }
  };

  // Function to get status color
  const getStatusColor = (status: PoolStatus): string => {
    switch (status) {
      case PoolStatus.Active:
        return '#10B981';
      case PoolStatus.Drawing:
        return '#F59E0B';
      case PoolStatus.Completed:
        return '#6B7280';
      case PoolStatus.Cancelled:
        return '#EF4444';
      default:
        return '#6B7280';
    }
  };

  // Function to get pool type based on prize pool
  const getPoolType = (prizePool: number): {type: string; color: string} => {
    const amount = prizePool / 1_000_000;
    if (amount >= 500) {
      return {type: 'MEGA', color: '#10B981'};
    } else if (amount >= 100) {
      return {type: 'DAILY', color: '#7C3AED'};
    } else {
      return {type: 'FLASH', color: '#F59E0B'};
    }
  };

  // Function to format USDC amount
  const formatUSDC = (amount: number): string => {
    return (amount / 1_000_000).toFixed(2);
  };

  // Function to format time
  const formatTime = (timestamp: number): string => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleString();
  };

  // Function to get time remaining
  const getTimeRemaining = (drawTime: number): string => {
    const remaining = drawTime - now;

    if (remaining <= 0) return 'Completed';

    const days = Math.floor(remaining / (3600 * 24));
    const hours = Math.floor((remaining % (3600 * 24)) / 3600);
    const minutes = Math.floor((remaining % 3600) / 60);
    const seconds = Math.floor(remaining % 60);

    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m ${seconds}s`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  };

  // Function to handle close with animation
  const handleClose = () => {
    Animated.timing(slideAnim, {
      toValue: height,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      onClose();
    });
  };

  const soldCount = poolData.ticketsSold.length;
  const totalTickets = poolData.maxTickets;
  const progress = (soldCount / totalTickets) * 100;
  const statusColor = getStatusColor(poolData.status);
  const isActive = poolData.status === PoolStatus.Active;
  const remainingTickets = totalTickets - soldCount;
  const poolType = getPoolType(poolData.prizePool);
  const maxPrizePool = poolData.ticketPrice * poolData.maxTickets;

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.content,
          {
            transform: [{translateY: slideAnim}],
          },
        ]}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerTitle}>Pool Details</Text>
            <Text style={styles.headerSubtitle}>#{poolData.poolId}</Text>
          </View>
          <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}>
          {/* Pool Type and Status */}
          <View style={styles.statusContainer}>
            <View style={[styles.poolType, {backgroundColor: poolType.color}]}>
              <Text style={styles.poolTypeText}>{poolType.type}</Text>
            </View>
            <View style={styles.poolStatus}>
              {isActive ? (
                <Animated.View
                  style={[
                    styles.liveDot,
                    {
                      backgroundColor: '#10B981',
                      transform: [{scale: pulseAnim}],
                    },
                  ]}
                />
              ) : (
                <View
                  style={[styles.liveDot, {backgroundColor: statusColor}]}
                />
              )}
              <Text style={[styles.poolStatusText, {color: statusColor}]}>
                {getStatusText(poolData.status)}
              </Text>
            </View>
          </View>

          {/* Prize Pool */}
          <View style={styles.prizeSection}>
            <Text style={styles.sectionTitle}>Prize Pool</Text>
            <View style={styles.prizeContainer}>
              <Text style={styles.currentPrize}>
                ${formatUSDC(maxPrizePool)}
              </Text>
            </View>
          </View>

          {/* Progress Bar */}
          <View style={styles.progressSection}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressTitle}>Ticket Sales Progress</Text>
              <Text style={styles.progressPercentage}>
                {progress.toFixed(1)}%
              </Text>
            </View>
            <View style={styles.progressBackground}>
              <View
                style={[
                  styles.progressFill,
                  {width: `${progress}%`, backgroundColor: poolType.color},
                ]}
              />
            </View>
            <Text style={styles.progressText}>
              {soldCount} of {totalTickets} tickets sold
            </Text>
          </View>

          {/* Pool Information */}
          <View style={styles.infoSection}>
            <Text style={styles.sectionTitle}>Pool Information</Text>
            <View style={styles.infoGrid}>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Ticket Price</Text>
                <Text style={styles.infoValue}>
                  ${formatUSDC(poolData.ticketPrice)}
                </Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Tickets Sold</Text>
                <Text style={styles.infoValue}>
                  {soldCount}/{totalTickets}
                </Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Remaining Tickets</Text>
                <Text style={styles.infoValue}>{remainingTickets}</Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Min Tickets</Text>
                <Text style={styles.infoValue}>{poolData.minTickets}</Text>
              </View>
            </View>
          </View>

          {/* Timing Information */}
          <View style={styles.timingSection}>
            <Text style={styles.sectionTitle}>Timing Information</Text>
            <View style={styles.timingGrid}>
              <View style={styles.timingItem}>
                <Text style={styles.timingLabel}>Created At</Text>
                <Text style={styles.timingValue}>
                  {formatTime(poolData.createdAt)}
                </Text>
              </View>
              {poolData.drawTime > 0 && (
                <View style={styles.timingItem}>
                  <Text style={styles.timingLabel}>Draw Time</Text>
                  <Text style={styles.timingValue}>
                    {formatTime(poolData.drawTime)}
                  </Text>
                </View>
              )}
              {poolData.drawTime > 0 && (
                <View style={styles.timingItem}>
                  <Text style={styles.timingLabel}>
                    {poolData.drawTime > now ? 'Time Remaining' : 'Status'}
                  </Text>
                  <Text
                    style={[
                      styles.timingValue,
                      {
                        color: poolData.drawTime > now ? '#10B981' : '#EF4444',
                      },
                    ]}>
                    {getTimeRemaining(poolData.drawTime)}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Technical Details */}
          <View style={styles.technicalSection}>
            <Text style={styles.sectionTitle}>Technical Details</Text>
            <View style={styles.technicalGrid}>
              <View style={styles.technicalItem}>
                <Text style={styles.technicalLabel}>Pool Address</Text>
                <Text style={styles.technicalValue} numberOfLines={1}>
                  {poolData.address}
                </Text>
              </View>
            </View>
          </View>

          {/* Bottom spacing */}
          <View style={{height: 40}} />
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  content: {
    flex: 1,
    backgroundColor: '#0A0A0A',
    marginTop: 50,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A2A',
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#9CA3AF',
    marginTop: 2,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#2A2A2A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  scrollView: {
    flex: 1,
  },
  statusContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  poolType: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
  },
  poolTypeText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  poolStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  liveDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  poolStatusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  prizeSection: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A2A',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  prizeContainer: {
    alignItems: 'center',
  },
  currentPrize: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#10B981',
  },
  maxPrize: {
    fontSize: 16,
    color: '#9CA3AF',
    marginTop: 4,
  },
  progressSection: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A2A',
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  progressTitle: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  progressPercentage: {
    fontSize: 16,
    color: '#10B981',
    fontWeight: 'bold',
  },
  progressBackground: {
    height: 8,
    backgroundColor: '#2A2A2A',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  infoSection: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A2A',
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  infoItem: {
    width: '48%',
    backgroundColor: '#1A1A1A',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  infoLabel: {
    fontSize: 14,
    color: '#9CA3AF',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  timingSection: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A2A',
  },
  timingGrid: {
    gap: 12,
  },
  timingItem: {
    backgroundColor: '#1A1A1A',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  timingLabel: {
    fontSize: 14,
    color: '#9CA3AF',
    marginBottom: 4,
  },
  timingValue: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  technicalSection: {
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  technicalGrid: {
    gap: 12,
  },
  technicalItem: {
    backgroundColor: '#1A1A1A',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  technicalLabel: {
    fontSize: 14,
    color: '#9CA3AF',
    marginBottom: 4,
  },
  technicalValue: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
    fontFamily: 'monospace',
  },
});
