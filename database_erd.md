# Iran Stock Market Database - Entity Relationship Diagram (ERD)

## Database Overview
This document describes the entity relationship diagram for the Iran Stock Market analysis platform database (`iran_market_data`).

## Entities and Relationships

### 1. stock_symbols (Main Entity)
**Purpose**: Stores information about stock symbols and companies listed on the Iranian stock market.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | integer | PRIMARY KEY, NOT NULL | Unique identifier for each stock symbol |
| symbol | varchar | NOT NULL | Stock symbol (e.g., "TAPICO", "IKCO") |
| company_name | varchar | NULLABLE | Full company name |
| isin | varchar | NULLABLE | International Securities Identification Number |
| internal_id | varchar | NULLABLE | Internal system identifier |
| industry_group | varchar | NULLABLE | Industry group name |
| industry_group_id | integer | NULLABLE | Industry group identifier |
| total_shares | bigint | NULLABLE | Total number of shares |
| base_volume | bigint | NULLABLE | Base trading volume |
| market_value | bigint | NULLABLE | Market capitalization |
| eps | numeric | NULLABLE | Earnings per share |
| pe_ratio | numeric | NULLABLE | Price to earnings ratio |
| created_at | timestamp | DEFAULT CURRENT_TIMESTAMP | Record creation time |
| updated_at | timestamp | DEFAULT CURRENT_TIMESTAMP | Record last update time |

### 2. stock_prices (Child of stock_symbols)
**Purpose**: Stores real-time and historical price data for stocks.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | integer | PRIMARY KEY, NOT NULL | Unique identifier |
| symbol_id | integer | FOREIGN KEY → stock_symbols(id) | Reference to stock symbol |
| time_recorded | time | NULLABLE | Time when data was recorded |
| threshold_min | integer | NULLABLE | Minimum price threshold |
| threshold_max | integer | NULLABLE | Maximum price threshold |
| min_price | integer | NULLABLE | Minimum price in session |
| max_price | integer | NULLABLE | Maximum price in session |
| yesterday_price | integer | NULLABLE | Previous day closing price |
| first_price | integer | NULLABLE | First trade price of the session |
| last_price | integer | NULLABLE | Last trade price |
| last_price_change | integer | NULLABLE | Change from previous price |
| last_price_change_percent | numeric | NULLABLE | Percentage change |
| closing_price | integer | NULLABLE | Official closing price |
| closing_price_change | integer | NULLABLE | Change from previous close |
| closing_price_change_percent | numeric | NULLABLE | Percentage change from previous close |
| trade_count | integer | NULLABLE | Number of trades |
| trade_volume | bigint | NULLABLE | Total trading volume |
| trade_value | bigint | NULLABLE | Total trading value |
| buy_count_individual | integer | NULLABLE | Individual buyer count |
| buy_count_legal | integer | NULLABLE | Legal entity buyer count |
| sell_count_individual | integer | NULLABLE | Individual seller count |
| sell_count_legal | integer | NULLABLE | Legal entity seller count |
| buy_volume_individual | bigint | NULLABLE | Individual buy volume |
| buy_volume_legal | bigint | NULLABLE | Legal entity buy volume |
| sell_volume_individual | bigint | NULLABLE | Individual sell volume |
| sell_volume_legal | bigint | NULLABLE | Legal entity sell volume |
| created_at | timestamp | DEFAULT CURRENT_TIMESTAMP | Record creation time |

### 3. candlestick_data (Child of stock_symbols)
**Purpose**: Stores OHLCV (Open, High, Low, Close, Volume) candlestick data for technical analysis.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | integer | PRIMARY KEY, NOT NULL | Unique identifier |
| symbol_id | integer | FOREIGN KEY → stock_symbols(id) | Reference to stock symbol |
| data_type | integer | NULLABLE | Data type identifier (daily, weekly, etc.) |
| date | date | NULLABLE | Trading date |
| time | time | NULLABLE | Trading time |
| open_price | integer | NULLABLE | Opening price |
| high_price | integer | NULLABLE | Highest price |
| low_price | integer | NULLABLE | Lowest price |
| close_price | integer | NULLABLE | Closing price |
| volume | bigint | NULLABLE | Trading volume |
| created_at | timestamp | DEFAULT CURRENT_TIMESTAMP | Record creation time |

### 4. order_book (Child of stock_symbols)
**Purpose**: Stores order book data showing buy/sell orders at different price levels.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | integer | PRIMARY KEY, NOT NULL | Unique identifier |
| symbol_id | integer | FOREIGN KEY → stock_symbols(id) | Reference to stock symbol |
| side | varchar | NULLABLE | Order side (BUY/SELL) |
| level | integer | NULLABLE | Price level in order book |
| count | integer | NULLABLE | Number of orders at this level |
| volume | bigint | NULLABLE | Total volume at this level |
| price | integer | NULLABLE | Price at this level |
| created_at | timestamp | DEFAULT CURRENT_TIMESTAMP | Record creation time |

