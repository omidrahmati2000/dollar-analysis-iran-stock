"""
Technical Indicator Repository - Database operations for technical indicators
"""
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
from trading_platform.api.repositories.base import BaseRepository


class IndicatorRepository(BaseRepository):
    """Repository for technical indicator database operations"""
    
    def get_indicators(self, symbol: str, indicator_types: Optional[List[str]] = None) -> List[Dict[str, Any]]:
        """Get technical indicators for a symbol"""
        
        try:
            query = """
            SELECT 
                symbol,
                indicator_name,
                indicator_value,
                signal,
                calculation_date,
                parameters
            FROM technical_indicators
            WHERE symbol = %s
            AND calculation_date >= CURRENT_DATE - INTERVAL '1 day'
            """
            
            params = [symbol.upper()]
            
            if indicator_types:
                placeholders = ','.join(['%s'] * len(indicator_types))
                query += f" AND indicator_name IN ({placeholders})"
                params.extend(indicator_types)
            
            query += " ORDER BY calculation_date DESC, indicator_name"
            
            return self.execute_query(query, tuple(params))
        except Exception as e:
            # Table doesn't exist or other database error - return empty list
            print(f"Error accessing technical_indicators table: {e}")
            return []
    
    def save_indicator(self, symbol: str, indicator_name: str, value: float, 
                      signal: str, parameters: Dict[str, Any] = None) -> bool:
        """Save calculated indicator to database"""
        
        try:
            query = """
            INSERT INTO technical_indicators 
            (symbol, indicator_name, indicator_value, signal, calculation_date, parameters)
            VALUES (%s, %s, %s, %s, %s, %s)
            ON CONFLICT (symbol, indicator_name, calculation_date) 
            DO UPDATE SET 
                indicator_value = EXCLUDED.indicator_value,
                signal = EXCLUDED.signal,
                parameters = EXCLUDED.parameters
            """
            
            import json
            params_json = json.dumps(parameters) if parameters else None
            
            affected = self.execute_update(
                query,
                (symbol.upper(), indicator_name, value, signal, datetime.now(), params_json)
            )
            
            return affected > 0
        except Exception as e:
            # Table doesn't exist - just skip saving
            print(f"Cannot save to technical_indicators table: {e}")
            return False
    
    def get_indicator_history(self, symbol: str, indicator_name: str, days: int = 30) -> List[Dict[str, Any]]:
        """Get historical values for an indicator"""
        
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days)
        
        query = """
        SELECT 
            calculation_date,
            indicator_value,
            signal
        FROM technical_indicators
        WHERE symbol = %s
        AND indicator_name = %s
        AND calculation_date BETWEEN %s AND %s
        ORDER BY calculation_date ASC
        """
        
        return self.execute_query(
            query,
            (symbol.upper(), indicator_name, start_date, end_date)
        )
    
    def get_signals_summary(self, symbols: Optional[List[str]] = None) -> Dict[str, Any]:
        """Get summary of trading signals"""
        
        try:
            query = """
            WITH latest_signals AS (
                SELECT DISTINCT ON (symbol, indicator_name)
                    symbol,
                    indicator_name,
                    signal,
                    calculation_date
                FROM technical_indicators
                WHERE calculation_date >= CURRENT_DATE - INTERVAL '1 day'
            """
            
            params = []
            
            if symbols:
                placeholders = ','.join(['%s'] * len(symbols))
                query += f" AND symbol IN ({placeholders})"
                params.extend([s.upper() for s in symbols])
            
            query += """
                ORDER BY symbol, indicator_name, calculation_date DESC
            )
            SELECT 
                signal,
                COUNT(*) as count,
                array_agg(DISTINCT symbol) as symbols
            FROM latest_signals
            GROUP BY signal
            """
            
            results = self.execute_query(query, tuple(params))
            
            summary = {
                'buy_signals': 0,
                'sell_signals': 0,
                'hold_signals': 0,
                'buy_symbols': [],
                'sell_symbols': [],
                'hold_symbols': []
            }
            
            for row in results:
                signal = row['signal'].lower()
                if signal == 'buy':
                    summary['buy_signals'] = row['count']
                    summary['buy_symbols'] = row['symbols'][:5]  # Top 5
                elif signal == 'sell':
                    summary['sell_signals'] = row['count']
                    summary['sell_symbols'] = row['symbols'][:5]
                elif signal == 'hold':
                    summary['hold_signals'] = row['count']
                    summary['hold_symbols'] = row['symbols'][:5]
            
            summary['last_update'] = datetime.now().isoformat()
            return summary
        except Exception as e:
            # Table doesn't exist - return empty summary
            print(f"Error getting signals summary: {e}")
            return {
                'buy_signals': 0,
                'sell_signals': 0,
                'hold_signals': 0,
                'buy_symbols': [],
                'sell_symbols': [],
                'hold_symbols': [],
                'last_update': datetime.now().isoformat()
            }
    
    def cleanup_old_indicators(self, days_to_keep: int = 30) -> int:
        """Remove old indicator data"""
        
        cutoff_date = datetime.now() - timedelta(days=days_to_keep)
        
        query = """
        DELETE FROM technical_indicators
        WHERE calculation_date < %s
        """
        
        return self.execute_update(query, (cutoff_date,))