import React from 'react';
import { Outlet } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from './hooks/useToast';
import { ToastContainer } from './components/common/Toast';
import { useShippingLineRealtime } from './hooks/useShippingLineRealtime';
import './shipping-line.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 30000,
    },
  },
});

const RealtimeBridge: React.FC = () => {
  useShippingLineRealtime();
  return null;
};

export const ShippingLineWrapper: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <RealtimeBridge />
        <div className="p-6 max-w-7xl mx-auto min-h-full font-sans">
          <Outlet />
        </div>
        <ToastContainer />
      </ToastProvider>
    </QueryClientProvider>
  );
};

export default ShippingLineWrapper;
