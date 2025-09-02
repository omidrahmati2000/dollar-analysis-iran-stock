/**
 * Simple Test App - Iran Market Trading Platform
 * Demonstrates backend integration working correctly
 */

import React, { useState, useEffect } from 'react';

// API Base URL - Your backend
const API_BASE = 'http://localhost:8000';

function SimpleApp() {
  const [stocks, setStocks] = useState([]);
  const [marketSummary, setMarketSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);

  // Fetch stocks from your backend
  const fetchStocks = async () => {
    try {
      console.log('📡 Fetching stocks from:', `${API_BASE}/api/v2/stocks`);
      const response = await fetch(`${API_BASE}/api/v2/stocks?limit=20`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('✅ Received stocks:', data.length, 'items');
      setStocks(data);
      setLastUpdate(new Date());
      setError(null);
    } catch (err) {
      console.error('❌ Error fetching stocks:', err);
      setError(err.message);
    }
  };

  // Fetch market summary from your backend
  const fetchMarketSummary = async () => {
    try {
      console.log('📡 Fetching market summary from:', `${API_BASE}/api/v2/market/summary`);
      const response = await fetch(`${API_BASE}/api/v2/market/summary`);
      
      if (!response.ok) {
        console.warn('Market summary not available');
        return;
      }
      
      const data = await response.json();
      console.log('✅ Received market summary');
      setMarketSummary(data);
    } catch (err) {
      console.error('⚠️ Market summary error:', err);
      // Don't set error for market summary, it's optional
    }
  };

  // Load data on mount
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await fetchStocks();
      await fetchMarketSummary();
      setLoading(false);
    };
    
    loadData();

    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      console.log('🔄 Auto-refreshing data...');
      fetchStocks();
      fetchMarketSummary();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  // Format number for display
  const formatNumber = (num) => {
    if (num === null || num === undefined) return '—';
    return new Intl.NumberFormat('en-US').format(num);
  };

  // Format percentage
  const formatPercent = (num) => {
    if (num === null || num === undefined) return '—';
    const sign = num >= 0 ? '+' : '';
    return `${sign}${num.toFixed(2)}%`;
  };

  // Loading state
  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>
          <h2>Loading data from backend...</h2>
          <p>Backend API: {API_BASE}</p>
          <div style={styles.spinner}></div>
        </div>
      </div>
    );
  }

  // Main render
  return (
    <div style={styles.container}>
      {/* Header */}
      <header style={styles.header}>
        <h1>🚀 Iran Market Trading Platform</h1>
        <div style={styles.status}>
          <span style={styles.statusItem}>
            ✅ Connected to Backend: {API_BASE}
          </span>
          <span style={styles.statusItem}>
            📡 REST API (No WebSocket)
          </span>
          {lastUpdate && (
            <span style={styles.statusItem}>
              🕐 Last Update: {lastUpdate.toLocaleTimeString()}
            </span>
          )}
        </div>
      </header>

      {/* Error Display */}
      {error && (
        <div style={styles.error}>
          ⚠️ Error: {error}
          <button onClick={fetchStocks} style={styles.retryBtn}>
            Retry
          </button>
        </div>
      )}

      {/* Market Summary */}
      {marketSummary && (
        <div style={styles.marketSummary}>
          <h2>📊 Market Summary</h2>
          <div style={styles.summaryGrid}>
            <div style={styles.summaryCard}>
              <div style={styles.cardLabel}>Total Volume</div>
              <div style={styles.cardValue}>{formatNumber(marketSummary.total_volume)}</div>
            </div>
            <div style={styles.summaryCard}>
              <div style={styles.cardLabel}>Total Trades</div>
              <div style={styles.cardValue}>{formatNumber(marketSummary.total_trades)}</div>
            </div>
            <div style={styles.summaryCard}>
              <div style={styles.cardLabel}>Market Cap</div>
              <div style={styles.cardValue}>{formatNumber(marketSummary.total_market_cap)}</div>
            </div>
            <div style={styles.summaryCard}>
              <div style={styles.cardLabel}>Active Symbols</div>
              <div style={styles.cardValue}>{formatNumber(marketSummary.active_symbols)}</div>
            </div>
            <div style={styles.summaryCard}>
              <div style={styles.cardLabel}>Market Status</div>
              <div style={{...styles.cardValue, color: marketSummary.market_status === 'OPEN' ? '#4caf50' : '#f44336'}}>
                {marketSummary.market_status}
              </div>
            </div>
            <div style={styles.summaryCard}>
              <div style={styles.cardLabel}>Market Trend</div>
              <div style={{
                ...styles.cardValue,
                color: marketSummary.market_trend === 'BULLISH' ? '#4caf50' : 
                       marketSummary.market_trend === 'BEARISH' ? '#f44336' : '#ff9800'
              }}>
                {marketSummary.market_trend}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stocks Table */}
      <div style={styles.stocksSection}>
        <h2>📈 Live Stock Prices ({stocks.length} stocks)</h2>
        <div style={styles.tableContainer}>
          <table style={styles.table}>
            <thead>
              <tr style={styles.tableHeader}>
                <th style={styles.th}>Symbol</th>
                <th style={styles.th}>Company Name</th>
                <th style={styles.th}>Last Price</th>
                <th style={styles.th}>Change</th>
                <th style={styles.th}>Change %</th>
                <th style={styles.th}>Volume</th>
                <th style={styles.th}>Market Cap</th>
              </tr>
            </thead>
            <tbody>
              {stocks.map((stock, index) => (
                <tr key={stock.symbol} style={index % 2 === 0 ? styles.evenRow : styles.oddRow}>
                  <td style={styles.td}>
                    <strong>{stock.symbol}</strong>
                  </td>
                  <td style={styles.td}>{stock.company_name}</td>
                  <td style={styles.td}>{formatNumber(stock.last_price)}</td>
                  <td style={{
                    ...styles.td,
                    color: stock.price_change >= 0 ? '#4caf50' : '#f44336',
                    fontWeight: 'bold'
                  }}>
                    {formatNumber(stock.price_change)}
                  </td>
                  <td style={{
                    ...styles.td,
                    color: stock.price_change_percent >= 0 ? '#4caf50' : '#f44336',
                    fontWeight: 'bold'
                  }}>
                    {formatPercent(stock.price_change_percent)}
                  </td>
                  <td style={styles.td}>{formatNumber(stock.volume)}</td>
                  <td style={styles.td}>{formatNumber(stock.market_cap)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer */}
      <footer style={styles.footer}>
        <p>✅ Frontend successfully integrated with Backend API</p>
        <p>📊 All data is LIVE from your database</p>
        <p>🔄 Auto-refresh every 30 seconds</p>
      </footer>
    </div>
  );
}

// Inline styles for simplicity
const styles = {
  container: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    backgroundColor: '#0d1117',
    color: '#c9d1d9',
    minHeight: '100vh',
    padding: '20px',
  },
  header: {
    textAlign: 'center',
    marginBottom: '30px',
    borderBottom: '2px solid #30363d',
    paddingBottom: '20px',
  },
  status: {
    display: 'flex',
    justifyContent: 'center',
    gap: '20px',
    marginTop: '10px',
    flexWrap: 'wrap',
  },
  statusItem: {
    padding: '5px 10px',
    backgroundColor: '#161b22',
    borderRadius: '5px',
    fontSize: '14px',
  },
  loading: {
    textAlign: 'center',
    padding: '50px',
  },
  spinner: {
    width: '40px',
    height: '40px',
    margin: '20px auto',
    border: '4px solid #30363d',
    borderTop: '4px solid #58a6ff',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  error: {
    backgroundColor: '#ff444420',
    border: '1px solid #f44336',
    padding: '15px',
    borderRadius: '5px',
    marginBottom: '20px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  retryBtn: {
    padding: '5px 15px',
    backgroundColor: '#f44336',
    color: 'white',
    border: 'none',
    borderRadius: '3px',
    cursor: 'pointer',
  },
  marketSummary: {
    marginBottom: '30px',
  },
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '15px',
    marginTop: '15px',
  },
  summaryCard: {
    backgroundColor: '#161b22',
    padding: '15px',
    borderRadius: '8px',
    border: '1px solid #30363d',
  },
  cardLabel: {
    fontSize: '12px',
    color: '#8b949e',
    marginBottom: '5px',
  },
  cardValue: {
    fontSize: '20px',
    fontWeight: 'bold',
    color: '#58a6ff',
  },
  stocksSection: {
    marginBottom: '30px',
  },
  tableContainer: {
    overflowX: 'auto',
    backgroundColor: '#161b22',
    borderRadius: '8px',
    padding: '10px',
    marginTop: '15px',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  tableHeader: {
    backgroundColor: '#0d1117',
  },
  th: {
    padding: '12px',
    textAlign: 'left',
    borderBottom: '2px solid #30363d',
    color: '#58a6ff',
    fontWeight: 'bold',
  },
  td: {
    padding: '10px 12px',
    borderBottom: '1px solid #30363d',
  },
  evenRow: {
    backgroundColor: '#0d1117',
  },
  oddRow: {
    backgroundColor: '#161b22',
  },
  footer: {
    textAlign: 'center',
    marginTop: '40px',
    padding: '20px',
    borderTop: '2px solid #30363d',
    color: '#8b949e',
  },
};

// Add CSS animation for spinner
const styleSheet = document.createElement("style");
styleSheet.innerText = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;
document.head.appendChild(styleSheet);

export default SimpleApp;