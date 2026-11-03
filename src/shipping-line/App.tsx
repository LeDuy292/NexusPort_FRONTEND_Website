import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { ToastProvider } from './hooks/useToast';
import { AppLayout } from './components/layout/AppLayout';

import { LoginPage } from './pages/auth/LoginPage';
import { OverviewPage } from './pages/overview/OverviewPage';
import { BookingListPage } from './pages/export-booking/BookingListPage';
import { BookingDetailPage } from './pages/export-booking/BookingDetailPage';
import { VoyageListPage } from './pages/import-cargo/VoyageListPage';
import { ManifestPage } from './pages/import-cargo/ManifestPage';
import { BLDetailPage } from './pages/import-cargo/BLDetailPage';
import { DeliveryOrderPage } from './pages/delivery-order/DeliveryOrderPage';
import { ContainerSearchPage } from './pages/container/ContainerSearchPage';
import { PortSyncPage } from './pages/port-sync/PortSyncPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 30000,
    },
  },
});

const ProtectedRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

const PublicOnlyRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  if (isAuthenticated) {
    return <Navigate to="/overview" replace />;
  }
  return children;
};

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ToastProvider>
          <BrowserRouter>
            <Routes>
              {/* Public route */}
              <Route
                path="/login"
                element={
                  <PublicOnlyRoute>
                    <LoginPage />
                  </PublicOnlyRoute>
                }
              />

              {/* Protected routes */}
              <Route
                element={
                  <ProtectedRoute>
                    <AppLayout />
                  </ProtectedRoute>
                }
              >
                <Route path="/" element={<Navigate to="/overview" replace />} />
                <Route path="/overview" element={<OverviewPage />} />
                <Route path="/export-bookings" element={<BookingListPage />} />
                <Route path="/export-bookings/:id" element={<BookingDetailPage />} />
                <Route path="/import-cargo" element={<VoyageListPage />} />
                <Route path="/import-cargo/manifest/:voyageNumber" element={<ManifestPage />} />
                <Route path="/import-cargo/bl/:blNumber" element={<BLDetailPage />} />
                <Route path="/delivery-orders" element={<DeliveryOrderPage />} />
                <Route path="/containers" element={<ContainerSearchPage />} />
                <Route path="/port-sync" element={<PortSyncPage />} />
              </Route>

              {/* Catch-all */}
              <Route path="*" element={<Navigate to="/overview" replace />} />
            </Routes>
          </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;

