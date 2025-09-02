"""
Factory pattern for data providers
Centralized creation and management of data providers
"""
from typing import Dict, List, Type, Optional
import logging

from .base import BaseDataProvider
from .tsetmc_provider import TSETMCDataProvider
from .currency_provider import CurrencyDataProvider


class DataProviderFactory:
    """
    Factory for creating and managing data providers
    Implements Factory and Registry patterns
    """
    
    def __init__(self):
        self.logger = logging.getLogger("provider.factory")
        self._providers: Dict[str, Type[BaseDataProvider]] = {}
        self._instances: Dict[str, BaseDataProvider] = {}
        
        # Register built-in providers
        self._register_builtin_providers()
    
    def _register_builtin_providers(self):
        """Register all built-in data providers"""
        self.register_provider("tsetmc", TSETMCDataProvider)
        self.register_provider("currency", CurrencyDataProvider)
    
    def register_provider(self, name: str, provider_class: Type[BaseDataProvider]):
        """
        Register a new data provider class
        
        Args:
            name: Provider name identifier
            provider_class: Provider class (must inherit from BaseDataProvider)
        """
        if not issubclass(provider_class, BaseDataProvider):
            raise ValueError(f"Provider class must inherit from BaseDataProvider")
        
        self._providers[name] = provider_class
        self.logger.info(f"Registered data provider: {name}")
    
    def create_provider(self, name: str, use_singleton: bool = True) -> BaseDataProvider:
        """
        Create a data provider instance
        
        Args:
            name: Provider name
            use_singleton: Whether to reuse existing instance
            
        Returns:
            Data provider instance
        """
        if name not in self._providers:
            available = list(self._providers.keys())
            raise ValueError(f"Unknown provider '{name}'. Available: {available}")
        
        # Return existing instance if using singleton pattern
        if use_singleton and name in self._instances:
            return self._instances[name]
        
        # Create new instance
        provider_class = self._providers[name]
        instance = provider_class()
        
        if use_singleton:
            self._instances[name] = instance
        
        self.logger.debug(f"Created data provider instance: {name}")
        return instance
    
    def get_provider(self, name: str) -> BaseDataProvider:
        """
        Get a data provider instance (shorthand for create_provider with singleton=True)
        
        Args:
            name: Provider name
            
        Returns:
            Data provider instance
        """
        return self.create_provider(name, use_singleton=True)
    
    def get_all_providers(self) -> List[BaseDataProvider]:
        """
        Get instances of all registered providers
        
        Returns:
            List of all provider instances
        """
        providers = []
        for name in self._providers:
            providers.append(self.get_provider(name))
        return providers
    
    def get_available_providers(self) -> List[str]:
        """
        Get list of available provider names
        
        Returns:
            List of provider names
        """
        return list(self._providers.keys())
    
    def health_check_all(self) -> Dict[str, bool]:
        """
        Perform health check on all providers
        
        Returns:
            Dictionary mapping provider names to health status
        """
        results = {}
        
        for name in self._providers:
            try:
                provider = self.get_provider(name)
                results[name] = provider.health_check()
            except Exception as e:
                self.logger.error(f"Health check failed for {name}: {e}")
                results[name] = False
        
        return results
    
    def get_providers_info(self) -> Dict[str, Dict]:
        """
        Get information about all providers
        
        Returns:
            Dictionary with provider information
        """
        info = {}
        
        for name in self._providers:
            try:
                provider = self.get_provider(name)
                info[name] = provider.get_provider_info()
            except Exception as e:
                self.logger.error(f"Failed to get info for {name}: {e}")
                info[name] = {"error": str(e)}
        
        return info
    
    def cleanup(self):
        """Clean up all provider instances"""
        for name, instance in self._instances.items():
            if hasattr(instance, 'cleanup'):
                try:
                    instance.cleanup()
                except Exception as e:
                    self.logger.warning(f"Cleanup failed for {name}: {e}")
        
        self._instances.clear()
        self.logger.info("Cleaned up all provider instances")


# Global factory instance
data_provider_factory = DataProviderFactory()