"""
Real-Time Calculation Engine - Handles continuous indicator calculations
Manages real-time data processing and indicator updates
"""

from typing import Dict, List, Any, Optional, Callable
import threading
import time
import queue
from datetime import datetime, timedelta
from dataclasses import dataclass
import asyncio

from ..core.events import EventBus, Event
from ..domain.models import OHLCVData
from ..data.repositories import OHLCVRepository
from .indicator_service import IndicatorService
from .signal_service import SignalService


@dataclass
class CalculationTask:
    """Task for indicator calculation"""
    task_id: str
    symbol: str
    indicator_names: List[str]
    data_range: int  # Number of bars to calculate
    priority: int = 0  # Higher number = higher priority
    timestamp: datetime = None
    callback: Optional[Callable] = None
    
    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = datetime.now()


@dataclass
class CalculationResult:
    """Result of indicator calculation"""
    task_id: str
    symbol: str
    indicator_results: Dict[str, Any]
    calculation_time: float
    timestamp: datetime
    success: bool
    error: Optional[str] = None


class DataBuffer:
    """Buffer for OHLCV data with automatic cleanup"""
    
    def __init__(self, max_size: int = 1000):
        self.max_size = max_size
        self.data: Dict[str, List[OHLCVData]] = {}
        self._lock = threading.RLock()
    
    def update(self, symbol: str, new_data: List[OHLCVData]):
        """Update buffer with new data"""
        with self._lock:
            if symbol not in self.data:
                self.data[symbol] = []
            
            # Add new data
            self.data[symbol].extend(new_data)
            
            # Keep only recent data
            if len(self.data[symbol]) > self.max_size:
                self.data[symbol] = self.data[symbol][-self.max_size:]
    
    def get(self, symbol: str, count: Optional[int] = None) -> List[OHLCVData]:
        """Get data for symbol"""
        with self._lock:
            if symbol not in self.data:
                return []
            
            data = self.data[symbol]
            if count is not None:
                return data[-count:] if count <= len(data) else data
            return data.copy()
    
    def get_latest(self, symbol: str) -> Optional[OHLCVData]:
        """Get latest data point"""
        with self._lock:
            if symbol in self.data and self.data[symbol]:
                return self.data[symbol][-1]
            return None
    
    def clear(self, symbol: Optional[str] = None):
        """Clear buffer data"""
        with self._lock:
            if symbol:
                if symbol in self.data:
                    del self.data[symbol]
            else:
                self.data.clear()


