/**
 * Chart Sharing & Save - اشتراک‌گذاری و ذخیره نمودار
 * Save chart layouts, settings, and share with others
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Card,
  CardContent,
  CardActions,
  Grid,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Tooltip,
  Alert,
  Snackbar,
  Menu,
  MenuItem as MenuItemComponent,
  Divider,
  Avatar,
  Tab,
  Tabs
} from '@mui/material';
import {
  Save,
  Share,
  CloudDownload,
  CloudUpload,
  Delete,
  Edit,
  Copy,
  Public,
  Lock,
  Star,
  StarBorder,
  MoreVert,
  Timeline,
  ShowChart,
  Palette,
  Settings,
  QrCode,
  Link as LinkIcon
} from '@mui/icons-material';
import localStorageManager from '../../services/storage/LocalStorageManager';

const PRIVACY_LEVELS = {
  PRIVATE: 'private',
  PUBLIC: 'public',
  UNLISTED: 'unlisted'
};

const CHART_CATEGORIES = {
  ANALYSIS: 'analysis',
  STRATEGY: 'strategy',
  EDUCATION: 'educational',
  TEMPLATE: 'template',
  OTHER: 'other'
};

const ChartSharing = ({ 
  currentChart,
  onLoadChart,
  onSaveChart,
  theme = 'dark'
}) => {
  const [activeTab, setActiveTab] = useState(0);
  const [savedCharts, setSavedCharts] = useState([]);
  const [sharedCharts, setSharedCharts] = useState([]);
  const [favoriteCharts, setFavoriteCharts] = useState([]);
  
  const [saveDialog, setSaveDialog] = useState(false);
  const [shareDialog, setShareDialog] = useState(false);
  const [chartToShare, setChartToShare] = useState(null);
  
  const [chartName, setChartName] = useState('');
  const [chartDescription, setChartDescription] = useState('');
  const [chartCategory, setChartCategory] = useState(CHART_CATEGORIES.ANALYSIS);
  const [privacyLevel, setPrivacyLevel] = useState(PRIVACY_LEVELS.PRIVATE);
  const [includeTechnicals, setIncludeTechnicals] = useState(true);
  const [includeDrawings, setIncludeDrawings] = useState(true);
  const [includeSettings, setIncludeSettings] = useState(true);
  
  const [shareUrl, setShareUrl] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [selectedChart, setSelectedChart] = useState(null);

  useEffect(() => {
    loadSavedCharts();
    loadSharedCharts();
    loadFavorites();
  }, []);

  const loadSavedCharts = () => {
    const charts = localStorageManager.getNestedData('charts', 'saved', []);
    setSavedCharts(charts);
  };

  const loadSharedCharts = () => {
    const charts = localStorageManager.getNestedData('charts', 'shared', []);
    setSharedCharts(charts);
  };

  const loadFavorites = () => {
    const favorites = localStorageManager.getNestedData('charts', 'favorites', []);
    setFavoriteCharts(favorites);
  };

  const openSaveDialog = () => {
    if (!currentChart) {
      showSnackbar('No chart data to save', 'error');
      return;
    }
    
    setChartName('');
    setChartDescription('');
    setChartCategory(CHART_CATEGORIES.ANALYSIS);
    setSaveDialog(true);
  };

  const saveChart = () => {
    if (!chartName.trim()) {
      showSnackbar('Please enter a chart name', 'error');
      return;
    }

    const chartData = {
      id: Date.now().toString(),
      name: chartName.trim(),
      description: chartDescription.trim(),
      category: chartCategory,
      privacy: PRIVACY_LEVELS.PRIVATE,
      
      // Chart data
      symbol: currentChart.symbol,
      timeframe: currentChart.timeframe,
      chartType: currentChart.chartType,
      
      // Optional includes
      technicalIndicators: includeTechnicals ? currentChart.technicalIndicators : [],
      drawings: includeDrawings ? currentChart.drawings : [],
      settings: includeSettings ? currentChart.settings : {},
      
      // Metadata
      createdAt: Date.now(),
      updatedAt: Date.now(),
      views: 0,
      favorites: 0,
      author: 'User',
      version: '1.0.0',
      
      // Preview data (last 50 candles for thumbnail)
      previewData: currentChart.data?.slice(-50) || []
    };

    const updatedCharts = [...savedCharts, chartData];
    setSavedCharts(updatedCharts);
    localStorageManager.updateData('charts', 'saved', updatedCharts);
    
    setSaveDialog(false);
    showSnackbar(`Chart "${chartData.name}" saved successfully`, 'success');
    
    if (onSaveChart) {
      onSaveChart(chartData);
    }
  };

  const loadChart = (chart) => {
    if (onLoadChart) {
      onLoadChart(chart);
    }
    
    // Update view count
    const updatedChart = { ...chart, views: (chart.views || 0) + 1 };
    updateChartInStorage(updatedChart);
    
    showSnackbar(`Chart "${chart.name}" loaded`, 'success');
  };

  const updateChartInStorage = (updatedChart) => {
    // Update in saved charts if exists
    const savedIndex = savedCharts.findIndex(c => c.id === updatedChart.id);
    if (savedIndex !== -1) {
      const newSavedCharts = [...savedCharts];
      newSavedCharts[savedIndex] = updatedChart;
      setSavedCharts(newSavedCharts);
      localStorageManager.updateData('charts', 'saved', newSavedCharts);
    }

    // Update in shared charts if exists
    const sharedIndex = sharedCharts.findIndex(c => c.id === updatedChart.id);
    if (sharedIndex !== -1) {
      const newSharedCharts = [...sharedCharts];
      newSharedCharts[sharedIndex] = updatedChart;
      setSharedCharts(newSharedCharts);
      localStorageManager.updateData('charts', 'shared', newSharedCharts);
    }
  };

  const deleteChart = (chartId) => {
    const updatedSaved = savedCharts.filter(c => c.id !== chartId);
    setSavedCharts(updatedSaved);
    localStorageManager.updateData('charts', 'saved', updatedSaved);
    
    // Also remove from favorites
    const updatedFavorites = favoriteCharts.filter(id => id !== chartId);
    setFavoriteCharts(updatedFavorites);
    localStorageManager.updateData('charts', 'favorites', updatedFavorites);
    
    showSnackbar('Chart deleted', 'success');
  };

  const openShareDialog = (chart) => {
    setChartToShare(chart);
    setPrivacyLevel(chart.privacy || PRIVACY_LEVELS.PRIVATE);
    generateShareUrl(chart);
    setShareDialog(true);
  };

  const generateShareUrl = (chart) => {
    const shareData = {
      id: chart.id,
      name: chart.name,
      symbol: chart.symbol,
      timeframe: chart.timeframe,
      chartType: chart.chartType,
      technicalIndicators: chart.technicalIndicators || [],
      drawings: chart.drawings || [],
      settings: chart.settings || {}
    };

    const encodedData = btoa(JSON.stringify(shareData));
    const baseUrl = window.location.origin;
    const url = `${baseUrl}/chart?share=${encodedData}`;
    
    setShareUrl(url);
    generateQRCode(url);
  };

  const generateQRCode = (url) => {
    // In a real implementation, you would use a QR code library
    // For now, we'll use a placeholder QR code service
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}`;
    setQrCode(qrUrl);
  };

  const shareChart = () => {
    if (!chartToShare) return;

    const updatedChart = {
      ...chartToShare,
      privacy: privacyLevel,
      sharedAt: Date.now()
    };

    // Add to shared charts if not already there
    const sharedIndex = sharedCharts.findIndex(c => c.id === chartToShare.id);
    let updatedShared;
    
    if (sharedIndex !== -1) {
      updatedShared = [...sharedCharts];
      updatedShared[sharedIndex] = updatedChart;
    } else {
      updatedShared = [...sharedCharts, updatedChart];
    }

    setSharedCharts(updatedShared);
    localStorageManager.updateData('charts', 'shared', updatedShared);
    
    // Update in saved charts too
    updateChartInStorage(updatedChart);
    
    setShareDialog(false);
    showSnackbar('Chart sharing settings updated', 'success');
  };

  const copyShareUrl = () => {
    navigator.clipboard.writeText(shareUrl);
    showSnackbar('Share URL copied to clipboard', 'success');
  };

  const toggleFavorite = (chartId) => {
    const isFavorite = favoriteCharts.includes(chartId);
    let updatedFavorites;
    
    if (isFavorite) {
      updatedFavorites = favoriteCharts.filter(id => id !== chartId);
    } else {
      updatedFavorites = [...favoriteCharts, chartId];
    }
    
    setFavoriteCharts(updatedFavorites);
    localStorageManager.updateData('charts', 'favorites', updatedFavorites);
    
    showSnackbar(isFavorite ? 'Removed from favorites' : 'Added to favorites', 'success');
  };

  const exportChart = (chart) => {
    const exportData = {
      ...chart,
      exportedAt: Date.now(),
      version: '1.0.0'
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json'
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${chart.name.replace(/\s+/g, '_')}.json`;
    link.click();

    URL.revokeObjectURL(url);
    showSnackbar('Chart exported successfully', 'success');
  };

  const importChart = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const chartData = JSON.parse(e.target.result);
        
        // Generate new ID and update metadata
        const importedChart = {
          ...chartData,
          id: Date.now().toString(),
          createdAt: Date.now(),
          updatedAt: Date.now(),
          author: 'Imported',
          views: 0,
          favorites: 0
        };

        const updatedCharts = [...savedCharts, importedChart];
        setSavedCharts(updatedCharts);
        localStorageManager.updateData('charts', 'saved', updatedCharts);
        
        showSnackbar('Chart imported successfully', 'success');
      } catch (error) {
        showSnackbar('Invalid chart file format', 'error');
      }
    };
    reader.readAsText(file);
  };

  const showSnackbar = (message, severity = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleMenuOpen = (event, chart) => {
    setMenuAnchor(event.currentTarget);
    setSelectedChart(chart);
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
    setSelectedChart(null);
  };

  const getCategoryIcon = (category) => {
    switch (category) {
      case CHART_CATEGORIES.STRATEGY:
        return <Timeline />;
      case CHART_CATEGORIES.EDUCATION:
        return <ShowChart />;
      default:
        return <Palette />;
    }
  };

  const getPrivacyIcon = (privacy) => {
    switch (privacy) {
      case PRIVACY_LEVELS.PUBLIC:
        return <Public />;
      case PRIVACY_LEVELS.UNLISTED:
        return <LinkIcon />;
      default:
        return <Lock />;
    }
  };

  const renderChartCard = (chart, showAuthor = false) => (
    <Grid item xs={12} sm={6} md={4} key={chart.id}>
      <Card variant="outlined" sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <CardContent sx={{ flexGrow: 1 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
            <Typography variant="h6" gutterBottom sx={{ fontSize: '1rem' }}>
              {chart.name}
            </Typography>
            <Box>
              <IconButton
                size="small"
                onClick={() => toggleFavorite(chart.id)}
              >
                {favoriteCharts.includes(chart.id) ? <Star color="primary" /> : <StarBorder />}
              </IconButton>
              <IconButton
                size="small"
                onClick={(e) => handleMenuOpen(e, chart)}
              >
                <MoreVert />
              </IconButton>
            </Box>
          </Box>
          
          <Typography variant="body2" color="text.secondary" gutterBottom>
            {chart.description || 'No description'}
          </Typography>
          
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
            <Chip
              icon={getCategoryIcon(chart.category)}
              label={chart.category}
              size="small"
              variant="outlined"
            />
            <Chip
              icon={getPrivacyIcon(chart.privacy)}
              label={chart.privacy || 'private'}
              size="small"
            />
          </Box>
          
          <Typography variant="caption" display="block" gutterBottom>
            Symbol: {chart.symbol} | Timeframe: {chart.timeframe}
          </Typography>
          
          <Typography variant="caption" display="block" gutterBottom>
            Indicators: {chart.technicalIndicators?.length || 0} | 
            Drawings: {chart.drawings?.length || 0}
          </Typography>
          
          {showAuthor && (
            <Typography variant="caption" display="block" gutterBottom>
              By: {chart.author} | Views: {chart.views || 0}
            </Typography>
          )}
          
          <Typography variant="caption" color="text.secondary">
            {new Date(chart.createdAt).toLocaleDateString()}
          </Typography>
        </CardContent>
        
        <CardActions>
          <Button size="small" onClick={() => loadChart(chart)}>
            Load
          </Button>
          <Button size="small" onClick={() => openShareDialog(chart)}>
            Share
          </Button>
        </CardActions>
      </Card>
    </Grid>
  );

  return (
    <Box>
      <Paper elevation={1}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 2 }}>
          <Typography variant="h6">
            Chart Library
          </Typography>
          
          <Box>
            <input
              accept=".json"
              style={{ display: 'none' }}
              id="import-chart"
              type="file"
              onChange={importChart}
            />
            <label htmlFor="import-chart">
              <Button component="span" startIcon={<CloudUpload />} size="small">
                Import
              </Button>
            </label>
            
            <Button
              onClick={openSaveDialog}
              variant="contained"
              size="small"
              startIcon={<Save />}
              sx={{ ml: 1 }}
            >
              Save Current
            </Button>
          </Box>
        </Box>

        <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)}>
          <Tab label={`My Charts (${savedCharts.length})`} />
          <Tab label={`Shared (${sharedCharts.length})`} />
          <Tab label={`Favorites (${favoriteCharts.length})`} />
        </Tabs>

        <Box sx={{ p: 2 }}>
          {/* My Charts Tab */}
          {activeTab === 0 && (
            <Grid container spacing={2}>
              {savedCharts.map((chart) => renderChartCard(chart))}
              {savedCharts.length === 0 && (
                <Grid item xs={12}>
                  <Box sx={{ textAlign: 'center', py: 4 }}>
                    <Typography variant="h6" color="text.secondary" gutterBottom>
                      No saved charts yet
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Save your first chart to get started
                    </Typography>
                    <Button
                      onClick={openSaveDialog}
                      variant="contained"
                      sx={{ mt: 2 }}
                      startIcon={<Save />}
                    >
                      Save Current Chart
                    </Button>
                  </Box>
                </Grid>
              )}
            </Grid>
          )}

          {/* Shared Charts Tab */}
          {activeTab === 1 && (
            <Grid container spacing={2}>
              {sharedCharts.map((chart) => renderChartCard(chart, true))}
              {sharedCharts.length === 0 && (
                <Grid item xs={12}>
                  <Box sx={{ textAlign: 'center', py: 4 }}>
                    <Typography variant="h6" color="text.secondary" gutterBottom>
                      No shared charts yet
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Share your charts with the community
                    </Typography>
                  </Box>
                </Grid>
              )}
            </Grid>
          )}

          {/* Favorites Tab */}
          {activeTab === 2 && (
            <Grid container spacing={2}>
              {savedCharts
                .filter(chart => favoriteCharts.includes(chart.id))
                .map((chart) => renderChartCard(chart))
              }
              {favoriteCharts.length === 0 && (
                <Grid item xs={12}>
                  <Box sx={{ textAlign: 'center', py: 4 }}>
                    <Typography variant="h6" color="text.secondary" gutterBottom>
                      No favorite charts yet
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Mark charts as favorites to quick access
                    </Typography>
                  </Box>
                </Grid>
              )}
            </Grid>
          )}
        </Box>
      </Paper>

      {/* Save Dialog */}
      <Dialog open={saveDialog} onClose={() => setSaveDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Save Chart</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              label="Chart Name"
              value={chartName}
              onChange={(e) => setChartName(e.target.value)}
              fullWidth
              required
            />
            
            <TextField
              label="Description (optional)"
              value={chartDescription}
              onChange={(e) => setChartDescription(e.target.value)}
              multiline
              rows={3}
              fullWidth
            />
            
            <FormControl fullWidth>
              <InputLabel>Category</InputLabel>
              <Select
                value={chartCategory}
                onChange={(e) => setChartCategory(e.target.value)}
              >
                <MenuItem value={CHART_CATEGORIES.ANALYSIS}>Technical Analysis</MenuItem>
                <MenuItem value={CHART_CATEGORIES.STRATEGY}>Trading Strategy</MenuItem>
                <MenuItem value={CHART_CATEGORIES.EDUCATION}>Educational</MenuItem>
                <MenuItem value={CHART_CATEGORIES.TEMPLATE}>Template</MenuItem>
                <MenuItem value={CHART_CATEGORIES.OTHER}>Other</MenuItem>
              </Select>
            </FormControl>
            
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Include in Save:
              </Typography>
              <FormControlLabel
                control={
                  <Switch
                    checked={includeTechnicals}
                    onChange={(e) => setIncludeTechnicals(e.target.checked)}
                  />
                }
                label="Technical Indicators"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={includeDrawings}
                    onChange={(e) => setIncludeDrawings(e.target.checked)}
                  />
                }
                label="Drawings & Annotations"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={includeSettings}
                    onChange={(e) => setIncludeSettings(e.target.checked)}
                  />
                }
                label="Chart Settings"
              />
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSaveDialog(false)}>Cancel</Button>
          <Button onClick={saveChart} variant="contained">Save</Button>
        </DialogActions>
      </Dialog>

      {/* Share Dialog */}
      <Dialog open={shareDialog} onClose={() => setShareDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Share Chart</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <Typography variant="h6">
              {chartToShare?.name}
            </Typography>
            
            <FormControl fullWidth>
              <InputLabel>Privacy Level</InputLabel>
              <Select
                value={privacyLevel}
                onChange={(e) => setPrivacyLevel(e.target.value)}
              >
                <MenuItem value={PRIVACY_LEVELS.PRIVATE}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Lock />
                    Private - Only you can access
                  </Box>
                </MenuItem>
                <MenuItem value={PRIVACY_LEVELS.UNLISTED}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <LinkIcon />
                    Unlisted - Anyone with link can access
                  </Box>
                </MenuItem>
                <MenuItem value={PRIVACY_LEVELS.PUBLIC}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Public />
                    Public - Visible to everyone
                  </Box>
                </MenuItem>
              </Select>
            </FormControl>
            
            {(privacyLevel === PRIVACY_LEVELS.UNLISTED || privacyLevel === PRIVACY_LEVELS.PUBLIC) && (
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Share URL:
                </Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <TextField
                    value={shareUrl}
                    fullWidth
                    size="small"
                    InputProps={{ readOnly: true }}
                  />
                  <Button onClick={copyShareUrl} startIcon={<Copy />}>
                    Copy
                  </Button>
                </Box>
                
                <Box sx={{ mt: 2, textAlign: 'center' }}>
                  <Typography variant="subtitle2" gutterBottom>
                    QR Code:
                  </Typography>
                  {qrCode && (
                    <img 
                      src={qrCode} 
                      alt="QR Code" 
                      style={{ maxWidth: '200px', border: '1px solid #ccc' }}
                    />
                  )}
                </Box>
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShareDialog(false)}>Cancel</Button>
          <Button onClick={shareChart} variant="contained">Update Sharing</Button>
        </DialogActions>
      </Dialog>

      {/* Context Menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={handleMenuClose}
      >
        <MenuItemComponent onClick={() => { loadChart(selectedChart); handleMenuClose(); }}>
          <Edit sx={{ mr: 1 }} />
          Load Chart
        </MenuItemComponent>
        <MenuItemComponent onClick={() => { openShareDialog(selectedChart); handleMenuClose(); }}>
          <Share sx={{ mr: 1 }} />
          Share
        </MenuItemComponent>
        <MenuItemComponent onClick={() => { exportChart(selectedChart); handleMenuClose(); }}>
          <CloudDownload sx={{ mr: 1 }} />
          Export
        </MenuItemComponent>
        <Divider />
        <MenuItemComponent onClick={() => { deleteChart(selectedChart.id); handleMenuClose(); }}>
          <Delete sx={{ mr: 1 }} />
          Delete
        </MenuItemComponent>
      </Menu>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert
          severity={snackbar.severity}
          onClose={() => setSnackbar({ ...snackbar, open: false })}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default ChartSharing;