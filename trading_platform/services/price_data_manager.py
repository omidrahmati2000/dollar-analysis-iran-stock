"""
Price Data Manager for handling adjusted and unadjusted stock prices
"""
from typing import List, Dict, Optional, Tuple
from datetime import datetime
import logging

from ..domain.models import OHLCV, DataType, StockInfo, ChartDataRequest, ChartDataResponse, Symbol
from ..data.repositories import OHLCVRepository
from ..core.events import EventBus


class PriceDataManager:
    """Manages stock price data types (adjusted vs unadjusted)"""
    
    def __init__(self, ohlcv_repository: OHLCVRepository, event_bus: EventBus):
        self.ohlcv_repository = ohlcv_repository
        self.event_bus = event_bus
        self.logger = logging.getLogger(__name__)
        self._adjustment_cache: Dict[str, Dict[str, float]] = {}  # symbol -> {date -> factor}
        self._stock_info_cache: Dict[str, StockInfo] = {}
    
    def get_stock_info(self, symbol: Symbol) -> StockInfo:
        """Get stock information with data type support flags"""
        if symbol.id not in self._stock_info_cache:
            # Check database for available data types
            has_adjusted = self._check_data_type_availability(symbol, DataType.ADJUSTED)
            has_unadjusted = self._check_data_type_availability(symbol, DataType.UNADJUSTED)
            
            stock_info = StockInfo(
                symbol=symbol,
                has_adjusted_data=has_adjusted,
                has_unadjusted_data=has_unadjusted,
                default_data_type=DataType.UNADJUSTED  # Default as requested
            )
            
            # Load adjustment factors if available
            if has_adjusted and has_unadjusted:
                stock_info.adjustment_factors = self._load_adjustment_factors(symbol)
            
            self._stock_info_cache[symbol.id] = stock_info
        
        return self._stock_info_cache[symbol.id]
    
    def get_chart_data(self, request: ChartDataRequest) -> ChartDataResponse:
        """Get chart data for specified data type"""
        stock_info = self.get_stock_info(request.symbol)
        
        # Validate data type availability
        if not stock_info.supports_data_type(request.data_type):
            self.logger.warning(f"Data type {request.data_type} not available for {request.symbol.id}")
            # Fall back to default data type
            request.data_type = stock_info.default_data_type
        
        # Get data from repository based on data_type
        ohlcv_data = self._fetch_data_by_type(request)
        
        # Calculate quality metrics
        total_points = self._calculate_expected_data_points(request)
        missing_points = max(0, total_points - len(ohlcv_data))
        quality_score = self._calculate_data_quality_score(ohlcv_data, total_points)
        
        response = ChartDataResponse(
            request=request,
            data=ohlcv_data,
            data_quality_score=quality_score,
            missing_data_points=missing_points,
            total_data_points=total_points,
            metadata={
                'data_source': 'database',
                'adjustment_applied': request.data_type == DataType.ADJUSTED,
                'cache_used': False
            }
        )
        
        self.logger.info(f"Retrieved {len(ohlcv_data)} data points for {request.symbol.id} "
                        f"({request.data_type.name}) with {quality_score:.2f}% quality")
        
        return response
    
    def switch_data_type(self, symbol: Symbol, new_data_type: DataType) -> bool:
        """Switch data type for a symbol"""
        stock_info = self.get_stock_info(symbol)
        
        if not stock_info.supports_data_type(new_data_type):
            self.logger.error(f"Cannot switch to {new_data_type.name} for {symbol.id} - not supported")
            return False
        
        # Update stock info default
        old_type = stock_info.default_data_type
        stock_info.default_data_type = new_data_type
        self._stock_info_cache[symbol.id] = stock_info
        
        # Emit data type switch event
        from ..domain.models import DataTypeSwitch
        switch_event = DataTypeSwitch(
            symbol=symbol,
            from_data_type=old_type,
            to_data_type=new_data_type,
            timestamp=datetime.now(),
            user_initiated=True
        )
        
        self.event_bus.emit('data_type_switched', switch_event)
        
        self.logger.info(f"Switched data type for {symbol.id} from {old_type.name} to {new_data_type.name}")
        return True
    
    def convert_data_type(self, data: List[OHLCV], target_data_type: DataType, 
                         symbol: Symbol) -> List[OHLCV]:
        """Convert OHLCV data between adjusted and unadjusted"""
        if not data:
            return data
        
        current_type = data[0].data_type
        if current_type == target_data_type:
            return data  # Already in target type
        
        # Get adjustment factors for conversion
        adjustment_factors = self._get_adjustment_factors_for_conversion(symbol, data)
        
        converted_data = []
        for ohlcv in data:
            date_key = ohlcv.timestamp.strftime('%Y-%m-%d')
            adjustment_factor = adjustment_factors.get(date_key, 1.0)
            
            if target_data_type == DataType.ADJUSTED:
                converted = ohlcv.convert_to_adjusted(adjustment_factor)
            else:
                converted = ohlcv.convert_to_unadjusted(adjustment_factor)
            
            converted_data.append(converted)
        
        self.logger.info(f"Converted {len(data)} data points from {current_type.name} to {target_data_type.name}")
        return converted_data
    
    def _check_data_type_availability(self, symbol: Symbol, data_type: DataType) -> bool:
        """Check if data type is available in database"""
        try:
            # Query database for data with specific data_type
            test_data = self.ohlcv_repository.get_ohlcv_data(
                symbol.id,
                start_date=datetime.now().replace(day=1),  # This month
                end_date=datetime.now(),
                data_type=data_type.value,
                limit=1
            )
            return len(test_data) > 0
        except Exception as e:
            self.logger.error(f"Error checking data availability for {symbol.id}: {e}")
            return False
    
    def _fetch_data_by_type(self, request: ChartDataRequest) -> List[OHLCV]:
        """Fetch OHLCV data from repository based on data type"""
        try:
            raw_data = self.ohlcv_repository.get_ohlcv_data(
                symbol_id=request.symbol.id,
                start_date=request.start_date,
                end_date=request.end_date,
                timeframe=request.timeframe.value,
                data_type=request.data_type.value
            )
            
            # Convert to domain objects
            ohlcv_data = []
            for row in raw_data:
                ohlcv = OHLCV(
                    timestamp=row['timestamp'],
                    open=float(row['open']),
                    high=float(row['high']),
                    low=float(row['low']),
                    close=float(row['close']),
                    volume=float(row['volume']),
                    data_type=request.data_type
                )
                ohlcv_data.append(ohlcv)
            
            return ohlcv_data
        
        except Exception as e:
            self.logger.error(f"Error fetching data for {request.symbol.id}: {e}")
            return []
    
    def _load_adjustment_factors(self, symbol: Symbol) -> Dict[str, float]:
        """Load adjustment factors from database or calculate them"""
        if symbol.id in self._adjustment_cache:
            return self._adjustment_cache[symbol.id]
        
        try:
            # This would typically load from a corporate actions/adjustments table
            # For now, return empty dict (factors will be calculated on-demand)
            factors = {}
            
            # Cache the factors
            self._adjustment_cache[symbol.id] = factors
            return factors
            
        except Exception as e:
            self.logger.error(f"Error loading adjustment factors for {symbol.id}: {e}")
            return {}
    
    def _get_adjustment_factors_for_conversion(self, symbol: Symbol, 
                                             data: List[OHLCV]) -> Dict[str, float]:
        """Get adjustment factors needed for data conversion"""
        stock_info = self.get_stock_info(symbol)
        
        if not stock_info.adjustment_factors:
            # If no specific factors, assume 1.0 (no adjustment needed)
            return {ohlcv.timestamp.strftime('%Y-%m-%d'): 1.0 for ohlcv in data}
        
        return stock_info.adjustment_factors
    
    def _calculate_expected_data_points(self, request: ChartDataRequest) -> int:
        """Calculate expected number of data points for the time range"""
        days = (request.end_date - request.start_date).days
        
        # Rough estimation based on timeframe
        if request.timeframe.value.endswith('D'):
            return days
        elif request.timeframe.value.endswith('H'):
            hours_per_day = 24 if request.timeframe.value == '1H' else 6  # Trading hours
            return days * hours_per_day
        else:
            # For minute timeframes, assume trading hours
            minutes_per_day = 390  # 6.5 hours * 60 minutes
            interval = int(request.timeframe.value.replace('M', ''))
            return days * (minutes_per_day // interval)
    
    def _calculate_data_quality_score(self, data: List[OHLCV], expected_points: int) -> float:
        """Calculate data quality score based on completeness and consistency"""
        if expected_points == 0:
            return 100.0
        
        actual_points = len(data)
        completeness_score = min(100.0, (actual_points / expected_points) * 100)
        
        # Additional quality checks could be added here
        # (e.g., price continuity, volume consistency)
        
        return completeness_score
    
    def clear_cache(self):
        """Clear internal caches"""
        self._adjustment_cache.clear()
        self._stock_info_cache.clear()
        self.logger.info("Price data manager caches cleared")
    
    def get_cache_stats(self) -> Dict[str, int]:
        """Get cache statistics"""
        return {
            'adjustment_cache_size': len(self._adjustment_cache),
            'stock_info_cache_size': len(self._stock_info_cache)
        }