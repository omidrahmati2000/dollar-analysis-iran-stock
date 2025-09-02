import React, { useState, useEffect } from 'react';
import {
    Card,
    CardContent,
    Typography,
    Box,
    Grid,
    Chip
} from '@mui/material';
import {
    TrendingUp as TrendingUpIcon,
    TrendingDown as TrendingDownIcon,
    ShowChart as StatsIcon
} from '@mui/icons-material';
import LoadingSpinner from '../Loading/LoadingSpinner';

const QuickStats = () => {
    const [stats, setStats] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchQuickStats();
        const interval = setInterval(fetchQuickStats, 60000); // Update every minute
        return () => clearInterval(interval);
    }, []);

    const fetchQuickStats = async () => {
        try {
            const response = await fetch('http://localhost:8000/api/v2/currencies?limit=30');
            if (response.ok) {
                const allCurrencies = await response.json();
                
                // Extract specific currencies for quick stats
                const quickStatsData = [];
                
                // دلار آمریکا
                const usd = allCurrencies.find(c => c.currency_code === 'USD');
                if (usd) quickStatsData.push({
                    name: 'دلار آمریکا',
                    value: usd.price_irr,
                    change: usd.change_percent_24h,
                    unit: 'ریال',
                    icon: '💵'
                });

                // یورو
                const eur = allCurrencies.find(c => c.currency_code === 'EUR');
                if (eur) quickStatsData.push({
                    name: 'یورو',
                    value: eur.price_irr,
                    change: eur.change_percent_24h,
                    unit: 'ریال',
                    icon: '💶'
                });

                // درهم امارات
                const aed = allCurrencies.find(c => c.currency_code === 'AED');
                if (aed) quickStatsData.push({
                    name: 'درهم امارات',
                    value: aed.price_irr,
                    change: aed.change_percent_24h,
                    unit: 'ریال',
                    icon: '🏦'
                });

                // بیت کوین (دلاری)
                const btc = allCurrencies.find(c => c.currency_code === 'BTC');
                if (btc) quickStatsData.push({
                    name: 'بیت کوین',
                    value: btc.price_irr,
                    change: btc.change_percent_24h,
                    unit: '$',
                    icon: '₿'
                });

                // اتریوم (دلاری)
                const eth = allCurrencies.find(c => c.currency_code === 'ETH');
                if (eth) quickStatsData.push({
                    name: 'اتریوم',
                    value: eth.price_irr,
                    change: eth.change_percent_24h,
                    unit: '$',
                    icon: '💎'
                });

                // اونس طلا (دلاری)
                const goldOz = allCurrencies.find(c => c.currency_code === 'GOLD_OUNCE' || c.currency_name.includes('اونس طلا'));
                if (goldOz) quickStatsData.push({
                    name: 'اونس طلا',
                    value: goldOz.price_irr,
                    change: goldOz.change_percent_24h,
                    unit: '$',
                    icon: '🥇'
                });

                // طلا 18 عیار (ریالی)
                const gold18 = allCurrencies.find(c => c.currency_name.includes('طلا') && c.currency_name.includes('18'));
                if (gold18) quickStatsData.push({
                    name: 'طلا 18 عیار',
                    value: gold18.price_irr,
                    change: gold18.change_percent_24h,
                    unit: 'ریال/گرم',
                    icon: '🥇'
                });

                // سکه امامی
                const coinEmami = allCurrencies.find(c => c.currency_name.includes('سکه امامی') || c.currency_code === 'IR_COIN_EMAMI');
                if (coinEmami) quickStatsData.push({
                    name: 'سکه امامی',
                    value: coinEmami.price_irr,
                    change: coinEmami.change_percent_24h,
                    unit: 'ریال',
                    icon: '🪙'
                });

                setStats(quickStatsData);
            }
        } catch (error) {
            console.error('Error fetching quick stats:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatPrice = (price, unit) => {
        if (!price && price !== 0) return '0';
        if (unit === '$') {
            return `$${new Intl.NumberFormat('en-US').format(Math.round(price))}`;
        }
        return new Intl.NumberFormat('en-US').format(Math.round(price));
    };

    const formatPercent = (percent) => {
        if (!percent && percent !== 0) return '0%';
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
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <StatsIcon sx={{ mr: 1, color: '#2196f3' }} />
                    <Typography variant="h6" sx={{ color: '#F0F6FC', fontWeight: 'bold' }}>
                        QUICK STATS
                    </Typography>
                </Box>

                {loading ? (
                    <LoadingSpinner 
                        type="dots" 
                        message="بارگذاری آمار..." 
                        size="small"
                    />
                ) : (
                    <Grid container spacing={1}>
                        {stats.map((stat, index) => (
                            <Grid item xs={6} sm={4} md={3} key={index}>
                                <Box
                                    sx={{
                                        background: '#0D1117',
                                        border: '1px solid #30363d',
                                        borderRadius: 2,
                                        p: 1.5,
                                        transition: 'all 0.3s',
                                        '&:hover': {
                                            borderColor: '#2196f3',
                                            transform: 'translateY(-2px)'
                                        }
                                    }}
                                >
                                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                            <Typography sx={{ fontSize: '1rem' }}>{stat.icon}</Typography>
                                            <Typography variant="caption" sx={{ color: '#F0F6FC', fontSize: '0.75rem' }}>
                                                {stat.name}
                                            </Typography>
                                        </Box>
                                        <Chip
                                            label={formatPercent(stat.change)}
                                            size="small"
                                            color={getChangeColor(stat.change)}
                                            icon={getChangeIcon(stat.change)}
                                            sx={{ 
                                                height: 16,
                                                '& .MuiChip-label': { fontSize: '0.65rem', px: 0.5 }
                                            }}
                                        />
                                    </Box>
                                    <Typography variant="body2" sx={{ color: '#F0F6FC', fontWeight: 'bold' }}>
                                        {formatPrice(stat.value, stat.unit)}
                                    </Typography>
                                    <Typography variant="caption" sx={{ color: '#8B949E' }}>
                                        {stat.unit}
                                    </Typography>
                                </Box>
                            </Grid>
                        ))}
                    </Grid>
                )}

                <Box sx={{ 
                    mt: 2, 
                    pt: 2, 
                    borderTop: '1px solid #30363d',
                    textAlign: 'center'
                }}>
                    <Typography variant="caption" sx={{ color: '#8B949E' }}>
                        آخرین بروزرسانی: {new Date().toLocaleTimeString('fa-IR')}
                    </Typography>
                </Box>
            </CardContent>
        </Card>
    );
};

export default QuickStats;