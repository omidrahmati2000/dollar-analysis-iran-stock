import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Alert
} from '@mui/material';
import { useAuth } from '../../services/auth';

const Login = () => {
  const { login } = useAuth();
  const [credentials, setCredentials] = useState({ username: 'demo', password: 'demo' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const result = await login(credentials);
    if (!result.success) {
      setError(result.error);
    }
    setLoading(false);
  };

  return (
    <Box sx={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0D1117 0%, #161B22 100%)'
    }}>
      <Card sx={{ width: 400, p: 3 }}>
        <CardContent>
          <Typography variant="h4" align="center" gutterBottom>
            🚀 Iran Market Pro
          </Typography>
          <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 3 }}>
            Professional Trading Platform
          </Typography>

          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          <form onSubmit={handleSubmit}>
            <TextField
              fullWidth
              label="Username"
              value={credentials.username}
              onChange={(e) => setCredentials({...credentials, username: e.target.value})}
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              type="password"
              label="Password"
              value={credentials.password}
              onChange={(e) => setCredentials({...credentials, password: e.target.value})}
              sx={{ mb: 3 }}
            />
            <Button
              fullWidth
              variant="contained"
              type="submit"
              disabled={loading}
              size="large"
            >
              {loading ? 'Signing In...' : 'Sign In'}
            </Button>
          </form>

          <Alert severity="info" sx={{ mt: 2 }}>
            Demo credentials: demo/demo
          </Alert>
        </CardContent>
      </Card>
    </Box>
  );
};

export default Login;