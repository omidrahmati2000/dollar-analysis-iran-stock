import React, { useState, useEffect } from 'react';
import './Currencies.css';
import LoadingSpinner, { LoadingGrid } from '../../components/Loading/LoadingSpinner';

const Currencies = () => {
    const [currenciesData, setCurrenciesData] = useState({
        تومان: [],
        دلار: []
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState('تومان');
    const [sortBy, setSortBy] = useState('price');
    const [filterText, setFilterText] = useState('');
    const [updateInterval, setUpdateInterval] = useState(30000);

    useEffect(() => {
        fetchCurrencies();
        const interval = setInterval(fetchCurrencies, updateInterval);
        return () => clearInterval(interval);
    }, [updateInterval]);

    const fetchCurrencies = async () => {
        try {
            setLoading(true);
            
            // Get real data from API instead of mock data
            const response = await fetch('http://localhost:8000/api/v2/currencies?limit=100');
            const allCurrencies = await response.json();

            // Separate by unit based on currency code patterns
            const tomanCurrencies = [];
            const dollarCurrencies = [];

            allCurrencies.forEach(currency => {
                const code = currency.currency_code;
                const name = currency.currency_name;
                
                // Fiat currencies and commodities (تومان based)
                if (code === 'USD' || code === 'EUR' || code === 'GBP' || code === 'AED' || code === 'TRY' || code === 'CNY' ||
                    name.includes('سکه') || name.includes('طلا') || name.includes('نقره') || name.includes('پلاتین')) {
                    tomanCurrencies.push(currency);
                } else {
                    // Cryptocurrencies (دلار based)
                    dollarCurrencies.push(currency);
                }
            });

            setCurrenciesData({
                تومان: tomanCurrencies,
                دلار: dollarCurrencies
            });
            
            setError(null);
        } catch (err) {
            console.error('Error fetching currencies:', err);
            setError('خطا در دریافت اطلاعات ارزها');
        } finally {
            setLoading(false);
        }
    };

    const sortData = (data) => {
        const sorted = [...data];
        switch (sortBy) {
            case 'price':
                return sorted.sort((a, b) => b.price_irr - a.price_irr);
            case 'change':
                return sorted.sort((a, b) => b.change_percent_24h - a.change_percent_24h);
            case 'volume':
                return sorted.sort((a, b) => b.volume_24h - a.volume_24h);
            case 'name':
                return sorted.sort((a, b) => a.currency_name.localeCompare(b.currency_name, 'fa'));
            default:
                return sorted;
        }
    };

    const filterData = (data) => {
        if (!filterText) return data;
        return data.filter(item => 
            item.currency_code.toLowerCase().includes(filterText.toLowerCase()) ||
            item.currency_name.includes(filterText)
        );
    };

    const formatNumber = (num) => {
        if (!num && num !== 0) return '0';
        return new Intl.NumberFormat('en-US').format(Math.round(num));
    };

    const formatPrice = (price) => {
        if (!price && price !== 0) return '0';
        if (activeTab === 'دلار' && price < 100) {
            return new Intl.NumberFormat('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }).format(price) + ' $';
        }
        return new Intl.NumberFormat('en-US').format(Math.round(price));
    };

    const formatPercent = (percent) => {
        if (!percent && percent !== 0) return '0%';
        const sign = percent >= 0 ? '+' : '';
        return `${sign}${percent.toFixed(2)}%`;
    };

    const getChangeColor = (change) => {
        if (change > 0) return '#4CAF50';
        if (change < 0) return '#f44336';
        return '#9E9E9E';
    };

    const processedData = sortData(filterData(currenciesData[activeTab]));

    return (
        <div className="currencies-page">
            <div className="currencies-header">
                <h1>بازار ارز و طلا</h1>
                <div className="header-controls">
                    <div className="search-box">
                        <input
                            type="text"
                            placeholder="جستجو..."
                            value={filterText}
                            onChange={(e) => setFilterText(e.target.value)}
                        />
                    </div>
                    <div className="sort-control">
                        <label>مرتب‌سازی:</label>
                        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                            <option value="price">قیمت</option>
                            <option value="change">تغییرات</option>
                            <option value="volume">حجم معاملات</option>
                            <option value="name">نام</option>
                        </select>
                    </div>
                    <div className="update-control">
                        <label>بروزرسانی:</label>
                        <select value={updateInterval} onChange={(e) => setUpdateInterval(Number(e.target.value))}>
                            <option value={10000}>10 ثانیه</option>
                            <option value={30000}>30 ثانیه</option>
                            <option value={60000}>1 دقیقه</option>
                            <option value={300000}>5 دقیقه</option>
                        </select>
                    </div>
                </div>
            </div>

            <div className="currencies-tabs">
                <button
                    className={`tab-button ${activeTab === 'تومان' ? 'active' : ''}`}
                    onClick={() => setActiveTab('تومان')}
                >
                    <span className="tab-icon">💵</span>
                    ارزهای فیات و کالا
                    <span className="tab-badge">{currenciesData.تومان.length}</span>
                </button>
                <button
                    className={`tab-button ${activeTab === 'دلار' ? 'active' : ''}`}
                    onClick={() => setActiveTab('دلار')}
                >
                    <span className="tab-icon">₿</span>
                    ارزهای دیجیتال
                    <span className="tab-badge">{currenciesData.دلار.length}</span>
                </button>
            </div>

            <div className="currencies-content">
                {loading && processedData.length === 0 ? (
                    <div>
                        <LoadingSpinner 
                            type="pulse" 
                            message="در حال بارگذاری ارزها..." 
                            size="large"
                        />
                        <LoadingGrid items={8} itemHeight={180} />
                    </div>
                ) : error ? (
                    <div className="error-container">
                        <p>{error}</p>
                        <button onClick={fetchCurrencies}>تلاش مجدد</button>
                    </div>
                ) : (
                    <div className="currencies-grid loading-transition">
                        {processedData.map((currency, index) => (
                            <div 
                                key={currency.currency_code} 
                                className="currency-card loading-transition"
                                style={{ animationDelay: `${index * 0.05}s` }}
                            >
                                <div className="card-header">
                                    <div className="currency-info">
                                        <h3>{currency.currency_name}</h3>
                                        <span className="currency-code">{currency.currency_code}</span>
                                    </div>
                                    <div className="currency-icon">
                                        {activeTab === 'دلار' ? '₿' : '💱'}
                                    </div>
                                </div>
                                
                                <div className="card-body">
                                    <div className="price-section">
                                        <span className="label">قیمت:</span>
                                        <span className="price">{formatPrice(currency.price_irr)}</span>
                                    </div>
                                    
                                    <div className="change-section">
                                        <span className="label">تغییر 24h:</span>
                                        <div className="change-values">
                                            <span 
                                                className="change-amount"
                                                style={{ color: getChangeColor(currency.change_24h) }}
                                            >
                                                {formatNumber(currency.change_24h)}
                                            </span>
                                            <span 
                                                className="change-percent"
                                                style={{ 
                                                    backgroundColor: getChangeColor(currency.change_percent_24h),
                                                    color: 'white'
                                                }}
                                            >
                                                {formatPercent(currency.change_percent_24h)}
                                            </span>
                                        </div>
                                    </div>
                                    
                                    <div className="volume-section">
                                        <span className="label">حجم معاملات:</span>
                                        <span className="volume">{formatNumber(currency.volume_24h)}</span>
                                    </div>
                                </div>

                                <div className="card-footer">
                                    <button className="action-button chart-btn">
                                        نمودار
                                    </button>
                                    <button className="action-button details-btn">
                                        جزئیات
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {!loading && (
                <div className="currencies-footer">
                    <div className="stats-summary">
                        <div className="stat-item">
                            <span className="stat-label">تعداد کل:</span>
                            <span className="stat-value">{processedData.length}</span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-label">صعودی:</span>
                            <span className="stat-value positive">
                                {processedData.filter(c => c.change_percent_24h > 0).length}
                            </span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-label">نزولی:</span>
                            <span className="stat-value negative">
                                {processedData.filter(c => c.change_percent_24h < 0).length}
                            </span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Currencies;