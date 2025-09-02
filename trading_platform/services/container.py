"""
Dependency Injection Container
Following Dependency Inversion Principle
"""
from typing import Dict, Any, Type, Callable, Optional
from functools import wraps
import inspect

from ..core.exceptions import ConfigurationException


class ServiceContainer:
    """
    IoC Container for dependency injection
    Implements Service Locator and Factory patterns
    """
    
    def __init__(self):
        self._services: Dict[str, Any] = {}
        self._singletons: Dict[str, Any] = {}
        self._factories: Dict[str, Callable] = {}
        self._bindings: Dict[Type, Type] = {}
    
    def register(self, name: str, service: Any, singleton: bool = True) -> None:
        """Register a service"""
        if singleton:
            self._singletons[name] = service
        else:
            self._services[name] = service
    
    def register_factory(self, name: str, factory: Callable) -> None:
        """Register a factory function"""
        self._factories[name] = factory
    
    def bind(self, interface: Type, implementation: Type) -> None:
        """Bind interface to implementation"""
        self._bindings[interface] = implementation
    
    def get(self, name: str) -> Any:
        """Get a service by name"""
        # Check singletons first
        if name in self._singletons:
            return self._singletons[name]
        
        # Check factories
        if name in self._factories:
            service = self._factories[name](self)
            self._singletons[name] = service
            return service
        
        # Check regular services
        if name in self._services:
            return self._services[name]
        
        raise ConfigurationException(f"Service '{name}' not found")
    
    def resolve(self, interface: Type) -> Any:
        """Resolve interface to implementation"""
        if interface in self._bindings:
            implementation = self._bindings[interface]
            return self._create_instance(implementation)
        
        raise ConfigurationException(f"No binding found for {interface.__name__}")
    
    def _create_instance(self, cls: Type) -> Any:
        """Create instance with dependency injection"""
        signature = inspect.signature(cls.__init__)
        params = {}
        
        for param_name, param in signature.parameters.items():
            if param_name == 'self':
                continue
            
            # Try to resolve by type annotation
            if param.annotation != inspect.Parameter.empty:
                if param.annotation in self._bindings:
                    params[param_name] = self.resolve(param.annotation)
                elif param_name in self._services or param_name in self._singletons:
                    params[param_name] = self.get(param_name)
            
            # Try to resolve by name
            elif param_name in self._services or param_name in self._singletons:
                params[param_name] = self.get(param_name)
        
        return cls(**params)
    
    def inject(self, **dependencies):
        """Decorator for dependency injection"""
        def decorator(func):
            @wraps(func)
            def wrapper(*args, **kwargs):
                # Inject dependencies
                for name, service_name in dependencies.items():
                    if name not in kwargs:
                        kwargs[name] = self.get(service_name)
                return func(*args, **kwargs)
            return wrapper
        return decorator
    
    def clear(self) -> None:
        """Clear all services"""
        self._services.clear()
        self._singletons.clear()
        self._factories.clear()
        self._bindings.clear()


# Global container instance
container = ServiceContainer()


def inject(**dependencies):
    """Decorator for dependency injection"""
    def decorator(cls_or_func):
        if inspect.isclass(cls_or_func):
            # Class injection
            original_init = cls_or_func.__init__
            
            @wraps(original_init)
            def new_init(self, *args, **kwargs):
                # Inject dependencies
                for name, service_name in dependencies.items():
                    if name not in kwargs:
                        kwargs[name] = container.get(service_name)
                original_init(self, *args, **kwargs)
            
            cls_or_func.__init__ = new_init
            return cls_or_func
        else:
            # Function injection
            @wraps(cls_or_func)
            def wrapper(*args, **kwargs):
                # Inject dependencies
                for name, service_name in dependencies.items():
                    if name not in kwargs:
                        kwargs[name] = container.get(service_name)
                return cls_or_func(*args, **kwargs)
            return wrapper
    return decorator


def singleton(cls):
    """Decorator to make a class a singleton"""
    instances = {}
    
    @wraps(cls)
    def get_instance(*args, **kwargs):
        if cls not in instances:
            instances[cls] = cls(*args, **kwargs)
        return instances[cls]
    
    return get_instance