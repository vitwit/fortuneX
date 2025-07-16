import React, {useState, useCallback, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Animated,
  ActivityIndicator,
  FlatList,
  ListRenderItem,
} from 'react-native';
import {fromUint8Array} from 'js-base64';
import {
  transact,
  Web3MobileWallet,
} from '@solana-mobile/mobile-wallet-adapter-protocol-web3js';

import {useAuthorization} from './providers/AuthorizationProvider';
import {useConnection} from './providers/ConnectionProvider';
import {alertAndLog} from '../util/alertAndLog';
import {
  PublicKey,
  Transaction,
  SystemProgram,
  TransactionInstruction,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import {sha256} from '@noble/hashes/sha256';
import {Buffer} from 'buffer';
import {useNavigation} from './providers/NavigationProvider';

const {width} = Dimensions.get('window');

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
  participants: PublicKey[];
  ticketsSold: number;
  drawInterval: number;
  drawTime: number;
  createdAt: number;
  bump: number;
  address: string;
}

interface GlobalStateData {
  authority: PublicKey;
  platformWallet: PublicKey;
  usdcMint: PublicKey;
  platformFeeBps: number;
  poolsCount: number;
  creatorsWhitelist: PublicKey[];
  bump: number;
}

export default function LotteryPoolsComponent(): JSX.Element {
  const {connection} = useConnection();
  const {authorizeSession} = useAuthorization();
  const [pools, setPools] = useState<LotteryPoolData[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedPool, setSelectedPool] = useState<LotteryPoolData | null>(
    null,
  );
  const [pulseAnim] = useState(new Animated.Value(1));

  const {params, navigate} = useNavigation();

  // Updated program ID
  const PROGRAM_ID = new PublicKey(
    'HD5X9GyjdqEMLyjP5QsLaKAweor6KQrcqCejf3NXwxpu',
  );

  // Seeds
  const GLOBAL_STATE_SEED = Buffer.from('global_state');
  const LOTTERY_POOL_SEED = Buffer.from('lottery_pool');
  const VAULT_AUTHORITY_SEED = Buffer.from('vault_authority');

  // Constants
  const TICKET_PRICE: number = 10_000_000; // $10 USDC (6 decimals)
  const TOTAL_TICKETS: number = 10;
  const MAX_POOL_AMOUNT: number = 100_000_000; // $100 USDC

  // Pulse animation for the lottery icon
  useEffect(() => {
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
  }, [pulseAnim]);

  // Function to get global state PDA
  const getGlobalStatePDA = (): PublicKey => {
    const [globalStatePDA] = PublicKey.findProgramAddressSync(
      [GLOBAL_STATE_SEED],
      PROGRAM_ID,
    );
    return globalStatePDA;
  };

  // Function to get lottery pool PDA
  const getLotteryPoolPDA = (poolId: number): PublicKey => {
    const poolIdBuffer = Buffer.alloc(8);
    poolIdBuffer.writeBigUInt64LE(BigInt(poolId), 0);

    const [poolPDA] = PublicKey.findProgramAddressSync(
      [LOTTERY_POOL_SEED, poolIdBuffer],
      PROGRAM_ID,
    );
    return poolPDA;
  };

  // Function to get vault authority PDA
  const getVaultAuthorityPDA = (poolId: number): PublicKey => {
    const poolIdBuffer = Buffer.alloc(8);
    poolIdBuffer.writeBigUInt64LE(BigInt(poolId), 0);

    const [vaultAuthorityPDA] = PublicKey.findProgramAddressSync(
      [VAULT_AUTHORITY_SEED, poolIdBuffer],
      PROGRAM_ID,
    );
    return vaultAuthorityPDA;
  };

  // Function to parse pool data
  const parsePoolData = (data: Buffer): LotteryPoolData | null => {
    try {
      const view = new DataView(data.buffer);
      let offset = 8; // Skip discriminator

      const poolId = view.getBigUint64(offset, true);
      offset += 8;

      const status = view.getUint8(offset) as PoolStatus;
      offset += 1;

      const prizePool = view.getBigUint64(offset, true);
      offset += 8;

      // Parse participants vector
      const participantsLength = view.getUint32(offset, true);
      offset += 4;
      const participants: PublicKey[] = [];
      for (let i = 0; i < participantsLength; i++) {
        const pubkeyBytes = new Uint8Array(data.buffer, offset, 32);
        participants.push(new PublicKey(pubkeyBytes));
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
        address: '', // Will be set by caller
      };
    } catch (error) {
      console.error('Error parsing pool data:', error);
      return null;
    }
  };

  // Function to fetch global state
  const fetchGlobalState = useCallback(async (): Promise<number> => {
    try {
      const globalStatePDA = getGlobalStatePDA();
      const accountInfo = await connection.getAccountInfo(globalStatePDA);

      if (accountInfo && accountInfo.data) {
        const view = new DataView(accountInfo.data.buffer);
        let offset = 8; // Skip discriminator

        // Skip authority and platform_wallet (64 bytes)
        offset += 64;

        // Skip usdc_mint (32 bytes)
        offset += 32;

        // Skip platform_fee_bps (2 bytes)
        offset += 2;

        const poolsCount = view.getBigUint64(offset, true);
        return Number(poolsCount);
      }
      return 0;
    } catch (error) {
      console.error('Error fetching global state:', error);
      return 0;
    }
  }, [connection]);

  // Function to fetch all pools
  const fetchPools = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const poolsCount = await fetchGlobalState();
      const poolsData: LotteryPoolData[] = [];

      for (let i = 0; i < poolsCount; i++) {
        try {
          const poolPDA = getLotteryPoolPDA(i);
          const accountInfo = await connection.getAccountInfo(poolPDA);

          if (accountInfo && accountInfo.data) {
            const poolData = parsePoolData(accountInfo.data);
            if (poolData) {
              poolsData.push({
                ...poolData,
                address: poolPDA.toString(),
              });
            }
          }
        } catch (error) {
          console.error(`Error fetching pool ${i}:`, error);
        }
      }

      setPools(poolsData);
    } catch (error) {
      console.error('Error fetching pools:', error);
      alertAndLog('Error', 'Failed to fetch pools');
    } finally {
      setLoading(false);
    }
  }, [connection, fetchGlobalState]);

  // Load pools on component mount
  useEffect(() => {
    fetchPools();
  }, [fetchPools]);

  // Function to get status text
  const getStatusText = (status: PoolStatus): string => {
    switch (status) {
      case PoolStatus.Active:
        return 'ACTIVE';
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

  // Function to format USDC amount
  const formatUSDC = (amount: number): string => {
    return (amount / 1_000_000).toFixed(2);
  };

  // Function to format time
  const formatTime = (timestamp: number): string => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleString();
  };

  // Render pool item
  const renderPoolItem = ({item}: {item: LotteryPoolData}) => {
    const progress = (item.ticketsSold / TOTAL_TICKETS) * 100;
    const statusColor = getStatusColor(item.status);
    const isActive = item.status === PoolStatus.Active;

    return (
      <TouchableOpacity
        key={item.poolId}
        style={[
          styles.poolCard,
          selectedPool?.poolId === item.poolId && styles.selectedPoolCard,
        ]}
        onPress={() => {
          navigate('Pool', {poolId: item.poolId});
        }}
        disabled={!isActive}>
        <View style={styles.poolHeader}>
          <Text style={styles.poolTitle}>Pool #{item.poolId}</Text>
          <View style={[styles.statusBadge, {backgroundColor: statusColor}]}>
            <Text style={styles.statusText}>{getStatusText(item.status)}</Text>
          </View>
        </View>

        <View style={styles.poolStats}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Prize Pool</Text>
            <Text style={styles.statValue}>${formatUSDC(item.prizePool)}</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Tickets Sold</Text>
            <Text style={styles.statValue}>
              {item.ticketsSold}/{TOTAL_TICKETS}
            </Text>
          </View>
        </View>

        <View style={styles.progressContainer}>
          <View style={styles.progressBackground}>
            <View
              style={[
                styles.progressFill,
                {width: `${progress}%`, backgroundColor: statusColor},
              ]}
            />
          </View>
          <Text style={styles.progressText}>
            {progress.toFixed(1)}% Complete
          </Text>
        </View>

        <View style={styles.poolDetails}>
          <Text style={styles.detailText}>
            Participants: {item.participants.length}
          </Text>
          <Text style={styles.detailText}>
            Ticket Price: ${formatUSDC(TICKET_PRICE)}
          </Text>
          {item.drawTime > 0 && (
            <Text style={styles.detailText}>
              Draw Time: {formatTime(item.drawTime)}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyComponent = (): JSX.Element => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>
        {loading ? 'Loading pools...' : 'No pools available'}
      </Text>
    </View>
  );

  const renderLoadingContainer = (): JSX.Element => (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="small" color="#9CA3AF" />
      <Text style={styles.refreshButtonText}>Loading...</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header Section */}
      <View style={styles.header}>
        <Animated.View
          style={[
            styles.iconContainer,
            {
              transform: [{scale: pulseAnim}],
            },
          ]}>
          <Text style={styles.lotteryIcon}>🎰</Text>
        </Animated.View>
        <Text style={styles.title}>FortuneX Pools</Text>
        <Text style={styles.subtitle}>Choose a pool to join the lottery!</Text>
      </View>

      {/* Refresh Button */}
      <TouchableOpacity
        style={[styles.refreshButton, loading && styles.refreshButtonDisabled]}
        onPress={fetchPools}
        disabled={loading}>
        {loading ? (
          renderLoadingContainer()
        ) : (
          <Text style={styles.refreshButtonText}>🔄 Refresh Pools</Text>
        )}
      </TouchableOpacity>

      {/* Pools List */}
      <View style={styles.poolsList}>
        {pools.length === 0
          ? renderEmptyComponent()
          : pools.map(item => renderPoolItem({item}))}
      </View>

      {/* Selected Pool Info */}
      {selectedPool && (
        <View style={styles.selectedPoolInfo}>
          <Text style={styles.selectedPoolTitle}>
            Selected: Pool #{selectedPool.poolId}
          </Text>
          <Text style={styles.selectedPoolDetails}>
            Ready for operations - implement buy ticket, view details, etc.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F23',
  },
  header: {
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  iconContainer: {
    marginBottom: 15,
  },
  lotteryIcon: {
    fontSize: 60,
    textAlign: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 16,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  refreshButton: {
    backgroundColor: '#374151',
    marginHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#4B5563',
  },
  refreshButtonDisabled: {
    opacity: 0.5,
  },
  refreshButtonText: {
    color: '#9CA3AF',
    fontSize: 14,
    fontWeight: '600',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  poolsList: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  poolCard: {
    backgroundColor: '#1F1F37',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2D2D44',
  },
  selectedPoolCard: {
    borderColor: '#10B981',
    borderWidth: 2,
  },
  poolHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  poolTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  poolStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  progressContainer: {
    marginBottom: 16,
  },
  progressBackground: {
    height: 6,
    backgroundColor: '#2D2D44',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  poolDetails: {
    gap: 4,
  },
  detailText: {
    fontSize: 12,
    color: '#D1D5DB',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  selectedPoolInfo: {
    backgroundColor: '#1F1F37',
    margin: 20,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#10B981',
  },
  selectedPoolTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#10B981',
    marginBottom: 4,
  },
  selectedPoolDetails: {
    fontSize: 14,
    color: '#9CA3AF',
  },
});
