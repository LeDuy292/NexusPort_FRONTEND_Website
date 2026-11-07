import React, { useState, useEffect } from 'react';
import { shippingLineApi, formatApiErrorMessage } from './api/shippingLineApi';
import ShippingBadge from './components/ShippingBadge';
import ShippingPagination from './components/ShippingPagination';
import EdoIssueModal from './components/EdoIssueModal';
import EdoPreviewModal from './components/EdoPreviewModal';
import { checkIso6346, parseCsvContainers } from './ManifestManagementPage';

export default function BillOfLadingPage() {
  const [billsOfLading, setBillsOfLading] = useState([]);
  const [voyages, setVoyages] = useState([]);
  const [manifests, setManifests] = useState([]);
  const [shippingInstructions, setShippingInstructions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedBl, setSelectedBl] = useState(null);
  const [activeTab, setActiveTab] = useState('LIST'); // LIST, DETAIL

  // Phân trang
  const [blPage, setBlPage] = useState(1);
  const [blPageSize, setBlPageSize] = useState(5);
  const [contPage, setContPage] = useState(1);
  const [contPageSize, setContPageSize] = useState(5);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEdoModal, setShowEdoModal] = useState(false);
  const [edoTargetBl, setEdoTargetBl] = useState('');
  const [previewingEdo, setPreviewingEdo] = useState(null);

  // Chế độ nguồn tạo B/L: MANIFEST (Import), MANUAL (Import), SI (Export), AUTO_CODE (Export)
  const [sourceMode, setSourceMode] = useState('MANIFEST');
  const [selectedManifestId, setSelectedManifestId] = useState('');
  const [selectedSiId, setSelectedSiId] = useState('');

  // Danh sách container thẩm định trực tiếp trong form tạo B/L
  const [previewContainers, setPreviewContainers] = useState([
    {
      containerNumber: 'EMCU8812902',
      isoType: '40HC',
      sealNumber: 'SL-88120',
      grossWeightKg: 24000,
      tempRequired: '',
    },
  ]);
  const [uploadedFileName, setUploadedFileName] = useState(null);
  const [isDraggingCsv, setIsDraggingCsv] = useState(false);

  // Create form
  const [createForm, setCreateForm] = useState({
    blNumber: '',
    direction: 'IMPORT',
    blType: 'SEAWAY_BILL',
    voyageNumber: '',
    shipper: '',
    consignee: '',
    notifyParty: 'Same as Consignee',
    cargoDescription: '',
    packageCount: 500,
    packageUnit: 'Cartons',
    grossWeightKg: 24000,
    measurementCbm: 55,
    freightStatus: 'PREPAID',
    freightAmountUsd: 2800,
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const [blRes, voyRes] = await Promise.all([
        shippingLineApi.getBillsOfLading({ search, status: statusFilter }),
        shippingLineApi.getVoyages(),
      ]);
      const blList = Array.isArray(blRes) ? blRes : (blRes?.data || []);
      const voyList = Array.isArray(voyRes) ? voyRes : (voyRes?.data || []);
      setBillsOfLading(blList);
      setVoyages(voyList);
    } catch (err) {
      setError(formatApiErrorMessage(err, 'Lỗi tải danh sách vận đơn'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setBlPage(1);
    loadData();
  }, [search, statusFilter]);

  // Tải danh sách Bản khai và Chỉ dẫn gửi hàng (SI) khi mở modal tạo B/L
  const fetchSources = async () => {
    try {
      const [mRes, siRes] = await Promise.all([
        shippingLineApi.getManifests(),
        shippingLineApi.getShippingInstructions(),
      ]);
      const mList = Array.isArray(mRes) ? mRes : (mRes?.data || []);
      const siList = Array.isArray(siRes) ? siRes : (siRes?.data || []);
      setManifests(mList);
      setShippingInstructions(siList);
    } catch {
      // Ignore background fetch error
    }
  };

  const handleSelectBl = async (bl) => {
    try {
      setLoading(true);
      const res = await shippingLineApi.getBillOfLadingDetail(bl.id);
      const detail = res?.blNumber ? res : (res?.data || null);
      if (detail) {
        setSelectedBl(detail);
        setActiveTab('DETAIL');
      }
    } catch (err) {
      setError(formatApiErrorMessage(err, 'Không thể xem chi tiết vận đơn'));
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateBlStatus = async (status) => {
    if (!selectedBl) return;
    setSaving(true);
    setError('');

    try {
      const res = await shippingLineApi.updateBlStatus(selectedBl.id, status);
      if (res?.data) {
        setSelectedBl(res.data);
        setSuccessMsg(`Đã cập nhật trạng thái vận đơn sang: ${status}`);
        loadData();
      }
    } catch (err) {
      setError(formatApiErrorMessage(err, 'Lỗi cập nhật trạng thái B/L'));
    } finally {
      setSaving(false);
    }
  };

  const handleCollectFeesForBl = async (id) => {
    setSaving(true);
    setError('');

    try {
      const res = await shippingLineApi.collectBlFees(id);
      if (res?.data?.bl) {
        setSelectedBl(res.data.bl);
      }
      setSuccessMsg('Đã xác nhận thu đủ cước và phụ phí địa phương cho vận đơn');
      loadData();
    } catch (err) {
      setError(formatApiErrorMessage(err, 'Lỗi ghi nhận thu phí'));
    } finally {
      setSaving(false);
    }
  };

  const handleViewEdo = async (edoOrNumber) => {
    try {
      if (typeof edoOrNumber === 'object' && edoOrNumber?.edoNumber) {
        setPreviewingEdo(edoOrNumber);
        return;
      }
      setLoading(true);
      const res = await shippingLineApi.getDeliveryOrderDetail(edoOrNumber);
      const edoData = res?.edoNumber ? res : (res?.data || null);
      if (edoData) {
        setPreviewingEdo(edoData);
      }
    } catch (err) {
      setError(formatApiErrorMessage(err, 'Không thể tải thông tin lệnh eDO'));
    } finally {
      setLoading(false);
    }
  };

  const handleCancelEdoForBl = async (edoIdOrNumber) => {
    const reason = window.prompt('Nhập lý do hủy lệnh giao hàng eDO này (để có thể cấp lại lệnh mới):');
    if (reason === null) return;
    setSaving(true);
    setError('');
    try {
      await shippingLineApi.cancelEdo(edoIdOrNumber, reason || 'Hủy lệnh theo yêu cầu cấp lại');
      setSuccessMsg(`Đã hủy lệnh giao hàng điện tử. Vận đơn đã sẵn sàng để phát hành lệnh eDO mới!`);
      if (selectedBl) {
        const res = await shippingLineApi.getBillOfLadingDetail(selectedBl.id);
        const detail = res?.blNumber ? res : (res?.data || null);
        if (detail) setSelectedBl(detail);
      }
      loadData();
    } catch (err) {
      setError(formatApiErrorMessage(err, 'Lỗi khi hủy lệnh eDO'));
    } finally {
      setSaving(false);
    }
  };

  // ── MỞ MODAL TẠO B/L VỚI KHỞI TẠO CHUẨN ──
  const handleOpenCreateModal = () => {
    fetchSources();
    const defaultDir = 'IMPORT';
    const inboundVoyages = voyages.filter(v => 
      (v.pod && (v.pod.includes('Tiên Sa') || v.pod.includes('VNDAD'))) || v.direction === 'IMPORT' || v.direction === 'INBOUND'
    );
    const chosenVoy = inboundVoyages[0]?.voyageNumber || voyages[0]?.voyageNumber || 'MM-2601S';

    setCreateForm({
      blNumber: 'BL-INB-DAD-2605',
      direction: defaultDir,
      blType: 'SEAWAY_BILL',
      voyageNumber: chosenVoy,
      shipper: 'Tokyo Precision Equipment Co., Ltd',
      consignee: 'Công ty TNHH Tiếp Vận Hàng Hải Tiên Sa',
      notifyParty: 'Same as Consignee',
      cargoDescription: 'Máy móc cơ khí chính xác và linh kiện công nghiệp',
      packageCount: 450,
      packageUnit: 'Cartons',
      grossWeightKg: 24000,
      measurementCbm: 52,
      freightStatus: 'PREPAID',
      freightAmountUsd: 2800,
    });
    setSourceMode('MANIFEST');
    setSelectedManifestId('');
    setSelectedSiId('');
    setPreviewContainers([
      {
        containerNumber: 'EMCU8812902',
        isoType: '40HC',
        sealNumber: 'SL-88120',
        grossWeightKg: 24000,
        tempRequired: '',
      },
    ]);
    setUploadedFileName(null);
    setShowCreateModal(true);
  };

  // ── ĐỔI HƯỚNG VẬN CHUYỂN: LỌC CHUYẾN TÀU VÀ CHẾ ĐỘ NGUỒN TỰ ĐỘNG ──
  const handleDirectionChange = (newDir) => {
    const nextMode = newDir === 'IMPORT' ? 'MANIFEST' : 'SI';
    const filteredVoy = voyages.filter(v => {
      if (newDir === 'IMPORT') {
        return (v.pod && (v.pod.includes('Tiên Sa') || v.pod.includes('VNDAD'))) || v.direction === 'IMPORT' || v.direction === 'INBOUND';
      } else {
        return (v.pol && (v.pol.includes('Tiên Sa') || v.pol.includes('VNDAD'))) || v.direction === 'EXPORT' || v.direction === 'OUTBOUND';
      }
    });
    const nextVoy = filteredVoy[0]?.voyageNumber || voyages[0]?.voyageNumber || '';
    const autoExportBl = `BL-EXP-DAD-${new Date().getFullYear().toString().slice(-2)}${String(new Date().getMonth() + 1).padStart(2, '0')}-${Math.floor(1000 + Math.random() * 9000)}`;

    setCreateForm(prev => ({
      ...prev,
      direction: newDir,
      voyageNumber: nextVoy,
      blNumber: newDir === 'EXPORT' ? autoExportBl : 'BL-INB-DAD-2605',
      shipper: newDir === 'EXPORT' ? 'Công ty TNHH Dệt may & Nông sản Đà Nẵng' : 'Tokyo Precision Equipment Co., Ltd',
      consignee: newDir === 'EXPORT' ? 'Mitsui & Co. Logistics Ltd (Tokyo)' : 'Công ty TNHH Tiếp Vận Hàng Hải Tiên Sa',
    }));
    setSourceMode(nextMode);
    setSelectedManifestId('');
    setSelectedSiId('');
  };

  // ── TRÍCH XUẤT TỪ BẢN KHAI NHẬP (IMPORT MANIFEST) ──
  const handleSelectManifest = (mId) => {
    setSelectedManifestId(mId);
    const m = manifests.find(item => item.id === mId || item.manifestNumber === mId);
    if (!m) return;

    const records = m.records || [];
    const firstRec = records[0];

    const conts = records.map(r => ({
      containerNumber: r.containerNumber,
      isoType: r.isoType || '40HC',
      sealNumber: r.sealNumber || 'SL-88001',
      grossWeightKg: Number(r.grossWeightKg) || 20000,
      tempRequired: r.tempRequired || '',
    }));

    const totalKg = conts.reduce((sum, c) => sum + (Number(c.grossWeightKg) || 0), 0);

    setCreateForm(prev => ({
      ...prev,
      voyageNumber: m.voyageNumber || prev.voyageNumber,
      blNumber: firstRec?.blNumber || `BL-INB-DAD-${m.manifestNumber?.slice(-4) || '2609'}`,
      cargoDescription: firstRec?.commodity || 'Linh kiện thiết bị nhập khẩu theo bản khai',
      grossWeightKg: totalKg > 0 ? totalKg : prev.grossWeightKg,
      shipper: prev.shipper || 'Samsung Electronics Global',
      consignee: prev.consignee || 'Công ty TNHH Tiếp Vận Hàng Hải Tiên Sa',
    }));

    if (conts.length > 0) {
      setPreviewContainers(conts);
      setUploadedFileName(null);
    }
  };

  // ── TRÍCH XUẤT TỪ CHỈ DẪN GỬI HÀNG (EXPORT SI) ──
  const handleSelectSi = (siId) => {
    setSelectedSiId(siId);
    const si = shippingInstructions.find(item => item.id === siId || item.siNumber === siId);
    if (!si) return;

    const conts = (si.containers || []).map(c => ({
      containerNumber: c.containerNumber,
      isoType: c.isoType || '40HC',
      sealNumber: c.sealNumber || 'SL-77001',
      grossWeightKg: Number(c.grossWeightKg) || 24000,
      tempRequired: c.tempRequired || '',
    }));

    const totalKg = conts.reduce((sum, c) => sum + (Number(c.grossWeightKg) || 0), 0);
    const autoBlNo = `BL-EXP-DAD-${new Date().getFullYear().toString().slice(-2)}${String(new Date().getMonth() + 1).padStart(2, '0')}-${si.siNumber?.replace(/[^0-9]/g, '').slice(-3) || Math.floor(1000 + Math.random() * 9000)}`;

    setCreateForm(prev => ({
      ...prev,
      voyageNumber: si.voyageNumber || prev.voyageNumber,
      blNumber: autoBlNo,
      shipper: si.shipper || prev.shipper,
      consignee: si.consignee || prev.consignee,
      notifyParty: si.notifyParty || prev.notifyParty,
      cargoDescription: si.cargoDescription || prev.cargoDescription,
      packageCount: si.packageCount || prev.packageCount,
      packageUnit: si.packageUnit || prev.packageUnit,
      grossWeightKg: totalKg > 0 ? totalKg : (si.grossWeightKg || prev.grossWeightKg),
      measurementCbm: si.measurementCbm || prev.measurementCbm,
      freightStatus: si.freightStatus || prev.freightStatus,
      freightAmountUsd: si.freightAmountUsd || prev.freightAmountUsd,
    }));

    if (conts.length > 0) {
      setPreviewContainers(conts);
      setUploadedFileName(null);
    }
  };

  // ── TẢI FILE MẪU CSV CHUẨN ISO ──
  const handleDownloadSampleCsv = () => {
    const csvContent =
      'Số container,Loại ISO,Số seal,Khối lượng VGM (kg),Nhiệt độ cài đặt\n' +
      'EMCU8812902,40HC,SL-88120,24000,\n' +
      'EMCU5102949,40HC,SL-99310,24100,\n' +
      'EMCU9284712,40RF,SL-88412,28450,-18.0°C\n';
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mau_danh_sach_container_bl.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // ── XỬ LÝ NẠP TỆP CSV TỪ MÁY TÍNH ──
  const processCsvFile = (file) => {
    if (!file) return;
    const lowerName = file.name.toLowerCase();
    if (!lowerName.endsWith('.csv') && !lowerName.endsWith('.txt')) {
      setError('Vui lòng chọn tệp định dạng .csv hoặc .txt');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result;
      if (typeof text === 'string') {
        const parsed = parseCsvContainers(text);
        if (parsed.length === 0) {
          setError(`Tệp "${file.name}" không chứa dòng dữ liệu container hợp lệ.`);
          return;
        }
        const mapped = parsed.map(p => ({
          containerNumber: p.containerNumber,
          isoType: p.isoType || '40HC',
          sealNumber: p.sealNumber || '',
          grossWeightKg: Number(p.grossWeightKg) || 20000,
          tempRequired: p.tempRequired || '',
        }));
        setPreviewContainers(mapped);
        setUploadedFileName(file.name);
        const totalKg = mapped.reduce((sum, c) => sum + (Number(c.grossWeightKg) || 0), 0);
        if (totalKg > 0) {
          setCreateForm(prev => ({ ...prev, grossWeightKg: totalKg }));
        }
      }
    };
    reader.readAsText(file, 'utf-8');
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      processCsvFile(file);
      e.target.value = '';
    }
  };

  const handleRemoveUploadedFile = () => {
    setPreviewContainers([]);
    setUploadedFileName(null);
  };

  const handleRemoveContainer = (index) => {
    setPreviewContainers(prev => prev.filter((_, i) => i !== index));
  };

  // ── THẨM ĐỊNH TỪNG CONTAINER THỜI GIAN THỰC (REAL-TIME VALIDATION) ──
  const evaluatedContainers = previewContainers.map((item, idx) => {
    const isoRes = checkIso6346(item.containerNumber);
    const isReefer = (item.isoType && item.isoType.includes('RF')) || item.cargoType === 'REEFER';
    const hasTemp = !isReefer || Boolean(item.tempRequired && item.tempRequired.trim());
    const hasSeal = Boolean(item.sealNumber && item.sealNumber.trim());
    const hasWeight = item.grossWeightKg >= 1000 && item.grossWeightKg <= 36000;

    // Kiểm tra trùng trong danh sách hiện tại
    const isLocalDuplicate = previewContainers.some(
      (other, oIdx) => oIdx !== idx && other.containerNumber?.trim().toUpperCase() === item.containerNumber?.trim().toUpperCase()
    );

    // Kiểm tra xung đột: Một container chỉ thuộc một B/L trong cùng một chuyến (loại trừ chính B/L đang xử lý)
    const activeBlsInVoyage = billsOfLading.filter(b =>
      b.voyageNumber === createForm.voyageNumber &&
      b.status !== 'CANCELLED' &&
      b.blNumber?.toUpperCase() !== (createForm.blNumber || '').trim().toUpperCase()
    );
    const voyageConflictBl = activeBlsInVoyage.find(b =>
      (b.containers || []).some(bc => (bc.containerNumber || '').trim().toUpperCase() === item.containerNumber?.trim().toUpperCase())
    );

    const errors = [];
    if (!item.containerNumber) errors.push('Thiếu số container');
    else if (!isoRes.isValid) errors.push(isoRes.reason);
    if (!hasSeal) errors.push('Thiếu số seal');
    if (!hasWeight) errors.push('Khối lượng VGM không hợp lệ (1,000 - 36,000 kg)');
    if (!hasTemp) errors.push('Container lạnh thiếu nhiệt độ cài đặt');
    if (isLocalDuplicate) errors.push('Trùng lặp trong danh sách B/L này');
    if (voyageConflictBl) errors.push(`Xung đột: Đã thuộc B/L ${voyageConflictBl.blNumber} trong chuyến`);

    return {
      ...item,
      isValid: errors.length === 0,
      errors,
    };
  });

  const previewValidCount = evaluatedContainers.filter(c => c.isValid).length;
  const previewErrorCount = evaluatedContainers.filter(c => !c.isValid).length;

  // ── NỘP TẠO VẬN ĐƠN (HỖ TRỢ LƯU NHÁP VÀ TẠO CHÍNH THỨC) ──
  const handleCreateBl = async (targetStatus = 'ISSUED') => {
    if (!createForm.voyageNumber) {
      setError('Vui lòng chọn Chuyến tàu thực hiện');
      return;
    }
    if (!createForm.consignee?.trim()) {
      setError('Người nhận hàng (Consignee) là thông tin bắt buộc (*) làm căn cứ pháp lý giải phóng hàng.');
      return;
    }
    if (createForm.direction === 'IMPORT' && !createForm.blNumber?.trim()) {
      setError('Vui lòng nhập Mã Vận Đơn (B/L) cho hàng nhập khẩu (số B/L do cảng đi cấp).');
      return;
    }
    if (targetStatus === 'ISSUED') {
      if (previewContainers.length === 0) {
        setError('Vui lòng tải tệp container hoặc trích xuất từ Bản khai / SI trước khi phát hành B/L.');
        return;
      }
      if (previewErrorCount > 0) {
        setError(`Vẫn còn ${previewErrorCount} container có lỗi kiểm tra. Vui lòng xử lý trước khi phát hành.`);
        return;
      }
    }

    setSaving(true);
    setError('');

    try {
      await shippingLineApi.createBillOfLading({
        ...createForm,
        containers: previewContainers,
        status: targetStatus,
        isDraft: targetStatus === 'DRAFT',
      });

      setShowCreateModal(false);
      setSuccessMsg(targetStatus === 'DRAFT' ? 'Đã lưu nháp vận đơn B/L thành công' : 'Đã tạo và phát hành vận đơn B/L thành công');
      loadData();
    } catch (err) {
      setError(formatApiErrorMessage(err, 'Lỗi tạo vận đơn'));
    } finally {
      setSaving(false);
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
            Quản lý vận đơn đường biển (B/L)
          </h2>
          <p className="text-xs text-slate mt-0.5">
            Quản lý vận đơn, container đính kèm, trạng thái thanh toán phụ phí và điều kiện giải phóng lệnh giao hàng (eDO).
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {activeTab !== 'LIST' && (
            <button
              onClick={() => { setActiveTab('LIST'); setSelectedBl(null); }}
              className="px-3.5 py-2 text-xs font-bold text-carbon bg-fog hover:bg-chalk border border-chalk rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm">arrow_back</span>
              Danh sách B/L
            </button>
          )}

          <button
            onClick={handleOpenCreateModal}
            className="px-4 py-2 text-xs font-bold text-white bg-signal-orange hover:opacity-90 rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <span className="material-symbols-outlined text-base">add</span>
            Tạo vận đơn mới
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

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs flex justify-between items-center shadow-xs">
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg('')} className="text-emerald-700 font-bold px-2">✕</button>
        </div>
      )}

      {/* ── 2. VIEW: DANH SÁCH VẬN ĐƠN (B/L LIST) ── */}
      {activeTab === 'LIST' && (
        <div className="space-y-4">
          
          {/* Search & Filter Bar */}
          <div className="bg-white border border-chalk rounded-2xl p-4 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4 text-xs">
            <div className="relative w-full md:w-96">
              <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate text-base">search</span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm mã B/L, người gửi hàng, người nhận hàng..."
                className="w-full pl-9 pr-4 py-2 bg-fog border border-chalk rounded-xl text-xs font-medium text-carbon focus:outline-none focus:border-signal-orange focus:ring-0"
              />
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto font-bold">
              <span className="text-slate uppercase text-[10px]">Trạng Thái:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3.5 py-2 bg-fog border border-chalk rounded-xl text-xs font-bold text-carbon focus:outline-none focus:border-signal-orange focus:ring-0"
              >
                <option value="">Tất cả trạng thái</option>
                <option value="ISSUED">Đã phát hành</option>
                <option value="SURRENDERED">Đã nộp B/L gốc</option>
                <option value="TELEX_RELEASED">Điện giao hàng</option>
                <option value="CANCELLED">Đã hủy</option>
              </select>
            </div>
          </div>

          {/* Table Danh Sách Vận Đơn */}
          <div className="bg-white border border-chalk rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex justify-between items-center border-b border-chalk pb-3">
              <div>
                <h3 className="font-heading text-lg font-extrabold text-carbon">
                  Danh mục vận đơn đường biển
                </h3>
                <p className="text-xs text-slate font-mono mt-0.5">
                  Hiển thị {billsOfLading.length} vận đơn trong hệ thống
                </p>
              </div>
              <span className="text-xs text-slate font-mono font-bold">Cập nhật lúc: vừa xong</span>
            </div>

            {billsOfLading.length === 0 ? (
              <div className="p-12 text-center text-slate space-y-2 font-sans">
                <span className="material-symbols-outlined text-4xl text-slate">description</span>
                <p className="font-bold text-sm">Không tìm thấy vận đơn nào phù hợp với bộ lọc!</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1000px] text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-fog text-slate font-bold uppercase text-[10px] border-b border-chalk">
                      <th className="py-3 px-3 whitespace-nowrap">Mã vận đơn</th>
                      <th className="py-3 px-3 whitespace-nowrap">Loại B/L</th>
                      <th className="py-3 px-3 whitespace-nowrap">Chuyến tàu</th>
                      <th className="py-3 px-3 min-w-[180px]">Người nhận hàng</th>
                      <th className="py-3 px-3 whitespace-nowrap">Số container</th>
                      <th className="py-3 px-3 whitespace-nowrap">Cước biển</th>
                      <th className="py-3 px-3 whitespace-nowrap">Phụ phí cảng</th>
                      <th className="py-3 px-3 whitespace-nowrap">Trạng thái B/L</th>
                      <th className="py-3 px-3 text-right whitespace-nowrap">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-chalk font-medium font-mono">
                    {billsOfLading
                      .slice((blPage - 1) * blPageSize, blPage * blPageSize)
                      .map((bl) => (
                      <tr key={bl.id} className="hover:bg-fog/60 transition-colors">
                        <td className="py-3.5 px-3 font-bold text-carbon text-sm whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span>{bl.blNumber}</span>
                            {bl.edoIssued ? (
                              <span className="text-[9px] bg-emerald-100 text-emerald-800 font-sans font-bold px-1.5 py-0.5 rounded border border-emerald-300" title={`Đã cấp lệnh eDO: ${bl.edoNumber}`}>
                                eDO
                              </span>
                            ) : bl.lastCancelledEdo ? (
                              <span className="text-[9px] bg-amber-100 text-amber-800 font-sans font-bold px-1.5 py-0.5 rounded border border-amber-300" title={`Lệnh eDO cũ đã hủy: ${bl.lastCancelledEdo.edoNumber}`}>
                                eDO đã hủy
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td className="py-3.5 px-3 font-sans whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                              bl.direction === 'EXPORT'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-purple-100 text-purple-800'
                            }`}>
                              {bl.direction === 'EXPORT' ? 'Xuất khẩu' : 'Nhập khẩu'}
                            </span>
                            <ShippingBadge status={bl.blType} />
                          </div>
                        </td>
                        <td className="py-3.5 px-3 font-bold text-carbon whitespace-nowrap">{bl.voyageNumber}</td>
                        <td className="py-3.5 px-3 font-sans text-carbon text-[11px] max-w-[200px] truncate" title={bl.consignee}>
                          {bl.consignee}
                        </td>
                        <td className="py-3.5 px-3 font-bold text-carbon whitespace-nowrap">
                          {bl.containers?.length || 0} container
                        </td>
                        <td className="py-3.5 px-3 font-sans whitespace-nowrap">
                          <ShippingBadge status={bl.freightStatus} />
                        </td>
                        <td className="py-3.5 px-3 font-sans whitespace-nowrap">
                          <ShippingBadge status={bl.localChargesStatus} />
                        </td>
                        <td className="py-3.5 px-3 font-sans whitespace-nowrap">
                          <ShippingBadge status={bl.status} />
                        </td>
                        <td className="py-3.5 px-3 text-right font-sans whitespace-nowrap">
                          <button
                            onClick={() => handleSelectBl(bl)}
                            className="px-3 py-1.5 text-xs font-bold text-carbon bg-fog hover:bg-chalk border border-chalk rounded-xl transition-colors cursor-pointer"
                          >
                            Chi tiết &rarr;
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Phân trang danh sách Vận đơn */}
            <div className="-mx-6 -mb-6">
              <ShippingPagination
                currentPage={blPage}
                totalItems={billsOfLading.length}
                pageSize={blPageSize}
                onPageChange={setBlPage}
                onPageSizeChange={setBlPageSize}
                itemName="vận đơn"
              />
            </div>
          </div>

        </div>
      )}

      {/* ── 3. VIEW: CHI TIẾT VẬN ĐƠN & CONTAINER ── */}
      {activeTab === 'DETAIL' && selectedBl && (
        <div className="space-y-6">
          
          {/* Card Thông Tin Chung B/L */}
          <div className="bg-white border border-chalk rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-chalk pb-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-heading text-xl font-extrabold text-carbon">
                    Vận đơn: {selectedBl.blNumber}
                  </h3>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                    selectedBl.direction === 'EXPORT'
                      ? 'bg-blue-100 text-blue-800 border border-blue-200'
                      : 'bg-purple-100 text-purple-800 border border-purple-200'
                  }`}>
                    {selectedBl.direction === 'EXPORT' ? 'Hàng xuất khẩu' : 'Hàng nhập khẩu'}
                  </span>
                  <ShippingBadge status={selectedBl.status} />
                  <ShippingBadge status={selectedBl.blType} />
                  {selectedBl.edoIssued ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                      <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse"></span>
                      Đã cấp eDO: {selectedBl.edoNumber}
                    </span>
                  ) : selectedBl.lastCancelledEdo ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
                      <span className="material-symbols-outlined text-xs">history</span>
                      Lệnh eDO cũ đã hủy ({selectedBl.lastCancelledEdo.edoNumber})
                    </span>
                  ) : null}
                </div>
                <p className="text-xs text-slate font-mono mt-1">
                  Chuyến tàu: <b>{selectedBl.voyageNumber}</b> | Tàu: <b>{selectedBl.vesselName}</b>
                </p>
              </div>

              {/* Action Buttons: Status updates & eDO Issue */}
              <div className="flex flex-wrap items-center gap-2">
                {selectedBl.status === 'DRAFT' && (
                  <button
                    onClick={() => handleUpdateBlStatus('ISSUED')}
                    disabled={saving}
                    className="px-3.5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-sm">publish</span>
                    <span>Phát hành B/L chính thức</span>
                  </button>
                )}

                {selectedBl.blType === 'ORIGINAL' && selectedBl.status === 'ISSUED' && (
                  <button
                    onClick={() => handleUpdateBlStatus('SURRENDERED')}
                    disabled={saving}
                    className="px-3.5 py-2 text-xs font-bold text-white bg-purple-700 hover:bg-purple-800 rounded-xl shadow-sm transition-all cursor-pointer"
                  >
                    Xác nhận thu hồi B/L gốc
                  </button>
                )}

                {(selectedBl.localChargesStatus === 'UNPAID' || (selectedBl.freightStatus === 'COLLECT' && !selectedBl.freightPaid)) && (
                  <button
                    onClick={() => handleCollectFeesForBl(selectedBl.id)}
                    disabled={saving}
                    className="px-3.5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-sm">payments</span>
                    <span>Xác nhận thu đủ phí</span>
                  </button>
                )}

                {/* Kiểm soát nghiệp vụ eDO: D/O chỉ phát hành ở chiều Nhập khẩu, không phát hành ở chiều Xuất khẩu */}
                {selectedBl.direction === 'EXPORT' ? (
                  <div
                    className="px-3.5 py-2 text-xs font-bold text-slate-500 bg-slate-100 border border-slate-300 rounded-xl flex items-center gap-1.5 select-none"
                    title="Theo quy tắc hàng hải quốc tế, Lệnh giao hàng (D/O / eDO) chỉ phát hành cho hàng NHẬP KHẨU tại cảng đến, không áp dụng cho hàng xuất khẩu."
                  >
                    <span className="material-symbols-outlined text-sm text-slate-400">do_not_disturb_on</span>
                    <span>Không cấp eDO (Hàng xuất khẩu)</span>
                  </div>
                ) : selectedBl.status === 'DRAFT' ? (
                  <div
                    className="px-3.5 py-2 text-xs font-bold text-slate-500 bg-slate-100 border border-slate-300 rounded-xl flex items-center gap-1.5 select-none"
                    title="Vận đơn đang ở trạng thái bản nháp. Cần phát hành chính thức trước khi cấp lệnh eDO."
                  >
                    <span className="material-symbols-outlined text-sm text-slate-400">lock</span>
                    <span>B/L bản nháp (Chưa thể cấp eDO)</span>
                  </div>
                ) : selectedBl.edoIssued ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleViewEdo(selectedBl.activeEdo || selectedBl.edoNumber)}
                      className="px-3.5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
                      title="Xem chi tiết bản in lệnh eDO đang có hiệu lực"
                    >
                      <span className="material-symbols-outlined text-base">receipt_long</span>
                      <span>Xem lệnh eDO ({selectedBl.edoNumber})</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleCancelEdoForBl(selectedBl.activeEdo?.id || selectedBl.edoNumber)}
                      disabled={saving}
                      className="px-3 py-2 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-300 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                      title="Hủy lệnh eDO hiện tại để mở quyền phát hành lại lệnh mới"
                    >
                      <span className="material-symbols-outlined text-sm text-rose-600">cancel</span>
                      <span>Hủy lệnh eDO để cấp lại</span>
                    </button>

                    <div
                      className="px-3 py-2 text-xs font-bold text-slate-500 bg-slate-100 border border-slate-300 rounded-xl flex items-center gap-1 select-none cursor-not-allowed"
                      title="Vận đơn đã có lệnh eDO đang hiệu lực. Nghiệp vụ hàng hải nghiêm cấm phát hành trùng 2 lệnh."
                    >
                      <span className="material-symbols-outlined text-sm text-slate-400">lock</span>
                      <span>Đã cấp lệnh eDO</span>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setEdoTargetBl(selectedBl.blNumber);
                      setShowEdoModal(true);
                    }}
                    className="px-4 py-2 text-xs font-bold text-white bg-signal-orange hover:opacity-90 rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-base">assignment_turned_in</span>
                    <span>{selectedBl.lastCancelledEdo ? 'Cấp lại lệnh eDO mới' : 'Phát hành eDO cho B/L này'}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Thông báo nghiệp vụ nếu eDO cũ đã bị hủy */}
            {selectedBl.lastCancelledEdo && !selectedBl.edoIssued && (
              <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-900 flex items-start justify-between gap-3 font-sans">
                <div className="flex items-start gap-2.5">
                  <span className="material-symbols-outlined text-amber-700 text-base shrink-0 mt-0.5">info</span>
                  <div>
                    <span className="font-bold">Lưu ý nghiệp vụ:</span> Lệnh giao hàng điện tử trước đó (<b>{selectedBl.lastCancelledEdo.edoNumber}</b>) đã bị hủy lúc {selectedBl.lastCancelledEdo.cancelledAt} (Lý do: <i>{selectedBl.lastCancelledEdo.reason}</i>). Vận đơn này hiện <b>đủ điều kiện để phát hành lại lệnh eDO mới</b>.
                  </div>
                </div>
              </div>
            )}

            {/* Thông tin đối tác Shipper - Consignee - Cước */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-sans">
              <div className="bg-fog rounded-xl border border-chalk p-4 space-y-1">
                <span className="text-[10px] font-bold text-slate uppercase">Người gửi hàng</span>
                <div className="font-bold text-carbon text-sm">{selectedBl.shipper}</div>
                <div className="text-slate text-[11px] mt-1">Cảng bốc: {selectedBl.pol}</div>
              </div>

              <div className="bg-fog rounded-xl border border-chalk p-4 space-y-1">
                <span className="text-[10px] font-bold text-slate uppercase">Người nhận hàng</span>
                <div className="font-bold text-carbon text-sm">{selectedBl.consignee}</div>
                <div className="text-slate text-[11px] mt-1">Cảng dỡ: {selectedBl.pod}</div>
              </div>

              <div className="bg-fog rounded-xl border border-chalk p-4 space-y-1">
                <span className="text-[10px] font-bold text-slate uppercase">Tài chính &amp; phụ phí</span>
                <div className="flex justify-between items-center text-[11px]">
                  <span>Cước biển:</span>
                  <ShippingBadge status={selectedBl.freightStatus} />
                </div>
                <div className="flex justify-between items-center text-[11px]">
                  <span>Phụ phí địa phương:</span>
                  <ShippingBadge status={selectedBl.localChargesStatus} />
                </div>
              </div>
            </div>
          </div>

          {/* Table Container thuộc Vận đơn */}
          <div className="bg-white border border-chalk rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex justify-between items-center border-b border-chalk pb-3">
              <h3 className="font-heading text-lg font-extrabold text-carbon">
                Danh sách container trong vận đơn ({selectedBl.containers?.length || 0})
              </h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[950px] text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-fog text-slate font-bold uppercase text-[10px] border-b border-chalk">
                    <th className="py-3 px-3">Số container</th>
                    <th className="py-3 px-3">Loại ISO</th>
                    <th className="py-3 px-3">Số niêm chì</th>
                    <th className="py-3 px-3">Trọng lượng (kg)</th>
                    <th className="py-3 px-3 min-w-[240px]">Phân loại hàng &amp; Thông số đặc thù</th>
                    <th className="py-3 px-3 text-right">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-chalk font-medium font-mono">
                  {(selectedBl.containers || [])
                    .slice((contPage - 1) * contPageSize, contPage * contPageSize)
                    .map((c, idx) => (
                    <tr key={idx} className="hover:bg-fog/60 transition-colors">
                      <td className="py-3.5 px-3 font-bold text-carbon text-sm">{c.containerNumber}</td>
                      <td className="py-3.5 px-3 font-bold text-carbon">{c.isoType}</td>
                      <td className="py-3.5 px-3 font-bold text-carbon">{c.sealNumber}</td>
                      <td className="py-3.5 px-3">{c.grossWeightKg?.toLocaleString()} KG</td>
                      <td className="py-3.5 px-3 font-sans">
                        {c.unNumber || c.dgClass || c.cargoType === 'DG' || c.cargoType === 'DANGEROUS' ? (
                          <div className="space-y-1">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                              <span className="material-symbols-outlined text-xs text-amber-700">warning</span>
                              Hàng nguy hiểm: {c.unNumber || 'UN 1993'} ({c.dgClass || 'Class 3'})
                            </span>
                            <div className="text-[10px] flex items-center gap-2 text-slate font-sans">
                              <span className={c.hasDgd || c.dgdFile ? 'text-emerald-700 font-bold' : 'text-red-600 font-bold'}>
                                Bản khai DGD: {c.hasDgd || c.dgdFile ? '✓ Đã nộp' : '✕ Thiếu'}
                              </span>
                              <span>•</span>
                              <span className={c.hasMsds || c.msdsFile ? 'text-emerald-700 font-bold' : 'text-red-600 font-bold'}>
                                Phiếu MSDS: {c.hasMsds || c.msdsFile ? '✓ Đã duyệt' : '✕ Thiếu'}
                              </span>
                            </div>
                          </div>
                        ) : (c.isoType && c.isoType.includes('RF')) || c.cargoType === 'REEFER' || c.tempRequired ? (
                          <div className="space-y-1">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-50 text-sky-800 border border-sky-300">
                              <span className="material-symbols-outlined text-xs">ac_unit</span>
                              Hàng lạnh: {c.tempRequired || '-18.0°C'}
                            </span>
                            <div className="text-[10px] text-slate font-sans">
                              Gió: {c.ventilation || '25 CBM/h'} · Ẩm: {c.humidity || '85%'}
                            </div>
                          </div>
                        ) : (c.isoType && (c.isoType.includes('FR') || c.isoType.includes('OT'))) || c.cargoType === 'OOG' || c.overHeightCm ? (
                          <div className="space-y-1">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-800 border border-purple-300">
                              <span className="material-symbols-outlined text-xs">straighten</span>
                              Quá khổ: OH +{c.overHeightCm || 45}cm · OW +{c.overWidthCm || 30}cm
                            </span>
                            <div className="text-[10px] text-slate font-sans">
                              KT: {c.dimensions || '12.2 x 2.6 x 3.1 m'}
                            </div>
                          </div>
                        ) : c.cargoType === 'CONDITIONAL' || c.quarantineType || c.certificateNo ? (
                          <div className="space-y-1">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-300">
                              <span className="material-symbols-outlined text-xs">eco</span>
                              Kiểm dịch: {c.quarantineType || 'Thực vật'}
                            </span>
                            <div className="text-[10px] text-slate font-sans">
                              GCN: {c.certificateNo || 'KD-2026-8812'}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate text-[11px] font-sans">Hàng bách hóa thông thường</span>
                        )}
                      </td>
                      <td className="py-3.5 px-3 text-right font-sans">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border bg-emerald-50 text-emerald-700 border-emerald-300">
                          ● Sẵn sàng giao hàng
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Khối Chứng từ & An toàn hóa chất đính kèm (nếu có container nguy hiểm / đặc thù) */}
            {(selectedBl.containers || []).some(c => c.unNumber || c.cargoType === 'DG' || c.dgdFile || c.msdsFile) && (
              <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200 mt-3 space-y-2 font-sans">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-amber-700 text-base">description</span>
                  <strong className="text-amber-950 font-bold text-xs uppercase">
                    Hồ sơ an toàn hóa chất &amp; Chứng từ vận chuyển nguy hiểm (DG Documents):
                  </strong>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                  <div className="flex items-center justify-between p-2.5 bg-white rounded-lg border border-amber-200 text-xs">
                    <div className="flex items-center gap-2 truncate">
                      <span className="material-symbols-outlined text-red-600 text-lg">picture_as_pdf</span>
                      <div>
                        <div className="font-bold text-carbon">Bản khai hàng nguy hiểm (DGD)</div>
                        <div className="text-[10px] text-slate font-mono">DGD_IMO_Signed_UN1993.pdf</div>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 shrink-0">
                      Đã duyệt ✓
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-2.5 bg-white rounded-lg border border-amber-200 text-xs">
                    <div className="flex items-center gap-2 truncate">
                      <span className="material-symbols-outlined text-red-600 text-lg">picture_as_pdf</span>
                      <div>
                        <div className="font-bold text-carbon">Phiếu an toàn hóa chất (MSDS)</div>
                        <div className="text-[10px] text-slate font-mono">MSDS_Chemical_Safety_UN1993.pdf</div>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 shrink-0">
                      Đã thẩm định ✓
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Phân trang Container thuộc Vận đơn */}
            {(selectedBl.containers?.length || 0) > 0 && (
              <div className="-mx-6 -mb-6">
                <ShippingPagination
                  currentPage={contPage}
                  totalItems={selectedBl.containers?.length || 0}
                  pageSize={contPageSize}
                  onPageChange={setContPage}
                  onPageSizeChange={setContPageSize}
                  itemName="container"
                />
              </div>
            )}
          </div>

        </div>
      )}

      {/* ── MODAL: TẠO VẬN ĐƠN MỚI ── */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-chalk max-w-4xl w-full overflow-hidden animate-fadeIn flex flex-col max-h-[92vh]">
            
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-chalk bg-fog flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-xl text-signal-orange">note_add</span>
                <div>
                  <h3 className="font-heading text-lg font-extrabold text-carbon">
                    Tạo vận đơn đường biển (B/L) mới
                  </h3>
                  <p className="text-xs text-slate mt-0.5">
                    Khai báo hải trình, thông tin pháp lý giải phóng hàng và thẩm định danh sách container
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="w-8 h-8 rounded-lg text-slate hover:bg-chalk flex items-center justify-center cursor-pointer font-bold text-lg"
              >
                &times;
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5 text-xs font-sans overflow-y-auto flex-1">
              {error && (
                <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center justify-between">
                  <span className="font-medium">{error}</span>
                  <button onClick={() => setError('')} className="text-red-600 font-bold px-2">✕</button>
                </div>
              )}

              {/* KHỐI 1: HƯỚNG VẬN CHUYỂN & CHẾ ĐỘ NẠP NGUỒN */}
              <div className="p-4 rounded-xl bg-fog/70 border border-chalk space-y-3.5">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-[11px] font-bold text-carbon uppercase block">
                      Hướng vận chuyển *
                    </span>
                    <span className="text-[11px] text-slate">
                      Quy định thẩm quyền phát hành và quy trình giải phóng hàng hóa
                    </span>
                  </div>

                  <div className="flex bg-white p-1 rounded-xl border border-chalk text-xs font-bold">
                    <button
                      type="button"
                      onClick={() => handleDirectionChange('IMPORT')}
                      className={`px-4 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                        createForm.direction === 'IMPORT'
                          ? 'bg-purple-700 text-white shadow-xs'
                          : 'text-slate hover:text-carbon'
                      }`}
                    >
                      <span className="material-symbols-outlined text-sm">download</span>
                      <span>Nhập khẩu (Đến Cảng Tiên Sa)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDirectionChange('EXPORT')}
                      className={`px-4 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                        createForm.direction === 'EXPORT'
                          ? 'bg-blue-700 text-white shadow-xs'
                          : 'text-slate hover:text-carbon'
                      }`}
                    >
                      <span className="material-symbols-outlined text-sm">upload</span>
                      <span>Xuất khẩu (Từ Cảng Tiên Sa)</span>
                    </button>
                  </div>
                </div>

                {/* Chế độ nạp dữ liệu theo chiều */}
                <div className="pt-2 border-t border-chalk/80">
                  {createForm.direction === 'IMPORT' ? (
                    <div className="space-y-2.5">
                      <div className="flex items-center gap-4 text-xs">
                        <label className="flex items-center gap-1.5 font-bold text-carbon cursor-pointer">
                          <input
                            type="radio"
                            name="importSourceMode"
                            checked={sourceMode === 'MANIFEST'}
                            onChange={() => setSourceMode('MANIFEST')}
                            className="text-signal-orange focus:ring-0"
                          />
                          <span>Trích xuất từ Bản khai nhập (Import Manifest)</span>
                        </label>
                        <label className="flex items-center gap-1.5 font-bold text-carbon cursor-pointer">
                          <input
                            type="radio"
                            name="importSourceMode"
                            checked={sourceMode === 'MANUAL'}
                            onChange={() => setSourceMode('MANUAL')}
                            className="text-signal-orange focus:ring-0"
                          />
                          <span>Khai báo thủ công</span>
                        </label>
                      </div>

                      {sourceMode === 'MANIFEST' && (
                        <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
                          <span className="text-[11px] text-slate shrink-0">Chọn bản khai:</span>
                          <select
                            value={selectedManifestId}
                            onChange={(e) => handleSelectManifest(e.target.value)}
                            className="w-full px-3 py-1.5 bg-white border border-chalk rounded-xl text-carbon font-bold focus:outline-none focus:border-signal-orange focus:ring-0 text-xs"
                          >
                            <option value="">-- Chọn bản khai nhập khẩu sẵn có --</option>
                            {manifests
                              .filter(m => m.direction === 'IMPORT')
                              .map(m => (
                                <option key={m.id} value={m.id}>
                                  {m.manifestNumber} · Chuyến {m.voyageNumber} ({m.totalContainers || m.records?.length || 0} cont - {m.records?.[0]?.commodity || 'Hàng nhập'})
                                </option>
                              ))}
                          </select>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      <div className="flex items-center gap-4 text-xs">
                        <label className="flex items-center gap-1.5 font-bold text-carbon cursor-pointer">
                          <input
                            type="radio"
                            name="exportSourceMode"
                            checked={sourceMode === 'SI'}
                            onChange={() => setSourceMode('SI')}
                            className="text-signal-orange focus:ring-0"
                          />
                          <span>Tạo từ Chỉ dẫn gửi hàng (SI - Shipping Instruction)</span>
                        </label>
                        <label className="flex items-center gap-1.5 font-bold text-carbon cursor-pointer">
                          <input
                            type="radio"
                            name="exportSourceMode"
                            checked={sourceMode === 'AUTO_CODE'}
                            onChange={() => setSourceMode('AUTO_CODE')}
                            className="text-signal-orange focus:ring-0"
                          />
                          <span>Hệ thống tự cấp mã B/L xuất khẩu</span>
                        </label>
                      </div>

                      {sourceMode === 'SI' && (
                        <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
                          <span className="text-[11px] text-slate shrink-0">Chọn hồ sơ SI:</span>
                          <select
                            value={selectedSiId}
                            onChange={(e) => handleSelectSi(e.target.value)}
                            className="w-full px-3 py-1.5 bg-white border border-chalk rounded-xl text-carbon font-bold focus:outline-none focus:border-signal-orange focus:ring-0 text-xs"
                          >
                            <option value="">-- Chọn Chỉ dẫn gửi hàng (SI) đã nộp --</option>
                            {shippingInstructions.map(si => (
                              <option key={si.id} value={si.id}>
                                {si.siNumber} · Booking: {si.bookingNumber} · {si.shipper} &rarr; {si.consignee} ({si.cargoDescription})
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* KHỐI 2: CHUYẾN TÀU, HÀNH TRÌNH & LOẠI VẬN ĐƠN */}
              <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-carbon uppercase mb-1">
                      Chuyến tàu thực hiện *
                    </label>
                    <select
                      value={createForm.voyageNumber}
                      onChange={(e) => setCreateForm({ ...createForm, voyageNumber: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-fog border border-chalk rounded-xl text-carbon font-bold focus:outline-none focus:border-signal-orange focus:ring-0 text-xs"
                    >
                      {voyages
                        .filter(v => {
                          if (createForm.direction === 'IMPORT') {
                            return (v.pod && (v.pod.includes('Tiên Sa') || v.pod.includes('VNDAD'))) || v.direction === 'IMPORT' || v.direction === 'INBOUND';
                          } else {
                            return (v.pol && (v.pol.includes('Tiên Sa') || v.pol.includes('VNDAD'))) || v.direction === 'EXPORT' || v.direction === 'OUTBOUND';
                          }
                        })
                        .map((v) => (
                          <option key={v.id} value={v.voyageNumber}>
                            {v.voyageNumber} · {v.vesselName} ({v.pol} &rarr; {v.pod})
                          </option>
                        ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-carbon uppercase mb-1">
                      Loại vận đơn hàng hải *
                    </label>
                    <select
                      value={createForm.blType}
                      onChange={(e) => setCreateForm({ ...createForm, blType: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-fog border border-chalk rounded-xl text-carbon font-bold focus:outline-none focus:border-signal-orange focus:ring-0 text-xs"
                    >
                      <option value="SEAWAY_BILL">Vận đơn đường biển (Sea Waybill - Giao hàng không giữ chứng từ)</option>
                      <option value="ORIGINAL">Bản gốc (Original B/L - Bắt buộc thu hồi bản gốc trước khi nhả hàng)</option>
                      <option value="TELEX_RELEASE">Điện giao hàng (Telex Release - Nhả hàng theo điện tín hãng tàu)</option>
                    </select>
                  </div>
                </div>

                {/* Thẻ tóm tắt hành trình chuyến tàu */}
                {(() => {
                  const currentVoy = voyages.find(v => v.voyageNumber === createForm.voyageNumber) || voyages[0];
                  if (!currentVoy) return null;
                  return (
                    <div className="p-3 rounded-xl bg-slate-50 border border-chalk grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div>
                        <span className="text-[10px] text-slate uppercase block font-bold">Tên tàu</span>
                        <strong className="text-carbon font-heading text-xs block truncate">{currentVoy.vesselName}</strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate uppercase block font-bold">Cảng bốc (POL)</span>
                        <span className="text-carbon font-medium block truncate">{currentVoy.pol}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate uppercase block font-bold">Cảng dỡ (POD)</span>
                        <span className="text-carbon font-medium block truncate">{currentVoy.pod}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate uppercase block font-bold">Kế hoạch cập bến</span>
                        <span className="text-carbon font-mono text-[11px] block">
                          {currentVoy.eta ? `ETA: ${currentVoy.eta}` : (currentVoy.berth || 'Cầu bến Tiên Sa (TS-01)')}
                        </span>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* KHỐI 3: THÔNG TIN VẬN ĐƠN & ĐỐI TÁC */}
              <div className="space-y-4 pt-1">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[11px] font-bold text-carbon uppercase">
                        Mã Vận Đơn (B/L) *
                      </label>
                      {createForm.direction === 'EXPORT' && (
                        <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                          Hệ thống tự sinh
                        </span>
                      )}
                    </div>
                    <input
                      type="text"
                      required
                      readOnly={createForm.direction === 'EXPORT'}
                      value={createForm.blNumber}
                      onChange={(e) => setCreateForm({ ...createForm, blNumber: e.target.value.toUpperCase() })}
                      placeholder={createForm.direction === 'EXPORT' ? 'Hệ thống tự động cấp mã B/L xuất...' : 'VD: BL-INB-DAD-2605'}
                      className={`w-full px-3 py-2 border rounded-xl font-mono text-carbon font-bold focus:outline-none uppercase text-xs ${
                        createForm.direction === 'EXPORT'
                          ? 'bg-slate-100 border-chalk text-slate-600 cursor-not-allowed'
                          : 'bg-fog border-chalk focus:border-signal-orange focus:ring-0'
                      }`}
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-carbon uppercase mb-1">
                      Người gửi hàng (Shipper)
                    </label>
                    <input
                      type="text"
                      value={createForm.shipper}
                      onChange={(e) => setCreateForm({ ...createForm, shipper: e.target.value })}
                      placeholder="VD: CÔNG TY XUẤT NHẬP KHẨU..."
                      className="w-full px-3 py-2 bg-fog border border-chalk rounded-xl text-carbon focus:outline-none focus:border-signal-orange focus:ring-0 text-xs"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[11px] font-bold text-carbon uppercase">
                        Người nhận hàng (Consignee) <span className="text-rose-600 font-extrabold">*</span>
                      </label>
                      <span className="text-[10px] text-rose-600 font-bold">Bắt buộc</span>
                    </div>
                    <input
                      type="text"
                      required
                      value={createForm.consignee}
                      onChange={(e) => setCreateForm({ ...createForm, consignee: e.target.value })}
                      placeholder="VD: CÔNG TY TNHH TIẾP VẬN..."
                      className="w-full px-3 py-2 bg-fog border border-chalk rounded-xl text-carbon font-semibold focus:outline-none focus:border-signal-orange focus:ring-0 text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-carbon uppercase mb-1">
                      Bên được thông báo (Notify Party)
                    </label>
                    <input
                      type="text"
                      value={createForm.notifyParty}
                      onChange={(e) => setCreateForm({ ...createForm, notifyParty: e.target.value })}
                      placeholder="VD: Same as Consignee hoặc đại lý nhận hàng..."
                      className="w-full px-3 py-2 bg-fog border border-chalk rounded-xl text-carbon focus:outline-none focus:border-signal-orange focus:ring-0 text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-carbon uppercase mb-1">
                      Mô tả hàng hóa
                    </label>
                    <input
                      type="text"
                      value={createForm.cargoDescription}
                      onChange={(e) => setCreateForm({ ...createForm, cargoDescription: e.target.value })}
                      placeholder="VD: Linh kiện điện tử, phụ tùng máy móc..."
                      className="w-full px-3 py-2 bg-fog border border-chalk rounded-xl text-carbon focus:outline-none focus:border-signal-orange focus:ring-0 text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-carbon uppercase mb-1">Số kiện &amp; Đơn vị</label>
                    <div className="flex gap-1.5">
                      <input
                        type="number"
                        value={createForm.packageCount}
                        onChange={(e) => setCreateForm({ ...createForm, packageCount: Number(e.target.value) })}
                        className="w-1/2 px-2.5 py-1.5 bg-fog border border-chalk rounded-xl font-mono text-carbon font-bold focus:outline-none text-xs"
                      />
                      <input
                        type="text"
                        value={createForm.packageUnit}
                        onChange={(e) => setCreateForm({ ...createForm, packageUnit: e.target.value })}
                        placeholder="Cartons"
                        className="w-1/2 px-2.5 py-1.5 bg-fog border border-chalk rounded-xl text-carbon focus:outline-none text-xs"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-carbon uppercase mb-1">Tổng VGM (kg)</label>
                    <input
                      type="number"
                      value={createForm.grossWeightKg}
                      onChange={(e) => setCreateForm({ ...createForm, grossWeightKg: Number(e.target.value) })}
                      className="w-full px-3 py-1.5 bg-fog border border-chalk rounded-xl font-mono text-carbon font-bold focus:outline-none text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-carbon uppercase mb-1">Thể tích (CBM)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={createForm.measurementCbm}
                      onChange={(e) => setCreateForm({ ...createForm, measurementCbm: Number(e.target.value) })}
                      className="w-full px-3 py-1.5 bg-fog border border-chalk rounded-xl font-mono text-carbon font-bold focus:outline-none text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-carbon uppercase mb-1">Điều khoản cước</label>
                    <div className="flex gap-1.5">
                      <select
                        value={createForm.freightStatus}
                        onChange={(e) => setCreateForm({ ...createForm, freightStatus: e.target.value })}
                        className="w-1/2 px-2 py-1.5 bg-fog border border-chalk rounded-xl text-carbon font-bold text-xs"
                      >
                        <option value="PREPAID">Trả trước</option>
                        <option value="COLLECT">Trả sau</option>
                      </select>
                      <input
                        type="number"
                        value={createForm.freightAmountUsd}
                        onChange={(e) => setCreateForm({ ...createForm, freightAmountUsd: Number(e.target.value) })}
                        placeholder="$ USD"
                        className="w-1/2 px-2 py-1.5 bg-fog border border-chalk rounded-xl font-mono text-carbon font-bold text-xs"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* KHỐI 4: DANH SÁCH CONTAINER & THẨM ĐỊNH THỜI GIAN THỰC (KHÔNG CHO PHÉP NHẬP TAY TEXTAREA) */}
              <div className="border border-chalk rounded-2xl p-4 bg-white space-y-3.5">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-chalk pb-3">
                  <div>
                    <span className="font-heading font-extrabold text-carbon text-xs block">
                      Danh sách container trong vận đơn ({previewContainers.length})
                    </span>
                    <span className="text-[11px] text-slate mt-0.5 block">
                      Tải tệp CSV từ máy tính hoặc trích xuất tự động từ Bản khai / SI. Hệ thống tự động thẩm định ISO 6346 và kiểm tra trùng chuyến.
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleDownloadSampleCsv}
                      className="px-3 py-1.5 bg-fog hover:bg-chalk border border-chalk rounded-xl text-xs font-bold text-carbon transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-sm">download</span>
                      <span>Tải tệp mẫu CSV</span>
                    </button>

                    <label className="px-3.5 py-1.5 bg-signal-orange hover:opacity-90 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-sm">upload_file</span>
                      <span>{uploadedFileName ? 'Nạp tệp CSV khác' : 'Chọn tệp CSV từ máy'}</span>
                      <input
                        type="file"
                        accept=".csv,.txt"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </label>

                    {previewContainers.length > 0 && (
                      <button
                        type="button"
                        onClick={handleRemoveUploadedFile}
                        className="px-2.5 py-1.5 text-xs text-red-600 hover:bg-red-50 border border-red-200 rounded-xl transition-colors font-bold cursor-pointer"
                        title="Xóa danh sách container hiện tại"
                      >
                        Xóa
                      </button>
                    )}
                  </div>
                </div>

                {/* Vùng tải file nếu danh sách container đang trống */}
                {previewContainers.length === 0 ? (
                  <div
                    onDragOver={(e) => { e.preventDefault(); setIsDraggingCsv(true); }}
                    onDragLeave={() => setIsDraggingCsv(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDraggingCsv(false);
                      const file = e.dataTransfer.files?.[0];
                      if (file) processCsvFile(file);
                    }}
                    className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all ${
                      isDraggingCsv
                        ? 'border-signal-orange bg-orange-50/50'
                        : 'border-chalk bg-fog/40 hover:bg-fog/70'
                    }`}
                  >
                    <div className="w-12 h-12 mx-auto rounded-xl bg-orange-100 text-signal-orange flex items-center justify-center mb-2">
                      <span className="material-symbols-outlined text-2xl">table_rows</span>
                    </div>
                    <h4 className="font-heading font-extrabold text-xs text-carbon mb-1">
                      Chưa có container nào trong vận đơn
                    </h4>
                    <p className="text-[11px] text-slate mb-3 max-w-sm mx-auto">
                      Kéo thả tệp CSV vào đây, hoặc nhấn nút <strong>&ldquo;Chọn tệp CSV từ máy&rdquo;</strong> ở trên để nạp danh sách container.
                    </p>
                    <div className="text-[10px] text-slate font-mono">
                      Cột chuẩn: Số container, Loại ISO, Số niêm chì, Khối lượng VGM (kg), Nhiệt độ cài đặt
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Thanh tóm tắt thẩm định */}
                    <div className="p-3 bg-fog rounded-xl border border-chalk flex flex-wrap items-center justify-between gap-2.5 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-lg bg-white border border-chalk font-bold text-carbon font-mono">
                          Tổng: {evaluatedContainers.length} container
                        </span>
                        <span className="px-2.5 py-0.5 rounded-lg bg-emerald-50 border border-emerald-300 font-bold text-emerald-800 font-mono">
                          ✓ Hợp lệ: {previewValidCount}
                        </span>
                        {previewErrorCount > 0 ? (
                          <span className="px-2.5 py-0.5 rounded-lg bg-red-50 border border-red-300 font-bold text-red-700 font-mono">
                            ⚠ Lỗi: {previewErrorCount} container
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-lg bg-emerald-100 text-emerald-900 font-bold">
                            ● 100% Đạt chuẩn hàng hải
                          </span>
                        )}
                      </div>

                      {uploadedFileName && (
                        <span className="text-[11px] text-slate font-mono">
                          Tệp nguồn: <b>{uploadedFileName}</b>
                        </span>
                      )}
                    </div>

                    {/* Bảng danh sách container thẩm định trực tiếp */}
                    <div className="overflow-x-auto border border-chalk rounded-xl max-h-56">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead className="bg-fog border-b border-chalk text-[10px] text-slate uppercase sticky top-0 z-10">
                          <tr>
                            <th className="py-2.5 px-3">STT</th>
                            <th className="py-2.5 px-3">Số Container</th>
                            <th className="py-2.5 px-3">Loại ISO</th>
                            <th className="py-2.5 px-3">Số chì (Seal)</th>
                            <th className="py-2.5 px-3">VGM (kg)</th>
                            <th className="py-2.5 px-3">Nhiệt độ</th>
                            <th className="py-2.5 px-3">Trạng thái thẩm định</th>
                            <th className="py-2.5 px-3 text-right">Xóa</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-chalk font-mono">
                          {evaluatedContainers.map((c, idx) => (
                            <tr key={idx} className={c.isValid ? 'hover:bg-fog/50' : 'bg-red-50/50 hover:bg-red-50'}>
                              <td className="py-2 px-3 text-slate text-[11px]">{idx + 1}</td>
                              <td className="py-2 px-3 font-bold text-carbon">
                                {c.containerNumber}
                              </td>
                              <td className="py-2 px-3">
                                <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 text-[10px] font-bold">
                                  {c.isoType}
                                </span>
                              </td>
                              <td className="py-2 px-3 text-carbon">{c.sealNumber || '—'}</td>
                              <td className="py-2 px-3 text-carbon font-bold">
                                {Number(c.grossWeightKg).toLocaleString()} kg
                              </td>
                              <td className="py-2 px-3 text-slate">{c.tempRequired || '—'}</td>
                              <td className="py-2 px-3 font-sans">
                                {c.isValid ? (
                                  <span className="inline-flex items-center gap-1 text-emerald-700 font-bold text-[11px]">
                                    <span className="material-symbols-outlined text-xs">check_circle</span>
                                    Hợp lệ
                                  </span>
                                ) : (
                                  <div className="space-y-0.5">
                                    {c.errors.map((errStr, eIdx) => (
                                      <span key={eIdx} className="block text-[10px] text-red-700 font-bold bg-red-100/80 px-1.5 py-0.5 rounded">
                                        ⚠ {errStr}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </td>
                              <td className="py-2 px-3 text-right">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveContainer(idx)}
                                  className="w-7 h-7 rounded-lg text-slate hover:text-red-600 hover:bg-white flex items-center justify-center transition-colors cursor-pointer ml-auto"
                                  title="Xóa dòng container này"
                                >
                                  <span className="material-symbols-outlined text-base">delete</span>
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-chalk bg-fog flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
              <div className="text-[11px] text-slate">
                {previewErrorCount > 0 ? (
                  <span className="text-red-700 font-bold flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">error</span>
                    Còn {previewErrorCount} lỗi kiểm tra. Vui lòng xử lý trước khi phát hành chính thức.
                  </span>
                ) : (
                  <span>
                    Chỉ phát hành khi các điều kiện kiểm tra đạt 100%. Bạn có thể lưu bản nháp để hoàn thiện sau.
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2.5 self-end">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-white border border-chalk text-carbon hover:bg-fog rounded-xl text-xs font-bold cursor-pointer"
                >
                  Hủy bỏ
                </button>

                <button
                  type="button"
                  onClick={() => handleCreateBl('DRAFT')}
                  disabled={saving}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-carbon font-bold rounded-xl text-xs transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-sm">save</span>
                  <span>{saving ? 'Đang lưu...' : 'Lưu bản nháp'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleCreateBl('ISSUED')}
                  disabled={saving || previewContainers.length === 0 || previewErrorCount > 0 || !createForm.consignee?.trim() || (createForm.direction === 'IMPORT' && !createForm.blNumber?.trim())}
                  className="px-5 py-2.5 bg-signal-orange hover:opacity-90 disabled:opacity-50 text-white font-bold rounded-xl text-xs shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-base">check_circle</span>
                  <span>{saving ? 'Đang phát hành...' : 'Tạo & Phát hành B/L'}</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Quick Modals */}
      <EdoIssueModal
        isOpen={showEdoModal}
        initialBlNumber={edoTargetBl}
        onClose={() => setShowEdoModal(false)}
        onSuccess={async (newEdo) => {
          setSuccessMsg(`Đã phát hành thành công lệnh eDO ${newEdo?.edoNumber || ''}`);
          if (selectedBl && newEdo?.blNumber === selectedBl.blNumber) {
            try {
              const res = await shippingLineApi.getBillOfLadingDetail(selectedBl.id);
              const detail = res?.blNumber ? res : (res?.data || null);
              if (detail) setSelectedBl(detail);
            } catch {
              // Ignore
            }
          }
          loadData();
        }}
      />

      {/* Bản in / Xem trước lệnh eDO */}
      <EdoPreviewModal
        isOpen={Boolean(previewingEdo)}
        edo={previewingEdo}
        onClose={() => setPreviewingEdo(null)}
      />

    </div>
  );
}
