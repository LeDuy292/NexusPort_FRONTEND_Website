import apiClient from './apiClient';

export const yardReceivingService = {
  // Check and verify Container ID & Seal
  verifyContainerAndSeal: async (containerNo, actualSealNo) => {
    try {
      const response = await apiClient.post('/v1/YardReceiving/verify', {
        containerNo,
        actualSealNo,
      });
      return response.data;
    } catch (error) {
      console.error('Error verifying yard container:', error);
      throw error;
    }
  },

  // Submit Yard Receiving Inspection
  createReceipt: async (receiptData) => {
    try {
      const response = await apiClient.post('/v1/YardReceiving', receiptData);
      return response.data;
    } catch (error) {
      console.error('Error creating yard receipt:', error);
      throw error;
    }
  },

  // Get list of all receiving inspection records
  getReceipts: async (blockCode) => {
    try {
      const response = await apiClient.get('/v1/YardReceiving', {
        params: { blockCode },
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching yard receipts:', error);
      return [];
    }
  },

  // Get receipt detail by ID
  getReceiptById: async (id) => {
    try {
      const response = await apiClient.get(`/v1/YardReceiving/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching yard receipt detail:', error);
      throw error;
    }
  },
};

export default yardReceivingService;
