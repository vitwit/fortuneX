import React, {useState, useCallback, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Animated,
  ActivityIndicator,
  ScrollView,
  Modal,
  TextInput,
  Alert,
} from 'react-native';

import {useAuthorization} from './providers/AuthorizationProvider';
import {useConnection} from './providers/ConnectionProvider';
import {alertAndLog} from '../util/alertAndLog';
import {PublicKey, SystemProgram} from '@solana/web3.js';
import {Buffer} from 'buffer';
import ConnectButton from './ConnectButton';
import {getAssociatedTokenAddress, TOKEN_PROGRAM_ID} from '@solana/spl-token';
import {
  Web3MobileWallet,
  transact,
} from '@solana-mobile/mobile-wallet-adapter-protocol-web3js';
import {TransactionInstruction} from '@solana/web3.js';
import {Transaction} from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import {sha256} from '@noble/hashes/sha256';

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

// const GLOBAL_STATE_SEED = 'global_state';
// const LOTTERY_POOL_SEED = 'lottery_pool';
// const VAULT_AUTHORITY_SEED = 'vault_authority';
// const USER_TICKET_SEED = 'user_ticket';

const USDC_MINT = new PublicKey('EuURVxuHfvmb1y5AanMob4PF4DFhi7fn4t6F3kSTjHPz');

