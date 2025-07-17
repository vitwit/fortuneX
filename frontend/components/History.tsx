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
} from 'react-native';
import ConnectButton from './ConnectButton';
import RaffleTicket from './Ticket';

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

const PROGRAM_ID = new PublicKey(
  'HD5X9GyjdqEMLyjP5QsLaKAweor6KQrcqCejf3NXwxpu',
);

export default function UserTicketsComponent() {
  const {connection} = useConnection();
  const {selectedAccount} = useAuthorization();

  const [loading, setLoading] = useState<boolean>(true);
  const [userTickets, setUserTickets] = useState<ParsedUserTicket[]>([]);
  const [expandedPools, setExpandedPools] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!selectedAccount?.publicKey) return;

    const fetchUserTickets = async () => {
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

        // Calculate totals
        let totalTicketCount = 0;
        let totalAmountSpent = 0;

        parsed.forEach(userTicket => {
          totalTicketCount += userTicket.tickets.length;
          userTicket.tickets.forEach(ticket => {
            totalAmountSpent += Number(ticket.amount_paid) / 1e6;
          });
        });

        setUserTickets(parsed);
      } catch (err) {
        console.error('Failed to fetch user tickets:', err);
        Alert.alert('Error', 'Failed to fetch user tickets');
      } finally {
        setLoading(false);
      }
    };

    fetchUserTickets();
  }, [connection, selectedAccount]);

  const handleTicketPress = (ticketNumber: string, poolId: string) => {
    Alert.alert(
      'Ticket Details',
      `Ticket Number: ${ticketNumber}\nPool ID: ${poolId}`,
      [
        {
          text: 'OK',
          style: 'default',
        },
      ],
    );
  };

  const formatAmount = (amount: bigint): string => {
    return (Number(amount) / 1e6).toFixed(2);
  };

  const toggleExpand = (poolKey: string) => {
    setExpandedPools(prev => {
      const newSet = new Set(prev);
      if (newSet.has(poolKey)) {
        newSet.delete(poolKey);
      } else {
        newSet.add(poolKey);
      }
      return newSet;
    });
  };

  const renderTicketsByPool = () => {
    return userTickets.map((userTicket, poolIndex) => {
      const poolKey = userTicket.pool.toBase58() + userTicket.poolId.toString();
      const isExpanded = expandedPools.has(poolKey);
      const ticketList = isExpanded
        ? userTicket.tickets
        : userTicket.tickets.slice(0, 1);

      return (
        <View key={poolIndex} style={styles.poolSection}>
          <View style={styles.poolHeader}>
            <Text style={styles.poolTitle}>
              🎯 Pool #{userTicket.poolId.toString()}
            </Text>
            <Text style={styles.poolAddress}>{userTicket.pool.toBase58()}</Text>
          </View>

          {ticketList.map((ticket, ticketIndex) => (
            <RaffleTicket
              key={`${poolIndex}-${ticketIndex}`}
              ticketNumber={ticket.ticket_number.toString()}
              amountPaid={formatAmount(ticket.amount_paid)}
              timestamp={ticket.timestamp.toString()}
              poolId={userTicket.poolId.toString()}
              contestName="FortuneX"
              onPress={() =>
                handleTicketPress(
                  ticket.ticket_number.toString(),
                  userTicket.poolId.toString(),
                )
              }
            />
          ))}

          {userTicket.tickets.length > 1 && (
            <Text
              style={styles.viewMoreText}
              onPress={() => toggleExpand(poolKey)}>
              {isExpanded
                ? 'View Less'
                : `View More (${userTicket.tickets.length - 1} tickets)`}
            </Text>
          )}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // backgroundColor: '#1a1a1a',
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
});
