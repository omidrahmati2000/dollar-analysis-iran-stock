import React, { useState, useEffect, useCallback } from 'react';
import {
    Box,
    Card,
    CardContent,
    TextField,
    Button,
    Typography,
    Chip,
    Alert,
    IconButton,
    Divider,
    Grid,
    Paper,
    CircularProgress,
    useTheme
} from '@mui/material';
import {
    Calculate,
    Clear,
    Add,
    Remove,
    Close,
    TrendingUp,
    TrendingDown,
    TrendingFlat
} from '@mui/icons-material';
import ExpressionParser from '../../utils/ExpressionParser';
import SmartExpressionInput from './SmartExpressionInput';

const SymbolMath = ({ onExpressionChange, initialExpression = '' }) => {
    const theme = useTheme();
    const [expression, setExpression] = useState(initialExpression);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);
    const [symbols, setSymbols] = useState([]);
    const [symbolData, setSymbolData] = useState({});
    const [loading, setLoading] = useState(false);
    const [validation, setValidation] = useState({ valid: true, message: '' });
    const [expressionHistory, setExpressionHistory] = useState([]);
    
    const parser = new ExpressionParser();

    // Sample expressions for quick access
    const sampleExpressions = [
        { label: 'طلا به نقره', expression: 'GOLD/SILVER' },
        { label: 'نفت در 100', expression: 'OIL*100' },
        { label: 'دلار + یورو', expression: 'USD+EUR' },
        { label: 'بیت کوین به طلا', expression: 'BTC/GOLD*1000' },
        { label: 'شاخص تلفیقی', expression: '(GOLD+SILVER)/2*USD' }
    ];

    // Fetch symbol data from API
    const fetchSymbolData = useCallback(async (symbolsList) => {
        if (symbolsList.length === 0) return;
        
        setLoading(true);
        try {
            const newSymbolData = {};
            
            // Fetch data for each symbol
            for (const symbol of symbolsList) {
                try {
                    // First try stocks API
                    const stockResponse = await fetch(`http://localhost:8000/api/v2/stocks/search?query=${symbol}&limit=1`);
                    const stockData = await stockResponse.json();
                    
                    if (stockData.stocks && stockData.stocks.length > 0) {
                        newSymbolData[symbol] = {
                            value: stockData.stocks[0].last_price || 0,
                            name: stockData.stocks[0].company_name || symbol,
                            type: 'stock',
                            change: stockData.stocks[0].price_change || 0,
                            changePercent: stockData.stocks[0].price_change_percent || 0
                        };
                        continue;
                    }
                    
                    // Then try currencies API
                    const currencyResponse = await fetch(`http://localhost:8000/api/v2/currencies/search?query=${symbol}&limit=1`);
                    const currencyData = await currencyResponse.json();
                    
                    if (currencyData.currencies && currencyData.currencies.length > 0) {
                        newSymbolData[symbol] = {
                            value: currencyData.currencies[0].price || 0,
                            name: currencyData.currencies[0].name || symbol,
                            type: 'currency',
                            change: currencyData.currencies[0].change || 0,
                            changePercent: currencyData.currencies[0].change_percent || 0
                        };
                        continue;
                    }
                    
                    // If not found, use mock data or zero
                    newSymbolData[symbol] = {
                        value: 0,
                        name: symbol,
                        type: 'unknown',
                        change: 0,
                        changePercent: 0
                    };
                    
                } catch (error) {
                    console.error(`Error fetching data for ${symbol}:`, error);
                    newSymbolData[symbol] = {
                        value: 0,
                        name: symbol,
                        type: 'error',
                        change: 0,
                        changePercent: 0
                    };
                }
            }
            
            setSymbolData(newSymbolData);
        } catch (error) {
            console.error('Error fetching symbol data:', error);
            setError('خطا در دریافت اطلاعات نمادها');
        } finally {
            setLoading(false);
        }
    }, []);

    // Update symbols and validation when expression changes
    useEffect(() => {
        const newSymbols = parser.getSymbols(expression);
        setSymbols(newSymbols);
        
        const validationResult = parser.validate(expression);
        setValidation(validationResult);
        
        if (validationResult.valid && expression.trim()) {
            fetchSymbolData(newSymbols);
        } else {
            setSymbolData({});
            setResult(null);
        }
        
        setError(null);
    }, [expression, fetchSymbolData, parser]);

    // Calculate result when symbol data changes
    useEffect(() => {
        if (validation.valid && expression.trim() && Object.keys(symbolData).length > 0) {
            try {
                const symbolValues = {};
                for (const [symbol, data] of Object.entries(symbolData)) {
                    symbolValues[symbol] = data.value;
                }
                
                const calculatedResult = parser.evaluate(expression, symbolValues);
                setResult(calculatedResult);
                setError(null);
                
                // Call parent callback if provided
                if (onExpressionChange) {
                    onExpressionChange({
                        expression,
                        result: calculatedResult,
                        symbols: symbols,
                        symbolData: symbolData
                    });
                }
            } catch (error) {
                setError(error.message);
                setResult(null);
            }
        }
    }, [expression, symbolData, validation.valid, symbols, parser, onExpressionChange]);

    const handleExpressionChange = (e) => {
        setExpression(e.target.value);
    };

    const clearExpression = () => {
        setExpression('');
        setResult(null);
        setError(null);
        setSymbols([]);
        setSymbolData({});
    };

    const insertSampleExpression = (sampleExpression) => {
        setExpression(sampleExpression);
        // Add to history
        if (!expressionHistory.includes(sampleExpression)) {
            setExpressionHistory(prev => [sampleExpression, ...prev.slice(0, 4)]);
        }
    };

    const insertOperator = (operator) => {
        setExpression(prev => prev + operator);
    };

    const getTrendIcon = (changePercent) => {
        if (changePercent > 0) return <TrendingUp sx={{ color: theme.palette.success.main }} />;
        if (changePercent < 0) return <TrendingDown sx={{ color: theme.palette.error.main }} />;
        return <TrendingFlat sx={{ color: theme.palette.text.secondary }} />;
    };

    const formatNumber = (num) => {
        if (num === null || num === undefined) return '0';
        return new Intl.NumberFormat('en-US', { 
            minimumFractionDigits: 2, 
            maximumFractionDigits: 6 
        }).format(num);
    };

    return (
        <Card sx={{ maxWidth: 800, mx: 'auto', mt: 3 }}>
            <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                    <Calculate sx={{ mr: 1, color: theme.palette.primary.main }} />
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                        ماشین حساب نمادها
                    </Typography>
                </Box>

                {/* Smart Expression Input */}
                <SmartExpressionInput
                    value={expression}
                    onChange={handleExpressionChange}
                    label="🧮 فرمول ریاضی"
                    placeholder="مثال: GOLD/SILVER*100 یا (USD+EUR)/2"
                    error={!validation.valid}
                    helperText={!validation.valid ? validation.message : 'فرمول ریاضی با نمادهای سهام و ارز - شروع به تایپ کنید تا پیشنهادات ظاهر شوند'}
                    onClear={clearExpression}
                    sx={{ mb: 2 }}
                />

                {/* Operator Buttons */}
                <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                    {['+', '-', '*', '/', '(', ')'].map((op) => (
                        <Button
                            key={op}
                            variant="outlined"
                            size="small"
                            onClick={() => insertOperator(op)}
                            sx={{ minWidth: 40 }}
                        >
                            {op}
                        </Button>
                    ))}
                </Box>

                {/* Sample Expressions */}
                <Box sx={{ mb: 3 }}>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        فرمول‌های آماده:
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        {sampleExpressions.map((sample, index) => (
                            <Chip
                                key={index}
                                label={sample.label}
                                onClick={() => insertSampleExpression(sample.expression)}
                                size="small"
                                variant="outlined"
                                sx={{ cursor: 'pointer' }}
                            />
                        ))}
                    </Box>
                </Box>

                <Divider sx={{ my: 2 }} />

                {/* Loading */}
                {loading && (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                        <CircularProgress size={24} />
                        <Typography variant="body2" sx={{ ml: 1 }}>
                            در حال دریافت اطلاعات نمادها...
                        </Typography>
                    </Box>
                )}

                {/* Error Display */}
                {error && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                        {error}
                    </Alert>
                )}

                {/* Symbol Data */}
                {symbols.length > 0 && (
                    <Box sx={{ mb: 3 }}>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                            نمادهای استفاده شده:
                        </Typography>
                        <Grid container spacing={1}>
                            {symbols.map((symbol) => {
                                const data = symbolData[symbol];
                                return (
                                    <Grid item xs={12} sm={6} md={4} key={symbol}>
                                        <Paper sx={{ p: 2, textAlign: 'center' }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                                                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                                                    {symbol}
                                                </Typography>
                                                {data && getTrendIcon(data.changePercent)}
                                            </Box>
                                            {data ? (
                                                <>
                                                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                                        {data.name}
                                                    </Typography>
                                                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                                                        {formatNumber(data.value)}
                                                    </Typography>
                                                    <Typography 
                                                        variant="body2" 
                                                        sx={{ 
                                                            color: data.changePercent >= 0 ? 
                                                                theme.palette.success.main : 
                                                                theme.palette.error.main 
                                                        }}
                                                    >
                                                        {data.changePercent >= 0 ? '+' : ''}{data.changePercent.toFixed(2)}%
                                                    </Typography>
                                                </>
                                            ) : (
                                                <Typography variant="body2" color="text.secondary">
                                                    در حال بارگذاری...
                                                </Typography>
                                            )}
                                        </Paper>
                                    </Grid>
                                );
                            })}
                        </Grid>
                    </Box>
                )}

                {/* Result */}
                {result !== null && (
                    <Paper sx={{ 
                        p: 3, 
                        textAlign: 'center', 
                        background: `linear-gradient(135deg, ${theme.palette.primary.main}20, ${theme.palette.secondary.main}20)`,
                        border: `2px solid ${theme.palette.primary.main}`
                    }}>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                            نتیجه محاسبه:
                        </Typography>
                        <Typography variant="h4" sx={{ 
                            fontWeight: 700,
                            color: theme.palette.primary.main,
                            mb: 1
                        }}>
                            {formatNumber(result)}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            {parser.formatExpression(expression, symbolData.reduce((acc, symbol, data) => {
                                acc[symbol] = data?.value || 0;
                                return acc;
                            }, {}))}
                        </Typography>
                    </Paper>
                )}

                {/* Expression History */}
                {expressionHistory.length > 0 && (
                    <Box sx={{ mt: 3 }}>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                            فرمول‌های اخیر:
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                            {expressionHistory.map((expr, index) => (
                                <Chip
                                    key={index}
                                    label={expr}
                                    onClick={() => setExpression(expr)}
                                    onDelete={() => setExpressionHistory(prev => prev.filter((_, i) => i !== index))}
                                    size="small"
                                    variant="outlined"
                                    sx={{ cursor: 'pointer' }}
                                />
                            ))}
                        </Box>
                    </Box>
                )}
            </CardContent>
        </Card>
    );
};

export default SymbolMath;