export default function LotteryPoolsComponent({
  horizontalView = true,
  showActive = true,
}: {
  horizontalView?: boolean;
  showActive?: boolean;
}): JSX.Element {
  const {connection} = useConnection();
  const [pools, setPools] = useState<LotteryPoolData[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const [selectedPool, setSelectedPool] = useState<LotteryPoolData | null>(
    null,
  );
  const [ticketCount, setTicketCount] = useState<string>('1');
  const {selectedAccount, authorizeSession} = useAuthorization();
  const [signingInProgress, setSigningInProgress] = useState(false);

  const [pulseAnim] = useState(new Animated.Value(1.2));

  // Updated program ID
  const PROGRAM_ID = new PublicKey(
    'HD5X9GyjdqEMLyjP5QsLaKAweor6KQrcqCejf3NXwxpu',
  );

  // Seeds
  const GLOBAL_STATE_SEED = Buffer.from('global_state');
  const LOTTERY_POOL_SEED = Buffer.from('lottery_pool');
  const VAULT_AUTHORITY_SEED = Buffer.from('vault_authority');
  const USER_TICKET_SEED = Buffer.from('user_ticket');

  // TODO: make this dynamic
  const TICKET_PRICE: number = 10_000_000; // $10 USDC (6 decimals)
  const TOTAL_TICKETS: number = 5;

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

    if (remaining <= 0) return '0s';

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

  // Function to handle buy ticket button press
  const handleBuyTicket = (pool: LotteryPoolData) => {
    setSelectedPool(pool);
    setTicketCount('1');
    setModalVisible(true);
  };

  // Function to handle ticket count change
  const handleTicketCountChange = (value: string) => {
    // Only allow numbers
    const numericValue = value.replace(/[^0-9]/g, '');
    setTicketCount(numericValue);
  };

  const createBuyTicketTransaction = useCallback(
    async (poolId: number, quantity: number) => {
      if (!selectedPool || !quantity || quantity <= 0) {
        Alert.alert('Error', 'Invalid ticket quantity');
        return;
      }

      return await transact(async (wallet: Web3MobileWallet) => {
        const [authorizationResult, latestBlockhash] = await Promise.all([
          authorizeSession(wallet),
          connection.getLatestBlockhash(),
        ]);

        const userPubkey = authorizationResult.publicKey;

        // Find PDAs
        const [globalStatePda] = PublicKey.findProgramAddressSync(
          [GLOBAL_STATE_SEED],
          PROGRAM_ID,
        );

        const [lotteryPoolPda] = PublicKey.findProgramAddressSync(
          [
            LOTTERY_POOL_SEED,
            new anchor.BN(poolId).toArrayLike(Buffer, 'le', 8),
          ],
          PROGRAM_ID,
        );

        const [poolTokenAccount] = PublicKey.findProgramAddressSync(
          [
            VAULT_AUTHORITY_SEED,
            new anchor.BN(poolId).toArrayLike(Buffer, 'le', 8),
          ],
          PROGRAM_ID,
        );

        const [userTicketPda] = PublicKey.findProgramAddressSync(
          [
            USER_TICKET_SEED,
            userPubkey.toBuffer(),
            new anchor.BN(poolId).toArrayLike(Buffer, 'le', 8),
          ],
          PROGRAM_ID,
        );

        // Get user's USDC token account
        const userTokenAccount = await getAssociatedTokenAddress(
          USDC_MINT,
          userPubkey,
        );

        // Check user's USDC balance
        const tokenAccountInfo = await connection.getTokenAccountBalance(
          userTokenAccount,
        );
        const userBalance = tokenAccountInfo.value.amount;
        const totalCost = quantity * TICKET_PRICE;

        if (parseInt(userBalance) < totalCost) {
          throw new Error('Insufficient USDC balance for ticket purchase');
        }

        // Create instruction data
        const discriminator = Buffer.from(
          sha256('global:buy_ticket').slice(0, 8),
        );
        const poolIdBuffer = new Uint8Array(8);
        const quantityBuffer = new Uint8Array(8);

        new DataView(poolIdBuffer.buffer).setBigUint64(0, BigInt(poolId), true);
        new DataView(quantityBuffer.buffer).setBigUint64(
          0,
          BigInt(quantity),
          true,
        );

        const ixData = new Uint8Array(
          discriminator.length + poolIdBuffer.length + quantityBuffer.length,
        );
        ixData.set(discriminator, 0);
        ixData.set(poolIdBuffer, discriminator.length);
        ixData.set(quantityBuffer, discriminator.length + poolIdBuffer.length);

        // Create instruction accounts
        const keys = [
          {pubkey: globalStatePda, isSigner: false, isWritable: true},
          {pubkey: lotteryPoolPda, isSigner: false, isWritable: true},
          {pubkey: userTicketPda, isSigner: false, isWritable: true},
          {pubkey: userTokenAccount, isSigner: false, isWritable: true},
          {pubkey: poolTokenAccount, isSigner: false, isWritable: true},
          {pubkey: userPubkey, isSigner: true, isWritable: false},
          {pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false},
          {pubkey: SystemProgram.programId, isSigner: false, isWritable: false},
        ];

        const instruction = new TransactionInstruction({
          keys,
          programId: PROGRAM_ID,
          data: Buffer.from(ixData),
        });

        const tx = new Transaction({
          ...latestBlockhash,
          feePayer: userPubkey,
        });

        tx.add(instruction);

        const signedTx = await wallet.signTransactions({
          transactions: [tx],
        });

        const txid = await connection.sendRawTransaction(
          signedTx[0].serialize(),
        );
        await connection.confirmTransaction(txid, 'confirmed');

        return signedTx[0];
      });
    },
    [authorizeSession, connection, selectedPool],
  );

  // Function to handle confirm buy
  const handleConfirmBuy = async () => {
    if (!selectedPool) return;
    if (signingInProgress) {
      return;
    }

    const quantity = parseInt(ticketCount) || 0;
    if (quantity <= 0) {
      Alert.alert('Error', 'Please enter a valid ticket quantity');
      return;
    }

    setSigningInProgress(true);

    try {
      const signedTransaction = await createBuyTicketTransaction(
        Number(selectedPool?.poolId),
        quantity,
      );

      alertAndLog(
        'Purchase Successful',
        `Successfully bought ${quantity} ticket${
          quantity > 1 ? 's' : ''
        } for $${formatUSDC(quantity * TICKET_PRICE)}!`,
      );

      // Reset and close modal
      setTicketCount('1');
      setModalVisible(false);

      await fetchPools();
    } catch (err: any) {
      alertAndLog(
        'Purchase Failed',
        err instanceof Error ? err.message : 'Transaction failed',
      );
    } finally {
      setSigningInProgress(false);
    }
  };

  // Function to increment ticket count
  const incrementTicketCount = () => {
    if (!selectedPool) return;
    const currentCount = parseInt(ticketCount) || 0;
    const remainingTickets = TOTAL_TICKETS - selectedPool.ticketsSold;
    const maxCount = Math.min(remainingTickets, 100);

    if (currentCount < maxCount) {
      setTicketCount((currentCount + 1).toString());
    }
  };

  // Function to decrement ticket count
  const decrementTicketCount = () => {
    const currentCount = parseInt(ticketCount) || 0;
    if (currentCount > 1) {
      setTicketCount((currentCount - 1).toString());
    }
  };

  // Render pool item
  const renderPoolItem = ({item}: {item: LotteryPoolData}) => {
    const progress = (item.ticketsSold / TOTAL_TICKETS) * 100;
    const statusColor = getStatusColor(item.status);
    const isActive = item.status === PoolStatus.Active;
    const remainingTickets = TOTAL_TICKETS - item.ticketsSold;
    const poolType = getPoolType(item.prizePool);

    if (!isActive && showActive) {
      return null;
    }

    return (
      <View key={item.poolId} style={styles.poolCard}>
        <View style={styles.poolHeader}>
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
              <View style={[styles.liveDot, {backgroundColor: statusColor}]} />
            )}
            <Text style={[styles.poolStatusText, {color: statusColor}]}>
              {getStatusText(item.status)}
            </Text>
          </View>
        </View>

        <View style={styles.poolPrize}>
          <View style={{flexDirection: 'row', alignItems: 'center'}}>
            <Text style={styles.maxPoolAmount}>
              ${formatUSDC(TICKET_PRICE * TOTAL_TICKETS)}
            </Text>
          </View>
          <Text style={styles.poolPrizeLabel}>Prize Pool</Text>
        </View>

        <View style={styles.poolInfo}>
          <View style={styles.poolInfoRow}>
            <Text style={styles.poolInfoLabel}>Ticket Price</Text>
            <Text style={styles.poolInfoValue}>
              ${formatUSDC(TICKET_PRICE)}
            </Text>
          </View>
          <View style={styles.poolInfoRow}>
            <Text style={styles.poolInfoLabel}>Tickets Sold</Text>
            <Text style={styles.poolInfoValue}>
              {item.ticketsSold}/{TOTAL_TICKETS}
            </Text>
          </View>
          {item.drawTime > 0 && (
            <View style={styles.poolInfoRow}>
              <Text style={styles.poolInfoLabel}>Ends In</Text>
              <Text style={styles.poolInfoValue}>
                {getTimeRemaining(item.drawTime)}
              </Text>
            </View>
          )}
        </View>

        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBackground}>
            <View
              style={[
                styles.progressFill,
                {width: `${progress}%`, backgroundColor: poolType.color},
              ]}
            />
          </View>
          <Text style={styles.progressText}>{progress.toFixed(1)}% Sold</Text>
        </View>

        {/* Buy Ticket Button */}
        {isActive && remainingTickets > 0 && (
          <TouchableOpacity
            style={styles.buyButton}
            onPress={() => handleBuyTicket(item)}>
            <Text style={styles.buyButtonText}>Buy Tickets</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderEmptyComponent = (): JSX.Element => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>
        {loading ? 'Loading pools...' : 'No pools available'}
      </Text>
    </View>
  );

  const renderBuyTicketModal = (): JSX.Element => {
    if (!selectedPool) return <></>;

    const remainingTickets = TOTAL_TICKETS - selectedPool.ticketsSold;
    const maxTickets = Math.min(remainingTickets, 100);
    const currentCount = parseInt(ticketCount) || 0;
    const totalCost = currentCount * TICKET_PRICE;

    return (
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Buy Tickets</Text>
            <Text style={styles.modalSubtitle}>
              Pool #{selectedPool.poolId}
            </Text>

            <View style={styles.ticketInfo}>
              <Text style={styles.ticketInfoText}>
                Available Tickets: {remainingTickets}
              </Text>
              <Text style={styles.ticketInfoText}>
                Price per Ticket: ${formatUSDC(TICKET_PRICE)}
              </Text>
            </View>

            <View style={styles.ticketSelector}>
              <Text style={styles.selectorLabel}>Number of Tickets</Text>
              <View style={styles.selectorContainer}>
                <TouchableOpacity
                  style={[
                    styles.selectorButton,
                    currentCount <= 1 && styles.selectorButtonDisabled,
                  ]}
                  onPress={decrementTicketCount}
                  disabled={currentCount <= 1}>
                  <Text style={styles.selectorButtonText}>-</Text>
                </TouchableOpacity>

                <TextInput
                  style={styles.ticketInput}
                  value={ticketCount}
                  onChangeText={handleTicketCountChange}
                  keyboardType="numeric"
                  textAlign="center"
                  maxLength={3}
                />

                <TouchableOpacity
                  style={[
                    styles.selectorButton,
                    currentCount >= maxTickets && styles.selectorButtonDisabled,
                  ]}
                  onPress={incrementTicketCount}
                  disabled={currentCount >= maxTickets}>
                  <Text style={styles.selectorButtonText}>+</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.maxTicketsText}>
                Max: {maxTickets} tickets
              </Text>
            </View>

            <View style={styles.totalCost}>
              <Text style={styles.totalCostLabel}>Total Cost</Text>
              <Text style={styles.totalCostValue}>
                ${formatUSDC(totalCost)}
              </Text>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              {selectedAccount ? (
                <TouchableOpacity
                  style={[
                    styles.confirmButton,
                    (currentCount <= 0 || currentCount > maxTickets) &&
                      styles.confirmButtonDisabled,
                  ]}
                  onPress={handleConfirmBuy}
                  disabled={currentCount <= 0 || currentCount > maxTickets}>
                  <Text style={styles.confirmButtonText}>Confirm Buy</Text>
                </TouchableOpacity>
              ) : (
                <ConnectButton />
              )}
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  const [now, setNow] = useState(Date.now() / 1000);

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now() / 1000);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <View style={styles.container}>
      {/* Pools List */}
      <ScrollView
        horizontal={horizontalView}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.poolsScrollContainer}>
        {pools.length === 0
          ? renderEmptyComponent()
          : pools.map(item => renderPoolItem({item}))}
      </ScrollView>

      {/* Buy Ticket Modal */}
      {renderBuyTicketModal()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  poolsScrollContainer: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    alignItems: 'center',
  },
  poolCard: {
    width: 280,
    backgroundColor: '#1A1A1A',
    borderRadius: 20,
    padding: 20,
    marginRight: 16,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    marginTop: 10,
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
  maxPoolAmount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#10B981',
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
  progressContainer: {
    marginBottom: 20,
  },
  progressBackground: {
    height: 6,
    backgroundColor: '#2A2A2A',
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
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    width: 280,
  },
  emptyText: {
    fontSize: 16,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#1A1A1A',
    borderRadius: 20,
    padding: 24,
    width: '90%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 16,
    color: '#9CA3AF',
    textAlign: 'center',
    marginBottom: 20,
  },
  ticketInfo: {
    backgroundColor: '#0A0A0A',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  ticketInfoText: {
    fontSize: 14,
    color: '#D1D5DB',
    marginBottom: 4,
  },
  ticketSelector: {
    marginBottom: 20,
  },
  selectorLabel: {
    fontSize: 16,
    color: '#FFFFFF',
    marginBottom: 12,
    textAlign: 'center',
  },
  selectorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  selectorButton: {
    backgroundColor: '#2A2A2A',
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 8,
    borderWidth: 1,
    borderColor: '#3A3A3A',
  },
  selectorButtonDisabled: {
    backgroundColor: '#1A1A1A',
    opacity: 0.5,
  },
  selectorButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  ticketInput: {
    backgroundColor: '#0A0A0A',
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    width: 80,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    paddingHorizontal: 12,
  },
  maxTicketsText: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  totalCost: {
    backgroundColor: '#0A0A0A',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  totalCostLabel: {
    fontSize: 14,
    color: '#9CA3AF',
    marginBottom: 4,
  },
  totalCostValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#10B981',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#2A2A2A',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3A3A3A',
  },
  cancelButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButton: {
    flex: 1,
    backgroundColor: '#10B981',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  confirmButtonDisabled: {
    backgroundColor: '#2A2A2A',
    opacity: 0.5,
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
