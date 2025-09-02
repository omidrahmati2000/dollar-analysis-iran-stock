/**
 * API Status Component - نمایش وضعیت اتصال به API
 */

import React, { useState, useEffect } from 'react';
import apiService from '../../services/api/base';
import { getGlobalCacheStats } from '../../services/cache/CacheManager';

const ApiStatus = () => {
  const [status, setStatus] = useState({
    api: 'checking',
    websocket: 'disconnected',
    lastUpdate: null,
    apiInfo: null,
    cacheStats: null
  });

  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    checkApiStatus();
    
    // Check status every 30 seconds
    const interval = setInterval(checkApiStatus, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const checkApiStatus = async () => {
    try {
      // Check API health
      const health = await apiService.healthCheck();
      const apiInfo = await apiService.getApiInfo();
      const cacheStats = getGlobalCacheStats();
      
      setStatus({
        api: health.status === 'error' ? 'offline' : 'online',
        websocket: 'disconnected', // Will be updated by WebSocket events
        lastUpdate: new Date(),
        apiInfo,
        cacheStats
      });
      
    } catch (error) {
      setStatus(prev => ({
        ...prev,
        api: 'offline',
        lastUpdate: new Date()
      }));
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'online': return '#4caf50';
      case 'offline': return '#f44336';
      case 'checking': return '#ff9800';
      default: return '#666';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'online': return '🟢';
      case 'offline': return '🔴';
      case 'checking': return '🟡';
      default: return '⚪';
    }
  };

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="api-status">
      <div className="status-summary" onClick={() => setShowDetails(!showDetails)}>
        <div className="status-item">
          <span className="status-icon">{getStatusIcon(status.api)}</span>
          <span className="status-label">API</span>
        </div>
        
        <div className="status-item">
          <span className="status-icon">{getStatusIcon(status.websocket)}</span>
          <span className="status-label">WebSocket</span>
        </div>
        
        {status.lastUpdate && (
          <div className="last-update">
            آخرین بروزرسانی: {status.lastUpdate.toLocaleTimeString('fa-IR')}
          </div>
        )}
        
        <button className="toggle-details">
          {showDetails ? '▲' : '▼'}
        </button>
      </div>

      {showDetails && (
        <div className="status-details">
          {/* API Information */}
          {status.apiInfo && (
            <div className="detail-section">
              <h4>🔧 API Information</h4>
              <div className="detail-grid">
                <div className="detail-item">
                  <span>Name:</span>
                  <span>{status.apiInfo.name || 'Iran Market API'}</span>
                </div>
                <div className="detail-item">
                  <span>Version:</span>
                  <span>{status.apiInfo.version || '1.0.0'}</span>
                </div>
                <div className="detail-item">
                  <span>Status:</span>
                  <span style={{ color: getStatusColor(status.api) }}>
                    {status.api.toUpperCase()}
                  </span>
                </div>
                <div className="detail-item">
                  <span>Base URL:</span>
                  <span>{process.env.REACT_APP_API_URL || 'http://localhost:8000'}</span>
                </div>
              </div>
            </div>
          )}

          {/* Cache Statistics */}
          {status.cacheStats && (
            <div className="detail-section">
              <h4>📦 Cache Statistics</h4>
              <div className="detail-grid">
                <div className="detail-item">
                  <span>Total Entries:</span>
                  <span>{status.cacheStats.totalSize}</span>
                </div>
                <div className="detail-item">
                  <span>Hit Rate:</span>
                  <span style={{ color: '#4caf50' }}>
                    {status.cacheStats.globalHitRate}
                  </span>
                </div>
                <div className="detail-item">
                  <span>Total Hits:</span>
                  <span>{status.cacheStats.totalHits.toLocaleString()}</span>
                </div>
                <div className="detail-item">
                  <span>Total Misses:</span>
                  <span>{status.cacheStats.totalMisses.toLocaleString()}</span>
                </div>
              </div>
              
              {/* Cache Namespaces */}
              <div className="cache-namespaces">
                <h5>Cache Namespaces:</h5>
                {status.cacheStats.namespaces.map(ns => (
                  <div key={ns.namespace} className="namespace-item">
                    <span className="namespace-name">{ns.namespace}</span>
                    <span className="namespace-size">{ns.size} entries</span>
                    <span className="namespace-hit-rate">{ns.hitRate}</span>
                    <span className="namespace-memory">{ns.memoryUsage}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="detail-section">
            <h4>⚡ Actions</h4>
            <div className="action-buttons">
              <button 
                onClick={checkApiStatus}
                className="action-btn refresh"
              >
                🔄 Refresh Status
              </button>
              <button 
                onClick={() => window.location.reload()}
                className="action-btn reload"
              >
                🔁 Reload App
              </button>
              <button 
                onClick={() => {
                  localStorage.clear();
                  window.location.reload();
                }}
                className="action-btn clear"
              >
                🧹 Clear Cache & Reload
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .api-status {
          position: fixed;
          top: 20px;
          right: 20px;
          background: #2d2d2d;
          border: 1px solid #404040;
          border-radius: 8px;
          z-index: 1000;
          min-width: 200px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        }

        .status-summary {
          padding: 12px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 15px;
          user-select: none;
        }

        .status-item {
          display: flex;
          align-items: center;
          gap: 5px;
        }

        .status-icon {
          font-size: 12px;
        }

        .status-label {
          font-size: 12px;
          color: #ccc;
          font-weight: 500;
        }

        .last-update {
          font-size: 10px;
          color: #888;
          margin-left: auto;
        }

        .toggle-details {
          background: none;
          border: none;
          color: #888;
          cursor: pointer;
          font-size: 12px;
        }

        .status-details {
          border-top: 1px solid #404040;
          padding: 15px;
          max-height: 400px;
          overflow-y: auto;
        }

        .detail-section {
          margin-bottom: 20px;
        }

        .detail-section h4 {
          color: #fff;
          font-size: 14px;
          margin-bottom: 10px;
          font-weight: 600;
        }

        .detail-section h5 {
          color: #ccc;
          font-size: 12px;
          margin-bottom: 8px;
          font-weight: 500;
        }

        .detail-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }

        .detail-item {
          display: flex;
          justify-content: space-between;
          font-size: 11px;
        }

        .detail-item span:first-child {
          color: #aaa;
        }

        .detail-item span:last-child {
          color: #fff;
          font-weight: 500;
        }

        .cache-namespaces {
          margin-top: 10px;
        }

        .namespace-item {
          display: grid;
          grid-template-columns: 1fr auto auto auto;
          gap: 10px;
          padding: 4px 0;
          font-size: 10px;
          border-bottom: 1px solid #333;
        }

        .namespace-name {
          color: #4caf50;
          font-weight: 500;
        }

        .namespace-size,
        .namespace-hit-rate,
        .namespace-memory {
          color: #ccc;
          text-align: right;
        }

        .action-buttons {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .action-btn {
          background: #404040;
          border: 1px solid #555;
          color: #fff;
          padding: 6px 10px;
          border-radius: 4px;
          font-size: 10px;
          cursor: pointer;
          transition: background 0.2s;
        }

        .action-btn:hover {
          background: #555;
        }

        .action-btn.refresh:hover {
          background: #4caf50;
        }

        .action-btn.reload:hover {
          background: #2196f3;
        }

        .action-btn.clear:hover {
          background: #f44336;
        }

        @media (max-width: 768px) {
          .api-status {
            position: relative;
            top: auto;
            right: auto;
            margin: 10px;
            width: calc(100% - 20px);
          }
        }
      `}</style>
    </div>
  );
};

export default ApiStatus;