import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  TextField,
  Paper,
  List,
  ListItem,
  Typography,
  Chip,
  InputAdornment,
  IconButton,
  Avatar,
  CircularProgress
} from '@mui/material';
import {
  Search as SearchIcon,
  Clear as ClearIcon,
  TrendingUp as StockIcon,
  CurrencyExchange as CurrencyIcon,
  KeyboardArrowDown as ArrowDownIcon
} from '@mui/icons-material';

const AdvancedSymbolSearch = ({ 
  onSelect, 
  placeholder = "جستجوی سهام و ارز...",
  selectedSymbol = null,
  sx = {}
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState({ stocks: [], currencies: [] });
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [allSymbols, setAllSymbols] = useState({ stocks: [], currencies: [] });
  const searchRef = useRef(null);
  const resultsRef = useRef(null);

  // Load popular symbols on mount instead of all symbols
  useEffect(() => {
    loadPopularSymbols();
  }, []);

  // Handle click outside to close results
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

  const loadPopularSymbols = async () => {
    try {
      setLoading(true);
      
      const [stocksResponse, currenciesResponse] = await Promise.all([
        fetch('http://localhost:8000/api/v2/stocks?limit=20'), // Load top 20 popular stocks
        fetch('http://localhost:8000/api/v2/currencies?limit=15') // Load top 15 currencies/gold/coins
      ]);

      const stocks = await stocksResponse.json();
      const currencies = await currenciesResponse.json();

      setAllSymbols({ stocks, currencies });
    } catch (error) {
      console.error('Error loading popular symbols:', error);
    } finally {
      setLoading(false);
    }
  };

  // Search using backend APIs
  const searchSymbols = async (searchQuery) => {
    if (!searchQuery.trim()) {
      setResults({ stocks: [], currencies: [] });
      return;
    }

    try {
      setLoading(true);
      
      const [stocksResponse, currenciesResponse] = await Promise.all([
        fetch(`http://localhost:8000/api/v2/stocks/search?q=${encodeURIComponent(searchQuery)}&limit=10`),
        fetch(`http://localhost:8000/api/v2/currencies/search?q=${encodeURIComponent(searchQuery)}&limit=5`)
      ]);

      const rawStocks = await stocksResponse.json();
      const rawCurrencies = await currenciesResponse.json();

      // Map search API response to expected component format
      const mappedStocks = Array.isArray(rawStocks) ? rawStocks.map(stock => ({
        symbol: stock.symbol,
        company_name: stock.company_name,
        last_price: stock.last_price || 0,
        price_change: stock.price_change || 0,
        price_change_percent: stock.price_change_percent || 0,
        volume: stock.volume || 0
      })) : [];

      const mappedCurrencies = Array.isArray(rawCurrencies) ? rawCurrencies.map(currency => ({
        currency_code: currency.currency_code,
        currency_name: currency.currency_name,
        current_price: currency.price_irr || 0,
        price_change: currency.change_24h || 0,
        price_change_percent: currency.change_percent_24h || 0,
        volume_24h: currency.volume_24h || 0
      })) : [];

      setResults({ 
        stocks: mappedStocks, 
        currencies: mappedCurrencies 
      });
    } catch (error) {
      console.error('Error searching symbols:', error);
      setResults({ stocks: [], currencies: [] });
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (searchQuery) => {
    // Use backend search instead of client-side filtering
    searchSymbols(searchQuery);
  };

  const handleInputChange = (e) => {
    const value = e.target.value;
    setQuery(value);
    handleSearch(value);
    setShowResults(true);
  };

  const handleSelect = (item, type) => {
    const symbol = type === 'stock' ? item.symbol : item.currency_code;
    setQuery(symbol);
    setShowResults(false);
    
    if (onSelect) {
      onSelect(item, type);
    }
  };

  const handleFocus = () => {
    if (query) {
      handleSearch(query);
    } else {
      // Show popular symbols when focused - with safety check
      const popularStocks = Array.isArray(allSymbols.stocks) ? allSymbols.stocks.slice(0, 8) : [];
      const popularCurrencies = Array.isArray(allSymbols.currencies) ? allSymbols.currencies.slice(0, 12) : [];
      
      setResults({
        stocks: popularStocks,
        currencies: popularCurrencies
      });
    }
    setShowResults(true);
  };

  const clearSearch = () => {
    setQuery('');
    setResults({ stocks: [], currencies: [] });
    setShowResults(false);
  };

  const getChangeColor = (change) => {
    if (change > 0) return '#4caf50';
    if (change < 0) return '#f44336';
    return '#757575';
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-US').format(price);
  };

  const formatPercent = (percent) => {
    if (!percent) return '';
    return `${percent > 0 ? '+' : ''}${percent.toFixed(2)}%`;
  };

  return (
    <Box sx={{ position: 'relative', ...sx }}>
      <TextField
        ref={searchRef}
        fullWidth
        value={query}
        onChange={handleInputChange}
        onFocus={handleFocus}
        placeholder={placeholder}
        size="small"
        variant="outlined"
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon sx={{ color: 'text.secondary' }} />
            </InputAdornment>
          ),
          endAdornment: (
            <InputAdornment position="end">
              {loading && <CircularProgress size={16} />}
              {query && (
                <IconButton onClick={clearSearch} size="small">
                  <ClearIcon />
                </IconButton>
              )}
              <ArrowDownIcon sx={{ color: 'text.secondary', ml: 0.5 }} />
            </InputAdornment>
          ),
          sx: {
            backgroundColor: 'background.paper',
            '& .MuiOutlinedInput-notchedOutline': {
              borderColor: 'divider',
            },
            '&:hover .MuiOutlinedInput-notchedOutline': {
              borderColor: 'primary.main',
            },
          }
        }}
        sx={{
          '& .MuiInputBase-input': {
            textAlign: 'right',
            direction: 'rtl',
            fontFamily: 'IRANSans, sans-serif'
          }
        }}
      />

      {showResults && (
        <Paper
          ref={resultsRef}
          elevation={8}
          sx={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            zIndex: 9999,
            mt: 0.5,
            maxHeight: 400,
            overflow: 'auto',
            bgcolor: 'background.paper',
            border: 1,
            borderColor: 'divider'
          }}
        >
          <List sx={{ p: 0 }}>
            {/* Stocks Section */}
            {results.stocks.length > 0 && (
              <>
                <ListItem
                  sx={{
                    py: 1,
                    px: 2,
                    bgcolor: 'action.hover',
                    borderBottom: 1,
                    borderColor: 'divider'
                  }}
                >
                  <StockIcon sx={{ mr: 1, color: 'primary.main' }} />
                  <Typography 
                    variant="subtitle2" 
                    fontWeight="bold"
                    sx={{ fontFamily: 'IRANSans, sans-serif' }}
                  >
                    سهام
                  </Typography>
                </ListItem>
                {results.stocks.map((stock) => (
                  <ListItem
                    key={stock.symbol}
                    onClick={() => handleSelect(stock, 'stock')}
                    sx={{
                      py: 1.5,
                      px: 2,
                      cursor: 'pointer',
                      borderBottom: 1,
                      borderColor: 'divider',
                      '&:hover': {
                        bgcolor: 'action.hover'
                      },
                      '&:last-child': {
                        borderBottom: 0
                      }
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                      <Avatar
                        sx={{
                          width: 32,
                          height: 32,
                          bgcolor: 'primary.main',
                          fontSize: '0.75rem',
                          ml: 1.5
                        }}
                      >
                        {stock.symbol.charAt(0)}
                      </Avatar>
                      
                      <Box sx={{ flex: 1, mx: 2 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography variant="body2" fontWeight="bold">
                            {stock.symbol}
                          </Typography>
                          <Typography
                            variant="h6"
                            fontWeight="bold"
                            sx={{ color: getChangeColor(stock.price_change) }}
                          >
                            {formatPrice(stock.last_price)}
                          </Typography>
                        </Box>
                        
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 0.5 }}>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ 
                              maxWidth: 200,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              fontFamily: 'IRANSans, sans-serif'
                            }}
                          >
                            {stock.company_name}
                          </Typography>
                          
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography
                              variant="caption"
                              sx={{ color: getChangeColor(stock.price_change) }}
                            >
                              {formatPercent(stock.price_change_percent)}
                            </Typography>
                            <Chip
                              label="سهام"
                              size="small"
                              sx={{
                                height: 16,
                                fontSize: '0.6rem',
                                bgcolor: 'primary.main',
                                color: 'primary.contrastText',
                                fontFamily: 'IRANSans, sans-serif'
                              }}
                            />
                          </Box>
                        </Box>
                      </Box>
                    </Box>
                  </ListItem>
                ))}
              </>
            )}

            {/* Currencies Section */}
            {results.currencies.length > 0 && (
              <>
                <ListItem
                  sx={{
                    py: 1,
                    px: 2,
                    bgcolor: 'action.hover',
                    borderBottom: 1,
                    borderColor: 'divider'
                  }}
                >
                  <CurrencyIcon sx={{ mr: 1, color: 'warning.main' }} />
                  <Typography 
                    variant="subtitle2" 
                    fontWeight="bold"
                    sx={{ fontFamily: 'IRANSans, sans-serif' }}
                  >
                    ارز
                  </Typography>
                </ListItem>
                {results.currencies.map((currency) => (
                  <ListItem
                    key={currency.currency_code}
                    onClick={() => handleSelect(currency, 'currency')}
                    sx={{
                      py: 1.5,
                      px: 2,
                      cursor: 'pointer',
                      borderBottom: 1,
                      borderColor: 'divider',
                      '&:hover': {
                        bgcolor: 'action.hover'
                      },
                      '&:last-child': {
                        borderBottom: 0
                      }
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                      <Avatar
                        sx={{
                          width: 32,
                          height: 32,
                          bgcolor: 'warning.main',
                          fontSize: '0.75rem',
                          ml: 1.5
                        }}
                      >
                        {currency.currency_code.charAt(0)}
                      </Avatar>
                      
                      <Box sx={{ flex: 1, mx: 2 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography variant="body2" fontWeight="bold">
                            {currency.currency_code}
                          </Typography>
                          <Typography
                            variant="h6"
                            fontWeight="bold"
                            sx={{ color: getChangeColor(currency.price_change) }}
                          >
                            {formatPrice(currency.current_price)}
                          </Typography>
                        </Box>
                        
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 0.5 }}>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ 
                              maxWidth: 200,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              fontFamily: 'IRANSans, sans-serif'
                            }}
                          >
                            {currency.currency_name}
                          </Typography>
                          
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography
                              variant="caption"
                              sx={{ color: getChangeColor(currency.price_change) }}
                            >
                              {formatPercent(currency.price_change_percent)}
                            </Typography>
                            <Chip
                              label="ارز"
                              size="small"
                              sx={{
                                height: 16,
                                fontSize: '0.6rem',
                                bgcolor: 'warning.main',
                                color: 'warning.contrastText',
                                fontFamily: 'IRANSans, sans-serif'
                              }}
                            />
                          </Box>
                        </Box>
                      </Box>
                    </Box>
                  </ListItem>
                ))}
              </>
            )}

            {/* No Results */}
            {query && results.stocks.length === 0 && results.currencies.length === 0 && !loading && (
              <ListItem sx={{ py: 2, justifyContent: 'center' }}>
                <Typography 
                  variant="body2" 
                  color="text.secondary"
                  sx={{ fontFamily: 'IRANSans, sans-serif' }}
                >
                  نتیجه‌ای یافت نشد
                </Typography>
              </ListItem>
            )}
          </List>
        </Paper>
      )}
    </Box>
  );
};

export default AdvancedSymbolSearch;