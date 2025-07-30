import React, {useState, useCallback, useEffect, useMemo, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  ScrollView,
  Modal,
  TextInput,
  Alert,
  Dimensions,
} from 'react-native';

import {useAuthorization} from './providers/AuthorizationProvider';
import {useConnection} from './providers/ConnectionProvider';
import {alertAndLog} from '../util/alertAndLog';
import {Connection, PublicKey, SystemProgram} from '@solana/web3.js';
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
import {PROGRAM_ID} from '../util/constants';
import PoolInfoComponent from './PoolInfoComponent';
import {useToast} from './providers/ToastProvider';
import {useGlobalState} from './providers/NavigationProvider';
import LoadingIndicator from './LoadingIndicator';
import {formatNumber} from '../util/utils';
import {styles} from './styles/lottery-pool';

// Pool Status Enum
enum PoolStatus {
  Active = 0,
  Drawing = 1,
  Completed = 2,
}

// Type definitions
interface LotteryPoolData {
  poolId: number;
  status: PoolStatus;
  prizePool: number;
  ticketPrice: number;
  ticketsSold: PublicKey[];
  minTickets: number;
  maxTickets: number;
  drawInterval: number;
  drawTime: number;
  createdAt: number;
  winner: PublicKey;
  commissionBps: number;
  creator: PublicKey;
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

const countUserTickets = (
  array: PublicKey[],
  userPubkey: PublicKey | undefined,
): number => {
  if (!userPubkey) {
    return 0;
  }
  const targetBase58 = userPubkey.toBase58();
  return array.filter(pubkey => pubkey.toBase58() === targetBase58).length;
};

const screenWidth = Dimensions.get('window').width;

export default function LotteryPoolsComponent({
  horizontalView = true,
  showActive = true,
  isMainScreen = false,
}: {
  horizontalView?: boolean;
  showActive?: boolean;
  isMainScreen?: boolean;
}): JSX.Element {
  const {connection} = useConnection();
  const [pools, setPools] = useState<LotteryPoolData[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const [selectedPool, setSelectedPool] = useState<LotteryPoolData | null>(
    null,
  );
  const [ticketCount, setTicketCount] = useState<number>(1);
  const {selectedAccount, authorizeSession} = useAuthorization();
  const [signingInProgress, setSigningInProgress] = useState(false);
  const [showPoolInfo, setShowPoolInfo] = useState(false);
  const [currentPoolInfo, setCurrentPoolInfo] =
    useState<LotteryPoolData | null>(null);
  const [currentLivePool, setCurrentLivePool] =
    useState<LotteryPoolData | null>(null);
  const [timeLeft, setTimeLeft] = useState({
    hours: 0,
    minutes: 0,
    seconds: 0,
  });
  const [now, setNow] = useState(Math.floor(Date.now() / 1000));

  // Use refs to prevent timer interference with modal
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const modalVisibleRef = useRef(modalVisible);
  const currentPoolInfoRef = useRef(currentPoolInfo);

  // Update refs when state changes
  useEffect(() => {
    modalVisibleRef.current = modalVisible;
  }, [modalVisible]);

  useEffect(() => {
    currentPoolInfoRef.current = currentPoolInfo;
  }, [currentPoolInfo]);

  const {globalState, refreshGlobalState} = useGlobalState();
  const USDC_MINT = globalState?.usdcMint;

  const toast = useToast();

  const [pulseAnim] = useState(new Animated.Value(1.3));

  // Seeds
  const GLOBAL_STATE_SEED = Buffer.from('global_state');
  const LOTTERY_POOL_SEED = Buffer.from('lottery_pool');
  const VAULT_AUTHORITY_SEED = Buffer.from('vault_authority');
  const USER_TICKET_SEED = Buffer.from('user_ticket');

  // Pulse animation for the lottery icon
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.3,
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

  // Fixed timer effect - only update when no modals are open
  useEffect(() => {
    const updateTimer = () => {
      // Only update timer if no modals are currently open
      if (!modalVisibleRef.current && !currentPoolInfoRef.current) {
        setNow(Math.floor(Date.now() / 1000));
      }
    };

    timerRef.current = setInterval(updateTimer, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []); // Empty dependency array to prevent re-creation

  // Timer calculation effect - update timeLeft when now or currentLivePool changes
  useEffect(() => {
    if (!currentLivePool) {
      setTimeLeft({hours: 0, minutes: 0, seconds: 0});
      return;
    }

    const drawTime = currentLivePool.drawTime;
    const difference = drawTime - now;

    if (difference > 0) {
      const hours = Math.floor(difference / 3600);
      const minutes = Math.floor((difference % 3600) / 60);
      const seconds = Math.floor(difference % 60);

      setTimeLeft({hours, minutes, seconds});
    } else {
      setTimeLeft({hours: 0, minutes: 0, seconds: 0});
    }
  }, [currentLivePool, now]);

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
      let offset = 8; // Skip Anchor discriminator

      const poolId = view.getBigUint64(offset, true);
      offset += 8;

      const status = view.getUint8(offset) as PoolStatus;
      offset += 1;

      const prizePool = view.getBigUint64(offset, true);
      offset += 8;

      const ticketPrice = view.getBigUint64(offset, true);
      offset += 8;

      // tickets_sold (Vec<Pubkey>)
      const ticketsSoldLength = view.getUint32(offset, true);
      offset += 4;
      const ticketsSold: PublicKey[] = [];
      for (let i = 0; i < ticketsSoldLength; i++) {
        const pubkeyBytes = new Uint8Array(data.buffer, offset, 32);
        ticketsSold.push(new PublicKey(pubkeyBytes));
        offset += 32;
      }

      const minTickets = view.getBigUint64(offset, true);
      offset += 8;

      const maxTickets = view.getBigUint64(offset, true);
      offset += 8;

      const drawInterval = view.getBigInt64(offset, true);
      offset += 8;

      const drawTime = view.getBigInt64(offset, true);
      offset += 8;

      const createdAt = view.getBigInt64(offset, true);
      offset += 8;

      const winnerBytes = new Uint8Array(data.buffer, offset, 32);
      const winner = new PublicKey(winnerBytes);
      offset += 32;

      const commissionBps = view.getUint16(offset, true);
      offset += 2;

      const creatorBytes = new Uint8Array(data.buffer, offset, 32);
      const creator = new PublicKey(creatorBytes);
      offset += 32;

      const bump = view.getUint8(offset);
      offset += 1;

      return {
        poolId: Number(poolId),
        status,
        prizePool: Number(prizePool),
        ticketPrice: Number(ticketPrice),
        ticketsSold,
        minTickets: Number(minTickets),
        maxTickets: Number(maxTickets),
        drawInterval: Number(drawInterval),
        drawTime: Number(drawTime),
        createdAt: Number(createdAt),
        winner,
        commissionBps,
        creator,
        bump,
        address: '', // Will be assigned separately
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

        // Skip bonus_pool_fee_bps
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

      setPools(poolsData.reverse());
    } catch (error) {
      console.error('Error fetching pools:', error);
      toast.show({message: 'Failed to fetch pools', type: 'error'});
    } finally {
      setLoading(false);
    }
  }, [connection, fetchGlobalState]);

  // Load pools on component mount
  useEffect(() => {
    fetchPools();
  }, [fetchPools]);

  // Set current live pool when pools change
  useEffect(() => {
    if (pools.length > 0) {
      const activePools = pools.filter(
        item => item.status !== PoolStatus.Completed,
      );
      setCurrentLivePool(activePools[0] || null);
    } else {
      setCurrentLivePool(null);
    }
  }, [pools]);

  // Function to get status text
  const getStatusText = (status: PoolStatus): string => {
    switch (status) {
      case PoolStatus.Active:
        return 'LIVE';
      case PoolStatus.Drawing:
        return 'SOLD OUT';
      case PoolStatus.Completed:
        return 'COMPLETED';
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
      default:
        return '#6B7280';
    }
  };

  // Function to get pool type based on prize pool
  const getPoolType = (): {type: string; color: string} => {
    return {type: 'FLASH', color: '#F59E0B'};
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

  // Function to handle buy ticket button press - stabilized with useCallback
  const handleBuyTicket = useCallback((pool: LotteryPoolData) => {
    // Prevent modal opening if another modal is already open
    if (modalVisibleRef.current || currentPoolInfoRef.current) {
      return;
    }

    setSelectedPool(pool);
    setTicketCount(1);
    setModalVisible(true);
  }, []);

  // Function to handle ticket count change
  const handleTicketCountChange = useCallback((value: string) => {
    // Only allow numbers
    const numericValue = parseInt(value.replace(/[^0-9]/g, '')) || 1;
    setTicketCount(numericValue);
  }, []);

  const createBuyTicketTransaction = useCallback(
    async (poolId: number, quantity: number) => {
      if (!selectedPool || !quantity || quantity <= 0) {
        toast.show({message: 'Invalid ticket quantity', type: 'error'});
        return;
      }

      if (!USDC_MINT) {
        toast.show({message: 'Failed to fetch global state', type: 'error'});
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
        const totalCost = quantity * selectedPool.ticketPrice;

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
          {
            pubkey: SystemProgram.programId,
            isSigner: false,
            isWritable: false,
          },
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
    [authorizeSession, connection, selectedPool, USDC_MINT],
  );

  async function waitForConfirmation(
    connection: Connection,
    txid: string,
    timeout: number = 30000, // 30 seconds
  ): Promise<void> {
    const start = Date.now();
    let status: any = null;

    while (Date.now() - start < timeout) {
      console.log('polling...');
      try {
        status = await connection.getSignatureStatus(txid);
        const confirmation = status?.value?.confirmationStatus;

        if (confirmation === 'confirmed' || confirmation === 'finalized') {
          return;
        }
      } catch (e) {
        console.warn('Error polling transaction status', e);
      }

      await new Promise(resolve => setTimeout(resolve, 1000)); // Poll every 1s
    }

    throw new Error('Transaction confirmation timed out');
  }

  // Function to handle confirm buy - stabilized with useCallback
  const handleConfirmBuy = useCallback(async () => {
    if (!selectedPool) return;
    if (signingInProgress) {
      return;
    }

    if (ticketCount <= 0) {
      toast.show({
        message: 'Please enter a valid ticket quantity',
        type: 'error',
      });
      return;
    }

    setSigningInProgress(true);

    try {
      const signedTransaction = await createBuyTicketTransaction(
        Number(selectedPool?.poolId),
        ticketCount,
      );

      toast.show({
        message: `Successfully bought ${ticketCount} ticket${
          ticketCount > 1 ? 's' : ''
        } for ${formatNumber(ticketCount * selectedPool.ticketPrice)}!`,
        type: 'success',
      });

      // Reset and close modal
      setTicketCount(1);
      setModalVisible(false);
      setSelectedPool(null); // Clear selected pool

      await fetchPools();
    } catch (err: any) {
      toast.show({
        message: err instanceof Error ? err.message : 'Transaction failed',
        type: 'error',
      });
    } finally {
      setSigningInProgress(false);
    }
  }, [
    selectedPool,
    ticketCount,
    signingInProgress,
    createBuyTicketTransaction,
    toast,
    fetchPools,
  ]);

  // Function to increment ticket count - stabilized with useCallback
  const incrementTicketCount = useCallback(() => {
    if (!selectedPool) return;

    const soldCount = selectedPool.ticketsSold.length;
    const remainingTickets = selectedPool.maxTickets - soldCount;

    // Allow user to increment up to the remaining tickets but cap it at 100 for UI safety
    const maxCount = Math.min(remainingTickets, 100);

    if (ticketCount < maxCount) {
      setTicketCount(ticketCount + 1);
    }
  }, [selectedPool, ticketCount]);

  // Function to decrement ticket count - stabilized with useCallback
  const decrementTicketCount = useCallback(() => {
    if (ticketCount > 1) {
      setTicketCount(ticketCount - 1);
    }
  }, [ticketCount]);

  // Close modal handler - stabilized with useCallback
  const closeModal = useCallback(() => {
    setModalVisible(false);
    setSelectedPool(null);
    setTicketCount(1);
  }, []);

  // Close pool info handler - stabilized with useCallback
  const closePoolInfo = useCallback(() => {
    setCurrentPoolInfo(null);
  }, []);

  // Render pool item
  const renderPoolItem = ({item}: {item: LotteryPoolData}) => {
    const soldCount = item.ticketsSold.length;
    const totalTickets = item.maxTickets;

    const progress = (soldCount / totalTickets) * 100;
    const statusColor = getStatusColor(item.status);
    const isActive = item.status === PoolStatus.Active;
    const isDrawing = item.status === PoolStatus.Drawing;
    const remainingTickets = totalTickets - soldCount;
    const poolType = getPoolType();

    const userTicketCount = countUserTickets(
      item.ticketsSold,
      selectedAccount?.publicKey,
    );

    return (
      <TouchableOpacity
        key={item.poolId}
        style={[styles.poolCard, {marginRight: isMainScreen ? 16 : undefined}]}
        onPress={() => setCurrentPoolInfo(item)}
        activeOpacity={0.7}>
        <View style={styles.poolHeader}>
          <View
            style={[
              styles.poolType,
              {backgroundColor: statusColor},
              {display: 'flex', flexDirection: 'row', alignItems: 'center'},
            ]}>
            {isActive ? (
              <Animated.View
                style={[
                  styles.liveDot,
                  {
                    backgroundColor: '#fff',
                    transform: [{scale: pulseAnim}],
                  },
                ]}
              />
            ) : (
              <View style={[styles.liveDot, {backgroundColor: '#fff'}]} />
            )}
            <Text style={[styles.poolTypeText]}>
              {getStatusText(item.status)}
            </Text>
          </View>
          <View style={styles.poolInfoRow}>
            <Text style={styles.poolInfoValue}>#{item.poolId}</Text>
          </View>
        </View>

        <View style={styles.poolPrize}>
          <View style={{flexDirection: 'row', alignItems: 'center'}}>
            <Text style={styles.maxPoolAmount}>
              ~${formatNumber(item.ticketPrice * item.maxTickets)}
            </Text>
          </View>
          <Text style={styles.poolPrizeLabel}>Prize Pool</Text>
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

        <View style={{alignItems: 'flex-end', marginBottom: 8}}>
          {userTicketCount > 0 ? (
            <View style={styles.ticketBadge}>
              <Text style={styles.ticketBadgeText}>
                You bought: {userTicketCount}{' '}
                {userTicketCount === 1 ? 'ticket' : 'tickets'}
              </Text>
            </View>
          ) : null}
        </View>
        {/* Buy Ticket Button */}
        {isActive && remainingTickets > 0 && (
          <TouchableOpacity
            style={styles.buyButton}
            onPress={e => {
              e.stopPropagation();
              handleBuyTicket(item);
            }}>
            <Text style={styles.buyButtonText}>
              Buy Tickets (${formatNumber(item.ticketPrice)})
            </Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  const renderEmptyComponent = (message?: string) => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>{message || 'Nothing to display'}</Text>
    </View>
  );

  // Memoize modal calculations
  const modalCalculations = useMemo(() => {
    if (!selectedPool) return null;

    const soldCount = selectedPool.ticketsSold.length;
    const remainingTickets = selectedPool.maxTickets - soldCount;
    const maxTickets = Math.min(remainingTickets, 100);
    const totalCost = ticketCount * selectedPool.ticketPrice;

    return {
      soldCount,
      remainingTickets,
      maxTickets,
      totalCost,
    };
  }, [selectedPool, ticketCount]);

  // Memoized modal content
  const BuyTicketModalContent = useMemo(() => {
    if (!selectedPool || !modalCalculations) return null;

    const {remainingTickets, maxTickets, totalCost} = modalCalculations;

    return (
      <View style={styles.modalContent}>
        <Text style={styles.modalTitle}>Buy Tickets</Text>
        <Text style={styles.modalSubtitle}>Pool #{selectedPool.poolId}</Text>

        <View style={styles.ticketInfo}>
          <Text style={styles.ticketInfoText}>
            Available Tickets: {remainingTickets}
          </Text>
          <Text style={styles.ticketInfoText}>
            Price per Ticket: ${formatNumber(selectedPool.ticketPrice)}
          </Text>
        </View>

        <View style={styles.ticketSelector}>
          <Text style={styles.selectorLabel}>Number of Tickets</Text>
          <View style={styles.selectorContainer}>
            <TouchableOpacity
              style={[
                styles.selectorButton,
                ticketCount <= 1 && styles.selectorButtonDisabled,
              ]}
              onPress={decrementTicketCount}
              disabled={ticketCount <= 1}>
              <Text style={styles.selectorButtonText}>-</Text>
            </TouchableOpacity>

            <TextInput
              style={styles.ticketInput}
              value={ticketCount.toString()}
              onChangeText={handleTicketCountChange}
              keyboardType="numeric"
              textAlign="center"
              maxLength={3}
            />

            <TouchableOpacity
              style={[
                styles.selectorButton,
                ticketCount >= maxTickets && styles.selectorButtonDisabled,
              ]}
              onPress={incrementTicketCount}
              disabled={ticketCount >= maxTickets}>
              <Text style={styles.selectorButtonText}>+</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.maxTicketsText}>Max: {maxTickets} tickets</Text>
        </View>

        <View style={styles.totalCost}>
          <Text style={styles.totalCostLabel}>Total Cost</Text>
          <Text style={styles.totalCostValue}>${formatNumber(totalCost)}</Text>
        </View>

        {remainingTickets === 0 ? (
          <View
            style={{
              justifyContent: 'center',
              alignItems: 'center',
              backgroundColor: 'red',
              borderRadius: 10,
              marginBottom: 8,
            }}>
            <Text style={{color: 'white'}}>
              Tickets sold out, new pool coming soon.
            </Text>
          </View>
        ) : null}
        <View style={styles.modalButtons}>
          <TouchableOpacity style={styles.cancelButton} onPress={closeModal}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>

          {selectedAccount ? (
            <TouchableOpacity
              style={[
                styles.confirmButton,
                (ticketCount <= 0 || ticketCount > maxTickets) &&
                  styles.confirmButtonDisabled,
              ]}
              onPress={handleConfirmBuy}
              disabled={ticketCount <= 0 || ticketCount > maxTickets}>
              <Text style={styles.confirmButtonText}>Confirm Buy</Text>
            </TouchableOpacity>
          ) : (
            <ConnectButton />
          )}
        </View>
      </View>
    );
  }, [
    selectedPool,
    modalCalculations,
    ticketCount,
    handleTicketCountChange,
    decrementTicketCount,
    incrementTicketCount,
    closeModal,
    selectedAccount,
    handleConfirmBuy,
  ]);

  const renderBuyTicketModal = (): JSX.Element => {
    if (!modalVisible || !BuyTicketModalContent) return <></>;

    return (
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={closeModal}>
        <View style={styles.modalOverlay}>{BuyTicketModalContent}</View>
      </Modal>
    );
  };

  const PoolsList = () => {
    return (
      <View style={styles.container}>
        {/* Pools List or General Empty State */}
        {loading ? (
          <View
            style={{
              flex: 1,
              justifyContent: 'center',
              alignItems: 'center',
            }}>
            <LoadingIndicator text="Fetching pools..." />
          </View>
        ) : pools.length === 0 ? (
          <View style={[styles.emptyWrapper, {marginLeft: 44}]}>
            {renderEmptyComponent('New pools coming soon...!')}
          </View>
        ) : (
          <ScrollView
            horizontal={isMainScreen}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={[
              styles.poolsScrollContainer,
              pools.filter(item => item.status !== PoolStatus.Completed)
                .length === 1 &&
                isMainScreen && {paddingHorizontal: 10}, // Add side padding for single card
            ]}>
            {isMainScreen
              ? pools
                  .filter(item => item.status !== PoolStatus.Completed)
                  .map(item => renderPoolItem({item}))
              : pools.map(item => renderPoolItem({item}))}
          </ScrollView>
        )}

        {/* Main Screen - No Active Pools Message */}
        {isMainScreen &&
          pools.length > 0 &&
          pools.filter(pool => pool.status !== PoolStatus.Completed).length ===
            0 && (
            <View style={styles.emptyWrapper}>
              {renderEmptyComponent('New pools coming soon.')}
            </View>
          )}

        {currentPoolInfo ? (
          <Modal
            animationType="slide"
            transparent={true}
            visible={true}
            onRequestClose={closePoolInfo}>
            <View style={styles.modalOverlay}>
              <View>
                <PoolInfoComponent
                  poolData={currentPoolInfo}
                  onClose={closePoolInfo}
                />
              </View>
            </View>
          </Modal>
        ) : null}
      </View>
    );
  };

  if (!isMainScreen) {
    return (
      <View>
        <PoolsList />
        {renderBuyTicketModal()}
      </View>
    );
  }

  return (
    <View style={styles.poolsSection}>
      <View style={styles.sectionHeader}>
        {currentLivePool && (
          <View style={styles.currentPoolSection}>
            <View style={styles.currentPoolGlow} />

            <View style={styles.prizePoolContainer}>
              <Text style={styles.prizePoolLabel}>The FortuneX Lottery</Text>
              <Text style={styles.prizePoolAmount}>
                ~$
                {formatNumber(
                  currentLivePool.ticketPrice * currentLivePool.maxTickets,
                )}
              </Text>
              <Text style={styles.prizePoolSubtext}>in Prize!</Text>

              <TouchableOpacity
                style={styles.buyTicketsButton}
                onPress={() => {
                  handleBuyTicket(currentLivePool);
                }}>
                <Text style={styles.buyTicketsText}>Buy Tickets</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.ticketsNowSection}>
              <Text style={styles.ticketsNowTitle}>Get your tickets now!</Text>
              <View style={styles.timerContainer}>
                <View style={styles.timerItem}>
                  <Text style={styles.timerNumber}>{timeLeft.hours}</Text>
                  <Text style={styles.timerLabel}>h</Text>
                </View>
                <View style={styles.timerItem}>
                  <Text style={styles.timerNumber}>{timeLeft.minutes}</Text>
                  <Text style={styles.timerLabel}>m</Text>
                </View>
                <View style={styles.timerItem}>
                  <Text style={styles.timerNumber}>{timeLeft.seconds}</Text>
                  <Text style={styles.timerLabel}>s</Text>
                </View>
              </View>

              <View style={styles.nextDrawInfo}>
                <Text style={styles.nextDrawLabel}>Next Draw</Text>
                <Text style={styles.nextDrawTime}>
                  #{currentLivePool.poolId} |{' '}
                  {new Date(currentLivePool.drawTime * 1000).toLocaleString()}
                </Text>
              </View>
            </View>
          </View>
        )}
      </View>
      <PoolsList />
      {renderBuyTicketModal()}
    </View>
  );
}
