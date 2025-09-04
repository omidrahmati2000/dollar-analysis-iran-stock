// Persian/Shamsi date utilities for chart display
// Note: This is a simplified implementation for demonstration
// For production, consider using a proper library like moment-jalaali

const persianMonths = [
    'فرو', 'ارد', 'خرد', 'تیر', 'مرد', 'شهر',
    'مهر', 'آبا', 'آذر', 'دی', 'بهم', 'اسف'
];

const persianMonthsFull = [
    'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
    'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'
];

// Convert Persian date string (YYYY-MM-DD) to Unix timestamp
// Note: This is approximate and should be replaced with a proper library for production
export const persianToUnixTimestamp = (persianDateString) => {
    if (!persianDateString) return null;
    
    try {
        const [pYear, pMonth, pDay] = persianDateString.split('-').map(Number);
        
        // Approximate conversion from Persian to Gregorian
        let gYear = pYear + 621;
        let gMonth = pMonth + 3;
        let gDay = pDay;
        
        // Handle month overflow
        if (gMonth > 12) {
            gMonth -= 12;
            gYear += 1;
        }
        
        // Create Gregorian date and return Unix timestamp in seconds
        const gregorianDate = new Date(gYear, gMonth - 1, gDay);
        return Math.floor(gregorianDate.getTime() / 1000);
    } catch (error) {
        console.warn('Failed to convert Persian date:', persianDateString, error);
        return null;
    }
};

// Simplified Gregorian to Persian conversion
// Note: This is approximate and should be replaced with a proper library for production
const gregorianToPersian = (gregorianDate) => {
    if (!gregorianDate) return null;
    
    const date = new Date(gregorianDate * 1000); // TradingView uses seconds
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    
    // Approximate conversion (simplified algorithm)
    // Persian year starts roughly 621-622 years after Gregorian
    let pYear = year - 621;
    let pMonth = month;
    let pDay = day;
    
    // Adjust for Persian calendar starting in March
    if (month < 3 || (month === 3 && day < 21)) {
        pYear--;
        pMonth = month + 9;
        if (pMonth > 12) pMonth -= 12;
    } else {
        pMonth = month - 3;
        if (pMonth <= 0) pMonth += 12;
    }
    
    return { year: pYear, month: pMonth, day: pDay };
};

// Format Persian date for different chart contexts
export const formatPersianDateForChart = (timestamp, timeframe = '1D') => {
    const persian = gregorianToPersian(timestamp);
    if (!persian) return '';
    
    switch (timeframe) {
        case '1m':
        case '5m':
        case '15m':
        case '1h':
        case '4h':
            // For intraday: show date + time
            const date = new Date(timestamp * 1000);
            const persianDate = `${persian.year}/${persian.month.toString().padStart(2, '0')}/${persian.day.toString().padStart(2, '0')}`;
            const time = date.toLocaleTimeString('fa-IR', { 
                hour: '2-digit', 
                minute: '2-digit',
                hour12: false 
            });
            return `${persianDate} ${time}`;
            
        case '1D':
            // For daily: show short date format
            return `${persian.year}/${persian.month.toString().padStart(2, '0')}/${persian.day.toString().padStart(2, '0')}`;
            
        case '1W':
            // For weekly: show month abbreviation
            return `${persian.day} ${persianMonths[persian.month - 1]} ${persian.year}`;
            
        case '1M':
            // For monthly: show month and year
            return `${persianMonthsFull[persian.month - 1]} ${persian.year}`;
            
        default:
            return `${persian.year}/${persian.month.toString().padStart(2, '0')}/${persian.day.toString().padStart(2, '0')}`;
    }
};

// Format Persian date for tooltips (more detailed)
export const formatPersianDateTooltip = (timestamp) => {
    const persian = gregorianToPersian(timestamp);
    if (!persian) return '';
    
    const date = new Date(timestamp * 1000);
    const dayName = date.toLocaleDateString('fa-IR', { weekday: 'long' });
    const time = date.toLocaleTimeString('fa-IR', { 
        hour: '2-digit', 
        minute: '2-digit',
        second: '2-digit',
        hour12: false 
    });
    
    return `${dayName}، ${persian.day} ${persianMonthsFull[persian.month - 1]} ${persian.year} - ${time}`;
};

// Custom time formatter for TradingView charts
export const createPersianTimeFormatter = (timeframe = '1D') => {
    return (timestamp) => {
        return formatPersianDateForChart(timestamp, timeframe);
    };
};

export default {
    gregorianToPersian,
    formatPersianDateForChart,
    formatPersianDateTooltip,
    createPersianTimeFormatter,
    persianMonths,
    persianMonthsFull
};