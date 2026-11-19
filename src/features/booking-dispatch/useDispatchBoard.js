import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import useAuth from '../../hooks/useAuth'
import { driverSmartRouteService } from '../../services/driverSmartRouteService'
import { connectDispatchBoard, connectYardMonitor, getDispatchBoard, getDispatchBooking } from './dispatchService'

const queryOptions = {
  refetchInterval: 15000,
  refetchOnWindowFocus: true,
  staleTime: 10000,
  retry: false,
}

export function useDispatchBoard(date, filter, page, selection) {
  const { user } = useAuth()
  const session = user?.id || user?.username
  const queryClient = useQueryClient()
  const [connected, setConnected] = useState(false)
  const rootKey = ['dispatch-board', session]
  const board = useQuery({
    ...queryOptions, queryKey: [...rootKey, 'list', date, filter, page],
    queryFn: ({ signal }) => getDispatchBoard(date, filter, page, signal),
    placeholderData: (previousData, previousQuery) => {
      const [, previousSession, , previousDate, previousFilter] = previousQuery?.queryKey || []
      if (previousSession === session && previousDate === date && previousFilter === filter) return previousData
    },
  })
  const booking = useQuery({
    ...queryOptions, queryKey: [...rootKey, 'booking', date, selection],
    enabled: Boolean(selection),
    queryFn: ({ signal }) => getDispatchBooking(date, selection, signal),
  })
  const selected = booking.error?.response?.status === 404 ? null : booking.data
  const inYard = selected?.group === 'inside' || selected?.group === 'exited'
  const bookingId = selected?.id
  const routes = useQuery({
    ...queryOptions, queryKey: [...rootKey, 'routes', bookingId],
    enabled: Boolean(bookingId && inYard),
    queryFn: ({ signal }) => driverSmartRouteService.monitor(bookingId, signal),
  })

  useEffect(() => {
    let timer = null
    let dispatchConnected = false, yardConnected = false
    const onChange = () => {
      if (timer !== null) return
      timer = setTimeout(() => {
        timer = null
        void queryClient.invalidateQueries({ queryKey: ['dispatch-board', session] }, { cancelRefetch: false })
      }, 250)
    }
    const cleanup = connectDispatchBoard({
      onChange,
      onConnected: () => {
        setConnected(true)
        if (dispatchConnected) onChange()
        dispatchConnected = true
      },
      onDisconnected: () => setConnected(false),
    })
    const cleanupYard = connectYardMonitor(onChange, () => {
      if (yardConnected) onChange()
      yardConnected = true
    })
    return () => { clearTimeout(timer); cleanup(); cleanupYard() }
  }, [queryClient, session])

  return {
    data: board.data, loading: board.isPending || board.isPlaceholderData, error: board.error?.message, connected,
    selected, detailsLoading: booking.isLoading, detailError: booking.error?.message,
    routes: inYard ? routes.data?.routes || [] : [],
    routesLoading: inYard && routes.isLoading, routeError: inYard ? routes.error?.message : null,
    cacheBooking: item => {
      const key = [...rootKey, 'booking', date, { bookingId: item.id }]
      if ((queryClient.getQueryState(key)?.dataUpdatedAt || 0) <= board.dataUpdatedAt) {
        queryClient.setQueryData(key, item, { updatedAt: board.dataUpdatedAt })
      }
    },
    reload: () => queryClient.invalidateQueries({ queryKey: rootKey }, { cancelRefetch: false }),
  }
}
