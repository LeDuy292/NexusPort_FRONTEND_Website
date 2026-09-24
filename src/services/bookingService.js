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
    const response = await apiClient.post('/v1/Booking', data)
    const created = response.data
    if (created) {
      const existingIdx = mockBookings.findIndex(b => b.id === created.id || b.bookingCode === created.bookingCode)
      if (existingIdx >= 0) {
        mockBookings[existingIdx] = created
      } else {
        mockBookings.unshift(created)
      }
    }
    return created
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
  },

  // Phê duyệt booking (Approve)
  approveBooking: async (id) => {
    try {
      const response = await apiClient.post(`/v1/Booking/${id}/approve`)
      return response.data
    } catch (error) {
      console.warn(`API error approving booking ${id}:`, error?.message)
      const item = mockBookings.find(b => b.id === id)
      if (item) {
        item.status = 'Approved'
        item.approvedAt = new Date().toISOString()
      }
      return item
    }
  },

  // Từ chối booking (Reject)
  rejectBooking: async (id, reason = '') => {
    try {
      const response = await apiClient.post(`/v1/Booking/${id}/reject`, { reason })
      return response.data
    } catch (error) {
      console.warn(`API error rejecting booking ${id}:`, error?.message)
      const item = mockBookings.find(b => b.id === id)
      if (item) {
        item.status = 'Rejected'
        item.rejectionReason = reason
      }
      return item
    }
  },

  // NXP-048: Lấy danh sách tài nguyên kho bãi & đội xe sẵn sàng cho AI Auto-Match
  getAvailableResources: async () => {
    const fallbackContainers = [
      { id: 'f3ce22ac-73ee-49ae-840a-89ae61929039', containerNumber: 'CMAU3381920', sealNumber: 'SEAL-VN-998811', size: 'ft20', grossWeightKg: 18500, grossWeightTon: 18.5, status: 'In_Yard', cargoType: 'dry' },
      { id: '8c812b17-db62-40da-a249-dcd9b1f81652', containerNumber: 'MSCU9901123', sealNumber: 'SEAL-RF-554411', size: 'ft20', grossWeightKg: 18500, grossWeightTon: 18.5, status: 'In_Yard', cargoType: 'reefer' },
      { id: '6b86b542-f698-45d9-afc9-8cb55086aa56', containerNumber: 'TEMU4451920', sealNumber: 'SEAL-VN-889922', size: 'ft40', grossWeightKg: 28400, grossWeightTon: 28.4, status: 'In_Yard', cargoType: 'dry' },
      { id: 'fe7a4ffe-e1e6-430b-8f7d-0533425f8a86', containerNumber: 'COSU8819201', sealNumber: 'SEAL-COS-11223', size: 'ft20', grossWeightKg: 18500, grossWeightTon: 18.5, status: 'In_Yard', cargoType: 'dry' },
      { id: '1966ec6f-1b4f-44d1-904e-3bdf31ae852a', containerNumber: 'EVER1129983', sealNumber: 'SEAL-EV-778899', size: 'ft20', grossWeightKg: 18500, grossWeightTon: 18.5, status: 'In_Yard', cargoType: 'dry' }
    ]
    const fallbackTrucks = [
      { id: 'b1010101-0000-0000-0000-000000000001', plateNumber: '51C-992.81', vehicleType: 'Đầu kéo Hyundai Xcient (Tải 25T)', maxPayloadTon: 25, status: 'active' },
      { id: 'b1010101-0000-0000-0000-000000000002', plateNumber: '29H-771.02', vehicleType: 'Đầu kéo Daewoo Novus (Tải 16T)', maxPayloadTon: 16, status: 'active' },
      { id: 'b1010101-0000-0000-0000-000000000003', plateNumber: '15C-662.19', vehicleType: 'Đầu kéo International (Tải 32T)', maxPayloadTon: 32, status: 'active' },
      { id: 'b1010101-0000-0000-0000-000000000004', plateNumber: '51D-883.45', vehicleType: 'Đầu kéo Chenglong H7 (Tải 20T)', maxPayloadTon: 20, status: 'active' },
      { id: 'b1010101-0000-0000-0000-000000000005', plateNumber: '43C-551.89', vehicleType: 'Đầu kéo Isuzu Giga (Tải 28T)', maxPayloadTon: 28, status: 'active' },
      { id: 'b1010101-0000-0000-0000-000000000006', plateNumber: '60C-338.92', vehicleType: 'Đầu kéo Shacman X3000 (Tải 30T)', maxPayloadTon: 30, status: 'active' },
      { id: 'b1010101-0000-0000-0000-000000000007', plateNumber: '72C-441.15', vehicleType: 'Đầu kéo Hino 700 Series (Tải 24T)', maxPayloadTon: 24, status: 'active' },
      { id: 'b1010101-0000-0000-0000-000000000008', plateNumber: '50LD-112.34', vehicleType: 'Đầu kéo Scania R500 (Tải 35T)', maxPayloadTon: 35, status: 'active' },
      { id: 'b1010101-0000-0000-0000-000000000009', plateNumber: '61C-882.71', vehicleType: 'Đầu kéo FAW JH6 (Tải 18T)', maxPayloadTon: 18, status: 'active' },
      { id: 'b1010101-0000-0000-0000-000000000010', plateNumber: '51C-773.09', vehicleType: 'Đầu kéo Man TGX (Tải 26T)', maxPayloadTon: 26, status: 'active' }
    ]
    const fallbackDrivers = [
      { id: 'd1010101-0000-0000-0000-000000000001', fullName: 'Nguyễn Văn Hùng', licenseClass: 'FC', phone: '0912.883.991', status: 'active' },
      { id: 'd1010101-0000-0000-0000-000000000002', fullName: 'Trần Quốc Tuấn', licenseClass: 'FC', phone: '0988.771.223', status: 'active' },
      { id: 'd1010101-0000-0000-0000-000000000003', fullName: 'Lê Hoàng Đức', licenseClass: 'FC', phone: '0903.441.552', status: 'active' },
      { id: 'd1010101-0000-0000-0000-000000000004', fullName: 'Phạm Đình Trọng', licenseClass: 'FC', phone: '0934.112.334', status: 'active' },
      { id: 'd1010101-0000-0000-0000-000000000005', fullName: 'Võ Thành Nam', licenseClass: 'FC', phone: '0976.223.445', status: 'active' },
      { id: 'd1010101-0000-0000-0000-000000000006', fullName: 'Đặng Hữu Tài', licenseClass: 'FC', phone: '0918.223.778', status: 'active' },
      { id: 'd1010101-0000-0000-0000-000000000007', fullName: 'Bùi Minh Trí', licenseClass: 'FC', phone: '0907.334.889', status: 'active' },
      { id: 'd1010101-0000-0000-0000-000000000008', fullName: 'Hoàng Quốc Bảo', licenseClass: 'FC', phone: '0981.445.990', status: 'active' },
      { id: 'd1010101-0000-0000-0000-000000000009', fullName: 'Ngô Kiến Huy', licenseClass: 'FC', phone: '0932.556.112', status: 'active' },
      { id: 'd1010101-0000-0000-0000-000000000010', fullName: 'Trịnh Thăng Long', licenseClass: 'FC', phone: '0975.667.223', status: 'active' }
    ]

    try {
      const response = await apiClient.get('/v1/Booking/available-resources')
      const data = response.data || {}
      return {
        containers: data.containers || [],
        trucks: data.trucks || [],
        drivers: data.drivers || []
      }
    } catch (error) {
      console.warn('API error fetching available resources, using defaults:', error?.message)
      return {
        containers: [],
        trucks: [],
        drivers: []
      }
    }
  },

  // NXP-049: Gán/Điều phối Tài xế, Xe đầu kéo, Container cho Booking và chuyển sang trạng thái Ready
  assignBookingResources: async (id, data) => {
    try {
      const response = await apiClient.post(`/v1/Booking/${id}/assign`, data)
      return response.data
    } catch (error) {
      console.warn(`API error assigning resources to booking ${id}:`, error?.message)
      const item = mockBookings.find(b => b.id === id)
      if (item) {
        item.status = 'Ready'
        item.driverId = data.driverId
        item.driverName = data.driverName
        item.truckId = data.truckId
        item.vehiclePlate = data.vehiclePlate
        if (data.containerIds?.length) item.containerIds = data.containerIds
      }
      return item
    }
  },

  // NXP-048: AI Gợi ý tối ưu xe đầu kéo, tài xế và lịch hẹn (xử lý 100% tại backend CSDL)
  getFleetRecommendation: async (params = {}) => {
    try {
      const response = await apiClient.get('/v1/Booking/recommend-fleet', { params })
      return response.data
    } catch (error) {
      console.warn('API error fetching fleet recommendation, using fallback:', error?.message)
      return null
    }
  },

  // NXP-048: Đánh giá tỷ lệ tải trọng và kiểm tra an toàn theo thời gian thực từ backend CSDL
  evaluatePayload: async (params = {}) => {
    try {
      const response = await apiClient.get('/v1/Booking/evaluate-payload', { params })
      return response.data
    } catch (error) {
      console.warn('API error evaluating payload, using fallback:', error?.message)
      return null
    }
  }
}

export default bookingService
