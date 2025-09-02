import * as d3 from 'd3';

export class TechnicalIndicators {
  
  static SMA(data, period, key = 'close') {
    const sma = [];
    for (let i = 0; i < data.length; i++) {
      if (i < period - 1) {
        sma.push(null);
      } else {
        const sum = data.slice(i - period + 1, i + 1)
          .reduce((acc, d) => acc + d[key], 0);
        sma.push(sum / period);
      }
    }
    return sma;
  }

  static EMA(data, period, key = 'close') {
    const ema = [];
    const multiplier = 2 / (period + 1);
    
    for (let i = 0; i < data.length; i++) {
      if (i === 0) {
        ema.push(data[i][key]);
      } else if (i < period - 1) {
        const sum = data.slice(0, i + 1).reduce((acc, d) => acc + d[key], 0);
        ema.push(sum / (i + 1));
      } else {
        ema.push((data[i][key] - ema[i - 1]) * multiplier + ema[i - 1]);
      }
    }
    return ema;
  }

  static WMA(data, period, key = 'close') {
    const wma = [];
    const denominator = (period * (period + 1)) / 2;
    
    for (let i = 0; i < data.length; i++) {
      if (i < period - 1) {
        wma.push(null);
      } else {
        let sum = 0;
        for (let j = 0; j < period; j++) {
          sum += data[i - j][key] * (period - j);
        }
        wma.push(sum / denominator);
      }
    }
    return wma;
  }

  static VWMA(data, period) {
    const vwma = [];
    for (let i = 0; i < data.length; i++) {
      if (i < period - 1) {
        vwma.push(null);
      } else {
        const slice = data.slice(i - period + 1, i + 1);
        const sumPV = slice.reduce((acc, d) => acc + d.close * d.volume, 0);
        const sumV = slice.reduce((acc, d) => acc + d.volume, 0);
        vwma.push(sumV > 0 ? sumPV / sumV : null);
      }
    }
    return vwma;
  }

  static BollingerBands(data, period = 20, stdDev = 2) {
    const sma = this.SMA(data, period);
    const bands = [];
    
    for (let i = 0; i < data.length; i++) {
      if (i < period - 1) {
        bands.push({ upper: null, middle: null, lower: null, width: null });
      } else {
        const slice = data.slice(i - period + 1, i + 1);
        const mean = sma[i];
        const variance = slice.reduce((acc, d) => acc + Math.pow(d.close - mean, 2), 0) / period;
        const std = Math.sqrt(variance);
        
        bands.push({
          upper: mean + (stdDev * std),
          middle: mean,
          lower: mean - (stdDev * std),
          width: 2 * stdDev * std
        });
      }
    }
    return bands;
  }

  static RSI(data, period = 14) {
    const rsi = [];
    let gains = 0;
    let losses = 0;
    
    for (let i = 0; i < data.length; i++) {
      if (i === 0) {
        rsi.push(null);
      } else {
        const change = data[i].close - data[i - 1].close;
        
        if (i <= period) {
          if (change > 0) gains += change;
          else losses -= change;
          
          if (i === period) {
            const avgGain = gains / period;
            const avgLoss = losses / period;
            const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
            rsi.push(100 - (100 / (1 + rs)));
          } else {
            rsi.push(null);
          }
        } else {
          const gain = change > 0 ? change : 0;
          const loss = change < 0 ? -change : 0;
          const avgGain = (gains * (period - 1) + gain) / period;
          const avgLoss = (losses * (period - 1) + loss) / period;
          gains = avgGain;
          losses = avgLoss;
          const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
          rsi.push(100 - (100 / (1 + rs)));
        }
      }
    }
    return rsi;
  }

  static MACD(data, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
    const fastEMA = this.EMA(data, fastPeriod);
    const slowEMA = this.EMA(data, slowPeriod);
    const macdLine = [];
    const macdData = [];
    
    for (let i = 0; i < data.length; i++) {
      if (i < slowPeriod - 1) {
        macdLine.push(null);
      } else {
        macdLine.push(fastEMA[i] - slowEMA[i]);
      }
    }
    
    const tempData = macdLine.filter(v => v !== null).map(v => ({ close: v }));
    const signalLine = this.EMA(tempData, signalPeriod).map(v => v);
    let signalIndex = 0;
    
    for (let i = 0; i < data.length; i++) {
      if (macdLine[i] === null) {
        macdData.push({
          macd: null,
          signal: null,
          histogram: null
        });
      } else {
        const signal = signalIndex < signalLine.length ? signalLine[signalIndex] : null;
        macdData.push({
          macd: macdLine[i],
          signal: signal,
          histogram: signal !== null ? macdLine[i] - signal : null
        });
        signalIndex++;
      }
    }
    
    return macdData;
  }

