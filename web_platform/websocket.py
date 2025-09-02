"""
WebSocket Manager for Real-time Data Streaming
Manages WebSocket connections and streams real-time price data
"""

import asyncio
import json
from typing import Dict, Set, List, Any
from datetime import datetime
import logging
from fastapi import WebSocket, WebSocketDisconnect

from ..database.db_manager import DatabaseManager

logger = logging.getLogger(__name__)

class WebSocketManager:
    """Manages WebSocket connections and real-time data streaming"""
    
    def __init__(self):
        # Active connections: {client_id: WebSocket}
        self.active_connections: Dict[str, WebSocket] = {}
        
        # Symbol subscriptions: {client_id: Set[symbols]}
        self.subscriptions: Dict[str, Set[str]] = {}
        
        # Price data cache: {symbol: latest_price_data}
        self.price_cache: Dict[str, Dict[str, Any]] = {}
        
        # Background task
        self.update_task: asyncio.Task = None
        self.is_running = False
        
        self.db_manager = DatabaseManager()
    
    async def connect(self, websocket: WebSocket, client_id: str):
        """Accept new WebSocket connection"""
        await websocket.accept()
        self.active_connections[client_id] = websocket
        self.subscriptions[client_id] = set()
        
        logger.info(f"✅ WebSocket client {client_id} connected. Total: {len(self.active_connections)}")
        
        # Send connection confirmation
        await self.send_personal_message(client_id, {
            "type": "connection_established",
            "client_id": client_id,
            "timestamp": datetime.now().isoformat()
        })
    
    def disconnect(self, client_id: str):
        """Remove WebSocket connection"""
        if client_id in self.active_connections:
            del self.active_connections[client_id]
        
        if client_id in self.subscriptions:
            del self.subscriptions[client_id]
        
        logger.info(f"❌ WebSocket client {client_id} disconnected. Total: {len(self.active_connections)}")
    
    async def send_personal_message(self, client_id: str, message: dict):
        """Send message to specific client"""
        if client_id in self.active_connections:
            try:
                websocket = self.active_connections[client_id]
                await websocket.send_text(json.dumps(message))
            except Exception as e:
                logger.error(f"Error sending message to {client_id}: {e}")
                self.disconnect(client_id)
    
    async def broadcast_message(self, message: dict, symbol: str = None):
        """Broadcast message to all connected clients or clients subscribed to a symbol"""
        if symbol:
            # Send to clients subscribed to this symbol
            for client_id, subscribed_symbols in self.subscriptions.items():
                if symbol in subscribed_symbols:
                    await self.send_personal_message(client_id, message)
        else:
            # Send to all clients
            for client_id in list(self.active_connections.keys()):
                await self.send_personal_message(client_id, message)
    
    async def subscribe_to_symbols(self, client_id: str, symbols: List[str]):
        """Subscribe client to symbol updates"""
        if client_id not in self.subscriptions:
            self.subscriptions[client_id] = set()
        
        self.subscriptions[client_id].update(symbols)
        
        logger.info(f"📊 Client {client_id} subscribed to: {symbols}")
        
        # Send current price data for subscribed symbols
        for symbol in symbols:
            if symbol in self.price_cache:
                await self.send_personal_message(client_id, {
                    "type": "price_update",
                    "symbol": symbol,
                    **self.price_cache[symbol]
                })
        
        await self.send_personal_message(client_id, {
            "type": "subscription_confirmed",
            "symbols": symbols,
            "timestamp": datetime.now().isoformat()
        })
    
    async def unsubscribe_from_symbols(self, client_id: str, symbols: List[str]):
        """Unsubscribe client from symbol updates"""
        if client_id in self.subscriptions:
            self.subscriptions[client_id].difference_update(symbols)
        
        logger.info(f"📊 Client {client_id} unsubscribed from: {symbols}")
        
        await self.send_personal_message(client_id, {
            "type": "unsubscription_confirmed", 
            "symbols": symbols,
            "timestamp": datetime.now().isoformat()
        })
    
    async def start_price_updates(self):
        """Start background task for price updates"""
        if self.is_running:
            return
        
        self.is_running = True
        self.update_task = asyncio.create_task(self._price_update_loop())
        logger.info("🚀 Started real-time price update service")
    
    async def stop_price_updates(self):
        """Stop background task"""
        self.is_running = False
        if self.update_task:
            self.update_task.cancel()
            try:
                await self.update_task
            except asyncio.CancelledError:
                pass
        
        logger.info("🛑 Stopped real-time price update service")
    
    async def _price_update_loop(self):
        """Background loop to fetch and broadcast price updates"""
        while self.is_running:
            try:
                # Get all subscribed symbols
                all_symbols = set()
                for symbols in self.subscriptions.values():
                    all_symbols.update(symbols)
                
                if all_symbols:
                    await self._fetch_and_broadcast_prices(list(all_symbols))
                
                # Wait 5 seconds before next update
                await asyncio.sleep(5)
                
            except Exception as e:
                logger.error(f"Error in price update loop: {e}")
                await asyncio.sleep(10)  # Wait longer on error
    
    async def _fetch_and_broadcast_prices(self, symbols: List[str]):
        """Fetch latest prices and broadcast to subscribed clients"""
        try:
            with self.db_manager.get_connection() as conn:
                with conn.cursor() as cur:
                    # Fetch latest stock prices
                    stock_symbols = []
                    currency_symbols = []
                    
                    # Separate stocks from currencies
                    for symbol in symbols:
                        cur.execute("SELECT stock_id FROM stock_symbols WHERE symbol = %s", (symbol,))
                        if cur.fetchone():
                            stock_symbols.append(symbol)
                        else:
                            currency_symbols.append(symbol)
                    
                    # Fetch stock prices
                    if stock_symbols:
                        placeholders = ','.join(['%s'] * len(stock_symbols))
                        cur.execute(f"""
                            SELECT 
                                ss.symbol,
                                sp.close_price as price,
                                sp.change_amount as change,
                                sp.change_percent,
                                sp.volume,
                                sp.open_price,
                                sp.high_price,
                                sp.low_price,
                                sp.last_update
                            FROM stock_symbols ss
                            JOIN stock_prices sp ON ss.stock_id = sp.stock_id
                            WHERE ss.symbol IN ({placeholders})
                        """, stock_symbols)
                        
                        for row in cur.fetchall():
                            symbol, price, change, change_percent, volume, open_price, high_price, low_price, last_update = row
                            
                            price_data = {
                                "price": float(price) if price else 0.0,
                                "change": float(change) if change else 0.0,
                                "change_percent": float(change_percent) if change_percent else 0.0,
                                "volume": int(volume) if volume else 0,
                                "open": float(open_price) if open_price else 0.0,
                                "high": float(high_price) if high_price else 0.0,
                                "low": float(low_price) if low_price else 0.0,
                                "timestamp": last_update.isoformat() if last_update else datetime.now().isoformat()
                            }
                            
                            # Cache the data
                            self.price_cache[symbol] = price_data
                            
                            # Broadcast update
                            await self.broadcast_message({
                                "type": "price_update",
                                "symbol": symbol,
                                **price_data
                            }, symbol)
                    
                    # Fetch currency prices
                    if currency_symbols:
                        placeholders = ','.join(['%s'] * len(currency_symbols))
                        cur.execute(f"""
                            SELECT 
                                c.symbol,
                                ch.price,
                                ch.change_amount as change,
                                ch.change_percent,
                                ch.last_update
                            FROM currencies c
                            JOIN LATERAL (
                                SELECT price, change_amount, change_percent, last_update
                                FROM currency_history 
                                WHERE currency_id = c.currency_id 
                                ORDER BY date_time DESC 
                                LIMIT 1
                            ) ch ON true
                            WHERE c.symbol IN ({placeholders})
                        """, currency_symbols)
                        
                        for row in cur.fetchall():
                            symbol, price, change, change_percent, last_update = row
                            
                            price_data = {
                                "price": float(price) if price else 0.0,
                                "change": float(change) if change else 0.0,
                                "change_percent": float(change_percent) if change_percent else 0.0,
                                "volume": 0,  # Currencies don't have volume
                                "timestamp": last_update.isoformat() if last_update else datetime.now().isoformat()
                            }
                            
                            # Cache the data
                            self.price_cache[symbol] = price_data
                            
                            # Broadcast update
                            await self.broadcast_message({
                                "type": "price_update",
                                "symbol": symbol,
                                **price_data
                            }, symbol)
                    
        except Exception as e:
            logger.error(f"Error fetching prices: {e}")
    
    def get_connection_stats(self) -> dict:
        """Get connection statistics"""
        total_subscriptions = sum(len(symbols) for symbols in self.subscriptions.values())
        
        return {
            "active_connections": len(self.active_connections),
            "total_subscriptions": total_subscriptions,
            "cached_symbols": len(self.price_cache),
            "is_running": self.is_running
        }