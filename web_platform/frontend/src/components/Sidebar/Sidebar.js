import React, { useState, useEffect } from 'react';
import {
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Box,
  Typography,
  Divider,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Checkbox,
  FormControlLabel,
  TextField,
  Slider
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  ShowChart as ChartsIcon,
  FilterList as ScreenerIcon,
  AccountBalance as PortfolioIcon,
  Bookmark as WatchlistIcon,
  Settings as SettingsIcon,
  TrendingUp as TrendingUpIcon,
  Analytics as AnalyticsIcon,
  Notifications as AlertsIcon,
  BusinessCenter as IndustryIcon,
  MonetizationOn as CurrencyIcon,
  Calculate as CalculateIcon,
  Insights as AdvancedChartIcon
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';

const DRAWER_WIDTH = 240;

const menuItems = [
  { text: 'Dashboard', icon: <DashboardIcon />, path: '/dashboard' },
  { text: 'Charts', icon: <ChartsIcon />, path: '/charts' },
  { text: 'Advanced Charts', icon: <AdvancedChartIcon />, path: '/advanced-charts' },
  { text: 'Currencies', icon: <CurrencyIcon />, path: '/currencies' },
  { text: 'Screener', icon: <ScreenerIcon />, path: '/screener' },
  { text: 'Industry Analysis', icon: <IndustryIcon />, path: '/industry-analysis' },
  { text: 'Symbol Math', icon: <CalculateIcon />, path: '/symbol-math' },
  { text: 'Portfolio', icon: <PortfolioIcon />, path: '/portfolio' },
  { text: 'Watchlist', icon: <WatchlistIcon />, path: '/watchlist' },
  { text: 'Alerts', icon: <AlertsIcon />, path: '/alerts' },
];

const Sidebar = ({ open, onClose }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [quickStats, setQuickStats] = useState([]);
  const [allCurrencies, setAllCurrencies] = useState([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedItems, setSelectedItems] = useState({
    USD: true,
    IR_COIN_EMAMI: true,
    BTC: true
  });
  const [itemCount, setItemCount] = useState(3);

  useEffect(() => {
    loadSettings();
    fetchCurrencies();
    const interval = setInterval(fetchCurrencies, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (allCurrencies.length > 0) {
      updateQuickStats();
    }
  }, [allCurrencies, selectedItems, itemCount]);

  const loadSettings = () => {
    const savedSettings = localStorage.getItem('sidebarQuickStats');
    if (savedSettings) {
      const settings = JSON.parse(savedSettings);
      setSelectedItems(settings.selectedItems || { USD: true, IR_COIN_EMAMI: true, BTC: true });
      setItemCount(settings.itemCount || 3);
    }
  };

  const saveSettings = (newSelectedItems, newItemCount) => {
    const settings = { selectedItems: newSelectedItems, itemCount: newItemCount };
    localStorage.setItem('sidebarQuickStats', JSON.stringify(settings));
    setSelectedItems(newSelectedItems);
    setItemCount(newItemCount);
  };

  const fetchCurrencies = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/v2/currencies?limit=50');
      if (response.ok) {
        const data = await response.json();
        setAllCurrencies(data);
      }
    } catch (error) {
      console.error('Error fetching currencies:', error);
    }
  };

  const updateQuickStats = () => {
    const filtered = allCurrencies
      .filter(currency => selectedItems[currency.currency_code])
      .slice(0, itemCount)
      .map(currency => ({
        code: currency.currency_code,
        name: getShortName(currency.currency_name, currency.currency_code),
        price: currency.price_irr,
        change: currency.change_percent_24h
      }));
    setQuickStats(filtered);
  };

  const getShortName = (name, code) => {
    if (code === 'USD') return 'USD/IRR';
    if (code === 'EUR') return 'EUR/IRR';
    if (code === 'BTC') return 'BTC';
    if (code === 'ETH') return 'ETH';
    if (name.includes('سکه امامی')) return 'سکه امامی';
    if (name.includes('طلا') && name.includes('18')) return 'طلا 18';
    if (name.includes('طلا')) return 'طلا';
    return name.length > 10 ? name.substring(0, 10) + '...' : name;
  };

  const formatPrice = (price) => {
    if (!price && price !== 0) return '0';
    return new Intl.NumberFormat('en-US').format(Math.round(price));
  };

  const formatPercent = (percent) => {
    if (!percent && percent !== 0) return '0%';
    const sign = percent >= 0 ? '+' : '';
    return `${sign}${percent.toFixed(1)}%`;
  };

  const getChangeColor = (change) => {
    return change >= 0 ? 'success.main' : 'error.main';
  };

  const handleItemClick = (path) => {
    navigate(path);
  };

  const drawerContent = (
    <Box sx={{ width: DRAWER_WIDTH, height: '100%', bgcolor: 'background.paper' }} data-testid="sidebar">
      {/* Header spacer */}
      <Box sx={{ height: 64 }} />
      
      {/* Navigation */}
      <List sx={{ px: 1 }}>
        {menuItems.map((item) => (
          <ListItem key={item.text} disablePadding>
            <ListItemButton
              selected={location.pathname === item.path}
              onClick={() => handleItemClick(item.path)}
              sx={{
                borderRadius: 2,
                mb: 0.5,
                '&.Mui-selected': {
                  bgcolor: 'primary.main',
                  color: 'primary.contrastText',
                  '&:hover': {
                    bgcolor: 'primary.dark',
                  },
                  '& .MuiListItemIcon-root': {
                    color: 'primary.contrastText',
                  }
                },
                '&:hover': {
                  bgcolor: 'action.hover',
                }
              }}
            >
              <ListItemIcon
                sx={{
                  minWidth: 40,
                  color: location.pathname === item.path ? 'inherit' : 'text.secondary'
                }}
              >
                {item.icon}
              </ListItemIcon>
              <ListItemText 
                primary={item.text}
                primaryTypographyProps={{
                  fontSize: '14px',
                  fontWeight: location.pathname === item.path ? 600 : 400
                }}
              />
            </ListItemButton>
          </ListItem>
        ))}
      </List>

      <Divider sx={{ mx: 2, my: 2 }} />

      {/* Market Status */}
      <Box sx={{ px: 2, py: 1 }}>
        <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
          MARKET STATUS
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <Box 
            sx={{ 
              width: 8, 
              height: 8, 
              borderRadius: '50%', 
              bgcolor: 'success.main',
              animation: 'pulse 2s infinite'
            }} 
          />
          <Typography variant="body2" fontWeight="bold">
            Tehran Stock Exchange
          </Typography>
        </Box>
        <Typography variant="caption" color="text.secondary">
          Open • 09:00 - 15:30
        </Typography>
      </Box>

      <Divider sx={{ mx: 2, my: 2 }} />

      {/* Quick Stats */}
      <Box sx={{ px: 2, py: 1 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="caption" color="text.secondary">
            QUICK STATS
          </Typography>
          <IconButton size="small" onClick={() => setSettingsOpen(true)}>
            <SettingsIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
          </IconButton>
        </Box>
        
        {quickStats.map((stat, index) => (
          <Box key={stat.code} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: index === quickStats.length - 1 ? 0 : 1 }}>
            <Typography variant="body2">{stat.name}</Typography>
            <Box sx={{ textAlign: 'right' }}>
              <Typography variant="body2" fontWeight="bold" color={getChangeColor(stat.change)}>
                {formatPrice(stat.price)}
              </Typography>
              <Typography variant="caption" color={getChangeColor(stat.change)}>
                {formatPercent(stat.change)}
              </Typography>
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );

  return (
    <>
      <Drawer
        variant="persistent"
        anchor="left"
        open={open}
        sx={{
          width: open ? DRAWER_WIDTH : 0,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: DRAWER_WIDTH,
            boxSizing: 'border-box',
            borderRight: 1,
            borderColor: 'divider',
            bgcolor: 'background.paper'
          },
        }}
      >
        {drawerContent}
      </Drawer>

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
          تنظیمات QUICK STATS
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mb: 3 }}>
            <Typography variant="body2" sx={{ color: '#8B949E', mb: 2 }}>
              تعداد آیتم‌های نمایشی:
            </Typography>
            <Slider
              value={itemCount}
              onChange={(e, newValue) => setItemCount(newValue)}
              min={1}
              max={10}
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
            ارزهای نمایشی را انتخاب کنید:
          </Typography>
          <Box sx={{ maxHeight: 300, overflow: 'auto' }}>
            {allCurrencies.slice(0, 20).map((currency) => (
              <FormControlLabel
                key={currency.currency_code}
                control={
                  <Checkbox
                    checked={selectedItems[currency.currency_code] || false}
                    onChange={(e) => {
                      setSelectedItems(prev => ({
                        ...prev,
                        [currency.currency_code]: e.target.checked
                      }));
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
                  <Typography sx={{ color: '#F0F6FC', fontSize: '0.9rem' }}>
                    {getShortName(currency.currency_name, currency.currency_code)} ({currency.currency_code})
                  </Typography>
                }
                sx={{ display: 'block', mb: 0.5 }}
              />
            ))}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => {
              saveSettings(selectedItems, itemCount);
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
    </>
  );
};

export default Sidebar;