"""
Data Alignment Service - مدیریت هم‌راستایی داده‌ها و مدیریت گپ‌های زمانی
برای تحلیل چند سمبل و ترکیب داده‌ها
"""

from typing import Dict, List, Any, Optional, Set, Tuple, Union
from dataclasses import dataclass
from datetime import datetime, timedelta, date
import pandas as pd
import numpy as np
from collections import defaultdict
import logging

from ..domain.models import OHLCVData
from ..data.repositories import OHLCVRepository


@dataclass
class AlignedDataPoint:
    """نقطه داده هم‌راسته"""
    timestamp: datetime
    symbols_data: Dict[str, OHLCVData]  # symbol -> OHLCV data
    is_trading_day: bool = True
    
    def get_symbol_price(self, symbol: str, price_type: str = 'close') -> Optional[float]:
        """دریافت قیمت برای سمبل مشخص"""
        if symbol not in self.symbols_data:
            return None
        
        data = self.symbols_data[symbol]
        return getattr(data, f"{price_type}_price", None)
    
    def has_symbol(self, symbol: str) -> bool:
        """بررسی وجود داده برای سمبل"""
        return symbol in self.symbols_data


@dataclass
class DataGap:
    """اطلاعات گپ داده"""
    start_date: datetime
    end_date: datetime
    symbol: str
    gap_type: str  # 'weekend', 'holiday', 'missing_data', 'market_closure'
    duration_days: int


class TradingCalendar:
    """تقویم معاملاتی برای مدیریت روزهای تعطیل"""
    
    def __init__(self):
        self.market_holidays: Dict[str, List[date]] = {
            'IRAN': self._get_iran_holidays(),
            'US': self._get_us_holidays(),
            'GLOBAL': []
        }
        self.weekend_days: Dict[str, List[int]] = {
            'IRAN': [4, 5],  # جمعه و شنبه
            'US': [5, 6],    # شنبه و یکشنبه
            'GLOBAL': [5, 6]
        }
    
    def _get_iran_holidays(self) -> List[date]:
        """تعطیلات ایران (نمونه)"""
        return [
            date(2024, 3, 20),  # نوروز
            date(2024, 3, 21),
            date(2024, 3, 22),
            date(2024, 3, 23),
            # باید تعطیلات کامل اضافه شود
        ]
    
    def _get_us_holidays(self) -> List[date]:
        """تعطیلات آمریکا (نمونه)"""
        return [
            date(2024, 1, 1),   # New Year
            date(2024, 7, 4),   # Independence Day
            date(2024, 12, 25), # Christmas
            # باید تعطیلات کامل اضافه شود
        ]
    
    def is_trading_day(self, date_check: date, market: str = 'GLOBAL') -> bool:
        """بررسی روز معاملاتی بودن"""
        # بررسی تعطیلات
        if date_check in self.market_holidays.get(market, []):
            return False
        
        # بررسی آخر هفته
        weekday = date_check.weekday()
        if weekday in self.weekend_days.get(market, [5, 6]):
            return False
        
        return True
    
    def get_next_trading_day(self, current_date: date, market: str = 'GLOBAL') -> date:
        """دریافت روز معاملاتی بعدی"""
        next_date = current_date + timedelta(days=1)
        while not self.is_trading_day(next_date, market):
            next_date += timedelta(days=1)
        return next_date
    
    def get_trading_days_between(self, start_date: date, end_date: date, 
                                market: str = 'GLOBAL') -> List[date]:
        """دریافت روزهای معاملاتی بین دو تاریخ"""
        trading_days = []
        current = start_date
        
        while current <= end_date:
            if self.is_trading_day(current, market):
                trading_days.append(current)
            current += timedelta(days=1)
        
        return trading_days


