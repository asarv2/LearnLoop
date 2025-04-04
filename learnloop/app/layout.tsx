'use client';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v15-appRouter'
import { Roboto } from 'next/font/google';
import { ThemeProvider } from '@mui/material/styles';
import { CssBaseline } from '@mui/material';
import { useState, useEffect, createContext, useMemo } from 'react';
import { lightTheme, darkTheme } from '../theme';
import "./globals.css";

const roboto = Roboto({
  weight: ['300', '400', '500', '700'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-roboto',
});

// Create context for theme mode
export const ColorModeContext = createContext({ 
  toggleColorMode: () => {} 
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [mode, setMode] = useState<'light' | 'dark'>('dark'); // Dark mode by default
  const [mounted, setMounted] = useState(false);
  
  // Avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  const colorMode = useMemo(
    () => ({
      toggleColorMode: () => {
        setMode((prevMode) => (prevMode === 'light' ? 'dark' : 'light'));
      },
    }),
    [],
  );

  const theme = useMemo(
    () => mode === 'light' ? lightTheme : darkTheme,
    [mode],
  );

  return (
    <html lang="en">
      <head>
        <title>LearnLoop</title>
        <meta name="description" content="On a mission to elevate university learning with AI." />
      </head>
      <body className={roboto.variable}>
        {mounted && (
          <ColorModeContext.Provider value={colorMode}>
            <ThemeProvider theme={theme}>
              <CssBaseline />
              <AppRouterCacheProvider>
                {children}
              </AppRouterCacheProvider>
            </ThemeProvider>
          </ColorModeContext.Provider>
        )}
      </body>
    </html>
  );
}
