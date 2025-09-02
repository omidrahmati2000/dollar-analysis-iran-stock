# Iran Market Trading Platform

A comprehensive trading platform for Iranian stock market analysis with professional charts, real-time data, and advanced technical indicators.

## ✨ Features

### 🎯 **Core Trading Platform**
- **Professional Charts**: TradingView-like candlestick charts with technical indicators
- **Real-time Data**: Live stock prices and currency exchange rates
- **Technical Analysis**: Moving averages, RSI, MACD, Bollinger Bands
- **Market Screener**: Advanced filtering and search capabilities
- **Portfolio Tracking**: Monitor your investments and performance

### 📊 **Data Sources**
- Iranian stock market data via BrsApi.ir
- Currency exchange rates (USD, EUR, Gold, etc.)
- Real-time price updates and historical data
- Market statistics and trading volumes

### 🚀 **Multiple Interfaces**
- **Desktop GUI**: Professional PyQt5 interface with advanced charts
- **REST API**: Comprehensive FastAPI backend with Swagger documentation
- **Web Platform**: Modern React-based web interface (coming soon)

## 🛠️ Quick Start

### Prerequisites
- Docker and Docker Compose
- Python 3.8+ (for local development)
- Git

### 1. Clone the Repository
```bash
git clone <your-repo-url>
cd iran-market-trading-platform
```

### 2. Set Up Environment
```bash
# Copy environment template
cp .env.example .env

# Edit .env file with your API keys and configuration
# Get your BRS API key from: https://brsapi.ir
```

### 3. Start the Platform
```bash
# Start with the complete launcher (recommended)
./start_platform_docker.bat  # Windows
# or
./start_platform_docker.sh   # Linux/Mac

# Or manually with Docker Compose
docker-compose up -d
```

### 4. Access the Platform

**🎮 Desktop GUI Application**
- Automatically launched by the complete launcher
- Professional trading interface with advanced charts
- Real-time data updates

**🌐 API Documentation**
- URL: http://localhost:8000/docs
- Interactive Swagger interface
- Complete API reference

**📊 Database Admin** 
- URL: http://localhost:5050
- Email: admin@example.com
- Password: admin123

## 📋 Configuration

### API Keys Setup
1. Register at [BrsApi.ir](https://brsapi.ir) to get your API keys
2. Edit `.env` file:
```env
BRSAPI_FREE_KEY=your_free_api_key_here
BRSAPI_PRO_KEY=your_pro_api_key_here
```

### Database Configuration
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=iran_market_data
DB_USER=postgres
DB_PASSWORD=your_secure_password
```

## 🔒 Security & Production

### Environment Variables
**IMPORTANT**: Never commit sensitive information to Git. Always use environment variables for:
- API keys (`BRSAPI_FREE_KEY`, `BRSAPI_PRO_KEY`)
- Database passwords (`DB_PASSWORD`, `POSTGRES_PASSWORD`)
- JWT secret keys (`SECRET_KEY`)

### Production Deployment
1. Copy `.env.example` to `.env` and fill in your actual values
2. Use strong, unique passwords for production
3. Set `DEBUG=false` in production
4. Configure proper firewall rules
5. Use SSL/TLS certificates for HTTPS
6. Regular security updates

### Docker Security
- Change default passwords in `docker-compose.yml`
- Use Docker secrets for sensitive data in production
- Limit container resource usage
- Run containers with non-root users when possible

## 🏗️ Architecture

```
iran-market-trading-platform/
├── trading_platform/          # Desktop GUI application
│   ├── gui/                   # PyQt5 user interface
│   ├── api/                   # FastAPI REST API
│   └── services/              # Business logic
├── web_platform/              # Web-based interface
├── data_fetchers/             # Data collection modules  
├── database/                  # Database schemas
└── docker-compose.yml         # Container orchestration
```

## 🖥️ Desktop GUI Features

### Professional Charts
- **Candlestick Charts**: OHLCV visualization with volume bars
- **Technical Indicators**: SMA, EMA, RSI, MACD, Bollinger Bands
- **Multiple Timeframes**: 1 week to 2 years of historical data
- **Dark Theme**: Professional trading interface
- **Auto-refresh**: Real-time data updates

### Market Analysis
- **Stock Screener**: Filter by volume, price, change percentage
- **Symbol Search**: Quick symbol lookup with autocomplete
- **Market Summary**: Total volume, trades, and market capitalization
- **Currency Rates**: Real-time exchange rates

## 🌐 API Endpoints

### Stocks
- `GET /api/v2/stocks` - Get stock list with filtering
- `GET /api/v2/stocks/{symbol}` - Get specific stock details  
- `GET /api/v2/stocks/{symbol}/ohlcv` - Get OHLCV historical data
- `GET /api/v2/stocks/search/{query}` - Search stocks

### Currencies  
- `GET /api/v2/currencies` - Get currency exchange rates
- `POST /api/v2/currencies/convert` - Convert between currencies

### Technical Analysis
- `GET /api/v2/indicators/{symbol}` - Calculate technical indicators
- `GET /api/v2/market/summary` - Get market statistics

## 🔧 Development

### Local Development Setup
```bash
# Create virtual environment
python -m venv .venv
source .venv/bin/activate  # Linux/Mac
# or
.venv\\Scripts\\activate   # Windows

# Install dependencies
pip install -r requirements.txt

# Run API server
cd trading_platform
python -m uvicorn api.main:app --reload

# Run GUI application
python gui/main_gui.py
```

### Running Tests
```bash
# API tests
pytest trading_platform/tests/

# GUI tests (requires display)
python trading_platform/gui/main_gui.py --test
```

## 📊 Data Management

### Manual Data Synchronization
```bash
# Enter the app container
docker exec -it iran-market-app-v2 bash

# Sync stock symbols
python main.py --mode stocks

# Sync currency data  
python main.py --mode currencies

# Full market data sync
python main.py --mode full
```

### Database Schema
- **stock_symbols**: Stock symbol definitions
- **stock_prices**: Historical price data
- **currencies**: Currency exchange rates
- **technical_indicators**: Calculated indicator values

## 🛡️ Security

### Production Deployment
1. **Change Default Passwords**: Update all default credentials
2. **Set Secure JWT Secret**: Generate a strong SECRET_KEY
3. **Use Environment Variables**: Never commit secrets to code
4. **Enable HTTPS**: Use reverse proxy with SSL certificates
5. **Database Security**: Use strong passwords and network isolation

### Environment Variables
```env
# Required in production
SECRET_KEY=your-super-secure-jwt-secret-key-minimum-32-characters
BRSAPI_FREE_KEY=your_actual_api_key
BRSAPI_PRO_KEY=your_actual_pro_key
DB_PASSWORD=secure_database_password
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)  
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [BrsApi.ir](https://brsapi.ir) for providing Iranian market data APIs
- PyQt5 for the professional desktop interface
- FastAPI for the high-performance REST API
- PostgreSQL for reliable data storage

## 📞 Support

- **Issues**: Report bugs and feature requests on [GitHub Issues](../../issues)
- **API Documentation**: http://localhost:8000/docs (when running)
- **BRS API Docs**: https://brsapi.ir/docs

---

**⚠️ Disclaimer**: This software is for educational and research purposes. Always verify data and perform due diligence before making financial decisions.