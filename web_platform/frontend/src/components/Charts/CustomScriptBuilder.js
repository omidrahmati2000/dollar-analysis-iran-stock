/**
 * Custom Script/Indicator Builder - ساخت اندیکاتور و اسکریپت سفارشی
 * Pine Script-like environment for creating custom indicators and strategies
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tabs,
  Tab,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Alert,
  CircularProgress,
  Grid,
  Card,
  CardContent,
  CardActions,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Divider,
  Tooltip,
  Switch,
  FormControlLabel
} from '@mui/material';
import {
  Code,
  PlayArrow,
  Save,
  Delete,
  Share,
  Settings,
  BugReport,
  Timeline,
  ShowChart,
  Functions,
  DataUsage,
  School,
  ContentCopy,
  CloudDownload
} from '@mui/icons-material';
import localStorageManager from '../../services/storage/LocalStorageManager';

const SCRIPT_TYPES = {
  INDICATOR: 'indicator',
  STRATEGY: 'strategy',
  STUDY: 'study'
};

const DATA_TYPES = {
  FLOAT: 'float',
  INTEGER: 'int',
  BOOLEAN: 'bool',
  STRING: 'string',
  COLOR: 'color'
};

const BUILT_IN_FUNCTIONS = {
  // Math Functions
  MATH: [
    { name: 'abs', description: 'Absolute value', syntax: 'abs(x)' },
    { name: 'sqrt', description: 'Square root', syntax: 'sqrt(x)' },
    { name: 'pow', description: 'Power', syntax: 'pow(x, y)' },
    { name: 'max', description: 'Maximum value', syntax: 'max(x, y)' },
    { name: 'min', description: 'Minimum value', syntax: 'min(x, y)' },
    { name: 'round', description: 'Round to nearest integer', syntax: 'round(x)' },
    { name: 'floor', description: 'Floor value', syntax: 'floor(x)' },
    { name: 'ceil', description: 'Ceiling value', syntax: 'ceil(x)' }
  ],
  
  // Technical Analysis
  TECHNICAL: [
    { name: 'sma', description: 'Simple Moving Average', syntax: 'sma(source, length)' },
    { name: 'ema', description: 'Exponential Moving Average', syntax: 'ema(source, length)' },
    { name: 'rsi', description: 'Relative Strength Index', syntax: 'rsi(source, length)' },
    { name: 'macd', description: 'MACD', syntax: 'macd(source, fast, slow, signal)' },
    { name: 'bbands', description: 'Bollinger Bands', syntax: 'bbands(source, length, std)' },
    { name: 'stoch', description: 'Stochastic', syntax: 'stoch(high, low, close, length)' },
    { name: 'atr', description: 'Average True Range', syntax: 'atr(length)' },
    { name: 'adx', description: 'Average Directional Index', syntax: 'adx(length)' }
  ],

  // Price/Volume
  PRICE: [
    { name: 'open', description: 'Opening price', syntax: 'open' },
    { name: 'high', description: 'High price', syntax: 'high' },
    { name: 'low', description: 'Low price', syntax: 'low' },
    { name: 'close', description: 'Closing price', syntax: 'close' },
    { name: 'volume', description: 'Volume', syntax: 'volume' },
    { name: 'hl2', description: '(High + Low) / 2', syntax: 'hl2' },
    { name: 'hlc3', description: '(High + Low + Close) / 3', syntax: 'hlc3' },
    { name: 'ohlc4', description: '(Open + High + Low + Close) / 4', syntax: 'ohlc4' }
  ],

  // Plotting
  PLOT: [
    { name: 'plot', description: 'Plot value on chart', syntax: 'plot(value, title, color)' },
    { name: 'plotshape', description: 'Plot shape', syntax: 'plotshape(condition, style, color)' },
    { name: 'plotarrow', description: 'Plot arrow', syntax: 'plotarrow(condition, colorup, colordown)' },
    { name: 'fill', description: 'Fill between plots', syntax: 'fill(plot1, plot2, color)' },
    { name: 'bgcolor', description: 'Background color', syntax: 'bgcolor(color, transp)' },
    { name: 'hline', description: 'Horizontal line', syntax: 'hline(price, title, color)' }
  ]
};

const SAMPLE_SCRIPTS = {
  SIMPLE_MA: {
    name: 'Simple Moving Average',
    type: SCRIPT_TYPES.INDICATOR,
    code: `//@version=5
indicator("Simple Moving Average", shorttitle="SMA", overlay=true)

// Inputs
length = input.int(20, title="Length", minval=1)
source = input(close, title="Source")

// Calculation
ma = sma(source, length)

// Plot
plot(ma, title="SMA", color=color.blue, linewidth=2)`,
    description: 'Basic moving average indicator'
  },

  RSI_OSCILLATOR: {
    name: 'RSI Oscillator',
    type: SCRIPT_TYPES.INDICATOR,
    code: `//@version=5
indicator("RSI Oscillator", shorttitle="RSI")

// Inputs
length = input.int(14, title="RSI Length", minval=1)
source = input(close, title="Source")

// Calculation
rsi_value = rsi(source, length)

// Plot
plot(rsi_value, title="RSI", color=color.purple, linewidth=2)
hline(70, title="Overbought", color=color.red, linestyle=hline.style_dashed)
hline(30, title="Oversold", color=color.green, linestyle=hline.style_dashed)
hline(50, title="Midline", color=color.gray)

// Background coloring
bgcolor(rsi_value > 70 ? color.new(color.red, 90) : rsi_value < 30 ? color.new(color.green, 90) : na)`,
    description: 'RSI indicator with overbought/oversold levels'
  },

  BOLLINGER_BANDS: {
    name: 'Bollinger Bands',
    type: SCRIPT_TYPES.INDICATOR,
    code: `//@version=5
indicator("Bollinger Bands", shorttitle="BB", overlay=true)

// Inputs
length = input.int(20, title="Length", minval=1)
src = input(close, title="Source")
mult = input.float(2.0, title="StdDev Multiplier", minval=0.001, maxval=50)

// Calculation
basis = sma(src, length)
dev = mult * stdev(src, length)
upper = basis + dev
lower = basis - dev

// Plot
plot(basis, title="Basis", color=color.orange)
p1 = plot(upper, title="Upper", color=color.blue)
p2 = plot(lower, title="Lower", color=color.blue)
fill(p1, p2, color=color.new(color.blue, 95))`,
    description: 'Bollinger Bands with customizable parameters'
  }
};

const CustomScriptBuilder = ({ theme = 'dark' }) => {
  const [activeTab, setActiveTab] = useState(0);
  const [scripts, setScripts] = useState([]);
  const [currentScript, setCurrentScript] = useState(null);
  const [scriptCode, setScriptCode] = useState('');
  const [scriptName, setScriptName] = useState('');
  const [scriptType, setScriptType] = useState(SCRIPT_TYPES.INDICATOR);
  const [isRunning, setIsRunning] = useState(false);
  const [executionResult, setExecutionResult] = useState(null);
  const [error, setError] = useState(null);
  const [showFunctionsDialog, setShowFunctionsDialog] = useState(false);
  const [showSamplesDialog, setShowSamplesDialog] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('MATH');
  
  const codeEditorRef = useRef(null);

  useEffect(() => {
    loadScripts();
  }, []);

  const loadScripts = () => {
    const savedScripts = localStorageManager.getNestedData('charts', 'customScripts', []);
    setScripts(savedScripts);
  };

  const saveScript = () => {
    if (!scriptName.trim() || !scriptCode.trim()) {
      setError('Please provide script name and code');
      return;
    }

    const script = {
      id: currentScript?.id || Date.now().toString(),
      name: scriptName.trim(),
      type: scriptType,
      code: scriptCode,
      createdAt: currentScript?.createdAt || Date.now(),
      updatedAt: Date.now(),
      version: '1.0.0',
      author: 'User',
      description: extractDescriptionFromCode(scriptCode)
    };

    let updatedScripts;
    if (currentScript) {
      updatedScripts = scripts.map(s => s.id === currentScript.id ? script : s);
    } else {
      updatedScripts = [...scripts, script];
    }

    setScripts(updatedScripts);
    localStorageManager.updateData('charts', 'customScripts', updatedScripts);
    
    setCurrentScript(script);
    console.log('💾 Script saved:', script.name);
  };

  const loadScript = (script) => {
    setCurrentScript(script);
    setScriptName(script.name);
    setScriptType(script.type);
    setScriptCode(script.code);
    setError(null);
    setExecutionResult(null);
  };

  const deleteScript = (scriptId) => {
    const updatedScripts = scripts.filter(s => s.id !== scriptId);
    setScripts(updatedScripts);
    localStorageManager.updateData('charts', 'customScripts', updatedScripts);
    
    if (currentScript?.id === scriptId) {
      newScript();
    }
  };

  const newScript = () => {
    setCurrentScript(null);
    setScriptName('');
    setScriptType(SCRIPT_TYPES.INDICATOR);
    setScriptCode('');
    setError(null);
    setExecutionResult(null);
  };

  const runScript = async () => {
    if (!scriptCode.trim()) {
      setError('No code to execute');
      return;
    }

    setIsRunning(true);
    setError(null);

    try {
      // Simulate script execution (in real implementation, this would parse and execute the script)
      const result = await executeScript(scriptCode, scriptType);
      setExecutionResult(result);
      console.log('🚀 Script executed successfully');
    } catch (error) {
      setError(`Execution error: ${error.message}`);
      console.error('❌ Script execution error:', error);
    } finally {
      setIsRunning(false);
    }
  };

  const executeScript = async (code, type) => {
    // Simulated script execution
    // In a real implementation, this would:
    // 1. Parse the Pine Script-like syntax
    // 2. Execute the logic with actual market data
    // 3. Generate plot data and signals

    return new Promise((resolve) => {
      setTimeout(() => {
        const mockResult = {
          type,
          plots: [
            { name: 'main', data: generateMockData(100), color: '#2196f3' }
          ],
          signals: type === SCRIPT_TYPES.STRATEGY ? [
            { time: Date.now() - 86400000, type: 'buy', price: 100 },
            { time: Date.now() - 43200000, type: 'sell', price: 105 }
          ] : [],
          stats: {
            calculations: Math.floor(Math.random() * 1000),
            executionTime: Math.floor(Math.random() * 100) + 10,
            memoryUsed: Math.floor(Math.random() * 1024) + 512
          },
          errors: [],
          warnings: []
        };
        resolve(mockResult);
      }, 1000);
    });
  };

  const generateMockData = (length) => {
    const data = [];
    let value = 100;
    
    for (let i = 0; i < length; i++) {
      value += (Math.random() - 0.5) * 2;
      data.push({
        time: Date.now() - (length - i) * 60000,
        value: value
      });
    }
    
    return data;
  };

  const extractDescriptionFromCode = (code) => {
    const lines = code.split('\n');
    const indicatorLine = lines.find(line => line.includes('indicator(') || line.includes('strategy('));
    if (indicatorLine) {
      const match = indicatorLine.match(/"([^"]+)"/);
      return match ? match[1] : 'Custom Script';
    }
    return 'Custom Script';
  };

  const insertFunction = (func) => {
    const textarea = codeEditorRef.current;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = scriptCode;
      const before = text.substring(0, start);
      const after = text.substring(end, text.length);
      
      setScriptCode(before + func.syntax + after);
      
      // Set cursor position after inserted text
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + func.syntax.length;
        textarea.focus();
      }, 0);
    }
    
    setShowFunctionsDialog(false);
  };

  const loadSampleScript = (sample) => {
    setScriptName(sample.name);
    setScriptType(sample.type);
    setScriptCode(sample.code);
    setShowSamplesDialog(false);
  };

  const exportScript = () => {
    if (!currentScript) return;

    const exportData = {
      ...currentScript,
      exportedAt: Date.now()
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json'
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${currentScript.name.replace(/\s+/g, '_')}.json`;
    link.click();

    URL.revokeObjectURL(url);
  };

  const importScript = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const scriptData = JSON.parse(e.target.result);
        loadScript({
          ...scriptData,
          id: Date.now().toString() // Generate new ID
        });
      } catch (error) {
        setError('Invalid script file format');
      }
    };
    reader.readAsText(file);
  };

  return (
    <Box>
      <Paper elevation={1}>
        <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)}>
          <Tab label="Script Editor" />
          <Tab label="My Scripts" />
          <Tab label="Documentation" />
        </Tabs>

        {/* Script Editor Tab */}
        {activeTab === 0 && (
          <Box sx={{ p: 2 }}>
            <Grid container spacing={2}>
              {/* Editor Controls */}
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'center' }}>
                  <TextField
                    label="Script Name"
                    value={scriptName}
                    onChange={(e) => setScriptName(e.target.value)}
                    size="small"
                    sx={{ minWidth: 200 }}
                  />
                  
                  <FormControl size="small" sx={{ minWidth: 120 }}>
                    <InputLabel>Type</InputLabel>
                    <Select
                      value={scriptType}
                      onChange={(e) => setScriptType(e.target.value)}
                    >
                      <MenuItem value={SCRIPT_TYPES.INDICATOR}>Indicator</MenuItem>
                      <MenuItem value={SCRIPT_TYPES.STRATEGY}>Strategy</MenuItem>
                      <MenuItem value={SCRIPT_TYPES.STUDY}>Study</MenuItem>
                    </Select>
                  </FormControl>

                  <Button
                    onClick={newScript}
                    size="small"
                    startIcon={<Code />}
                  >
                    New
                  </Button>

                  <Button
                    onClick={saveScript}
                    variant="contained"
                    size="small"
                    startIcon={<Save />}
                  >
                    Save
                  </Button>

                  <Button
                    onClick={runScript}
                    variant="outlined"
                    size="small"
                    startIcon={isRunning ? <CircularProgress size={16} /> : <PlayArrow />}
                    disabled={isRunning}
                  >
                    Run
                  </Button>
                </Box>
              </Grid>

              {/* Code Editor */}
              <Grid item xs={12} md={8}>
                <Box sx={{ position: 'relative' }}>
                  <TextField
                    ref={codeEditorRef}
                    multiline
                    rows={20}
                    fullWidth
                    value={scriptCode}
                    onChange={(e) => setScriptCode(e.target.value)}
                    placeholder="// Write your Pine Script-like code here...