  static StochasticOscillator(data, period = 14, smoothK = 3, smoothD = 3) {
    const stochastic = [];
    
    for (let i = 0; i < data.length; i++) {
      if (i < period - 1) {
        stochastic.push({ k: null, d: null });
      } else {
        const slice = data.slice(i - period + 1, i + 1);
        const high = Math.max(...slice.map(d => d.high));
        const low = Math.min(...slice.map(d => d.low));
        const k = high !== low ? ((data[i].close - low) / (high - low)) * 100 : 50;
        stochastic.push({ k: k, d: null });
      }
    }
    
    const smoothedK = this.SMA(stochastic.map(s => ({ close: s.k || 0 })), smoothK);
    const smoothedD = this.SMA(smoothedK.map(k => ({ close: k || 0 })), smoothD);
    
    return stochastic.map((s, i) => ({
      k: smoothedK[i],
      d: smoothedD[i]
    }));
  }

  static ATR(data, period = 14) {
    const tr = [];
    const atr = [];
    
    for (let i = 0; i < data.length; i++) {
      if (i === 0) {
        tr.push(data[i].high - data[i].low);
      } else {
        tr.push(Math.max(
          data[i].high - data[i].low,
          Math.abs(data[i].high - data[i - 1].close),
          Math.abs(data[i].low - data[i - 1].close)
        ));
      }
    }
    
    for (let i = 0; i < tr.length; i++) {
      if (i < period - 1) {
        atr.push(null);
      } else if (i === period - 1) {
        atr.push(tr.slice(0, period).reduce((a, b) => a + b) / period);
      } else {
        atr.push((atr[i - 1] * (period - 1) + tr[i]) / period);
      }
    }
    
    return atr;
  }

  static ADX(data, period = 14) {
    const plusDM = [];
    const minusDM = [];
    const tr = [];
    
    for (let i = 0; i < data.length; i++) {
      if (i === 0) {
        plusDM.push(0);
        minusDM.push(0);
        tr.push(data[i].high - data[i].low);
      } else {
        const upMove = data[i].high - data[i - 1].high;
        const downMove = data[i - 1].low - data[i].low;
        
        plusDM.push(upMove > downMove && upMove > 0 ? upMove : 0);
        minusDM.push(downMove > upMove && downMove > 0 ? downMove : 0);
        
        tr.push(Math.max(
          data[i].high - data[i].low,
          Math.abs(data[i].high - data[i - 1].close),
          Math.abs(data[i].low - data[i - 1].close)
        ));
      }
    }
    
    const atr = this.ATR(data, period);
    const plusDI = [];
    const minusDI = [];
    const dx = [];
    const adx = [];
    
    let plusDMSum = 0;
    let minusDMSum = 0;
    
    for (let i = 0; i < data.length; i++) {
      if (i < period - 1) {
        plusDI.push(null);
        minusDI.push(null);
        dx.push(null);
        adx.push(null);
      } else {
        if (i === period - 1) {
          plusDMSum = plusDM.slice(0, period).reduce((a, b) => a + b);
          minusDMSum = minusDM.slice(0, period).reduce((a, b) => a + b);
        } else {
          plusDMSum = plusDMSum - plusDMSum / period + plusDM[i];
          minusDMSum = minusDMSum - minusDMSum / period + minusDM[i];
        }
        
        const pdi = atr[i] > 0 ? (plusDMSum / atr[i]) * 100 / period : 0;
        const mdi = atr[i] > 0 ? (minusDMSum / atr[i]) * 100 / period : 0;
        
        plusDI.push(pdi);
        minusDI.push(mdi);
        
        const sum = pdi + mdi;
        dx.push(sum > 0 ? Math.abs(pdi - mdi) / sum * 100 : 0);
      }
    }
    
    for (let i = 0; i < dx.length; i++) {
      if (i < period * 2 - 2) {
        adx.push(null);
      } else if (i === period * 2 - 2) {
        const validDx = dx.slice(period - 1, period * 2 - 1).filter(v => v !== null);
        adx.push(validDx.reduce((a, b) => a + b) / validDx.length);
      } else {
        adx.push((adx[i - 1] * (period - 1) + dx[i]) / period);
      }
    }
    
    return { adx, plusDI, minusDI };
  }

