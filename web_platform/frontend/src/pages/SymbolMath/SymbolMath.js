import React, { useState } from 'react';
import {
    Box,
    Container,
    Typography,
    Grid,
    Card,
    CardContent,
    List,
    ListItem,
    ListItemIcon,
    ListItemText,
    Divider,
    useTheme
} from '@mui/material';
import {
    Calculate,
    Timeline,
    TrendingUp,
    Functions,
    AccountBalance,
    CurrencyExchange
} from '@mui/icons-material';
import SymbolMath from '../../components/SymbolMath/SymbolMath';

const SymbolMathPage = () => {
    const theme = useTheme();
    const [currentExpression, setCurrentExpression] = useState(null);

    const handleExpressionChange = (expressionData) => {
        setCurrentExpression(expressionData);
    };

    const features = [
        {
            icon: <Calculate />,
            title: 'عملیات ریاضی',
            description: 'جمع، تفریق، ضرب، تقسیم و توان'
        },
        {
            icon: <AccountBalance />,
            title: 'نمادهای سهام',
            description: 'استفاده از نمادهای سهام ایرانی'
        },
        {
            icon: <CurrencyExchange />,
            title: 'ارزها',
            description: 'نرخ ارزهای مختلف'
        },
        {
            icon: <Functions />,
            title: 'پرانتز و اولویت',
            description: 'استفاده از پرانتز برای اولویت محاسبات'
        }
    ];

    const examples = [
        {
            title: 'نسبت طلا به نقره',
            expression: 'GOLD/SILVER',
            description: 'محاسبه نسبت قیمت طلا به نقره'
        },
        {
            title: 'شاخص ترکیبی ارز',
            expression: '(USD+EUR+GBP)/3',
            description: 'میانگین قیمت سه ارز اصلی'
        },
        {
            title: 'ضریب بیت کوین',
            expression: 'BTC/GOLD*1000',
            description: 'نسبت بیت کوین به طلا در هزار'
        },
        {
            title: 'شاخص پتروشیمی',
            expression: '(PETCHEM1+PETCHEM2)*OIL/100',
            description: 'شاخص ترکیبی پتروشیمی'
        }
    ];

    return (
        <Container maxWidth="xl" sx={{ py: 4 }}>
            {/* Header */}
            <Box sx={{ mb: 4, textAlign: 'center' }}>
                <Typography variant="h3" component="h1" sx={{ 
                    mb: 2, 
                    fontWeight: 700,
                    background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
                    backgroundClip: 'text',
                    color: 'transparent'
                }}>
                    ماشین حساب نمادها
                </Typography>
                <Typography variant="h6" color="text.secondary" sx={{ mb: 3 }}>
                    مشابه TradingView - محاسبه فرمول‌های پیچیده با نمادهای سهام و ارز
                </Typography>
            </Box>

            <Grid container spacing={3}>
                {/* Main Calculator */}
                <Grid item xs={12} lg={8}>
                    <SymbolMath onExpressionChange={handleExpressionChange} />
                    
                    {/* Current Expression Info */}
                    {currentExpression && (
                        <Card sx={{ mt: 3 }}>
                            <CardContent>
                                <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
                                    <Timeline sx={{ mr: 1 }} />
                                    اطلاعات فرمول فعلی
                                </Typography>
                                <Box sx={{ mb: 2 }}>
                                    <Typography variant="body2" color="text.secondary">
                                        فرمول:
                                    </Typography>
                                    <Typography variant="h6" sx={{ fontFamily: 'monospace', color: 'primary.main' }}>
                                        {currentExpression.expression}
                                    </Typography>
                                </Box>
                                <Box sx={{ mb: 2 }}>
                                    <Typography variant="body2" color="text.secondary">
                                        نتیجه:
                                    </Typography>
                                    <Typography variant="h4" sx={{ fontWeight: 600, color: 'primary.main' }}>
                                        {new Intl.NumberFormat('en-US', { 
                                            minimumFractionDigits: 2, 
                                            maximumFractionDigits: 6 
                                        }).format(currentExpression.result)}
                                    </Typography>
                                </Box>
                                <Typography variant="body2" color="text.secondary">
                                    تعداد نمادها: {currentExpression.symbols.length}
                                </Typography>
                            </CardContent>
                        </Card>
                    )}
                </Grid>

                {/* Sidebar */}
                <Grid item xs={12} lg={4}>
                    {/* Features */}
                    <Card sx={{ mb: 3 }}>
                        <CardContent>
                            <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
                                <TrendingUp sx={{ mr: 1 }} />
                                قابلیت‌ها
                            </Typography>
                            <List dense>
                                {features.map((feature, index) => (
                                    <ListItem key={index}>
                                        <ListItemIcon>
                                            {React.cloneElement(feature.icon, { 
                                                sx: { color: theme.palette.primary.main } 
                                            })}
                                        </ListItemIcon>
                                        <ListItemText 
                                            primary={feature.title}
                                            secondary={feature.description}
                                        />
                                    </ListItem>
                                ))}
                            </List>
                        </CardContent>
                    </Card>

                    {/* Examples */}
                    <Card>
                        <CardContent>
                            <Typography variant="h6" sx={{ mb: 2 }}>
                                نمونه فرمول‌ها
                            </Typography>
                            {examples.map((example, index) => (
                                <Box key={index}>
                                    <Box sx={{ mb: 2 }}>
                                        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                                            {example.title}
                                        </Typography>
                                        <Typography 
                                            variant="body2" 
                                            sx={{ 
                                                fontFamily: 'monospace', 
                                                backgroundColor: theme.palette.action.hover,
                                                p: 1,
                                                borderRadius: 1,
                                                mb: 0.5
                                            }}
                                        >
                                            {example.expression}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            {example.description}
                                        </Typography>
                                    </Box>
                                    {index < examples.length - 1 && <Divider sx={{ my: 2 }} />}
                                </Box>
                            ))}
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>

            {/* Help Section */}
            <Card sx={{ mt: 4 }}>
                <CardContent>
                    <Typography variant="h6" sx={{ mb: 3 }}>
                        راهنمای استفاده
                    </Typography>
                    <Grid container spacing={3}>
                        <Grid item xs={12} md={4}>
                            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                                عملگرها
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                + (جمع), - (تفریق), * (ضرب), / (تقسیم), ^ (توان)
                            </Typography>
                        </Grid>
                        <Grid item xs={12} md={4}>
                            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                                نمادها
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                استفاده از نمادهای سهام (مثل TAPICO) و ارز (مثل USD)
                            </Typography>
                        </Grid>
                        <Grid item xs={12} md={4}>
                            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                                پرانتز
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                استفاده از () برای تعیین اولویت محاسبات
                            </Typography>
                        </Grid>
                    </Grid>
                </CardContent>
            </Card>
        </Container>
    );
};

export default SymbolMathPage;