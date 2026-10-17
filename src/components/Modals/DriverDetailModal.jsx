import React, { useState, useEffect } from 'react';
import driverService from '../../services/driverService';

// Reusing the STATUS_CONFIG from DriverManagement
const STATUS_CONFIG = {
  Available: { label: 'Sẵn sàng', color: 'bg-green-100 text-green-700' },
  Busy: { label: 'Đang làm việc', color: 'bg-blue-100 text-blue-700' },
  OffDuty: { label: 'Nghỉ ca', color: 'bg-slate-200 text-slate-700' },
  Suspended: { label: 'Đình chỉ', color: 'bg-red-100 text-red-700' },
  Pending: { label: 'Đang chờ lệnh', color: 'bg-amber-100 text-amber-700' },
  Active: { label: 'Sẵn sàng', color: 'bg-green-100 text-green-700' },
};

const getExpiryWarning = (dateString) => {
  if (!dateString) return null;
  const days = Math.ceil((new Date(dateString) - new Date()) / (1000 * 60 * 60 * 24));
  if (days < 0) return { label: 'Đã hết hạn', color: 'text-red-600 bg-red-50 border-red-200' };
  if (days <= 30) return { label: `Sắp hết hạn (${days} ngày)`, color: 'text-amber-600 bg-amber-50 border-amber-200' };
  return null;
};

const DriverAvatar = ({ photoUrl, fullName, status, className = "" }) => {
  if (photoUrl) {
    return (
      <div className={`relative rounded-full overflow-hidden border-4 ${status === 'Suspended' ? 'border-red-200' : 'border-white'} ${className}`}>
        <img src={photoUrl} alt={fullName} className="w-full h-full object-cover" />
      </div>
    );
  }
  return (
    <div className={`relative rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-extrabold border-4 ${status === 'Suspended' ? 'border-red-200' : 'border-white'} ${className}`}>
      {fullName ? fullName.charAt(0) : '?'}
    </div>
  );
};

const DocumentCard = ({ url, title, alt }) => (
  <div className="space-y-1.5">
    <div className="text-[9px] font-bold text-slate uppercase">{title}</div>
    <div className="bg-slate-50 p-1 rounded-xl border border-chalk h-24 flex items-center justify-center overflow-hidden hover:border-signal-orange group cursor-pointer">
      <img src={url} alt={alt} className="max-w-full max-h-full object-cover rounded-lg shadow-sm transition-transform group-hover:scale-105" />
    </div>
  </div>
);

export const resolveMediaUrl = (url) => {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `http://localhost:5000${url.startsWith('/') ? '' : '/'}${url}`;
};

