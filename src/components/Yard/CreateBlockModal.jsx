import React, { useState } from 'react';
import apiClient from '../../services/apiClient';

export default function CreateBlockModal({ isOpen, onClose, onBlockCreated }) {
  const [formData, setFormData] = useState({
    name: '',
    description: 'BLOCK CONTAINER',
    max_bays: 10,
    max_rows: 6,
    max_tiers: 4
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      // Gửi request API để tạo block. Thay thế endpoint tùy theo logic backend của bạn
      const payload = {
        blockCode: formData.name,
        description: formData.description,
        maxBays: formData.max_bays,
        maxRows: formData.max_rows,
        maxTiers: formData.max_tiers
      };
      const response = await apiClient.post('/v1/Yard', payload);
      onBlockCreated(response.data);
      setLoading(false);
      onClose();
      
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || 'Có lỗi xảy ra khi tạo Block.');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <span className="material-symbols-outlined text-signal-orange">add_box</span>
            Tạo Khối (Block) Mới
          </h2>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 text-red-600 text-sm font-medium border border-red-100">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Tên Block (Mã Ký Hiệu)</label>
              <input 
                type="text" 
                required
                placeholder="VD: A, B1, KHÔ..."
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value.toUpperCase()})}
                className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm font-mono focus:border-signal-orange focus:ring-1 focus:ring-signal-orange outline-none transition-all uppercase"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Loại Block (Mô tả)</label>
              <input 
                type="text" 
                required
                placeholder="VD: BLOCK CONTAINER"
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm font-mono focus:border-signal-orange focus:ring-1 focus:ring-signal-orange outline-none transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Số Bay (Dãy)</label>
              <input 
                type="number" 
                min="1" max="50" required
                value={formData.max_bays}
                onChange={(e) => setFormData({...formData, max_bays: Number(e.target.value)})}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-mono focus:border-signal-orange outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Số Row (Hàng)</label>
              <input 
                type="number" 
                min="1" max="20" required
                value={formData.max_rows}
                onChange={(e) => setFormData({...formData, max_rows: Number(e.target.value)})}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-mono focus:border-signal-orange outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Số Tier (Tầng)</label>
              <input 
                type="number" 
                min="1" max="10" required
                value={formData.max_tiers}
                onChange={(e) => setFormData({...formData, max_tiers: Number(e.target.value)})}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-mono focus:border-signal-orange outline-none"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="mt-6 flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button 
              type="button" 
              onClick={onClose}
              className="px-5 py-2 text-sm font-bold text-slate-600 hover:text-slate-800 transition-colors"
            >
              Hủy Bỏ
            </button>
            <button 
              type="submit" 
              disabled={loading}
              className="px-5 py-2 bg-signal-orange hover:bg-orange-600 text-white text-sm font-bold rounded-xl shadow-sm hover:shadow transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <span className="material-symbols-outlined animate-spin text-sm">autorenew</span>
              ) : (
                <span className="material-symbols-outlined text-sm">check_circle</span>
              )}
              {loading ? 'Đang tạo...' : 'Xác nhận tạo Block'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
