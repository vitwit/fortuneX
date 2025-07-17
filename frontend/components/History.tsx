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
} from 'react-native';

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

        setUserTickets(parsed);
      } catch (err) {
        console.error('Failed to fetch user tickets:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchUserTickets();
  }, [connection, selectedAccount]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#00ff99" />
        <Text style={{marginTop: 8}}>Loading tickets...</Text>
      </View>
    );
  }

  if (userTickets.length === 0) {
    return (
      <View style={styles.centered}>
        <Text>No tickets found.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {userTickets.map((ticket, idx) => (
        <View key={idx} style={styles.poolContainer}>
          <Text style={styles.poolTitle}>
            🎯 Pool ID: {ticket.poolId.toString()}
          </Text>
          <Text style={styles.poolAddress}>
            🏊 Pool: {ticket.pool.toBase58()}
          </Text>
          {ticket.tickets.map((t, i) => (
            <View key={i} style={styles.ticket}>
              <View style={styles.notchSection}>
                <Text style={styles.ticketNumber}>
                  {t.ticket_number.toString()}
                </Text>
              </View>
              <View style={styles.ticketContent}>
                <Text style={styles.ticketTitle}>🎟️ FortuneX</Text>
                <Text style={styles.ticketDetail}>
                  💰 {(Number(t.amount_paid) / 1e6).toFixed(2)} USDC
                </Text>
                <Text style={styles.ticketDetail}>
                  🕒 {new Date(Number(t.timestamp) * 1000).toLocaleString()}
                </Text>
              </View>
            </View>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#121212',
    borderRadius: 16,
  },
  poolContainer: {},
  poolTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  poolAddress: {
    color: '#ccc',
    fontSize: 12,
    marginBottom: 12,
  },
  ticket: {
    flexDirection: 'row',
    backgroundColor: '#FFD70022', // goldish transparent
    borderRadius: 16,
    overflow: 'hidden',
    borderColor: '#10B981',
    borderWidth: 1,
    marginBottom: 12,
    elevation: 3,
  },
  notchSection: {
    width: 32,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 8,
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
  },
  ticketContent: {
    flex: 1,
    backgroundColor: '#1E1E1E',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  ticketNumber: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 12,
  },
  ticketTitle: {
    color: '#10B981',
    fontWeight: 'bold',
    fontSize: 14,
    marginBottom: 4,
  },
  ticketDetail: {
    color: '#ccc',
    fontSize: 12,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ticketCard: {
    marginBottom: 12,
    backgroundColor: '#1e1e1e',
    padding: 16,
    borderRadius: 12,
  },
  title: {
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
});
