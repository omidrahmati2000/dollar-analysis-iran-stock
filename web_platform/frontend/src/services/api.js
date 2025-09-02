import React, { createContext, useContext } from 'react';
import axios from 'axios';

// Create API client
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

class ApiService {
  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor for auth
    this.client.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('access_token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response.data.data || response.data,
      (error) => {
        if (error.response?.status === 401) {
          localStorage.removeItem('access_token');
          localStorage.removeItem('user');
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  // Market Data APIs
  async getMarketSummary() {
    return this.client.get('/market/summary');
  }

  async getStockSymbols(params = {}) {
    return this.client.get('/market/stocks/symbols', { params });
  }

  async getCurrencies(params = {}) {
    return this.client.get('/market/currencies', { params });
  }

  async getPriceData(symbol, params = {}) {
    return this.client.get(`/market/price/${symbol}`, { params });
  }

  async getSymbolInfo(symbol) {
    return this.client.get(`/market/symbol/${symbol}/info`);
  }

  async searchSymbols(query, params = {}) {
    return this.client.get('/market/search', { params: { query, ...params } });
  }

  // Technical Indicators APIs
  async getAvailableIndicators() {
    return this.client.get('/indicators/available');
  }

  async calculateIndicator(indicatorType, symbol, config = {}) {
    return this.client.post(`/indicators/calculate/${indicatorType}`, {
      symbol,
      ...config
    });
  }

  async calculateMultipleIndicators(symbol, indicators, params = {}) {
    return this.client.post('/indicators/batch', {
      symbol,
      indicators,
      ...params
    });
  }

  async getTradingSignals(symbol, params = {}) {
    return this.client.get(`/indicators/signals/${symbol}`, { params });
  }

  // Portfolio APIs
  async getPortfolios() {
    return this.client.get('/portfolio/');
  }

  async createPortfolio(name) {
    return this.client.post('/portfolio/', { name });
  }

  async getPortfolio(portfolioId) {
    return this.client.get(`/portfolio/${portfolioId}`);
  }

  // Watchlist APIs
  async getWatchlists() {
    return this.client.get('/watchlist/');
  }

  async createWatchlist(data) {
    return this.client.post('/watchlist/', data);
  }

  // Alerts APIs
  async getAlerts() {
    return this.client.get('/alerts/');
  }

  async createAlert(data) {
    return this.client.post('/alerts/', data);
  }

  // Screener APIs
  async scanStocks(filters) {
    return this.client.post('/screener/scan', filters);
  }

  // Backtest APIs
  async runBacktest(strategy) {
    return this.client.post('/backtest/run', strategy);
  }

  // Auth APIs
  async login(credentials) {
    const response = await axios.post(`${API_BASE_URL.replace('/api', '')}/auth/login`, credentials);
    return response.data;
  }

  async register(userData) {
    const response = await axios.post(`${API_BASE_URL.replace('/api', '')}/auth/register`, userData);
    return response.data;
  }

  async getCurrentUser() {
    const response = await axios.get(`${API_BASE_URL.replace('/api', '')}/auth/me`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('access_token')}`
      }
    });
    return response.data;
  }
}

// Create service instance
export const apiService = new ApiService();

// React Context
const ApiContext = createContext();

export const ApiProvider = ({ children }) => {
  return (
    <ApiContext.Provider value={apiService}>
      {children}
    </ApiContext.Provider>
  );
};

export const useApi = () => {
  const context = useContext(ApiContext);
  if (!context) {
    throw new Error('useApi must be used within an ApiProvider');
  }
  return context;
};