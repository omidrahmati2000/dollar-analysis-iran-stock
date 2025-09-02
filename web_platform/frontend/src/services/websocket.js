import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import io from 'socket.io-client';

const WS_URL = process.env.REACT_APP_WS_URL || 'ws://localhost:8000';

class WebSocketService {
  constructor() {
    this.socket = null;
    this.listeners = new Map();
    this.subscriptions = new Set();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    this.isConnected = false;
    this.clientId = `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  connect() {
    if (this.socket?.connected) return;

    try {
      this.socket = new WebSocket(`${WS_URL}/ws/${this.clientId}`);
      
      this.socket.onopen = (event) => {
        console.log('✅ WebSocket connected:', event);
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.emit('connected', { clientId: this.clientId });
      };

      this.socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleMessage(data);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      this.socket.onclose = (event) => {
        console.log('❌ WebSocket disconnected:', event);
        this.isConnected = false;
        this.emit('disconnected');
        this.handleReconnect();
      };

      this.socket.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.emit('error', error);
      };

    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.isConnected = false;
  }

  handleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts);
      console.log(`Attempting to reconnect in ${delay}ms... (${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`);
      
      setTimeout(() => {
        this.reconnectAttempts++;
        this.connect();
      }, delay);
    } else {
      console.error('Max reconnection attempts reached');
      this.emit('maxReconnectAttemptsReached');
    }
  }

  handleMessage(data) {
    const { type, ...payload } = data;
    
    switch (type) {
      case 'connection_established':
        console.log('Connection established:', payload);
        break;
      
      case 'price_update':
        this.emit('priceUpdate', payload);
        break;
      
      case 'subscription_confirmed':
        console.log('Subscription confirmed:', payload.symbols);
        this.emit('subscriptionConfirmed', payload);
        break;
      
      case 'unsubscription_confirmed':
        console.log('Unsubscription confirmed:', payload.symbols);
        this.emit('unsubscriptionConfirmed', payload);
        break;
      
      default:
        console.log('Unknown message type:', type, payload);
    }
  }

  subscribeToSymbols(symbols) {
    if (!Array.isArray(symbols)) {
      symbols = [symbols];
    }
    
    symbols.forEach(symbol => this.subscriptions.add(symbol));
    
    if (this.isConnected) {
      this.send({
        type: 'subscribe',
        symbols: symbols
      });
    }
  }

  unsubscribeFromSymbols(symbols) {
    if (!Array.isArray(symbols)) {
      symbols = [symbols];
    }
    
    symbols.forEach(symbol => this.subscriptions.delete(symbol));
    
    if (this.isConnected) {
      this.send({
        type: 'unsubscribe',
        symbols: symbols
      });
    }
  }

  send(message) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket not connected, message not sent:', message);
    }
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
    
    return () => {
      this.listeners.get(event)?.delete(callback);
    };
  }

  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in ${event} listener:`, error);
        }
      });
    }
  }

  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      clientId: this.clientId,
      subscriptions: Array.from(this.subscriptions),
      reconnectAttempts: this.reconnectAttempts
    };
  }
}

// Create service instance
const wsService = new WebSocketService();

// React Context
const WebSocketContext = createContext();

export const WebSocketProvider = ({ children }) => {
  const [connectionStatus, setConnectionStatus] = useState({
    isConnected: false,
    clientId: null,
    subscriptions: [],
    reconnectAttempts: 0
  });

  const [prices, setPrices] = useState(new Map());

  useEffect(() => {
    // Connect on mount
    wsService.connect();

    // Set up event listeners
    const unsubscribes = [
      wsService.on('connected', (data) => {
        setConnectionStatus(wsService.getConnectionStatus());
      }),

      wsService.on('disconnected', () => {
        setConnectionStatus(wsService.getConnectionStatus());
      }),

      wsService.on('priceUpdate', (data) => {
        setPrices(prev => new Map(prev.set(data.symbol, {
          ...data,
          timestamp: new Date().toISOString()
        })));
      }),

      wsService.on('error', (error) => {
        console.error('WebSocket error:', error);
      })
    ];

    // Cleanup on unmount
    return () => {
      unsubscribes.forEach(unsub => unsub());
      wsService.disconnect();
    };
  }, []);

  const value = {
    wsService,
    connectionStatus,
    prices: Object.fromEntries(prices),
    subscribeToSymbols: wsService.subscribeToSymbols.bind(wsService),
    unsubscribeFromSymbols: wsService.unsubscribeFromSymbols.bind(wsService),
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
};

export { wsService };