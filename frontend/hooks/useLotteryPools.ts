import {useState, useEffect, useCallback} from 'react';
import {PublicKey} from '@solana/web3.js';
import {useConnection} from '../components/providers/ConnectionProvider';
import {PROGRAM_ID} from '../util/constants';

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

interface UseLotteryPoolState {
  poolsData: Map<string, LotteryPoolData>;
  loading: boolean;
  error: string | null;
  refreshing: boolean;
}

interface UseLotteryPoolReturn extends UseLotteryPoolState {
  fetchPoolData: (poolId: string) => Promise<void>;
  fetchMultiplePools: (poolIds: string[]) => Promise<void>;
  refreshPool: (poolId: string) => Promise<void>;
  refreshAllPools: () => Promise<void>;
  getPoolById: (poolId: string) => LotteryPoolData | undefined;
  clearError: () => void;
  subscribeToPool: (
    poolId: string,
    callback: (data: LotteryPoolData) => void,
  ) => () => void;
}

const LOTTERY_POOL_SEED = Buffer.from('lottery_pool');
export const useLotteryPool = (): UseLotteryPoolReturn => {
  const {connection} = useConnection();
  const [state, setState] = useState<UseLotteryPoolState>({
    poolsData: new Map(),
    loading: false,
    error: null,
    refreshing: false,
  });

  // Function to get lottery pool PDA
  const getLotteryPoolPDA = useCallback((poolId: number): PublicKey => {
    const poolIdBuffer = Buffer.alloc(8);
    poolIdBuffer.writeBigUInt64LE(BigInt(poolId), 0);

    const [poolPDA] = PublicKey.findProgramAddressSync(
      [LOTTERY_POOL_SEED, poolIdBuffer],
      PROGRAM_ID,
    );
    return poolPDA;
  }, []);

  // Function to parse pool data
  const parsePoolData = useCallback((data: Buffer): LotteryPoolData | null => {
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

      // tickets_sold (Vec)
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
  }, []);

  // Fetch single pool data
  const fetchPoolData = useCallback(
    async (poolId: string) => {
      try {
        setState(prev => ({...prev, loading: true, error: null}));

        const poolPDA = getLotteryPoolPDA(Number(poolId));
        const accountInfo = await connection.getAccountInfo(poolPDA);

        if (accountInfo && accountInfo.data) {
          const poolData = parsePoolData(accountInfo.data);
          if (poolData) {
            setState(prev => ({
              ...prev,
              poolsData: new Map(
                prev.poolsData.set(poolId, {
                  ...poolData,
                  address: poolPDA.toString(),
                }),
              ),
              loading: false,
            }));
          } else {
            setState(prev => ({
              ...prev,
              loading: false,
              error: `Failed to parse data for pool ${poolId}`,
            }));
          }
        } else {
          setState(prev => ({
            ...prev,
            loading: false,
            error: `Pool ${poolId} not found`,
          }));
        }
      } catch (error) {
        console.error(`Error fetching pool ${poolId}:`, error);
        setState(prev => ({
          ...prev,
          loading: false,
          error: `Error fetching pool ${poolId}: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`,
        }));
      }
    },
    [connection, getLotteryPoolPDA, parsePoolData],
  );

  // Fetch multiple pools
  const fetchMultiplePools = useCallback(
    async (poolIds: string[]) => {
      setState(prev => ({...prev, loading: true, error: null}));

      try {
        const promises = poolIds.map(poolId =>
          fetchPoolData(poolId).catch(error => {
            console.error(`Error fetching pool ${poolId}:`, error);
            return null;
          }),
        );

        await Promise.all(promises);
        setState(prev => ({...prev, loading: false}));
      } catch (error) {
        setState(prev => ({
          ...prev,
          loading: false,
          error: `Error fetching multiple pools: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`,
        }));
      }
    },
    [fetchPoolData],
  );

  // Refresh single pool
  const refreshPool = useCallback(
    async (poolId: string) => {
      setState(prev => ({...prev, refreshing: true}));
      await fetchPoolData(poolId);
      setState(prev => ({...prev, refreshing: false}));
    },
    [fetchPoolData],
  );

  // Refresh all pools
  const refreshAllPools = useCallback(async () => {
    setState(prev => ({...prev, refreshing: true}));
    const poolIds = Array.from(state.poolsData.keys());
    if (poolIds.length > 0) {
      await fetchMultiplePools(poolIds);
    }
    setState(prev => ({...prev, refreshing: false}));
  }, [state.poolsData, fetchMultiplePools]);

  // Get pool by ID
  const getPoolById = useCallback(
    (poolId: string): LotteryPoolData | undefined => {
      return state.poolsData.get(poolId);
    },
    [state.poolsData],
  );

  // Clear error
  const clearError = useCallback(() => {
    setState(prev => ({...prev, error: null}));
  }, []);

  // Subscribe to pool changes (for real-time updates)
  const subscribeToPool = useCallback(
    (poolId: string, callback: (data: LotteryPoolData) => void) => {
      let intervalId: NodeJS.Timeout;

      const pollForChanges = async () => {
        try {
          const poolPDA = getLotteryPoolPDA(Number(poolId));
          const accountInfo = await connection.getAccountInfo(poolPDA);

          if (accountInfo && accountInfo.data) {
            const poolData = parsePoolData(accountInfo.data);
            if (poolData) {
              const updatedData = {...poolData, address: poolPDA.toString()};

              // Check if data has changed
              const currentData = state.poolsData.get(poolId);
              if (
                !currentData ||
                JSON.stringify(currentData) !== JSON.stringify(updatedData)
              ) {
                setState(prev => ({
                  ...prev,
                  poolsData: new Map(prev.poolsData.set(poolId, updatedData)),
                }));
                callback(updatedData);
              }
            }
          }
        } catch (error) {
          console.error(`Error polling pool ${poolId}:`, error);
        }
      };

      // Poll every 10 seconds
      intervalId = setInterval(pollForChanges, 10000);

      // Return cleanup function
      return () => {
        if (intervalId) {
          clearInterval(intervalId);
        }
      };
    },
    [connection, getLotteryPoolPDA, parsePoolData, state.poolsData],
  );

  return {
    ...state,
    fetchPoolData,
    fetchMultiplePools,
    refreshPool,
    refreshAllPools,
    getPoolById,
    clearError,
    subscribeToPool,
  };
};