class DataAlignmentService:
    """سرویس هم‌راستایی داده‌ها"""
    
    def __init__(self, ohlcv_repository: OHLCVRepository):
        self.ohlcv_repository = ohlcv_repository
        self.trading_calendar = TradingCalendar()
        self.logger = logging.getLogger(__name__)
        
        # کش داده‌ها
        self._data_cache: Dict[str, List[OHLCVData]] = {}
        self._aligned_cache: Dict[str, List[AlignedDataPoint]] = {}
    
    def align_multiple_symbols(self, symbols: List[str], 
                              start_date: datetime, end_date: datetime,
                              fill_method: str = 'forward_fill',
                              market: str = 'GLOBAL') -> List[AlignedDataPoint]:
        """هم‌راستایی داده‌های چندین سمبل"""
        
        # کلید کش
        cache_key = f"{'-'.join(sorted(symbols))}_{start_date}_{end_date}_{fill_method}_{market}"
        if cache_key in self._aligned_cache:
            return self._aligned_cache[cache_key]
        
        self.logger.info(f"Aligning data for symbols: {symbols}")
        
        # دریافت داده‌ها برای همه سمبل‌ها
        symbols_data: Dict[str, List[OHLCVData]] = {}
        for symbol in symbols:
            try:
                data = self._get_symbol_data(symbol, start_date, end_date)
                if data:
                    symbols_data[symbol] = data
                    self.logger.info(f"Loaded {len(data)} records for {symbol}")
                else:
                    self.logger.warning(f"No data found for symbol: {symbol}")
            except Exception as e:
                self.logger.error(f"Error loading data for {symbol}: {e}")
        
        if not symbols_data:
            return []
        
        # تبدیل به DataFrame برای سهولت کار
        symbol_dfs = {}
        for symbol, data in symbols_data.items():
            df = pd.DataFrame([{
                'timestamp': item.timestamp,
                'open': item.open_price,
                'high': item.high_price, 
                'low': item.low_price,
                'close': item.close_price,
                'volume': item.volume
            } for item in data])
            df.set_index('timestamp', inplace=True)
            symbol_dfs[symbol] = df
        
        # تعیین بازه زمانی مشترک
        common_dates = self._find_common_trading_dates(symbol_dfs, market)
        
        if not common_dates:
            self.logger.warning("No common trading dates found")
            return []
        
        # ایجاد داده‌های هم‌راسته
        aligned_data = []
        
        for timestamp in sorted(common_dates):
            symbols_at_timestamp = {}
            
            for symbol in symbols:
                if symbol in symbol_dfs:
                    df = symbol_dfs[symbol]
                    
                    # یافتن نزدیک‌ترین داده
                    data_point = self._get_data_at_timestamp(df, timestamp, fill_method)
                    
                    if data_point is not None:
                        # تبدیل به OHLCVData
                        ohlcv_data = OHLCVData(
                            timestamp=timestamp,
                            open_price=data_point['open'],
                            high_price=data_point['high'],
                            low_price=data_point['low'], 
                            close_price=data_point['close'],
                            volume=int(data_point['volume'])
                        )
                        symbols_at_timestamp[symbol] = ohlcv_data
            
            # اگر داده برای حداقل یک سمبل وجود داشت
            if symbols_at_timestamp:
                is_trading = self.trading_calendar.is_trading_day(timestamp.date(), market)
                
                aligned_point = AlignedDataPoint(
                    timestamp=timestamp,
                    symbols_data=symbols_at_timestamp,
                    is_trading_day=is_trading
                )
                aligned_data.append(aligned_point)
        
        # کش کردن نتیجه
        self._aligned_cache[cache_key] = aligned_data
        
        self.logger.info(f"Aligned {len(aligned_data)} data points")
        return aligned_data
    
    def _get_symbol_data(self, symbol: str, start_date: datetime, 
                        end_date: datetime) -> List[OHLCVData]:
        """دریافت داده برای سمبل"""
        cache_key = f"{symbol}_{start_date}_{end_date}"
        
        if cache_key in self._data_cache:
            return self._data_cache[cache_key]
        
        try:
            data = self.ohlcv_repository.get_ohlcv_data(symbol, start_date, end_date)
            self._data_cache[cache_key] = data or []
            return data or []
        except Exception as e:
            self.logger.error(f"Error fetching data for {symbol}: {e}")
            return []
    
    def _find_common_trading_dates(self, symbol_dfs: Dict[str, pd.DataFrame], 
                                  market: str) -> Set[datetime]:
        """یافتن تاریخ‌های مشترک معاملاتی"""
        
        if not symbol_dfs:
            return set()
        
        # تاریخ‌های موجود در هر سمبل
        all_dates = set()
        for df in symbol_dfs.values():
            all_dates.update(df.index)
        
        # فیلتر کردن روزهای غیر معاملاتی
        trading_dates = set()
        for timestamp in all_dates:
            if self.trading_calendar.is_trading_day(timestamp.date(), market):
                trading_dates.add(timestamp)
        
        return trading_dates
    
    def _get_data_at_timestamp(self, df: pd.DataFrame, timestamp: datetime, 
                              fill_method: str) -> Optional[pd.Series]:
        """دریافت داده در زمان مشخص با روش پر کردن مشخص"""
        
        if timestamp in df.index:
            return df.loc[timestamp]
        
        if fill_method == 'forward_fill':
            # استفاده از آخرین داده موجود
            available_dates = df.index[df.index <= timestamp]
            if len(available_dates) > 0:
                return df.loc[available_dates.max()]
        
        elif fill_method == 'backward_fill':
            # استفاده از اولین داده بعدی
            available_dates = df.index[df.index >= timestamp]
            if len(available_dates) > 0:
                return df.loc[available_dates.min()]
        
        elif fill_method == 'interpolate':
            # میان‌یابی (پیچیده‌تر)
            before_dates = df.index[df.index <= timestamp]
            after_dates = df.index[df.index >= timestamp]
            
            if len(before_dates) > 0 and len(after_dates) > 0:
                before_data = df.loc[before_dates.max()]
                after_data = df.loc[after_dates.min()]
                
                # میان‌یابی خطی ساده
                before_time = before_dates.max()
                after_time = after_dates.min()
                total_time = (after_time - before_time).total_seconds()
                elapsed_time = (timestamp - before_time).total_seconds()
                
                if total_time > 0:
                    ratio = elapsed_time / total_time
                    interpolated = before_data + (after_data - before_data) * ratio
                    return interpolated
        
        return None
    
    def detect_data_gaps(self, symbols: List[str], start_date: datetime, 
                        end_date: datetime, market: str = 'GLOBAL') -> List[DataGap]:
        """تشخیص گپ‌های داده"""
        
        gaps = []
        
        for symbol in symbols:
            data = self._get_symbol_data(symbol, start_date, end_date)
            
            if not data:
                # کل بازه گپ است
                gaps.append(DataGap(
                    start_date=start_date,
                    end_date=end_date,
                    symbol=symbol,
                    gap_type='missing_data',
                    duration_days=(end_date - start_date).days
                ))
                continue
            
            # بررسی گپ‌های داخلی
            data_dates = [item.timestamp.date() for item in data]
            data_dates.sort()
            
            trading_days = self.trading_calendar.get_trading_days_between(
                start_date.date(), end_date.date(), market
            )
            
            # یافتن روزهای معاملاتی که داده ندارند
            missing_days = []
            for trading_day in trading_days:
                if trading_day not in data_dates:
                    missing_days.append(trading_day)
            
            # گروه‌بندی روزهای متوالی غایب
            if missing_days:
                gap_start = missing_days[0]
                gap_end = missing_days[0]
                
                for i in range(1, len(missing_days)):
                    current_day = missing_days[i]
                    prev_day = missing_days[i-1]
                    
                    # اگر روز متوالی باشد
                    if (current_day - prev_day).days <= 1:
                        gap_end = current_day
                    else:
                        # گپ قبلی را ثبت کن
                        gaps.append(DataGap(
                            start_date=datetime.combine(gap_start, datetime.min.time()),
                            end_date=datetime.combine(gap_end, datetime.min.time()),
                            symbol=symbol,
                            gap_type='missing_data',
                            duration_days=(gap_end - gap_start).days + 1
                        ))
                        
                        # گپ جدید شروع کن
                        gap_start = current_day
                        gap_end = current_day
                
                # آخرین گپ
                gaps.append(DataGap(
                    start_date=datetime.combine(gap_start, datetime.min.time()),
                    end_date=datetime.combine(gap_end, datetime.min.time()),
                    symbol=symbol,
                    gap_type='missing_data',
                    duration_days=(gap_end - gap_start).days + 1
                ))
        
        return gaps
    
    def get_data_quality_report(self, symbols: List[str], start_date: datetime, 
                               end_date: datetime, market: str = 'GLOBAL') -> Dict[str, Any]:
        """گزارش کیفیت داده"""
        
        report = {
            'symbols': symbols,
            'period': {'start': start_date, 'end': end_date},
            'market': market,
            'analysis': {},
            'gaps': [],
            'summary': {}
        }
        
        total_trading_days = len(self.trading_calendar.get_trading_days_between(
            start_date.date(), end_date.date(), market
        ))
        
        for symbol in symbols:
            data = self._get_symbol_data(symbol, start_date, end_date)
            gaps = [g for g in self.detect_data_gaps([symbol], start_date, end_date, market) 
                   if g.symbol == symbol]
            
            data_days = len(set(item.timestamp.date() for item in data))
            coverage = (data_days / total_trading_days * 100) if total_trading_days > 0 else 0
            
            report['analysis'][symbol] = {
                'total_records': len(data),
                'unique_dates': data_days,
                'expected_trading_days': total_trading_days,
                'coverage_percent': coverage,
                'gaps_count': len(gaps),
                'longest_gap': max([g.duration_days for g in gaps], default=0),
                'data_quality': 'Good' if coverage > 95 else 'Poor' if coverage < 80 else 'Fair'
            }
        
        # گپ‌های کلی
        all_gaps = self.detect_data_gaps(symbols, start_date, end_date, market)
        report['gaps'] = [
            {
                'symbol': gap.symbol,
                'start': gap.start_date.isoformat(),
                'end': gap.end_date.isoformat(),
                'duration_days': gap.duration_days,
                'type': gap.gap_type
            }
            for gap in all_gaps
        ]
        
        # خلاصه
        total_records = sum(len(self._get_symbol_data(s, start_date, end_date)) for s in symbols)
        avg_coverage = np.mean([report['analysis'][s]['coverage_percent'] for s in symbols])
        
        report['summary'] = {
            'total_records': total_records,
            'average_coverage': avg_coverage,
            'total_gaps': len(all_gaps),
            'overall_quality': 'Good' if avg_coverage > 95 else 'Poor' if avg_coverage < 80 else 'Fair'
        }
        
        return report
    
    def clear_cache(self):
        """پاک کردن کش"""
        self._data_cache.clear()
        self._aligned_cache.clear()
        self.logger.info("Data alignment cache cleared")