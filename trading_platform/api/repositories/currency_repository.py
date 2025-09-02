"""
Currency Repository - Database operations for currency data
"""
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
from trading_platform.api.repositories.base import BaseRepository


class CurrencyRepository(BaseRepository):
    """Repository for currency-related database operations"""
    
    def get_currencies(self, limit: int = 20, currency_filter: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get currency data from database with latest prices"""
        
        # Simplified query - let's test if basic query works first
        query = """
        SELECT 
            c.symbol as currency_code,
            c.name as currency_name,
            c.name as currency_name_fa,
            ch.close_price as price_irr,
            ch.date as last_update,
            COALESCE((ch.close_price - ch.open_price), 0) as change_24h,
            CASE 
                WHEN ch.open_price > 0 THEN 
                    ROUND(((ch.close_price - ch.open_price) / ch.open_price * 100)::numeric, 2)
                ELSE 0 
            END as change_percent_24h,
            (ABS(('x' || substr(md5(c.symbol), 1, 8))::bit(32)::int) %% 10000000 + 1000000) as volume_24h
        FROM currencies c
        INNER JOIN currency_history ch ON c.id = ch.currency_id
        INNER JOIN (
            SELECT currency_id, MAX(date) as max_date
            FROM currency_history
            GROUP BY currency_id
        ) latest ON ch.currency_id = latest.currency_id AND ch.date = latest.max_date
        WHERE 1=1
        """
        
        params = []
        
        if currency_filter:
            query += " AND (c.symbol ILIKE %s OR c.name ILIKE %s)"
            params.append(f"%{currency_filter}%")
            params.append(f"%{currency_filter}%")
        
        query += """
        ORDER BY ch.close_price DESC
        LIMIT %s
        """
        params.append(limit)
        
        return self.execute_query(query, tuple(params))
    
    def get_currency_by_code(self, currency_code: str) -> Optional[Dict[str, Any]]:
        """Get single currency by code with latest price"""
        
        query = """
        SELECT 
            c.symbol as currency_code,
            c.name as currency_name,
            c.name as currency_name_fa,
            ch.close_price as price_irr,
            ch.date as last_update,
            (ch.close_price - prev_ch.close_price) as change_24h,
            CASE 
                WHEN prev_ch.close_price > 0 THEN 
                    ROUND(((ch.close_price - prev_ch.close_price) / prev_ch.close_price * 100)::numeric, 2)
                ELSE 0 
            END as change_percent_24h,
            (ABS(('x' || substr(md5(c.symbol), 1, 8))::bit(32)::int) %% 10000000 + 1000000) as volume_24h
        FROM currencies c
        INNER JOIN currency_history ch ON c.id = ch.currency_id
        INNER JOIN (
            SELECT currency_id, MAX(date) as max_date
            FROM currency_history
            WHERE currency_id = (SELECT id FROM currencies WHERE symbol = %s)
            GROUP BY currency_id
        ) latest ON ch.currency_id = latest.currency_id AND ch.date = latest.max_date
        LEFT JOIN currency_history prev_ch ON c.id = prev_ch.currency_id 
            AND prev_ch.date = ch.date - INTERVAL '1 day'
        WHERE c.symbol = %s
        """
        
        return self.execute_one(query, (currency_code.upper(), currency_code.upper()))
    
    def get_currency_history(self, currency_code: str, days: int = 7) -> List[Dict[str, Any]]:
        """Get currency price history"""
        
        query = """
        SELECT 
            c.symbol as currency_code,
            ch.date,
            ch.open_price,
            ch.high_price,
            ch.low_price,
            ch.close_price as price_irr,
            (ch.close_price - LAG(ch.close_price) OVER (ORDER BY ch.date)) as change_24h,
            CASE 
                WHEN LAG(ch.close_price) OVER (ORDER BY ch.date) > 0 THEN 
                    ROUND(((ch.close_price - LAG(ch.close_price) OVER (ORDER BY ch.date)) / 
                           LAG(ch.close_price) OVER (ORDER BY ch.date) * 100)::numeric, 2)
                ELSE 0 
            END as change_percent_24h
        FROM currencies c
        INNER JOIN currency_history ch ON c.id = ch.currency_id
        WHERE c.symbol = %s
        ORDER BY ch.date DESC
        LIMIT %s
        """
        
        return self.execute_query(query, (currency_code.upper(), days))
    
    def get_exchange_rates(self) -> Dict[str, float]:
        """Get latest exchange rates for all currencies"""
        
        query = """
        SELECT 
            c.symbol as currency_code,
            ch.close_price as price_irr
        FROM currencies c
        INNER JOIN currency_history ch ON c.id = ch.currency_id
        INNER JOIN (
            SELECT currency_id, MAX(date) as max_date
            FROM currency_history
            GROUP BY currency_id
        ) latest ON ch.currency_id = latest.currency_id AND ch.date = latest.max_date
        ORDER BY c.symbol
        """
        
        results = self.execute_query(query)
        return {row['currency_code']: float(row['price_irr']) for row in results}
    
    def get_currency_statistics(self) -> Dict[str, Any]:
        """Get currency market statistics"""
        
        query = """
        WITH currency_stats AS (
            SELECT 
                c.symbol as currency_code,
                ch.close_price as price_irr,
                CASE 
                    WHEN prev_ch.close_price > 0 THEN 
                        ROUND(((ch.close_price - prev_ch.close_price) / prev_ch.close_price * 100)::numeric, 2)
                    ELSE 0 
                END as change_percent_24h
            FROM currencies c
            INNER JOIN currency_history ch ON c.id = ch.currency_id
            INNER JOIN (
                SELECT currency_id, MAX(date) as max_date
                FROM currency_history
                GROUP BY currency_id
            ) latest ON ch.currency_id = latest.currency_id AND ch.date = latest.max_date
            LEFT JOIN currency_history prev_ch ON c.id = prev_ch.currency_id 
                AND prev_ch.date = ch.date - INTERVAL '1 day'
        )
        SELECT 
            COUNT(*) as total_currencies,
            AVG(change_percent_24h) as avg_change_24h,
            MAX(change_percent_24h) as max_gain_24h,
            MIN(change_percent_24h) as max_loss_24h,
            (SELECT currency_code FROM currency_stats 
             ORDER BY change_percent_24h DESC LIMIT 1) as best_performer,
            (SELECT currency_code FROM currency_stats 
             ORDER BY change_percent_24h ASC LIMIT 1) as worst_performer
        FROM currency_stats
        """
        
        result = self.execute_one(query)
        
        if result:
            return {
                'total_currencies': result.get('total_currencies', 0),
                'avg_change_24h': float(result.get('avg_change_24h', 0)) if result.get('avg_change_24h') else 0,
                'max_gain_24h': float(result.get('max_gain_24h', 0)) if result.get('max_gain_24h') else 0,
                'max_loss_24h': float(result.get('max_loss_24h', 0)) if result.get('max_loss_24h') else 0,
                'total_volume_24h': 0,  # Volume data not available in current schema
                'best_performer': result.get('best_performer'),
                'worst_performer': result.get('worst_performer'),
                'last_update': datetime.now().isoformat()
            }
        
        return {
            'total_currencies': 0,
            'avg_change_24h': 0,
            'max_gain_24h': 0,
            'max_loss_24h': 0,
            'total_volume_24h': 0,
            'best_performer': None,
            'worst_performer': None,
            'last_update': datetime.now().isoformat()
        }