### 5. currencies (Independent Entity)
**Purpose**: Stores information about currencies tracked in the system.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | integer | PRIMARY KEY, NOT NULL | Unique identifier |
| symbol | varchar | NOT NULL | Currency symbol (e.g., "USD", "EUR") |
| name | varchar | NULLABLE | Currency full name |
| sign | varchar | NULLABLE | Currency sign/symbol ($, €, etc.) |
| unit | varchar | NULLABLE | Currency unit |
| icon_base_url | varchar | NULLABLE | Base URL for currency icon |
| icon_path | varchar | NULLABLE | Path to currency icon |
| created_at | timestamp | DEFAULT CURRENT_TIMESTAMP | Record creation time |
| updated_at | timestamp | DEFAULT CURRENT_TIMESTAMP | Record last update time |

### 6. currency_history (Child of currencies)
**Purpose**: Stores historical exchange rate data for currencies.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | integer | PRIMARY KEY, NOT NULL | Unique identifier |
| currency_id | integer | FOREIGN KEY → currencies(id) | Reference to currency |
| date | date | NOT NULL | Trading date |
| open_price | numeric | NULLABLE | Opening exchange rate |
| high_price | numeric | NULLABLE | Highest exchange rate |
| low_price | numeric | NULLABLE | Lowest exchange rate |
| close_price | numeric | NULLABLE | Closing exchange rate |
| created_at | timestamp | DEFAULT CURRENT_TIMESTAMP | Record creation time |

## Entity Relationships

### Primary Relationships:
1. **stock_symbols** (1) → **stock_prices** (Many)
   - One stock symbol can have many price records
   - Foreign Key: `stock_prices.symbol_id` → `stock_symbols.id`

2. **stock_symbols** (1) → **candlestick_data** (Many)
   - One stock symbol can have many candlestick data points
   - Foreign Key: `candlestick_data.symbol_id` → `stock_symbols.id`

3. **stock_symbols** (1) → **order_book** (Many)
   - One stock symbol can have many order book entries
   - Foreign Key: `order_book.symbol_id` → `stock_symbols.id`

4. **currencies** (1) → **currency_history** (Many)
   - One currency can have many historical records
   - Foreign Key: `currency_history.currency_id` → `currencies.id`

### ERD Visual Representation:
```
┌─────────────────┐     ┌─────────────────┐
│  stock_symbols  │────→│  stock_prices   │
│                 │     │                 │
│ • id (PK)       │     │ • id (PK)       │
│ • symbol        │     │ • symbol_id (FK)│
│ • company_name  │     │ • last_price    │
│ • isin          │     │ • trade_volume  │
│ • ...           │     │ • ...           │
└─────────────────┘     └─────────────────┘
         │                        
         │               ┌─────────────────┐
         └──────────────→│ candlestick_data│
         │               │                 │
         │               │ • id (PK)       │
         │               │ • symbol_id (FK)│
         │               │ • open_price    │
         │               │ • close_price   │
         │               │ • volume        │
         │               │ • ...           │
         │               └─────────────────┘
         │                        
         │               ┌─────────────────┐
         └──────────────→│   order_book    │
                         │                 │
                         │ • id (PK)       │
                         │ • symbol_id (FK)│
                         │ • side          │
                         │ • price         │
                         │ • volume        │
                         │ • ...           │
                         └─────────────────┘

┌─────────────────┐     ┌─────────────────┐
│   currencies    │────→│currency_history │
│                 │     │                 │
│ • id (PK)       │     │ • id (PK)       │
│ • symbol        │     │ • currency_id(FK)│
│ • name          │     │ • date          │
│ • sign          │     │ • open_price    │
│ • ...           │     │ • close_price   │
└─────────────────┘     │ • ...           │
                        └─────────────────┘
```

## Business Rules and Constraints

### Data Integrity Rules:
1. **stock_symbols.symbol** must be unique and not null
2. **currencies.symbol** must be unique and not null
3. **currency_history.date** must be not null
4. All foreign key relationships maintain referential integrity
5. Timestamps automatically set to CURRENT_TIMESTAMP on creation

### Data Types and Storage:
- **Price fields**: Stored as integers (likely in smallest currency unit, e.g., Rials)
- **Volume fields**: Stored as bigint to handle large trading volumes
- **Percentage fields**: Stored as numeric for precision
- **Timestamps**: Without timezone (assuming local Iran time)

## Indexes Recommendations:
Based on the structure, the following indexes would improve performance:
1. `stock_symbols.symbol` (unique index)
2. `stock_prices.symbol_id, created_at`
3. `candlestick_data.symbol_id, date`
4. `order_book.symbol_id, created_at`
5. `currencies.symbol` (unique index)
6. `currency_history.currency_id, date`

## Notes:
- The database appears to be designed for Iranian stock market data collection and analysis
- Price fields are stored as integers, suggesting prices are stored in the smallest currency unit
- The system supports both real-time data (stock_prices) and historical analysis (candlestick_data)
- Order book data allows for market depth analysis
- Currency tracking supports forex analysis alongside stock data