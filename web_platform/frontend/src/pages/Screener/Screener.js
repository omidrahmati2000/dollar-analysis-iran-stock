import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, Card, CardContent, Button, CircularProgress } from '@mui/material';
import { ShowChart as ShowChartIcon } from '@mui/icons-material';

const Screener = () => {
  const navigate = useNavigate();

  // Auto-redirect to Charts screener tab after 2 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      navigate('/charts', { replace: true });
      // Set tab to screener (index 2) - this would need to be handled in Charts component
      window.dispatchEvent(new CustomEvent('setChartsTab', { detail: { tabIndex: 2 } }));
    }, 2000);

    return () => clearTimeout(timer);
  }, [navigate]);

  const handleRedirect = () => {
    navigate('/charts', { replace: true });
    window.dispatchEvent(new CustomEvent('setChartsTab', { detail: { tabIndex: 2 } }));
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>Stock Screener</Typography>
      <Card>
        <CardContent sx={{ textAlign: 'center', py: 8 }}>
          <ShowChartIcon sx={{ fontSize: 80, color: 'primary.main', mb: 2 }} />
          
          <Typography variant="h6" gutterBottom>
            Stock Screener Available in Charts
          </Typography>
          
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3, maxWidth: 600, mx: 'auto' }}>
            Our comprehensive stock screener with advanced filters, technical indicators, and real-time results 
            is available in the Charts section. You'll be redirected automatically, or click below to go now.
          </Typography>
          
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, mb: 3 }}>
            <CircularProgress size={20} />
            <Typography variant="body2" color="text.secondary">
              Redirecting in 2 seconds...
            </Typography>
          </Box>
          
          <Button
            variant="contained"
            size="large"
            startIcon={<ShowChartIcon />}
            onClick={handleRedirect}
          >
            Go to Screener Now
          </Button>
          
          <Box sx={{ mt: 4, textAlign: 'left', maxWidth: 500, mx: 'auto' }}>
            <Typography variant="subtitle2" gutterBottom>
              Screener Features Available:
            </Typography>
            <ul style={{ margin: 0, paddingLeft: '20px' }}>
              <li>
                <Typography variant="body2" color="text.secondary">
                  Price and volume filters
                </Typography>
              </li>
              <li>
                <Typography variant="body2" color="text.secondary">
                  Technical indicator screening (RSI, MACD, Moving Averages)
                </Typography>
              </li>
              <li>
                <Typography variant="body2" color="text.secondary">
                  Market cap and sector filters
                </Typography>
              </li>
              <li>
                <Typography variant="body2" color="text.secondary">
                  Save and load custom screen presets
                </Typography>
              </li>
              <li>
                <Typography variant="body2" color="text.secondary">
                  Real-time results with clickable stock entries
                </Typography>
              </li>
            </ul>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export default Screener;