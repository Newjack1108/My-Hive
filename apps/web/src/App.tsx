import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import HiveDetail from './pages/HiveDetail';
import HivePublic from './pages/HivePublic';
import NewInspection from './pages/NewInspection';
import AdminPanel from './pages/AdminPanel';
import ApiariesList from './pages/ApiariesList';
import MapView from './pages/MapView';
import QueenRecords from './pages/QueenRecords';
import BreedingPlans from './pages/BreedingPlans';
import Shop from './pages/Shop';
import ProductDetail from './pages/ProductDetail';
import Cart from './pages/Cart';
import Checkout from './pages/Checkout';
import Orders from './pages/Orders';
import HoneyProduction from './pages/HoneyProduction';
import PestKnowledgeBase from './pages/PestKnowledgeBase';
import MaintenanceScheduling from './pages/MaintenanceScheduling';
import HiveSplits from './pages/HiveSplits';
import Calendar from './pages/Calendar';
import SeasonalEvents from './pages/SeasonalEvents';
import Layout from './components/Layout';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  const { user, loading } = useAuth();

  return (
    <Routes>
      <Route
        path="/login"
        element={
          loading ? (
            <div style={{ padding: '2rem', textAlign: 'center', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading...</div>
          ) : user ? (
            <Navigate to="/" replace />
          ) : (
            <Login />
          )
        }
      />
      <Route path="/h/:publicId" element={<HivePublic />} />
      
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="apiaries" element={<ApiariesList />} />
        <Route path="map" element={<MapView />} />
        <Route path="hives/:id" element={<HiveDetail />} />
        <Route path="inspections/new/:hiveId" element={<NewInspection />} />
        <Route path="queens" element={<QueenRecords />} />
        <Route path="breeding-plans" element={<BreedingPlans />} />
        <Route path="shop" element={<Shop />} />
        <Route path="shop/products/:id" element={<ProductDetail />} />
        <Route path="shop/cart" element={<Cart />} />
        <Route path="shop/checkout" element={<Checkout />} />
        <Route path="shop/orders" element={<Orders />} />
        <Route path="honey" element={<HoneyProduction />} />
        <Route path="pests" element={<PestKnowledgeBase />} />
        <Route path="maintenance" element={<MaintenanceScheduling />} />
        <Route path="splits" element={<HiveSplits />} />
        <Route path="calendar" element={<Calendar />} />
        <Route path="seasonal-events" element={<SeasonalEvents />} />
        <Route path="admin" element={<ProtectedRoute><AdminPanel /></ProtectedRoute>} />
      </Route>
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
