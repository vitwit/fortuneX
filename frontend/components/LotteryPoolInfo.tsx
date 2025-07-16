import React, {useEffect, useState} from 'react';
import {View, Text, ActivityIndicator, StyleSheet, Button} from 'react-native';
import {useConnection} from '../components/providers/ConnectionProvider';
import {PublicKey} from '@solana/web3.js';
import {Buffer} from 'buffer';
import {useNavigation} from './providers/NavigationProvider';

const PROGRAM_ID = new PublicKey(
  'HD5X9GyjdqEMLyjP5QsLaKAweor6KQrcqCejf3NXwxpu',
);
const LOTTERY_POOL_SEED = Buffer.from('lottery_pool');
const TICKET_PRICE = 10_000_000;

const LotteryPoolInfo = () => {
  const {connection} = useConnection();
  const {params, goBack} = useNavigation();
  const [loading, setLoading] = useState(true);
  const [poolData, setPoolData] = useState<any>(null);

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

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="small" />
        <Text>Loading pool #{poolId}...</Text>
      </View>
    );
  }

  if (!poolData) {
    return (
      <View style={styles.center}>
        <Text>Pool #{poolId} not found.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🎰 Pool #{poolData.poolId}</Text>
      <Text>Status: {poolData.status}</Text>
      <Text>Prize Pool: ${formatUSDC(poolData.prizePool)}</Text>
      <Text>Tickets Sold: {poolData.ticketsSold}</Text>
      <Text>Participants: {poolData.participants.length}</Text>
      <Text>
        Draw Time: {new Date(poolData.drawTime * 1000).toLocaleString()}
      </Text>

      {/* 🎟️ Buy Ticket Button — to be implemented */}
      <Button
        title="🎟️ Buy Ticket"
        onPress={() => console.log('Coming soon')}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {padding: 16},
  center: {flex: 1, justifyContent: 'center', alignItems: 'center'},
  title: {fontSize: 20, fontWeight: 'bold', marginBottom: 12},
});

export default LotteryPoolInfo;
