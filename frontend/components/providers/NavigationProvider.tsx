import React, {createContext, useContext, useState} from 'react';

type ScreenName = 'Home' | 'Pool';

type NavigationContextType = {
  screen: ScreenName;
  params?: Record<string, any>;
  navigate: (screen: ScreenName, params?: Record<string, any>) => void;
  goBack: () => void;
};

const NavigationContext = createContext<NavigationContextType | undefined>(
  undefined,
);

export const NavigationProvider = ({children}: {children: React.ReactNode}) => {
  const [screen, setScreen] = useState<ScreenName>('Home');
  const [params, setParams] = useState<Record<string, any>>({});

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
    <NavigationContext.Provider value={{screen, params, navigate, goBack}}>
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
