import React, { useState } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Box,
  TextField,
  Autocomplete,
  Chip,
  Avatar,
  Menu,
  MenuItem,
  Divider,
  Badge
} from '@mui/material';
import {
  Menu as MenuIcon,
  Search as SearchIcon,
  Notifications as NotificationsIcon,
  AccountCircle as AccountCircleIcon,
  TrendingUp as TrendingUpIcon,
  Settings as SettingsIcon,
  Logout as LogoutIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../services/auth';
import { useQuery } from 'react-query';
import { apiService } from '../../services/api';

const Header = ({ onMenuClick }) => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [anchorEl, setAnchorEl] = useState(null);
  const [searchValue, setSearchValue] = useState('');

  // Search symbols
  const { data: searchResults = [] } = useQuery(
    ['search', searchValue],
    () => apiService.searchSymbols(searchValue),
    {
      enabled: searchValue.length > 1,
      debounceTime: 300
    }
  );

  const handleUserMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleUserMenuClose = () => {
    setAnchorEl(null);
  };

  const handleSymbolSelect = (symbol) => {
    if (symbol) {
      navigate(`/charts/${symbol.symbol}`);
      setSearchValue('');
    }
  };

  const handleLogout = () => {
    logout();
    handleUserMenuClose();
  };

  return (
    <AppBar 
      position="fixed" 
      sx={{ 
        zIndex: (theme) => theme.zIndex.drawer + 1,
        bgcolor: 'background.paper',
        borderBottom: 1,
        borderColor: 'divider',
        boxShadow: 'none'
      }}
    >
      <Toolbar sx={{ gap: 2 }}>
        {/* Menu Button */}
        <IconButton
          color="inherit"
          onClick={onMenuClick}
          edge="start"
        >
          <MenuIcon />
        </IconButton>

        {/* Logo */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <TrendingUpIcon color="primary" />
          <Typography 
            variant="h6" 
            component="div" 
            sx={{ 
              fontWeight: 'bold',
              background: 'linear-gradient(45deg, #2196F3 30%, #21CBF3 90%)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Iran Market Pro
          </Typography>
        </Box>

        {/* Search */}
        <Box sx={{ flexGrow: 1, maxWidth: 400, mx: 2 }}>
          <Autocomplete
            freeSolo
            options={searchResults}
            getOptionLabel={(option) => 
              typeof option === 'string' ? option : `${option.symbol} - ${option.name}`
            }
            renderOption={(props, option) => (
              <Box component="li" {...props} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Chip 
                  label={option.asset_type} 
                  size="small" 
                  color={option.asset_type === 'stock' ? 'primary' : 'secondary'}
                />
                <Box>
                  <Typography variant="body2" fontWeight="bold">
                    {option.symbol}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {option.name}
                  </Typography>
                </Box>
              </Box>
            )}
            renderInput={(params) => (
              <TextField
                {...params}
                placeholder="Search stocks, currencies..."
                variant="outlined"
                size="small"
                sx={{ 
                  '& .MuiOutlinedInput-root': {
                    bgcolor: 'background.default',
                  }
                }}
                InputProps={{
                  ...params.InputProps,
                  startAdornment: <SearchIcon sx={{ color: 'text.secondary', mr: 1 }} />
                }}
              />
            )}
            onInputChange={(event, newInputValue) => {
              setSearchValue(newInputValue);
            }}
            onChange={(event, value) => {
              handleSymbolSelect(value);
            }}
          />
        </Box>

        {/* Market Status */}
        <Chip 
          label="Market Open"
          color="success"
          size="small"
          sx={{ fontWeight: 'bold' }}
        />

        {/* Notifications */}
        <IconButton color="inherit">
          <Badge badgeContent={3} color="error">
            <NotificationsIcon />
          </Badge>
        </IconButton>

        {/* User Menu */}
        <IconButton 
          color="inherit"
          onClick={handleUserMenuOpen}
        >
          <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main' }}>
            {user?.full_name?.charAt(0) || user?.username?.charAt(0) || 'U'}
          </Avatar>
        </IconButton>

        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleUserMenuClose}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          PaperProps={{
            sx: { 
              width: 220,
              bgcolor: 'background.paper',
              border: 1,
              borderColor: 'divider'
            }
          }}
        >
          <Box sx={{ px: 2, py: 1 }}>
            <Typography variant="subtitle2" fontWeight="bold">
              {user?.full_name || user?.username}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {user?.email}
            </Typography>
            {user?.is_premium && (
              <Chip label="PRO" size="small" color="primary" sx={{ mt: 0.5 }} />
            )}
          </Box>
          <Divider />
          
          <MenuItem onClick={() => { navigate('/portfolio'); handleUserMenuClose(); }}>
            <TrendingUpIcon sx={{ mr: 2 }} />
            Portfolio
          </MenuItem>
          <MenuItem onClick={() => { navigate('/settings'); handleUserMenuClose(); }}>
            <SettingsIcon sx={{ mr: 2 }} />
            Settings
          </MenuItem>
          <Divider />
          <MenuItem onClick={handleLogout}>
            <LogoutIcon sx={{ mr: 2 }} />
            Logout
          </MenuItem>
        </Menu>
      </Toolbar>
    </AppBar>
  );
};

export default Header;