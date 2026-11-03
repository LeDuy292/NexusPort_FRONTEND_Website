import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';

export function useShippingLineRealtime() {
  const queryClient = useQueryClient();
  const socketRef = useRef<any>(null);

  useEffect(() => {
    // Optional WebSocket / Polling or event listener for shipping updates
    const handleRefresh = () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['delivery-orders'] });
      queryClient.invalidateQueries({ queryKey: ['containers'] });
      queryClient.invalidateQueries({ queryKey: ['port-messages'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
    };

    window.addEventListener('shipping-line-refresh', handleRefresh);

    return () => {
      window.removeEventListener('shipping-line-refresh', handleRefresh);
    };
  }, [queryClient]);

  return socketRef.current;
}
