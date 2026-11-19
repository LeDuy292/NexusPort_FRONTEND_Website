import React, { useState, useEffect } from 'react';
import { shippingLineApi, formatApiErrorMessage } from './api/shippingLineApi';
import ShippingBadge from './components/ShippingBadge';
import ShippingPagination from './components/ShippingPagination';
import { manifestPortSyncService } from '../../services/manifestPortSyncService';
import { buildVoyageNumber } from './utils/voyageNumber';

const TIEN_SA_PORT = 'Cảng Tiên Sa, Đà Nẵng (VNDAD)';

const STANDARD_PORTS = [
  'Tokyo, Nhật Bản (JPTYO)',
  'Yokohama, Nhật Bản (JPYOK)',
  'Osaka, Nhật Bản (JPOSA)',
  'Busan, Hàn Quốc (KRPUS)',
  'Incheon, Hàn Quốc (KRINC)',
  'Thượng Hải, Trung Quốc (CNSHA)',
  'Ninh Ba, Trung Quốc (CNNGB)',
  'Singapore (SGSIN)',
  'Tanjung Pelepas, Malaysia (MYTPP)',
  'Port Klang, Malaysia (MYPKG)',
  'Laem Chabang, Thái Lan (THLCH)',
  'Los Angeles, Hoa Kỳ (USLAX)',
  'Long Beach, Hoa Kỳ (USLGB)',
  'Rotterdam, Hà Lan (NLRTM)',
  'Hamburg, Đức (DEHAM)',
  'Hải Phòng (VNHPH)',
  'Cái Mép, Bà Rịa - Vũng Tàu (VNCMT)',
  'Quy Nhơn, Bình Định (VNUIH)',
];

const TIEN_SA_TERMINALS = [
  'Bến số 1 (TS-01) - Cảng Tiên Sa',
  'Bến số 2 (TS-02) - Cảng Tiên Sa',
  'Bến số 3 (TS-03) - Cảng Tiên Sa',
  'Bến số 4 (TS-04) - Cảng Tiên Sa',
];

const VOYAGE_STATUS_STYLES = {
  SCHEDULED: 'bg-slate-100 text-slate-700 border-slate-300',
  IN_TRANSIT: 'bg-blue-50 text-blue-700 border-blue-300',
  BERTHED: 'bg-emerald-50 text-emerald-700 border-emerald-300',
  OPERATING: 'bg-indigo-50 text-indigo-700 border-indigo-300',
  DEPARTED: 'bg-slate-100 text-slate-600 border-slate-300',
  COMPLETED: 'bg-emerald-50 text-emerald-800 border-emerald-300',
};

// Helpers for DateTime conversion
function toLocalDatetimeInput(dateStr) {
  if (!dateStr) return '';
  return dateStr.replace(' ', 'T').slice(0, 16);
}

function fromLocalDatetimeInput(inputVal) {
  if (!inputVal) return '';
  return inputVal.replace('T', ' ').slice(0, 16);
}

