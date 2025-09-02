import React from 'react';
import { Box, CircularProgress, Typography, Skeleton } from '@mui/material';
import './LoadingSpinner.css';

const LoadingSpinner = ({ 
    type = 'default', 
    message = 'در حال بارگذاری...', 
    size = 'medium',
    overlay = false 
}) => {
    const getSizeValue = () => {
        switch (size) {
            case 'small': return 30;
            case 'large': return 60;
            default: return 40;
        }
    };

    if (type === 'skeleton') {
        return (
            <Box sx={{ width: '100%', p: 2 }}>
                {[...Array(5)].map((_, index) => (
                    <Box key={index} sx={{ mb: 2 }}>
                        <Skeleton variant="text" width="60%" height={30} />
                        <Skeleton variant="rectangular" width="100%" height={60} sx={{ mt: 1 }} />
                    </Box>
                ))}
            </Box>
        );
    }

    if (type === 'dots') {
        return (
            <Box sx={{ 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center',
                flexDirection: 'column',
                gap: 2,
                p: 4
            }}>
                <div className="dots-loader">
                    <div className="dot"></div>
                    <div className="dot"></div>
                    <div className="dot"></div>
                </div>
                {message && (
                    <Typography variant="body2" color="text.secondary">
                        {message}
                    </Typography>
                )}
            </Box>
        );
    }

    if (type === 'pulse') {
        return (
            <Box sx={{ 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center',
                flexDirection: 'column',
                gap: 2,
                p: 4
            }}>
                <div className="pulse-loader">
                    <div className="pulse-circle"></div>
                    <div className="pulse-circle"></div>
                    <div className="pulse-circle"></div>
                </div>
                {message && (
                    <Typography variant="body2" color="text.secondary">
                        {message}
                    </Typography>
                )}
            </Box>
        );
    }

    const containerSx = {
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'column',
        gap: 2,
        p: 4,
        ...(overlay && {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.1)',
            backdropFilter: 'blur(2px)',
            zIndex: 9999
        })
    };

    return (
        <Box sx={containerSx}>
            <div className="spinner-container">
                <CircularProgress 
                    size={getSizeValue()} 
                    sx={{ 
                        color: '#667eea',
                        '& .MuiCircularProgress-circle': {
                            strokeLinecap: 'round',
                        }
                    }} 
                />
                <div className="spinner-glow" />
            </div>
            {message && (
                <Typography 
                    variant="body2" 
                    color="text.secondary"
                    sx={{ 
                        textAlign: 'center',
                        animation: 'fadeInOut 2s infinite'
                    }}
                >
                    {message}
                </Typography>
            )}
        </Box>
    );
};

// Shimmer effect for loading cards
export const LoadingCard = ({ height = 200, animated = true }) => (
    <Box sx={{ 
        width: '100%', 
        height,
        background: animated ? 
            'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)' : 
            '#f5f5f5',
        backgroundSize: animated ? '200% 100%' : 'auto',
        animation: animated ? 'shimmer 1.5s infinite' : 'none',
        borderRadius: 2,
        '@keyframes shimmer': {
            '0%': { backgroundPosition: '-200% 0' },
            '100%': { backgroundPosition: '200% 0' }
        }
    }} />
);

// Grid skeleton for loading multiple items
export const LoadingGrid = ({ items = 6, itemHeight = 200 }) => (
    <Box sx={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', 
        gap: 2,
        p: 2
    }}>
        {[...Array(items)].map((_, index) => (
            <LoadingCard key={index} height={itemHeight} />
        ))}
    </Box>
);

export default LoadingSpinner;