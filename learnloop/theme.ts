'use client';
import { createTheme, PaletteMode } from '@mui/material/styles';

const getDesignTokens = (mode: PaletteMode) => ({
  palette: {
    mode,
    ...(mode === 'light'
      ? {
          // Light mode
          primary: {
            main: '#3f51b5',
          },
          secondary: {
            main: '#7b1fa2',
          },
          accent: {
            main: '#e91e63',
          },
          background: {
            default: '#f5f7ff',
            paper: '#ffffff',
          },
          text: {
            primary: '#333333',
            secondary: '#555555',
          },
        }
      : {
          // Dark mode
          primary: {
            main: '#5c6bc0',
          },
          secondary: {
            main: '#9c27b0',
          },
          accent: {
            main: '#f06292',
          },
          background: {
            default: '#121212',
            paper: '#1e1e1e',
          },
          text: {
            primary: '#f5f5f5',
            secondary: '#b0b0b0',
          },
        }),
  },
  typography: {
    fontFamily: 'var(--font-roboto)',
  },
});

// Create a theme instance.
const lightTheme = createTheme(getDesignTokens('light'));
const darkTheme = createTheme(getDesignTokens('dark'));

export { lightTheme, darkTheme };