class RealTimeCalculationEngine:
    """Real-time calculation engine for indicators"""
    
    def __init__(self, indicator_service: IndicatorService,
                 signal_service: SignalService,
                 ohlcv_repository: OHLCVRepository,
                 event_bus: EventBus):
        
        self.indicator_service = indicator_service
        self.signal_service = signal_service
        self.ohlcv_repository = ohlcv_repository
        self.event_bus = event_bus
        
        # Threading components
        self.task_queue = queue.PriorityQueue()
        self.result_queue = queue.Queue()
        self.worker_threads: List[threading.Thread] = []
        self.is_running = False
        self._shutdown_event = threading.Event()
        
        # Data management
        self.data_buffer = DataBuffer(max_size=2000)
        self.last_update: Dict[str, datetime] = {}
        
        # Calculation settings
        self.update_interval = 1.0  # Seconds between updates
        self.max_workers = 4
        self.calculation_timeout = 30.0  # Seconds
        
        # Performance tracking
        self.calculation_stats = {
            'total_calculations': 0,
            'successful_calculations': 0,
            'failed_calculations': 0,
            'avg_calculation_time': 0.0,
            'last_calculation_times': []
        }
        
        # Subscribe to events
        self.event_bus.subscribe("new_market_data", self._handle_new_data)
        self.event_bus.subscribe("indicator_added", self._handle_indicator_added)
        self.event_bus.subscribe("calculation_requested", self._handle_calculation_request)
    
    def start(self):
        """Start the calculation engine"""
        if self.is_running:
            return
        
        self.is_running = True
        self._shutdown_event.clear()
        
        # Start worker threads
        for i in range(self.max_workers):
            worker = threading.Thread(
                target=self._worker_loop,
                name=f"CalcWorker-{i}",
                daemon=True
            )
            worker.start()
            self.worker_threads.append(worker)
        
        # Start result processor
        result_processor = threading.Thread(
            target=self._result_processor_loop,
            name="ResultProcessor",
            daemon=True
        )
        result_processor.start()
        self.worker_threads.append(result_processor)
        
        # Start periodic update
        update_thread = threading.Thread(
            target=self._update_loop,
            name="UpdateLoop",
            daemon=True
        )
        update_thread.start()
        self.worker_threads.append(update_thread)
        
        self.event_bus.emit(Event("calculation_engine_started", {}))
    
    def stop(self):
        """Stop the calculation engine"""
        if not self.is_running:
            return
        
        self.is_running = False
        self._shutdown_event.set()
        
        # Wait for threads to finish
        for thread in self.worker_threads:
            thread.join(timeout=5.0)
        
        self.worker_threads.clear()
        self.event_bus.emit(Event("calculation_engine_stopped", {}))
    
    def request_calculation(self, symbol: str, indicator_names: Optional[List[str]] = None,
                          data_range: int = 200, priority: int = 0,
                          callback: Optional[Callable] = None) -> str:
        """Request indicator calculation"""
        if indicator_names is None:
            # Calculate all active indicators
            indicator_names = list(self.indicator_service.active_indicators.keys())
        
        task_id = f"{symbol}_{datetime.now().timestamp()}_{priority}"
        
        task = CalculationTask(
            task_id=task_id,
            symbol=symbol,
            indicator_names=indicator_names,
            data_range=data_range,
            priority=priority,
            callback=callback
        )
        
        # Add to queue (negative priority for max-heap behavior)
        self.task_queue.put((-priority, task))
        
        return task_id
    
    def get_buffered_data(self, symbol: str, count: Optional[int] = None) -> List[OHLCVData]:
        """Get buffered data for symbol"""
        return self.data_buffer.get(symbol, count)
    
    def update_data_buffer(self, symbol: str, data: List[OHLCVData]):
        """Update data buffer with new data"""
        self.data_buffer.update(symbol, data)
        self.last_update[symbol] = datetime.now()
        
        # Trigger automatic calculation for active symbols
        if self.is_running:
            self.request_calculation(symbol, priority=1)
    
    def _worker_loop(self):
        """Main worker loop for processing calculation tasks"""
        while self.is_running and not self._shutdown_event.is_set():
            try:
                # Get task from queue (with timeout)
                try:
                    _, task = self.task_queue.get(timeout=1.0)
                except queue.Empty:
                    continue
                
                # Process task
                result = self._process_calculation_task(task)
                
                # Add result to result queue
                self.result_queue.put(result)
                
                # Mark task as done
                self.task_queue.task_done()
                
            except Exception as e:
                print(f"Error in calculation worker: {e}")
                time.sleep(0.1)
    
    def _process_calculation_task(self, task: CalculationTask) -> CalculationResult:
        """Process a single calculation task"""
        start_time = time.time()
        
        try:
            # Get data for calculation
            data = self.data_buffer.get(task.symbol, task.data_range)
            
            if not data:
                # Try to fetch from repository
                end_time = datetime.now()
                start_time_data = end_time - timedelta(days=30)  # Get 30 days of data
                
                try:
                    repo_data = self.ohlcv_repository.get_ohlcv_data(
                        task.symbol, start_time_data, end_time
                    )
                    if repo_data:
                        self.data_buffer.update(task.symbol, repo_data)
                        data = self.data_buffer.get(task.symbol, task.data_range)
                except Exception as e:
                    print(f"Error fetching data for {task.symbol}: {e}")
            
            if not data:
                raise ValueError(f"No data available for symbol {task.symbol}")
            
            # Calculate indicators
            indicator_results = {}
            
            for indicator_name in task.indicator_names:
                try:
                    result = self.indicator_service.calculate_indicator(
                        indicator_name, data
                    )
                    if result:
                        indicator_results[indicator_name] = result
                        
                        # Process signals
                        self.signal_service.process_indicator_signals(
                            indicator_name, task.symbol, result
                        )
                
                except Exception as e:
                    print(f"Error calculating {indicator_name} for {task.symbol}: {e}")
                    indicator_results[indicator_name] = {'error': str(e)}
            
            calculation_time = time.time() - start_time
            
            return CalculationResult(
                task_id=task.task_id,
                symbol=task.symbol,
                indicator_results=indicator_results,
                calculation_time=calculation_time,
                timestamp=datetime.now(),
                success=True
            )
            
        except Exception as e:
            calculation_time = time.time() - start_time
            
            return CalculationResult(
                task_id=task.task_id,
                symbol=task.symbol,
                indicator_results={},
                calculation_time=calculation_time,
                timestamp=datetime.now(),
                success=False,
                error=str(e)
            )
    
    def _result_processor_loop(self):
        """Process calculation results"""
        while self.is_running and not self._shutdown_event.is_set():
            try:
                # Get result from queue
                try:
                    result = self.result_queue.get(timeout=1.0)
                except queue.Empty:
                    continue
                
                # Update statistics
                self._update_stats(result)
                
                # Execute callback if provided
                if hasattr(result, 'callback') and result.callback:
                    try:
                        result.callback(result)
                    except Exception as e:
                        print(f"Error in calculation callback: {e}")
                
                # Emit result event
                self.event_bus.emit(Event("calculation_completed", {
                    'task_id': result.task_id,
                    'symbol': result.symbol,
                    'success': result.success,
                    'calculation_time': result.calculation_time,
                    'indicator_count': len(result.indicator_results),
                    'timestamp': result.timestamp
                }))
                
                # Mark result as processed
                self.result_queue.task_done()
                
            except Exception as e:
                print(f"Error processing calculation result: {e}")
    
    def _update_loop(self):
        """Periodic update loop"""
        while self.is_running and not self._shutdown_event.is_set():
            try:
                # Check for symbols that need updates
                current_time = datetime.now()
                
                for symbol in list(self.data_buffer.data.keys()):
                    last_update = self.last_update.get(symbol)
                    
                    # If no recent update, trigger calculation
                    if (not last_update or 
                        current_time - last_update > timedelta(seconds=self.update_interval * 2)):
                        
                        # Check if we have active indicators
                        if self.indicator_service.active_indicators:
                            self.request_calculation(symbol, priority=0)
                
                # Sleep until next update
                self._shutdown_event.wait(self.update_interval)
                
            except Exception as e:
                print(f"Error in update loop: {e}")
                time.sleep(1.0)
    
    def _update_stats(self, result: CalculationResult):
        """Update performance statistics"""
        self.calculation_stats['total_calculations'] += 1
        
        if result.success:
            self.calculation_stats['successful_calculations'] += 1
        else:
            self.calculation_stats['failed_calculations'] += 1
        
        # Update average calculation time
        times = self.calculation_stats['last_calculation_times']
        times.append(result.calculation_time)
        
        # Keep last 100 times
        if len(times) > 100:
            times.pop(0)
        
        self.calculation_stats['avg_calculation_time'] = sum(times) / len(times)
    
    def _handle_new_data(self, event: Event):
        """Handle new market data events"""
        symbol = event.data.get('symbol')
        data = event.data.get('data')
        
        if symbol and data:
            if isinstance(data, list):
                self.update_data_buffer(symbol, data)
            elif isinstance(data, OHLCVData):
                self.update_data_buffer(symbol, [data])
    
    def _handle_indicator_added(self, event: Event):
        """Handle indicator added events"""
        # Trigger recalculation for all active symbols
        for symbol in self.data_buffer.data.keys():
            self.request_calculation(symbol, priority=2)
    
    def _handle_calculation_request(self, event: Event):
        """Handle manual calculation requests"""
        symbol = event.data.get('symbol')
        indicators = event.data.get('indicators')
        priority = event.data.get('priority', 0)
        
        if symbol:
            self.request_calculation(symbol, indicators, priority=priority)
    
    def get_calculation_stats(self) -> Dict[str, Any]:
        """Get calculation performance statistics"""
        return self.calculation_stats.copy()
    
    def clear_data_buffer(self, symbol: Optional[str] = None):
        """Clear data buffer"""
        self.data_buffer.clear(symbol)
        
        if symbol:
            if symbol in self.last_update:
                del self.last_update[symbol]
        else:
            self.last_update.clear()
    
    def set_update_interval(self, interval: float):
        """Set update interval in seconds"""
        self.update_interval = max(0.1, interval)
    
    def get_active_symbols(self) -> List[str]:
        """Get list of active symbols with data"""
        return list(self.data_buffer.data.keys())
    
    def get_symbol_info(self, symbol: str) -> Dict[str, Any]:
        """Get information about a symbol"""
        data = self.data_buffer.get(symbol)
        last_update = self.last_update.get(symbol)
        
        return {
            'symbol': symbol,
            'data_points': len(data),
            'last_update': last_update,
            'latest_price': data[-1].close_price if data else None,
            'data_range': {
                'start': data[0].timestamp if data else None,
                'end': data[-1].timestamp if data else None
            }
        }