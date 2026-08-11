import { createContext, PropsWithChildren, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';

import { AppTheme, darkTheme, lightTheme } from '@/constants/theme';

const ThemeContext = createContext<AppTheme>(lightTheme);

export function ThemeProvider({ children }: PropsWithChildren) {
  const colorScheme = useColorScheme();
  const theme = useMemo(() => (colorScheme === 'dark' ? darkTheme : lightTheme), [colorScheme]);

  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useAppTheme() {
  return useContext(ThemeContext);
}
