import apiClient from './apiClient';

export const companyService = {
  getAll: async (search) => {
    const params = search ? { search } : {};
    const response = await apiClient.get('/v1/companies', { params });
    return response.data;
  },

  getById: async (id) => {
    const response = await apiClient.get(`/v1/companies/${id}`);
    return response.data;
  },

  create: async (data) => {
    const response = await apiClient.post('/v1/companies', data);
    return response.data;
  },

  update: async (id, data) => {
    const response = await apiClient.put(`/v1/companies/${id}`, data);
    return response.data;
  },

  changeStatus: async (id, status) => {
    const response = await apiClient.patch(`/v1/companies/${id}/status`, { status });
    return response.data;
  }
};
