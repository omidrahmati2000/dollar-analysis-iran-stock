import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import {
  Box,
  TextField,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Typography,
  Chip,
  InputAdornment,
  IconButton,
  Divider,
  CircularProgress
} from '@mui/material';
import {
  Search as SearchIcon,
  Clear as ClearIcon,
  TrendingUp as StockIcon,
  CurrencyExchange as CurrencyIcon
} from '@mui/icons-material';
import SearchService from '../../services/api/SearchService';

const GlobalSearch = ({ onSelect, placeholder = "جستجوی سهام و ارز...", expressionMode = false }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState({ stocks: [], currencies: [] });
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [resultsPosition, setResultsPosition] = useState({ top: 0, left: 0, width: 0 });
  const searchRef = useRef(null);
  const resultsRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        searchRef.current && 
        !searchRef.current.contains(event.target) &&
        resultsRef.current &&
        !resultsRef.current.contains(event.target)
      ) {
        setShowResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const searchData = async () => {
      let searchQuery = query;
      
      // In expression mode, extract the last symbol being typed
      if (expressionMode && query) {
        // Split by mathematical operators and get the last part
        const operators = /[\+\-\*\/\^\(\)\s]/;
        const parts = query.split(operators);
        const lastPart = parts[parts.length - 1].trim();
        searchQuery = lastPart;
      }
      
      if (!searchQuery || searchQuery.length < 1) {
        setResults({ stocks: [], currencies: [] });
        setShowResults(false);
        return;
      }

      setLoading(true);
      updateResultsPosition();
      setShowResults(true);
      
      try {
        const data = await SearchService.searchAll(searchQuery, 10);
        setResults(data);
      } catch (error) {
        console.error('Search error:', error);
        setResults({ stocks: [], currencies: [] });
      } finally {
        setLoading(false);
      }
    };

    const timeoutId = setTimeout(searchData, 300); // Debounce
    return () => clearTimeout(timeoutId);
  }, [query, expressionMode]);

  const updateResultsPosition = () => {
    if (searchRef.current) {
      const rect = searchRef.current.getBoundingClientRect();
      setResultsPosition({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX,
        width: rect.width
      });
    }
  };

  const handleSelect = (item, type) => {
    if (onSelect) {
      if (expressionMode) {
        // In expression mode, replace only the last symbol being typed
        const operators = /[\+\-\*\/\^\(\)\s]/;
        const parts = query.split(operators);
        const lastPartIndex = query.lastIndexOf(parts[parts.length - 1]);
        const beforeLastPart = query.substring(0, lastPartIndex);
        const newQuery = beforeLastPart + item.symbol;
        onSelect(newQuery, type);
      } else {
        onSelect(item, type);
      }
    }
    setShowResults(false);
  };

  const clearSearch = () => {
    setQuery('');
    setResults({ stocks: [], currencies: [] });
    setShowResults(false);
  };

  const formatPrice = (price) => {
    if (!price && price !== 0) return '—';
    return new Intl.NumberFormat('en-US').format(Math.round(price));
  };

  const formatPercent = (percent) => {
    if (!percent && percent !== 0) return '—';
    const sign = percent >= 0 ? '+' : '';
    return `${sign}${percent.toFixed(2)}%`;
  };

  const getChangeColor = (change) => {
    if (change > 0) return 'success';
    if (change < 0) return 'error';
    return 'default';
  };

  const totalResults = results.stocks.length + results.currencies.length;

  return (
    <Box sx={{ 
      position: 'relative', 
      width: '100%', 
      maxWidth: 400
    }}>
      <TextField
        ref={searchRef}
        fullWidth
        variant="outlined"
        size="small"
        placeholder={placeholder}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => {
          if (query.length >= 2) {
            updateResultsPosition();
            setShowResults(true);
          }
        }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
            </InputAdornment>
          ),
          endAdornment: (
            <InputAdornment position="end">
              {loading ? (
                <CircularProgress size={16} />
              ) : query ? (
                <IconButton size="small" onClick={clearSearch}>
                  <ClearIcon sx={{ fontSize: 16 }} />
                </IconButton>
              ) : null}
            </InputAdornment>
          ),
          sx: {
            backgroundColor: 'background.paper',
            '& .MuiOutlinedInput-notchedOutline': {
              borderColor: 'divider'
            },
            '&:hover .MuiOutlinedInput-notchedOutline': {
              borderColor: 'primary.main'
            },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderColor: 'primary.main'
            }
          }
        }}
      />

      {showResults && query.length >= 2 && ReactDOM.createPortal(
        <Paper
          ref={resultsRef}
          sx={{
            position: 'fixed',
            top: resultsPosition.top,
            left: resultsPosition.left,
            width: resultsPosition.width,
            maxHeight: 400,
            overflow: 'auto',
            zIndex: 10000,
            border: '1px solid',
            borderColor: 'divider',
            boxShadow: '0 12px 48px rgba(0,0,0,0.2)',
            backgroundColor: 'background.paper'
          }}
        >
          {loading ? (
            <Box sx={{ p: 2, textAlign: 'center' }}>
              <CircularProgress size={24} />
              <Typography variant="body2" sx={{ mt: 1 }}>
                جستجو...
              </Typography>
            </Box>
          ) : totalResults === 0 ? (
            <Box sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                نتیجه‌ای یافت نشد
              </Typography>
              <Typography variant="caption" color="text.secondary">
                حداقل 2 کاراکتر وارد کنید
              </Typography>
            </Box>
          ) : (
            <List sx={{ p: 0 }}>
              {/* Stocks Results */}
              {results.stocks.length > 0 && (
                <>
                  <ListItem sx={{ py: 0.5, backgroundColor: 'action.hover' }}>
                    <ListItemAvatar>
                      <StockIcon sx={{ fontSize: 20, color: 'primary.main' }} />
                    </ListItemAvatar>
                    <ListItemText
                      primary={
                        <Typography variant="caption" fontWeight="bold" color="primary">
                          سهام ({results.stocks.length})
                        </Typography>
                      }
                    />
                  </ListItem>
                  
                  {results.stocks.map((stock, index) => (
                    <ListItem
                      key={`stock-${stock.symbol}-${index}`}
                      button
                      onClick={() => handleSelect(stock, 'stock')}
                      sx={{
                        py: 1,
                        '&:hover': { backgroundColor: 'action.hover' }
                      }}
                    >
                      <ListItemAvatar>
                        <Avatar sx={{ width: 32, height: 32, fontSize: 12, bgcolor: 'primary.main' }}>
                          {stock.symbol?.substring(0, 2) || 'ST'}
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography variant="body2" fontWeight="bold">
                              {stock.symbol}
                            </Typography>
                            <Typography variant="body2">
                              {formatPrice(stock.last_price)}
                            </Typography>
                          </Box>
                        }
                        secondary={
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography variant="caption" color="text.secondary">
                              {stock.company_name}
                            </Typography>
                            <Chip
                              label={formatPercent(stock.change)}
                              size="small"
                              color={getChangeColor(stock.change)}
                              sx={{ height: 16, fontSize: '0.6rem' }}
                            />
                          </Box>
                        }
                      />
                    </ListItem>
                  ))}
                </>
              )}

              {/* Divider between sections */}
              {results.stocks.length > 0 && results.currencies.length > 0 && (
                <Divider />
              )}

              {/* Currencies Results */}
              {results.currencies.length > 0 && (
                <>
                  <ListItem sx={{ py: 0.5, backgroundColor: 'action.hover' }}>
                    <ListItemAvatar>
                      <CurrencyIcon sx={{ fontSize: 20, color: 'warning.main' }} />
                    </ListItemAvatar>
                    <ListItemText
                      primary={
                        <Typography variant="caption" fontWeight="bold" color="warning.main">
                          ارزها ({results.currencies.length})
                        </Typography>
                      }
                    />
                  </ListItem>
                  
                  {results.currencies.map((currency, index) => (
                    <ListItem
                      key={`currency-${currency.currency_code}-${index}`}
                      button
                      onClick={() => handleSelect(currency, 'currency')}
                      sx={{
                        py: 1,
                        '&:hover': { backgroundColor: 'action.hover' }
                      }}
                    >
                      <ListItemAvatar>
                        <Avatar sx={{ width: 32, height: 32, fontSize: 12, bgcolor: 'warning.main' }}>
                          {currency.currency_code?.substring(0, 2) || 'CR'}
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography variant="body2" fontWeight="bold">
                              {currency.currency_code}
                            </Typography>
                            <Typography variant="body2">
                              {formatPrice(currency.price_irr)}
                            </Typography>
                          </Box>
                        }
                        secondary={
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography variant="caption" color="text.secondary">
                              {currency.currency_name}
                            </Typography>
                            <Chip
                              label={formatPercent(currency.change_percent_24h)}
                              size="small"
                              color={getChangeColor(currency.change_percent_24h)}
                              sx={{ height: 16, fontSize: '0.6rem' }}
                            />
                          </Box>
                        }
                      />
                    </ListItem>
                  ))}
                </>
              )}
            </List>
          )}
        </Paper>,
        document.body
      )}
    </Box>
  );
};

export default GlobalSearch;