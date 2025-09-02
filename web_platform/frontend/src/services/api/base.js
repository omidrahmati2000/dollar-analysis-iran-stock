/**
 * Base API Service - مدیریت کلی تعامل با بک‌اند
 * Architecture: Service Layer Pattern with Repository Pattern
 */

import axios from 'axios';

class ApiService {
  constructor() {
    this.baseURL = process.env.REACT_APP_API_URL || 'http://localhost:8000';
    this.timeout = 10000; // 10 seconds
    
    // Create axios instance
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: this.timeout,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    // Setup interceptors
    this.setupInterceptors();
  }

  setupInterceptors() {
    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        // Add timestamp to prevent caching
        config.params = {
          ...config.params,
          _t: Date.now()
        };

        console.log(`🚀 API Request: ${config.method?.toUpperCase()} ${config.url}`, {
          params: config.params,
          data: config.data
        });

        return config;
      },
      (error) => {
        console.error('❌ Request Error:', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => {
        console.log(`✅ API Response: ${response.config.url}`, {
          status: response.status,
          data: response.data
        });
        
        return response.data;
      },
      (error) => {
        console.error('❌ API Error:', {
          url: error.config?.url,
          status: error.response?.status,
          message: error.message,
          data: error.response?.data
        });

        // Handle different error types
        if (error.response?.status === 404) {
          throw new ApiError('NOT_FOUND', 'منبع مورد نظر یافت نشد', error.response.data);
        }

        if (error.response?.status === 500) {
          throw new ApiError('SERVER_ERROR', 'خطای داخلی سرور', error.response.data);
        }

        if (error.code === 'ECONNABORTED') {
          throw new ApiError('TIMEOUT', 'زمان انتظار تمام شد', { timeout: this.timeout });
        }

        if (!error.response) {
          throw new ApiError('NETWORK_ERROR', 'خطا در اتصال به شبکه', { message: error.message });
        }

        throw new ApiError('UNKNOWN_ERROR', 'خطای نامشخص', error.response?.data);
      }
    );
  }

  // Generic CRUD operations
  async get(url, params = {}) {
    return await this.client.get(url, { params });
  }

  async post(url, data = {}) {
    return await this.client.post(url, data);
  }

  async put(url, data = {}) {
    return await this.client.put(url, data);
  }

  async delete(url) {
    return await this.client.delete(url);
  }

  async patch(url, data = {}) {
    return await this.client.patch(url, data);
  }

  // Health check
  async healthCheck() {
    try {
      const response = await this.get('/health');
      return response;
    } catch (error) {
      console.warn('⚠️ Backend is not responding:', error.message);
      return { status: 'error', message: 'Backend unavailable' };
    }
  }

  // Get API info
  async getApiInfo() {
    try {
      return await this.get('/');
    } catch (error) {
      return { 
        name: 'Iran Market API',
        version: 'unknown',
        status: 'offline'
      };
    }
  }
}

// Custom Error Class
class ApiError extends Error {
  constructor(code, message, details = null) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.details = details;
    this.timestamp = Date.now();
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      details: this.details,
      timestamp: this.timestamp
    };
  }
}

// Singleton instance
const apiService = new ApiService();

export { ApiService, ApiError, apiService };
export default apiService;