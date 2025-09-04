import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { CssBaseline, Box } from '@mui/material';
import { QueryClient, QueryClientProvider } from 'react-query';

// Components
import Header from './components/Header/Header';
import Sidebar from './components/Sidebar/Sidebar';
import Dashboard from './pages/Dashboard/Dashboard';
import Charts from './pages/Charts/ChartsNew';
import Screener from './pages/Screener/Screener';
import Portfolio from './pages/Portfolio/Portfolio';
import Watchlist from './pages/Watchlist/Watchlist';
import Settings from './pages/Settings/Settings';
import Login from './pages/Auth/Login';
import ChartDemo from './components/Charts/ChartDemo';
import IndustryAnalysis from './pages/IndustryAnalysis/IndustryAnalysis';
import Currencies from './pages/Currencies/Currencies';
import SymbolMathPage from './pages/SymbolMath/SymbolMath';
import AdvancedChartsPage from './pages/AdvancedCharts/AdvancedCharts';

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
    fontFamily: '"IRANSans", "Segoe UI", "Roboto", sans-serif',
    fontFamilyFallback: [
      'IRANSans',
      'Segoe UI',
      'Roboto',
      'Arial',
      'sans-serif'
    ],
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
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const location = useLocation();
  const isAdvancedCharts = location.pathname === '/advanced-charts';

  // Free platform - no authentication required

  return (
    <Box sx={{ display: 'flex', height: '100vh' }}>
      <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      <Box 
        component="main" 
        sx={{ 
          flexGrow: 1, 
          pt: '64px', // Account for header height
          pl: isAdvancedCharts ? '0px' : (sidebarOpen ? '240px' : '0px'), // No left padding for advanced charts
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
          <Route path="/demo" element={<ChartDemo />} />
          <Route path="/screener" element={<Screener />} />
          <Route path="/portfolio" element={<Portfolio />} />
          <Route path="/watchlist" element={<Watchlist />} />
          <Route path="/industry-analysis" element={<IndustryAnalysis />} />
          <Route path="/currencies" element={<Currencies />} />
          <Route path="/symbol-math" element={<SymbolMathPage />} />
          <Route path="/advanced-charts" element={<AdvancedChartsPage />} />
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
          {/* <WebSocketProvider> */}
            <ThemeProvider theme={darkTheme}>
              <CssBaseline />
              <Router>
                <AppContent />
              </Router>
            </ThemeProvider>
          {/* </WebSocketProvider> */}
        </ApiProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;