  static CCI(data, period = 20) {
    const cci = [];
    
    for (let i = 0; i < data.length; i++) {
      if (i < period - 1) {
        cci.push(null);
      } else {
        const slice = data.slice(i - period + 1, i + 1);
        const tp = slice.map(d => (d.high + d.low + d.close) / 3);
        const sma = tp.reduce((a, b) => a + b) / period;
        const mad = tp.reduce((a, b) => a + Math.abs(b - sma), 0) / period;
        const currentTP = (data[i].high + data[i].low + data[i].close) / 3;
        cci.push(mad > 0 ? (currentTP - sma) / (0.015 * mad) : 0);
      }
    }
    
    return cci;
  }

  static WilliamsR(data, period = 14) {
    const williams = [];
    
    for (let i = 0; i < data.length; i++) {
      if (i < period - 1) {
        williams.push(null);
      } else {
        const slice = data.slice(i - period + 1, i + 1);
        const high = Math.max(...slice.map(d => d.high));
        const low = Math.min(...slice.map(d => d.low));
        williams.push(high !== low ? ((high - data[i].close) / (high - low)) * -100 : -50);
      }
    }
    
    return williams;
  }

  static MFI(data, period = 14) {
    const mfi = [];
    let posFlow = 0;
    let negFlow = 0;
    
    for (let i = 0; i < data.length; i++) {
      if (i === 0) {
        mfi.push(null);
      } else {
        const typicalPrice = (data[i].high + data[i].low + data[i].close) / 3;
        const prevTypicalPrice = (data[i - 1].high + data[i - 1].low + data[i - 1].close) / 3;
        const moneyFlow = typicalPrice * data[i].volume;
        
        if (i <= period) {
          if (typicalPrice > prevTypicalPrice) {
            posFlow += moneyFlow;
          } else {
            negFlow += moneyFlow;
          }
          
          if (i === period) {
            const ratio = negFlow === 0 ? 100 : posFlow / negFlow;
            mfi.push(100 - (100 / (1 + ratio)));
          } else {
            mfi.push(null);
          }
        } else {
          const oldTypicalPrice = (data[i - period].high + data[i - period].low + data[i - period].close) / 3;
          const oldPrevTypicalPrice = (data[i - period - 1].high + data[i - period - 1].low + data[i - period - 1].close) / 3;
          const oldMoneyFlow = oldTypicalPrice * data[i - period].volume;
          
          if (oldTypicalPrice > oldPrevTypicalPrice) {
            posFlow -= oldMoneyFlow;
          } else {
            negFlow -= oldMoneyFlow;
          }
          
          if (typicalPrice > prevTypicalPrice) {
            posFlow += moneyFlow;
          } else {
            negFlow += moneyFlow;
          }
          
          const ratio = negFlow === 0 ? 100 : posFlow / negFlow;
          mfi.push(100 - (100 / (1 + ratio)));
        }
      }
    }
    
    return mfi;
  }

  static OBV(data) {
    const obv = [];
    let cumulativeOBV = 0;
    
    for (let i = 0; i < data.length; i++) {
      if (i === 0) {
        cumulativeOBV = data[i].volume;
      } else {
        if (data[i].close > data[i - 1].close) {
          cumulativeOBV += data[i].volume;
        } else if (data[i].close < data[i - 1].close) {
          cumulativeOBV -= data[i].volume;
        }
      }
      obv.push(cumulativeOBV);
    }
    
    return obv;
  }

  static VWAP(data) {
    const vwap = [];
    let cumulativePV = 0;
    let cumulativeVolume = 0;
    
    for (let i = 0; i < data.length; i++) {
      const typicalPrice = (data[i].high + data[i].low + data[i].close) / 3;
      cumulativePV += typicalPrice * data[i].volume;
      cumulativeVolume += data[i].volume;
      vwap.push(cumulativeVolume > 0 ? cumulativePV / cumulativeVolume : typicalPrice);
    }
    
    return vwap;
  }

  static PivotPoints(data) {
    const pivots = [];
    
    for (let i = 0; i < data.length; i++) {
      const high = data[i].high;
      const low = data[i].low;
      const close = data[i].close;
      const pivot = (high + low + close) / 3;
      
      pivots.push({
        pivot: pivot,
        r1: 2 * pivot - low,
        r2: pivot + (high - low),
        r3: high + 2 * (pivot - low),
        s1: 2 * pivot - high,
        s2: pivot - (high - low),
        s3: low - 2 * (high - pivot)
      });
    }
    
    return pivots;
  }

