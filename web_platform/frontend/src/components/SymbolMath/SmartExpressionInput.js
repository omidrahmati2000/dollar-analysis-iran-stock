import React, { useState, useRef, useEffect } from 'react';
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
    CircularProgress,
    IconButton
} from '@mui/material';
import {
    Clear,
    TrendingUp as StockIcon,
    CurrencyExchange as CurrencyIcon
} from '@mui/icons-material';
import SearchService from '../../services/api/SearchService';

const SmartExpressionInput = ({ 
    value, 
    onChange, 
    label = "فرمول",
    placeholder = "مثال: GOLD/SILVER*100 یا (USD+EUR)/2",
    error = false,
    helperText = "",
    onClear,
    ...props 
}) => {
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [suggestions, setSuggestions] = useState({ stocks: [], currencies: [] });
    const [loading, setLoading] = useState(false);
    const [suggestionsPosition, setSuggestionsPosition] = useState({ top: 0, left: 0, width: 0 });
    
    const inputRef = useRef(null);
    const suggestionsRef = useRef(null);

    // Extract the current symbol being typed
    const getCurrentSymbol = (text, cursorPosition) => {
        if (!text) return '';
        
        const beforeCursor = text.substring(0, cursorPosition || text.length);
        const operators = /[\+\-\*\/\^\(\)\s]/;
        const parts = beforeCursor.split(operators);
        const currentPart = parts[parts.length - 1].trim();
        
        return currentPart;
    };

    // Get the position to replace in the text
    const getReplacePosition = (text, cursorPosition) => {
        const beforeCursor = text.substring(0, cursorPosition || text.length);
        const operators = /[\+\-\*\/\^\(\)\s]/;
        const parts = beforeCursor.split(operators);
        const currentPart = parts[parts.length - 1];
        const startPos = beforeCursor.lastIndexOf(currentPart);
        
        return {
            start: startPos,
            end: cursorPosition || text.length,
            currentPart: currentPart.trim()
        };
    };

    const updateSuggestionsPosition = () => {
        if (inputRef.current) {
            const rect = inputRef.current.getBoundingClientRect();
            setSuggestionsPosition({
                top: rect.bottom + window.scrollY + 4,
                left: rect.left + window.scrollX,
                width: rect.width
            });
        }
    };

    const searchSymbols = async (query) => {
        if (!query || query.length < 1) {
            setSuggestions({ stocks: [], currencies: [] });
            setShowSuggestions(false);
            return;
        }

        setLoading(true);
        setShowSuggestions(true);
        updateSuggestionsPosition();

        try {
            const data = await SearchService.searchAll(query, 6);
            setSuggestions(data);
        } catch (error) {
            console.error('Search error:', error);
            setSuggestions({ stocks: [], currencies: [] });
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (e) => {
        const newValue = e.target.value;
        onChange(e);

        // Get cursor position
        const cursorPosition = e.target.selectionStart;
        const currentSymbol = getCurrentSymbol(newValue, cursorPosition);
        
        // Search for symbols if we're typing a symbol
        if (currentSymbol && currentSymbol.length >= 1) {
            searchSymbols(currentSymbol);
        } else {
            setShowSuggestions(false);
        }
    };

    const handleSuggestionClick = (item) => {
        const cursorPosition = inputRef.current?.selectionStart || value.length;
        const replacePos = getReplacePosition(value, cursorPosition);
        
        const newValue = 
            value.substring(0, replacePos.start) + 
            item.symbol + 
            value.substring(replacePos.end);
        
        const syntheticEvent = {
            target: { value: newValue }
        };
        
        onChange(syntheticEvent);
        setShowSuggestions(false);
        
        // Focus back to input and set cursor position
        setTimeout(() => {
            if (inputRef.current) {
                inputRef.current.focus();
                const newCursorPos = replacePos.start + item.symbol.length;
                inputRef.current.setSelectionRange(newCursorPos, newCursorPos);
            }
        }, 0);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
            setShowSuggestions(false);
        }
    };

    // Close suggestions when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (
                inputRef.current && 
                !inputRef.current.contains(event.target) &&
                suggestionsRef.current &&
                !suggestionsRef.current.contains(event.target)
            ) {
                setShowSuggestions(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const totalSuggestions = suggestions.stocks.length + suggestions.currencies.length;

    return (
        <Box sx={{ position: 'relative', width: '100%' }}>
            <TextField
                {...props}
                ref={inputRef}
                fullWidth
                label={label}
                placeholder={placeholder}
                value={value}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                error={error}
                helperText={helperText}
                InputProps={{
                    endAdornment: onClear && (
                        <IconButton onClick={onClear} size="small">
                            <Clear />
                        </IconButton>
                    )
                }}
            />

            {/* Suggestions Dropdown */}
            {showSuggestions && totalSuggestions > 0 && ReactDOM.createPortal(
                <Paper
                    ref={suggestionsRef}
                    sx={{
                        position: 'fixed',
                        top: suggestionsPosition.top,
                        left: suggestionsPosition.left,
                        width: suggestionsPosition.width,
                        zIndex: 10000,
                        maxHeight: 300,
                        overflow: 'auto',
                        border: '1px solid',
                        borderColor: 'divider'
                    }}
                >
                    {loading ? (
                        <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <CircularProgress size={20} sx={{ mr: 1 }} />
                            <Typography variant="body2">جستجو...</Typography>
                        </Box>
                    ) : (
                        <List dense>
                            {suggestions.stocks.length > 0 && (
                                <>
                                    <ListItem sx={{ backgroundColor: 'action.hover' }}>
                                        <Typography variant="caption" color="text.secondary">
                                            📈 سهام
                                        </Typography>
                                    </ListItem>
                                    {suggestions.stocks.map((stock, index) => (
                                        <ListItem 
                                            key={`stock-${index}`}
                                            button
                                            onClick={() => handleSuggestionClick(stock)}
                                            sx={{ 
                                                '&:hover': { backgroundColor: 'action.hover' },
                                                borderLeft: '3px solid',
                                                borderLeftColor: 'success.main'
                                            }}
                                        >
                                            <ListItemAvatar>
                                                <Avatar sx={{ width: 32, height: 32, backgroundColor: 'success.main' }}>
                                                    <StockIcon fontSize="small" />
                                                </Avatar>
                                            </ListItemAvatar>
                                            <ListItemText
                                                primary={
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                                            {stock.symbol}
                                                        </Typography>
                                                        <Typography 
                                                            variant="caption" 
                                                            sx={{ 
                                                                color: stock.price_change_percent >= 0 ? 'success.main' : 'error.main' 
                                                            }}
                                                        >
                                                            {stock.price_change_percent >= 0 ? '+' : ''}{stock.price_change_percent?.toFixed(2)}%
                                                        </Typography>
                                                    </Box>
                                                }
                                                secondary={stock.company_name}
                                            />
                                        </ListItem>
                                    ))}
                                </>
                            )}
                            
                            {suggestions.currencies.length > 0 && (
                                <>
                                    <ListItem sx={{ backgroundColor: 'action.hover' }}>
                                        <Typography variant="caption" color="text.secondary">
                                            💱 ارزها
                                        </Typography>
                                    </ListItem>
                                    {suggestions.currencies.map((currency, index) => (
                                        <ListItem 
                                            key={`currency-${index}`}
                                            button
                                            onClick={() => handleSuggestionClick(currency)}
                                            sx={{ 
                                                '&:hover': { backgroundColor: 'action.hover' },
                                                borderLeft: '3px solid',
                                                borderLeftColor: 'warning.main'
                                            }}
                                        >
                                            <ListItemAvatar>
                                                <Avatar sx={{ width: 32, height: 32, backgroundColor: 'warning.main' }}>
                                                    <CurrencyIcon fontSize="small" />
                                                </Avatar>
                                            </ListItemAvatar>
                                            <ListItemText
                                                primary={
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                                            {currency.symbol}
                                                        </Typography>
                                                        <Typography 
                                                            variant="caption" 
                                                            sx={{ 
                                                                color: currency.change_percent >= 0 ? 'success.main' : 'error.main' 
                                                            }}
                                                        >
                                                            {currency.change_percent >= 0 ? '+' : ''}{currency.change_percent?.toFixed(2)}%
                                                        </Typography>
                                                    </Box>
                                                }
                                                secondary={currency.name}
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

export default SmartExpressionInput;