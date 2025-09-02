"""
Base data provider classes following Template Method pattern
"""
from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional
import requests
import logging
from dataclasses import dataclass
from datetime import datetime
import time
from tenacity import retry, stop_after_attempt, wait_exponential

from ..config.manager import config_manager


class DataProviderException(Exception):
    """Base exception for data provider errors"""
    pass


class RateLimitException(DataProviderException):
    """Rate limit exceeded exception"""
    pass


class APIException(DataProviderException):
    """API request failed exception"""
    pass


@dataclass
class RateLimiter:
    """Simple rate limiter implementation"""
    requests_per_minute: int = 60
    
    def __post_init__(self):
        self.requests = []
    
    def wait_if_needed(self) -> None:
        """Wait if rate limit would be exceeded"""
        now = datetime.now()
        # Remove requests older than 1 minute
        self.requests = [req_time for req_time in self.requests 
                        if (now - req_time).total_seconds() < 60]
        
        if len(self.requests) >= self.requests_per_minute:
            sleep_time = 60 - (now - self.requests[0]).total_seconds()
            if sleep_time > 0:
                time.sleep(sleep_time)
                self.requests = []
        
        self.requests.append(now)


class BaseDataProvider(ABC):
    """
    Abstract base class for all data providers
    Implements Template Method pattern for common API operations
    """
    
    def __init__(self, name: str):
        self.name = name
        self.config = config_manager.settings.api
        self.logger = logging.getLogger(f"provider.{name}")
        self.session = requests.Session()
        self.rate_limiter = RateLimiter(self.config.requests_per_minute)
        
        # Setup session with common headers
        self.session.headers.update(self.config.request_headers)
    
    @abstractmethod
    def get_base_url(self) -> str:
        """Get the base URL for this provider"""
        pass
    
    @abstractmethod
    def get_endpoints(self) -> Dict[str, str]:
        """Get available endpoints for this provider"""
        pass
    
    def _prepare_request_params(self, **kwargs) -> Dict[str, Any]:
        """Prepare request parameters - override in subclasses if needed"""
        return kwargs
    
    def _process_response(self, response: requests.Response) -> Any:
        """Process response - override in subclasses if needed"""
        try:
            return response.json()
        except ValueError as e:
            raise APIException(f"Invalid JSON response: {e}")
    
    def _validate_response(self, data: Any) -> bool:
        """Validate response data - override in subclasses"""
        return data is not None
    
    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
    def _make_request(self, endpoint: str, params: Dict[str, Any] = None) -> Any:
        """
        Template method for making API requests
        Implements retry logic, rate limiting, and error handling
        """
        # Rate limiting
        self.rate_limiter.wait_if_needed()
        
        # Prepare request
        url = f"{self.get_base_url()}{endpoint}"
        request_params = self._prepare_request_params(**(params or {}))
        
        try:
            self.logger.debug(f"Making request to {url} with params: {request_params}")
            
            response = self.session.get(
                url,
                params=request_params,
                timeout=self.config.timeout
            )
            
            response.raise_for_status()
            
            # Process response
            data = self._process_response(response)
            
            # Validate response
            if not self._validate_response(data):
                raise APIException("Response validation failed")
            
            return data
            
        except requests.exceptions.HTTPError as e:
            if response.status_code == 429:
                raise RateLimitException(f"Rate limit exceeded: {e}")
            raise APIException(f"HTTP error {response.status_code}: {e}")
            
        except requests.exceptions.RequestException as e:
            raise APIException(f"Request failed: {e}")
        
        except Exception as e:
            self.logger.error(f"Unexpected error in _make_request: {e}")
            raise DataProviderException(f"Unexpected error: {e}")
    
    def health_check(self) -> bool:
        """Check if the data provider is healthy"""
        try:
            # Try a simple request to test connectivity
            endpoints = self.get_endpoints()
            if not endpoints:
                return False
            
            # Use the first available endpoint for health check
            first_endpoint = list(endpoints.values())[0]
            self._make_request(first_endpoint, {})
            return True
            
        except Exception as e:
            self.logger.warning(f"Health check failed for {self.name}: {e}")
            return False
    
    def get_provider_info(self) -> Dict[str, Any]:
        """Get information about this provider"""
        return {
            "name": self.name,
            "base_url": self.get_base_url(),
            "endpoints": self.get_endpoints(),
            "rate_limit": self.config.requests_per_minute,
            "timeout": self.config.timeout,
            "healthy": self.health_check()
        }