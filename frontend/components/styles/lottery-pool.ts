import {Dimensions, StyleSheet} from 'react-native';

const screenWidth = Dimensions.get('window').width;

export const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  poolsScrollContainer: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  poolCard: {
    width: screenWidth * 0.9,
    backgroundColor: '#1A1A1A',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    marginTop: 10,
  },

  poolHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    alignContent: 'center',
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
    backgroundColor: '#fff',
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
  viewMoreButton: {
    backgroundColor: '#10B981',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  // emptyContainer: {
  //   alignItems: 'center',
  //   justifyContent: 'center',
  //   paddingVertical: 60,
  //   width: 280,
  // },
  // emptyText: {
  //   fontSize: 16,
  //   color: '#9CA3AF',
  //   textAlign: 'center',
  // },
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
  emptyWrapper: {
    paddingVertical: 20,
    alignItems: 'center',
  },

  emptyContainer: {
    backgroundColor: '#1e1e1e',
    padding: 16,
    borderRadius: 12,
    marginHorizontal: 20,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 5,
  },

  emptyText: {
    color: '#aaa',
    fontSize: 16,
    textAlign: 'center',
  },
  poolsSection: {
    marginBottom: 30,
  },
  sectionHeader: {
    flexDirection: 'column',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginVertical: 10,
    marginLeft: 16,
  },
  ticketBadge: {
    backgroundColor: '#DCFCE7', // Light green
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 6,
    maxWidth: '100%',
  },

  ticketBadgeText: {
    color: '#065F46', // Dark green text
    fontSize: 12,
    fontWeight: '600',
  },
  poolsScroll: {
    flexDirection: 'row',
  },

  currentPoolSection: {
    marginBottom: 30,
    backgroundColor: '#1A1A1A',
    borderRadius: 24,
    padding: 24,
    marginHorizontal: 10,
    borderWidth: 2,
    borderColor: '#10B981',
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#10B981',
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 15,
    width: screenWidth * 0.95,
  },

  currentPoolGlow: {
    position: 'absolute',
    top: -10,
    left: -10,
    right: -10,
    bottom: -10,
    backgroundColor: '#10B981',
    borderRadius: 30,
    opacity: 0.1,
  },

  prizePoolContainer: {
    alignItems: 'center',
    marginBottom: 32,
    position: 'relative',
    zIndex: 1,
  },

  prizePoolLabel: {
    fontSize: 22,
    color: '#FFFFFF',
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
    letterSpacing: 0.5,
    textShadowColor: 'rgba(16, 185, 129, 0.3)',
    textShadowOffset: {width: 0, height: 0},
    textShadowRadius: 10,
  },

  prizePoolAmount: {
    fontSize: 56,
    color: '#10B981',
    fontWeight: '900',
    marginBottom: 8,
    textAlign: 'center',
    textShadowColor: 'rgba(16, 185, 129, 0.6)',
    textShadowOffset: {width: 0, height: 0},
    textShadowRadius: 15,
    letterSpacing: -1,
  },

  prizePoolSubtext: {
    fontSize: 20,
    color: '#FFFFFF',
    fontWeight: '600',
    marginBottom: 28,
    textShadowColor: 'rgba(255, 255, 255, 0.3)',
    textShadowOffset: {width: 0, height: 0},
    textShadowRadius: 8,
  },

  buyTicketsButton: {
    backgroundColor: '#10B981',
    paddingHorizontal: 56,
    paddingVertical: 18,
    borderRadius: 30,
    shadowColor: '#10B981',
    elevation: 12,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    position: 'relative',
    overflow: 'hidden',
  },

  buyTicketsText: {
    fontSize: 20,
    color: '#FFFFFF',
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: {width: 0, height: 1},
    textShadowRadius: 3,
  },

  ticketsNowSection: {
    alignItems: 'center',
    position: 'relative',
    zIndex: 1,
  },

  ticketsNowTitle: {
    fontSize: 28,
    color: '#FFFFFF',
    fontWeight: '800',
    marginBottom: 20,
    textShadowColor: 'rgba(255, 255, 255, 0.3)',
    textShadowOffset: {width: 0, height: 0},
    textShadowRadius: 10,
    letterSpacing: 0.5,
  },

  timerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 28,
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
  },

  timerItem: {
    alignItems: 'center',
    marginHorizontal: 12,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    minWidth: 60,
    elevation: 6,
  },

  timerNumber: {
    fontSize: 36,
    color: '#10B981',
    fontWeight: '900',
    textAlign: 'center',
  },

  timerLabel: {
    fontSize: 14,
    color: '#10B981',
    fontWeight: '700',
    marginTop: 4,
    letterSpacing: 0.5,
  },

  timerSeparator: {
    marginLeft: 20,
  },

  timerSeparatorText: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: '600',
    textShadowColor: 'rgba(255, 255, 255, 0.3)',
    textShadowOffset: {width: 0, height: 0},
    textShadowRadius: 8,
  },

  nextDrawInfo: {
    backgroundColor: 'rgba(42, 42, 42, 0.8)',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
    shadowColor: '#000000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },

  nextDrawLabel: {
    fontSize: 16,
    color: '#10B981',
    fontWeight: '700',
    marginBottom: 6,
    letterSpacing: 0.5,
  },

  nextDrawTime: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: '700',
    textShadowColor: 'rgba(255, 255, 255, 0.2)',
    textShadowOffset: {width: 0, height: 1},
    textShadowRadius: 4,
  },
});
