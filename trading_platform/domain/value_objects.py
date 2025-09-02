"""
Value objects for domain model
"""
from dataclasses import dataclass
from typing import Optional


@dataclass(frozen=True)
class Price:
    """Price value object"""
    value: float
    currency: str = "IRR"
    
    def __post_init__(self):
        if self.value < 0:
            raise ValueError("Price cannot be negative")
    
    def __str__(self):
        return f"{self.value:,.2f} {self.currency}"
    
    def __add__(self, other):
        if isinstance(other, Price):
            if self.currency != other.currency:
                raise ValueError("Cannot add prices with different currencies")
            return Price(self.value + other.value, self.currency)
        return Price(self.value + other, self.currency)
    
    def __mul__(self, multiplier: float):
        return Price(self.value * multiplier, self.currency)


@dataclass(frozen=True)
class Percentage:
    """Percentage value object"""
    value: float
    
    def __post_init__(self):
        if not -100 <= self.value <= float('inf'):
            raise ValueError("Invalid percentage value")
    
    def __str__(self):
        return f"{self.value:.2f}%"
    
    @property
    def decimal(self) -> float:
        """Get decimal representation"""
        return self.value / 100


@dataclass(frozen=True)
class Volume:
    """Volume value object"""
    value: float
    unit: str = "shares"
    
    def __post_init__(self):
        if self.value < 0:
            raise ValueError("Volume cannot be negative")
    
    def __str__(self):
        if self.value >= 1_000_000:
            return f"{self.value/1_000_000:.2f}M {self.unit}"
        elif self.value >= 1_000:
            return f"{self.value/1_000:.2f}K {self.unit}"
        return f"{self.value:,.0f} {self.unit}"


@dataclass(frozen=True)
class DateRange:
    """Date range value object"""
    start: str
    end: str
    
    def __post_init__(self):
        from datetime import datetime
        start_date = datetime.fromisoformat(self.start)
        end_date = datetime.fromisoformat(self.end)
        if start_date > end_date:
            raise ValueError("Start date must be before end date")