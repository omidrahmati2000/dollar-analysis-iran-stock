import React, { useState, useEffect, useCallback } from 'react';
import { Responsive, WidthProvider } from 'react-grid-layout';
import {
  Box,
  Paper,
  IconButton,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  TextField,
  Button,
  Typography,
  Card,
  CardContent,
  Tooltip,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemButton,
  ListItemIcon,
  Switch,
  FormControlLabel,
  Select,
  FormControl,
  InputLabel
} from '@mui/material';
import {
  GridOn,
  Settings,
  Add,
  Save,
  Restore,
  Delete,
  Fullscreen,
  FullscreenExit,
  DashboardCustomize,
  Palette,
  ViewModule,
  Timeline,
  BarChart,
  ShowChart
} from '@mui/icons-material';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

const ResponsiveGridLayout = WidthProvider(Responsive);

const CHART_COMPONENTS = {
  PRICE_CHART: 'price_chart',
  VOLUME_ANALYSIS: 'volume_analysis', 
  WATCHLIST: 'watchlist',
  INDICATORS: 'indicators',
  NEWS: 'news',
  MARKET_OVERVIEW: 'market_overview',
  PORTFOLIO: 'portfolio',
  ALERTS: 'alerts'
};

const DEFAULT_LAYOUTS = {
  single_chart: {
    name: 'Single Chart',
    layouts: {
      lg: [{ i: 'chart1', x: 0, y: 0, w: 12, h: 8, minW: 6, minH: 4 }]
    },
    components: [
      { id: 'chart1', type: CHART_COMPONENTS.PRICE_CHART, title: 'Main Chart' }
    ]
  },
  dual_chart: {
    name: 'Dual Chart',
    layouts: {
      lg: [
        { i: 'chart1', x: 0, y: 0, w: 6, h: 8, minW: 4, minH: 4 },
        { i: 'chart2', x: 6, y: 0, w: 6, h: 8, minW: 4, minH: 4 }
      ]
    },
    components: [
      { id: 'chart1', type: CHART_COMPONENTS.PRICE_CHART, title: 'Chart 1' },
      { id: 'chart2', type: CHART_COMPONENTS.PRICE_CHART, title: 'Chart 2' }
    ]
  },
  quad_chart: {
    name: 'Quad Chart',
    layouts: {
      lg: [
        { i: 'chart1', x: 0, y: 0, w: 6, h: 4, minW: 3, minH: 3 },
        { i: 'chart2', x: 6, y: 0, w: 6, h: 4, minW: 3, minH: 3 },
        { i: 'chart3', x: 0, y: 4, w: 6, h: 4, minW: 3, minH: 3 },
        { i: 'chart4', x: 6, y: 4, w: 6, h: 4, minW: 3, minH: 3 }
      ]
    },
    components: [
      { id: 'chart1', type: CHART_COMPONENTS.PRICE_CHART, title: 'Chart 1' },
      { id: 'chart2', type: CHART_COMPONENTS.PRICE_CHART, title: 'Chart 2' },
      { id: 'chart3', type: CHART_COMPONENTS.PRICE_CHART, title: 'Chart 3' },
      { id: 'chart4', type: CHART_COMPONENTS.PRICE_CHART, title: 'Chart 4' }
    ]
  },
  trading_layout: {
    name: 'Trading Layout',
    layouts: {
      lg: [
        { i: 'main_chart', x: 0, y: 0, w: 8, h: 6, minW: 6, minH: 4 },
        { i: 'volume_analysis', x: 8, y: 0, w: 4, h: 6, minW: 3, minH: 4 },
        { i: 'watchlist', x: 0, y: 6, w: 4, h: 3, minW: 3, minH: 2 },
        { i: 'indicators', x: 4, y: 6, w: 4, h: 3, minW: 3, minH: 2 },
        { i: 'market_overview', x: 8, y: 6, w: 4, h: 3, minW: 3, minH: 2 }
      ]
    },
    components: [
      { id: 'main_chart', type: CHART_COMPONENTS.PRICE_CHART, title: 'Main Chart' },
      { id: 'volume_analysis', type: CHART_COMPONENTS.VOLUME_ANALYSIS, title: 'Volume Analysis' },
      { id: 'watchlist', type: CHART_COMPONENTS.WATCHLIST, title: 'Watchlist' },
      { id: 'indicators', type: CHART_COMPONENTS.INDICATORS, title: 'Indicators' },
      { id: 'market_overview', type: CHART_COMPONENTS.MARKET_OVERVIEW, title: 'Market Overview' }
    ]
  }
};

