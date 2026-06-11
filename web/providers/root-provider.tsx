'use client';

import { ThemeProvider, createTheme } from '@mui/material/styles';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v16-appRouter';
import CssBaseline from '@mui/material/CssBaseline';
import { SnackbarProvider } from 'notistack';
import { ReactNode, createContext, useContext, useMemo, useState } from 'react';

import QueryProvider from '@/providers/query-provider';
import { saveMode, getClientMode } from '@/utils/cookie';


const ColorModeContext = createContext({
  toggleColorMode: () => { }
});

export const useColorMode = () => useContext(ColorModeContext);

export default function RootProvider({ children, initialMode }: {
  children: ReactNode
  initialMode: 'light' | 'dark'
}) {

  const [mode, setMode] = useState<'light' | 'dark'>(() => initialMode || getClientMode());

  const colorMode = useMemo(
    () => ({
      toggleColorMode: () => {
        setMode((prevMode) => {
          const newMode = prevMode === 'light' ? 'dark' : 'light';
          saveMode(newMode); // 保存到本地
          return newMode;
        });
      }
    }),
    []
  );

  const theme = useMemo(
    () => createTheme({
      palette: {
        mode
        // 你可以在这里定制不同模式下的主色调
        // primary: {
        //   main: mode === 'light' ? '#1976d2' : '#90caf9',
        // },
        // background: {
        //   default: mode === 'light' ? '#f5f5f5' : '#121212',
        // },
      }
    }),
    [mode]
  );

  return (
    <QueryProvider>
      <AppRouterCacheProvider>
        <ColorModeContext.Provider value={colorMode}>
          <ThemeProvider theme={theme}>
            <SnackbarProvider maxSnack={3} autoHideDuration={3000}>
              <CssBaseline />
              {children}
            </SnackbarProvider>
          </ThemeProvider>
        </ColorModeContext.Provider>
      </AppRouterCacheProvider>
    </QueryProvider>
  );

}
