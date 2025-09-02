import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Chip,
  Alert,
  LinearProgress
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  AccountBalance as AccountBalanceIcon,
  PieChart as PieChartIcon,
  ShowChart as ShowChartIcon
} from '@mui/icons-material';
import stockRepository from '../../services/repositories/StockRepository';
import localStorageManager from '../../services/storage/LocalStorageManager';

const Portfolio = () => {
  const [portfolio, setPortfolio] = useState([]);
  const [totalValue, setTotalValue] = useState(0);
  const [totalReturn, setTotalReturn] = useState(0);
  const [totalReturnPercent, setTotalReturnPercent] = useState(0);
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPosition, setEditingPosition] = useState(null);
  const [formData, setFormData] = useState({
    symbol: '',
    quantity: '',
    avgPrice: '',
    notes: ''
  });

  // Load portfolio and stocks
  useEffect(() => {
    loadPortfolioAndStocks();
  }, []);

  const loadPortfolioAndStocks = async () => {
    try {
      setLoading(true);
      
      // Load stocks list
      const stocksList = await stockRepository.getAllStocks();
      setStocks(stocksList);
      
      // Load saved portfolio from localStorage
      const savedPortfolio = localStorageManager.getNestedData('storage', 'portfolio.positions', []);
      
      // Update portfolio with current prices
      if (savedPortfolio.length > 0) {
        const updatedPortfolio = await Promise.all(
          savedPortfolio.map(async (position) => {
            try {
              const currentData = await stockRepository.getStock(position.symbol);
              const currentValue = currentData.last_price * position.quantity;
              const totalCost = position.avgPrice * position.quantity;
              const unrealizedGain = currentValue - totalCost;
              const unrealizedGainPercent = (unrealizedGain / totalCost) * 100;
              
              return {
                ...position,
                currentPrice: currentData.last_price,
                currentValue,
                totalCost,
                unrealizedGain,
                unrealizedGainPercent,
                priceChange: currentData.price_change,
                priceChangePercent: currentData.price_change_percent
              };
            } catch (err) {
              console.error(`Failed to update ${position.symbol}:`, err);
              return {
                ...position,
                currentPrice: position.avgPrice,
                currentValue: position.avgPrice * position.quantity,
                totalCost: position.avgPrice * position.quantity,
                unrealizedGain: 0,
                unrealizedGainPercent: 0,
                priceChange: 0,
                priceChangePercent: 0
              };
            }
          })
        );
        
        setPortfolio(updatedPortfolio);
        
        // Calculate totals
        const newTotalValue = updatedPortfolio.reduce((sum, p) => sum + p.currentValue, 0);
        const newTotalCost = updatedPortfolio.reduce((sum, p) => sum + p.totalCost, 0);
        const newTotalReturn = newTotalValue - newTotalCost;
        const newTotalReturnPercent = newTotalCost > 0 ? (newTotalReturn / newTotalCost) * 100 : 0;
        
        setTotalValue(newTotalValue);
        setTotalReturn(newTotalReturn);
        setTotalReturnPercent(newTotalReturnPercent);
        
        // Save updated totals to localStorage
        localStorageManager.updateData('storage', 'portfolio.totalValue', newTotalValue);
        localStorageManager.updateData('storage', 'portfolio.totalReturn', newTotalReturn);
        localStorageManager.updateData('storage', 'portfolio.lastUpdated', Date.now());
      } else {
        setPortfolio([]);
        setTotalValue(0);
        setTotalReturn(0);
        setTotalReturnPercent(0);
      }
      
      setError(null);
    } catch (err) {
      console.error('Error loading portfolio:', err);
      setError('Failed to load portfolio data');
    } finally {
      setLoading(false);
    }
  };

  const handleAddPosition = () => {
    setEditingPosition(null);
    setFormData({ symbol: '', quantity: '', avgPrice: '', notes: '' });
    setDialogOpen(true);
  };

  const handleEditPosition = (position) => {
    setEditingPosition(position);
    setFormData({
      symbol: position.symbol,
      quantity: position.quantity.toString(),
      avgPrice: position.avgPrice.toString(),
      notes: position.notes || ''
    });
    setDialogOpen(true);
  };

  const handleSavePosition = async () => {
    try {
      const quantity = parseFloat(formData.quantity);
      const avgPrice = parseFloat(formData.avgPrice);
      
      if (!formData.symbol || quantity <= 0 || avgPrice <= 0) {
        alert('Please fill in all required fields with valid values');
        return;
      }
      
      const newPosition = {
        id: editingPosition?.id || Date.now().toString(),
        symbol: formData.symbol,
        quantity,
        avgPrice,
        notes: formData.notes,
        addedAt: editingPosition?.addedAt || Date.now(),
        updatedAt: Date.now()
      };
      
      let updatedPortfolio;
      
      if (editingPosition) {
        // Update existing position
        updatedPortfolio = portfolio.map(p => p.id === editingPosition.id ? newPosition : p);
      } else {
        // Add new position
        updatedPortfolio = [...portfolio, newPosition];
      }
      
      // Save to localStorage
      localStorageManager.updateData('storage', 'portfolio.positions', updatedPortfolio);
      
      setDialogOpen(false);
      loadPortfolioAndStocks(); // Reload to get current prices
      
    } catch (err) {
      console.error('Error saving position:', err);
      alert('Failed to save position');
    }
  };

  const handleDeletePosition = (position) => {
    if (window.confirm(`Are you sure you want to delete ${position.symbol}?`)) {
      const updatedPortfolio = portfolio.filter(p => p.id !== position.id);
      localStorageManager.updateData('storage', 'portfolio.positions', updatedPortfolio);
      loadPortfolioAndStocks();
    }
  };

  const formatPrice = (price) => {
    if (price === null || price === undefined) return '—';
    return new Intl.NumberFormat('en-US').format(price);
  };

  const formatPercent = (percent) => {
    if (percent === null || percent === undefined) return '—';
    const sign = percent >= 0 ? '+' : '';
    return `${sign}${percent.toFixed(2)}%`;
  };

  const getPortfolioAllocation = () => {
    if (totalValue === 0) return [];
    
    return portfolio.map(position => ({
      symbol: position.symbol,
      value: position.currentValue,
      percentage: (position.currentValue / totalValue) * 100
    })).sort((a, b) => b.percentage - a.percentage);
  };

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <LinearProgress />
        <Typography variant="h6" sx={{ mt: 2 }}>Loading portfolio...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  const allocation = getPortfolioAllocation();

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" gutterBottom>Portfolio Management</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleAddPosition}
          color="primary"
        >
          Add Position
        </Button>
      </Box>

      {/* Portfolio Summary */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <AccountBalanceIcon color="primary" />
                <Typography color="text.secondary" variant="body2">Total Value</Typography>
              </Box>
              <Typography variant="h5" fontWeight="bold">
                {formatPrice(totalValue)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {totalReturn >= 0 ? 
                  <TrendingUpIcon color="success" /> : 
                  <TrendingDownIcon color="error" />
                }
                <Typography color="text.secondary" variant="body2">Total Return</Typography>
              </Box>
              <Typography 
                variant="h5" 
                fontWeight="bold"
                color={totalReturn >= 0 ? 'success.main' : 'error.main'}
              >
                {formatPrice(totalReturn)}
              </Typography>
              <Typography 
                variant="body2"
                color={totalReturn >= 0 ? 'success.main' : 'error.main'}
              >
                {formatPercent(totalReturnPercent)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <PieChartIcon color="info" />
                <Typography color="text.secondary" variant="body2">Positions</Typography>
              </Box>
              <Typography variant="h5" fontWeight="bold">
                {portfolio.length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <ShowChartIcon color="secondary" />
                <Typography color="text.secondary" variant="body2">Status</Typography>
              </Box>
              <Chip 
                label={portfolio.length > 0 ? "Active" : "No Positions"}
                color={portfolio.length > 0 ? "success" : "default"}
              />
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Portfolio Positions */}
      {portfolio.length > 0 ? (
        <Grid container spacing={3}>
          {/* Positions Table */}
          <Grid item xs={12} lg={8}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>Positions</Typography>
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Symbol</TableCell>
                        <TableCell align="right">Quantity</TableCell>
                        <TableCell align="right">Avg Price</TableCell>
                        <TableCell align="right">Current Price</TableCell>
                        <TableCell align="right">Current Value</TableCell>
                        <TableCell align="right">Return</TableCell>
                        <TableCell align="right">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {portfolio.map((position) => (
                        <TableRow key={position.id}>
                          <TableCell>
                            <Typography variant="body2" fontWeight="bold">
                              {position.symbol}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">{position.quantity}</TableCell>
                          <TableCell align="right">{formatPrice(position.avgPrice)}</TableCell>
                          <TableCell align="right">
                            <Typography
                              color={position.priceChange >= 0 ? 'success.main' : 'error.main'}
                            >
                              {formatPrice(position.currentPrice)}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">{formatPrice(position.currentValue)}</TableCell>
                          <TableCell align="right">
                            <Typography
                              color={position.unrealizedGain >= 0 ? 'success.main' : 'error.main'}
                              fontWeight="bold"
                            >
                              {formatPrice(position.unrealizedGain)}
                            </Typography>
                            <Typography
                              variant="body2"
                              color={position.unrealizedGain >= 0 ? 'success.main' : 'error.main'}
                            >
                              {formatPercent(position.unrealizedGainPercent)}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Tooltip title="Edit Position">
                              <IconButton 
                                size="small" 
                                onClick={() => handleEditPosition(position)}
                              >
                                <EditIcon />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Delete Position">
                              <IconButton 
                                size="small" 
                                color="error"
                                onClick={() => handleDeletePosition(position)}
                              >
                                <DeleteIcon />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </Grid>
          
          {/* Portfolio Allocation */}
          <Grid item xs={12} lg={4}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>Portfolio Allocation</Typography>
                <Box sx={{ mt: 2 }}>
                  {allocation.map((item, index) => (
                    <Box key={item.symbol} sx={{ mb: 2 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                        <Typography variant="body2" fontWeight="bold">
                          {item.symbol}
                        </Typography>
                        <Typography variant="body2">
                          {item.percentage.toFixed(1)}%
                        </Typography>
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={item.percentage}
                        sx={{
                          height: 8,
                          borderRadius: 4,
                          backgroundColor: 'grey.700',
                          '& .MuiLinearProgress-bar': {
                            backgroundColor: `hsl(${index * 60}, 70%, 50%)`
                          }
                        }}
                      />
                      <Typography variant="caption" color="text.secondary">
                        Value: {formatPrice(item.value)}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      ) : (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 8 }}>
            <PieChartIcon sx={{ fontSize: 80, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No positions in portfolio
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Add your first stock position to start tracking your portfolio
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleAddPosition}
            >
              Add First Position
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Add/Edit Position Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingPosition ? 'Edit Position' : 'Add New Position'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <FormControl fullWidth>
              <InputLabel>Stock Symbol</InputLabel>
              <Select
                value={formData.symbol}
                onChange={(e) => setFormData({...formData, symbol: e.target.value})}
                label="Stock Symbol"
              >
                {stocks.map((stock) => (
                  <MenuItem key={stock.symbol} value={stock.symbol}>
                    {stock.symbol} - {stock.company_name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            
            <TextField
              label="Quantity"
              type="number"
              value={formData.quantity}
              onChange={(e) => setFormData({...formData, quantity: e.target.value})}
              required
              inputProps={{ min: 0, step: 1 }}
            />
            
            <TextField
              label="Average Price"
              type="number"
              value={formData.avgPrice}
              onChange={(e) => setFormData({...formData, avgPrice: e.target.value})}
              required
              inputProps={{ min: 0, step: 0.01 }}
            />
            
            <TextField
              label="Notes (optional)"
              multiline
              rows={3}
              value={formData.notes}
              onChange={(e) => setFormData({...formData, notes: e.target.value})}
              placeholder="Investment thesis, entry strategy, etc."
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSavePosition} variant="contained">
            {editingPosition ? 'Update' : 'Add'} Position
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Portfolio;