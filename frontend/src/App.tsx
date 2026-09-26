import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { CommandCenter } from './pages/CommandCenter';
import { StationRisk } from './pages/StationRisk';
import { NetworkAnalytics } from './pages/NetworkAnalytics';
import { BatteryIntelligence } from './pages/BatteryIntelligence';
import { PricingEconomics } from './pages/PricingEconomics';
import { RiderRetention } from './pages/RiderRetention';
import { RootCauseExplorer } from './pages/RootCauseExplorer';
import { DecisionSimulator } from './pages/DecisionSimulator';
import { PlaceholderPage } from './pages/PlaceholderPage';

const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      {
        index: true,
        element: <CommandCenter />
      },
      {
        path: 'station-risk',
        element: <StationRisk />
      },
      {
        path: 'network',
        element: <NetworkAnalytics />
      },
      {
        path: 'battery',
        element: <BatteryIntelligence />
      },
      {
        path: 'pricing',
        element: <PricingEconomics />
      },
      {
        path: 'retention',
        element: <RiderRetention />
      },
      {
        path: 'root-cause',
        element: <RootCauseExplorer />
      },
      {
        path: 'decision-simulator',
        element: <DecisionSimulator />
      },
      {
        path: 'ai-business-analyst',
        element: <PlaceholderPage title="AI Business Analyst" />
      },
      {
        path: 'settings',
        element: <PlaceholderPage title="Settings" />
      }
    ]
  }
]);

export function App() {
  return <RouterProvider router={router} />;
}

export default App;
