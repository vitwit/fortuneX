import {useEffect, useState} from 'react';
import {PublicKey} from '@solana/web3.js';
import {useConnection} from './providers/ConnectionProvider';
import {
  Text,
  View,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';

type ParsedDrawHistory = {
  pubkey: PublicKey;
  pool: PublicKey;
  poolId: bigint;
  winner: PublicKey;
  prizeAmount: bigint;
  totalParticipants: bigint;
  totalTickets: bigint;
  drawTimestamp: bigint;
  winningTicket: bigint;
  randomSeed: Buffer;
  bump: number;
};

const PROGRAM_ID = new PublicKey(
  'HD5X9GyjdqEMLyjP5QsLaKAweor6KQrcqCejf3NXwxpu',
);

export default function RecentWinner() {
  const {connection} = useConnection();
  const [loading, setLoading] = useState<boolean>(true);
  const [recentWinners, setRecentWinners] = useState<ParsedDrawHistory[]>([]);

  useEffect(() => {
    const fetchRecentWinners = async () => {
      setLoading(true);
      try {
        const accounts = await connection.getProgramAccounts(PROGRAM_ID);

        const parsed: ParsedDrawHistory[] = accounts
          .filter(acc => {
            // Filter for draw history accounts based on account size
            // Draw history accounts should have a specific size based on the struct
            const expectedSize = 8 + 32 + 8 + 32 + 8 + 8 + 8 + 8 + 8 + 32 + 1; // discriminator + struct fields
            return acc.account.data.length === expectedSize;
          })
          .map(acc => {
            const data = acc.account.data;
            
            // Parse the draw history data structure
            const pool = new PublicKey(data.slice(8, 40));
            const poolId = data.readBigUInt64LE(40);
            const winner = new PublicKey(data.slice(48, 80));
            const prizeAmount = data.readBigUInt64LE(80);
            const totalParticipants = data.readBigUInt64LE(88);
            const totalTickets = data.readBigUInt64LE(96);
            const drawTimestamp = data.readBigInt64LE(104);
            const winningTicket = data.readBigUInt64LE(112);
            const randomSeed = data.slice(120, 152);
            const bump = data.readUInt8(152);

            return {
              pubkey: acc.pubkey,
              pool,
              poolId,
              winner,
              prizeAmount,
              totalParticipants,
              totalTickets,
              drawTimestamp,
              winningTicket,
              randomSeed,
              bump,
            };
          });

        // Sort by timestamp (most recent first) and take last 5
        const sortedWinners = parsed
          .sort((a, b) => Number(b.drawTimestamp) - Number(a.drawTimestamp))
          .slice(0, 5);

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

  const renderWinnerCard = (winner: ParsedDrawHistory, index: number) => {
    return (
      <View key={winner.pubkey.toString()} style={styles.winnerCard}>
        <View style={styles.cardHeader}>
          <View style={styles.rankBadge}>
            <Text style={styles.rankText}>#{index + 1}</Text>
          </View>
          <View style={styles.prizeSection}>
            <Text style={styles.prizeAmount}>
              ${formatAmount(winner.prizeAmount)}
            </Text>
            <Text style={styles.prizeLabel}>Prize Won</Text>
          </View>
        </View>

        <View style={styles.cardContent}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Winner:</Text>
            <Text style={styles.infoValue}>
              {truncateAddress(winner.winner.toBase58())}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Pool:</Text>
            <Text style={styles.infoValue}>
              #{winner.poolId.toString()}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Winning Ticket:</Text>
            <Text style={styles.infoValue}>
              #{winner.winningTicket.toString()}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Participants:</Text>
            <Text style={styles.infoValue}>
              {winner.totalParticipants.toString()}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Total Tickets:</Text>
            <Text style={styles.infoValue}>
              {winner.totalTickets.toString()}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Date:</Text>
            <Text style={styles.infoValue}>
              {formatDate(winner.drawTimestamp)}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#e5c384" />
          <Text style={styles.loadingText}>Loading recent winners...</Text>
        </View>
      </View>
    );
  }

  if (recentWinners.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.centered}>
          <Text style={styles.noWinnersText}>🏆</Text>
          <Text style={styles.noWinnersTitle}>No winners yet</Text>
          <Text style={styles.noWinnersSubtitle}>
            Be the first to win a prize!
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🏆 Recent Winners</Text>
        <Text style={styles.headerSubtitle}>
          Last {recentWinners.length} winner{recentWinners.length > 1 ? 's' : ''}
        </Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}>
        {recentWinners.map((winner, index) => renderWinnerCard(winner, index))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  headerSubtitle: {
    color: '#ccc',
    fontSize: 14,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 20,
  },
  winnerCard: {
    backgroundColor: '#2a2a2a',
    borderRadius: 16,
    marginBottom: 16,
    padding: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.3,
    shadowRadius: 4,
    borderLeftWidth: 4,
    borderLeftColor: '#e5c384',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  rankBadge: {
    backgroundColor: '#e5c384',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  rankText: {
    color: '#1a1a1a',
    fontSize: 14,
    fontWeight: 'bold',
  },
  prizeSection: {
    alignItems: 'flex-end',
  },
  prizeAmount: {
    color: '#e5c384',
    fontSize: 24,
    fontWeight: 'bold',
  },
  prizeLabel: {
    color: '#ccc',
    fontSize: 12,
    marginTop: 2,
  },
  cardContent: {
    gap: 8,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoLabel: {
    color: '#ccc',
    fontSize: 14,
  },
  infoValue: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'monospace',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    color: '#ffffff',
    fontSize: 16,
  },
  noWinnersText: {
    fontSize: 64,
    marginBottom: 20,
  },
  noWinnersTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  noWinnersSubtitle: {
    color: '#ccc',
    fontSize: 14,
    textAlign: 'center',
  },
});