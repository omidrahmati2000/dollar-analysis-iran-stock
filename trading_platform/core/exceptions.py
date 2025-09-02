"""
Custom exceptions for the trading platform
"""


class TradingPlatformException(Exception):
    """Base exception for trading platform"""
    pass


class DataProviderException(TradingPlatformException):
    """Exception for data provider errors"""
    pass


class IndicatorException(TradingPlatformException):
    """Exception for indicator calculation errors"""
    pass


class ChartException(TradingPlatformException):
    """Exception for chart rendering errors"""
    pass


class RepositoryException(TradingPlatformException):
    """Exception for repository operations"""
    pass


class ValidationException(TradingPlatformException):
    """Exception for validation errors"""
    pass


class ConfigurationException(TradingPlatformException):
    """Exception for configuration errors"""
    pass