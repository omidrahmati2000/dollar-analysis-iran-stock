import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { CssBaseline, Box } from '@mui/material';
import { QueryClient, QueryClientProvider } from 'react-query';

// Components
import Header from './components/Header/Header';
import Sidebar from './components/Sidebar/Sidebar';
import Dashboard from './pages/Dashboard/Dashboard';
import Charts from './pages/Charts/Charts';
import Screener from './pages/Screener/Screener';
import Portfolio from './pages/Portfolio/Portfolio';
import Watchlist from './pages/Watchlist/Watchlist';
import Settings from './pages/Settings/Settings';
import Login from './pages/Auth/Login';

// Services
import { AuthProvider, useAuth } from './services/auth';
import { WebSocketProvider } from './services/websocket';
import { ApiProvider } from './services/api';

// Styles
import './App.css';

// Create query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

// Dark theme for TradingView-like appearance
const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#2196f3',
    },
    secondary: {
      main: '#f50057',
    },
    background: {
      default: '#0D1117',
      paper: '#161B22',
    },
    text: {
      primary: '#F0F6FC',
      secondary: '#8B949E',
    },
  },
  typography: {
    fontFamily: '"Segoe UI", "Roboto", sans-serif',
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          scrollbarColor: '#6b6b6b #2b2b2b',
          '&::-webkit-scrollbar, & *::-webkit-scrollbar': {
            backgroundColor: '#2b2b2b',
            width: '8px',
          },
          '&::-webkit-scrollbar-thumb, & *::-webkit-scrollbar-thumb': {
            backgroundColor: '#6b6b6b',
            borderRadius: 8,
            minHeight: 24,
          },
        },
      },
    },
  },
});

function AppContent() {
  const { isAuthenticated } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  if (!isAuthenticated) {
    return <Login />;
  }

  return (
    <Box sx={{ display: 'flex', height: '100vh' }}>
      <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      <Box 
        component="main" 
        sx={{ 
          flexGrow: 1, 
          pt: '64px', // Account for header height
          pl: sidebarOpen ? '240px' : '0px', // Account for sidebar
          transition: 'padding-left 0.3s ease',
          overflow: 'hidden',
          height: '100vh',
        }}
      >
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/charts" element={<Charts />} />
          <Route path="/charts/:symbol" element={<Charts />} />
          <Route path="/screener" element={<Screener />} />
          <Route path="/portfolio" element={<Portfolio />} />
          <Route path="/watchlist" element={<Watchlist />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </Box>
    </Box>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ApiProvider>
          <WebSocketProvider>
            <ThemeProvider theme={darkTheme}>
              <CssBaseline />
              <Router>
                <AppContent />
              </Router>
            </ThemeProvider>
          </WebSocketProvider>
        </ApiProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;