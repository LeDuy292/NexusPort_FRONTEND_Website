import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { shippingLineApi, formatApiErrorMessage } from './api/shippingLineApi';
import ShippingBadge from './components/ShippingBadge';
import EdoIssueModal from './components/EdoIssueModal';

export default function ShippingDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeVoyageFilter, setActiveVoyageFilter] = useState('ALL');

  // Modal
  const [showIssueModal, setShowIssueModal] = useState(false);

  // Quick Gate-out check widget
  const [quickContNo, setQuickContNo] = useState('EMCU5102949');
  const [quickCheckResult, setQuickCheckResult] = useState(null);
  const [checkingGate, setCheckingGate] = useState(false);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const res = await shippingLineApi.getDashboard();
      const payload = res?.kpis ? res : (res?.data || null);
      if (payload) {
        setData(payload);
      }
    } catch (err) {
      setError(formatApiErrorMessage(err, 'Không thể tải dữ liệu tổng quan'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const handleQuickGateCheck = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!quickContNo.trim()) return;
    setCheckingGate(true);
    setQuickCheckResult(null);
    try {
      const res = await fetch(`/api/shipping-line/gate-out/verify/${encodeURIComponent(quickContNo.trim().toUpperCase())}`);
      const json = await res.json();
      if (json?.data) {
        setQuickCheckResult(json.data);
      }
    } catch {
      setQuickCheckResult({ canGateOut: false, reason: 'Lỗi kết nối kiểm tra cổng' });
    } finally {
      setCheckingGate(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 w-full flex flex-col items-center justify-center min-h-[400px] gap-3 text-slate">
        <div className="w-8 h-8 border-2 border-signal-orange border-t-transparent rounded-full animate-spin"></div>
        <div className="text-xs font-bold uppercase tracking-wider">Đang tải dữ liệu tổng quan hãng tàu...</div>
      </div>
    );
  }

  const kpis = data?.kpis || {};
  const alerts = data?.alerts || [];
  const recentVoyages = data?.recentVoyages || [];

  const filteredVoyages = activeVoyageFilter === 'ALL'
    ? recentVoyages
    : recentVoyages.filter(v => v.status === activeVoyageFilter);

  return (
    <div className="p-6 md:p-8 w-full font-sans flex flex-col gap-6 bg-slate-50 min-h-screen">

      {/* ── 1. HEADER CHUẨN NEXUSPORT ── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white border border-chalk rounded-2xl p-5 shadow-sm gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-extrabold bg-orange-100 text-orange-800 px-3 py-0.5 rounded-full uppercase">
              KHÔNG GIAN DOANH NGHIỆP HÃNG TÀU
            </span>
            <span className="text-xs font-mono text-slate">NexusPort · Cảng Tiên Sa, Đà Nẵng (VNDAD)</span>
          </div>
          <h2 className="font-heading text-2xl md:text-3xl font-extrabold text-carbon">
            Tổng Quan Hoạt Động Hãng Tàu
          </h2>
          <p className="text-xs text-slate mt-0.5">
            Giám sát thời gian thực chuỗi tác nghiệp: Tàu ghé cảng &rarr; Bản khai Manifest &rarr; Vận đơn B/L &rarr; Phát hành lệnh giao hàng điện tử (eDO).
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setShowIssueModal(true)}
            className="px-4 py-2 text-xs font-bold text-white bg-signal-orange hover:opacity-90 rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <span className="material-symbols-outlined text-base">assignment_turned_in</span>
            Cấp Lệnh eDO
          </button>

          <button
            onClick={loadDashboard}
            title="Tải lại dữ liệu"
            className="w-9 h-9 bg-white border border-chalk rounded-xl flex items-center justify-center text-slate hover:text-carbon hover:bg-fog shadow-sm transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-lg">refresh</span>
          </button>
        </div>
      </div>

      {/* ── 2. KPI CARDS (6 Card chuẩn NexusPort) ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        
        {/* Card 1: Chuyến Tàu Hoạt Động */}
        <div className="bg-white rounded-2xl border border-chalk p-4 shadow-sm space-y-1">
          <span className="text-[10px] font-bold text-slate uppercase tracking-wider">Chuyến Tàu Hoạt Động</span>
          <div className="text-3xl font-extrabold text-carbon font-mono">
            {kpis.activeVoyages || 0} <span className="text-xs font-normal text-slate font-sans">/ {kpis.totalVessels || 0} tàu</span>
          </div>
          <span className="text-[11px] text-blue-700 font-bold">Cập bến &amp; hành trình</span>
        </div>

        {/* Card 2: Container Khai Báo */}
        <div className="bg-white rounded-2xl border border-chalk p-4 shadow-sm space-y-1">
          <span className="text-[10px] font-bold text-slate uppercase tracking-wider">Container Khai Báo</span>
          <div className="text-3xl font-extrabold text-carbon font-mono">
            {kpis.totalContainers || 0}
          </div>
          <span className="text-[11px] text-emerald-700 font-bold">Thuộc các bản khai</span>
        </div>

        {/* Card 3: Bản Khai Manifest */}
        <div className="bg-white rounded-2xl border border-chalk p-4 shadow-sm space-y-1">
          <span className="text-[10px] font-bold text-slate uppercase tracking-wider">Bản Khai Manifest</span>
          <div className="text-3xl font-extrabold text-carbon font-mono">
            {kpis.totalManifests || 0}
          </div>
          <span className="text-[11px] text-purple-700 font-bold">Xuất / Nhập khẩu</span>
        </div>

        {/* Card 4: Vận Đơn B/L */}
        <div className="bg-white rounded-2xl border border-chalk p-4 shadow-sm space-y-1">
          <span className="text-[10px] font-bold text-slate uppercase tracking-wider">Vận Đơn (B/L)</span>
          <div className="text-3xl font-extrabold text-carbon font-mono">
            {kpis.totalBillsOfLading || 0}
          </div>
          <span className="text-[11px] text-slate font-bold">Quản lý lô hàng</span>
        </div>

        {/* Card 5: eDO Đã Phát Hành */}
        <div className="bg-white rounded-2xl border border-chalk p-4 shadow-sm space-y-1">
          <span className="text-[10px] font-bold text-slate uppercase tracking-wider">eDO Đã Phát Hành</span>
          <div className="text-3xl font-extrabold text-carbon font-mono">
            {kpis.issuedEdos || 0}
          </div>
          <span className="text-[11px] text-emerald-700 font-bold">Có hiệu lực giao hàng</span>
        </div>

        {/* Card 6: eDO Đã Hết Hạn */}
        <div className={`bg-white rounded-2xl border p-4 shadow-sm space-y-1 ${
          (kpis.expiredEdos || 0) > 0 ? 'border-amber-300 bg-amber-50/30' : 'border-chalk'
        }`}>
          <span className="text-[10px] font-bold text-amber-900 uppercase tracking-wider">eDO Đã Hết Hạn</span>
          <div className="text-3xl font-extrabold text-amber-600 font-mono">
            {kpis.expiredEdos || 0}
          </div>
          <span className="text-[11px] text-amber-800 font-bold">Cần gia hạn để lấy hàng</span>
        </div>

      </div>

      {/* ── 3. KHÔNG GIAN TÁC NGHIỆP CHÍNH (Bố cục 8 - 4) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* ── CỘT TRÁI (8/12): LỊCH TRÌNH CHUYẾN TÀU & NHẬT KÝ VẬN HÀNH ── */}
        <div className="lg:col-span-8 flex flex-col gap-6">

          {/* Card Bảng Lịch Trình Chuyến Tàu */}
          <div className="bg-white border border-chalk rounded-2xl p-6 shadow-sm space-y-4">
            
            {/* Header Toolbar */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-chalk pb-3">
              <div>
                <h3 className="font-heading text-lg font-extrabold text-carbon flex items-center gap-2">
                  <span className="material-symbols-outlined text-signal-orange text-xl">directions_boat</span>
                  Lịch Trình Chuyến Tàu &amp; Hạn Chót Hạ Bãi
                </h3>
                <p className="text-xs text-slate font-mono mt-0.5">
                  Theo dõi mốc hạn chót hạ bãi (CY Cut-off), nộp VGM và tiến độ làm hàng tại cầu bến
                </p>
              </div>

              {/* Filter Tabs */}
              <div className="flex bg-fog p-1 rounded-xl border border-chalk text-xs font-bold">
                <button
                  onClick={() => setActiveVoyageFilter('ALL')}
                  className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                    activeVoyageFilter === 'ALL' ? 'bg-carbon text-white shadow-sm' : 'text-slate hover:text-carbon'
                  }`}
                >
                  Tất cả ({recentVoyages.length})
                </button>
                <button
                  onClick={() => setActiveVoyageFilter('BERTHED')}
                  className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                    activeVoyageFilter === 'BERTHED' ? 'bg-carbon text-white shadow-sm' : 'text-slate hover:text-carbon'
                  }`}
                >
                  Cập bến
                </button>
                <button
                  onClick={() => setActiveVoyageFilter('IN_TRANSIT')}
                  className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                    activeVoyageFilter === 'IN_TRANSIT' ? 'bg-carbon text-white shadow-sm' : 'text-slate hover:text-carbon'
                  }`}
                >
                  Hành trình
                </button>
                <button
                  onClick={() => setActiveVoyageFilter('OPERATING')}
                  className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                    activeVoyageFilter === 'OPERATING' ? 'bg-carbon text-white shadow-sm' : 'text-slate hover:text-carbon'
                  }`}
                >
                  Làm hàng
                </button>
              </div>
            </div>

            {/* Bảng Dữ Liệu Chuyến Tàu */}
            {filteredVoyages.length === 0 ? (
              <div className="p-8 text-center text-slate text-xs italic">
                Không tìm thấy chuyến tàu nào phù hợp với bộ lọc
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-fog text-slate font-bold uppercase text-[10px] border-b border-chalk">
                      <th className="py-3 px-3">Mã Chuyến</th>
                      <th className="py-3 px-3">Tên Tàu</th>
                      <th className="py-3 px-3">Cảng Bốc &rarr; Cảng Dỡ</th>
                      <th className="py-3 px-3">Hạn Hạ Bãi (CY)</th>
                      <th className="py-3 px-3">Hạn Nộp VGM</th>
                      <th className="py-3 px-3">Trạng Thái</th>
                      <th className="py-3 px-3 text-right">Chi Tiết</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-chalk font-medium font-mono">
                    {filteredVoyages.map((voy) => (
                      <tr key={voy.id} className="hover:bg-fog/60 transition-colors">
                        <td className="py-3.5 px-3 font-bold text-carbon">{voy.voyageNumber}</td>
                        <td className="py-3.5 px-3 font-sans font-bold text-carbon">{voy.vesselName}</td>
                        <td className="py-3.5 px-3 font-sans text-slate text-[11px]">
                          <div><strong className="text-carbon">{voy.pol.split('(')[0]}</strong> &rarr; {voy.pod.split('(')[0]}</div>
                          <span className="text-[10px] text-slate font-mono">{voy.terminal}</span>
                        </td>
                        <td className="py-3.5 px-3 text-amber-700 font-bold">{voy.cyCutOff}</td>
                        <td className="py-3.5 px-3 text-slate">{voy.vgmCutOff}</td>
                        <td className="py-3.5 px-3 font-sans">
                          <ShippingBadge status={voy.status} />
                        </td>
                        <td className="py-3.5 px-3 text-right font-sans">
                          <button
                            onClick={() => navigate('/shipping-line/voyages')}
                            className="px-2.5 py-1 text-[11px] font-bold text-carbon bg-fog hover:bg-chalk border border-chalk rounded-lg transition-colors cursor-pointer"
                          >
                            Xem lịch &rarr;
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex justify-between items-center pt-2 border-t border-chalk text-xs">
              <span className="text-slate font-mono">Hiển thị {filteredVoyages.length} chuyến tàu tiêu biểu</span>
              <button
                onClick={() => navigate('/shipping-line/voyages')}
                className="text-xs font-bold text-signal-orange hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>Xem toàn bộ lịch trình chuyến tàu</span>
                <span className="material-symbols-outlined text-sm">arrow_forward</span>
              </button>
            </div>

          </div>

        </div>

        {/* ── CỘT PHẢI (4/12): SỰ VỤ CẦN XỬ LÝ & ĐỐI CHIẾU CỔNG RA ── */}
        <div className="lg:col-span-4 flex flex-col gap-6">

          {/* 1. SỰ VỤ & CẢNH BÁO TỒN ĐỌNG */}
          <div className="bg-white border border-chalk rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex justify-between items-center border-b border-chalk pb-3">
              <h3 className="font-heading text-base font-extrabold text-carbon flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-600 text-xl">notification_important</span>
                Sự Vụ Cần Xử Lý ({alerts.length})
              </h3>
            </div>

            <div className="space-y-3">
              {alerts.length === 0 ? (
                <div className="p-6 text-center text-slate text-xs italic">
                  Không có sự vụ tồn đọng cần xử lý
                </div>
              ) : (
                alerts.map((al) => (
                  <div
                    key={al.id}
                    onClick={() => navigate(al.targetPath)}
                    className={`p-3.5 rounded-xl border text-xs cursor-pointer transition-all hover:shadow-xs ${
                      al.type === 'ERROR'
                        ? 'bg-rose-50 border-rose-200 text-rose-950'
                        : al.type === 'WARNING'
                        ? 'bg-amber-50 border-amber-200 text-amber-950'
                        : 'bg-fog border-chalk text-carbon'
                    }`}
                  >
                    <div className="font-bold text-xs mb-1 flex items-center justify-between">
                      <span>{al.title}</span>
                      <span className="material-symbols-outlined text-sm">open_in_new</span>
                    </div>
                    <div className="text-[11px] opacity-90 leading-relaxed">{al.description}</div>
                    <div className="mt-2 text-[10px] font-bold text-signal-orange flex items-center gap-1">
                      Xử lý ngay &rarr;
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 2. CÔNG CỤ TRA CỨU ĐIỀU KIỆN GATE OUT TỨC THÌ */}
          <div className="bg-white border border-chalk rounded-2xl p-6 shadow-sm space-y-4">
            <div className="border-b border-chalk pb-3">
              <h3 className="font-heading text-base font-extrabold text-carbon flex items-center gap-2">
                <span className="material-symbols-outlined text-signal-orange text-xl">fact_check</span>
                Đối Chiếu Cổng Cảng Ra
              </h3>
              <p className="text-xs text-slate mt-0.5">Kiểm tra tức thì tính hợp lệ của lệnh eDO khi xe nhận container</p>
            </div>

            <form onSubmit={handleQuickGateCheck} className="space-y-3">
              <label className="block text-[11px] font-bold text-carbon uppercase">Số Container Cần Đối Chiếu</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={quickContNo}
                  onChange={(e) => setQuickContNo(e.target.value.toUpperCase())}
                  placeholder="VD: EMCU5102949..."
                  className="flex-1 px-3 py-2 bg-fog border border-chalk rounded-xl text-xs font-mono font-bold text-carbon focus:outline-none focus:border-signal-orange focus:ring-0 uppercase"
                />
                <button
                  type="submit"
                  disabled={checkingGate}
                  className="px-4 py-2 text-xs font-bold text-white bg-carbon hover:bg-black disabled:bg-slate rounded-xl transition-colors flex items-center gap-1 cursor-pointer"
                >
                  {checkingGate ? '...' : 'Kiểm tra'}
                </button>
              </div>

              {/* Gợi ý container mẫu để test nhanh */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[10px] text-slate font-bold uppercase">Mẫu test:</span>
                <button
                  type="button"
                  onClick={() => { setQuickContNo('EMCU5102949'); setQuickCheckResult(null); }}
                  className="px-2 py-0.5 text-[10px] font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded hover:bg-emerald-100 cursor-pointer"
                  title="eDO Hợp lệ, sẵn sàng ra cổng"
                >
                  EMCU5102949 (Hợp lệ)
                </button>
                <button
                  type="button"
                  onClick={() => { setQuickContNo('MSKU7712907'); setQuickCheckResult(null); }}
                  className="px-2 py-0.5 text-[10px] font-mono font-bold bg-amber-50 text-amber-700 border border-amber-200 rounded hover:bg-amber-100 cursor-pointer"
                  title="eDO đã hết hạn"
                >
                  MSKU7712907 (Hết hạn)
                </button>
                <button
                  type="button"
                  onClick={() => { setQuickContNo('EMCU9284712'); setQuickCheckResult(null); }}
                  className="px-2 py-0.5 text-[10px] font-mono font-bold bg-fog text-slate border border-chalk rounded hover:bg-chalk cursor-pointer"
                  title="Chưa cấp lệnh eDO"
                >
                  EMCU9284712 (Chưa cấp eDO)
                </button>
              </div>
            </form>

            {quickCheckResult && (
              <div className={`p-4 rounded-xl border text-xs space-y-2 ${
                quickCheckResult.canGateOut
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                  : 'bg-red-50 border-red-200 text-red-950'
              }`}>
                <div className="flex items-center gap-2 font-bold text-xs">
                  <span className={`material-symbols-outlined text-base ${quickCheckResult.canGateOut ? 'text-emerald-700' : 'text-red-700'}`}>
                    {quickCheckResult.canGateOut ? 'check_circle' : 'cancel'}
                  </span>
                  <span>{quickCheckResult.canGateOut ? 'ĐỦ ĐIỀU KIỆN RA CỔNG' : 'BỊ CHẶN RA CỔNG'}</span>
                </div>
                <p className="text-[11px] leading-relaxed">{quickCheckResult.reason}</p>
              </div>
            )}
          </div>

          {/* 3. QUY TRÌNH LIÊN KẾT NHANH */}
          <div className="bg-white border border-chalk rounded-2xl p-6 shadow-sm space-y-3">
            <h3 className="font-heading text-sm font-extrabold text-carbon uppercase tracking-wider flex items-center gap-2">
              <span className="material-symbols-outlined text-signal-orange text-lg">alt_route</span>
              Lối Tắt Nghiệp Vụ Hãng Tàu
            </h3>
            <div className="space-y-2 text-xs">
              <button
                onClick={() => navigate('/shipping-line/voyages')}
                className="w-full text-left p-2.5 rounded-xl bg-fog hover:bg-chalk border border-chalk flex items-center justify-between text-carbon font-bold transition-colors cursor-pointer"
              >
                <span>1. Lịch Tàu &amp; Hạn Chót</span>
                <span className="material-symbols-outlined text-sm text-slate">arrow_forward</span>
              </button>
              <button
                onClick={() => navigate('/shipping-line/manifest')}
                className="w-full text-left p-2.5 rounded-xl bg-fog hover:bg-chalk border border-chalk flex items-center justify-between text-carbon font-bold transition-colors cursor-pointer"
              >
                <span>2. Bản Khai Hàng Hóa Manifest</span>
                <span className="material-symbols-outlined text-sm text-slate">arrow_forward</span>
              </button>
              <button
                onClick={() => navigate('/shipping-line/bills-of-lading')}
                className="w-full text-left p-2.5 rounded-xl bg-fog hover:bg-chalk border border-chalk flex items-center justify-between text-carbon font-bold transition-colors cursor-pointer"
              >
                <span>3. Quản Lý Vận Đơn B/L</span>
                <span className="material-symbols-outlined text-sm text-slate">arrow_forward</span>
              </button>
              <button
                onClick={() => navigate('/shipping-line/delivery-orders')}
                className="w-full text-left p-2.5 rounded-xl bg-fog hover:bg-chalk border border-chalk flex items-center justify-between text-carbon font-bold transition-colors cursor-pointer"
              >
                <span>4. Lệnh Giao Hàng Điện Tử (eDO)</span>
                <span className="material-symbols-outlined text-sm text-slate">arrow_forward</span>
              </button>
            </div>
          </div>

        </div>

      </div>

      {/* Quick Edo Issue Modal */}
      <EdoIssueModal
        isOpen={showIssueModal}
        onClose={() => setShowIssueModal(false)}
        onSuccess={() => {
          loadDashboard();
        }}
      />

    </div>
  );
}