  static FibonacciRetracement(high, low) {
    const diff = high - low;
    return {
      0: high,
      0.236: high - diff * 0.236,
      0.382: high - diff * 0.382,
      0.5: high - diff * 0.5,
      0.618: high - diff * 0.618,
      0.786: high - diff * 0.786,
      1: low,
      1.618: high - diff * 1.618,
      2.618: high - diff * 2.618,
      3.618: high - diff * 3.618,
      4.236: high - diff * 4.236
    };
  }

  static IchimokuCloud(data, conversionPeriod = 9, basePeriod = 26, spanBPeriod = 52, displacement = 26) {
    const ichimoku = [];
    
    for (let i = 0; i < data.length + displacement; i++) {
      const dataIndex = Math.min(i, data.length - 1);
      
      const conversionLine = i >= conversionPeriod - 1 ? this.calculateMidpoint(data, dataIndex, conversionPeriod) : null;
      const baseLine = i >= basePeriod - 1 ? this.calculateMidpoint(data, dataIndex, basePeriod) : null;
      const spanA = conversionLine !== null && baseLine !== null ? (conversionLine + baseLine) / 2 : null;
      const spanB = i >= spanBPeriod - 1 ? this.calculateMidpoint(data, dataIndex, spanBPeriod) : null;
      
      let laggingSpan = null;
      if (i >= displacement && i - displacement < data.length) {
        laggingSpan = data[i - displacement].close;
      }
      
      ichimoku.push({
        conversionLine,
        baseLine,
        spanA,
        spanB,
        laggingSpan
      });
    }
    
    return ichimoku;
  }

  static calculateMidpoint(data, endIndex, period) {
    const startIndex = Math.max(0, endIndex - period + 1);
    const slice = data.slice(startIndex, endIndex + 1);
    const high = Math.max(...slice.map(d => d.high));
    const low = Math.min(...slice.map(d => d.low));
    return (high + low) / 2;
  }

  static ParabolicSAR(data, acceleration = 0.02, maximum = 0.2) {
    const sar = [];
    let isUpTrend = true;
    let ep = data[0].high;
    let sarValue = data[0].low;
    let af = acceleration;
    
    for (let i = 0; i < data.length; i++) {
      if (i === 0) {
        sar.push(sarValue);
      } else {
        if (isUpTrend) {
          sarValue = sarValue + af * (ep - sarValue);
          
          if (data[i].low <= sarValue) {
            isUpTrend = false;
            sarValue = ep;
            ep = data[i].low;
            af = acceleration;
          } else {
            if (data[i].high > ep) {
              ep = data[i].high;
              af = Math.min(af + acceleration, maximum);
            }
            sarValue = Math.min(sarValue, data[i - 1].low, i > 1 ? data[i - 2].low : data[i - 1].low);
          }
        } else {
          sarValue = sarValue + af * (ep - sarValue);
          
          if (data[i].high >= sarValue) {
            isUpTrend = true;
            sarValue = ep;
            ep = data[i].high;
            af = acceleration;
          } else {
            if (data[i].low < ep) {
              ep = data[i].low;
              af = Math.min(af + acceleration, maximum);
            }
            sarValue = Math.max(sarValue, data[i - 1].high, i > 1 ? data[i - 2].high : data[i - 1].high);
          }
        }
        
        sar.push(sarValue);
      }
    }
    
    return sar;
  }

  static SuperTrend(data, period = 10, multiplier = 3) {
    const atr = this.ATR(data, period);
    const supertrend = [];
    let prevTrend = 1;
    
    for (let i = 0; i < data.length; i++) {
      if (i < period - 1) {
        supertrend.push({ trend: null, value: null });
      } else {
        const hl2 = (data[i].high + data[i].low) / 2;
        const upperBand = hl2 + multiplier * atr[i];
        const lowerBand = hl2 - multiplier * atr[i];
        
        let trend;
        let value;
        
        if (data[i].close <= upperBand && prevTrend === 1) {
          trend = 1;
          value = upperBand;
        } else if (data[i].close <= lowerBand && prevTrend === -1) {
          trend = 1;
          value = upperBand;
        } else if (data[i].close >= lowerBand && prevTrend === -1) {
          trend = -1;
          value = lowerBand;
        } else if (data[i].close >= upperBand && prevTrend === 1) {
          trend = -1;
          value = lowerBand;
        } else {
          trend = prevTrend;
          value = trend === 1 ? upperBand : lowerBand;
        }
        
        supertrend.push({ trend, value });
        prevTrend = trend;
      }
    }
    
    return supertrend;
  }

