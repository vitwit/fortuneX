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
  Modal,
  TouchableOpacity,
} from 'react-native';
import ConnectButton from './ConnectButton';
import RaffleTicket from './Ticket';
import TicketDetailsModal from './TicketDetailsModal'; // Import the new modal
import {PROGRAM_ID} from '../util/constants';
import {formatNumber} from '../util/utils';
import PoolInfoComponent from './PoolInfoComponent';
import {Buffer} from 'buffer';

type TicketDetails = {
  ticket_number: bigint;
  amount_paid: bigint;
  timestamp: bigint;
};

type ParsedUserTicket = {
  pubkey: PublicKey;
  user: PublicKey;
  pool: PublicKey;
  poolId: bigint;
  bump: number;
  tickets: TicketDetails[];
};

type SelectedTicketInfo = {
  ticketNumber: string;
  poolId: string;
  amountPaid: string;
  timestamp: string;
  poolCompleted: boolean;
} | null;

// Pool Status Enum
enum PoolStatus {
  Active = 0,
  Drawing = 1,
  Completed = 2,
}

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

const LOTTERY_POOL_SEED = Buffer.from('lottery_pool');

const isDefaultPubkey = (pubkey: PublicKey): boolean => {
  return pubkey.toBase58() === '11111111111111111111111111111111';
};