//@version=5
indicator('My Custom Indicator', shorttitle='MCI', overlay=true)

// Your code here..."
                    sx={{
                      fontFamily: 'monospace',
                      '& .MuiInputBase-input': {
                        fontFamily: 'monospace',
                        fontSize: '14px',
                        lineHeight: '1.5'
                      }
                    }}
                  />
                  
                  <Box sx={{ position: 'absolute', top: 8, right: 8 }}>
                    <Tooltip title="Functions Reference">
                      <IconButton
                        size="small"
                        onClick={() => setShowFunctionsDialog(true)}
                      >
                        <Functions />
                      </IconButton>
                    </Tooltip>
                    
                    <Tooltip title="Sample Scripts">
                      <IconButton
                        size="small"
                        onClick={() => setShowSamplesDialog(true)}
                      >
                        <School />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </Box>
              </Grid>

              {/* Results Panel */}
              <Grid item xs={12} md={4}>
                <Box sx={{ height: '100%' }}>
                  <Typography variant="h6" gutterBottom>
                    Execution Results
                  </Typography>

                  {error && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                      {error}
                    </Alert>
                  )}

                  {executionResult && (
                    <Card variant="outlined">
                      <CardContent>
                        <Typography variant="subtitle2" gutterBottom>
                          Execution Stats
                        </Typography>
                        <Typography variant="body2">
                          Calculations: {executionResult.stats.calculations}
                        </Typography>
                        <Typography variant="body2">
                          Execution Time: {executionResult.stats.executionTime}ms
                        </Typography>
                        <Typography variant="body2">
                          Memory Used: {executionResult.stats.memoryUsed}KB
                        </Typography>
                        
                        <Divider sx={{ my: 2 }} />
                        
                        <Typography variant="subtitle2" gutterBottom>
                          Plots Generated
                        </Typography>
                        {executionResult.plots.map((plot, index) => (
                          <Chip
                            key={index}
                            label={plot.name}
                            size="small"
                            sx={{ mr: 1, mb: 1, backgroundColor: plot.color }}
                          />
                        ))}

                        {executionResult.type === SCRIPT_TYPES.STRATEGY && (
                          <>
                            <Divider sx={{ my: 2 }} />
                            <Typography variant="subtitle2" gutterBottom>
                              Signals
                            </Typography>
                            <Typography variant="body2">
                              Buy Signals: {executionResult.signals.filter(s => s.type === 'buy').length}
                            </Typography>
                            <Typography variant="body2">
                              Sell Signals: {executionResult.signals.filter(s => s.type === 'sell').length}
                            </Typography>
                          </>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {currentScript && (
                    <Box sx={{ mt: 2 }}>
                      <Button
                        onClick={exportScript}
                        startIcon={<CloudDownload />}
                        size="small"
                        fullWidth
                      >
                        Export Script
                      </Button>
                    </Box>
                  )}
                </Box>
              </Grid>
            </Grid>
          </Box>
        )}

        {/* My Scripts Tab */}
        {activeTab === 1 && (
          <Box sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">
                My Scripts ({scripts.length})
              </Typography>
              
              <Box>
                <input
                  accept=".json"
                  style={{ display: 'none' }}
                  id="import-script"
                  type="file"
                  onChange={importScript}
                />
                <label htmlFor="import-script">
                  <Button component="span" startIcon={<CloudDownload />} size="small">
                    Import
                  </Button>
                </label>
              </Box>
            </Box>

            <Grid container spacing={2}>
              {scripts.map((script) => (
                <Grid item xs={12} sm={6} md={4} key={script.id}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        {script.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        {script.description}
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                        <Chip
                          label={script.type}
                          size="small"
                          color={script.type === SCRIPT_TYPES.STRATEGY ? 'primary' : 'default'}
                        />
                        <Chip
                          label={script.version}
                          size="small"
                          variant="outlined"
                        />
                      </Box>
                      <Typography variant="caption" display="block">
                        Updated: {new Date(script.updatedAt).toLocaleDateString()}
                      </Typography>
                    </CardContent>
                    <CardActions>
                      <Button
                        size="small"
                        onClick={() => loadScript(script)}
                      >
                        Edit
                      </Button>
                      <IconButton
                        size="small"
                        onClick={() => deleteScript(script.id)}
                      >
                        <Delete />
                      </IconButton>
                    </CardActions>
                  </Card>
                </Grid>
              ))}
            </Grid>

            {scripts.length === 0 && (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  No scripts yet
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Create your first custom indicator or strategy
                </Typography>
                <Button
                  onClick={() => setActiveTab(0)}
                  variant="contained"
                  sx={{ mt: 2 }}
                  startIcon={<Code />}
                >
                  Create Script
                </Button>
              </Box>
            )}
          </Box>
        )}

        {/* Documentation Tab */}
        {activeTab === 2 && (
          <Box sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Pine Script Documentation
            </Typography>
            
            <Typography variant="body1" paragraph>
              This custom script builder supports a Pine Script-like syntax for creating
              technical indicators and trading strategies.
            </Typography>

            <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
              Basic Structure
            </Typography>
            <Paper variant="outlined" sx={{ p: 2, mb: 2, fontFamily: 'monospace', backgroundColor: '#f5f5f5' }}>
              <pre>{`//@version=5
indicator("My Indicator", shorttitle="MI", overlay=true)

// Inputs
length = input.int(14, title="Length", minval=1)
source = input(close, title="Source")

// Calculations
result = sma(source, length)

// Plot
plot(result, title="SMA", color=color.blue)`}</pre>
            </Paper>

            <Typography variant="h6" gutterBottom>
              Available Functions
            </Typography>
            <Button
              onClick={() => setShowFunctionsDialog(true)}
              variant="outlined"
              startIcon={<Functions />}
            >
              View Functions Reference
            </Button>
          </Box>
        )}
      </Paper>

      {/* Functions Reference Dialog */}
      <Dialog
        open={showFunctionsDialog}
        onClose={() => setShowFunctionsDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Functions Reference</DialogTitle>
        <DialogContent>
          <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
            <Tabs value={selectedCategory} onChange={(e, newValue) => setSelectedCategory(newValue)}>
              {Object.keys(BUILT_IN_FUNCTIONS).map((category) => (
                <Tab key={category} value={category} label={category} />
              ))}
            </Tabs>
          </Box>

          <List>
            {BUILT_IN_FUNCTIONS[selectedCategory]?.map((func, index) => (
              <ListItem key={index} divider>
                <ListItemText
                  primary={func.name}
                  secondary={
                    <>
                      <Typography variant="body2">{func.description}</Typography>
                      <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                        {func.syntax}
                      </Typography>
                    </>
                  }
                />
                <ListItemSecondaryAction>
                  <IconButton onClick={() => insertFunction(func)}>
                    <ContentCopy />
                  </IconButton>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowFunctionsDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Sample Scripts Dialog */}
      <Dialog
        open={showSamplesDialog}
        onClose={() => setShowSamplesDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Sample Scripts</DialogTitle>
        <DialogContent>
          <Grid container spacing={2}>
            {Object.entries(SAMPLE_SCRIPTS).map(([key, sample]) => (
              <Grid item xs={12} sm={6} key={key}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      {sample.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      {sample.description}
                    </Typography>
                    <Chip
                      label={sample.type}
                      size="small"
                      color={sample.type === SCRIPT_TYPES.STRATEGY ? 'primary' : 'default'}
                    />
                  </CardContent>
                  <CardActions>
                    <Button
                      size="small"
                      onClick={() => loadSampleScript(sample)}
                    >
                      Load Sample
                    </Button>
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowSamplesDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CustomScriptBuilder;