  static DonchianChannel(data, period = 20) {
    const channels = [];
    
    for (let i = 0; i < data.length; i++) {
      if (i < period - 1) {
        channels.push({ upper: null, middle: null, lower: null });
      } else {
        const slice = data.slice(i - period + 1, i + 1);
        const upper = Math.max(...slice.map(d => d.high));
        const lower = Math.min(...slice.map(d => d.low));
        const middle = (upper + lower) / 2;
        
        channels.push({ upper, middle, lower });
      }
    }
    
    return channels;
  }

  static KeltnerChannel(data, period = 20, multiplier = 2) {
    const ema = this.EMA(data, period);
    const atr = this.ATR(data, period);
    const channels = [];
    
    for (let i = 0; i < data.length; i++) {
      if (i < period - 1) {
        channels.push({ upper: null, middle: null, lower: null });
      } else {
        channels.push({
          upper: ema[i] + multiplier * atr[i],
          middle: ema[i],
          lower: ema[i] - multiplier * atr[i]
        });
      }
    }
    
    return channels;
  }

  static TEMA(data, period) {
    const ema1 = this.EMA(data, period);
    const ema2 = this.EMA(ema1.map(v => ({ close: v || 0 })), period);
    const ema3 = this.EMA(ema2.map(v => ({ close: v || 0 })), period);
    
    return ema1.map((v, i) => {
      if (v === null || ema2[i] === null || ema3[i] === null) return null;
      return 3 * v - 3 * ema2[i] + ema3[i];
    });
  }

  static HullMovingAverage(data, period) {
    const halfPeriod = Math.floor(period / 2);
    const sqrtPeriod = Math.floor(Math.sqrt(period));
    
    const wma1 = this.WMA(data, halfPeriod);
    const wma2 = this.WMA(data, period);
    
    const diff = wma1.map((v, i) => ({
      close: v !== null && wma2[i] !== null ? 2 * v - wma2[i] : null
    }));
    
    return this.WMA(diff.filter(d => d.close !== null), sqrtPeriod);
  }

  static ZigZag(data, deviation = 5) {
    const zigzag = [];
    let lastPivot = { index: 0, value: data[0].close, type: 'low' };
    
    for (let i = 1; i < data.length; i++) {
      const percentChange = ((data[i].close - lastPivot.value) / lastPivot.value) * 100;
      
      if (lastPivot.type === 'low') {
        if (percentChange >= deviation) {
          zigzag.push(lastPivot);
          lastPivot = { index: i, value: data[i].close, type: 'high' };
        } else if (data[i].close < lastPivot.value) {
          lastPivot = { index: i, value: data[i].close, type: 'low' };
        }
      } else {
        if (percentChange <= -deviation) {
          zigzag.push(lastPivot);
          lastPivot = { index: i, value: data[i].close, type: 'low' };
        } else if (data[i].close > lastPivot.value) {
          lastPivot = { index: i, value: data[i].close, type: 'high' };
        }
      }
    }
    
    zigzag.push(lastPivot);
    return zigzag;
  }

  static AroonIndicator(data, period = 25) {
    const aroon = [];
    
    for (let i = 0; i < data.length; i++) {
      if (i < period) {
        aroon.push({ up: null, down: null, oscillator: null });
      } else {
        const slice = data.slice(i - period, i + 1);
        const highIndex = slice.reduce((maxIdx, d, idx, arr) => 
          d.high > arr[maxIdx].high ? idx : maxIdx, 0);
        const lowIndex = slice.reduce((minIdx, d, idx, arr) => 
          d.low < arr[minIdx].low ? idx : minIdx, 0);
        
        const aroonUp = ((period - (period - highIndex)) / period) * 100;
        const aroonDown = ((period - (period - lowIndex)) / period) * 100;
        
        aroon.push({
          up: aroonUp,
          down: aroonDown,
          oscillator: aroonUp - aroonDown
        });
      }
    }
    
    return aroon;
  }

  static ChaikinMoneyFlow(data, period = 20) {
    const cmf = [];
    
    for (let i = 0; i < data.length; i++) {
      if (i < period - 1) {
        cmf.push(null);
      } else {
        const slice = data.slice(i - period + 1, i + 1);
        let mfvSum = 0;
        let volumeSum = 0;
        
        slice.forEach(d => {
          const mfMultiplier = d.high !== d.low ? 
            ((d.close - d.low) - (d.high - d.close)) / (d.high - d.low) : 0;
          mfvSum += mfMultiplier * d.volume;
          volumeSum += d.volume;
        });
        
        cmf.push(volumeSum > 0 ? mfvSum / volumeSum : 0);
      }
    }
    
    return cmf;
  }