// ETA mặc định: 3 ngày sau, 08:00 (giờ máy), để các hạn chót tính ra luôn ở tương lai
function defaultEta() {
  const d = new Date();
  d.setDate(d.getDate() + 3);
  d.setHours(8, 0, 0, 0);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} 08:00`;
}

// Kiểm tra thứ tự mốc: VGM ≤ hạ bãi (CY) < ETD, ETA < ETD, hạn chót chưa qua
function voyageTimeError(form) {
  const at = (v) => (v ? new Date(String(v).replace(' ', 'T')) : null);
  const [eta, etd, cy, vgm] = [at(form.eta), at(form.etd), at(form.cyCutOff), at(form.vgmCutOff)];
  if (![eta, etd, cy, vgm].every((d) => d && !isNaN(d.getTime()))) return 'Cần nhập đủ ETA, ETD, hạn chót hạ bãi và hạn chót nộp VGM.';
  if (cy <= new Date() || vgm <= new Date()) return 'Hạn chót hạ bãi và hạn chót nộp VGM phải ở thời điểm sau hiện tại.';
  if (vgm > cy) return 'Hạn chót nộp VGM không được sau hạn chót hạ bãi.';
  if (cy >= etd) return 'Hạn chót hạ bãi phải trước giờ tàu rời cảng (ETD).';
  if (eta >= etd) return 'Giờ tàu đến (ETA) phải trước giờ tàu rời cảng (ETD).';
  return '';
}

function calculateCutoffsFromEta(etaDateTimeStr) {
  if (!etaDateTimeStr) return null;
  const d = new Date(etaDateTimeStr.includes('T') ? etaDateTimeStr : etaDateTimeStr.replace(' ', 'T'));
  if (isNaN(d.getTime())) return null;

  const etdDate = new Date(d.getTime() + 28 * 3600 * 1000);
  const cyDate = new Date(d.getTime() - 12 * 3600 * 1000);
  const vgmDate = new Date(d.getTime() - 20 * 3600 * 1000);

  const format = (dt) => {
    const yr = dt.getFullYear();
    const mo = String(dt.getMonth() + 1).padStart(2, '0');
    const da = String(dt.getDate()).padStart(2, '0');
    const hr = String(dt.getHours()).padStart(2, '0');
    const mi = String(dt.getMinutes()).padStart(2, '0');
    return `${yr}-${mo}-${da} ${hr}:${mi}`;
  };

  return {
    etd: format(etdDate),
    cyCutOff: format(cyDate),
    vgmCutOff: format(vgmDate),
  };
}

export default function VesselVoyagePage() {
  const [activeTab, setActiveTab] = useState('VOYAGES'); // VOYAGES, VESSELS
  const [voyages, setVoyages] = useState([]);
  const [vessels, setVessels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [vesselSearch, setVesselSearch] = useState('');
  
  // Phân trang
  const [voyagePage, setVoyagePage] = useState(1);
  const [voyagePageSize, setVoyagePageSize] = useState(5);
  const [vesselPage, setVesselPage] = useState(1);
  const [vesselPageSize, setVesselPageSize] = useState(5);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Thêm tàu mới vào danh mục đội tàu
  const emptyVessel = { vesselName: '', imoNumber: '', callSign: '', flag: '', vesselType: 'Container Ship', capacityTeu: '' };
  const [showVesselModal, setShowVesselModal] = useState(false);
  const [vesselForm, setVesselForm] = useState(emptyVessel);
  const [vesselError, setVesselError] = useState('');
  const [savingVessel, setSavingVessel] = useState(false);

  const handleCreateVessel = async (event) => {
    event.preventDefault();
    setSavingVessel(true);
    setVesselError('');
    try {
      await shippingLineApi.createVessel({ ...vesselForm, capacityTeu: Number(vesselForm.capacityTeu) });
      setShowVesselModal(false);
      setVesselForm(emptyVessel);
      await loadData();
    } catch (err) {
      setVesselError(formatApiErrorMessage(err));
    } finally {
      setSavingVessel(false);
    }
  };
  
  // Route selection in create modal
  const [routeType, setRouteType] = useState('OUTBOUND'); // OUTBOUND (Tiên Sa -> Cảng ngoài), INBOUND (Cảng ngoài -> Tiên Sa)
  const [createForm, setCreateForm] = useState({
    voyageNumber: '',
    vesselId: '',
    pol: TIEN_SA_PORT,
    pod: 'Tokyo, Nhật Bản (JPTYO)',
    eta: defaultEta(),
    ...calculateCutoffsFromEta(defaultEta()),
    terminal: TIEN_SA_TERMINALS[0],
    remarks: '',
  });

  const [saving, setSaving] = useState(false);
  const [updatingVoyageId, setUpdatingVoyageId] = useState(null);
  const [error, setError] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const [vesselsRes, voyagesRes] = await Promise.all([
        shippingLineApi.getVessels(),
        shippingLineApi.getVoyages({ search, status: statusFilter }),
      ]);
      const vList = Array.isArray(vesselsRes) ? vesselsRes : (vesselsRes?.data || []);
      const voyList = Array.isArray(voyagesRes) ? voyagesRes : (voyagesRes?.data || []);
      setVessels(vList);
      setVoyages(voyList);
      // Đồng bộ ngay lập tức sang phân hệ Điều Độ Cảng (Cảng Tiên Sa)
      manifestPortSyncService.syncVoyages(voyList);
    } catch (err) {
      setError(formatApiErrorMessage(err, 'Lỗi tải dữ liệu chuyến tàu'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const handleVoyageUpdate = (e) => {
      const detail = e?.detail;
      if (!detail) return;
      if (detail.voyages) {
        setVoyages(detail.voyages);
      } else if (detail.voyageNumber && detail.vesselStatus) {
        setVoyages(prev => prev.map(v =>
          (v.voyageNumber || '').trim().toUpperCase() === detail.voyageNumber.trim().toUpperCase()
            ? { ...v, status: detail.vesselStatus }
            : v
        ));
      }
    };
    window.addEventListener('nexusport:voyage_status_updated', handleVoyageUpdate);
    return () => {
      window.removeEventListener('nexusport:voyage_status_updated', handleVoyageUpdate);
    };
  }, []);

  useEffect(() => {
    setVoyagePage(1);
    loadData();
  }, [search, statusFilter]);

  useEffect(() => {
    setVesselPage(1);
  }, [vesselSearch]);

  // Helper sinh mã chuyến tàu tự động theo tàu biển
  // Theo quy tắc chung: {tiền tố tàu}{năm ETA}{STT}{X xuất | N nhập}, không dựa vào số lượng chuyến
  const generateVoyageNumber = (targetVesselId, form = createForm) => {
    const vId = targetVesselId || form.vesselId || vessels[0]?.id;
    const v = vessels.find(item => item.id === vId);
    if (!v) return '';
    return buildVoyageNumber({
      vesselName: v.vesselName, eta: form.eta, pol: form.pol, pod: form.pod,
      taken: (voyages || []).map(item => item.voyageNumber),
    });
  };

  // Cập nhật nhanh trạng thái chuyến tàu (SCHEDULED -> IN_TRANSIT -> BERTHED -> OPERATING -> DEPARTED -> COMPLETED)
  const handleUpdateStatus = async (voyageId, newStatus) => {
    try {
      setUpdatingVoyageId(voyageId);
      await shippingLineApi.updateVoyage(voyageId, { status: newStatus });
      setVoyages(prev => prev.map(v => v.id === voyageId ? { ...v, status: newStatus } : v));

      // Đồng bộ trạng thái chuyến tàu sang Cảng Tiên Sa
      const targetVoy = voyages.find(v => v.id === voyageId);
      if (targetVoy?.voyageNumber) {
        manifestPortSyncService.updateManifestVesselStatusByVoyage(targetVoy.voyageNumber, newStatus);
      }
    } catch (err) {
      setError(formatApiErrorMessage(err, 'Lỗi cập nhật trạng thái chuyến tàu'));
    } finally {
      setUpdatingVoyageId(null);
    }
  };

  // Mở modal tạo chuyến tàu mới (Tự động sinh mã chuyến & tự động tính mốc ngày giờ)
  const handleOpenCreateForVessel = (vesselId) => {
    const targetVesselId = vesselId || vessels[0]?.id || '';
    const autoVoyageNo = generateVoyageNumber(targetVesselId);
    const initialEta = defaultEta();
    const calculated = calculateCutoffsFromEta(initialEta);

    setRouteType('OUTBOUND');
    setCreateForm({
      voyageNumber: autoVoyageNo,
      vesselId: targetVesselId,
      pol: TIEN_SA_PORT,
      pod: 'Tokyo, Nhật Bản (JPTYO)',
      eta: initialEta,
      etd: calculated?.etd || '',
      cyCutOff: calculated?.cyCutOff || '',
      vgmCutOff: calculated?.vgmCutOff || '',
      terminal: TIEN_SA_TERMINALS[0],
      remarks: 'Chuyến tàu làm hàng container tại Cảng Tiên Sa',
    });
    setShowCreateModal(true);
  };

  // Cập nhật khi đổi tàu
  const handleVesselChange = (newVesselId) => {
    const newVoyageNo = generateVoyageNumber(newVesselId);
    setCreateForm(prev => ({
      ...prev,
      vesselId: newVesselId,
      voyageNumber: newVoyageNo,
    }));
  };

  // Cập nhật khi đổi hướng tuyến (Xuất khẩu / Nhập khẩu)
  const handleRouteChange = (newRoute) => {
    setRouteType(newRoute);
    if (newRoute === 'OUTBOUND') {
      setCreateForm(prev => ({
        ...prev,
        pol: TIEN_SA_PORT,
        pod: prev.pod === TIEN_SA_PORT ? 'Tokyo, Nhật Bản (JPTYO)' : prev.pod,
      }));
    } else {
      setCreateForm(prev => ({
        ...prev,
        pol: prev.pol === TIEN_SA_PORT ? 'Tokyo, Nhật Bản (JPTYO)' : prev.pol,
        pod: TIEN_SA_PORT,
      }));
    }
  };

  // Tự động tính ETD, CY Cut-Off, VGM Cut-off khi chọn ETA
  const handleEtaChange = (newEtaInputVal) => {
    const formattedEta = fromLocalDatetimeInput(newEtaInputVal);
    const calculated = calculateCutoffsFromEta(formattedEta);
    if (calculated) {
      setCreateForm(prev => ({
        ...prev,
        eta: formattedEta,
        etd: calculated.etd,
        cyCutOff: calculated.cyCutOff,
        vgmCutOff: calculated.vgmCutOff,
      }));
    } else {
      setCreateForm(prev => ({ ...prev, eta: formattedEta }));
    }
  };

  const handleCreateVoyage = async (e) => {
    e.preventDefault();
    const effectiveVesselId = createForm.vesselId || vessels[0]?.id;
    if (!effectiveVesselId) {
      setError('Vui lòng chọn Tàu biển');
      return;
    }
    const timeError = voyageTimeError(createForm);
    if (timeError) {
      setError(timeError);
      return;
    }
    setSaving(true);
    setError('');

    try {
      await shippingLineApi.createVoyage({
        ...createForm,
        vesselId: effectiveVesselId,
        // Sinh lại theo dữ liệu cuối cùng trên form (tàu, ETA, chiều tuyến); backend kiểm tra trùng lần cuối
        voyageNumber: generateVoyageNumber(effectiveVesselId, createForm),
      });
      setShowCreateModal(false);
      loadData();
    } catch (err) {
      setError(formatApiErrorMessage(err, 'Lỗi tạo chuyến tàu'));
    } finally {
      setSaving(false);
    }
  };

  const filteredVessels = vessels.filter((ves) => {
    if (!vesselSearch.trim()) return true;
    const q = vesselSearch.toLowerCase();
    return (
      (ves.vesselName && ves.vesselName.toLowerCase().includes(q)) ||
      (ves.imoNumber && ves.imoNumber.toLowerCase().includes(q)) ||
      (ves.callSign && ves.callSign.toLowerCase().includes(q)) ||
      (ves.flag && ves.flag.toLowerCase().includes(q))
    );
  });

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
            Quản lý tàu &amp; chuyến tàu
          </h2>
          <p className="text-xs text-slate mt-0.5">
            Theo dõi hành trình, kế hoạch cập cảng Tiên Sa và các mốc hạn chót giao nhận theo thời gian thực.
          </p>
        </div>

        {/* Action Controls - Luôn Cố Định, Không Bị Mất Khi Đổi Tab */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => { setVesselForm(emptyVessel); setVesselError(''); setShowVesselModal(true); }}
            className="px-4 py-2 text-xs font-bold text-white bg-carbon hover:bg-graphite rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <span className="material-symbols-outlined text-base">directions_boat</span>
            Thêm tàu
          </button>

          <button
            onClick={() => handleOpenCreateForVessel(vessels[0]?.id || '')}
            className="px-4 py-2 text-xs font-bold text-white bg-signal-orange hover:opacity-90 rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <span className="material-symbols-outlined text-base">add</span>
            Tạo chuyến tàu mới
          </button>

          <button
            onClick={loadData}
            title="Tải lại dữ liệu"
            className="w-9 h-9 bg-white border border-chalk rounded-xl flex items-center justify-center text-slate hover:text-carbon hover:bg-fog shadow-sm transition-colors cursor-pointer"
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

      {/* ── 2. SUB-TOOLBAR: TAB CHUYỂN ĐỔI & BỘ LỌC TÌM KIẾM ── */}
      <div className="bg-white border border-chalk rounded-2xl p-4 shadow-sm flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4 text-xs">
        
        {/* Tab Pills */}
        <div className="flex bg-fog p-1 rounded-xl border border-chalk text-xs font-bold shrink-0">
          <button
            onClick={() => setActiveTab('VOYAGES')}
            className={`px-4 py-2 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'VOYAGES'
                ? 'bg-carbon text-white shadow-sm'
                : 'text-slate hover:text-carbon'
            }`}
          >
            <span className="material-symbols-outlined text-base">directions_boat</span>
            <span>Chuyến Tàu ({voyages.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('VESSELS')}
            className={`px-4 py-2 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'VESSELS'
                ? 'bg-carbon text-white shadow-sm'
                : 'text-slate hover:text-carbon'
            }`}
          >
            <span className="material-symbols-outlined text-base">anchor</span>
            <span>Danh Mục Tàu ({vessels.length})</span>
          </button>
        </div>

        {/* Filter Inputs tương ứng từng Tab */}
        {activeTab === 'VOYAGES' ? (
          <div className="flex flex-col sm:flex-row items-center gap-3 flex-1 justify-end">
            <div className="relative w-full sm:w-80">
              <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate text-base">search</span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm mã chuyến tàu, tên tàu, cảng..."
                className="w-full pl-9 pr-4 py-2 bg-fog border border-chalk rounded-xl text-xs font-medium text-carbon focus:outline-none focus:border-signal-orange focus:ring-0"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto font-bold shrink-0">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full sm:w-auto px-3.5 py-2 bg-fog border border-chalk rounded-xl text-xs font-bold text-carbon focus:outline-none focus:border-signal-orange focus:ring-0"
              >
                <option value="">Đang hoạt động (ẩn chuyến đã xong)</option>
                <option value="SCHEDULED">Kế hoạch</option>
                <option value="IN_TRANSIT">Đang hành trình</option>
                <option value="BERTHED">Đã cập cảng</option>
                <option value="OPERATING">Đang làm hàng</option>
                <option value="DEPARTED">Đã rời cảng</option>
                <option value="COMPLETED">Hoàn tất</option>
              </select>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 flex-1 justify-end">
            <div className="relative w-full sm:w-80">
              <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate text-base">search</span>
              <input
                type="text"
                value={vesselSearch}
                onChange={(e) => setVesselSearch(e.target.value)}
                placeholder="Tìm theo tên tàu, số IMO, hô hiệu, quốc tịch..."
                className="w-full pl-9 pr-4 py-2 bg-fog border border-chalk rounded-xl text-xs font-medium text-carbon focus:outline-none focus:border-signal-orange focus:ring-0"
              />
            </div>
          </div>
        )}

      </div>

      {/* ── 3. DATA TABLES ── */}
      {activeTab === 'VOYAGES' ? (
        <div className="bg-white border border-chalk rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex justify-between items-center border-b border-chalk pb-3">
            <div>
              <h3 className="font-heading text-lg font-extrabold text-carbon">
                Danh sách chuyến tàu vận chuyển hàng hải
              </h3>
              <p className="text-xs text-slate font-mono mt-0.5">
                Hiển thị {voyages.length} chuyến tàu phục vụ tại Cảng Tiên Sa &amp; các tuyến liên kết
              </p>
            </div>
            <span className="text-xs text-slate font-mono font-bold">Cập nhật lúc: vừa xong</span>
          </div>

          {voyages.length === 0 ? (
            <div className="p-12 text-center text-slate space-y-2 font-sans">
              <span className="material-symbols-outlined text-4xl text-slate">directions_boat</span>
              <p className="font-bold text-sm">Không tìm thấy chuyến tàu nào phù hợp với bộ lọc!</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1050px] text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-fog text-slate font-bold uppercase text-[10px] border-b border-chalk">
                    <th className="py-3 px-3">Mã chuyến</th>
                    <th className="py-3 px-3">Tên tàu</th>
                    <th className="py-3 px-3">Cảng bốc &rarr; Cảng dỡ</th>
                    <th className="py-3 px-3">Kế hoạch đến / đi</th>
                    <th className="py-3 px-3">Hạn chót hạ bãi</th>
                    <th className="py-3 px-3">Hạn chót nộp VGM</th>
                    <th className="py-3 px-3">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-chalk font-medium font-mono">
                  {voyages.slice((voyagePage - 1) * voyagePageSize, voyagePage * voyagePageSize).map((voy) => (
                    <tr key={voy.id} className="hover:bg-fog/60 transition-colors">
                      <td className="py-3.5 px-3 font-bold text-carbon text-sm">{voy.voyageNumber}</td>
                      <td className="py-3.5 px-3 font-sans font-bold text-carbon">{voy.vesselName}</td>
                      <td className="py-3.5 px-3 font-sans text-slate text-[11px]">
                        <div><strong className="text-carbon">{voy.pol}</strong></div>
                        <div className="text-slate mt-0.5">&rarr; {voy.pod}</div>
                        <span className="text-[10px] text-slate font-mono">{voy.terminal}</span>
                      </td>
                      <td className="py-3.5 px-3 text-slate text-[11px]">
                        <div>Đến: <b className="text-carbon">{voy.eta}</b></div>
                        <div>Đi: <b className="text-carbon">{voy.etd}</b></div>
                      </td>
                      <td className="py-3.5 px-3 text-amber-700 font-bold">{voy.cyCutOff}</td>
                      <td className="py-3.5 px-3 text-slate">{voy.vgmCutOff}</td>
                      <td className="py-3.5 px-3 font-sans">
                        <div className="relative inline-flex items-center">
                          <select
                            value={voy.status}
                            disabled={updatingVoyageId === voy.id}
                            onChange={(e) => handleUpdateStatus(voy.id, e.target.value)}
                            title="Bấm để chọn chuyển đổi trạng thái chuyến tàu"
                            className={`text-[10px] font-bold py-1 pl-2.5 pr-6 rounded-full border cursor-pointer appearance-none focus:outline-none transition-all shadow-2xs ${
                              VOYAGE_STATUS_STYLES[voy.status] || 'bg-slate-100 text-slate-700 border-slate-300'
                            } ${updatingVoyageId === voy.id ? 'opacity-50 pointer-events-none' : 'hover:brightness-95'}`}
                          >
                            <option value="SCHEDULED">● Kế hoạch</option>
                            <option value="IN_TRANSIT">● Đang hành trình</option>
                            <option value="BERTHED">● Đã cập cảng</option>
                            <option value="OPERATING">● Đang làm hàng</option>
                            <option value="DEPARTED">● Đã rời cảng</option>
                            <option value="COMPLETED">● Hoàn tất</option>
                          </select>
                          <span className="material-symbols-outlined text-xs absolute right-1.5 pointer-events-none opacity-60">
                            expand_more
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Phân trang danh sách chuyến tàu */}
          {voyages.length > 0 && (
            <ShippingPagination
              currentPage={voyagePage}
              totalItems={voyages.length}
              pageSize={voyagePageSize}
              onPageChange={setVoyagePage}
              onPageSizeChange={setVoyagePageSize}
              pageSizeOptions={[5, 10, 20]}
              itemName="chuyến tàu"
            />
          )}
        </div>
      ) : (
        /* Tab: Danh mục Tàu (Vessel Fleet) */
        <div className="bg-white border border-chalk rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex justify-between items-center border-b border-chalk pb-3">
            <div>
              <h3 className="font-heading text-lg font-extrabold text-carbon">
                Danh mục đội tàu biển
              </h3>
              <p className="text-xs text-slate font-mono mt-0.5">
                Hiển thị {filteredVessels.length} tàu đăng ký hoạt động
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left border-collapse text-xs">
              <thead>
                <tr className="bg-fog text-slate font-bold uppercase text-[10px] border-b border-chalk">
                  <th className="py-3 px-3">Tên tàu</th>
                  <th className="py-3 px-3">Số IMO</th>
                  <th className="py-3 px-3">Hô hiệu (Call Sign)</th>
                  <th className="py-3 px-3">Quốc tịch</th>
                  <th className="py-3 px-3">Phân loại</th>
                  <th className="py-3 px-3">Sức chở (TEU)</th>
                  <th className="py-3 px-3">Trạng thái</th>
                  <th className="py-3 px-3 text-right">Tác nghiệp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-chalk font-medium font-mono">
                {filteredVessels.slice((vesselPage - 1) * vesselPageSize, vesselPage * vesselPageSize).map((ves) => (
                  <tr key={ves.id} className="hover:bg-fog/60 transition-colors">
                    <td className="py-3.5 px-3 font-sans font-bold text-carbon text-sm">{ves.vesselName}</td>
                    <td className="py-3.5 px-3 font-bold text-carbon">{ves.imoNumber}</td>
                    <td className="py-3.5 px-3 text-slate">{ves.callSign}</td>
                    <td className="py-3.5 px-3 font-sans text-carbon">{ves.flag}</td>
                    <td className="py-3.5 px-3 font-sans text-slate">{ves.vesselType}</td>
                    <td className="py-3.5 px-3 font-bold text-carbon">{ves.capacityTeu?.toLocaleString()} TEU</td>
                    <td className="py-3.5 px-3 font-sans">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border bg-emerald-50 text-emerald-700 border-emerald-300">
                        ● Hoạt động
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-right font-sans">
                      <button
                        onClick={() => handleOpenCreateForVessel(ves.id)}
                        className="px-3 py-1.5 text-xs font-bold text-carbon bg-fog hover:bg-chalk border border-chalk rounded-xl transition-colors cursor-pointer flex items-center gap-1 ml-auto"
                      >
                        <span className="material-symbols-outlined text-sm text-signal-orange">add</span>
                        <span>Tạo chuyến</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Phân trang danh mục tàu */}
          {filteredVessels.length > 0 && (
            <ShippingPagination
              currentPage={vesselPage}
              totalItems={filteredVessels.length}
              pageSize={vesselPageSize}
              onPageChange={setVesselPage}
              onPageSizeChange={setVesselPageSize}
              pageSizeOptions={[5, 10, 20]}
              itemName="tàu biển"
            />
          )}
        </div>
      )}

      {/* ── MODAL: TẠO CHUYẾN TÀU MỚI (Tự động sinh mã, tự động điền cảng & chuẩn hóa ngày giờ) ── */}
      {showVesselModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <form onSubmit={handleCreateVessel} className="bg-white rounded-2xl shadow-2xl border border-chalk max-w-lg w-full overflow-hidden">
            <div className="px-6 py-4 border-b border-chalk bg-fog flex items-center justify-between">
              <h3 className="font-heading text-lg font-extrabold text-carbon">Thêm tàu mới</h3>
              <button type="button" onClick={() => setShowVesselModal(false)} className="text-slate hover:text-carbon text-xl leading-none">×</button>
            </div>
            <div className="p-6 grid grid-cols-2 gap-4 text-xs">
              {vesselError && <p className="col-span-2 rounded bg-rose-50 border border-rose-200 p-2 text-rose-700">{vesselError}</p>}
              <label className="col-span-2 space-y-1"><span className="font-bold text-slate">Tên tàu *</span>
                <input required className="w-full border border-chalk rounded-lg px-3 py-2" value={vesselForm.vesselName} onChange={(e) => setVesselForm({ ...vesselForm, vesselName: e.target.value })} placeholder="VD: EVER GIVEN" /></label>
              <label className="space-y-1"><span className="font-bold text-slate">Số IMO * (7 chữ số)</span>
                <input required inputMode="numeric" maxLength={7} className="w-full border border-chalk rounded-lg px-3 py-2 font-mono" value={vesselForm.imoNumber} onChange={(e) => setVesselForm({ ...vesselForm, imoNumber: e.target.value })} /></label>
              <label className="space-y-1"><span className="font-bold text-slate">Hô hiệu (Call Sign) *</span>
                <input required className="w-full border border-chalk rounded-lg px-3 py-2 font-mono uppercase" value={vesselForm.callSign} onChange={(e) => setVesselForm({ ...vesselForm, callSign: e.target.value })} /></label>
              <label className="space-y-1"><span className="font-bold text-slate">Quốc tịch</span>
                <input className="w-full border border-chalk rounded-lg px-3 py-2" value={vesselForm.flag} onChange={(e) => setVesselForm({ ...vesselForm, flag: e.target.value })} placeholder="VD: Panama (PA)" /></label>
              <label className="space-y-1"><span className="font-bold text-slate">Phân loại</span>
                <select className="w-full border border-chalk rounded-lg px-3 py-2" value={vesselForm.vesselType} onChange={(e) => setVesselForm({ ...vesselForm, vesselType: e.target.value })}>
                  <option>Container Ship</option><option>Feeder</option><option>Bulk Carrier</option><option>Ro-Ro</option>
                </select></label>
              <label className="col-span-2 space-y-1"><span className="font-bold text-slate">Sức chở (TEU) *</span>
                <input required type="number" min="1" className="w-full border border-chalk rounded-lg px-3 py-2" value={vesselForm.capacityTeu} onChange={(e) => setVesselForm({ ...vesselForm, capacityTeu: e.target.value })} /></label>
            </div>
            <div className="px-6 py-4 border-t border-chalk bg-fog flex justify-end gap-3">
              <button type="button" onClick={() => setShowVesselModal(false)} className="px-4 py-2 rounded-lg bg-slate-200 text-carbon hover:bg-slate-300 text-xs font-bold">Hủy</button>
              <button type="submit" disabled={savingVessel} className="px-4 py-2 rounded-lg bg-signal-orange text-white text-xs font-bold hover:opacity-90 disabled:opacity-50">{savingVessel ? 'Đang lưu...' : 'Thêm tàu'}</button>
            </div>
          </form>
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-carbon/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-chalk w-full max-w-3xl overflow-hidden animate-fadeIn flex flex-col max-h-[92vh]">
            {/* Tiêu đề */}
            <div className="px-7 py-5 border-b border-chalk flex items-start justify-between shrink-0">
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-xl bg-signal-orange/10 text-signal-orange flex items-center justify-center">
                  <span className="material-symbols-outlined">directions_boat</span>
                </span>
                <div>
                  <h3 className="font-heading text-lg font-extrabold text-carbon leading-tight">Đăng ký chuyến tàu mới</h3>
                  <p className="text-xs text-slate mt-0.5">Khởi tạo kế hoạch làm hàng cho chuyến tàu ghé Cảng Tiên Sa</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="w-9 h-9 rounded-lg text-slate hover:bg-fog hover:text-carbon flex items-center justify-center cursor-pointer"
                aria-label="Đóng"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            <form id="createVoyageForm" onSubmit={handleCreateVoyage} className="px-7 py-6 space-y-6 text-xs font-sans overflow-y-auto flex-1 bg-fog/30">
              {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-800">{error}</p>}
              <p className="rounded-xl border border-chalk bg-white px-4 py-2.5 text-xs text-slate">Mã chuyến tự sinh: <strong className="font-mono text-carbon">{generateVoyageNumber(createForm.vesselId, createForm) || '—'}</strong> <span className="ml-1">(tiền tố tàu + năm ETA + số thứ tự + X xuất / N nhập)</span></p>

              {/* 1. Tàu và cầu bến */}
              <section className="bg-white border border-chalk rounded-xl p-5 space-y-4">
                <h4 className="flex items-center gap-2 text-[11px] font-extrabold text-carbon uppercase tracking-wide">
                  <span className="w-5 h-5 rounded-full bg-carbon text-white text-[10px] flex items-center justify-center">1</span>
                  Tàu và cầu bến
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-[10px] font-bold text-slate uppercase">Tàu biển khai thác *</label>
                      <button
                        type="button"
                        onClick={() => { setVesselForm(emptyVessel); setVesselError(''); setShowVesselModal(true); }}
                        className="text-[10px] font-bold text-signal-orange hover:underline cursor-pointer"
                      >
                        + Thêm tàu
                      </button>
                    </div>
                    <select
                      value={createForm.vesselId}
                      onChange={(e) => handleVesselChange(e.target.value)}
                      className="w-full h-11 px-3 bg-white border border-chalk rounded-lg text-sm font-semibold text-carbon focus:outline-none focus:border-signal-orange"
                    >
                      {vessels.map((v) => (
                        <option key={v.id} value={v.id}>{v.vesselName} · IMO {v.imoNumber}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate uppercase mb-1.5">Cầu bến tiếp nhận *</label>
                    <select
                      value={createForm.terminal}
                      onChange={(e) => setCreateForm({ ...createForm, terminal: e.target.value })}
                      className="w-full h-11 px-3 bg-white border border-chalk rounded-lg text-sm font-semibold text-carbon focus:outline-none focus:border-signal-orange"
                    >
                      {TIEN_SA_TERMINALS.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </section>

              {/* 2. Tuyến hàng hải */}
              <section className="bg-white border border-chalk rounded-xl p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h4 className="flex items-center gap-2 text-[11px] font-extrabold text-carbon uppercase tracking-wide">
                    <span className="w-5 h-5 rounded-full bg-carbon text-white text-[10px] flex items-center justify-center">2</span>
                    Tuyến hàng hải
                  </h4>
                  <div className="flex bg-fog p-0.5 rounded-lg border border-chalk text-[11px] font-bold">
                    {[['OUTBOUND', 'Xuất khẩu'], ['INBOUND', 'Nhập khẩu']].map(([key, text]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => handleRouteChange(key)}
                        className={`px-3.5 py-1.5 rounded-md transition-colors cursor-pointer ${routeType === key ? 'bg-carbon text-white shadow-sm' : 'text-slate hover:text-carbon'}`}
                      >
                        {text}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-3 items-end">
                  <div>
                    <span className="text-[10px] text-slate font-bold uppercase block mb-1.5">
                      Cảng bốc {routeType === 'OUTBOUND' && <b className="text-signal-orange normal-case">· cảng Tiên Sa</b>}
                    </span>
                    {routeType === 'OUTBOUND' ? (
                      <div className="h-11 px-3 bg-fog border border-chalk rounded-lg font-semibold text-carbon text-sm flex items-center gap-2">
                        <span className="material-symbols-outlined text-base text-emerald-600">anchor</span>
                        <span className="truncate">{TIEN_SA_PORT}</span>
                      </div>
                    ) : (
                      <select
                        value={createForm.pol}
                        onChange={(e) => setCreateForm({ ...createForm, pol: e.target.value })}
                        className="w-full h-11 px-3 bg-white border border-chalk rounded-lg text-sm font-semibold text-carbon focus:outline-none focus:border-signal-orange"
                      >
                        {STANDARD_PORTS.map((p) => (<option key={p} value={p}>{p}</option>))}
                      </select>
                    )}
                  </div>

                  <span className="material-symbols-outlined text-slate hidden md:flex h-11 items-center justify-center">trending_flat</span>

                  <div>
                    <span className="text-[10px] text-slate font-bold uppercase block mb-1.5">
                      Cảng dỡ {routeType === 'INBOUND' && <b className="text-signal-orange normal-case">· cảng Tiên Sa</b>}
                    </span>
                    {routeType === 'INBOUND' ? (
                      <div className="h-11 px-3 bg-fog border border-chalk rounded-lg font-semibold text-carbon text-sm flex items-center gap-2">
                        <span className="material-symbols-outlined text-base text-emerald-600">anchor</span>
                        <span className="truncate">{TIEN_SA_PORT}</span>
                      </div>
                    ) : (
                      <select
                        value={createForm.pod}
                        onChange={(e) => setCreateForm({ ...createForm, pod: e.target.value })}
                        className="w-full h-11 px-3 bg-white border border-chalk rounded-lg text-sm font-semibold text-carbon focus:outline-none focus:border-signal-orange"
                      >
                        {STANDARD_PORTS.map((p) => (<option key={p} value={p}>{p}</option>))}
                      </select>
                    )}
                  </div>
                </div>
              </section>

              {/* 3. Kế hoạch cập bến và hạn chót */}
              <section className="bg-white border border-chalk rounded-xl p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="flex items-center gap-2 text-[11px] font-extrabold text-carbon uppercase tracking-wide">
                    <span className="w-5 h-5 rounded-full bg-carbon text-white text-[10px] flex items-center justify-center">3</span>
                    Kế hoạch cập bến và hạn chót
                  </h4>
                  <button
                    type="button"
                    onClick={() => handleEtaChange(toLocalDatetimeInput(createForm.eta))}
                    className="text-[10px] text-signal-orange font-bold hover:underline flex items-center gap-1 cursor-pointer"
                    title="Tự động tính thời gian rời cảng, hạn chót hạ bãi và nộp VGM"
                  >
                    <span className="material-symbols-outlined text-sm">sync</span>
                    Tính tự động theo ngày đến
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate uppercase mb-1.5">Dự kiến đến cảng *</label>
                    <input
                      type="datetime-local"
                      value={toLocalDatetimeInput(createForm.eta)}
                      onChange={(e) => handleEtaChange(e.target.value)}
                      className="w-full h-11 px-3 bg-white border border-chalk rounded-lg text-sm font-semibold text-carbon focus:outline-none focus:border-signal-orange"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate uppercase mb-1.5">Dự kiến rời cảng *</label>
                    <input
                      type="datetime-local"
                      value={toLocalDatetimeInput(createForm.etd)}
                      onChange={(e) => setCreateForm({ ...createForm, etd: fromLocalDatetimeInput(e.target.value) })}
                      className="w-full h-11 px-3 bg-white border border-chalk rounded-lg text-sm font-semibold text-carbon focus:outline-none focus:border-signal-orange"
                    />
                  </div>
                </div>
              </section>

              {/* 4. Ghi chú */}
              <section className="bg-white border border-chalk rounded-xl p-5 space-y-3">
                <h4 className="flex items-center gap-2 text-[11px] font-extrabold text-carbon uppercase tracking-wide">
                  <span className="w-5 h-5 rounded-full bg-carbon text-white text-[10px] flex items-center justify-center">4</span>
                  Ghi chú vận hành
                </h4>
                <textarea
                  value={createForm.remarks}
                  onChange={(e) => setCreateForm({ ...createForm, remarks: e.target.value })}
                  rows={2}
                  placeholder="Ghi chú kế hoạch cầu bến hoặc yêu cầu dịch vụ xếp dỡ..."
                  className="w-full px-3 py-2.5 bg-white border border-chalk rounded-lg text-sm text-carbon focus:outline-none focus:border-signal-orange"
                />
              </section>
            </form>

            <div className="px-7 py-4 border-t border-chalk bg-white flex justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-5 h-10 bg-white border border-chalk text-carbon hover:bg-fog rounded-lg text-xs font-bold cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="submit"
                form="createVoyageForm"
                disabled={saving}
                className="px-6 h-10 bg-signal-orange hover:opacity-90 disabled:opacity-50 text-white rounded-lg text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">done_all</span>
                {saving ? 'Đang tạo...' : 'Xác nhận tạo chuyến tàu'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
