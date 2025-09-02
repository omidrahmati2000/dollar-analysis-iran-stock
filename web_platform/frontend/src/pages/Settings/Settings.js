import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Switch,
  FormControlLabel,
  FormGroup,
  Divider,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  TextField,
  Alert,
  Snackbar,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip
} from '@mui/material';
import {
  Settings as SettingsIcon,
  Palette as PaletteIcon,
  Notifications as NotificationsIcon,
  Security as SecurityIcon,
  Storage as StorageIcon,
  Download as DownloadIcon,
  Upload as UploadIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import localStorageManager from '../../services/storage/LocalStorageManager';

const Settings = () => {
  const [settings, setSettings] = useState({
    theme: 'dark',
    autoRefresh: true,
    refreshInterval: 30,
    soundEnabled: false,
    notifications: true,
    priceAlerts: true,
    volumeAlerts: false,
    newsAlerts: true,
    defaultTimeframe: '1d',
    defaultChartType: 'candlestick',
    showVolume: true,
    enableIndicators: true,
    language: 'en'
  });
  
  const [storageStats, setStorageStats] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [clearDataDialog, setClearDataDialog] = useState(false);

  useEffect(() => {
    loadSettings();
    loadStorageStats();
  }, []);

  const loadSettings = () => {
    const savedSettings = localStorageManager.getNestedData('storage', 'user.settings', {});
    setSettings(prevSettings => ({ ...prevSettings, ...savedSettings }));
  };

  const loadStorageStats = () => {
    const stats = localStorageManager.getStorageStats();
    setStorageStats(stats);
  };

  const saveSettings = (newSettings) => {
    localStorageManager.updateData('storage', 'user.settings', newSettings);
    setSettings(newSettings);
    showSnackbar('Settings saved successfully!', 'success');
  };

  const handleSettingChange = (key, value) => {
    const newSettings = { ...settings, [key]: value };
    saveSettings(newSettings);
  };

  const showSnackbar = (message, severity = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleExportData = () => {
    try {
      const exportData = localStorageManager.exportData();
      const dataStr = JSON.stringify(exportData, null, 2);
      const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
      
      const exportFileDefaultName = `iran-market-backup-${new Date().toISOString().slice(0,10)}.json`;
      
      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();
      
      showSnackbar('Data exported successfully!', 'success');
    } catch (error) {
      console.error('Export failed:', error);
      showSnackbar('Export failed: ' + error.message, 'error');
    }
  };

  const handleImportData = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importData = JSON.parse(e.target.result);
        const result = localStorageManager.importData(importData, false);
        
        if (result.success) {
          showSnackbar(`Import successful: ${result.imported} items imported, ${result.skipped} skipped`, 'success');
          loadSettings();
          loadStorageStats();
        } else {
          showSnackbar('Import failed: ' + result.error, 'error');
        }
      } catch (error) {
        showSnackbar('Import failed: Invalid file format', 'error');
      }
    };
    reader.readAsText(file);
    
    // Reset input
    event.target.value = '';
  };

  const handleClearAllData = () => {
    const clearedCount = localStorageManager.clearAll();
    showSnackbar(`Cleared ${clearedCount} items. Application will reload.`, 'success');
    setClearDataDialog(false);
    
    // Reload page after a short delay
    setTimeout(() => {
      window.location.reload();
    }, 2000);
  };

  const handleCleanupExpired = () => {
    const cleanedCount = localStorageManager.cleanupExpiredItems();
    showSnackbar(`Cleaned up ${cleanedCount} expired items`, 'success');
    loadStorageStats();
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <SettingsIcon color="primary" />
        <Typography variant="h4">Settings</Typography>
      </Box>

      <Grid container spacing={3}>
        {/* Display Settings */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <PaletteIcon color="primary" />
                <Typography variant="h6">Display Settings</Typography>
              </Box>
              
              <FormGroup>
                <FormControl size="small" sx={{ mb: 2 }}>
                  <InputLabel>Theme</InputLabel>
                  <Select
                    value={settings.theme}
                    onChange={(e) => handleSettingChange('theme', e.target.value)}
                    label="Theme"
                  >
                    <MenuItem value="dark">Dark Theme</MenuItem>
                    <MenuItem value="light">Light Theme</MenuItem>
                    <MenuItem value="auto">Auto (System)</MenuItem>
                  </Select>
                </FormControl>

                <FormControl size="small" sx={{ mb: 2 }}>
                  <InputLabel>Default Chart Type</InputLabel>
                  <Select
                    value={settings.defaultChartType}
                    onChange={(e) => handleSettingChange('defaultChartType', e.target.value)}
                    label="Default Chart Type"
                  >
                    <MenuItem value="candlestick">Candlestick</MenuItem>
                    <MenuItem value="line">Line</MenuItem>
                    <MenuItem value="area">Area</MenuItem>
                    <MenuItem value="heikin_ashi">Heikin Ashi</MenuItem>
                  </Select>
                </FormControl>

                <FormControl size="small" sx={{ mb: 2 }}>
                  <InputLabel>Default Timeframe</InputLabel>
                  <Select
                    value={settings.defaultTimeframe}
                    onChange={(e) => handleSettingChange('defaultTimeframe', e.target.value)}
                    label="Default Timeframe"
                  >
                    <MenuItem value="1m">1 Minute</MenuItem>
                    <MenuItem value="5m">5 Minutes</MenuItem>
                    <MenuItem value="15m">15 Minutes</MenuItem>
                    <MenuItem value="1h">1 Hour</MenuItem>
                    <MenuItem value="1d">1 Day</MenuItem>
                    <MenuItem value="1w">1 Week</MenuItem>
                  </Select>
                </FormControl>

                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.showVolume}
                      onChange={(e) => handleSettingChange('showVolume', e.target.checked)}
                    />
                  }
                  label="Show Volume by Default"
                />

                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.enableIndicators}
                      onChange={(e) => handleSettingChange('enableIndicators', e.target.checked)}
                    />
                  }
                  label="Enable Technical Indicators"
                />
              </FormGroup>
            </CardContent>
          </Card>
        </Grid>

        {/* Data & Refresh Settings */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <RefreshIcon color="primary" />
                <Typography variant="h6">Data & Refresh</Typography>
              </Box>

              <FormGroup>
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.autoRefresh}
                      onChange={(e) => handleSettingChange('autoRefresh', e.target.checked)}
                    />
                  }
                  label="Auto Refresh Data"
                />

                <TextField
                  size="small"
                  label="Refresh Interval (seconds)"
                  type="number"
                  value={settings.refreshInterval}
                  onChange={(e) => handleSettingChange('refreshInterval', parseInt(e.target.value))}
                  disabled={!settings.autoRefresh}
                  inputProps={{ min: 5, max: 300 }}
                  sx={{ mb: 2, mt: 1 }}
                />

                <FormControl size="small" sx={{ mb: 2 }}>
                  <InputLabel>Language</InputLabel>
                  <Select
                    value={settings.language}
                    onChange={(e) => handleSettingChange('language', e.target.value)}
                    label="Language"
                  >
                    <MenuItem value="en">English</MenuItem>
                    <MenuItem value="fa">فارسی (Persian)</MenuItem>
                  </Select>
                </FormControl>
              </FormGroup>
            </CardContent>
          </Card>
        </Grid>

        {/* Notifications */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <NotificationsIcon color="primary" />
                <Typography variant="h6">Notifications</Typography>
              </Box>

              <FormGroup>
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.notifications}
                      onChange={(e) => handleSettingChange('notifications', e.target.checked)}
                    />
                  }
                  label="Enable Notifications"
                />

                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.priceAlerts}
                      onChange={(e) => handleSettingChange('priceAlerts', e.target.checked)}
                      disabled={!settings.notifications}
                    />
                  }
                  label="Price Alerts"
                />

                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.volumeAlerts}
                      onChange={(e) => handleSettingChange('volumeAlerts', e.target.checked)}
                      disabled={!settings.notifications}
                    />
                  }
                  label="Volume Alerts"
                />

                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.newsAlerts}
                      onChange={(e) => handleSettingChange('newsAlerts', e.target.checked)}
                      disabled={!settings.notifications}
                    />
                  }
                  label="News Alerts"
                />

                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.soundEnabled}
                      onChange={(e) => handleSettingChange('soundEnabled', e.target.checked)}
                      disabled={!settings.notifications}
                    />
                  }
                  label="Sound Notifications"
                />
              </FormGroup>
            </CardContent>
          </Card>
        </Grid>

        {/* Storage Management */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <StorageIcon color="primary" />
                <Typography variant="h6">Storage Management</Typography>
              </Box>

              {storageStats && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Storage Usage: {storageStats.usagePercent} ({storageStats.totalSizeFormatted})
                  </Typography>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Items: {storageStats.itemCount} | Available: {storageStats.availableFormatted}
                  </Typography>
                </Box>
              )}

              <List dense>
                <ListItem>
                  <ListItemText primary="Export Data" secondary="Download all your data as backup" />
                  <ListItemSecondaryAction>
                    <IconButton onClick={handleExportData} edge="end">
                      <DownloadIcon />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>

                <ListItem>
                  <ListItemText primary="Import Data" secondary="Restore data from backup file" />
                  <ListItemSecondaryAction>
                    <input
                      accept=".json"
                      style={{ display: 'none' }}
                      id="import-data-input"
                      type="file"
                      onChange={handleImportData}
                    />
                    <label htmlFor="import-data-input">
                      <IconButton component="span" edge="end">
                        <UploadIcon />
                      </IconButton>
                    </label>
                  </ListItemSecondaryAction>
                </ListItem>

                <ListItem>
                  <ListItemText primary="Cleanup Expired" secondary="Remove expired cache items" />
                  <ListItemSecondaryAction>
                    <IconButton onClick={handleCleanupExpired} edge="end">
                      <RefreshIcon />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>

                <ListItem>
                  <ListItemText 
                    primary="Clear All Data" 
                    secondary="Reset application to default state"
                  />
                  <ListItemSecondaryAction>
                    <IconButton 
                      onClick={() => setClearDataDialog(true)} 
                      edge="end" 
                      color="error"
                    >
                      <DeleteIcon />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* Application Info */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <SecurityIcon color="primary" />
                <Typography variant="h6">Application Information</Typography>
              </Box>

              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    <strong>Version:</strong> 2.0.0
                  </Typography>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    <strong>Build:</strong> Production
                  </Typography>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    <strong>API Status:</strong> <Chip label="Connected" color="success" size="small" />
                  </Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    <strong>Last Updated:</strong> {new Date().toLocaleString()}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    <strong>Storage Version:</strong> {localStorageManager.version}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    <strong>Features:</strong> Charts, Portfolio, Watchlist, Screener
                  </Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Clear Data Confirmation Dialog */}
      <Dialog open={clearDataDialog} onClose={() => setClearDataDialog(false)}>
        <DialogTitle>Clear All Data?</DialogTitle>
        <DialogContent>
          <Typography>
            This will permanently delete all your data including portfolio positions, watchlists, 
            settings, and cached data. This action cannot be undone.
          </Typography>
          <Alert severity="warning" sx={{ mt: 2 }}>
            Consider exporting your data first as a backup.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setClearDataDialog(false)}>Cancel</Button>
          <Button onClick={handleClearAllData} color="error" variant="contained">
            Clear All Data
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
      >
        <Alert 
          onClose={() => setSnackbar(prev => ({ ...prev, open: false }))} 
          severity={snackbar.severity}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default Settings;