  static ElderRayIndex(data, period = 13) {
    const ema = this.EMA(data, period);
    const elderRay = [];
    
    for (let i = 0; i < data.length; i++) {
      if (ema[i] === null) {
        elderRay.push({ bullPower: null, bearPower: null });
      } else {
        elderRay.push({
          bullPower: data[i].high - ema[i],
          bearPower: data[i].low - ema[i]
        });
      }
    }
    
    return elderRay;
  }

  static ForceIndex(data, period = 13) {
    const forceIndex = [];
    
    for (let i = 0; i < data.length; i++) {
      if (i === 0) {
        forceIndex.push(null);
      } else {
        const force = (data[i].close - data[i - 1].close) * data[i].volume;
        forceIndex.push(force);
      }
    }
    
    const ema = this.EMA(forceIndex.map(v => ({ close: v || 0 })), period);
    return ema;
  }

  static MassIndex(data, period = 25, emaPeriod = 9) {
    const ema1 = this.EMA(data.map(d => ({ close: d.high - d.low })), emaPeriod);
    const ema2 = this.EMA(ema1.map(v => ({ close: v || 0 })), emaPeriod);
    const massIndex = [];
    
    for (let i = 0; i < data.length; i++) {
      if (i < period - 1 || ema1[i] === null || ema2[i] === null) {
        massIndex.push(null);
      } else {
        let sum = 0;
        for (let j = i - period + 1; j <= i; j++) {
          if (ema2[j] > 0) {
            sum += ema1[j] / ema2[j];
          }
        }
        massIndex.push(sum);
      }
    }
    
    return massIndex;
  }

  static TRIX(data, period = 14) {
    const ema1 = this.EMA(data, period);
    const ema2 = this.EMA(ema1.map(v => ({ close: v || 0 })), period);
    const ema3 = this.EMA(ema2.map(v => ({ close: v || 0 })), period);
    const trix = [];
    
    for (let i = 0; i < ema3.length; i++) {
      if (i === 0 || ema3[i] === null || ema3[i - 1] === null || ema3[i - 1] === 0) {
        trix.push(null);
      } else {
        trix.push(((ema3[i] - ema3[i - 1]) / ema3[i - 1]) * 10000);
      }
    }
    
    return trix;
  }

  static VortexIndicator(data, period = 14) {
    const vi = [];
    
    for (let i = 0; i < data.length; i++) {
      if (i < period) {
        vi.push({ positive: null, negative: null });
      } else {
        let vmPlus = 0;
        let vmMinus = 0;
        let tr = 0;
        
        for (let j = i - period + 1; j <= i; j++) {
          vmPlus += Math.abs(data[j].high - data[j - 1].low);
          vmMinus += Math.abs(data[j].low - data[j - 1].high);
          tr += Math.max(
            data[j].high - data[j].low,
            Math.abs(data[j].high - data[j - 1].close),
            Math.abs(data[j].low - data[j - 1].close)
          );
        }
        
        vi.push({
          positive: tr > 0 ? vmPlus / tr : 0,
          negative: tr > 0 ? vmMinus / tr : 0
        });
      }
    }
    
    return vi;
  }

  static KnowSureThing(data, r1 = 10, r2 = 15, r3 = 20, r4 = 30) {
    const roc1 = this.ROC(data, r1);
    const roc2 = this.ROC(data, r2);
    const roc3 = this.ROC(data, r3);
    const roc4 = this.ROC(data, r4);
    
    const kst = [];
    for (let i = 0; i < data.length; i++) {
      if (roc1[i] === null || roc2[i] === null || roc3[i] === null || roc4[i] === null) {
        kst.push(null);
      } else {
        kst.push(roc1[i] + 2 * roc2[i] + 3 * roc3[i] + 4 * roc4[i]);
      }
    }
    
    return kst;
  }

  static ROC(data, period) {
    const roc = [];
    
    for (let i = 0; i < data.length; i++) {
      if (i < period) {
        roc.push(null);
      } else {
        const prevPrice = data[i - period].close;
        roc.push(prevPrice !== 0 ? ((data[i].close - prevPrice) / prevPrice) * 100 : 0);
      }
    }
    
    return roc;
  }

