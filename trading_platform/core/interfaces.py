"""
Core interfaces following Interface Segregation Principle (ISP)
"""
from abc import ABC, abstractmethod
from typing import Dict, List, Optional, Any, Callable
from datetime import datetime
import pandas as pd


class IDataProvider(ABC):
    """Interface for data providers"""
    
    @abstractmethod
    def get_symbol_data(self, symbol: str, timeframe: str, limit: int = 1000) -> pd.DataFrame:
        """Fetch symbol data"""
        pass
    
    @abstractmethod
    def get_symbols_list(self, market_type: str) -> List[str]:
        """Get list of available symbols"""
        pass
    
    @abstractmethod
    def get_realtime_data(self, symbol: str) -> Dict[str, Any]:
        """Get real-time data for a symbol"""
        pass


class IIndicator(ABC):
    """Interface for technical indicators"""
    
    @abstractmethod
    def calculate(self, data: pd.DataFrame) -> pd.Series:
        """Calculate indicator values"""
        pass
    
    @abstractmethod
    def get_parameters(self) -> Dict[str, Any]:
        """Get indicator parameters"""
        pass
    
    @abstractmethod
    def set_parameters(self, **kwargs) -> None:
        """Set indicator parameters"""
        pass
    
    @property
    @abstractmethod
    def name(self) -> str:
        """Get indicator name"""
        pass


class IChart(ABC):
    """Interface for chart types"""
    
    @abstractmethod
    def render(self, data: pd.DataFrame, indicators: Dict[str, pd.Series] = None) -> Any:
        """Render chart with data and indicators"""
        pass
    
    @abstractmethod
    def update(self, new_data: pd.DataFrame) -> None:
        """Update chart with new data"""
        pass
    
    @property
    @abstractmethod
    def chart_type(self) -> str:
        """Get chart type"""
        pass


class IObserver(ABC):
    """Observer pattern interface"""
    
    @abstractmethod
    def update(self, event: str, data: Any) -> None:
        """Update observer with event data"""
        pass


class ISubject(ABC):
    """Subject interface for Observer pattern"""
    
    @abstractmethod
    def attach(self, observer: IObserver) -> None:
        """Attach an observer"""
        pass
    
    @abstractmethod
    def detach(self, observer: IObserver) -> None:
        """Detach an observer"""
        pass
    
    @abstractmethod
    def notify(self, event: str, data: Any = None) -> None:
        """Notify all observers"""
        pass


class IStrategy(ABC):
    """Strategy pattern interface for trading strategies"""
    
    @abstractmethod
    def analyze(self, data: pd.DataFrame) -> Dict[str, Any]:
        """Analyze data and return signals"""
        pass
    
    @property
    @abstractmethod
    def name(self) -> str:
        """Get strategy name"""
        pass


class IRepository(ABC):
    """Repository pattern interface"""
    
    @abstractmethod
    def find_by_id(self, id: Any) -> Optional[Any]:
        """Find entity by ID"""
        pass
    
    @abstractmethod
    def find_all(self, **filters) -> List[Any]:
        """Find all entities with optional filters"""
        pass
    
    @abstractmethod
    def save(self, entity: Any) -> Any:
        """Save entity"""
        pass
    
    @abstractmethod
    def delete(self, id: Any) -> bool:
        """Delete entity by ID"""
        pass


class IChartFactory(ABC):
    """Abstract Factory for creating charts"""
    
    @abstractmethod
    def create_chart(self, chart_type: str) -> IChart:
        """Create a chart of specified type"""
        pass
    
    @abstractmethod
    def get_available_types(self) -> List[str]:
        """Get list of available chart types"""
        pass


class IIndicatorFactory(ABC):
    """Abstract Factory for creating indicators"""
    
    @abstractmethod
    def create_indicator(self, indicator_type: str, **params) -> IIndicator:
        """Create an indicator of specified type"""
        pass
    
    @abstractmethod
    def get_available_indicators(self) -> List[str]:
        """Get list of available indicators"""
        pass


class IEventBus(ABC):
    """Event Bus interface for decoupled communication"""
    
    @abstractmethod
    def subscribe(self, event_type: str, handler: Callable) -> None:
        """Subscribe to an event type"""
        pass
    
    @abstractmethod
    def unsubscribe(self, event_type: str, handler: Callable) -> None:
        """Unsubscribe from an event type"""
        pass
    
    @abstractmethod
    def publish(self, event_type: str, data: Any = None) -> None:
        """Publish an event"""
        pass


class ICache(ABC):
    """Cache interface"""
    
    @abstractmethod
    def get(self, key: str) -> Optional[Any]:
        """Get value from cache"""
        pass
    
    @abstractmethod
    def set(self, key: str, value: Any, ttl: int = None) -> None:
        """Set value in cache with optional TTL"""
        pass
    
    @abstractmethod
    def delete(self, key: str) -> bool:
        """Delete value from cache"""
        pass
    
    @abstractmethod
    def clear(self) -> None:
        """Clear all cache"""
        pass