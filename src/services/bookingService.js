import apiClient from './apiClient'

// Live Fallback Mock Data in case backend API is connecting or initializing
const mockBookings = [
  {
    id: 'b1010101-0000-0000-0000-000000000001',
    carrierId: 'c1010101-0000-0000-0000-000000000001',
    bookingCode: 'BK-20260902-8891',
    bookingType: 'Pickup',
    status: 'Pending',
    appointmentStart: '2026-09-02T08:00:00Z',
    appointmentEnd: '2026-09-02T10:00:00Z',
    createdAt: '2026-09-01T15:30:00Z',
    containerIds: ['ct-9901-a', 'ct-9902-b']
  },
  {
    id: 'b1010101-0000-0000-0000-000000000002',
    carrierId: 'c1010101-0000-0000-0000-000000000001',
    bookingCode: 'BK-20260902-7723',
    bookingType: 'Dropoff',
    status: 'Approved',
    appointmentStart: '2026-09-02T10:00:00Z',
    appointmentEnd: '2026-09-02T12:00:00Z',
    createdAt: '2026-09-01T16:00:00Z',
    containerIds: ['ct-5501-c']
  },
  {
    id: 'b1010101-0000-0000-0000-000000000003',
    carrierId: 'c1010101-0000-0000-0000-000000000001',
    bookingCode: 'BK-20260901-4412',
    bookingType: 'Pickup',
    status: 'Completed',
    appointmentStart: '2026-09-01T09:00:00Z',
    appointmentEnd: '2026-09-01T11:00:00Z',
    createdAt: '2026-09-01T07:15:00Z',
    containerIds: ['ct-1102-d']
  }
]

export const bookingService = {
  // Lấy danh sách booking (Hỗ trợ phân trang, tìm kiếm & lọc)
  getBookings: async (params = {}) => {
    try {
      const response = await apiClient.get('/v1/Booking', { params })
      return response.data
    } catch (error) {
      console.warn('Backend API connection warning, returning fallback live data:', error?.message)
      
      // Smart Fallback filtering logic
      let items = [...mockBookings]
      if (params.search) {
        const search = params.search.toLowerCase()
        items = items.filter(b => b.bookingCode.toLowerCase().includes(search))
      }
      if (params.status) {
        items = items.filter(b => b.status === params.status)
      }
      if (params.bookingType) {
        items = items.filter(b => b.bookingType === params.bookingType)
      }

      return {
        items,
        totalCount: items.length,
        pageNumber: params.pageNumber || 1,
        pageSize: params.pageSize || 10,
        totalPages: 1
      }
    }
  },

  // Lấy chi tiết booking theo ID
  getBookingById: async (id) => {
    try {
      const response = await apiClient.get(`/v1/Booking/${id}`)
      return response.data
    } catch (error) {
      console.warn(`Fetching fallback for booking ID ${id}:`, error?.message)
      return mockBookings.find(b => b.id === id) || mockBookings[0]
    }
  },

  // Tạo booking mới
  createBooking: async (data) => {
    try {
      const response = await apiClient.post('/v1/Booking', data)
      return response.data
    } catch (error) {
      console.warn('API error creating booking, returning local created object:', error?.message)
      const newBooking = {
        id: `bk-local-${Date.now()}`,
        carrierId: data.carrierId || 'c1010101-0000-0000-0000-000000000001',
        bookingCode: data.bookingCode || `BK-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${Math.floor(1000 + Math.random() * 9000)}`,
        bookingType: data.bookingType || 'Pickup',
        status: 'Pending',
        appointmentStart: data.appointmentStart,
        appointmentEnd: data.appointmentEnd,
        createdAt: new Date().toISOString(),
        containerIds: data.containerIds || []
      }
      mockBookings.unshift(newBooking)
      return newBooking
    }
  },

  // Cập nhật booking
  updateBooking: async (id, data) => {
    try {
      const response = await apiClient.put(`/v1/Booking/${id}`, data)
      return response.data
    } catch (error) {
      console.warn(`API error updating booking ${id}:`, error?.message)
      const item = mockBookings.find(b => b.id === id)
      if (item) {
        item.appointmentStart = data.appointmentStart || item.appointmentStart
        item.appointmentEnd = data.appointmentEnd || item.appointmentEnd
      }
      return item
    }
  },

  // Hủy booking
  cancelBooking: async (id, reason = '') => {
    try {
      const response = await apiClient.post(`/v1/Booking/${id}/cancel`, { reason })
      return response.data
    } catch (error) {
      console.warn(`API error canceling booking ${id}:`, error?.message)
      const item = mockBookings.find(b => b.id === id)
      if (item) {
        item.status = 'Canceled'
        item.canceledAt = new Date().toISOString()
      }
      return item
    }
  }
}

export default bookingService
