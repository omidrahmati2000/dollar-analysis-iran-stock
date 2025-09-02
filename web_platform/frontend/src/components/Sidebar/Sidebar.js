import React from 'react';
import {
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Box,
  Typography,
  Divider
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
  Notifications as AlertsIcon
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';

const DRAWER_WIDTH = 240;

const menuItems = [
  { text: 'Dashboard', icon: <DashboardIcon />, path: '/dashboard' },
  { text: 'Charts', icon: <ChartsIcon />, path: '/charts' },
  { text: 'Screener', icon: <ScreenerIcon />, path: '/screener' },
  { text: 'Portfolio', icon: <PortfolioIcon />, path: '/portfolio' },
  { text: 'Watchlist', icon: <WatchlistIcon />, path: '/watchlist' },
  { text: 'Alerts', icon: <AlertsIcon />, path: '/alerts' },
];

const Sidebar = ({ open, onClose }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const handleItemClick = (path) => {
    navigate(path);
  };

  const drawerContent = (
    <Box sx={{ width: DRAWER_WIDTH, height: '100%', bgcolor: 'background.paper' }}>
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
        <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
          QUICK STATS
        </Typography>
        
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="body2">USD/IRR</Typography>
          <Box sx={{ textAlign: 'right' }}>
            <Typography variant="body2" fontWeight="bold" color="error.main">
              42,500
            </Typography>
            <Typography variant="caption" color="error.main">
              -1.2%
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="body2">Gold</Typography>
          <Box sx={{ textAlign: 'right' }}>
            <Typography variant="body2" fontWeight="bold" color="success.main">
              2,180,000
            </Typography>
            <Typography variant="caption" color="success.main">
              +0.8%
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="body2">TEDPIX</Typography>
          <Box sx={{ textAlign: 'right' }}>
            <Typography variant="body2" fontWeight="bold" color="success.main">
              2,145,789
            </Typography>
            <Typography variant="caption" color="success.main">
              +0.3%
            </Typography>
          </Box>
        </Box>
      </Box>
    </Box>
  );

  return (
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
  );
};

export default Sidebar;