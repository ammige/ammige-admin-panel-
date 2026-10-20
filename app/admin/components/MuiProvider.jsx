'use client';

import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#1C1A16', contrastText: '#FAF6EF' },
    secondary: { main: '#8B6F4E' },
    error: { main: '#B3402E' },
    success: { main: '#2E7D32' },
    warning: { main: '#B07D2B' },
    background: { default: '#F7F4EE', paper: '#FFFFFF' },
    text: { primary: '#1C1A16', secondary: '#8A7E6B' },
    divider: '#E8E2D6',
  },
  typography: {
    fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
    h5: { fontWeight: 700, letterSpacing: '-0.01em' },
    h6: { fontWeight: 600 },
    subtitle2: { fontWeight: 600 },
    button: { textTransform: 'none', fontWeight: 500 },
  },
  shape: { borderRadius: 10 },
  components: {
    MuiTextField: { defaultProps: { variant: 'outlined', size: 'small', fullWidth: true } },
    MuiSelect: { defaultProps: { size: 'small' } },
    MuiButton: { defaultProps: { disableElevation: true }, styleOverrides: { root: { borderRadius: 10 } } },
    MuiCard: { styleOverrides: { root: { border: '1px solid #E8E2D6', boxShadow: '0 1px 2px rgba(28,26,22,0.04)' } } },
    MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
    MuiChip: { styleOverrides: { root: { fontWeight: 600 } } },
    MuiTableCell: { styleOverrides: { head: { fontWeight: 600, color: '#8A7E6B', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em' } } },
  },
});

export default function MuiProvider({ children }) {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}
