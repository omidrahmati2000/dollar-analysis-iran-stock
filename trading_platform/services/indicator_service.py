"""
Indicator Service - Central service for managing indicators
Coordinates between different indicator components
"""

from typing import Dict, List, Any, Optional, Callable
import threading
import time
from datetime import datetime, timedelta
import pandas as pd

from ..core.events import EventBus, Event
from ..core.interfaces import IIndicator
from ..indicators.factory import IndicatorFactory
from ..indicators.presets import IndicatorPresets, PresetTemplate
from ..indicators.strategies import StrategyManager, TradingStrategy
from ..indicators.custom_builder import CustomIndicatorBuilder, CustomIndicator
from ..domain.models import OHLCVData


class IndicatorConfiguration:
    """Configuration for an active indicator"""
    
    def __init__(self, name: str, indicator: IIndicator, parameters: Dict[str, Any],
                 display_settings: Dict[str, Any] = None):
        self.name = name
        self.indicator = indicator
        self.parameters = parameters
        self.display_settings = display_settings or {}
        self.enabled = True
        self.last_calculated = None
        self.last_result = None
        self.error_count = 0


class IndicatorService:
    """Central service for managing all indicators"""
    
    def __init__(self, indicator_factory: IndicatorFactory, 
                 presets_manager: IndicatorPresets,
                 strategy_manager: StrategyManager,
                 event_bus: EventBus):
        self.factory = indicator_factory
        self.presets = presets_manager
        self.strategies = strategy_manager
        self.event_bus = event_bus
        
        # Active indicators
        self.active_indicators: Dict[str, IndicatorConfiguration] = {}
        self.active_strategies: Dict[str, TradingStrategy] = {}
        
        # Calculation cache
        self.calculation_cache: Dict[str, Dict] = {}
        self.cache_ttl = timedelta(minutes=1)  # Cache for 1 minute
        
        # Threading
        self._calculation_lock = threading.RLock()
        self._stop_calculation = False
        
        # Subscribe to events
        self.event_bus.subscribe("data_updated", self._handle_data_update)
        self.event_bus.subscribe("indicator_settings_changed", self._handle_settings_change)
    
    def add_indicator(self, name: str, indicator_type: str, **parameters) -> bool:
        """Add a new indicator to active list"""
        try:
            with self._calculation_lock:
                # Create indicator instance
                indicator = self.factory.create_indicator(indicator_type, **parameters)
                
                # Create configuration
                config = IndicatorConfiguration(
                    name=name,
                    indicator=indicator,
                    parameters=parameters
                )
                
                # Add to active indicators
                self.active_indicators[name] = config
                
                # Emit event
                self.event_bus.emit(Event("indicator_added", {
                    'name': name,
                    'type': indicator_type,
                    'parameters': parameters
                }))
                
                return True
                
        except Exception as e:
            print(f"Error adding indicator {name}: {e}")
            return False
    
    def remove_indicator(self, name: str) -> bool:
        """Remove an indicator from active list"""
        try:
            with self._calculation_lock:
                if name in self.active_indicators:
                    del self.active_indicators[name]
                    
                    # Clear cache
                    if name in self.calculation_cache:
                        del self.calculation_cache[name]
                    
                    # Emit event
                    self.event_bus.emit(Event("indicator_removed", {'name': name}))
                    
                    return True
                return False
                
        except Exception as e:
            print(f"Error removing indicator {name}: {e}")
            return False
    
    def update_indicator_parameters(self, name: str, **parameters) -> bool:
        """Update parameters for an existing indicator"""
        try:
            with self._calculation_lock:
                if name not in self.active_indicators:
                    return False
                
                config = self.active_indicators[name]
                
                # Get indicator type
                indicator_type = type(config.indicator).__name__.upper()
                
                # Create new indicator with updated parameters
                new_parameters = {**config.parameters, **parameters}
                new_indicator = self.factory.create_indicator(indicator_type, **new_parameters)
                
                # Update configuration
                config.indicator = new_indicator
                config.parameters = new_parameters
                
                # Clear cache for this indicator
                if name in self.calculation_cache:
                    del self.calculation_cache[name]
                
                # Emit event
                self.event_bus.emit(Event("indicator_updated", {
                    'name': name,
                    'parameters': new_parameters
                }))
                
                return True
                
        except Exception as e:
            print(f"Error updating indicator {name}: {e}")
            return False
    
    def calculate_indicator(self, name: str, data: List[OHLCVData], 
                          force_recalculate: bool = False) -> Optional[Dict[str, Any]]:
        """Calculate a specific indicator"""
        try:
            with self._calculation_lock:
                if name not in self.active_indicators:
                    return None
                
                config = self.active_indicators[name]
                
                if not config.enabled:
                    return None
                
                # Check cache first
                cache_key = f"{name}_{len(data)}_{hash(str(data[-1:]))}"
                if not force_recalculate and cache_key in self.calculation_cache:
                    cached_result = self.calculation_cache[cache_key]
                    if datetime.now() - cached_result['timestamp'] < self.cache_ttl:
                        return cached_result['result']
                
                # Calculate indicator
                result = config.indicator.calculate(data)
                
                # Update configuration
                config.last_calculated = datetime.now()
                config.last_result = result
                config.error_count = 0
                
                # Cache result
                self.calculation_cache[cache_key] = {
                    'result': result,
                    'timestamp': datetime.now()
                }
                
                # Emit calculation event
                self.event_bus.emit(Event("indicator_calculated", {
                    'name': name,
                    'result': result,
                    'timestamp': config.last_calculated
                }))
                
                return result
                
        except Exception as e:
            print(f"Error calculating indicator {name}: {e}")
            if name in self.active_indicators:
                self.active_indicators[name].error_count += 1
            return None
    
    def calculate_all_indicators(self, data: List[OHLCVData]) -> Dict[str, Any]:
        """Calculate all active indicators"""
        results = {}
        
        with self._calculation_lock:
            for name in self.active_indicators.keys():
                result = self.calculate_indicator(name, data)
                if result is not None:
                    results[name] = result
        
        return results
    
    def add_strategy(self, name: str, strategy_type: str, **parameters) -> bool:
        """Add a trading strategy"""
        try:
            strategy = self.strategies.create_strategy(strategy_type, **parameters)
            self.active_strategies[name] = strategy
            
            self.event_bus.emit(Event("strategy_added", {
                'name': name,
                'type': strategy_type,
                'parameters': parameters
            }))
            
            return True
            
        except Exception as e:
            print(f"Error adding strategy {name}: {e}")
            return False
    
    def calculate_strategy_signals(self, name: str, data: List[OHLCVData]) -> Optional[List]:
        """Calculate signals from a strategy"""
        try:
            if name not in self.active_strategies:
                return None
            
            strategy = self.active_strategies[name]
            signals = strategy.calculate_signals(data)
            
            # Emit signals event
            self.event_bus.emit(Event("strategy_signals", {
                'strategy_name': name,
                'signals': signals
            }))
            
            return signals
            
        except Exception as e:
            print(f"Error calculating strategy signals {name}: {e}")
            return None
    
    def load_preset_template(self, template_name: str) -> bool:
        """Load a preset template with multiple indicators"""
        try:
            template = self.presets.get_template(template_name)
            if not template:
                return False
            
            # Clear existing indicators
            self.clear_all_indicators()
            
            # Add indicators from template
            for preset in template.indicators:
                indicator_name = f"{preset.name}_{preset.indicator_type}"
                success = self.add_indicator(
                    indicator_name,
                    preset.indicator_type,
                    **preset.parameters
                )
                
                if success and preset.display_settings:
                    # Update display settings
                    config = self.active_indicators[indicator_name]
                    config.display_settings.update(preset.display_settings)
            
            self.event_bus.emit(Event("template_loaded", {
                'template_name': template_name,
                'indicators_count': len(template.indicators)
            }))
            
            return True
            
        except Exception as e:
            print(f"Error loading template {template_name}: {e}")
            return False
    
    def create_custom_indicator(self, name: str, builder: CustomIndicatorBuilder) -> bool:
        """Create a custom indicator from builder"""
        try:
            with self._calculation_lock:
                custom_indicator = builder.build()
                
                config = IndicatorConfiguration(
                    name=name,
                    indicator=custom_indicator,
                    parameters=builder.variables.copy()
                )
                
                self.active_indicators[name] = config
                
                self.event_bus.emit(Event("custom_indicator_created", {
                    'name': name,
                    'description': custom_indicator.description
                }))
                
                return True
                
        except Exception as e:
            print(f"Error creating custom indicator {name}: {e}")
            return False
    
    def get_indicator_info(self, name: str) -> Optional[Dict[str, Any]]:
        """Get information about an active indicator"""
        if name not in self.active_indicators:
            return None
        
        config = self.active_indicators[name]
        
        return {
            'name': name,
            'type': type(config.indicator).__name__,
            'parameters': config.parameters,
            'display_settings': config.display_settings,
            'enabled': config.enabled,
            'last_calculated': config.last_calculated,
            'error_count': config.error_count
        }
    
    def get_all_indicators_info(self) -> Dict[str, Any]:
        """Get information about all active indicators"""
        return {
            name: self.get_indicator_info(name)
            for name in self.active_indicators.keys()
        }
    
    def enable_indicator(self, name: str, enabled: bool = True):
        """Enable or disable an indicator"""
        if name in self.active_indicators:
            self.active_indicators[name].enabled = enabled
            
            self.event_bus.emit(Event("indicator_toggled", {
                'name': name,
                'enabled': enabled
            }))
    
    def clear_all_indicators(self):
        """Clear all active indicators"""
        with self._calculation_lock:
            self.active_indicators.clear()
            self.calculation_cache.clear()
            
            self.event_bus.emit(Event("all_indicators_cleared", {}))
    
    def export_configuration(self) -> Dict[str, Any]:
        """Export current indicator configuration"""
        config = {
            'indicators': {},
            'strategies': {},
            'timestamp': datetime.now().isoformat()
        }
        
        for name, indicator_config in self.active_indicators.items():
            config['indicators'][name] = {
                'type': type(indicator_config.indicator).__name__,
                'parameters': indicator_config.parameters,
                'display_settings': indicator_config.display_settings,
                'enabled': indicator_config.enabled
            }
        
        for name, strategy in self.active_strategies.items():
            config['strategies'][name] = {
                'type': type(strategy).__name__,
                'name': strategy.name,
                'description': strategy.description
            }
        
        return config
    
    def import_configuration(self, config: Dict[str, Any]) -> bool:
        """Import indicator configuration"""
        try:
            # Clear existing
            self.clear_all_indicators()
            
            # Import indicators
            for name, indicator_config in config.get('indicators', {}).items():
                success = self.add_indicator(
                    name,
                    indicator_config['type'],
                    **indicator_config['parameters']
                )
                
                if success and name in self.active_indicators:
                    # Update additional settings
                    config_obj = self.active_indicators[name]
                    config_obj.display_settings.update(
                        indicator_config.get('display_settings', {})
                    )
                    config_obj.enabled = indicator_config.get('enabled', True)
            
            self.event_bus.emit(Event("configuration_imported", {
                'indicators_count': len(config.get('indicators', {}))
            }))
            
            return True
            
        except Exception as e:
            print(f"Error importing configuration: {e}")
            return False
    
    def _handle_data_update(self, event: Event):
        """Handle data update events"""
        # Trigger recalculation of indicators
        data = event.data.get('data')
        if data:
            # Clear cache to force recalculation
            self.calculation_cache.clear()
    
    def _handle_settings_change(self, event: Event):
        """Handle indicator settings change events"""
        name = event.data.get('name')
        settings = event.data.get('settings', {})
        
        if name and name in self.active_indicators:
            self.active_indicators[name].display_settings.update(settings)
    
    def get_available_indicators(self) -> List[str]:
        """Get list of available indicator types"""
        return self.factory.get_available_indicators()
    
    def get_available_presets(self) -> List[str]:
        """Get list of available presets"""
        return self.presets.get_available_presets()
    
    def get_available_templates(self) -> List[str]:
        """Get list of available templates"""
        return self.presets.get_available_templates()
    
    def get_available_strategies(self) -> List[str]:
        """Get list of available strategies"""
        return self.strategies.get_available_strategies()