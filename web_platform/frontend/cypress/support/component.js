// Component testing setup
import './commands';
import { mount } from 'cypress/react18';

Cypress.Commands.add('mount', mount);

// Component-specific test helpers
Cypress.Commands.add('mountChart', (props = {}) => {
  const defaultProps = {
    symbol: 'AAPL',
    timeframe: '1D',
    data: [],
    ...props
  };
  
  cy.mount(<AdvancedCharts {...defaultProps} />);
});

// Mock data providers
Cypress.Commands.add('mockChartData', (symbol = 'AAPL', timeframe = '1D') => {
  const mockData = [];
  const now = Date.now();
  const timeStep = timeframe === '1D' ? 24 * 60 * 60 * 1000 : 60 * 1000;
  
  for (let i = 0; i < 100; i++) {
    const time = now - (i * timeStep);
    const price = 100 + Math.random() * 20;
    
    mockData.unshift({
      time: Math.floor(time / 1000),
      open: price,
      high: price + Math.random() * 2,
      low: price - Math.random() * 2,
      close: price + (Math.random() - 0.5) * 1,
      volume: Math.floor(Math.random() * 1000000)
    });
  }
  
  return mockData;
});