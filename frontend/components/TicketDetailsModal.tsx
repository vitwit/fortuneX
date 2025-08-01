import React, {useState, useCallback} from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import {
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
} from '@solana/spl-token';
import {
  Web3MobileWallet,
  transact,
} from '@solana-mobile/mobile-wallet-adapter-protocol-web3js';
import {useConnection} from './providers/ConnectionProvider';
import {useAuthorization} from './providers/AuthorizationProvider';
import {sha256} from '@noble/hashes/sha256';
import {Buffer} from 'buffer';
import {PROGRAM_ID} from '../util/constants';
import {useToast} from './providers/ToastProvider';
import {useGlobalState} from './providers/NavigationProvider';

interface TicketDetailsModalProps {
  visible: boolean;
  onClose: () => void;
  ticketNumber: string;
  poolId: string;
  amountPaid: string;
  timestamp: string;
  onTicketCancelled?: () => void;
  poolCompleted: boolean;
  poolBPS: number;
}

// Seeds
const GLOBAL_STATE_SEED = Buffer.from('global_state');
const LOTTERY_POOL_SEED = Buffer.from('lottery_pool');
const VAULT_AUTHORITY_SEED = Buffer.from('vault_authority');
const USER_TICKET_SEED = Buffer.from('user_ticket');

