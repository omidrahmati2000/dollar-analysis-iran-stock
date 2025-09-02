import React, { useState, useEffect } from 'react';
import './IndustryAnalysis.css';
import LoadingSpinner, { LoadingGrid } from '../../components/Loading/LoadingSpinner';

const IndustryAnalysis = () => {
    const [industryGroups, setIndustryGroups] = useState([]);
    const [selectedIndustry, setSelectedIndustry] = useState(null);
    const [industryStocks, setIndustryStocks] = useState([]);
    const [marketStats, setMarketStats] = useState({});
    const [priceType, setPriceType] = useState(3);
    const [loading, setLoading] = useState(true);
    const [stocksLoading, setStocksLoading] = useState(false);
    const [sortBy, setSortBy] = useState('performance');
    const [stockSortBy, setStockSortBy] = useState('performance');
    const [searchText, setSearchText] = useState('');

    useEffect(() => {
        fetchData();
    }, [priceType, sortBy]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [groupsResponse, statsResponse] = await Promise.all([
                fetch(`http://localhost:8000/api/v2/market/industry-groups?price_type=${priceType}&sort_by=${sortBy}`),
                fetch('http://localhost:8000/api/v2/market/stats')
            ]);

            const groupsData = await groupsResponse.json();
            const statsData = await statsResponse.json();

            setIndustryGroups(groupsData.groups || []);
            setMarketStats(statsData);
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchIndustryStocks = async (industryName) => {
        try {
            setStocksLoading(true);
            const response = await fetch(
                `http://localhost:8000/api/v2/market/industry-groups/${encodeURIComponent(industryName)}/stocks?price_type=${priceType}&sort_by=${stockSortBy}&limit=100`
            );
            const data = await response.json();
            setIndustryStocks(data.stocks || []);
        } catch (error) {
            console.error('Error fetching industry stocks:', error);
            setIndustryStocks([]);
        } finally {
            setStocksLoading(false);
        }
    };

    const handleIndustryClick = (industry) => {
        setSelectedIndustry(industry);
        fetchIndustryStocks(industry.industry_group);
    };

    const formatNumber = (num) => {
        if (!num) return '0';
        return new Intl.NumberFormat('en-US').format(num);
    };

    const formatPercent = (num) => {
        if (!num && num !== 0) return '0%';
        return `${num.toFixed(2)}%`;
    };

    const getTrendColor = (trend) => {
        switch (trend) {
            case 'BULLISH': return '#4CAF50';
            case 'BEARISH': return '#f44336';
            default: return '#9E9E9E';
        }
    };

    const getPerformanceColor = (percent) => {
        if (percent > 0) return '#4CAF50';
        if (percent < 0) return '#f44336';
        return '#9E9E9E';
    };

    const filteredIndustryGroups = industryGroups.filter(group => {
        if (!searchText) return true;
        return group.industry_group.toLowerCase().includes(searchText.toLowerCase());
    });

    if (loading && industryGroups.length === 0) {
        return (
            <div className="industry-analysis">
                <div className="header">
                    <h1>تحلیل گروه‌های صنعتی</h1>
                </div>
                <LoadingSpinner 
                    type="pulse" 
                    message="در حال بارگذاری گروه‌های صنعتی..." 
                    size="large"
                />
                <LoadingGrid items={8} itemHeight={150} />
            </div>
        );
    }

    return (
        <div className="industry-analysis">
            <div className="header">
                <h1>تحلیل گروه‌های صنعتی</h1>
                <div className="controls">
                    <div className="search-control">
                        <label>جستجو:</label>
                        <input 
                            type="text"
                            placeholder="نام گروه صنعتی..."
                            value={searchText}
                            onChange={(e) => setSearchText(e.target.value)}
                        />
                    </div>
                    <div className="price-type-switch">
                        <label>نوع قیمت:</label>
                        <select 
                            value={priceType} 
                            onChange={(e) => setPriceType(parseInt(e.target.value))}
                        >
                            <option value={3}>تعدیل شده</option>
                            <option value={2}>تعدیل نشده</option>
                        </select>
                    </div>
                    <div className="sort-control">
                        <label>مرتب‌سازی:</label>
                        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                            <option value="performance">عملکرد</option>
                            <option value="total_stocks">تعداد سهام</option>
                            <option value="positive_ratio">نسبت مثبت</option>
                        </select>
                    </div>
                </div>
            </div>

            <div className="market-overview">
                <div className="stat-card">
                    <h3>کل سهام</h3>
                    <div className="value">{formatNumber(marketStats.total_stocks)}</div>
                </div>
                <div className="stat-card">
                    <h3>شرکت‌ها</h3>
                    <div className="value">{formatNumber(marketStats.companies)}</div>
                </div>
                <div className="stat-card">
                    <h3>گروه‌های فعال</h3>
                    <div className="value">{filteredIndustryGroups.length}</div>
                </div>
                <div className="stat-card">
                    <h3>نوع قیمت</h3>
                    <div className="value">{priceType === 3 ? 'تعدیل شده' : 'تعدیل نشده'}</div>
                </div>
            </div>

            <div className="content-wrapper">
                <div className="industry-groups-panel">
                    <h2>گروه‌های صنعتی</h2>
                    <div className="industry-groups-list">
                        {filteredIndustryGroups.map((group, index) => (
                            <div
                                key={index}
                                className={`industry-group ${selectedIndustry?.industry_group === group.industry_group ? 'selected' : ''}`}
                                onClick={() => handleIndustryClick(group)}
                            >
                                <div className="group-header">
                                    <h4>{group.industry_group}</h4>
                                    <div 
                                        className="trend-badge"
                                        style={{ backgroundColor: getTrendColor(group.trend) }}
                                    >
                                        {group.trend === 'BULLISH' ? 'صعودی' : 
                                         group.trend === 'BEARISH' ? 'نزولی' : 'خنثی'}
                                    </div>
                                </div>
                                
                                <div className="group-stats">
                                    <div className="stat">
                                        <span className="label">تعداد سهام:</span>
                                        <span className="value">{formatNumber(group.total_stocks)}</span>
                                    </div>
                                    <div className="stat">
                                        <span className="label">میانگین تغییر:</span>
                                        <span 
                                            className="value"
                                            style={{ color: getPerformanceColor(group.avg_change_percent) }}
                                        >
                                            {formatPercent(group.avg_change_percent)}
                                        </span>
                                    </div>
                                    <div className="stat">
                                        <span className="label">سهام مثبت:</span>
                                        <span className="value positive">{formatNumber(group.positive_stocks)}</span>
                                    </div>
                                    <div className="stat">
                                        <span className="label">سهام منفی:</span>
                                        <span className="value negative">{formatNumber(group.negative_stocks)}</span>
                                    </div>
                                </div>

                                <div className="performance-bars">
                                    <div className="bar-container">
                                        <div 
                                            className="positive-bar"
                                            style={{ width: `${group.positive_ratio}%` }}
                                        />
                                        <div 
                                            className="negative-bar"
                                            style={{ width: `${group.negative_ratio}%` }}
                                        />
                                    </div>
                                    <div className="bar-labels">
                                        <span className="positive">{formatPercent(group.positive_ratio)}</span>
                                        <span className="negative">{formatPercent(group.negative_ratio)}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="industry-stocks-panel">
                    {selectedIndustry ? (
                        <>
                            <div className="panel-header">
                                <h2>سهام {selectedIndustry.industry_group}</h2>
                                <select 
                                    value={stockSortBy} 
                                    onChange={(e) => {
                                        setStockSortBy(e.target.value);
                                        if (selectedIndustry) {
                                            fetchIndustryStocks(selectedIndustry.industry_group);
                                        }
                                    }}
                                >
                                    <option value="performance">عملکرد</option>
                                    <option value="price">قیمت</option>
                                    <option value="volume">حجم</option>
                                    <option value="market_value">ارزش بازار</option>
                                    <option value="symbol">نماد</option>
                                    <option value="name">نام</option>
                                </select>
                            </div>

                            <div className="stocks-list">
                                {stocksLoading ? (
                                    <LoadingSpinner 
                                        type="dots" 
                                        message="در حال بارگذاری سهام..." 
                                        size="small"
                                    />
                                ) : (
                                    <table className="stocks-table">
                                        <thead>
                                            <tr>
                                                <th>نماد</th>
                                                <th>نام شرکت</th>
                                                <th>قیمت</th>
                                                <th>تغییر</th>
                                                <th>درصد تغییر</th>
                                                <th>حجم</th>
                                                <th>P/E</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {industryStocks.map((stock, index) => (
                                                <tr key={index}>
                                                    <td className="symbol">{stock.symbol}</td>
                                                    <td className="company-name">{stock.company_name}</td>
                                                    <td className="price">{formatNumber(stock.last_price)}</td>
                                                    <td 
                                                        className="change"
                                                        style={{ color: getPerformanceColor(stock.price_change) }}
                                                    >
                                                        {formatNumber(stock.price_change)}
                                                    </td>
                                                    <td 
                                                        className="change-percent"
                                                        style={{ color: getPerformanceColor(stock.price_change_percent) }}
                                                    >
                                                        {formatPercent(stock.price_change_percent)}
                                                    </td>
                                                    <td className="volume">{formatNumber(stock.volume)}</td>
                                                    <td className="pe-ratio">
                                                        {stock.pe_ratio ? formatNumber(stock.pe_ratio) : '-'}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="no-selection">
                            <h3>گروه صنعتی را انتخاب کنید</h3>
                            <p>برای مشاهده سهام‌های هر گروه، روی آن کلیک کنید</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default IndustryAnalysis;