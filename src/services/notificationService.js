import apiClient from './apiClient'

export const notificationService = {
  // Get notifications for current user with optional filters
  getNotifications: async (params = {}) => {
    const query = new URLSearchParams()
    if (params.unreadOnly) query.append('unreadOnly', 'true')
    if (params.pageNumber) query.append('pageNumber', params.pageNumber)
    if (params.pageSize) query.append('pageSize', params.pageSize || 20)

    return await apiClient.get(`/v1/Notification?${query.toString()}`)
  },

  // Get unread count
  getUnreadCount: async () => {
    return await apiClient.get('/v1/Notification/unread-count')
  },

  // Mark a single notification as read
  markAsRead: async (id) => {
    return await apiClient.post(`/v1/Notification/${id}/read`)
  },

  // Mark all notifications as read
  markAllAsRead: async () => {
    return await apiClient.post('/v1/Notification/read-all')
  },

  // Trigger test event notification (for demo testing)
  triggerTestEvent: async (eventType, message) => {
    const query = new URLSearchParams({ eventType })
    if (message) query.append('message', message)
    return await apiClient.post(`/v1/Notification/test-event?${query.toString()}`)
  }
}

export default notificationService