export default function UserTicketsComponent() {
  const {connection} = useConnection();
  const {selectedAccount} = useAuthorization();

  const [loading, setLoading] = useState<boolean>(true);
  const [userTickets, setUserTickets] = useState<ParsedUserTicket[]>([]);
  const [poolsData, setPoolsData] = useState<Map<string, LotteryPoolData>>(
    new Map(),
  );
  const [expandedPools, setExpandedPools] = useState<Set<string>>(new Set());
  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const [selectedTicket, setSelectedTicket] =
    useState<SelectedTicketInfo>(null);
  const [currentPoolInfo, setCurrentPoolInfo] =
    useState<LotteryPoolData | null>(null);

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

  const fetchPoolData = async (poolId: string) => {
    try {
      const poolPDA = getLotteryPoolPDA(Number(poolId));
      const accountInfo = await connection.getAccountInfo(poolPDA);

      if (accountInfo && accountInfo.data) {
        const poolData = parsePoolData(accountInfo.data);
        if (poolData) {
          setPoolsData(
            prev =>
              new Map(
                prev.set(poolId, {
                  ...poolData,
                  address: poolPDA.toString(),
                }),
              ),
          );
        }
      }
    } catch (error) {
      console.error(`Error fetching pool ${poolId}:`, error);
    }
  };

  const fetchUserTickets = async () => {
    if (!selectedAccount?.publicKey) return;

    setLoading(true);
    try {
      const accounts = await connection.getProgramAccounts(PROGRAM_ID, {
        filters: [
          {
            memcmp: {
              offset: 8,
              bytes: selectedAccount.publicKey.toBase58(),
            },
          },
        ],
      });

      const parsed: ParsedUserTicket[] = accounts.map(acc => {
        const data = acc.account.data;
        const user = new PublicKey(data.slice(8, 40));
        const pool = new PublicKey(data.slice(40, 72));
        const poolId = data.readBigUInt64LE(72);

        const ticketVectorOffset = 80;
        const ticketCount = data.readUInt32LE(ticketVectorOffset);
        const tickets: TicketDetails[] = [];

        let cursor = ticketVectorOffset + 4;
        for (let i = 0; i < ticketCount; i++) {
          const ticket_number = data.readBigUInt64LE(cursor);
          const amount_paid = data.readBigUInt64LE(cursor + 8);
          const timestamp = data.readBigInt64LE(cursor + 16);
          tickets.push({ticket_number, amount_paid, timestamp});
          cursor += 24;
        }

        const bump = data.readUInt8(data.length - 1);

        return {
          pubkey: acc.pubkey,
          user,
          pool,
          poolId,
          bump,
          tickets,
        };
      });

      setUserTickets(parsed);

      // Fetch pool data for each unique pool
      const uniquePoolIds = [
        ...new Set(parsed.map(ticket => ticket.poolId.toString())),
      ];
      for (const poolId of uniquePoolIds) {
        await fetchPoolData(poolId);
      }
    } catch (err) {
      console.error('Failed to fetch user tickets:', err);
      Alert.alert('Error', 'Failed to fetch user tickets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserTickets();
  }, [connection, selectedAccount]);

  const handleTicketPress = (
    ticketNumber: string,
    poolId: string,
    amountPaid: string,
    timestamp: string,
    poolCompleted: boolean,
  ) => {
    setSelectedTicket({
      ticketNumber,
      poolId,
      amountPaid,
      timestamp,
      poolCompleted,
    });
    setModalVisible(true);
  };

  const handleModalClose = () => {
    setModalVisible(false);
    setSelectedTicket(null);
  };

  const handleTicketCancelled = () => {
    // Refresh the tickets list after cancellation
    fetchUserTickets();
  };

  const formatAmount = (amount: bigint): string => {
    return (Number(amount) / 1e6).toFixed(2);
  };

  const formatWinnerAddress = (address: PublicKey): string => {
    const addressStr = address.toBase58();
    // Check if it's the default PublicKey (all zeros)
    const defaultPubkey = new PublicKey('11111111111111111111111111111111');
    if (address.equals(defaultPubkey)) {
      return 'No winner yet';
    }
    return `${addressStr.slice(0, 4)}...${addressStr.slice(-4)}`;
  };

  const renderTicketsByPool = () => {
    return userTickets.map((userTicket, poolIndex) => {
      const ticketList = userTicket.tickets;
      const poolId = userTicket.poolId.toString();
      const poolData = poolsData.get(poolId);

      return (
        <View key={poolIndex} style={styles.poolSection}>
          <View style={styles.poolHeader}>
            <TouchableOpacity
              onPress={() => {
                if (poolData) {
                  setCurrentPoolInfo(poolData);
                }
              }}
              activeOpacity={0.8}>
              <Text style={styles.poolTitle}>
                🎯 Pool #{userTicket.poolId.toString()} ({ticketList?.length}{' '}
                Tickets)
              </Text>
            </TouchableOpacity>

            {/* Winner Display */}
            {poolData && (
              <View style={styles.winnerContainer}>
                <Text style={styles.winnerAddress}>
                  {poolData?.winner && !isDefaultPubkey(poolData.winner)
                    ? selectedAccount?.publicKey.toBase58() ===
                      poolData?.winner?.toBase58()
                      ? `You Won 🎉`
                      : poolData.winner.toBase58()
                    : 'Not yet drawn'}
                </Text>
              </View>
            )}
          </View>

          {ticketList.length > 1 && (
            <Text style={styles.scrollHint}>Swipe to view more tickets →</Text>
          )}

          <ScrollView horizontal showsHorizontalScrollIndicator={true}>
            {ticketList.map((ticket, ticketIndex) => (
              <View
                key={`${poolIndex}-${ticketIndex}`}
                style={{
                  marginRight: ticketIndex !== ticketList.length - 1 ? 8 : 0,
                }} // 8px gap
              >
                <RaffleTicket
                  ticketNumber={ticket.ticket_number.toString()}
                  amountPaid={formatNumber(Number(ticket.amount_paid))}
                  timestamp={ticket.timestamp.toString()}
                  poolId={userTicket.poolId.toString()}
                  contestName="FortuneX"
                  onPress={() =>
                    handleTicketPress(
                      ticket.ticket_number.toString(),
                      userTicket.poolId.toString(),
                      formatAmount(ticket.amount_paid),
                      ticket.timestamp.toString(),
                      poolData?.status === PoolStatus.Completed,
                    )
                  }
                  drawDate={poolData?.drawTime.toString()}
                />
              </View>
            ))}
          </ScrollView>
        </View>
      );
    });
  };

  if (!selectedAccount) {
    return (
      <View style={styles.container}>
        <View style={styles.centered}>
          <Text style={styles.connectText}>
            Connect your wallet to view your tickets
          </Text>
          <ConnectButton />
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#e5c384" />
          <Text style={styles.loadingText}>Loading your tickets...</Text>
        </View>
      </View>
    );
  }

  if (userTickets.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.centered}>
          <Text style={styles.noTicketsText}>🎟️</Text>
          <Text style={styles.noTicketsTitle}>No tickets found</Text>
          <Text style={styles.noTicketsSubtitle}>
            You haven't purchased any tickets yet
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}>
        {renderTicketsByPool()}
      </ScrollView>

      {/* Ticket Details Modal */}
      <TicketDetailsModal
        visible={modalVisible}
        onClose={handleModalClose}
        ticketNumber={selectedTicket?.ticketNumber || ''}
        poolId={selectedTicket?.poolId || ''}
        amountPaid={selectedTicket?.amountPaid || ''}
        timestamp={selectedTicket?.timestamp || ''}
        onTicketCancelled={handleTicketCancelled}
        poolCompleted={selectedTicket?.poolCompleted || false}
      />

      {currentPoolInfo ? (
        <Modal
          animationType="slide"
          transparent={true}
          visible={true}
          onRequestClose={() => setCurrentPoolInfo(null)}>
          <View style={styles.modalOverlay}>
            <View>
              <PoolInfoComponent
                poolData={currentPoolInfo}
                onClose={() => setCurrentPoolInfo(null)}
              />
            </View>
          </View>
        </Modal>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // backgroundColor: '#1a1a1a',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerStats: {
    flexDirection: 'row',
    backgroundColor: '#2a2a2a',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#e5c384',
  },
  statLabel: {
    fontSize: 12,
    color: '#ffffff',
    opacity: 0.7,
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    backgroundColor: '#444',
    marginHorizontal: 16,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  poolSection: {
    marginBottom: 20,
  },
  poolHeader: {
    // marginHorizontal: 16,
    marginTop: 20,
    // marginBottom: 10,
    // padding: 16,
    // backgroundColor: '#2a2a2a',
    // borderRadius: 12,
    // borderLeftWidth: 4,
    // borderLeftColor: '#e5c384',
  },
  poolTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  poolAddress: {
    color: '#ccc',
    fontSize: 12,
    fontFamily: 'monospace',
    marginBottom: 8,
  },
  poolStats: {
    color: '#e5c384',
    fontSize: 14,
    fontWeight: '600',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  connectText: {
    color: '#ffffff',
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center',
  },
  loadingText: {
    marginTop: 16,
    color: '#ffffff',
    fontSize: 16,
  },
  noTicketsText: {
    fontSize: 64,
    marginBottom: 20,
  },
  noTicketsTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  noTicketsSubtitle: {
    color: '#ccc',
    fontSize: 14,
    textAlign: 'center',
  },
  viewMoreText: {
    color: '#e5c384',
    fontSize: 14,
    marginLeft: 16,
    marginTop: 8,
    fontWeight: '500',
  },
  scrollHint: {
    fontSize: 12,
    color: '#888',
    marginBottom: 6,
    marginLeft: 8,
  },
  winnerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  winnerLabel: {
    fontSize: 14,
    color: '#666',
  },
  winnerAddress: {
    fontSize: 14,
    color: '#e5c384', // or your theme color
    fontWeight: '500',
  },
});
