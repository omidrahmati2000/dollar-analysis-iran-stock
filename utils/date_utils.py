"""
Date utilities for handling Persian dates and conversions
"""
import re
from datetime import datetime
from typing import Optional
import logging

logger = logging.getLogger(__name__)


def normalize_persian_date(date_str: str) -> Optional[str]:
    """
    Normalize Persian date string to YYYY-MM-DD format
    
    Args:
        date_str: Persian date string in various formats
        
    Returns:
        Normalized date string in YYYY-MM-DD format or None if invalid
    """
    if not date_str:
        return None
    
    # Remove any extra whitespace
    date_str = str(date_str).strip()
    
    # Common Persian date patterns
    patterns = [
        r'^(\d{4})/(\d{1,2})/(\d{1,2})$',  # YYYY/M/D or YYYY/MM/DD
        r'^(\d{4})-(\d{1,2})-(\d{1,2})$',  # YYYY-M-D or YYYY-MM-DD
        r'^(\d{4})(\d{2})(\d{2})$',        # YYYYMMDD
    ]
    
    for pattern in patterns:
        match = re.match(pattern, date_str)
        if match:
            year, month, day = match.groups()
            
            # Pad month and day with zeros if needed
            year = int(year)
            month = int(month)
            day = int(day)
            
            # Basic validation
            if not (1 <= month <= 12 and 1 <= day <= 31):
                logger.warning(f"Invalid date components: {year}-{month}-{day}")
                return None
            
            # Format as YYYY-MM-DD
            return f"{year:04d}-{month:02d}-{day:02d}"
    
    logger.warning(f"Could not parse date string: {date_str}")
    return None


def persian_date_to_datetime(date_str: str) -> Optional[datetime]:
    """
    Convert Persian date string to datetime object
    Note: This is a simplified conversion - in practice you might want to use
    a proper Persian calendar library like khayyam or jdatetime
    
    Args:
        date_str: Persian date string
        
    Returns:
        datetime object or None if conversion fails
    """
    normalized_date = normalize_persian_date(date_str)
    if not normalized_date:
        return None
    
    try:
        # For now, treat Persian dates as Gregorian for database storage
        # In a real application, you'd want proper Persian calendar conversion
        return datetime.strptime(normalized_date, '%Y-%m-%d')
    except ValueError as e:
        logger.warning(f"Could not convert date {normalized_date} to datetime: {e}")
        return None


def validate_date_range(start_date: str, end_date: str) -> bool:
    """
    Validate that start_date <= end_date
    
    Args:
        start_date: Start date string
        end_date: End date string
        
    Returns:
        True if valid range, False otherwise
    """
    start_dt = persian_date_to_datetime(start_date)
    end_dt = persian_date_to_datetime(end_date)
    
    if not start_dt or not end_dt:
        return False
    
    return start_dt <= end_dt


def format_date_for_api(date_str: str) -> str:
    """
    Format date string for API calls
    
    Args:
        date_str: Date string
        
    Returns:
        Formatted date string for API
    """
    normalized = normalize_persian_date(date_str)
    return normalized or date_str