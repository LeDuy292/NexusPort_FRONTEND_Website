import React, { useState, useEffect } from 'react';
import { shippingLineApi, formatApiErrorMessage } from './api/shippingLineApi';
import ShippingBadge from './components/ShippingBadge';
import ShippingPagination from './components/ShippingPagination';
import EdoIssueModal from './components/EdoIssueModal';
import EdoPreviewModal from './components/EdoPreviewModal';

export default function DeliveryOrderPage() {
  const [activeTab, setActiveTab] = useState('EDO_LIST'); // EDO_LIST, GATE_VERIFY
  const [deliveryOrders, setDeliveryOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Phân trang danh sách eDO
  const [edoPage, setEdoPage] = useState(1);
  const [edoPageSize, setEdoPageSize] = useState(5);

  // Modals
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewEdo, setPreviewEdo] = useState(null);

  // Extend Modal
  const [showExtendModal, setShowExtendModal] = useState(false);
  const [selectedEdoForExtend, setSelectedEdoForExtend] = useState(null);
  const [extendDate, setExtendDate] = useState('');
  const [extendReason, setExtendReason] = useState('');

  // Gate verify simulation
  const [verifyContNo, setVerifyContNo] = useState('EMCU5102949');
  const [verifyResult, setVerifyResult] = useState(null);
  const [verifying, setVerifying] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const edoRes = await shippingLineApi.getDeliveryOrders({ search, status: statusFilter });
      const edoList = Array.isArray(edoRes) ? edoRes : (edoRes?.data || []);
      setDeliveryOrders(edoList);
    } catch (err) {
      setError(formatApiErrorMessage(err, 'Lỗi tải dữ liệu lệnh giao hàng'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setEdoPage(1);
    loadData();
  }, [search, statusFilter]);

  const handleOpenPreview = async (edo) => {
    try {
      setLoading(true);
      const res = await shippingLineApi.getDeliveryOrderDetail(edo.id);
      const detail = res?.edoNumber ? res : (res?.data || null);
      if (detail) {
        setPreviewEdo(detail);
        setShowPreviewModal(true);
      }
    } catch (err) {
      setError(formatApiErrorMessage(err, 'Không thể xem chi tiết lệnh eDO'));
    } finally {
      setLoading(false);
    }
  };

  const handleOpenExtend = (edo) => {
    setSelectedEdoForExtend(edo);
    setExtendDate('2026-11-20 23:59:00');
    setExtendReason('');
    setShowExtendModal(true);
  };

  const handleSaveExtend = async (e) => {
    e.preventDefault();
    if (!extendReason.trim()) {
      setError('Vui lòng nhập lý do gia hạn lệnh eDO');
      return;
    }
    setSaving(true);
    setError('');

    try {
      await shippingLineApi.extendEdo(selectedEdoForExtend.id, extendDate, extendReason);
      setShowExtendModal(false);
      setSuccessMsg('Gia hạn lệnh giao hàng eDO thành công');
      loadData();
    } catch (err) {
      setError(formatApiErrorMessage(err, 'Lỗi gia hạn lệnh giao hàng'));
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdo = async (edo) => {
    const reason = window.prompt('Nhập lý do hủy lệnh giao hàng eDO này:');
    if (!reason || !reason.trim()) return;
    setSaving(true);
    setError('');

    try {
      await shippingLineApi.cancelEdo(edo.id, reason);
      setSuccessMsg(`Đã hủy lệnh giao hàng ${edo.edoNumber}`);
      loadData();
    } catch (err) {
      setError(formatApiErrorMessage(err, 'Lỗi hủy lệnh giao hàng'));
    } finally {
      setSaving(false);
    }
  };

  const handleSimulateGateVerify = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!verifyContNo.trim()) return;
    setVerifying(true);
    setError('');
    setVerifyResult(null);

    try {
      const res = await fetch(`/api/shipping-line/gate-out/verify/${encodeURIComponent(verifyContNo.trim().toUpperCase())}`);
      const json = await res.json();
      if (json?.data) {
        setVerifyResult(json.data);
      }
    } catch (err) {
      setError(formatApiErrorMessage(err, 'Lỗi khi kiểm tra đối chiếu cổng'));
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="p-6 md:p-8 w-full font-sans flex flex-col gap-6 bg-slate-50 min-h-screen">
      
      {/* ── 1. HEADER CHUẨN NEXUSPORT ── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white border border-chalk rounded-2xl p-5 shadow-sm gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-extrabold bg-orange-100 text-orange-800 px-3 py-0.5 rounded-full uppercase">
              HÃNG TÀU &amp; VẬN TẢI BIỂN
            </span>
            <span className="text-xs font-mono text-slate">NexusPort · Cảng Tiên Sa, Đà Nẵng (VNDAD)</span>
          </div>
          <h2 className="font-heading text-2xl md:text-3xl font-extrabold text-carbon">
            Lệnh giao hàng điện tử (eDO)
          </h2>
          <p className="text-xs text-slate mt-0.5">
            Quản lý, phát hành và gia hạn lệnh giao hàng điện tử cho chủ hàng nhận container tại cổng cảng.
          </p>
        </div>

        {/* Nút Hành Động - Cố định gọn gàng bên phải Header */}
        <div className="flex items-center gap-2.5 shrink-0 self-end md:self-center">
          <button
            onClick={() => setShowIssueModal(true)}
            className="px-4 py-2.5 text-xs font-bold text-white bg-signal-orange hover:opacity-90 rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <span className="material-symbols-outlined text-base">assignment_turned_in</span>
            <span>Cấp lệnh eDO mới</span>
          </button>

          <button
            onClick={loadData}
            title="Tải lại dữ liệu"
            className="w-10 h-10 bg-white border border-chalk rounded-xl flex items-center justify-center text-slate hover:text-carbon hover:bg-fog shadow-sm transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-lg">refresh</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex justify-between items-center shadow-xs">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-red-600 font-bold px-2">✕</button>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs flex justify-between items-center shadow-xs">
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg('')} className="text-emerald-700 font-bold px-2">✕</button>
        </div>
      )}

      {/* ── 2. THANH CHUYỂN TAB & BỘ LỌC TÌM KIẾM ── */}
      <div className="bg-white border border-chalk rounded-2xl p-4 shadow-sm flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-4 text-xs">
        {/* Bộ chuyển đổi Tab nghiệp vụ */}
        <div className="flex bg-fog p-1 rounded-xl border border-chalk text-xs font-bold shrink-0">
          <button
            onClick={() => setActiveTab('EDO_LIST')}
            className={`px-4 py-2 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'EDO_LIST' ? 'bg-carbon text-white shadow-sm' : 'text-slate hover:text-carbon'
            }`}
          >
            <span className="material-symbols-outlined text-sm">receipt_long</span>
            <span>Danh sách lệnh eDO ({deliveryOrders.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('GATE_VERIFY')}
            className={`px-4 py-2 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'GATE_VERIFY' ? 'bg-carbon text-white shadow-sm' : 'text-slate hover:text-carbon'
            }`}
          >
            <span className="material-symbols-outlined text-sm">sensor_door</span>
            <span>Kiểm tra ra cổng</span>
          </button>
        </div>

        {/* Ô tìm kiếm & Lọc trạng thái (chỉ hiện khi xem danh sách) */}
        {activeTab === 'EDO_LIST' && (
          <div className="flex flex-col sm:flex-row items-center gap-3 flex-1 justify-end">
            <div className="relative w-full sm:w-80">
              <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate text-base">search</span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm theo mã eDO, mã B/L, chủ hàng..."
                className="w-full pl-9 pr-4 py-2 bg-fog border border-chalk rounded-xl text-xs font-medium text-carbon focus:outline-none focus:border-signal-orange focus:ring-0"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto font-bold shrink-0">
              <span className="text-slate uppercase text-[10px]">Trạng thái:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3.5 py-2 bg-fog border border-chalk rounded-xl text-xs font-bold text-carbon focus:outline-none focus:border-signal-orange focus:ring-0"
              >
                <option value="">Tất cả trạng thái</option>
                <option value="ISSUED">Đang có hiệu lực</option>
                <option value="PENDING">Chờ xử lý</option>
                <option value="EXPIRED">Đã hết hiệu lực</option>
                <option value="CANCELLED">Đã hủy</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* ── 3. VIEW: DANH SÁCH LỆNH GIAO HÀNG (eDO) ── */}
      {activeTab === 'EDO_LIST' && (
        <div className="space-y-4">
          
          {/* Table Lệnh eDO */}
          <div className="bg-white border border-chalk rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex justify-between items-center border-b border-chalk pb-3">
              <div>
                <h3 className="font-heading text-lg font-extrabold text-carbon">
                  Danh sách lệnh giao hàng điện tử (eDO)
                </h3>
                <p className="text-xs text-slate font-mono mt-0.5">
                  Hiển thị {deliveryOrders.length} lệnh giao hàng trong hệ thống
                </p>
              </div>
              <span className="text-xs text-slate font-mono font-bold">Cập nhật lúc: vừa xong</span>
            </div>

            {deliveryOrders.length === 0 ? (
              <div className="p-12 text-center text-slate space-y-2 font-sans">
                <span className="material-symbols-outlined text-4xl text-slate">assignment</span>
                <p className="font-bold text-sm">Không tìm thấy lệnh giao hàng nào phù hợp với bộ lọc!</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1000px] text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-fog text-slate font-bold uppercase text-[10px] border-b border-chalk">
                      <th className="py-3 px-3 whitespace-nowrap">Mã Lệnh eDO</th>
                      <th className="py-3 px-3 whitespace-nowrap">Mã Vận Đơn (B/L)</th>
                      <th className="py-3 px-3 min-w-[180px]">Chủ Hàng / Đơn Vị Nhận</th>
                      <th className="py-3 px-3 whitespace-nowrap">Số Container</th>
                      <th className="py-3 px-3 whitespace-nowrap">Hiệu Lực Đến</th>
                      <th className="py-3 px-3 whitespace-nowrap">Mã PIN Nhận Hàng</th>
                      <th className="py-3 px-3 whitespace-nowrap">Trạng Thái</th>
                      <th className="py-3 px-3 text-right whitespace-nowrap">Thao Tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-chalk font-medium font-mono">
                    {deliveryOrders.slice((edoPage - 1) * edoPageSize, edoPage * edoPageSize).map((edo) => (
                      <tr key={edo.id} className="hover:bg-fog/60 transition-colors">
                        <td className="py-3.5 px-3 font-bold text-carbon text-sm whitespace-nowrap">{edo.edoNumber}</td>
                        <td className="py-3.5 px-3 font-bold text-carbon whitespace-nowrap">{edo.blNumber}</td>
                        <td className="py-3.5 px-3 font-sans text-carbon text-[11px] max-w-[200px] truncate" title={edo.consignee}>
                          {edo.consignee}
                        </td>
                        <td className="py-3.5 px-3 font-bold text-carbon whitespace-nowrap">
                          {edo.containers?.length || 0} Cont
                        </td>
                        <td className="py-3.5 px-3 font-bold text-carbon whitespace-nowrap">{edo.validUntil}</td>
                        <td className="py-3.5 px-3 text-amber-700 font-bold whitespace-nowrap">{edo.pinCode}</td>
                        <td className="py-3.5 px-3 font-sans whitespace-nowrap">
                          <ShippingBadge status={edo.status} />
                        </td>
                        <td className="py-3.5 px-3 text-right font-sans">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenPreview(edo)}
                              title="In phiếu lệnh eDO chuẩn cảng"
                              className="w-7 h-7 bg-fog hover:bg-chalk border border-chalk rounded-lg flex items-center justify-center text-slate hover:text-carbon transition-colors cursor-pointer"
                            >
                              <span className="material-symbols-outlined text-[16px]">print</span>
                            </button>
                            {edo.status === 'ISSUED' && (
                              <>
                                <button
                                  onClick={() => handleOpenExtend(edo)}
                                  className="px-2.5 py-1 text-xs font-bold text-carbon bg-fog hover:bg-chalk border border-chalk rounded-lg transition-colors cursor-pointer"
                                >
                                  Gia Hạn
                                </button>
                                <button
                                  onClick={() => handleCancelEdo(edo)}
                                  className="px-2.5 py-1 text-xs font-bold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors cursor-pointer"
                                >
                                  Hủy Lệnh
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Phân trang bảng eDO */}
            {deliveryOrders.length > 0 && (
              <ShippingPagination
                currentPage={edoPage}
                totalItems={deliveryOrders.length}
                pageSize={edoPageSize}
                onPageChange={setEdoPage}
                onPageSizeChange={setEdoPageSize}
                pageSizeOptions={[5, 10, 20]}
                itemName="lệnh eDO"
              />
            )}
          </div>

        </div>
      )}

      {/* ── 3. VIEW: MÔ PHỎNG ĐỐI SOÁT CỔNG CẢNG (GATE OUT CHECK) ── */}
      {activeTab === 'GATE_VERIFY' && (
        <div className="max-w-2xl bg-white border border-chalk rounded-2xl p-6 shadow-sm space-y-4">
          <div className="border-b border-chalk pb-3">
            <h3 className="font-heading text-lg font-extrabold text-carbon flex items-center gap-2">
              <span className="material-symbols-outlined text-signal-orange text-xl">fact_check</span>
              Kiểm Tra Hiệu Lực eDO Tại Cổng Cảng
            </h3>
            <p className="text-xs text-slate mt-0.5">
              Hệ thống cổng tự động đối chiếu số eDO và thời hạn hiệu lực trước khi cấp phép mở barie cho xe lấy hàng.
            </p>
          </div>

          <form onSubmit={handleSimulateGateVerify} className="space-y-4 text-xs font-sans">
            <div>
              <label className="block text-[11px] font-bold text-carbon uppercase mb-1">
                Số Container Cần Tra Cứu *
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  required
                  value={verifyContNo}
                  onChange={(e) => setVerifyContNo(e.target.value.toUpperCase())}
                  placeholder="VD: EMCU5102949..."
                  className="flex-1 px-3 py-2 bg-fog border border-chalk rounded-xl font-mono text-carbon font-bold focus:outline-none focus:border-signal-orange focus:ring-0 uppercase"
                />
                <button
                  type="submit"
                  disabled={verifying}
                  className="px-4 py-2 text-xs font-bold text-white bg-carbon hover:bg-black disabled:bg-slate rounded-xl transition-colors flex items-center gap-1 cursor-pointer"
                >
                  {verifying ? 'Đang kiểm tra...' : 'Kiểm tra ngay'}
                </button>
              </div>
            </div>
          </form>

          {verifyResult && (
            <div className={`p-5 rounded-2xl border text-xs space-y-3 font-sans ${
              verifyResult.canGateOut
                ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                : 'bg-red-50 border-red-300 text-red-950'
            }`}>
              <div className="flex items-center gap-2.5 font-bold text-sm">
                <span className={`material-symbols-outlined text-xl ${verifyResult.canGateOut ? 'text-emerald-700' : 'text-red-700'}`}>
                  {verifyResult.canGateOut ? 'check_circle' : 'block'}
                </span>
                <span>{verifyResult.canGateOut ? 'ĐỦ ĐIỀU KIỆN RA CỔNG (LỆNH HỢP LỆ)' : 'BỊ TỪ CHỐI RA CỔNG (LỆNH KHÔNG HỢP LỆ)'}</span>
              </div>
              <p className="text-xs leading-relaxed font-medium">{verifyResult.reason}</p>
            </div>
          )}
        </div>
      )}

      {/* ── MODAL: GIA HẠN LỆNH eDO ── */}
      {showExtendModal && selectedEdoForExtend && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-chalk max-w-md w-full overflow-hidden animate-fadeIn">
            <div className="px-6 py-4 border-b border-chalk bg-fog flex items-center justify-between">
              <div>
                <h3 className="font-heading text-lg font-extrabold text-carbon">Gia hạn lệnh eDO</h3>
                <p className="text-xs text-slate mt-0.5">Lệnh: {selectedEdoForExtend.edoNumber}</p>
              </div>
              <button
                onClick={() => setShowExtendModal(false)}
                className="w-8 h-8 rounded-lg text-slate hover:bg-chalk flex items-center justify-center cursor-pointer font-bold text-lg"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveExtend} className="p-6 space-y-4 text-xs font-sans">
              <div>
                <label className="block text-[11px] font-bold text-carbon uppercase mb-1">Thời Gian Hiệu Lực Mới *</label>
                <input
                  type="text"
                  required
                  value={extendDate}
                  onChange={(e) => setExtendDate(e.target.value)}
                  className="w-full px-3 py-2 bg-fog border border-chalk rounded-xl font-mono text-carbon font-bold focus:outline-none focus:border-signal-orange focus:ring-0"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-carbon uppercase mb-1">
                  Lý Do Gia Hạn <span className="text-red-600">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  value={extendReason}
                  onChange={(e) => setExtendReason(e.target.value)}
                  placeholder="Ghi rõ lý do gia hạn (VD: Khách hàng đã nộp bổ sung cước lưu container)..."
                  className="w-full px-3 py-2 bg-fog border border-chalk rounded-xl text-carbon focus:outline-none focus:border-signal-orange focus:ring-0"
                />
              </div>

              <div className="pt-3 border-t border-chalk flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowExtendModal(false)}
                  className="px-4 py-2 bg-white border border-chalk text-carbon hover:bg-fog rounded-xl text-xs font-bold cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-signal-orange text-white hover:opacity-90 rounded-xl text-xs font-bold shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {saving ? 'Đang gia hạn...' : 'Xác Nhận Gia Hạn'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Modals */}
      <EdoIssueModal
        isOpen={showIssueModal}
        onClose={() => setShowIssueModal(false)}
        onSuccess={(createdEdo) => {
          setSuccessMsg('Đã phát hành lệnh giao hàng eDO thành công');
          loadData();
          if (createdEdo) {
            setPreviewEdo(createdEdo);
            setShowPreviewModal(true);
          }
        }}
      />

      <EdoPreviewModal
        isOpen={showPreviewModal}
        edoData={previewEdo}
        onClose={() => setShowPreviewModal(false)}
      />

    </div>
  );
}
