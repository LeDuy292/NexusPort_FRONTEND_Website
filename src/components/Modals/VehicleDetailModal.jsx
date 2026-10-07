import React, { useState, useEffect } from 'react';
import vehicleService from '../../services/vehicleService';

export default function VehicleDetailModal({ vehicleId, isOpen, onClose }) {
  const [vehicle, setVehicle] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen && vehicleId) {
      setLoading(true);
      // vehicleService.getById(vehicleId)
      
      // Mock data
      setTimeout(() => {
        setVehicle({
          id: vehicleId,
          licensePlate: '47K1-' + vehicleId.substring(0,5),
          type: 'Đầu kéo đường dài',
          status: 'active',
          location: 'Đường Lê Thiện Trị, Da Nang, VN',
          createdAt: '2026-10-07T00:00:00Z',
          driverName: 'PHAN NGUYÊN GIA HUY',
          photoUrl: null
        });
        setLoading(false);
      }, 500);
    }
  }, [vehicleId, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-carbon/60 backdrop-blur-sm flex items-center justify-center p-4 transition-all" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 shadow-2xl relative border border-slate-200" onClick={e => e.stopPropagation()}>
        <div className="p-6 pb-2 flex justify-between items-start">
          <div>
            <h2 className="text-xl font-bold text-carbon">
              {vehicle ? vehicle.licensePlate : 'Chi tiết Phương tiện'}
            </h2>
            {vehicle && <p className="text-sm text-slate uppercase mt-1">{vehicle.type}</p>}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="w-8 h-8 rounded hover:bg-slate-100 flex items-center justify-center text-slate hover:text-carbon transition-colors">
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
        </div>
        
        <div className="p-6 pt-2 max-h-[80vh] overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-10"><span className="material-symbols-outlined animate-spin text-4xl text-slate-300">progress_activity</span></div>
          ) : !vehicle ? (
            <div className="text-center py-10 text-slate">Không tìm thấy thông tin phương tiện</div>
          ) : (
            <div className="space-y-4">
              <h4 className="font-bold text-[10px] text-slate uppercase tracking-wider border-b pb-2">THÔNG TIN PHƯƠNG TIỆN</h4>
              <div className="flex justify-between"><span className="text-sm text-slate">Trạng thái</span><span className="text-sm font-bold text-blue-600">{vehicle.status}</span></div>
              <div className="flex justify-between"><span className="text-sm text-slate">Biển Số</span><span className="text-sm font-bold">{vehicle.licensePlate}</span></div>
              <div className="flex justify-between"><span className="text-sm text-slate">Loại Xe</span><span className="text-sm font-bold">{vehicle.type}</span></div>
              <div className="flex justify-between"><span className="text-sm text-slate">Vị trí</span><span className="text-sm text-slate truncate max-w-[200px] text-right" title={vehicle.location}>{vehicle.location}</span></div>
              <div className="flex justify-between"><span className="text-sm text-slate">Ngày Tạo</span><span className="text-sm">{new Date(vehicle.createdAt).toLocaleDateString()}</span></div>
              
              <h4 className="font-bold text-[10px] text-slate uppercase tracking-wider border-b pb-2 mt-6">TÀI XẾ PHỤ TRÁCH</h4>
              <div className="flex justify-between items-center bg-slate-50 border border-slate-200 rounded-lg p-3">
                <span className="text-sm font-bold">{vehicle.driverName} (Đang phụ trách)</span>
                <span className="material-symbols-outlined text-slate-400">expand_more</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