export default function TicketDetailsModal({
  visible,
  onClose,
  ticketNumber,
  poolId,
  amountPaid,
  timestamp,
  onTicketCancelled,
  poolCompleted,
  poolBPS,
}: TicketDetailsModalProps) {
  const {connection} = useConnection();
  const {selectedAccount, authorizeSession} = useAuthorization();
  const [cancelling, setCancelling] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const toast = useToast();
  const {globalState} = useGlobalState();
  const USDC_MINT = globalState?.usdcMint;

  // Pool BPS is fixed at 0.5% (50 basis points)
  const POOL_BPS = poolBPS; // 0.5% = 50 basis points

  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(Number(timestamp) * 1000);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  const calculateRefundAmount = (): string => {
    const amountPaidNum = parseFloat(amountPaid);

    // Get commission BPS from global state (default to 0 if not available)
    const commissionBps = globalState?.bonusPoolFeeBps || 0;

    // Total BPS to deduct = commission BPS + pool BPS
    const totalBps = commissionBps + POOL_BPS;

    // Convert BPS to percentage (100 BPS = 1%)
    const totalFeePercentage = totalBps / 10000;

    // Calculate fee amount
    const feeAmount = amountPaidNum * totalFeePercentage;

    // Calculate refund amount
    const refundAmount = amountPaidNum - feeAmount;

    return refundAmount.toFixed(2);
  };

  const createCancelTicketTransaction = useCallback(
    async (poolId: number, ticketNumber: bigint) => {
      if (!selectedAccount?.publicKey) {
        throw new Error('No wallet connected');
      }

      if (!USDC_MINT) {
        throw new Error('Failed to fetch global state');
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
            Buffer.from(new BigUint64Array([BigInt(poolId)]).buffer),
          ],
          PROGRAM_ID,
        );

        const [userTicketPda] = PublicKey.findProgramAddressSync(
          [
            USER_TICKET_SEED,
            userPubkey.toBuffer(),
            Buffer.from(new BigUint64Array([BigInt(poolId)]).buffer),
          ],
          PROGRAM_ID,
        );

        const [poolTokenAccount] = PublicKey.findProgramAddressSync(
          [
            VAULT_AUTHORITY_SEED,
            Buffer.from(new BigUint64Array([BigInt(poolId)]).buffer),
          ],
          PROGRAM_ID,
        );

        const [vaultAuthority] = PublicKey.findProgramAddressSync(
          [
            VAULT_AUTHORITY_SEED,
            Buffer.from(new BigUint64Array([BigInt(poolId)]).buffer),
          ],
          PROGRAM_ID,
        );

        // Get user's USDC token account
        const userTokenAccount = await getAssociatedTokenAddress(
          USDC_MINT,
          userPubkey,
        );

        // Fetch GlobalState account to get platform wallet
        const globalStateAccountInfo = await connection.getAccountInfo(
          globalStatePda,
        );
        if (!globalStateAccountInfo) {
          throw new Error('GlobalState account not found');
        }

        // Parse GlobalState account data
        const platformWalletBytes = globalStateAccountInfo.data.slice(40, 72);
        const platformWallet = new PublicKey(platformWalletBytes);
        console.log(
          'Platform wallet from GlobalState:',
          platformWallet.toBase58(),
        );

        const platformTokenAccount = await getAssociatedTokenAddress(
          USDC_MINT,
          platformWallet,
        );

        // Check if user's token account exists, if not create it
        const userTokenAccountInfo = await connection.getAccountInfo(
          userTokenAccount,
        );
        const instructions: TransactionInstruction[] = [];

        if (!userTokenAccountInfo) {
          console.log('Creating user USDC token account...');
          const createATAIx = createAssociatedTokenAccountInstruction(
            userPubkey, // payer
            userTokenAccount, // associatedToken
            userPubkey, // owner
            USDC_MINT, // mint
          );
          instructions.push(createATAIx);
        }

        // Check if platform's token account exists, if not create it
        const platformTokenAccountInfo = await connection.getAccountInfo(
          platformTokenAccount,
        );
        if (!platformTokenAccountInfo) {
          console.log('Creating platform USDC token account...');
          const createPlatformATAIx = createAssociatedTokenAccountInstruction(
            userPubkey, // payer (user pays for platform's ATA creation)
            platformTokenAccount, // associatedToken
            platformWallet, // owner
            USDC_MINT, // mint
          );
          instructions.push(createPlatformATAIx);
        }

        // Create instruction data for cancel ticket
        const discriminator = Buffer.from(
          sha256('global:cancel_ticket').slice(0, 8),
        );
        const poolIdBuffer = Buffer.from(
          new BigUint64Array([BigInt(poolId)]).buffer,
        );
        const ticketNumberBuffer = Buffer.from(
          new BigUint64Array([ticketNumber]).buffer,
        );

        const ixData = new Uint8Array(
          discriminator.length +
            poolIdBuffer.length +
            ticketNumberBuffer.length,
        );
        ixData.set(discriminator, 0);
        ixData.set(poolIdBuffer, discriminator.length);
        ixData.set(
          ticketNumberBuffer,
          discriminator.length + poolIdBuffer.length,
        );

        // Create instruction accounts
        const keys = [
          {pubkey: globalStatePda, isSigner: false, isWritable: true},
          {pubkey: lotteryPoolPda, isSigner: false, isWritable: true},
          {pubkey: userTicketPda, isSigner: false, isWritable: true},
          {pubkey: userTokenAccount, isSigner: false, isWritable: true},
          {pubkey: poolTokenAccount, isSigner: false, isWritable: true},
          {pubkey: vaultAuthority, isSigner: false, isWritable: false},
          {pubkey: platformTokenAccount, isSigner: false, isWritable: true},
          {pubkey: userPubkey, isSigner: true, isWritable: false},
          {pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false},
          {pubkey: SystemProgram.programId, isSigner: false, isWritable: false},
        ];

        const cancelTicketInstruction = new TransactionInstruction({
          keys,
          programId: PROGRAM_ID,
          data: Buffer.from(ixData),
        });

        instructions.push(cancelTicketInstruction);

        const tx = new Transaction({
          ...latestBlockhash,
          feePayer: userPubkey,
        });

        // Add all instructions to transaction
        instructions.forEach(ix => tx.add(ix));

        const signedTx = await wallet.signTransactions({
          transactions: [tx],
        });

        const txid = await connection.sendRawTransaction(
          signedTx[0].serialize(),
          {
            skipPreflight: false,
            preflightCommitment: 'confirmed',
          },
        );

        console.log('Transaction sent:', txid);
        await connection.confirmTransaction(txid, 'confirmed');

        return signedTx[0];
      });
    },
    [authorizeSession, connection, selectedAccount],
  );

  const handleCancelTicket = async () => {
    if (!selectedAccount?.publicKey) {
      toast.show({message: 'Wallet not connected', type: 'error'});
      return;
    }

    // Show custom confirmation modal
    setShowConfirmModal(true);
  };

  const confirmCancellation = async () => {
    setShowConfirmModal(false);
    setCancelling(true);
    try {
      await createCancelTicketTransaction(Number(poolId), BigInt(ticketNumber));

      toast.show({
        message: `Successfully cancelled ticket #${ticketNumber}. Refund of ${calculateRefundAmount()} has been processed.`,
        type: 'success',
      });

      // Close modal and trigger refresh
      onClose();
      if (onTicketCancelled) {
        onTicketCancelled();
      }
    } catch (err: any) {
      console.error('Cancellation error:', err);
      toast.show({
        message: err instanceof Error ? err.message : 'Failed to cancel ticket',
        type: 'error',
      });
    } finally {
      setCancelling(false);
    }
  };

  const CancelConfirmationModal = () => {
    const refundAmount = calculateRefundAmount();

    return (
      <Modal
        visible={showConfirmModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowConfirmModal(false)}>
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmModalContainer}>
            {/* Header */}
            <View style={styles.confirmHeader}>
              <Text style={styles.confirmHeaderTitle}>⚠️ Cancel Ticket</Text>
            </View>

            {/* Content */}
            <View style={styles.confirmContent}>
              <Text style={styles.confirmMessage}>
                Are you sure you want to cancel ticket #{ticketNumber}?
              </Text>
              <View style={styles.refundBreakdown}>
                <Text style={styles.originalAmountText}>
                  Original Amount: ${amountPaid}
                </Text>
                <Text style={styles.feesText}>Commission will be deducted</Text>
                <Text style={styles.refundAmountText}>
                  You will receive: ${refundAmount}
                </Text>
              </View>
            </View>

            {/* Actions */}
            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={styles.confirmCancelButton}
                onPress={() => setShowConfirmModal(false)}>
                <Text style={styles.confirmCancelButtonText}>
                  No, Keep Ticket
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmDeleteButton}
                onPress={confirmCancellation}>
                <Text style={styles.confirmDeleteButtonText}>
                  Yes, Cancel Ticket
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  return (
    <>
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={onClose}>
        <View style={styles.overlay}>
          <View style={styles.modalContainer}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.headerTitle}>🎟️ Ticket Details</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Ticket Information */}
            <View style={styles.content}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Ticket Number:</Text>
                <Text style={styles.detailValue}>#{ticketNumber}</Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Pool ID:</Text>
                <Text style={styles.detailValue}>#{poolId}</Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Amount Paid:</Text>
                <Text style={styles.detailValueAmount}>${amountPaid}</Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Purchase Date:</Text>
                <Text style={styles.detailValue}>
                  {formatTimestamp(timestamp)}
                </Text>
              </View>
            </View>

            {/* Actions */}
            <View style={styles.actions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={onClose}
                disabled={cancelling}>
                <Text style={styles.cancelButtonText}>Close</Text>
              </TouchableOpacity>

              {!poolCompleted ? (
                <TouchableOpacity
                  style={[
                    styles.refundButton,
                    cancelling && styles.disabledButton,
                  ]}
                  onPress={handleCancelTicket}
                  disabled={cancelling}>
                  {cancelling ? (
                    <View style={styles.loadingContainer}>
                      <ActivityIndicator size="small" color="#ffffff" />
                      <Text style={styles.refundButtonText}>Cancelling...</Text>
                    </View>
                  ) : (
                    <Text style={styles.refundButtonText}>Cancel Ticket</Text>
                  )}
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        </View>
      </Modal>

      {/* Confirmation Modal */}
      <CancelConfirmationModal />
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: '#2a2a2a',
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#444',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  closeButton: {
    padding: 4,
  },
  closeButtonText: {
    fontSize: 18,
    color: '#ccc',
    fontWeight: 'bold',
  },
  content: {
    padding: 20,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  detailLabel: {
    fontSize: 14,
    color: '#ccc',
    flex: 1,
  },
  detailValue: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '500',
    flex: 1,
    textAlign: 'right',
    fontFamily: 'monospace',
  },
  detailValueAmount: {
    fontSize: 16,
    color: '#e5c384',
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'right',
  },
  actions: {
    flexDirection: 'row',
    padding: 20,
    paddingTop: 0,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#444',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '500',
  },
  refundButton: {
    flex: 1,
    backgroundColor: '#dc2626',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  refundButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  disabledButton: {
    backgroundColor: '#666',
    opacity: 0.7,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  // Confirmation Modal Styles
  confirmOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  confirmModalContainer: {
    backgroundColor: '#2a2a2a',
    borderRadius: 16,
    width: '100%',
    maxWidth: 350,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 6},
    shadowOpacity: 0.4,
    shadowRadius: 12,
  },
  confirmHeader: {
    padding: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#444',
    alignItems: 'center',
  },
  confirmHeaderTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
  },
  confirmContent: {
    padding: 20,
    alignItems: 'center',
  },
  confirmMessage: {
    fontSize: 16,
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 8,
    fontWeight: '500',
  },
  confirmSubMessage: {
    fontSize: 14,
    color: '#e5c384',
    textAlign: 'center',
    fontWeight: 'bold',
  },
  confirmActions: {
    flexDirection: 'row',
    padding: 20,
    paddingTop: 0,
    gap: 12,
  },
  confirmCancelButton: {
    flex: 1,
    backgroundColor: '#444',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  confirmCancelButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
  },
  confirmDeleteButton: {
    flex: 1,
    backgroundColor: '#dc2626',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  confirmDeleteButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  refundBreakdown: {
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 12,
    width: '100%',
  },
  originalAmountText: {
    fontSize: 14,
    color: '#ccc',
    textAlign: 'center',
    marginBottom: 4,
  },
  feesText: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    marginBottom: 8,
    fontStyle: 'italic',
  },
  refundAmountText: {
    fontSize: 16,
    color: '#e5c384',
    textAlign: 'center',
    fontWeight: 'bold',
  },
});