const THEMES = {
  dark: {
    name: 'Dark Theme',
    colors: {
      background: '#0D1117',
      surface: '#161B22',
      primary: '#2196f3',
      text: '#F0F6FC',
      border: '#30363D'
    }
  },
  light: {
    name: 'Light Theme', 
    colors: {
      background: '#ffffff',
      surface: '#f5f5f5',
      primary: '#1976d2',
      text: '#000000',
      border: '#e0e0e0'
    }
  },
  professional: {
    name: 'Professional',
    colors: {
      background: '#1a1a1a',
      surface: '#2d2d2d',
      primary: '#00bcd4',
      text: '#ffffff',
      border: '#404040'
    }
  }
};

const WorkspaceManager = ({
  children,
  onLayoutChange,
  onThemeChange,
  savedLayouts = {},
  currentTheme = 'dark'
}) => {
  const [currentLayout, setCurrentLayout] = useState('single_chart');
  const [layouts, setLayouts] = useState(DEFAULT_LAYOUTS.single_chart.layouts);
  const [components, setComponents] = useState(DEFAULT_LAYOUTS.single_chart.components);
  const [isEditing, setIsEditing] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showLoadDialog, setShowLoadDialog] = useState(false);
  const [layoutName, setLayoutName] = useState('');
  const [theme, setTheme] = useState(currentTheme);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [syncCharts, setSyncCharts] = useState(true);
  const [gridSnap, setGridSnap] = useState(true);

  // Menu states
  const [layoutMenuAnchor, setLayoutMenuAnchor] = useState(null);
  const [themeMenuAnchor, setThemeMenuAnchor] = useState(null);
  const [settingsMenuAnchor, setSettingsMenuAnchor] = useState(null);

  // Load saved layouts on mount
  useEffect(() => {
    const savedLayoutData = localStorage.getItem('workspace_layouts');
    if (savedLayoutData) {
      try {
        const parsed = JSON.parse(savedLayoutData);
        // Handle saved layouts loading
      } catch (error) {
        console.error('Error loading saved layouts:', error);
      }
    }
  }, []);

  // Handle layout changes
  const handleLayoutChange = useCallback((newLayouts) => {
    setLayouts({ ...layouts, ...newLayouts });
    onLayoutChange && onLayoutChange(newLayouts);
  }, [layouts, onLayoutChange]);

  // Switch to predefined layout
  const switchToLayout = (layoutKey) => {
    const layout = DEFAULT_LAYOUTS[layoutKey];
    if (layout) {
      setCurrentLayout(layoutKey);
      setLayouts(layout.layouts);
      setComponents(layout.components);
    }
    setLayoutMenuAnchor(null);
  };

  // Add new component to layout
  const addComponent = (componentType) => {
    const newId = `component_${Date.now()}`;
    const newComponent = {
      id: newId,
      type: componentType,
      title: getComponentTitle(componentType)
    };

    // Find empty space for new component
    const newLayoutItem = {
      i: newId,
      x: 0,
      y: 0,
      w: 4,
      h: 4,
      minW: 2,
      minH: 2
    };

    setComponents([...components, newComponent]);
    setLayouts({
      ...layouts,
      lg: [...(layouts.lg || []), newLayoutItem]
    });
  };

  // Remove component
  const removeComponent = (componentId) => {
    setComponents(components.filter(c => c.id !== componentId));
    setLayouts({
      ...layouts,
      lg: layouts.lg?.filter(item => item.i !== componentId) || []
    });
  };

  // Save current layout
  const saveLayout = () => {
    if (!layoutName.trim()) return;

    const layoutData = {
      name: layoutName,
      layouts: layouts,
      components: components,
      theme: theme,
      timestamp: Date.now()
    };

    const savedLayoutsData = localStorage.getItem('workspace_layouts');
    const savedLayouts = savedLayoutsData ? JSON.parse(savedLayoutsData) : {};
    savedLayouts[layoutName] = layoutData;

    localStorage.setItem('workspace_layouts', JSON.stringify(savedLayouts));
    setShowSaveDialog(false);
    setLayoutName('');
  };

  // Load saved layout
  const loadLayout = (layoutKey) => {
    const savedLayoutsData = localStorage.getItem('workspace_layouts');
    if (savedLayoutsData) {
      const savedLayouts = JSON.parse(savedLayoutsData);
      const layout = savedLayouts[layoutKey];
      if (layout) {
        setLayouts(layout.layouts);
        setComponents(layout.components);
        setTheme(layout.theme);
        onThemeChange && onThemeChange(layout.theme);
      }
    }
    setShowLoadDialog(false);
  };

  // Delete saved layout
  const deleteLayout = (layoutKey) => {
    const savedLayoutsData = localStorage.getItem('workspace_layouts');
    if (savedLayoutsData) {
      const savedLayouts = JSON.parse(savedLayoutsData);
      delete savedLayouts[layoutKey];
      localStorage.setItem('workspace_layouts', JSON.stringify(savedLayouts));
    }
  };

  // Change theme
  const changeTheme = (themeKey) => {
    setTheme(themeKey);
    onThemeChange && onThemeChange(themeKey);
    setThemeMenuAnchor(null);
  };

  const getComponentTitle = (type) => {
    switch (type) {
      case CHART_COMPONENTS.PRICE_CHART: return 'Price Chart';
      case CHART_COMPONENTS.VOLUME_ANALYSIS: return 'Volume Analysis';
      case CHART_COMPONENTS.WATCHLIST: return 'Watchlist';
      case CHART_COMPONENTS.INDICATORS: return 'Indicators';
      case CHART_COMPONENTS.NEWS: return 'News';
      case CHART_COMPONENTS.MARKET_OVERVIEW: return 'Market Overview';
      case CHART_COMPONENTS.PORTFOLIO: return 'Portfolio';
      case CHART_COMPONENTS.ALERTS: return 'Alerts';
      default: return 'Component';
    }
  };

  const getComponentIcon = (type) => {
    switch (type) {
      case CHART_COMPONENTS.PRICE_CHART: return <ShowChart />;
      case CHART_COMPONENTS.VOLUME_ANALYSIS: return <BarChart />;
      case CHART_COMPONENTS.WATCHLIST: return <Timeline />;
      case CHART_COMPONENTS.INDICATORS: return <Timeline />;
      default: return <ViewModule />;
    }
  };

  const getSavedLayouts = () => {
    const savedLayoutsData = localStorage.getItem('workspace_layouts');
    return savedLayoutsData ? JSON.parse(savedLayoutsData) : {};
  };

  const renderComponent = (component) => {
    // This function would render the actual component based on type
    // For now, returning a placeholder
    return (
      <Paper 
        sx={{ 
          height: '100%', 
          p: 1,
          backgroundColor: THEMES[theme].colors.surface,
          color: THEMES[theme].colors.text,
          border: `1px solid ${THEMES[theme].colors.border}`
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {getComponentIcon(component.type)}
            {component.title}
          </Typography>
          {isEditing && (
            <IconButton 
              size="small" 
              onClick={() => removeComponent(component.id)}
              sx={{ color: 'error.main' }}
            >
              <Delete fontSize="small" />
            </IconButton>
          )}
        </Box>
        <Box sx={{ height: 'calc(100% - 40px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Typography color="text.secondary">
            {component.title} Content
          </Typography>
        </Box>
      </Paper>
    );
  };

  return (
    <Box sx={{ 
      height: '100vh', 
      backgroundColor: THEMES[theme].colors.background,
      color: THEMES[theme].colors.text 
    }}>
      {/* Workspace Toolbar */}
      <Paper 
        sx={{ 
          p: 1, 
          mb: 1, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          backgroundColor: THEMES[theme].colors.surface,
          borderBottom: `1px solid ${THEMES[theme].colors.border}`
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {/* Layout Selector */}
          <Tooltip title="Layout">
            <IconButton onClick={(e) => setLayoutMenuAnchor(e.currentTarget)}>
              <GridOn />
            </IconButton>
          </Tooltip>

          {/* Theme Selector */}
          <Tooltip title="Theme">
            <IconButton onClick={(e) => setThemeMenuAnchor(e.currentTarget)}>
              <Palette />
            </IconButton>
          </Tooltip>

          {/* Save Layout */}
          <Tooltip title="Save Layout">
            <IconButton onClick={() => setShowSaveDialog(true)}>
              <Save />
            </IconButton>
          </Tooltip>

          {/* Load Layout */}
          <Tooltip title="Load Layout">
            <IconButton onClick={() => setShowLoadDialog(true)}>
              <Restore />
            </IconButton>
          </Tooltip>

          <Divider orientation="vertical" flexItem />

          {/* Edit Mode Toggle */}
          <FormControlLabel
            control={
              <Switch
                checked={isEditing}
                onChange={(e) => setIsEditing(e.target.checked)}
                size="small"
              />
            }
            label="Edit"
          />

          {/* Sync Charts */}
          <FormControlLabel
            control={
              <Switch
                checked={syncCharts}
                onChange={(e) => setSyncCharts(e.target.checked)}
                size="small"
              />
            }
            label="Sync"
          />
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {/* Fullscreen Toggle */}
          <Tooltip title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}>
            <IconButton onClick={() => setIsFullscreen(!isFullscreen)}>
              {isFullscreen ? <FullscreenExit /> : <Fullscreen />}
            </IconButton>
          </Tooltip>

          {/* Settings */}
          <Tooltip title="Settings">
            <IconButton onClick={(e) => setSettingsMenuAnchor(e.currentTarget)}>
              <Settings />
            </IconButton>
          </Tooltip>
        </Box>
      </Paper>

      {/* Grid Layout */}
      <Box sx={{ height: 'calc(100vh - 80px)', p: 1 }}>
        <ResponsiveGridLayout
          layouts={layouts}
          onLayoutChange={(layout, layouts) => handleLayoutChange(layouts)}
          breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
          cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
          isResizable={isEditing}
          isDraggable={isEditing}
          useCSSTransforms={true}
          compactType="vertical"
          preventCollision={false}
          margin={[8, 8]}
          containerPadding={[0, 0]}
        >
          {components.map(component => (
            <div key={component.id}>
              {renderComponent(component)}
            </div>
          ))}
        </ResponsiveGridLayout>
      </Box>

      {/* Layout Menu */}
      <Menu
        anchorEl={layoutMenuAnchor}
        open={Boolean(layoutMenuAnchor)}
        onClose={() => setLayoutMenuAnchor(null)}
      >
        {Object.entries(DEFAULT_LAYOUTS).map(([key, layout]) => (
          <MenuItem key={key} onClick={() => switchToLayout(key)}>
            <ListItemIcon>
              <GridOn fontSize="small" />
            </ListItemIcon>
            <ListItemText primary={layout.name} />
          </MenuItem>
        ))}
        <Divider />
        <MenuItem onClick={() => addComponent(CHART_COMPONENTS.PRICE_CHART)}>
          <ListItemIcon>
            <Add fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Add Chart" />
        </MenuItem>
        <MenuItem onClick={() => addComponent(CHART_COMPONENTS.VOLUME_ANALYSIS)}>
          <ListItemIcon>
            <Add fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Add Volume Analysis" />
        </MenuItem>
        <MenuItem onClick={() => addComponent(CHART_COMPONENTS.WATCHLIST)}>
          <ListItemIcon>
            <Add fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Add Watchlist" />
        </MenuItem>
      </Menu>

      {/* Theme Menu */}
      <Menu
        anchorEl={themeMenuAnchor}
        open={Boolean(themeMenuAnchor)}
        onClose={() => setThemeMenuAnchor(null)}
      >
        {Object.entries(THEMES).map(([key, themeData]) => (
          <MenuItem key={key} onClick={() => changeTheme(key)}>
            <ListItemIcon>
              <Box 
                sx={{ 
                  width: 20, 
                  height: 20, 
                  borderRadius: '50%', 
                  backgroundColor: themeData.colors.primary 
                }} 
              />
            </ListItemIcon>
            <ListItemText primary={themeData.name} />
          </MenuItem>
        ))}
      </Menu>

      {/* Settings Menu */}
      <Menu
        anchorEl={settingsMenuAnchor}
        open={Boolean(settingsMenuAnchor)}
        onClose={() => setSettingsMenuAnchor(null)}
      >
        <MenuItem>
          <FormControlLabel
            control={
              <Switch
                checked={gridSnap}
                onChange={(e) => setGridSnap(e.target.checked)}
              />
            }
            label="Grid Snap"
          />
        </MenuItem>
      </Menu>

      {/* Save Layout Dialog */}
      <Dialog open={showSaveDialog} onClose={() => setShowSaveDialog(false)}>
        <DialogTitle>Save Layout</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Layout Name"
            fullWidth
            variant="outlined"
            value={layoutName}
            onChange={(e) => setLayoutName(e.target.value)}
            sx={{ mb: 2 }}
          />
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
            <Button onClick={() => setShowSaveDialog(false)}>
              Cancel
            </Button>
            <Button onClick={saveLayout} variant="contained">
              Save
            </Button>
          </Box>
        </DialogContent>
      </Dialog>

      {/* Load Layout Dialog */}
      <Dialog open={showLoadDialog} onClose={() => setShowLoadDialog(false)}>
        <DialogTitle>Load Layout</DialogTitle>
        <DialogContent sx={{ minWidth: 400 }}>
          <List>
            {Object.entries(getSavedLayouts()).map(([key, layout]) => (
              <ListItem key={key} disablePadding>
                <ListItemButton onClick={() => loadLayout(key)}>
                  <ListItemText 
                    primary={layout.name}
                    secondary={new Date(layout.timestamp).toLocaleString()}
                  />
                  <IconButton 
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteLayout(key);
                    }}
                    color="error"
                  >
                    <Delete />
                  </IconButton>
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </DialogContent>
      </Dialog>
    </Box>
  );
};

export default WorkspaceManager;