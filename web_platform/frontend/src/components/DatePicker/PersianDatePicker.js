import React, { useState } from 'react';
import {
    Box,
    TextField,
    Popover,
    Paper,
    Typography,
    IconButton,
    Grid,
    Button,
    useTheme
} from '@mui/material';
import {
    ChevronLeft,
    ChevronRight,
    Today
} from '@mui/icons-material';

// Simple Persian date utilities
const persianMonths = [
    'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
    'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'
];

const persianDaysShort = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];

// Convert Gregorian to Persian (simplified)
const gregorianToPersian = (date) => {
    // This is a simplified conversion. In production, you'd use a proper library like moment-jalaali
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    
    // Approximate conversion (for demo purposes)
    const pYear = year - 621;
    const pMonth = month;
    const pDay = day;
    
    return { year: pYear, month: pMonth, day: pDay };
};

// Convert Persian to Gregorian (simplified)
const persianToGregorian = (pYear, pMonth, pDay) => {
    // This is a simplified conversion. In production, you'd use a proper library
    const gYear = pYear + 621;
    return new Date(gYear, pMonth - 1, pDay);
};

const PersianDatePicker = ({ 
    label = "تاریخ", 
    value, 
    onChange, 
    helperText = "",
    size = "small",
    fullWidth = false 
}) => {
    const theme = useTheme();
    const [anchorEl, setAnchorEl] = useState(null);
    const [viewDate, setViewDate] = useState(() => {
        const today = value || new Date();
        const persian = gregorianToPersian(today);
        return persian;
    });

    const open = Boolean(anchorEl);

    const handleClick = (event) => {
        setAnchorEl(event.currentTarget);
    };

    const handleClose = () => {
        setAnchorEl(null);
    };

    const formatPersianDate = (date) => {
        if (!date) return '';
        const persian = gregorianToPersian(date);
        return `${persian.year}/${persian.month.toString().padStart(2, '0')}/${persian.day.toString().padStart(2, '0')}`;
    };

    const handleDateSelect = (day) => {
        const selectedDate = persianToGregorian(viewDate.year, viewDate.month, day);
        onChange(selectedDate);
        handleClose();
    };

    const handleToday = () => {
        const today = new Date();
        onChange(today);
        setViewDate(gregorianToPersian(today));
        handleClose();
    };

    const handleMonthChange = (direction) => {
        setViewDate(prev => {
            let newMonth = prev.month + direction;
            let newYear = prev.year;
            
            if (newMonth > 12) {
                newMonth = 1;
                newYear++;
            } else if (newMonth < 1) {
                newMonth = 12;
                newYear--;
            }
            
            return { ...prev, year: newYear, month: newMonth };
        });
    };

    // Generate calendar days
    const getDaysInMonth = (year, month) => {
        // Simplified - in reality Persian months have different day counts
        if (month <= 6) return 31;
        if (month <= 11) return 30;
        return 29; // Simplified leap year handling
    };

    const generateCalendar = () => {
        const daysInMonth = getDaysInMonth(viewDate.year, viewDate.month);
        const days = [];
        
        // First week might be partial
        for (let day = 1; day <= daysInMonth; day++) {
            days.push(day);
        }
        
        return days;
    };

    return (
        <Box>
            <TextField
                label={label}
                value={formatPersianDate(value)}
                onClick={handleClick}
                size={size}
                fullWidth={fullWidth}
                helperText={helperText}
                InputProps={{
                    readOnly: true,
                    endAdornment: (
                        <IconButton size="small">
                            <Today />
                        </IconButton>
                    )
                }}
                sx={{
                    '& .MuiInputBase-input': {
                        cursor: 'pointer'
                    }
                }}
            />
            
            <Popover
                open={open}
                anchorEl={anchorEl}
                onClose={handleClose}
                anchorOrigin={{
                    vertical: 'bottom',
                    horizontal: 'left',
                }}
            >
                <Paper sx={{ p: 2, minWidth: 300 }}>
                    {/* Header */}
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                        <IconButton onClick={() => handleMonthChange(-1)}>
                            <ChevronRight />
                        </IconButton>
                        
                        <Typography variant="h6">
                            {persianMonths[viewDate.month - 1]} {viewDate.year}
                        </Typography>
                        
                        <IconButton onClick={() => handleMonthChange(1)}>
                            <ChevronLeft />
                        </IconButton>
                    </Box>

                    {/* Days of week header */}
                    <Grid container spacing={0} sx={{ mb: 1 }}>
                        {persianDaysShort.map((day) => (
                            <Grid item xs key={day}>
                                <Box sx={{ 
                                    textAlign: 'center', 
                                    py: 1, 
                                    fontWeight: 'bold',
                                    color: 'text.secondary',
                                    fontSize: '0.875rem'
                                }}>
                                    {day}
                                </Box>
                            </Grid>
                        ))}
                    </Grid>

                    {/* Calendar days */}
                    <Grid container spacing={0}>
                        {generateCalendar().map((day) => {
                            const isSelected = value && 
                                gregorianToPersian(value).year === viewDate.year &&
                                gregorianToPersian(value).month === viewDate.month &&
                                gregorianToPersian(value).day === day;
                            
                            return (
                                <Grid item xs key={day}>
                                    <Button
                                        onClick={() => handleDateSelect(day)}
                                        sx={{
                                            minWidth: 36,
                                            height: 36,
                                            borderRadius: '50%',
                                            backgroundColor: isSelected ? 'primary.main' : 'transparent',
                                            color: isSelected ? 'primary.contrastText' : 'text.primary',
                                            '&:hover': {
                                                backgroundColor: isSelected ? 'primary.dark' : 'action.hover'
                                            }
                                        }}
                                    >
                                        {day}
                                    </Button>
                                </Grid>
                            );
                        })}
                    </Grid>

                    {/* Footer */}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2, pt: 2, borderTop: `1px solid ${theme.palette.divider}` }}>
                        <Button 
                            onClick={handleToday}
                            startIcon={<Today />}
                            size="small"
                        >
                            امروز
                        </Button>
                        <Button 
                            onClick={handleClose}
                            size="small"
                        >
                            بستن
                        </Button>
                    </Box>
                </Paper>
            </Popover>
        </Box>
    );
};

export default PersianDatePicker;