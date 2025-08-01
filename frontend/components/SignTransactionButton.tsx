import React, {useState, useCallback} from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Alert,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Animated,
  ActivityIndicator,
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

const {width} = Dimensions.get('window');

export default function LotteryDepositComponent() {
  const {connection} = useConnection();
  const {authorizeSession} = useAuthorization();
  const [depositAmount, setDepositAmount] = useState('');
  const [signingInProgress, setSigningInProgress] = useState(false);
  const [poolInfo, setPoolInfo] = useState<any>(null);
  const [pulseAnim] = useState(new Animated.Value(1));
  const [progressAnim] = useState(new Animated.Value(0));

  // Replace with your deployed lottery pool program ID
  const PROGRAM_ID = new PublicKey(
    'Gu2wsBESFiRtaS5auaAViQ7i22k66iUQADFEBk79ujkE',
  );

  // Pulse animation for the lottery icon
  React.useEffect(() => {
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

  // Progress bar animation
  React.useEffect(() => {
    if (poolInfo) {
      const progress = poolInfo.totalDeposited / poolInfo.targetAmount;
      Animated.timing(progressAnim, {
        toValue: Math.min(progress, 1),
        duration: 800,
        useNativeDriver: false,
      }).start();
    }
  }, [poolInfo, progressAnim]);

  // Function to get pool PDA
  const getPoolPDA = () => {
    const [poolPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('lottery_pool')],
      PROGRAM_ID,
    );
    return poolPDA;
  };

  // Function to get participant PDA
  const getParticipantPDA = (userPubkey: any, poolPDA: any) => {
    const [participantPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('participant'), userPubkey.toBuffer(), poolPDA.toBuffer()],
      PROGRAM_ID,
    );
    return participantPDA;
  };

  // Function to fetch pool information
  const fetchPoolInfo = useCallback(async () => {
    try {
      const poolPDA = getPoolPDA();
      const accountInfo = await connection.getAccountInfo(poolPDA);

      if (accountInfo && accountInfo.data) {
        const data = accountInfo.data;
        const totalDeposited = new DataView(data.buffer).getBigUint64(40, true);
        const participantCount = new DataView(data.buffer).getBigUint64(48, true);
        const targetAmount = new DataView(data.buffer).getBigUint64(56, true);

        setPoolInfo({
          totalDeposited: Number(totalDeposited) / LAMPORTS_PER_SOL,
          participantCount: Number(participantCount),
          targetAmount: Number(targetAmount) / LAMPORTS_PER_SOL,
          balance: accountInfo.lamports / LAMPORTS_PER_SOL,
        });
      }
    } catch (error) {
      console.error('Error fetching pool info:', error);
    }
  }, [connection]);

  // Function to create deposit transaction
  const createDepositTransaction = useCallback(async () => {
    if (!depositAmount || parseFloat(depositAmount) <= 0) {
      Alert.alert('Error', 'Please enter a valid deposit amount');
      return;
    }

    return await transact(async (wallet: Web3MobileWallet) => {
      const [authorizationResult, latestBlockhash] = await Promise.all([
        authorizeSession(wallet),
        connection.getLatestBlockhash(),
      ]);

      const userPubkey = authorizationResult.publicKey;
      const poolPDA = getPoolPDA();
      const participantPDA = getParticipantPDA(userPubkey, poolPDA);

      const balance = await connection.getBalance(userPubkey);
      const depositLamports = parseFloat(depositAmount) * LAMPORTS_PER_SOL;

      if (balance < depositLamports) {
        throw new Error('Insufficient balance for deposit');
      }

      const discriminator = Buffer.from(sha256('global:deposit').slice(0, 8));
      const amountBuffer = new Uint8Array(8);
      new DataView(amountBuffer.buffer).setBigUint64(
        0,
        BigInt(depositLamports),
        true,
      );

      const ixData = new Uint8Array(discriminator.length + amountBuffer.length);
      ixData.set(discriminator, 0);
      ixData.set(amountBuffer, discriminator.length);

      const keys = [
        {pubkey: poolPDA, isSigner: false, isWritable: true},
        {pubkey: participantPDA, isSigner: false, isWritable: true},
        {pubkey: userPubkey, isSigner: true, isWritable: true},
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

      const txid = await connection.sendRawTransaction(signedTx[0].serialize());
      await connection.confirmTransaction(txid, 'confirmed');
      await fetchPoolInfo();

      return signedTx[0];
    });
  }, [authorizeSession, connection, depositAmount, fetchPoolInfo]);

  // Handle deposit
  const handleDeposit = async () => {
    if (signingInProgress) {
      return;
    }

    setSigningInProgress(true);
    try {
      const signedTransaction = await createDepositTransaction();
      alertAndLog(
        'Deposit Successful',
        `Successfully deposited ${depositAmount} SOL to lottery pool!`,
      );
      setDepositAmount('');
    } catch (err: any) {
      alertAndLog('Deposit Failed', err instanceof Error ? err.message : err);
    } finally {
      setSigningInProgress(false);
    }
  };

  // Load pool info on component mount
  React.useEffect(() => {
    fetchPoolInfo();
  }, [fetchPoolInfo]);

  const progressPercentage = poolInfo
    ? (poolInfo.totalDeposited / poolInfo.targetAmount) * 100
    : 0;

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} style={styles.scrollView}>
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
          <Text style={styles.title}>FortuneX Pool</Text>
          <Text style={styles.subtitle}>
            Join the pool, win the prize!
          </Text>
        </View>

        {/* Pool Information Card */}
        {poolInfo && (
          <View style={styles.poolCard}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Current Pool Status</Text>
              <View style={styles.liveIndicator}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>LIVE</Text>
              </View>
            </View>

            {/* Prize Pool Display */}
            <View style={styles.prizeContainer}>
              <Text style={styles.prizeLabel}>Prize Pool</Text>
              <Text style={styles.prizeAmount}>
                ◎ {poolInfo.totalDeposited.toFixed(4)}
              </Text>
              <Text style={styles.prizeTarget}>
                Target: ◎ {poolInfo.targetAmount.toFixed(0)}
              </Text>
            </View>

            {/* Progress Bar */}
            <View style={styles.progressContainer}>
              <View style={styles.progressBackground}>
                <Animated.View
                  style={[
                    styles.progressFill,
                    {
                      width: progressAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0%', '100%'],
                      }),
                    },
                  ]}
                />
              </View>
              <Text style={styles.progressText}>
                {progressPercentage.toFixed(1)}% Complete
              </Text>
            </View>

            {/* Stats Row */}
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{poolInfo.participantCount}</Text>
                <Text style={styles.statLabel}>Participants</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {poolInfo.targetAmount - poolInfo.totalDeposited > 0
                    ? `◎ ${(poolInfo.targetAmount - poolInfo.totalDeposited).toFixed(4)}`
                    : 'READY!'}
                </Text>
                <Text style={styles.statLabel}>Remaining</Text>
              </View>
            </View>
          </View>
        )}

        {/* Deposit Section */}
        <View style={styles.depositCard}>
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Deposit Amount</Text>
            <View style={styles.inputWrapper}>
              <Text style={styles.solSymbol}>◎</Text>
              <TextInput
                style={styles.input}
                value={depositAmount}
                onChangeText={setDepositAmount}
                placeholder="0.00"
                keyboardType="numeric"
                editable={!signingInProgress}
                placeholderTextColor="#9CA3AF"
              />
              <Text style={styles.solText}>SOL</Text>
            </View>
          </View>

          {/* Quick Amount Buttons */}
          <View style={styles.quickAmountContainer}>
            <Text style={styles.quickAmountLabel}>Quick amounts:</Text>
            <View style={styles.quickAmountButtons}>
              {['0.1', '0.5', '1.0', '2.0'].map((amount) => (
                <TouchableOpacity
                  key={amount}
                  style={[
                    styles.quickAmountButton,
                    depositAmount === amount && styles.quickAmountButtonActive,
                  ]}
                  onPress={() => setDepositAmount(amount)}
                  disabled={signingInProgress}>
                  <Text
                    style={[
                      styles.quickAmountButtonText,
                      depositAmount === amount && styles.quickAmountButtonTextActive,
                    ]}>
                    {amount}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Deposit Button */}
          <TouchableOpacity
            style={[
              styles.depositButton,
              (signingInProgress || !depositAmount) && styles.depositButtonDisabled,
            ]}
            onPress={handleDeposit}
            disabled={signingInProgress || !depositAmount}>
            {signingInProgress ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color="#FFFFFF" />
                <Text style={styles.depositButtonText}>Processing...</Text>
              </View>
            ) : (
              <Text style={styles.depositButtonText}>
                🚀 Join Lottery Pool
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Refresh Button */}
        <TouchableOpacity
          style={[
            styles.refreshButton,
            signingInProgress && styles.refreshButtonDisabled,
          ]}
          onPress={fetchPoolInfo}
          disabled={signingInProgress}>
          <Text style={styles.refreshButtonText}>🔄 Refresh Pool Info</Text>
        </TouchableOpacity>

        {/* How it Works Section */}
        <View style={styles.howItWorksCard}>
          <Text style={styles.howItWorksTitle}>How it Works</Text>
          <View style={styles.stepContainer}>
            <View style={styles.step}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>1</Text>
              </View>
              <Text style={styles.stepText}>
                Deposit SOL to join the lottery pool
              </Text>
            </View>
            <View style={styles.step}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>2</Text>
              </View>
              <Text style={styles.stepText}>
                When pool reaches target, a winner is randomly selected
              </Text>
            </View>
            <View style={styles.step}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>3</Text>
              </View>
              <Text style={styles.stepText}>
                Winner receives the entire pool amount
              </Text>
            </View>
            <View style={styles.step}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>4</Text>
              </View>
              <Text style={styles.stepText}>
                Pool resets automatically for the next round
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F23',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 30,
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
  poolCard: {
    backgroundColor: '#1F1F37',
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#2D2D44',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10B981',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  liveDot: {
    width: 6,
    height: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 3,
    marginRight: 5,
  },
  liveText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  prizeContainer: {
    alignItems: 'center',
    marginBottom: 25,
  },
  prizeLabel: {
    fontSize: 14,
    color: '#9CA3AF',
    marginBottom: 5,
  },
  prizeAmount: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#10B981',
    marginBottom: 5,
  },
  prizeTarget: {
    fontSize: 14,
    color: '#6B7280',
  },
  progressContainer: {
    marginBottom: 20,
  },
  progressBackground: {
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
    textAlign: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 5,
  },
  statLabel: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#2D2D44',
    marginHorizontal: 20,
  },
  depositCard: {
    backgroundColor: '#1F1F37',
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#2D2D44',
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 10,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2D2D44',
    borderRadius: 12,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: '#3D3D54',
  },
  solSymbol: {
    fontSize: 18,
    color: '#10B981',
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 18,
    color: '#FFFFFF',
    paddingVertical: 15,
  },
  solText: {
    fontSize: 14,
    color: '#9CA3AF',
    marginLeft: 10,
  },
  quickAmountContainer: {
    marginBottom: 25,
  },
  quickAmountLabel: {
    fontSize: 14,
    color: '#9CA3AF',
    marginBottom: 10,
  },
  quickAmountButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  quickAmountButton: {
    flex: 1,
    backgroundColor: '#2D2D44',
    paddingVertical: 10,
    borderRadius: 8,
    marginHorizontal: 2,
    borderWidth: 1,
    borderColor: '#3D3D54',
  },
  quickAmountButtonActive: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  quickAmountButtonText: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    fontWeight: '600',
  },
  quickAmountButtonTextActive: {
    color: '#FFFFFF',
  },
  depositButton: {
    backgroundColor: '#10B981',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#10B981',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  depositButtonDisabled: {
    backgroundColor: '#374151',
    shadowOpacity: 0,
  },
  depositButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
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
  howItWorksCard: {
    backgroundColor: '#1F1F37',
    marginHorizontal: 20,
    marginBottom: 30,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#2D2D44',
  },
  howItWorksTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 20,
    textAlign: 'center',
  },
  stepContainer: {
    gap: 15,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepNumber: {
    width: 30,
    height: 30,
    backgroundColor: '#10B981',
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  stepNumberText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  stepText: {
    flex: 1,
    fontSize: 14,
    color: '#D1D5DB',
    lineHeight: 20,
  },
});