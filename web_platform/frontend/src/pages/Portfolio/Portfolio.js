import React from 'react';
import { Box, Typography, Card, CardContent } from '@mui/material';

const Portfolio = () => {
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>Portfolio</Typography>
      <Card>
        <CardContent>
          <Typography>Portfolio management coming soon...</Typography>
        </CardContent>
      </Card>
    </Box>
  );
};

export default Portfolio;