  static UltimateOscillator(data, period1 = 7, period2 = 14, period3 = 28) {
    const bp = [];
    const tr = [];
    
    for (let i = 0; i < data.length; i++) {
      if (i === 0) {
        bp.push(0);
        tr.push(data[i].high - data[i].low);
      } else {
        bp.push(data[i].close - Math.min(data[i].low, data[i - 1].close));
        tr.push(Math.max(
          data[i].high - data[i].low,
          Math.abs(data[i].high - data[i - 1].close),
          Math.abs(data[i].low - data[i - 1].close)
        ));
      }
    }
    
    const uo = [];
    for (let i = 0; i < data.length; i++) {
      if (i < period3 - 1) {
        uo.push(null);
      } else {
        const avg1 = this.sumRange(bp, i - period1 + 1, i + 1) / this.sumRange(tr, i - period1 + 1, i + 1);
        const avg2 = this.sumRange(bp, i - period2 + 1, i + 1) / this.sumRange(tr, i - period2 + 1, i + 1);
        const avg3 = this.sumRange(bp, i - period3 + 1, i + 1) / this.sumRange(tr, i - period3 + 1, i + 1);
        
        uo.push(100 * ((4 * avg1 + 2 * avg2 + avg3) / 7));
      }
    }
    
    return uo;
  }

  static sumRange(array, start, end) {
    return array.slice(start, end).reduce((a, b) => a + b, 0);
  }

  static AwesomeOscillator(data) {
    const medianPrice = data.map(d => (d.high + d.low) / 2);
    const sma5 = this.SMA(medianPrice.map(p => ({ close: p })), 5);
    const sma34 = this.SMA(medianPrice.map(p => ({ close: p })), 34);
    
    return sma5.map((v, i) => {
      if (v === null || sma34[i] === null) return null;
      return v - sma34[i];
    });
  }

  static AcceleratorOscillator(data) {
    const ao = this.AwesomeOscillator(data);
    const aoSMA = this.SMA(ao.filter(v => v !== null).map(v => ({ close: v })), 5);
    
    let smaIndex = 0;
    return ao.map(v => {
      if (v === null) return null;
      const sma = aoSMA[smaIndex++];
      return sma !== null ? v - sma : null;
    });
  }

  static FractalIndicator(data, period = 5) {
    const fractals = [];
    const halfPeriod = Math.floor(period / 2);
    
    for (let i = 0; i < data.length; i++) {
      if (i < halfPeriod || i >= data.length - halfPeriod) {
        fractals.push({ up: false, down: false });
      } else {
        let isUpFractal = true;
        let isDownFractal = true;
        
        for (let j = i - halfPeriod; j <= i + halfPeriod; j++) {
          if (j !== i) {
            if (data[j].high >= data[i].high) isUpFractal = false;
            if (data[j].low <= data[i].low) isDownFractal = false;
          }
        }
        
        fractals.push({ up: isUpFractal, down: isDownFractal });
      }
    }
    
    return fractals;
  }

  static GatorOscillator(data) {
    const jaw = this.SMMA(data, 13, 8);
    const teeth = this.SMMA(data, 8, 5);
    const lips = this.SMMA(data, 5, 3);
    
    const gator = [];
    for (let i = 0; i < data.length; i++) {
      if (jaw[i] === null || teeth[i] === null || lips[i] === null) {
        gator.push({ upper: null, lower: null });
      } else {
        gator.push({
          upper: Math.abs(jaw[i] - teeth[i]),
          lower: -Math.abs(teeth[i] - lips[i])
        });
      }
    }
    
    return gator;
  }

  static SMMA(data, period, shift = 0) {
    const smma = [];
    let sum = 0;
    
    for (let i = 0; i < data.length + shift; i++) {
      const dataIndex = Math.max(0, i - shift);
      
      if (dataIndex >= data.length) {
        smma.push(smma[smma.length - 1]);
      } else if (i < period - 1) {
        sum += data[dataIndex].close;
        smma.push(null);
      } else if (i === period - 1) {
        sum += data[dataIndex].close;
        smma.push(sum / period);
      } else {
        const prevSMMA = smma[i - 1];
        smma.push((prevSMMA * (period - 1) + data[dataIndex].close) / period);
      }
    }
    
    return smma;
  }

  static LinearRegression(data, period) {
    const lr = [];
    
    for (let i = 0; i < data.length; i++) {
      if (i < period - 1) {
        lr.push({ slope: null, intercept: null, value: null });
      } else {
        const slice = data.slice(i - period + 1, i + 1);
        const x = Array.from({ length: period }, (_, idx) => idx);
        const y = slice.map(d => d.close);
        
        const xMean = x.reduce((a, b) => a + b) / period;
        const yMean = y.reduce((a, b) => a + b) / period;
        
        let numerator = 0;
        let denominator = 0;
        
        for (let j = 0; j < period; j++) {
          numerator += (x[j] - xMean) * (y[j] - yMean);
          denominator += Math.pow(x[j] - xMean, 2);
        }
        
        const slope = denominator !== 0 ? numerator / denominator : 0;
        const intercept = yMean - slope * xMean;
        const value = slope * (period - 1) + intercept;
        
        lr.push({ slope, intercept, value });
      }
    }
    
    return lr;
  }

