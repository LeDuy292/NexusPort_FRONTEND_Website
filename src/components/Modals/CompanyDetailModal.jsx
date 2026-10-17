import React, { useState, useEffect } from 'react';
import { companyService } from '../../services/companyService';
import driverService from '../../services/driverService';

export default function CompanyDetailModal({ companyId, isOpen, onClose }) {
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  const [companyDrivers, setCompanyDrivers] = useState([]);
  const [loadingDrivers, setLoadingDrivers] = useState(false);

  useEffect(() => {
    if (isOpen && companyId) {
      setLoading(true);
      // Fetch company detail
      // Giả lập mock data để đảm bảo luôn chạy được
      setTimeout(() => {
        setCompany({
          id: companyId,
          companyName: 'kim',
          code: '0662013',
          createdAt: '2026-10-07T00:00:00Z',
          address: 'Huyện Đa Krông, Tỉnh Quảng Trị',
          contactPerson: 'huy phan',
          phone: '0842737474',
          email: 'dauboquay@gmail.com',
          status: 'Hoạt động'
        });
        setLoading(false);
      }, 500);

      // Fetch drivers
      setLoadingDrivers(true);
      setTimeout(() => {
        setCompanyDrivers([
          {
            id: 'drv_1',
            fullName: 'PHAN NGUYÊN GIA HUY',
            licenseNumber: '660225020133',
            idCardNumber: '066204016135',
            phone: '0842737474',
            status: 'active'
          }
        ]);
        setLoadingDrivers(false);
      }, 800);
      
      /* Code gọi API thật:
      driverService.getAllDrivers({ carrierId: companyId })
        .then(data => setCompanyDrivers(data || []))
        .catch(err => console.error(err))
        .finally(() => setLoadingDrivers(false));
      */
    }
  }, [companyId, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-carbon/60 backdrop-blur-sm flex items-center justify-center p-4 transition-all" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-4xl overflow-hidden animate-in zoom-in-95 duration-200 shadow-2xl relative border border-slate-200 flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
        <div className="p-6 pb-4 flex justify-between items-start border-b border-chalk">
          <div>
            <h2 className="font-bold text-xs text-slate uppercase tracking-wider">
              CHI TIẾT HÃNG TÀU
            </h2>
            {company && <p className="text-2xl font-extrabold text-carbon mt-1">{company.companyName}</p>}
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
        
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-white">
          {loading ? (
             <div className="flex justify-center py-10"><span className="material-symbols-outlined animate-spin text-4xl text-slate-300">progress_activity</span></div>
          ) : !company ? (
             <div className="text-center py-10 text-slate">Không tìm thấy thông tin công ty</div>
          ) : (
            <>
              {/* Profile Card Summary */}
              <div className="flex items-center gap-4 bg-fog p-4 rounded-xl border border-chalk">
                <div className="w-16 h-16 rounded-xl bg-carbon text-white flex items-center justify-center text-xl font-bold font-mono">
                  {company.code}
                </div>
                <div className="flex-1">
                  <div className="text-sm text-slate font-mono mb-1">ID: {company.id}</div>
                  <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border mt-1 ${company.status === 'Hoạt động' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                    {company.status}
                  </span>
                </div>
              </div>
              
              {/* Company Information */}
              <div className="space-y-3 mt-6">
                <h4 className="font-bold text-xs uppercase tracking-wider text-carbon border-b border-chalk pb-2">
                  THÔNG TIN DOANH NGHIỆP
                </h4>
                <div className="grid grid-cols-2 gap-4 text-sm mt-4">
                  <div>
                    <span className="text-slate block text-xs mb-1">Ngày tham gia:</span>
                    <span className="font-mono font-bold text-carbon">{new Date(company.createdAt).toLocaleDateString()}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate block text-xs mb-1">Địa chỉ:</span>
                    <span className="font-bold text-carbon">{company.address}</span>
                  </div>
                </div>
              </div>
              
              {/* Contact Information */}
              <div className="space-y-3 mt-6">
                <h4 className="font-bold text-xs uppercase tracking-wider text-carbon border-b border-chalk pb-2">
                  NGƯỜI ĐẠI DIỆN LIÊN HỆ
                </h4>
                <div className="grid grid-cols-2 gap-4 text-sm mt-4">
                  <div>
                    <span className="text-slate block text-xs mb-1">Họ & Tên đại diện:</span>
                    <span className="font-bold text-carbon">{company.contactPerson}</span>
                  </div>
                  <div>
                    <span className="text-slate block text-xs mb-1">Số điện thoại:</span>
                    <span className="font-mono font-bold text-carbon">{company.phone}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate block text-xs mb-1">Email làm việc chính:</span>
                    <span className="font-mono font-bold text-carbon">{company.email}</span>
                  </div>
                </div>
              </div>

              {/* Registered Drivers List */}
              <div className="space-y-3 mt-6">
                <h4 className="font-bold text-xs uppercase tracking-wider text-carbon border-b border-chalk pb-2">
                  DANH SÁCH TÀI XẾ VẬN TẢI
                </h4>
                <div className="space-y-2 mt-4">
                  {loadingDrivers ? (
                    <div className="text-xs text-slate italic text-center py-4 bg-fog rounded border border-chalk">
                      Đang tải danh sách tài xế...
                    </div>
                  ) : companyDrivers.length > 0 ? (
                    <div className="max-h-60 overflow-y-auto pr-2 space-y-2">
                      {companyDrivers.map((driver) => (
                        <div key={driver.id} className="p-3 bg-fog rounded-lg border border-chalk text-xs font-bold text-carbon flex justify-between items-center">
                          <div className="flex flex-col">
                            <span className="text-sm flex items-center gap-2"><span className="material-symbols-outlined text-[16px] text-slate">person</span> {driver.fullName}</span>
                            <span className="text-[10px] text-slate font-mono font-normal mt-1">GPLX: {driver.licenseNumber} • CCCD: {driver.idCardNumber}</span>
                          </div>
                          <div className="flex flex-col items-end">
                            <span className={`text-[10px] px-2 py-0.5 rounded border font-mono ${driver.status === 'active' ? 'bg-green-50 text-green-700 border-green-200' : driver.status === 'inactive' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                              {driver.status === 'active' ? 'Sẵn sàng' : driver.status === 'inactive' ? 'Tạm nghỉ' : 'Đình chỉ'}
                            </span>
                            <span className="text-[10px] text-slate font-normal mt-1">LH: {driver.phone}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs text-slate italic text-center py-4 bg-fog rounded border border-chalk">
                      Hãng tàu chưa đăng ký tài xế nào
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
        
        {/* Footer actions */}
        <div className="p-6 border-t border-chalk bg-fog flex justify-end gap-3 mt-auto rounded-b-2xl shrink-0">
          <button onClick={onClose} className="px-6 py-2.5 bg-white border border-chalk text-carbon rounded font-bold text-xs hover:bg-slate-50 transition-colors uppercase shadow-sm">
            Đóng
          </button>
          <button className="px-6 py-2.5 bg-red-600 text-white rounded font-bold text-xs hover:bg-red-700 transition-colors uppercase shadow-sm">
            Tạm Khóa Tài Khoản
          </button>
        </div>
      </div>
    </div>
  );
}
