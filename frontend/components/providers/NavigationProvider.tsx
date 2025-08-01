import {PublicKey} from '@solana/web3.js';
import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from 'react';
import {GLOBAL_STATE_SEED, PROGRAM_ID} from '../../util/constants';
import {useConnection} from './ConnectionProvider';

type ScreenName = 'Home' | 'Pool';


interface GlobalState {
  authority: PublicKey; // PublicKey type - replace with your actual PublicKey import
  platformWallet: PublicKey; // PublicKey type
  usdcMint: PublicKey; // PublicKey type
  platformFeeBps: number;
  bonusPoolFeeBps: number;
  poolsCount: number;
  creatorsWhitelist: PublicKey[]; // PublicKey[] type
  bump: number;
}

type NavigationContextType = {
  screen: ScreenName;
  params?: Record<string, any>;
  globalState: GlobalState | null;
  isLoadingGlobalState: boolean;
  navigate: (screen: ScreenName, params?: Record<string, any>) => void;
  goBack: () => void;
  refreshGlobalState: () => Promise<void>;
};

const NavigationContext = createContext<NavigationContextType | undefined>(
  undefined,
);

// You'll need to pass these as props or import them
interface NavigationProviderProps {
  children: React.ReactNode;
}

export const NavigationProvider = ({children}: NavigationProviderProps) => {
  const [screen, setScreen] = useState<ScreenName>('Home');
  const [params, setParams] = useState<Record<string, any>>({});
  const [globalState, setGlobalState] = useState<GlobalState | null>(null);
  const [isLoadingGlobalState, setIsLoadingGlobalState] = useState(false);
  const {connection} = useConnection();

  const getGlobalStatePDA = (): PublicKey => {
    const [globalStatePDA] = PublicKey.findProgramAddressSync(
      [GLOBAL_STATE_SEED],
      PROGRAM_ID,
    );
    return globalStatePDA;
  };
  const parsePublicKey = (buffer: Buffer, offset: number): string => {
    const keyBytes = new Uint8Array(buffer.buffer, offset, 32);
    return Array.from(keyBytes, byte =>
      byte.toString(16).padStart(2, '0'),
    ).join('');
  };

  // Function to fetch global state
  const fetchGlobalState =
    useCallback(async (): Promise<GlobalState | null> => {
      try {
        const globalStatePDA = getGlobalStatePDA();
        const accountInfo = await connection.getAccountInfo(globalStatePDA);

        if (accountInfo && accountInfo.data) {
        const buffer = accountInfo.data;
        const view = new DataView(buffer.buffer);
        let offset = 8; // Skip discriminator

        // Parse authority (32 bytes)
        const authorityBytes = new Uint8Array(buffer.buffer, offset, 32);
        const authority = new PublicKey(authorityBytes);
        offset += 32;

        // Parse platform_wallet (32 bytes)
        const platformWalletBytes = new Uint8Array(buffer.buffer, offset, 32);
        const platformWallet = new PublicKey(platformWalletBytes);
        offset += 32;

        // Parse usdc_mint (32 bytes)
        const usdcMintBytes = new Uint8Array(buffer.buffer, offset, 32);
        const usdcMint = new PublicKey(usdcMintBytes);
        offset += 32;

        // Parse platform_fee_bps (2 bytes)
        const platformFeeBps = view.getUint16(offset, true);
        offset += 2;

        // Parse bonus_pool_fee_bps (2 bytes)
        const bonusPoolFeeBps = view.getUint16(offset, true);
        offset += 2;

        // Parse pools_count (8 bytes)
        const poolsCount = Number(view.getBigUint64(offset, true));
        offset += 8;

        // Parse creators_whitelist (Vec<Pubkey>)
        const creatorsWhitelistLength = view.getUint32(offset, true);
        offset += 4;
        const creatorsWhitelist: any[] = [];
        for (let i = 0; i < creatorsWhitelistLength; i++) {
          const creatorBytes = new Uint8Array(buffer.buffer, offset, 32);
          const creator = new PublicKey(creatorBytes);
          creatorsWhitelist.push(creator);
          offset += 32;
        }

        // Parse bump (1 byte)
        const bump = view.getUint8(offset);
        offset += 1;

        return {
          authority,
          platformWallet,
          usdcMint,
          platformFeeBps,
          bonusPoolFeeBps,
          poolsCount,
          creatorsWhitelist,
          bump,
        };
      }
      return null;
      } catch (error) {
        console.error('Error fetching global state:', error);
        return null;
      }
    }, [connection, getGlobalStatePDA]);

  // Function to refresh global state
  const refreshGlobalState = useCallback(async () => {
    setIsLoadingGlobalState(true);
    try {
      const state = await fetchGlobalState();
      setGlobalState(state);
    } finally {
      setIsLoadingGlobalState(false);
    }
  }, [fetchGlobalState]);

  // Fetch global state on mount
  useEffect(() => {
    refreshGlobalState();
  }, []);

  const navigate = (
    nextScreen: ScreenName,
    nextParams?: Record<string, any>,
  ) => {
    setScreen(nextScreen);
    setParams(nextParams || {});
  };

  const goBack = () => {
    setScreen('Home');
    setParams({});
  };

  return (
    <NavigationContext.Provider
      value={{
        screen,
        params,
        globalState,
        isLoadingGlobalState,
        navigate,
        goBack,
        refreshGlobalState,
      }}>
      {children}
    </NavigationContext.Provider>
  );
};

export const useNavigation = () => {
  const ctx = useContext(NavigationContext);
  if (!ctx)
    throw new Error('useNavigation must be used inside NavigationProvider');
  return ctx;
};

// Optional: Custom hook specifically for global state
export const useGlobalState = () => {
  const {globalState, isLoadingGlobalState, refreshGlobalState} =
    useNavigation();
  return {globalState, isLoadingGlobalState, refreshGlobalState};
};