export default function DriverDetailModal({ driverId, isOpen, onClose }) {
  const [driver, setDriver] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen && driverId) {
      setLoading(true);
      driverService.getDriverById(driverId)
        .then(data => {
          setDriver(data);
          setLoading(false);
        })
        .catch(err => {
          console.error(err);
          // Fallback to mock data if API fails
          setTimeout(() => {
            setDriver({
              id: driverId,
              fullName: 'PHAN NGUYÊN GIA HUY (Mock)',
              phone: '0842737474',
              idCardNumber: '066204016135',
              licenseNumber: '660225020133',
              idCardExpiryDate: '2029-12-01T00:00:00Z',
              licenseExpiryDate: '2035-09-10T00:00:00Z',
              status: 'Pending',
              carrierName: 'korao',
              createdAt: '2026-10-07T00:00:00Z',
              photoUrl: null,
              idCardFrontUrl: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png',
              licenseImageUrl: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png'
            });
            setLoading(false);
          }, 500);
        });
    }
  }, [driverId, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-carbon/60 backdrop-blur-sm flex items-center justify-center p-4 transition-all" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-4xl overflow-hidden animate-in zoom-in-95 duration-200 shadow-2xl relative border border-slate-200" onClick={e => e.stopPropagation()}>
        <div className="p-6 pb-2 flex justify-between items-start border-b border-chalk">
          <div>
            <h2 className="text-xl font-bold text-carbon">Chi tiết Tài xế</h2>
            {driver && <p className="text-sm text-slate uppercase mt-1">{driver.fullName}</p>}
          </div>
          <div className="flex gap-2">
            <button className="w-8 h-8 rounded-full border border-chalk flex items-center justify-center text-slate hover:text-signal-orange hover:border-signal-orange transition-colors">
              <span className="material-symbols-outlined text-[16px]">edit</span>
            </button>
            <button onClick={onClose} className="w-8 h-8 rounded-full border border-chalk flex items-center justify-center text-slate hover:bg-slate-50 transition-colors">
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          </div>
        </div>
        
        <div className="p-6 pt-6 max-h-[80vh] overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-10"><span className="material-symbols-outlined animate-spin text-4xl text-slate-300">progress_activity</span></div>
          ) : !driver ? (
            <div className="text-center py-10 text-slate">Không tìm thấy thông tin tài xế</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-8 font-sans">
              <div className="md:col-span-4 flex flex-col items-center space-y-4">
                <DriverAvatar photoUrl={resolveMediaUrl(driver.photoUrl)} fullName={driver.fullName} status={driver.status} className="w-32 h-32 text-4xl shadow-md" />
                <span className={`px-4 py-1.5 rounded-full text-xs font-bold ${STATUS_CONFIG[driver.status]?.color || 'bg-slate-100 text-slate-700'}`}>
                  {STATUS_CONFIG[driver.status]?.label || driver.status}
                </span>
                <button className="w-full mt-4 py-3 px-4 rounded-xl bg-signal-orange text-white font-bold text-sm shadow flex items-center justify-center gap-2 hover:bg-orange-600 transition-colors">
                  <span className="material-symbols-outlined text-[20px]">call</span>
                  Liên hệ khẩn cấp
                </button>
              </div>
              <div className="md:col-span-8 space-y-6">
                <div className="grid grid-cols-2 gap-y-6 gap-x-8">
                  <div><p className="text-[10px] font-bold text-slate uppercase mb-1">SỐ ĐIỆN THOẠI</p><p className="text-sm font-mono text-carbon font-bold">{driver.phone}</p></div>
                  <div><p className="text-[10px] font-bold text-slate uppercase mb-1">TRỰC THUỘC ĐƠN VỊ</p><p className="text-sm font-bold text-signal-orange">{driver.carrierName}</p></div>
                  <div><p className="text-[10px] font-bold text-slate uppercase mb-1">SỐ CCCD</p><p className="text-sm font-mono text-carbon font-bold">{driver.idCardNumber}</p></div>
                  <div><p className="text-[10px] font-bold text-slate uppercase mb-1">NGÀY HẾT HẠN CCCD</p><p className="text-sm font-mono text-carbon font-bold">{new Date(driver.idCardExpiryDate).toLocaleDateString()}</p></div>
                  <div><p className="text-[10px] font-bold text-slate uppercase mb-1">GIẤY PHÉP LÁI XE</p><p className="text-sm font-mono text-carbon font-bold">{driver.licenseNumber}</p></div>
                  <div>
                    <p className="text-[10px] font-bold text-slate uppercase mb-1">NGÀY HẾT HẠN GPLX</p>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-mono text-carbon font-bold">{new Date(driver.licenseExpiryDate).toLocaleDateString()}</p>
                      {(() => {
                        const warn = getExpiryWarning(driver.licenseExpiryDate);
                        return warn ? <span className={`text-[10px] px-2 py-0.5 rounded font-bold border ${warn.color}`}>{warn.label}</span> : null;
                      })()}
                    </div>
                  </div>
                  <div><p className="text-[10px] font-bold text-slate uppercase mb-1">NGÀY THAM GIA</p><p className="text-sm font-mono text-carbon font-bold">{new Date(driver.createdAt).toLocaleDateString()}</p></div>
                </div>

                <div className="pt-6 border-t border-chalk">
                  <h4 className="text-[10px] font-bold text-slate uppercase tracking-wider mb-3">TÀI LIỆU ĐÍNH KÈM</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {driver.idCardFrontUrl && (
                      <DocumentCard url={resolveMediaUrl(driver.idCardFrontUrl)} title="CCCD Trước" alt="CCCD" />
                    )}
                    {driver.idCardBackUrl && (
                      <DocumentCard url={resolveMediaUrl(driver.idCardBackUrl)} title="CCCD Sau" alt="CCCD" />
                    )}
                    {driver.licenseImageUrl && (
                      <DocumentCard url={resolveMediaUrl(driver.licenseImageUrl)} title="GPLX Trước" alt="GPLX" />
                    )}
                    {driver.licenseBackImageUrl && (
                      <DocumentCard url={resolveMediaUrl(driver.licenseBackImageUrl)} title="GPLX Sau" alt="GPLX" />
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
