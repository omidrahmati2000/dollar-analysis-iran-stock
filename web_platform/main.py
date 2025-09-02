"""
FastAPI Web Server for Trading Platform
Provides REST API and WebSocket endpoints for real-time data
"""

import asyncio
from contextlib import asynccontextmanager
from typing import Dict, List, Optional, Any
import os
import uvicorn
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, FileResponse
from pydantic import BaseModel
import json
import logging
from datetime import datetime, timedelta
import pandas as pd

from .api import api_router
from .websocket import WebSocketManager
from .auth import auth_router
from .models import *
from ..database.db_manager import DatabaseManager
from ..trading_platform.services.container import ServiceContainer
from ..trading_platform.indicators.factory import IndicatorFactory

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Global managers
websocket_manager = WebSocketManager()
db_manager = None
service_container = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan management"""
    # Startup
    global db_manager, service_container
    
    logger.info("🚀 Starting Iran Market Trading Platform Web Server...")
    
    # Initialize database
    db_manager = DatabaseManager()
    
    # Initialize service container
    service_container = ServiceContainer()
    
    # Register services
    from ..trading_platform.config import AppConfig
    config = AppConfig()
    service_container.register('config', config)
    service_container.register('db_manager', db_manager)
    
    # Start background tasks
    asyncio.create_task(websocket_manager.start_price_updates())
    
    logger.info("✅ Web server initialized successfully")
    
    yield
    
    # Shutdown
    logger.info("🛑 Shutting down web server...")
    await websocket_manager.stop_price_updates()

# Create FastAPI app
app = FastAPI(
    title="🚀 Iran Market Trading Platform",
    description="Professional trading platform for Iranian stock market and currency analysis",
    version="2.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes
app.include_router(api_router, prefix="/api")
app.include_router(auth_router, prefix="/auth")

# Serve static files (React build)
try:
    app.mount("/static", StaticFiles(directory="web_platform/frontend/build/static"), name="static")
except:
    logger.warning("Frontend static files not found - run 'npm run build' in frontend directory")

@app.get("/", response_class=HTMLResponse)
async def serve_frontend():
    """Serve React frontend"""
    try:
        return FileResponse("web_platform/frontend/build/index.html")
    except:
        return HTMLResponse("""
        <html>
            <head>
                <title>🚀 Iran Market Trading Platform</title>
                <style>
                    body { 
                        font-family: 'Segoe UI', Arial, sans-serif; 
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        margin: 0; padding: 40px; color: white; text-align: center;
                    }
                    .container { max-width: 800px; margin: 0 auto; }
                    .card { background: rgba(255,255,255,0.1); padding: 30px; border-radius: 15px; backdrop-filter: blur(10px); }
                    .status { color: #4CAF50; font-size: 18px; margin: 20px 0; }
                    .api-link { color: #FFD700; text-decoration: none; font-weight: bold; }
                    .api-link:hover { text-decoration: underline; }
                    h1 { font-size: 2.5em; margin-bottom: 10px; }
                    h2 { color: #FFD700; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="card">
                        <h1>🚀 Iran Market Trading Platform</h1>
                        <h2>TradingView-like Professional Platform</h2>
                        
                        <div class="status">✅ Backend Server is Running</div>
                        
                        <h3>🔗 Available Endpoints:</h3>
                        <p><a href="/api/docs" class="api-link">📚 API Documentation (Swagger)</a></p>
                        <p><a href="/api/redoc" class="api-link">📖 API Documentation (ReDoc)</a></p>
                        <p><a href="/api/health" class="api-link">💚 Health Check</a></p>
                        <p><a href="/api/stocks/symbols" class="api-link">📊 Stock Symbols</a></p>
                        <p><a href="/api/currencies" class="api-link">💱 Currencies</a></p>
                        
                        <h3>🛠️ Setup Frontend:</h3>
                        <div style="text-align: left; max-width: 600px; margin: 20px auto; background: rgba(0,0,0,0.3); padding: 20px; border-radius: 10px; font-family: monospace;">
                            # Install frontend dependencies<br>
                            cd web_platform/frontend<br>
                            npm install<br>
                            npm start<br><br>
                            # Or build for production<br>
                            npm run build
                        </div>
                        
                        <h3>🚀 Features:</h3>
                        <ul style="text-align: left; max-width: 500px; margin: 20px auto;">
                            <li>📈 Real-time price data streaming</li>
                            <li>🔍 20+ Technical indicators</li>
                            <li>📊 Interactive charts</li>
                            <li>💰 Iranian stocks & currencies</li>
                            <li>🔄 Portfolio management</li>
                            <li>📱 Responsive design</li>
                        </ul>
                    </div>
                </div>
            </body>
        </html>
        """)

@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "version": "2.0.0",
        "platform": "Iran Market Trading Platform"
    }

@app.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    """WebSocket endpoint for real-time data"""
    await websocket_manager.connect(websocket, client_id)
    try:
        while True:
            # Keep connection alive and handle client messages
            data = await websocket.receive_text()
            message = json.loads(data)
            
            # Handle different message types
            if message.get("type") == "subscribe":
                symbols = message.get("symbols", [])
                await websocket_manager.subscribe_to_symbols(client_id, symbols)
            elif message.get("type") == "unsubscribe":
                symbols = message.get("symbols", [])
                await websocket_manager.unsubscribe_from_symbols(client_id, symbols)
                
    except WebSocketDisconnect:
        websocket_manager.disconnect(client_id)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        websocket_manager.disconnect(client_id)

if __name__ == "__main__":
    uvicorn.run(
        "web_platform.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )