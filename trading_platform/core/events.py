"""
Event system for decoupled communication
"""
from typing import Any, Callable, Dict, List
from dataclasses import dataclass
from datetime import datetime
from .interfaces import IEventBus


@dataclass
class Event:
    """Base event class"""
    type: str
    data: Any
    timestamp: datetime = None
    
    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = datetime.now()


class EventBus(IEventBus):
    """
    Event Bus implementation for publish-subscribe pattern
    Follows Single Responsibility Principle
    """
    
    def __init__(self):
        self._handlers: Dict[str, List[Callable]] = {}
        
    def subscribe(self, event_type: str, handler: Callable) -> None:
        """Subscribe to an event type"""
        if event_type not in self._handlers:
            self._handlers[event_type] = []
        self._handlers[event_type].append(handler)
        
    def unsubscribe(self, event_type: str, handler: Callable) -> None:
        """Unsubscribe from an event type"""
        if event_type in self._handlers:
            self._handlers[event_type].remove(handler)
            if not self._handlers[event_type]:
                del self._handlers[event_type]
                
    def publish(self, event_type: str, data: Any = None) -> None:
        """Publish an event to all subscribers"""
        if event_type in self._handlers:
            event = Event(type=event_type, data=data)
            for handler in self._handlers[event_type]:
                try:
                    handler(event)
                except Exception as e:
                    print(f"Error in event handler: {e}")


# Event types constants
class EventTypes:
    """Event type constants"""
    
    # Data events
    DATA_UPDATED = "data.updated"
    DATA_ERROR = "data.error"
    
    # Chart events
    CHART_UPDATED = "chart.updated"
    CHART_TYPE_CHANGED = "chart.type_changed"
    TIMEFRAME_CHANGED = "timeframe.changed"
    
    # Indicator events
    INDICATOR_ADDED = "indicator.added"
    INDICATOR_REMOVED = "indicator.removed"
    INDICATOR_UPDATED = "indicator.updated"
    
    # Symbol events
    SYMBOL_SELECTED = "symbol.selected"
    SYMBOL_ADDED_TO_WATCHLIST = "symbol.added_to_watchlist"
    SYMBOL_REMOVED_FROM_WATCHLIST = "symbol.removed_from_watchlist"
    
    # Connection events
    CONNECTION_ESTABLISHED = "connection.established"
    CONNECTION_LOST = "connection.lost"
    CONNECTION_ERROR = "connection.error"