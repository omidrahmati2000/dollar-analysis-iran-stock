"""
Indicator Presets and Templates - TradingView-like preset configurations
Provides commonly used indicator combinations and settings
"""

from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass
from enum import Enum
import json

from .factory import IndicatorFactory
from .custom_builder import CustomIndicatorBuilder, CustomIndicator


class PresetCategory(Enum):
    """Preset categories"""
    TREND_FOLLOWING = "trend_following"
    MOMENTUM = "momentum"
    VOLATILITY = "volatility"
    VOLUME = "volume"
    OSCILLATOR = "oscillator"
    SCALPING = "scalping"
    SWING_TRADING = "swing_trading"
    POSITION_TRADING = "position_trading"
    CUSTOM = "custom"


@dataclass
class IndicatorPreset:
    """Single indicator preset configuration"""
    name: str
    indicator_type: str
    parameters: Dict[str, Any]
    display_settings: Dict[str, Any]
    description: str


@dataclass
class PresetTemplate:
    """Complete trading template with multiple indicators"""
    name: str
    description: str
    category: PresetCategory
    indicators: List[IndicatorPreset]
    chart_settings: Dict[str, Any]
    timeframe_recommendations: List[str]


class IndicatorPresets:
    """Manager for indicator presets and templates"""
    
    def __init__(self):
        self.factory = IndicatorFactory()
        self._load_default_presets()
    
    def _load_default_presets(self):
        """Load default indicator presets"""
        self.presets = {}
        self.templates = {}
        
        # Single indicator presets
        self._create_trend_presets()
        self._create_momentum_presets()
        self._create_volatility_presets()
        self._create_volume_presets()
        self._create_oscillator_presets()
        
        # Multi-indicator templates
        self._create_trading_templates()
    
    def _create_trend_presets(self):
        """Create trend-following indicator presets"""
        
        # Moving Average presets
        self.presets['ma_fast'] = IndicatorPreset(
            name="Fast Moving Average",
            indicator_type="EMA",
            parameters={"period": 9},
            display_settings={"color": "#00ff00", "line_width": 2},
            description="Fast EMA for short-term trends"
        )
        
        self.presets['ma_medium'] = IndicatorPreset(
            name="Medium Moving Average",
            indicator_type="EMA",
            parameters={"period": 21},
            display_settings={"color": "#ffff00", "line_width": 2},
            description="Medium EMA for intermediate trends"
        )
        
        self.presets['ma_slow'] = IndicatorPreset(
            name="Slow Moving Average",
            indicator_type="EMA",
            parameters={"period": 50},
            display_settings={"color": "#ff0000", "line_width": 2},
            description="Slow EMA for long-term trends"
        )
        
        # SuperTrend presets
        self.presets['supertrend_conservative'] = IndicatorPreset(
            name="Conservative SuperTrend",
            indicator_type="SUPER_TREND",
            parameters={"atr_period": 14, "factor": 3.0},
            display_settings={"bullish_color": "#00ff00", "bearish_color": "#ff0000"},
            description="Conservative SuperTrend with standard settings"
        )
        
        self.presets['supertrend_aggressive'] = IndicatorPreset(
            name="Aggressive SuperTrend",
            indicator_type="SUPER_TREND",
            parameters={"atr_period": 10, "factor": 2.0},
            display_settings={"bullish_color": "#00ff00", "bearish_color": "#ff0000"},
            description="Aggressive SuperTrend for faster signals"
        )
        
        # KAMA presets
        self.presets['kama_standard'] = IndicatorPreset(
            name="Adaptive Moving Average",
            indicator_type="KAMA",
            parameters={"length": 14, "fast_length": 2, "slow_length": 30},
            display_settings={"color": "#9900ff", "line_width": 2},
            description="Kaufman's Adaptive Moving Average"
        )
    
    def _create_momentum_presets(self):
        """Create momentum indicator presets"""
        
        # RSI presets
        self.presets['rsi_standard'] = IndicatorPreset(
            name="RSI Standard",
            indicator_type="RSI",
            parameters={"length": 14, "overbought": 70, "oversold": 30},
            display_settings={"color": "#ff9900", "overbought_color": "#ff0000", "oversold_color": "#00ff00"},
            description="Standard RSI with 14 period"
        )
        
        self.presets['rsi_sensitive'] = IndicatorPreset(
            name="RSI Sensitive",
            indicator_type="RSI",
            parameters={"length": 9, "overbought": 75, "oversold": 25},
            display_settings={"color": "#ff9900", "overbought_color": "#ff0000", "oversold_color": "#00ff00"},
            description="Sensitive RSI for faster signals"
        )
        
        # MACD presets
        self.presets['macd_standard'] = IndicatorPreset(
            name="MACD Standard",
            indicator_type="MACD",
            parameters={"fast_length": 12, "slow_length": 26, "signal_length": 9},
            display_settings={"macd_color": "#0099ff", "signal_color": "#ff9900", "histogram_color": "#666666"},
            description="Standard MACD (12, 26, 9)"
        )
        
        self.presets['macd_fast'] = IndicatorPreset(
            name="MACD Fast",
            indicator_type="MACD",
            parameters={"fast_length": 5, "slow_length": 13, "signal_length": 5},
            display_settings={"macd_color": "#0099ff", "signal_color": "#ff9900", "histogram_color": "#666666"},
            description="Fast MACD for short-term trading"
        )
    
    def _create_volatility_presets(self):
        """Create volatility indicator presets"""
        
        # Bollinger Bands presets
        self.presets['bb_standard'] = IndicatorPreset(
            name="Bollinger Bands Standard",
            indicator_type="BOLLINGER",
            parameters={"period": 20, "std_dev": 2.0},
            display_settings={"middle_color": "#ffff00", "upper_color": "#ff0000", "lower_color": "#00ff00"},
            description="Standard Bollinger Bands (20, 2)"
        )
        
        self.presets['bb_tight'] = IndicatorPreset(
            name="Bollinger Bands Tight",
            indicator_type="BOLLINGER",
            parameters={"period": 20, "std_dev": 1.5},
            display_settings={"middle_color": "#ffff00", "upper_color": "#ff0000", "lower_color": "#00ff00"},
            description="Tight Bollinger Bands for ranging markets"
        )
        
        # ATR presets
        self.presets['atr_standard'] = IndicatorPreset(
            name="ATR Standard",
            indicator_type="ATR",
            parameters={"period": 14},
            display_settings={"color": "#9900ff", "line_width": 2},
            description="Average True Range for volatility measurement"
        )
    
    def _create_volume_presets(self):
        """Create volume indicator presets"""
        
        # Volume indicators
        self.presets['obv_standard'] = IndicatorPreset(
            name="On Balance Volume",
            indicator_type="OBV",
            parameters={"show_ma": True, "ma_length": 21},
            display_settings={"color": "#00ffff", "ma_color": "#ff9900"},
            description="On Balance Volume with moving average"
        )
        
        self.presets['vwap_standard'] = IndicatorPreset(
            name="VWAP Standard",
            indicator_type="VWAP_VOLUME",
            parameters={"show_bands": True, "stdev_mult1": 1.0, "stdev_mult2": 2.0},
            display_settings={"vwap_color": "#ffff00", "band_colors": ["#ff9900", "#ff0000"]},
            description="Volume Weighted Average Price with standard deviation bands"
        )
    
    def _create_oscillator_presets(self):
        """Create oscillator indicator presets"""
        
        # Stochastic presets
        self.presets['stoch_standard'] = IndicatorPreset(
            name="Stochastic Standard",
            indicator_type="STOCHASTIC",
            parameters={"k_period": 14, "d_period": 3, "smooth": 3},
            display_settings={"k_color": "#0099ff", "d_color": "#ff9900"},
            description="Standard Stochastic Oscillator"
        )
        
        # Williams %R
        self.presets['williams_r'] = IndicatorPreset(
            name="Williams %R",
            indicator_type="WILLIAMS_R",
            parameters={"period": 14},
            display_settings={"color": "#ff00ff", "overbought": -20, "oversold": -80},
            description="Williams %R momentum oscillator"
        )
    
    def _create_trading_templates(self):
        """Create complete trading templates"""
        
        # Scalping template
        self.templates['scalping'] = PresetTemplate(
            name="Scalping Setup",
            description="Fast indicators for scalping on lower timeframes",
            category=PresetCategory.SCALPING,
            indicators=[
                self.presets['ma_fast'],
                self.presets['rsi_sensitive'],
                self.presets['supertrend_aggressive'],
                self.presets['bb_tight']
            ],
            chart_settings={
                "background": "dark",
                "grid": True,
                "crosshair": True
            },
            timeframe_recommendations=["1m", "3m", "5m"]
        )
        
        # Swing trading template
        self.templates['swing_trading'] = PresetTemplate(
            name="Swing Trading Setup",
            description="Balanced indicators for swing trading",
            category=PresetCategory.SWING_TRADING,
            indicators=[
                self.presets['ma_medium'],
                self.presets['ma_slow'],
                self.presets['rsi_standard'],
                self.presets['macd_standard'],
                self.presets['bb_standard']
            ],
            chart_settings={
                "background": "dark",
                "grid": True,
                "volume": True
            },
            timeframe_recommendations=["1H", "4H", "1D"]
        )
        
        # Trend following template
        self.templates['trend_following'] = PresetTemplate(
            name="Trend Following Setup",
            description="Indicators optimized for trend following",
            category=PresetCategory.TREND_FOLLOWING,
            indicators=[
                self.presets['ma_medium'],
                self.presets['ma_slow'],
                self.presets['supertrend_conservative'],
                self.presets['kama_standard'],
                self.presets['atr_standard']
            ],
            chart_settings={
                "background": "dark",
                "grid": True,
                "volume": True
            },
            timeframe_recommendations=["4H", "1D", "1W"]
        )
        
        # Volume analysis template
        self.templates['volume_analysis'] = PresetTemplate(
            name="Volume Analysis Setup",
            description="Focus on volume-based indicators",
            category=PresetCategory.VOLUME,
            indicators=[
                self.presets['obv_standard'],
                self.presets['vwap_standard'],
                IndicatorPreset(
                    name="Volume Oscillator",
                    indicator_type="VOLUME_OSCILLATOR",
                    parameters={"short_length": 5, "long_length": 20},
                    display_settings={"color": "#00ffff"},
                    description="Volume momentum oscillator"
                )
            ],
            chart_settings={
                "background": "dark",
                "grid": True,
                "volume": True,
                "volume_height": 30
            },
            timeframe_recommendations=["15m", "1H", "4H"]
        )
        
        # Complete analysis template
        self.templates['complete_analysis'] = PresetTemplate(
            name="Complete Technical Analysis",
            description="Comprehensive indicator set for full market analysis",
            category=PresetCategory.POSITION_TRADING,
            indicators=[
                self.presets['ma_medium'],
                self.presets['ma_slow'],
                self.presets['rsi_standard'],
                self.presets['macd_standard'],
                self.presets['bb_standard'],
                self.presets['supertrend_conservative'],
                self.presets['obv_standard'],
                self.presets['atr_standard']
            ],
            chart_settings={
                "background": "dark",
                "grid": True,
                "volume": True,
                "panels": 3
            },
            timeframe_recommendations=["1H", "4H", "1D"]
        )
    
    def get_preset(self, preset_name: str) -> Optional[IndicatorPreset]:
        """Get a specific indicator preset"""
        return self.presets.get(preset_name)
    
    def get_template(self, template_name: str) -> Optional[PresetTemplate]:
        """Get a specific template"""
        return self.templates.get(template_name)
    
    def get_presets_by_category(self, category: PresetCategory) -> List[IndicatorPreset]:
        """Get all presets in a category"""
        # This would need category info added to presets
        # For now, return based on naming convention
        if category == PresetCategory.TREND_FOLLOWING:
            return [preset for name, preset in self.presets.items() 
                   if 'ma_' in name or 'supertrend' in name or 'kama' in name]
        elif category == PresetCategory.MOMENTUM:
            return [preset for name, preset in self.presets.items() 
                   if 'rsi' in name or 'macd' in name]
        elif category == PresetCategory.VOLATILITY:
            return [preset for name, preset in self.presets.items() 
                   if 'bb_' in name or 'atr' in name]
        elif category == PresetCategory.VOLUME:
            return [preset for name, preset in self.presets.items() 
                   if 'obv' in name or 'vwap' in name]
        else:
            return []
    
    def get_available_presets(self) -> List[str]:
        """Get list of all available preset names"""
        return list(self.presets.keys())
    
    def get_available_templates(self) -> List[str]:
        """Get list of all available template names"""
        return list(self.templates.keys())
    
    def create_indicator_from_preset(self, preset_name: str):
        """Create an indicator instance from preset"""
        preset = self.get_preset(preset_name)
        if not preset:
            raise ValueError(f"Preset '{preset_name}' not found")
        
        return self.factory.create_indicator(
            preset.indicator_type,
            **preset.parameters
        )
    
    def create_indicators_from_template(self, template_name: str) -> List:
        """Create all indicators from a template"""
        template = self.get_template(template_name)
        if not template:
            raise ValueError(f"Template '{template_name}' not found")
        
        indicators = []
        for preset in template.indicators:
            indicator = self.factory.create_indicator(
                preset.indicator_type,
                **preset.parameters
            )
            indicators.append({
                'indicator': indicator,
                'preset': preset,
                'display_settings': preset.display_settings
            })
        
        return indicators
    
    def save_custom_preset(self, name: str, preset: IndicatorPreset):
        """Save a custom indicator preset"""
        self.presets[name] = preset
    
    def save_custom_template(self, name: str, template: PresetTemplate):
        """Save a custom template"""
        self.templates[name] = template
    
    def export_presets(self, filename: str):
        """Export presets to JSON file"""
        data = {
            'presets': {
                name: {
                    'name': preset.name,
                    'indicator_type': preset.indicator_type,
                    'parameters': preset.parameters,
                    'display_settings': preset.display_settings,
                    'description': preset.description
                }
                for name, preset in self.presets.items()
            },
            'templates': {
                name: {
                    'name': template.name,
                    'description': template.description,
                    'category': template.category.value,
                    'indicators': [preset.name for preset in template.indicators],
                    'chart_settings': template.chart_settings,
                    'timeframe_recommendations': template.timeframe_recommendations
                }
                for name, template in self.templates.items()
            }
        }
        
        with open(filename, 'w') as f:
            json.dump(data, f, indent=2)
    
    def import_presets(self, filename: str):
        """Import presets from JSON file"""
        with open(filename, 'r') as f:
            data = json.load(f)
        
        # Import presets
        for name, preset_data in data.get('presets', {}).items():
            preset = IndicatorPreset(
                name=preset_data['name'],
                indicator_type=preset_data['indicator_type'],
                parameters=preset_data['parameters'],
                display_settings=preset_data['display_settings'],
                description=preset_data['description']
            )
            self.presets[name] = preset
        
        # Import templates would need to resolve preset references
        # This is a simplified version
        for name, template_data in data.get('templates', {}).items():
            # Would need to resolve indicator names to actual presets
            pass


