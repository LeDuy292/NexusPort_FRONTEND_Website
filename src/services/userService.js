import apiClient from './apiClient'

/**
 * Lấy danh sách người dùng với tìm kiếm, lọc và phân trang.
 * @param {Object} params - { search, role, status, page, limit }
 */
export async function getUsers(params = {}) {
  const response = await apiClient.get('/users', { params })
  return response.data
}

/**
 * Lấy chi tiết một người dùng theo ID.
 * @param {string} id - UUID
 */
export async function getUserById(id) {
  const response = await apiClient.get(`/users/${id}`)
  return response.data
}

/**
 * Tạo tài khoản người dùng mới.
 * @param {Object} data - { username, email, password, role, fullName, isActive }
 */
export async function createUser(data) {
  const response = await apiClient.post('/users', data)
  return response.data
}

/**
 * Cập nhật thông tin người dùng.
 * @param {string} id
 * @param {Object} data - { username, email, fullName }
 */
export async function updateUser(id, data) {
  const response = await apiClient.put(`/users/${id}`, data)
  return response.data
}

/**
 * Gán role mới cho người dùng.
 * @param {string} id
 * @param {string} role
 */
export async function assignRole(id, role) {
  const response = await apiClient.patch(`/users/${id}/assign-role`, { role })
  return response.data
}

/**
 * Kích hoạt tài khoản người dùng.
 * @param {string} id
 */
export async function activateUser(id) {
  const response = await apiClient.patch(`/users/${id}/activate`)
  return response.data
}

/**
 * Vô hiệu hóa tài khoản người dùng.
 * @param {string} id
 */
export async function deactivateUser(id) {
  const response = await apiClient.patch(`/users/${id}/deactivate`)
  return response.data
}
