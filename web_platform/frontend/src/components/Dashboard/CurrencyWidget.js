import React, { useState, useEffect } from 'react';
import {
    Card,
    CardContent,
    Typography,
    Box,
    Chip,
    Grid,
    IconButton,
    Skeleton,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Checkbox,
    FormControlLabel,
    List,
    ListItem,
    ListItemText,
    ListItemSecondaryAction,
    Slider
} from '@mui/material';
import {
    TrendingUp as TrendingUpIcon,
    TrendingDown as TrendingDownIcon,
    AttachMoney as DollarIcon,
    ShowChart as ChartIcon,
    Settings as SettingsIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import LoadingSpinner from '../Loading/LoadingSpinner';

const CurrencyWidget = () => {
    const navigate = useNavigate();
    const [allCurrencies, setAllCurrencies] = useState([]);
    const [displayCurrencies, setDisplayCurrencies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [fadeIn, setFadeIn] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [selectedCurrencies, setSelectedCurrencies] = useState({
        USD: true,
        EUR: true,
        BTC: true,
        ETH: true,
        IR_COIN_EMAMI: true,
        IR_GOLD_MELTED: true
    });
    const [maxItems, setMaxItems] = useState(6);

    useEffect(() => {
        loadSettings();
        fetchCurrencies();
        const interval = setInterval(fetchCurrencies, 30000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (allCurrencies.length > 0) {
            updateDisplayCurrencies();
        }
    }, [allCurrencies, selectedCurrencies, maxItems]);

    const loadSettings = () => {
        const savedSettings = localStorage.getItem('currencyWidgetSettings');
        if (savedSettings) {
            const settings = JSON.parse(savedSettings);
            setSelectedCurrencies(settings.selectedCurrencies || settings); // Backward compatibility
            setMaxItems(settings.maxItems || 6);
        }
    };

    const saveSettings = (newSelectedCurrencies, newMaxItems) => {
        const settings = { 
            selectedCurrencies: newSelectedCurrencies, 
            maxItems: newMaxItems 
        };
        localStorage.setItem('currencyWidgetSettings', JSON.stringify(settings));
        setSelectedCurrencies(newSelectedCurrencies);
        setMaxItems(newMaxItems);
    };

    const fetchCurrencies = async () => {
        try {
            const response = await fetch('http://localhost:8000/api/v2/currencies?limit=50');
            if (response.ok) {
                const data = await response.json();
                
                // Add icons and format data
                const formattedData = data.map(currency => ({
                    code: currency.currency_code,
                    name: currency.currency_name,
                    price: currency.price_irr,
                    change: currency.change_percent_24h,
                    icon: getCurrencyIcon(currency.currency_code, currency.currency_name)
                }));
                
                setAllCurrencies(formattedData);
                setFadeIn(true);
            }
        } catch (error) {
            console.error('Error fetching currencies:', error);
        } finally {
            setLoading(false);
        }
    };

    const getCurrencyIcon = (code, name) => {
        if (code === 'USD') return '💵';
        if (code === 'EUR') return '💶';
        if (code === 'GBP') return '💷';
        if (code === 'BTC') return '₿';
        if (code === 'ETH') return '💎';
        if (name.includes('سکه')) return '🪙';
        if (name.includes('طلا')) return '🥇';
        if (name.includes('نقره')) return '🥈';
        if (name.includes('پلاتین')) return '⚪';
        return '💱';
    };

    const updateDisplayCurrencies = () => {
        const filtered = allCurrencies.filter(currency => selectedCurrencies[currency.code]);
        setDisplayCurrencies(filtered.slice(0, maxItems));
    };

    const formatPrice = (price) => {
        if (!price && price !== 0) return '0';
        return new Intl.NumberFormat('en-US').format(Math.round(price));
    };

    const formatPercent = (percent) => {
        const sign = percent >= 0 ? '+' : '';
        return `${sign}${percent.toFixed(2)}%`;
    };

    const getChangeColor = (change) => {
        return change >= 0 ? 'success' : 'error';
    };

    const getChangeIcon = (change) => {
        return change >= 0 ? <TrendingUpIcon fontSize="small" /> : <TrendingDownIcon fontSize="small" />;
    };

    return (
        <Card sx={{ 
            height: '100%', 
            background: '#161B22',
            border: '1px solid #30363d',
            color: '#F0F6FC'
        }}>
            <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h6" sx={{ color: 'white', fontWeight: 'bold' }}>
                        <DollarIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
                        بازار ارز و طلا
                    </Typography>
                    <Box>
                        <IconButton 
                            size="small" 
                            onClick={() => setSettingsOpen(true)}
                            sx={{ color: 'white', mr: 1 }}
                        >
                            <SettingsIcon />
                        </IconButton>
                        <IconButton 
                            size="small" 
                            onClick={() => navigate('/currencies')}
                            sx={{ color: 'white' }}
                        >
                            <ChartIcon />
                        </IconButton>
                    </Box>
                </Box>

                <Grid container spacing={2}>
                    {loading ? (
                        <Grid item xs={12}>
                            <LoadingSpinner 
                                type="dots" 
                                message="بارگذاری ارزها..." 
                                size="small"
                            />
                        </Grid>
                    ) : (
                        displayCurrencies.map((currency, index) => (
                            <Grid item xs={6} sm={4} key={currency.code}>
                                <Box
                                    sx={{
                                        background: '#0D1117',
                                        border: '1px solid #30363d',
                                        borderRadius: 2,
                                        p: 1.5,
                                        cursor: 'pointer',
                                        transition: 'all 0.3s',
                                        animation: fadeIn ? `fadeIn 0.5s ${index * 0.1}s ease-out forwards` : 'none',
                                        opacity: fadeIn ? 1 : 0,
                                        '&:hover': {
                                            background: '#30363d',
                                            borderColor: '#2196f3',
                                            transform: 'translateY(-2px)'
                                        },
                                        '@keyframes fadeIn': {
                                            from: { opacity: 0, transform: 'translateY(10px)' },
                                            to: { opacity: 1, transform: 'translateY(0)' }
                                        }
                                    }}
                                    onClick={() => navigate('/currencies')}
                                >
                                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                            <Typography sx={{ fontSize: '1.2rem' }}>{currency.icon}</Typography>
                                            <Typography variant="body2" sx={{ color: 'white', fontWeight: 'bold' }}>
                                                {currency.code}
                                            </Typography>
                                        </Box>
                                        <Chip
                                            label={formatPercent(currency.change)}
                                            size="small"
                                            color={getChangeColor(currency.change)}
                                            icon={getChangeIcon(currency.change)}
                                            sx={{ 
                                                height: 20,
                                                '& .MuiChip-label': { fontSize: '0.7rem', px: 0.5 }
                                            }}
                                        />
                                    </Box>
                                    <Typography variant="caption" sx={{ color: '#8B949E' }}>
                                        {currency.name}
                                    </Typography>
                                    <Typography variant="h6" sx={{ color: '#F0F6FC', fontWeight: 'bold', mt: 0.5 }}>
                                        {formatPrice(currency.price)}
                                    </Typography>
                                </Box>
                            </Grid>
                        ))
                    )}
                </Grid>

                <Box sx={{ 
                    mt: 2, 
                    pt: 2, 
                    borderTop: '1px solid #30363d',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <Typography variant="caption" sx={{ color: '#8B949E' }}>
                        آخرین بروزرسانی: {new Date().toLocaleTimeString('fa-IR')}
                    </Typography>
                    <Typography 
                        variant="caption" 
                        sx={{ 
                            color: '#2196f3',
                            cursor: 'pointer',
                            '&:hover': { textDecoration: 'underline' }
                        }}
                        onClick={() => navigate('/currencies')}
                    >
                        مشاهده همه ←
                    </Typography>
                </Box>
            </CardContent>

            {/* Settings Dialog */}
            <Dialog 
                open={settingsOpen} 
                onClose={() => setSettingsOpen(false)}
                maxWidth="sm"
                fullWidth
                PaperProps={{
                    sx: {
                        backgroundColor: '#161B22',
                        border: '1px solid #30363d',
                        color: '#F0F6FC'
                    }
                }}
            >
                <DialogTitle sx={{ color: '#F0F6FC' }}>
                    تنظیمات نمایش ارزها
                </DialogTitle>
                <DialogContent>
                    <Box sx={{ mb: 3 }}>
                        <Typography variant="body2" sx={{ color: '#8B949E', mb: 2 }}>
                            تعداد ارزهای نمایشی:
                        </Typography>
                        <Slider
                            value={maxItems}
                            onChange={(e, newValue) => setMaxItems(newValue)}
                            min={3}
                            max={15}
                            step={1}
                            marks
                            valueLabelDisplay="on"
                            sx={{
                                color: '#2196f3',
                                '& .MuiSlider-valueLabel': {
                                    backgroundColor: '#2196f3'
                                }
                            }}
                        />
                    </Box>
                    <Typography variant="body2" sx={{ color: '#8B949E', mb: 2 }}>
                        ارزهایی که می‌خواهید در داشبورد نمایش داده شوند را انتخاب کنید:
                    </Typography>
                    <List>
                        {allCurrencies.slice(0, 15).map((currency) => (
                            <ListItem key={currency.code} dense>
                                <FormControlLabel
                                    control={
                                        <Checkbox
                                            checked={selectedCurrencies[currency.code] || false}
                                            onChange={(e) => {
                                                const newSettings = {
                                                    ...selectedCurrencies,
                                                    [currency.code]: e.target.checked
                                                };
                                                setSelectedCurrencies(newSettings);
                                            }}
                                            sx={{
                                                color: '#8B949E',
                                                '&.Mui-checked': {
                                                    color: '#2196f3',
                                                },
                                            }}
                                        />
                                    }
                                    label={
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <span>{currency.icon}</span>
                                            <span>{currency.name}</span>
                                            <Chip 
                                                label={currency.code} 
                                                size="small" 
                                                sx={{ 
                                                    backgroundColor: '#30363d',
                                                    color: '#8B949E',
                                                    fontSize: '0.7rem'
                                                }}
                                            />
                                        </Box>
                                    }
                                    sx={{ color: '#F0F6FC' }}
                                />
                            </ListItem>
                        ))}
                    </List>
                </DialogContent>
                <DialogActions>
                    <Button 
                        onClick={() => {
                            saveSettings(selectedCurrencies, maxItems);
                            setSettingsOpen(false);
                        }}
                        sx={{ color: '#2196f3' }}
                    >
                        ذخیره تنظیمات
                    </Button>
                    <Button 
                        onClick={() => setSettingsOpen(false)}
                        sx={{ color: '#8B949E' }}
                    >
                        انصراف
                    </Button>
                </DialogActions>
            </Dialog>
        </Card>
    );
};

export default CurrencyWidget;