class TradingViewStylePresets:
    """TradingView-style preset configurations"""
    
    @staticmethod
    def get_popular_combinations():
        """Get popular indicator combinations like TradingView"""
        return {
            'ma_cross': {
                'name': 'Moving Average Crossover',
                'indicators': ['EMA(9)', 'EMA(21)', 'EMA(50)'],
                'description': 'Classic moving average crossover system'
            },
            'bb_rsi': {
                'name': 'Bollinger Bands + RSI',
                'indicators': ['BollingerBands(20,2)', 'RSI(14)'],
                'description': 'Mean reversion strategy with momentum filter'
            },
            'macd_signal': {
                'name': 'MACD Signal Line',
                'indicators': ['MACD(12,26,9)', 'RSI(14)'],
                'description': 'MACD with RSI confirmation'
            },
            'supertrend_ema': {
                'name': 'SuperTrend + EMA',
                'indicators': ['SuperTrend(10,3)', 'EMA(21)'],
                'description': 'Trend following with dynamic support/resistance'
            },
            'volume_analysis': {
                'name': 'Volume Price Analysis',
                'indicators': ['VWAP', 'OBV', 'VolumeOscillator(5,20)'],
                'description': 'Volume-based price analysis'
            }
        }
    
    @staticmethod
    def get_timeframe_optimized():
        """Get timeframe-specific optimized settings"""
        return {
            '1m': {
                'scalping': ['EMA(9)', 'RSI(5)', 'SuperTrend(7,2)'],
                'description': 'Ultra-fast indicators for scalping'
            },
            '5m': {
                'scalping': ['EMA(13)', 'RSI(9)', 'MACD(5,13,5)'],
                'description': 'Fast indicators for 5-minute scalping'
            },
            '15m': {
                'swing': ['EMA(21)', 'RSI(14)', 'BollingerBands(20,2)'],
                'description': 'Swing trading on 15-minute charts'
            },
            '1H': {
                'swing': ['EMA(50)', 'MACD(12,26,9)', 'SuperTrend(14,3)'],
                'description': 'Hourly swing trading setup'
            },
            '4H': {
                'position': ['SMA(50)', 'SMA(200)', 'RSI(21)', 'MACD(12,26,9)'],
                'description': '4-hour position trading indicators'
            },
            '1D': {
                'position': ['SMA(20)', 'SMA(50)', 'SMA(200)', 'RSI(14)'],
                'description': 'Daily position trading with trend identification'
            }
        }