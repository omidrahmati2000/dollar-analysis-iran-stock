import React, { useEffect, useRef } from 'react';
import { Box, Typography } from '@mui/material';

const SimpleChart = ({ data, type = 'candlestick', showVolume = true, height = 400 }) => {
    const canvasRef = useRef(null);
    const containerRef = useRef(null);

    useEffect(() => {
        if (!data || data.length === 0) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const container = containerRef.current;
        
        // Set canvas size
        canvas.width = container.offsetWidth;
        canvas.height = height;

        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Calculate min and max values
        const prices = data.flatMap(d => [d.high || d.close, d.low || d.open]);
        const minPrice = Math.min(...prices) * 0.98;
        const maxPrice = Math.max(...prices) * 1.02;
        const priceRange = maxPrice - minPrice;

        // Drawing parameters
        const padding = { top: 20, right: 60, bottom: showVolume ? 100 : 40, left: 10 };
        const chartWidth = canvas.width - padding.left - padding.right;
        const chartHeight = canvas.height - padding.top - padding.bottom;
        const candleWidth = Math.max(1, (chartWidth / data.length) * 0.8);
        const candleSpacing = chartWidth / data.length;

        // Draw background grid
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 0.5;

        // Horizontal grid lines
        for (let i = 0; i <= 5; i++) {
            const y = padding.top + (chartHeight * i / 5);
            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(canvas.width - padding.right, y);
            ctx.stroke();

            // Price labels
            const price = maxPrice - (priceRange * i / 5);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
            ctx.font = '10px Arial';
            ctx.textAlign = 'right';
            ctx.fillText(price.toFixed(0), canvas.width - 5, y + 3);
        }

        // Draw candles or line chart
        data.forEach((candle, index) => {
            const x = padding.left + (index * candleSpacing) + (candleSpacing / 2);
            
            if (type === 'candlestick' && candle.open && candle.close && candle.high && candle.low) {
                // Calculate positions
                const openY = padding.top + ((maxPrice - candle.open) / priceRange) * chartHeight;
                const closeY = padding.top + ((maxPrice - candle.close) / priceRange) * chartHeight;
                const highY = padding.top + ((maxPrice - candle.high) / priceRange) * chartHeight;
                const lowY = padding.top + ((maxPrice - candle.low) / priceRange) * chartHeight;

                // Determine color
                const isBullish = candle.close >= candle.open;
                const color = isBullish ? '#4CAF50' : '#f44336';

                // Draw wick
                ctx.strokeStyle = color;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(x, highY);
                ctx.lineTo(x, lowY);
                ctx.stroke();

                // Draw body
                ctx.fillStyle = color;
                const bodyTop = Math.min(openY, closeY);
                const bodyHeight = Math.abs(closeY - openY) || 1;
                ctx.fillRect(x - candleWidth / 2, bodyTop, candleWidth, bodyHeight);
            } else {
                // Line chart fallback
                const price = candle.close || candle.price || 0;
                const y = padding.top + ((maxPrice - price) / priceRange) * chartHeight;
                
                if (index === 0) {
                    ctx.beginPath();
                    ctx.moveTo(x, y);
                    ctx.strokeStyle = '#2196F3';
                    ctx.lineWidth = 2;
                } else {
                    ctx.lineTo(x, y);
                }
            }
        });

        // Complete line chart
        if (type !== 'candlestick') {
            ctx.stroke();
        }

        // Draw volume bars if enabled
        if (showVolume && data[0]?.volume) {
            const volumeHeight = 60;
            const volumeTop = canvas.height - volumeHeight - 20;
            const maxVolume = Math.max(...data.map(d => d.volume || 0));

            data.forEach((candle, index) => {
                const x = padding.left + (index * candleSpacing) + (candleSpacing / 2);
                const volume = candle.volume || 0;
                const barHeight = (volume / maxVolume) * volumeHeight;
                const isBullish = candle.close >= candle.open;
                
                ctx.fillStyle = isBullish ? 'rgba(76, 175, 80, 0.3)' : 'rgba(244, 67, 54, 0.3)';
                ctx.fillRect(x - candleWidth / 2, volumeTop + volumeHeight - barHeight, candleWidth, barHeight);
            });

            // Volume label
            ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
            ctx.font = '10px Arial';
            ctx.textAlign = 'left';
            ctx.fillText('Volume', padding.left, volumeTop - 5);
        }

        // Draw time labels
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';

        const labelInterval = Math.ceil(data.length / 10);
        data.forEach((candle, index) => {
            if (index % labelInterval === 0) {
                const x = padding.left + (index * candleSpacing) + (candleSpacing / 2);
                const date = new Date(candle.date || candle.timestamp);
                const label = `${date.getMonth() + 1}/${date.getDate()}`;
                ctx.fillText(label, x, canvas.height - 5);
            }
        });

    }, [data, type, showVolume, height]);

    if (!data || data.length === 0) {
        return (
            <Box 
                sx={{ 
                    height, 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    background: 'linear-gradient(180deg, #1e1e2e 0%, #2a2a3e 100%)',
                    borderRadius: 2
                }}
            >
                <Typography color="text.secondary">No data available</Typography>
            </Box>
        );
    }

    return (
        <Box 
            ref={containerRef}
            sx={{ 
                width: '100%',
                height,
                background: 'linear-gradient(180deg, #1e1e2e 0%, #2a2a3e 100%)',
                borderRadius: 2,
                position: 'relative',
                overflow: 'hidden'
            }}
        >
            <canvas 
                ref={canvasRef}
                style={{ 
                    width: '100%',
                    height: '100%',
                    display: 'block'
                }}
            />
        </Box>
    );
};

export default SimpleChart;