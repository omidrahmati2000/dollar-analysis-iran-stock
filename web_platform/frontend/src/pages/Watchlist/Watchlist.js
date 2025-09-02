import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, Card, CardContent, Button, CircularProgress } from '@mui/material';
import { Timeline as TimelineIcon } from '@mui/icons-material';

const Watchlist = () => {
  const navigate = useNavigate();

  // Auto-redirect to Charts watchlist tab after 2 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      navigate('/charts', { replace: true });
      // Set tab to watchlist (index 3)
      window.dispatchEvent(new CustomEvent('setChartsTab', { detail: { tabIndex: 3 } }));
    }, 2000);

    return () => clearTimeout(timer);
  }, [navigate]);

  const handleRedirect = () => {
    navigate('/charts', { replace: true });
    window.dispatchEvent(new CustomEvent('setChartsTab', { detail: { tabIndex: 3 } }));
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>Watchlist</Typography>
      <Card>
        <CardContent sx={{ textAlign: 'center', py: 8 }}>
          <TimelineIcon sx={{ fontSize: 80, color: 'primary.main', mb: 2 }} />
          
          <Typography variant="h6" gutterBottom>
            Watchlist Available in Charts
          </Typography>
          
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3, maxWidth: 600, mx: 'auto' }}>
            Our comprehensive watchlist with real-time price updates, portfolio tracking, and advanced features 
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
            startIcon={<TimelineIcon />}
            onClick={handleRedirect}
          >
            Go to Watchlist Now
          </Button>
          
          <Box sx={{ mt: 4, textAlign: 'left', maxWidth: 500, mx: 'auto' }}>
            <Typography variant="subtitle2" gutterBottom>
              Watchlist Features Available:
            </Typography>
            <ul style={{ margin: 0, paddingLeft: '20px' }}>
              <li>
                <Typography variant="body2" color="text.secondary">
                  Real-time price and change tracking
                </Typography>
              </li>
              <li>
                <Typography variant="body2" color="text.secondary">
                  Add and remove stocks with search functionality
                </Typography>
              </li>
              <li>
                <Typography variant="body2" color="text.secondary">
                  Click-to-chart integration for instant analysis
                </Typography>
              </li>
              <li>
                <Typography variant="body2" color="text.secondary">
                  Persistent storage across sessions
                </Typography>
              </li>
              <li>
                <Typography variant="body2" color="text.secondary">
                  Import/Export watchlist functionality
                </Typography>
              </li>
              <li>
                <Typography variant="body2" color="text.secondary">
                  Visual cards with company information
                </Typography>
              </li>
            </ul>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export default Watchlist;