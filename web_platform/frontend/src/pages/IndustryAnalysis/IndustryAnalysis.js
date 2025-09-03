import React, { useState, useEffect } from 'react';
import {
    Box,
    Typography,
    Card,
    CardContent,
    Grid,
    TextField,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    Chip,
    LinearProgress,
    CircularProgress,
    useTheme,
    Divider,
    Button,
    Alert,
    AlertTitle
} from '@mui/material';
import LoadingSpinner, { LoadingGrid } from '../../components/Loading/LoadingSpinner';
import PersianDatePicker from '../../components/DatePicker/PersianDatePicker';

const IndustryAnalysis = () => {
    const theme = useTheme();
    const [industryGroups, setIndustryGroups] = useState([]);
    const [selectedIndustry, setSelectedIndustry] = useState(null);
    const [industryStocks, setIndustryStocks] = useState([]);
    const [marketStats, setMarketStats] = useState({});
    const [priceType, setPriceType] = useState(3);
    const [loading, setLoading] = useState(true);
    const [stocksLoading, setStocksLoading] = useState(false);
    const [sortBy, setSortBy] = useState('performance');
    const [stockSortBy, setStockSortBy] = useState('performance');
    const [searchText, setSearchText] = useState('');
    const [fromDate, setFromDate] = useState(() => {
        // Default to 30 days ago
        const date = new Date();
        date.setDate(date.getDate() - 30);
        return date;
    });
    const [toDate, setToDate] = useState(new Date()); // Default to today
    const [dateRangeInfo, setDateRangeInfo] = useState('');

    useEffect(() => {
        // Update date range info
        const days = Math.ceil((toDate - fromDate) / (1000 * 60 * 60 * 24));
        const fromStr = fromDate.toLocaleDateString('fa-IR');
        const toStr = toDate.toLocaleDateString('fa-IR');
        setDateRangeInfo(`تحلیل ${days} روزه از ${fromStr} تا ${toStr}`);
        
        fetchData();
        // If an industry is selected, refresh its stocks too
        if (selectedIndustry) {
            fetchIndustryStocks(selectedIndustry.industry_group);
        }
    }, [priceType, sortBy, fromDate, toDate]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const fromDateStr = fromDate.toISOString().split('T')[0];
            const toDateStr = toDate.toISOString().split('T')[0];
            
            const [groupsResponse, statsResponse] = await Promise.all([
                fetch(`http://localhost:8000/api/v2/market/industry-groups?price_type=${priceType}&sort_by=${sortBy}&from_date=${fromDateStr}&to_date=${toDateStr}`),
                fetch('http://localhost:8000/api/v2/market/stats')
            ]);

            const groupsData = await groupsResponse.json();
            const statsData = await statsResponse.json();

            setIndustryGroups(groupsData.groups || []);
            setMarketStats(statsData);
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchIndustryStocks = async (industryName) => {
        try {
            setStocksLoading(true);
            const fromDateStr = fromDate.toISOString().split('T')[0];
            const toDateStr = toDate.toISOString().split('T')[0];
            
            const response = await fetch(
                `http://localhost:8000/api/v2/market/industry-groups/${encodeURIComponent(industryName)}/stocks?price_type=${priceType}&sort_by=${stockSortBy}&limit=100&from_date=${fromDateStr}&to_date=${toDateStr}`
            );
            const data = await response.json();
            setIndustryStocks(data.stocks || []);
        } catch (error) {
            console.error('Error fetching industry stocks:', error);
            setIndustryStocks([]);
        } finally {
            setStocksLoading(false);
        }
    };

    const handleIndustryClick = (industry) => {
        setSelectedIndustry(industry);
        fetchIndustryStocks(industry.industry_group);
    };

    const formatNumber = (num) => {
        if (!num) return '0';
        return new Intl.NumberFormat('en-US').format(num);
    };

    const formatPercent = (num) => {
        if (!num && num !== 0) return '0%';
        return `${num.toFixed(2)}%`;
    };

    const getTrendColor = (trend) => {
        switch (trend) {
            case 'BULLISH': return '#4CAF50';
            case 'BEARISH': return '#f44336';
            default: return '#9E9E9E';
        }
    };

    const getPerformanceColor = (percent) => {
        if (percent > 0) return '#4CAF50';
        if (percent < 0) return '#f44336';
        return '#9E9E9E';
    };

    const filteredIndustryGroups = industryGroups.filter(group => {
        if (!searchText) return true;
        return group.industry_group.toLowerCase().includes(searchText.toLowerCase());
    });

    if (loading && industryGroups.length === 0) {
        return (
            <Box sx={{ p: 3, maxWidth: 1400, mx: 'auto' }}>
                <Typography variant="h3" component="h1" sx={{ mb: 4, textAlign: 'center' }}>
                    تحلیل گروه‌های صنعتی
                </Typography>
                <LoadingSpinner 
                    type="pulse" 
                    message="در حال بارگذاری گروه‌های صنعتی..." 
                    size="large"
                />
                <LoadingGrid items={8} itemHeight={150} />
            </Box>
        );
    }

    return (
        <Box sx={{ p: 3, maxWidth: 1400, mx: 'auto' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4, pb: 2, borderBottom: `2px solid ${theme.palette.divider}` }}>
                <Typography variant="h3" component="h1">
                    تحلیل گروه‌های صنعتی
                </Typography>
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                    <TextField
                        size="small"
                        label="جستجو"
                        placeholder="نام گروه صنعتی..."
                        value={searchText}
                        onChange={(e) => setSearchText(e.target.value)}
                        sx={{ minWidth: 200 }}
                    />
                    <FormControl size="small" sx={{ minWidth: 120 }}>
                        <InputLabel>نوع قیمت</InputLabel>
                        <Select 
                            value={priceType} 
                            onChange={(e) => setPriceType(parseInt(e.target.value))}
                            label="نوع قیمت"
                        >
                            <MenuItem value={3}>تعدیل شده</MenuItem>
                            <MenuItem value={2}>تعدیل نشده</MenuItem>
                        </Select>
                    </FormControl>
                    <FormControl size="small" sx={{ minWidth: 120 }}>
                        <InputLabel>مرتب‌سازی</InputLabel>
                        <Select value={sortBy} onChange={(e) => setSortBy(e.target.value)} label="مرتب‌سازی">
                            <MenuItem value="performance">عملکرد</MenuItem>
                            <MenuItem value="total_stocks">تعداد سهام</MenuItem>
                            <MenuItem value="positive_ratio">نسبت مثبت</MenuItem>
                        </Select>
                    </FormControl>
                </Box>
            </Box>

            {/* Date Range Filter */}
            <Paper sx={{ 
                p: 3, 
                mb: 3, 
                background: `linear-gradient(135deg, ${theme.palette.primary.main}10, ${theme.palette.secondary.main}05)`,
                border: `1px solid ${theme.palette.divider}`,
                borderRadius: 2
            }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                    <Box sx={{ 
                        width: 40, 
                        height: 40, 
                        borderRadius: '50%', 
                        backgroundColor: theme.palette.primary.main,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        mr: 2
                    }}>
                        <Typography variant="h6" sx={{ color: 'white' }}>📅</Typography>
                    </Box>
                    <Box>
                        <Typography variant="h6" sx={{ fontWeight: 700, color: theme.palette.primary.main }}>
                            بازه زمانی تحلیل
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            انتخاب محدوده زمانی برای تحلیل عملکرد گروه‌های صنعتی
                        </Typography>
                    </Box>
                </Box>
                
                <Grid container spacing={3} alignItems="end">
                    <Grid item xs={12} sm={3}>
                        <PersianDatePicker
                            label="🗓 از تاریخ"
                            value={fromDate}
                            onChange={setFromDate}
                            size="medium"
                            fullWidth
                            helperText="تاریخ شروع تحلیل"
                        />
                    </Grid>
                    <Grid item xs={12} sm={3}>
                        <PersianDatePicker
                            label="🗓 تا تاریخ"
                            value={toDate}
                            onChange={setToDate}
                            size="medium"
                            fullWidth
                            helperText="تاریخ پایان تحلیل"
                        />
                    </Grid>
                    <Grid item xs={12} sm={3}>
                        <Paper sx={{ 
                            p: 2, 
                            backgroundColor: theme.palette.success.main + '20',
                            border: `2px solid ${theme.palette.success.main}30`,
                            borderRadius: 2,
                            textAlign: 'center',
                            height: 'fit-content'
                        }}>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                                مدت زمان
                            </Typography>
                            <Typography variant="h5" sx={{ 
                                fontWeight: 700, 
                                color: theme.palette.success.main,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 1
                            }}>
                                ⏱ {Math.ceil((toDate - fromDate) / (1000 * 60 * 60 * 24))} روز
                            </Typography>
                        </Paper>
                    </Grid>
                    <Grid item xs={12} sm={3}>
                        <Box sx={{ display: 'flex', gap: 1, flexDirection: 'column' }}>
                            <Button
                                variant="outlined"
                                size="small"
                                onClick={() => {
                                    const today = new Date();
                                    const lastWeek = new Date();
                                    lastWeek.setDate(today.getDate() - 7);
                                    setFromDate(lastWeek);
                                    setToDate(today);
                                }}
                                sx={{ fontSize: '0.75rem' }}
                            >
                                هفته گذشته
                            </Button>
                            <Button
                                variant="outlined"
                                size="small"
                                onClick={() => {
                                    const today = new Date();
                                    const lastMonth = new Date();
                                    lastMonth.setDate(today.getDate() - 30);
                                    setFromDate(lastMonth);
                                    setToDate(today);
                                }}
                                sx={{ fontSize: '0.75rem' }}
                            >
                                ماه گذشته
                            </Button>
                            <Button
                                variant="outlined"
                                size="small"
                                onClick={() => {
                                    const today = new Date();
                                    const threeMonths = new Date();
                                    threeMonths.setDate(today.getDate() - 90);
                                    setFromDate(threeMonths);
                                    setToDate(today);
                                }}
                                sx={{ fontSize: '0.75rem' }}
                            >
                                سه ماه
                            </Button>
                        </Box>
                    </Grid>
                </Grid>
                
                {/* Current date range info */}
                <Alert severity="info" sx={{ mt: 2, mb: 1 }}>
                    <AlertTitle sx={{ fontWeight: 600 }}>📊 بازه زمانی فعلی</AlertTitle>
                    {dateRangeInfo}
                    <br />
                    <Typography variant="caption" sx={{ mt: 1, display: 'block', opacity: 0.8 }}>
                        💡 توجه: در حال حاضر سیستم از داده‌های نمونه استفاده می‌کند. فیلترینگ بر اساس تاریخ در نسخه‌های آینده کامل خواهد شد.
                    </Typography>
                </Alert>
                
                {/* Loading indicator when dates change */}
                {loading && (
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mt: 2, p: 2, backgroundColor: theme.palette.action.hover, borderRadius: 1 }}>
                        <CircularProgress size={20} sx={{ mr: 1 }} />
                        <Typography variant="body2" color="text.secondary">
                            در حال بروزرسانی داده‌ها برای بازه زمانی جدید...
                        </Typography>
                    </Box>
                )}
            </Paper>

            <Grid container spacing={3} sx={{ mb: 4 }}>
                <Grid item xs={12} sm={6} md={3}>
                    <Card sx={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
                        <CardContent sx={{ textAlign: 'center' }}>
                            <Typography variant="h6" sx={{ mb: 2, opacity: 0.9 }}>
                                کل سهام
                            </Typography>
                            <Typography variant="h3" sx={{ fontWeight: 'bold' }}>
                                {formatNumber(marketStats.total_stocks)}
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <Card sx={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
                        <CardContent sx={{ textAlign: 'center' }}>
                            <Typography variant="h6" sx={{ mb: 2, opacity: 0.9 }}>
                                شرکت‌ها
                            </Typography>
                            <Typography variant="h3" sx={{ fontWeight: 'bold' }}>
                                {formatNumber(marketStats.companies)}
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <Card sx={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
                        <CardContent sx={{ textAlign: 'center' }}>
                            <Typography variant="h6" sx={{ mb: 2, opacity: 0.9 }}>
                                گروه‌های فعال
                            </Typography>
                            <Typography variant="h3" sx={{ fontWeight: 'bold' }}>
                                {filteredIndustryGroups.length}
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <Card sx={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
                        <CardContent sx={{ textAlign: 'center' }}>
                            <Typography variant="h6" sx={{ mb: 2, opacity: 0.9 }}>
                                نوع قیمت
                            </Typography>
                            <Typography variant="h3" sx={{ fontWeight: 'bold' }}>
                                {priceType === 3 ? 'تعدیل شده' : 'تعدیل نشده'}
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>

            <Grid container spacing={3} sx={{ height: 'calc(100vh - 450px)', minHeight: '600px' }}>
                <Grid item xs={12} lg={5}>
                    <Paper sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
                        <Typography variant="h5" sx={{ mb: 3, pb: 2, borderBottom: `3px solid ${theme.palette.primary.main}` }}>
                            گروه‌های صنعتی
                        </Typography>
                        <Box sx={{ 
                            flex: 1, 
                            overflowY: 'auto', 
                            pr: 1,
                            maxHeight: 'calc(100vh - 550px)',
                            '&::-webkit-scrollbar': {
                                width: '8px',
                            },
                            '&::-webkit-scrollbar-track': {
                                backgroundColor: theme.palette.mode === 'dark' ? '#2b2b2b' : '#f1f1f1',
                                borderRadius: '4px',
                            },
                            '&::-webkit-scrollbar-thumb': {
                                backgroundColor: theme.palette.mode === 'dark' ? '#6b6b6b' : '#c1c1c1',
                                borderRadius: '4px',
                            },
                            '&::-webkit-scrollbar-thumb:hover': {
                                backgroundColor: theme.palette.mode === 'dark' ? '#8b8b8b' : '#a8a8a8',
                            }
                        }}>
                            {filteredIndustryGroups.map((group, index) => (
                                <Card
                                    key={index}
                                    sx={{
                                        mb: 2,
                                        cursor: 'pointer',
                                        transition: 'all 0.3s',
                                        border: selectedIndustry?.industry_group === group.industry_group ? 
                                            `2px solid ${theme.palette.primary.main}` : 
                                            `1px solid ${theme.palette.divider}`,
                                        backgroundColor: selectedIndustry?.industry_group === group.industry_group ? 
                                            theme.palette.action.selected : 
                                            theme.palette.background.paper,
                                        '&:hover': {
                                            borderColor: theme.palette.primary.main,
                                            transform: 'translateY(-2px)',
                                            boxShadow: 3
                                        }
                                    }}
                                    onClick={() => handleIndustryClick(group)}
                                >
                                    <CardContent>
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                            <Typography variant="h6" sx={{ fontWeight: 600 }}>
                                                {group.industry_group}
                                            </Typography>
                                            <Chip
                                                label={group.trend === 'BULLISH' ? 'صعودی' : 
                                                       group.trend === 'BEARISH' ? 'نزولی' : 'خنثی'}
                                                sx={{
                                                    backgroundColor: getTrendColor(group.trend),
                                                    color: 'white',
                                                    fontWeight: 600
                                                }}
                                                size="small"
                                            />
                                        </Box>
                                        
                                        <Grid container spacing={2} sx={{ mb: 2 }}>
                                            <Grid item xs={6}>
                                                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                    <Typography variant="body2" color="text.secondary">
                                                        تعداد سهام:
                                                    </Typography>
                                                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                                        {formatNumber(group.total_stocks)}
                                                    </Typography>
                                                </Box>
                                            </Grid>
                                            <Grid item xs={6}>
                                                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                    <Typography variant="body2" color="text.secondary">
                                                        میانگین تغییر:
                                                    </Typography>
                                                    <Typography 
                                                        variant="body2" 
                                                        sx={{ 
                                                            fontWeight: 600,
                                                            color: getPerformanceColor(group.avg_change_percent)
                                                        }}
                                                    >
                                                        {formatPercent(group.avg_change_percent)}
                                                    </Typography>
                                                </Box>
                                            </Grid>
                                            <Grid item xs={6}>
                                                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                    <Typography variant="body2" color="text.secondary">
                                                        سهام مثبت:
                                                    </Typography>
                                                    <Typography variant="body2" sx={{ fontWeight: 600, color: '#4CAF50' }}>
                                                        {formatNumber(group.positive_stocks)}
                                                    </Typography>
                                                </Box>
                                            </Grid>
                                            <Grid item xs={6}>
                                                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                    <Typography variant="body2" color="text.secondary">
                                                        سهام منفی:
                                                    </Typography>
                                                    <Typography variant="body2" sx={{ fontWeight: 600, color: '#f44336' }}>
                                                        {formatNumber(group.negative_stocks)}
                                                    </Typography>
                                                </Box>
                                            </Grid>
                                        </Grid>

                                        <Box sx={{ mt: 2 }}>
                                            <LinearProgress
                                                variant="determinate"
                                                value={group.positive_ratio}
                                                sx={{
                                                    height: 8,
                                                    borderRadius: 4,
                                                    backgroundColor: theme.palette.error.light,
                                                    '& .MuiLinearProgress-bar': {
                                                        backgroundColor: '#4CAF50',
                                                        borderRadius: 4,
                                                    }
                                                }}
                                            />
                                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
                                                <Typography variant="caption" sx={{ color: '#4CAF50', fontWeight: 600 }}>
                                                    {formatPercent(group.positive_ratio)}
                                                </Typography>
                                                <Typography variant="caption" sx={{ color: '#f44336', fontWeight: 600 }}>
                                                    {formatPercent(group.negative_ratio)}
                                                </Typography>
                                            </Box>
                                        </Box>
                                    </CardContent>
                                </Card>
                            ))}
                        </Box>
                    </Paper>
                </Grid>

                <Grid item xs={12} lg={7}>
                    <Paper sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
                        {selectedIndustry ? (
                            <>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                                    <Typography variant="h5" sx={{ pb: 2, borderBottom: `3px solid ${theme.palette.primary.main}` }}>
                                        سهام {selectedIndustry.industry_group}
                                    </Typography>
                                    <FormControl size="small" sx={{ minWidth: 120 }}>
                                        <InputLabel>مرتب‌سازی</InputLabel>
                                        <Select 
                                            value={stockSortBy} 
                                            onChange={(e) => {
                                                setStockSortBy(e.target.value);
                                                if (selectedIndustry) {
                                                    fetchIndustryStocks(selectedIndustry.industry_group);
                                                }
                                            }}
                                            label="مرتب‌سازی"
                                        >
                                            <MenuItem value="performance">عملکرد</MenuItem>
                                            <MenuItem value="price">قیمت</MenuItem>
                                            <MenuItem value="volume">حجم</MenuItem>
                                            <MenuItem value="market_value">ارزش بازار</MenuItem>
                                            <MenuItem value="symbol">نماد</MenuItem>
                                            <MenuItem value="name">نام</MenuItem>
                                        </Select>
                                    </FormControl>
                                </Box>

                                <Box sx={{ 
                                    flex: 1, 
                                    overflowY: 'auto',
                                    maxHeight: 'calc(100vh - 600px)',
                                    '&::-webkit-scrollbar': {
                                        width: '8px',
                                    },
                                    '&::-webkit-scrollbar-track': {
                                        backgroundColor: theme.palette.mode === 'dark' ? '#2b2b2b' : '#f1f1f1',
                                        borderRadius: '4px',
                                    },
                                    '&::-webkit-scrollbar-thumb': {
                                        backgroundColor: theme.palette.mode === 'dark' ? '#6b6b6b' : '#c1c1c1',
                                        borderRadius: '4px',
                                    },
                                    '&::-webkit-scrollbar-thumb:hover': {
                                        backgroundColor: theme.palette.mode === 'dark' ? '#8b8b8b' : '#a8a8a8',
                                    }
                                }}>
                                    {stocksLoading ? (
                                        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
                                            <CircularProgress />
                                        </Box>
                                    ) : (
                                        <TableContainer>
                                            <Table stickyHeader size="small">
                                                <TableHead>
                                                    <TableRow>
                                                        <TableCell align="center">نماد</TableCell>
                                                        <TableCell align="center">نام شرکت</TableCell>
                                                        <TableCell align="center">قیمت</TableCell>
                                                        <TableCell align="center">تغییر</TableCell>
                                                        <TableCell align="center">درصد تغییر</TableCell>
                                                        <TableCell align="center">حجم</TableCell>
                                                        <TableCell align="center">P/E</TableCell>
                                                    </TableRow>
                                                </TableHead>
                                                <TableBody>
                                                    {industryStocks.map((stock, index) => (
                                                        <TableRow key={index} hover>
                                                            <TableCell align="center" sx={{ fontWeight: 600, color: 'primary.main' }}>
                                                                {stock.symbol}
                                                            </TableCell>
                                                            <TableCell align="center">
                                                                {stock.company_name}
                                                            </TableCell>
                                                            <TableCell align="center" sx={{ fontWeight: 500 }}>
                                                                {formatNumber(stock.last_price)}
                                                            </TableCell>
                                                            <TableCell 
                                                                align="center" 
                                                                sx={{ 
                                                                    fontWeight: 500,
                                                                    color: getPerformanceColor(stock.price_change)
                                                                }}
                                                            >
                                                                {formatNumber(stock.price_change)}
                                                            </TableCell>
                                                            <TableCell 
                                                                align="center" 
                                                                sx={{ 
                                                                    fontWeight: 500,
                                                                    color: getPerformanceColor(stock.price_change_percent)
                                                                }}
                                                            >
                                                                {formatPercent(stock.price_change_percent)}
                                                            </TableCell>
                                                            <TableCell align="center" sx={{ fontWeight: 500 }}>
                                                                {formatNumber(stock.volume)}
                                                            </TableCell>
                                                            <TableCell align="center" sx={{ fontWeight: 500 }}>
                                                                {stock.pe_ratio ? formatNumber(stock.pe_ratio) : '-'}
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </TableContainer>
                                    )}
                                </Box>
                            </>
                        ) : (
                            <Box sx={{ 
                                display: 'flex', 
                                flexDirection: 'column', 
                                justifyContent: 'center', 
                                alignItems: 'center', 
                                height: '100%',
                                textAlign: 'center'
                            }}>
                                <Typography variant="h5" sx={{ mb: 2, color: 'text.secondary' }}>
                                    گروه صنعتی را انتخاب کنید
                                </Typography>
                                <Typography variant="body1" sx={{ opacity: 0.8, color: 'text.secondary' }}>
                                    برای مشاهده سهام‌های هر گروه، روی آن کلیک کنید
                                </Typography>
                            </Box>
                        )}
                    </Paper>
                </Grid>
            </Grid>
        </Box>
    );
};

export default IndustryAnalysis;