  static StandardDeviation(data, period) {
    const stdDev = [];
    
    for (let i = 0; i < data.length; i++) {
      if (i < period - 1) {
        stdDev.push(null);
      } else {
        const slice = data.slice(i - period + 1, i + 1);
        const mean = slice.reduce((a, d) => a + d.close, 0) / period;
        const variance = slice.reduce((a, d) => a + Math.pow(d.close - mean, 2), 0) / period;
        stdDev.push(Math.sqrt(variance));
      }
    }
    
    return stdDev;
  }

  static HistoricalVolatility(data, period = 20) {
    const returns = [];
    
    for (let i = 1; i < data.length; i++) {
      returns.push(Math.log(data[i].close / data[i - 1].close));
    }
    
    const hv = [];
    for (let i = 0; i < returns.length; i++) {
      if (i < period - 1) {
        hv.push(null);
      } else {
        const slice = returns.slice(i - period + 1, i + 1);
        const mean = slice.reduce((a, b) => a + b) / period;
        const variance = slice.reduce((a, r) => a + Math.pow(r - mean, 2), 0) / period;
        hv.push(Math.sqrt(variance) * Math.sqrt(252) * 100);
      }
    }
    
    return [null, ...hv];
  }

  static CandlePatterns = {
    isBullishEngulfing(prev, current) {
      return prev.close < prev.open && 
             current.close > current.open &&
             current.open <= prev.close &&
             current.close >= prev.open;
    },
    
    isBearishEngulfing(prev, current) {
      return prev.close > prev.open && 
             current.close < current.open &&
             current.open >= prev.close &&
             current.close <= prev.open;
    },
    
    isHammer(candle) {
      const body = Math.abs(candle.close - candle.open);
      const lowerShadow = Math.min(candle.open, candle.close) - candle.low;
      const upperShadow = candle.high - Math.max(candle.open, candle.close);
      return lowerShadow >= body * 2 && upperShadow <= body * 0.5;
    },
    
    isShootingStar(candle) {
      const body = Math.abs(candle.close - candle.open);
      const upperShadow = candle.high - Math.max(candle.open, candle.close);
      const lowerShadow = Math.min(candle.open, candle.close) - candle.low;
      return upperShadow >= body * 2 && lowerShadow <= body * 0.5;
    },
    
    isDoji(candle) {
      const body = Math.abs(candle.close - candle.open);
      const range = candle.high - candle.low;
      return body <= range * 0.1;
    },
    
    isMorningStar(first, second, third) {
      return first.close < first.open &&
             Math.abs(second.close - second.open) < (first.high - first.low) * 0.3 &&
             third.close > third.open &&
             third.close > (first.open + first.close) / 2;
    },
    
    isEveningStar(first, second, third) {
      return first.close > first.open &&
             Math.abs(second.close - second.open) < (first.high - first.low) * 0.3 &&
             third.close < third.open &&
             third.close < (first.open + first.close) / 2;
    },
    
    detectPatterns(data) {
      const patterns = [];
      
      for (let i = 2; i < data.length; i++) {
        const current = data[i];
        const prev = data[i - 1];
        const prevPrev = data[i - 2];
        
        if (this.isBullishEngulfing(prev, current)) {
          patterns.push({ index: i, type: 'bullishEngulfing', strength: 'strong' });
        }
        if (this.isBearishEngulfing(prev, current)) {
          patterns.push({ index: i, type: 'bearishEngulfing', strength: 'strong' });
        }
        if (this.isHammer(current)) {
          patterns.push({ index: i, type: 'hammer', strength: 'medium' });
        }
        if (this.isShootingStar(current)) {
          patterns.push({ index: i, type: 'shootingStar', strength: 'medium' });
        }
        if (this.isDoji(current)) {
          patterns.push({ index: i, type: 'doji', strength: 'weak' });
        }
        if (this.isMorningStar(prevPrev, prev, current)) {
          patterns.push({ index: i, type: 'morningStar', strength: 'strong' });
        }
        if (this.isEveningStar(prevPrev, prev, current)) {
          patterns.push({ index: i, type: 'eveningStar', strength: 'strong' });
        }
      }
      
      return patterns;
    }
  };
}

export default TechnicalIndicators;