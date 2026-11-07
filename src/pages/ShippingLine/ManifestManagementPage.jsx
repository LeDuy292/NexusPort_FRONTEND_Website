import React, { useState, useEffect } from 'react';
import { shippingLineApi, formatApiErrorMessage } from './api/shippingLineApi';
import ShippingBadge from './components/ShippingBadge';
import ShippingPagination from './components/ShippingPagination';

// Helper định dạng trọng lượng tiếng Việt (dấu chấm phân tách hàng nghìn, viết thường kg)
function formatKg(weight) {
  if (weight === null || weight === undefined || weight === '' || isNaN(weight)) return '—';
  return `${Number(weight).toLocaleString('vi-VN')} kg`;
}

// Thuật toán kiểm tra chữ số kiểm tra ISO 6346 (4 chữ cái + 7 chữ số)
export function checkIso6346(containerNo) {
  if (!containerNo || typeof containerNo !== 'string') {
    return { isValid: false, reason: 'Số container không được để trống' };
  }
  const clean = containerNo.trim().toUpperCase();
  if (clean.length !== 11) {
    return { isValid: false, reason: 'Số container phải có đúng 11 ký tự (4 chữ cái + 7 chữ số)' };
  }
  const isoRegex = /^[A-Z]{4}\d{7}$/;
  if (!isoRegex.test(clean)) {
    return { isValid: false, reason: 'Định dạng phải gồm 4 chữ cái in hoa và 7 chữ số' };
  }

  const charValues = {
    A: 10, B: 12, C: 13, D: 14, E: 15, F: 16, G: 17, H: 18, I: 19, J: 20,
    K: 21, L: 23, M: 24, N: 25, O: 26, P: 27, Q: 28, R: 29, S: 30, T: 31,
    U: 32, V: 34, W: 35, X: 36, Y: 37, Z: 38,
  };

  let sum = 0;
  for (let i = 0; i < 10; i++) {
    const char = clean[i];
    const val = (char >= '0' && char <= '9') ? parseInt(char, 10) : charValues[char];
    sum += val * Math.pow(2, i);
  }

  const remainder = sum % 11;
  const expectedCheckDigit = remainder === 10 ? 0 : remainder;
  const actualCheckDigit = parseInt(clean[10], 10);

  if (actualCheckDigit !== expectedCheckDigit) {
    return {
      isValid: false,
      reason: `Sai chữ số kiểm tra (Đang ghi ${actualCheckDigit}, chuẩn ISO cần ${expectedCheckDigit})`,
      expectedCheckDigit,
      actualCheckDigit,
    };
  }

  return { isValid: true, expectedCheckDigit, actualCheckDigit };
}

// Parser CSV hỗ trợ dấu ngoặc kép, dấu chấm phẩy, tab, tự động phát hiện dòng tiêu đề
export function parseCsvContainers(text) {
  if (!text || typeof text !== 'string') return [];
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (!lines.length) return [];

  // Nhận diện ký tự phân cách (dấu phẩy, dấu chấm phẩy, tab)
  const firstLine = lines[0];
  let delimiter = ',';
  if (firstLine.includes(';') && !firstLine.includes(',')) delimiter = ';';
  else if (firstLine.includes('\t')) delimiter = '\t';

  const parseLine = (line) => {
    const cols = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (c === delimiter && !inQuotes) {
        cols.push(current.trim());
        current = '';
      } else {
        current += c;
      }
    }
    cols.push(current.trim());
    return cols;
  };

  // Kiểm tra nếu dòng 1 là tiêu đề thì bỏ qua
  let startIndex = 0;
  const firstRowCols = parseLine(firstLine).map(c => c.toLowerCase());
  if (
    firstRowCols.some(c =>
      c.includes('container') || c.includes('số cont') || c.includes('iso') ||
      c.includes('seal') || c.includes('b/l') || c.includes('vgm')
    )
  ) {
    startIndex = 1;
  }

  const rows = [];
  for (let i = startIndex; i < lines.length; i++) {
    const cols = parseLine(lines[i]);
    if (cols.length >= 1 && cols[0]) {
      const isoType = (cols[1] || '40HC').toUpperCase().trim();
      const isReefer = isoType.includes('RF');
      rows.push({
        containerNumber: (cols[0] || '').toUpperCase().trim(),
        isoType,
        sealNumber: (cols[2] || '').trim(),
        grossWeightKg: Number(cols[3]) || 0,
        blNumber: (cols[4] || '').trim(),
        commodity: cols[5] || 'Hàng hóa thông thường',
        tempRequired: cols[6] || (isReefer ? '-18.0°C' : ''),
        cargoType: isReefer ? 'REEFER' : 'GENERAL',
      });
    }
  }

  return rows;
}

export default function ManifestManagementPage() {
  const [manifests, setManifests] = useState([]);
  const [voyages, setVoyages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedManifest, setSelectedManifest] = useState(null);
  const [activeTab, setActiveTab] = useState('LIST'); // LIST, DETAIL
  const [directionFilter, setDirectionFilter] = useState('');
  
  // Accordion state cho từng nhóm B/L (mặc định mở tất cả)
  const [expandedBls, setExpandedBls] = useState({});

  // Reconciliation state
  const [reconciliationResult, setReconciliationResult] = useState(null);
  const [reconciling, setReconciling] = useState(false);

  // Exception modal state
  const [showExceptionModal, setShowExceptionModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [editExceptionForm, setEditExceptionForm] = useState({
    sealNumber: '',
    containerNumber: '',
    grossWeightKg: '',
    tempRequired: '',
  });

  // ── MODAL TẠO BẢN KHAI MỚI (WIZARD 2 BƯỚC) ──
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createStep, setCreateStep] = useState(1); // 1: Cấu hình & Nguồn; 2: Xem trước & Thẩm định
  const [inputMode, setInputMode] = useState('AUTO_BL'); // AUTO_BL (Trích xuất B/L), FILE_CSV (Tệp CSV/Dán)
  const [candidateBlData, setCandidateBlData] = useState(null);
  const [loadingCandidate, setLoadingCandidate] = useState(false);

  const [createForm, setCreateForm] = useState({
    voyageNumber: '',
    direction: 'EXPORT',
    isAmendment: false,
    containersText: '',
  });
  const [uploadedFileInfo, setUploadedFileInfo] = useState(null);
  const [isDraggingCsv, setIsDraggingCsv] = useState(false);

  // Dữ liệu container xem trước & thẩm định
  const [previewContainers, setPreviewContainers] = useState([]);
  const [editingPreviewIndex, setEditingPreviewIndex] = useState(null);
  const [inlineEditForm, setInlineEditForm] = useState({});
  const [showConfirmSubmitModal, setShowConfirmSubmitModal] = useState(false);

  // Phân trang danh sách & dữ liệu chi tiết
  const [manifestPage, setManifestPage] = useState(1);
  const [manifestPageSize, setManifestPageSize] = useState(5);
  const [blGroupPage, setBlGroupPage] = useState(1);
  const [blGroupPageSize, setBlGroupPageSize] = useState(5);
  const [previewPage, setPreviewPage] = useState(1);
  const [previewPageSize, setPreviewPageSize] = useState(5);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const [mnfRes, voyRes] = await Promise.all([
        shippingLineApi.getManifests({ direction: directionFilter }),
        shippingLineApi.getVoyages(),
      ]);
      const mnfList = Array.isArray(mnfRes) ? mnfRes : (mnfRes?.data || []);
      const voyList = Array.isArray(voyRes) ? voyRes : (voyRes?.data || []);
      setManifests(mnfList);
      
      // Đồng bộ lại chi tiết manifest nếu đang xem
      if (selectedManifest) {
        try {
          const detailRes = await shippingLineApi.getManifestDetail(selectedManifest.id);
          const detail = detailRes?.manifestNumber ? detailRes : (detailRes?.data || null);
          if (detail) setSelectedManifest(detail);
        } catch {
          // ignore detail refresh error if not found
        }
      }
      setVoyages(voyList);
    } catch (err) {
      setError(formatApiErrorMessage(err, 'Lỗi tải dữ liệu bản khai'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setManifestPage(1);
    loadData();
  }, [directionFilter]);

  // Tự động mở tất cả accordion B/L khi chọn xem chi tiết bản khai
  useEffect(() => {
    if (selectedManifest?.blGroups && selectedManifest.blGroups.length > 0) {
      const init = {};
      selectedManifest.blGroups.forEach((bg) => {
        init[bg.blNumber] = true;
      });
      setExpandedBls(init);
    }
  }, [selectedManifest?.id]);

  const toggleBlExpand = (blNumber) => {
    setExpandedBls((prev) => ({
      ...prev,
      [blNumber]: !prev[blNumber],
    }));
  };

  const handleSelectManifest = async (mnf) => {
    try {
      setLoading(true);
      setReconciliationResult(null);
      const res = await shippingLineApi.getManifestDetail(mnf.id);
      const detail = res?.manifestNumber ? res : (res?.data || null);
      if (detail) {
        setSelectedManifest(detail);
        setActiveTab('DETAIL');
      }
    } catch (err) {
      setError(formatApiErrorMessage(err, 'Không thể xem chi tiết bản khai'));
    } finally {
      setLoading(false);
    }
  };

  const handleReconcile = async () => {
    if (!selectedManifest) return;
    setReconciling(true);
    setError('');
    setSuccessMsg('');

    try {
      const res = await shippingLineApi.reconcileManifest(selectedManifest.id);
      const reconData = res?.summary ? res : (res?.data || res);
      if (reconData) {
        setReconciliationResult(reconData);
        setSuccessMsg('Đối soát dữ liệu với Cảng Tiên Sa hoàn tất thành công');
        const detailRes = await shippingLineApi.getManifestDetail(selectedManifest.id);
        const detail = detailRes?.manifestNumber ? detailRes : (detailRes?.data || null);
        if (detail) setSelectedManifest(detail);
        loadData();
      }
    } catch (err) {
      setError(formatApiErrorMessage(err, 'Lỗi đối soát dữ liệu cảng'));
    } finally {
      setReconciling(false);
    }
  };

  // ── XỬ LÝ KHI CHỌN CHUYẾN TÀU TRONG MODAL ──
  const fetchCandidateBls = async (voyNo) => {
    if (!voyNo) return;
    try {
      setLoadingCandidate(true);
      const res = await shippingLineApi.getCandidateBls(voyNo);
      const data = res?.candidateBls ? res : (res?.data || null);
      setCandidateBlData(data);
    } catch (err) {
      console.warn('Không thể nạp B/L ứng viên:', err);
      setCandidateBlData(null);
    } finally {
      setLoadingCandidate(false);
    }
  };

  const handleVoyageChange = (voyNo) => {
    setCreateForm(prev => ({ ...prev, voyageNumber: voyNo }));
    fetchCandidateBls(voyNo);
  };

  const handleOpenCreateModal = () => {
    const defaultVoy = voyages[0]?.voyageNumber || '';
    setCreateForm({
      voyageNumber: defaultVoy,
      direction: 'EXPORT',
      isAmendment: false,
      containersText: '',
    });
    setUploadedFileInfo(null);
    setIsDraggingCsv(false);
    setInputMode('AUTO_BL');
    setCreateStep(1);
    setPreviewContainers([]);
    setEditingPreviewIndex(null);
    setShowCreateModal(true);
    if (defaultVoy) fetchCandidateBls(defaultVoy);
  };

  // Tải tệp CSV mẫu chuẩn
  const handleDownloadSampleCsv = () => {
    const csvContent =
      'Số container,Loại ISO,Số seal,Khối lượng VGM (kg),Số B/L,Mô tả hàng hóa,Nhiệt độ cài đặt\n' +
      'EMCU1092837,40HC,SL-10293,24500,BL-VNDAD-8905,"Hàng dệt may, may mặc cao cấp",\n' +
      'EMCU1092842,40HC,SL-10294,24800,BL-VNDAD-8905,"Hàng dệt may, may mặc cao cấp",\n' +
      'EMCU9284712,40RF,SL-88412,28450,BL-VNDAD-8906,"Tôm thẻ chân trắng, đông lạnh xuất khẩu",-18.0°C\n';
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mau_danh_sach_container_manifest.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Xử lý tệp CSV tải lên từ máy tính
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
        setCreateForm(prev => ({ ...prev, containersText: text }));
        setUploadedFileInfo({
          name: file.name,
          size: file.size < 1024 * 1024 ? `${(file.size / 1024).toFixed(1)} KB` : `${(file.size / (1024 * 1024)).toFixed(2)} MB`,
          count: parsed.length,
        });
        setError('');
        setSuccessMsg(`Đã tải thành công tệp: ${file.name} (${parsed.length} container)`);
      }
    };
    reader.onerror = () => {
      setError('Không thể đọc tệp đã chọn. Vui lòng thử lại.');
    };
    reader.readAsText(file);
  };

  // Tải tệp CSV từ máy tính
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) processCsvFile(file);
    e.target.value = '';
  };

  const handleRemoveUploadedFile = () => {
    setCreateForm(prev => ({ ...prev, containersText: '' }));
    setUploadedFileInfo(null);
  };

  // ── BƯỚC 1 CHUYỂN SANG BƯỚC 2: PHÂN TÍCH VÀ THẨM ĐỊNH TRƯỚC ──
  const handleProceedToPreview = () => {
    if (!createForm.voyageNumber) {
      setError('Vui lòng chọn chuyến tàu thực hiện');
      return;
    }

    let parsed = [];
    if (inputMode === 'AUTO_BL') {
      if (!candidateBlData || !candidateBlData.containers || candidateBlData.containers.length === 0) {
        setError(`Chưa tìm thấy B/L đã phát hành nào cho chuyến ${createForm.voyageNumber}. Vui lòng chuyển sang chế độ "Tải tệp CSV từ máy tính".`);
        return;
      }
      parsed = candidateBlData.containers.map(c => ({
        containerNumber: c.containerNumber,
        isoType: c.isoType,
        sealNumber: c.sealNumber,
        grossWeightKg: c.grossWeightKg,
        tempRequired: c.tempRequired || '',
        blNumber: c.blNumber,
        commodity: c.commodity,
        cargoType: c.cargoType,
        shipper: c.shipper,
        consignee: c.consignee,
        packageCount: c.packageCount,
        packageUnit: c.packageUnit,
        isBlIssued: c.isBlIssued,
      }));
    } else {
      if (!createForm.containersText?.trim()) {
        setError('Vui lòng chọn tệp CSV từ máy tính để tải danh sách container.');
        return;
      }
      parsed = parseCsvContainers(createForm.containersText);
      if (!parsed.length) {
        setError('Tệp CSV đã chọn không chứa dữ liệu container hợp lệ. Vui lòng kiểm tra lại tệp.');
        return;
      }
    }

    // Đếm trùng lặp container trong đợt nhập
    const seen = new Set();
    const duplicates = new Set();
    parsed.forEach(c => {
      const num = c.containerNumber;
      if (num) {
        if (seen.has(num)) duplicates.add(num);
        seen.add(num);
      }
    });

    // Thẩm định từng dòng
    const validated = parsed.map(c => {
      const isoRes = checkIso6346(c.containerNumber);
      const isReefer = (c.isoType && c.isoType.includes('RF')) || c.cargoType === 'REEFER';
      const hasTemp = !isReefer || Boolean(c.tempRequired && c.tempRequired.trim());
      const hasSeal = Boolean(c.sealNumber && c.sealNumber.trim());
      const hasWeight = c.grossWeightKg > 0 && c.grossWeightKg <= 36000;
      const isDuplicate = duplicates.has(c.containerNumber);

      const errors = [];
      if (!isoRes.isValid) errors.push(isoRes.reason);
      if (isDuplicate) errors.push(`Trùng lặp số container ${c.containerNumber}`);
      if (!hasSeal) errors.push('Thiếu số chì niêm phong (seal)');
      if (!hasWeight) errors.push(c.grossWeightKg <= 0 ? 'Khối lượng VGM phải lớn hơn 0' : 'Vượt tải trọng (> 36.000 kg)');
      if (!hasTemp) errors.push('Container lạnh (40RF) bắt buộc có nhiệt độ cài đặt');

      return {
        ...c,
        errors,
        isValid: errors.length === 0,
        expectedCheckDigit: isoRes.expectedCheckDigit,
        actualCheckDigit: isoRes.actualCheckDigit,
      };
    });

    setPreviewContainers(validated);
    setCreateStep(2);
    setError('');
  };

  // Sửa nhanh trực tiếp trên bảng preview
  const handleStartInlineEdit = (idx) => {
    setEditingPreviewIndex(idx);
    setInlineEditForm({ ...previewContainers[idx] });
  };

  const handleSaveInlineEdit = () => {
    if (editingPreviewIndex === null) return;
    const updated = [...previewContainers];
    const item = {
      ...inlineEditForm,
      containerNumber: (inlineEditForm.containerNumber || '').toUpperCase().trim(),
      grossWeightKg: Number(inlineEditForm.grossWeightKg) || 0,
    };

    const isoRes = checkIso6346(item.containerNumber);
    const isReefer = (item.isoType && item.isoType.includes('RF')) || item.cargoType === 'REEFER';
    const hasTemp = !isReefer || Boolean(item.tempRequired && item.tempRequired.trim());
    const hasSeal = Boolean(item.sealNumber && item.sealNumber.trim());
    const hasWeight = item.grossWeightKg > 0 && item.grossWeightKg <= 36000;

    const errors = [];
    if (!isoRes.isValid) errors.push(isoRes.reason);
    if (!hasSeal) errors.push('Thiếu số chì niêm phong (seal)');
    if (!hasWeight) errors.push(item.grossWeightKg <= 0 ? 'Khối lượng VGM phải lớn hơn 0' : 'Vượt tải trọng (> 36.000 kg)');
    if (!hasTemp) errors.push('Container lạnh (40RF) bắt buộc có nhiệt độ cài đặt');

    item.errors = errors;
    item.isValid = errors.length === 0;
    item.expectedCheckDigit = isoRes.expectedCheckDigit;
    item.actualCheckDigit = isoRes.actualCheckDigit;

    updated[editingPreviewIndex] = item;
    setPreviewContainers(updated);
    setEditingPreviewIndex(null);
  };

  // ── LƯU NHÁP HOẶC NỘP CHÍNH THỨC ──
  const handleSaveManifest = async (isDraftMode = false) => {
    if (!previewContainers.length) {
      setError('Danh sách container trống');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const payload = {
        voyageNumber: createForm.voyageNumber,
        direction: createForm.direction,
        status: isDraftMode ? 'DRAFT' : 'SUBMITTED',
        isDraft: isDraftMode,
        isAmendment: createForm.isAmendment,
        records: previewContainers.map(c => ({
          containerNumber: c.containerNumber,
          isoType: c.isoType,
          sealNumber: c.sealNumber,
          grossWeightKg: c.grossWeightKg,
          tempRequired: c.tempRequired,
          blNumber: c.blNumber,
          commodity: c.commodity,
          cargoType: c.cargoType,
          shipper: c.shipper,
          consignee: c.consignee,
          packageCount: c.packageCount,
          packageUnit: c.packageUnit,
        })),
      };

      await shippingLineApi.createManifest(payload);
      setShowConfirmSubmitModal(false);
      setShowCreateModal(false);
      setSuccessMsg(
        isDraftMode
          ? 'Đã lưu bản nháp Manifest thành công'
          : 'Đã nộp chính thức bản khai Manifest sang hệ thống Cảng Tiên Sa!'
      );
      loadData();
    } catch (err) {
      setError(formatApiErrorMessage(err, 'Lỗi lưu bản khai'));
    } finally {
      setSaving(false);
    }
  };

  // Xử lý ngoại lệ container đơn lẻ
  const handleOpenException = (record) => {
    setSelectedRecord(record);
    const inferredCargoType = record.cargoType || (
      record.unNumber || record.dgClass ? 'DG' :
      record.isoType?.includes('RF') || record.tempRequired ? 'REEFER' :
      record.overHeightCm || record.overWidthCm ? 'OOG' :
      record.quarantineType || record.certificateNo ? 'CONDITIONAL' : 'GENERAL'
    );
    setEditExceptionForm({
      containerNumber: record.containerNumber || '',
      sealNumber: record.sealNumber || '',
      grossWeightKg: record.grossWeightKg || '',
      cargoType: inferredCargoType,
      unNumber: record.unNumber || '',
      dgClass: record.dgClass || '',
      packingGroup: record.packingGroup || 'PG II',
      flashPoint: record.flashPoint || '',
      hasDgd: record.hasDgd !== undefined ? Boolean(record.hasDgd) : Boolean(record.dgdFile),
      hasMsds: record.hasMsds !== undefined ? Boolean(record.hasMsds) : Boolean(record.msdsFile),
      tempRequired: record.tempRequired || '',
      ventilation: record.ventilation || '',
      humidity: record.humidity || '',
      overHeightCm: record.overHeightCm || '',
      overWidthCm: record.overWidthCm || '',
      dimensions: record.dimensions || '',
      quarantineType: record.quarantineType || '',
      certificateNo: record.certificateNo || '',
    });
    setShowExceptionModal(true);
  };

  const handleSaveException = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      await shippingLineApi.resolveException(selectedManifest.id, selectedRecord.id, editExceptionForm);
      setShowExceptionModal(false);
      setSuccessMsg('Đã cập nhật dữ liệu và kiểm tra thẩm định lại thành công');
      const res = await shippingLineApi.getManifestDetail(selectedManifest.id);
      const detail = res?.manifestNumber ? res : (res?.data || null);
      if (detail) setSelectedManifest(detail);
      loadData();
    } catch (err) {
      setError(formatApiErrorMessage(err, 'Lỗi xử lý ngoại lệ'));
    } finally {
      setSaving(false);
    }
  };

  // Voyage đang chọn trong modal
  const selectedVoyage = voyages.find(v => v.voyageNumber === createForm.voyageNumber) || voyages[0];
  const existingActiveManifest = manifests.find(
    m => m.voyageNumber === createForm.voyageNumber && m.direction === createForm.direction
  );

  const previewValidCount = previewContainers.filter(c => c.isValid).length;
  const previewErrorCount = previewContainers.filter(c => !c.isValid).length;

  return (
    <div className="p-4 md:p-6 lg:p-8 w-full max-w-7xl mx-auto font-sans flex flex-col gap-6 bg-slate-50 min-h-screen">
      
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
            Quản Lý Bản Khai Hàng Hóa
          </h2>
          <p className="text-xs text-slate mt-0.5">
            Khai báo danh sách container, thẩm định chuẩn ISO 6346, xử lý ngoại lệ và đối soát tự động với dữ liệu Cảng Tiên Sa.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {activeTab !== 'LIST' && (
            <button
              onClick={() => { setActiveTab('LIST'); setReconciliationResult(null); }}
              className="px-3.5 py-2 text-xs font-bold text-carbon bg-fog hover:bg-chalk border border-chalk rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm">arrow_back</span>
              Danh sách bản khai
            </button>
          )}

          <button
            onClick={handleOpenCreateModal}
            className="px-4 py-2 text-xs font-bold text-white bg-signal-orange hover:opacity-90 rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <span className="material-symbols-outlined text-base">add</span>
            Tạo Bản Khai Mới
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
          <button onClick={() => setError('')} className="text-red-600 font-bold px-2 cursor-pointer">✕</button>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs flex justify-between items-center shadow-xs">
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg('')} className="text-emerald-700 font-bold px-2 cursor-pointer">✕</button>
        </div>
      )}

      {/* ── 2. VIEW: DANH SÁCH BẢN KHAI MANIFEST ── */}
      {activeTab === 'LIST' && (
        <div className="space-y-4">
          
          {/* Filter Bar */}
          <div className="p-4 bg-white rounded-2xl border border-chalk shadow-sm flex flex-col md:flex-row items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-3">
              <span className="text-slate uppercase text-[10px] font-bold">Hướng Khai Báo:</span>
              <div className="flex bg-fog p-1 rounded-xl border border-chalk text-xs font-bold">
                <button
                  onClick={() => setDirectionFilter('')}
                  className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                    directionFilter === '' ? 'bg-carbon text-white shadow-sm' : 'text-slate hover:text-carbon'
                  }`}
                >
                  Tất cả ({manifests.length})
                </button>
                <button
                  onClick={() => setDirectionFilter('EXPORT')}
                  className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                    directionFilter === 'EXPORT' ? 'bg-carbon text-white shadow-sm' : 'text-slate hover:text-carbon'
                  }`}
                >
                  Xuất khẩu
                </button>
                <button
                  onClick={() => setDirectionFilter('IMPORT')}
                  className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                    directionFilter === 'IMPORT' ? 'bg-carbon text-white shadow-sm' : 'text-slate hover:text-carbon'
                  }`}
                >
                  Nhập khẩu
                </button>
              </div>
            </div>

            <div className="text-xs text-slate font-mono">
              Tổng số: <strong className="text-carbon font-bold">{manifests.length}</strong> bản khai
            </div>
          </div>

          {/* Table Bản khai */}
          <div className="bg-white border border-chalk rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex justify-between items-center border-b border-chalk pb-3">
              <div>
                <h3 className="font-heading text-lg font-extrabold text-carbon">
                  Danh Sách Bản Khai Hàng Hóa Tàu Biển
                </h3>
              </div>
              <span className="text-xs text-slate font-mono font-bold">Cập nhật lúc: vừa xong</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-fog text-slate font-bold uppercase text-[10px] border-b border-chalk">
                    <th className="py-3 px-3 w-32 whitespace-nowrap">Mã bản khai</th>
                    <th className="py-3 px-3 w-20 whitespace-nowrap">Phiên bản</th>
                    <th className="py-3 px-3 w-28 whitespace-nowrap">Chuyến tàu</th>
                    <th className="py-3 px-3 w-36 whitespace-nowrap">Tên tàu</th>
                    <th className="py-3 px-3 w-28 whitespace-nowrap">Hướng khai</th>
                    <th className="py-3 px-3 w-28 whitespace-nowrap">Số container</th>
                    <th className="py-3 px-3 w-36 min-w-[150px] whitespace-nowrap">Số ngoại lệ</th>
                    <th className="py-3 px-3 w-32 whitespace-nowrap">Trạng thái</th>
                    <th className="py-3 px-3 w-36 whitespace-nowrap">Ngày gửi</th>
                    <th className="py-3 px-3 w-24 text-right whitespace-nowrap">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-chalk font-medium font-mono">
                  {manifests
                    .slice((manifestPage - 1) * manifestPageSize, manifestPage * manifestPageSize)
                    .map((mnf) => (
                    <tr key={mnf.id} className="hover:bg-fog/60 transition-colors">
                      <td className="py-3.5 px-3 font-bold text-carbon text-sm whitespace-nowrap">{mnf.manifestNumber}</td>
                      <td className="py-3.5 px-3 font-sans whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-fog text-slate border border-chalk whitespace-nowrap">
                          v{mnf.version || 1}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 font-bold text-carbon whitespace-nowrap">{mnf.voyageNumber}</td>
                      <td className="py-3.5 px-3 font-sans font-bold text-carbon whitespace-nowrap">{mnf.vesselName}</td>
                      <td className="py-3.5 px-3 font-sans whitespace-nowrap">
                        <span className={`inline-flex items-center whitespace-nowrap px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          mnf.direction === 'EXPORT' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                        }`}>
                          {mnf.direction === 'EXPORT' ? 'Xuất khẩu' : 'Nhập khẩu'}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 font-bold text-carbon whitespace-nowrap">{mnf.totalContainers} Cont</td>
                      <td className="py-3.5 px-3 whitespace-nowrap w-36 min-w-[150px]">
                        {mnf.exceptionsCount > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-red-100 text-red-800 rounded-full text-[10px] font-bold border border-red-300 whitespace-nowrap shrink-0 select-none">
                            <span className="material-symbols-outlined text-[12px] leading-none text-red-700 shrink-0">warning</span>
                            <span className="whitespace-nowrap">{mnf.exceptionsCount} ngoại lệ</span>
                          </span>
                        ) : (
                          <span className="text-emerald-700 font-bold px-1">0</span>
                        )}
                      </td>
                      <td className="py-3.5 px-3 font-sans whitespace-nowrap">
                        <ShippingBadge status={mnf.status} />
                      </td>
                      <td className="py-3.5 px-3 text-slate text-[11px] whitespace-nowrap">{mnf.submittedAt}</td>
                      <td className="py-3.5 px-3 text-right font-sans whitespace-nowrap">
                        <button
                          onClick={() => handleSelectManifest(mnf)}
                          className="px-3 py-1.5 text-xs font-bold text-carbon bg-fog hover:bg-chalk border border-chalk rounded-xl transition-colors cursor-pointer whitespace-nowrap"
                        >
                          Chi tiết &rarr;
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Phân trang danh sách Bản khai */}
            <div className="-mx-6 -mb-6">
              <ShippingPagination
                currentPage={manifestPage}
                totalItems={manifests.length}
                pageSize={manifestPageSize}
                onPageChange={setManifestPage}
                onPageSizeChange={setManifestPageSize}
                itemName="bản khai"
              />
            </div>
          </div>

        </div>
      )}

      {/* ── 3. VIEW: CHI TIẾT BẢN KHAI & ĐỐI SOÁT CẢNG ── */}
      {activeTab === 'DETAIL' && selectedManifest && (
        <div className="space-y-6">
          
          {/* Header Thông Tin Cấp Chuyến Tàu & Bản Khai */}
          <div className="bg-white border border-chalk rounded-2xl p-5 md:p-6 shadow-sm space-y-5">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-chalk pb-4">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h3 className="font-heading text-xl md:text-2xl font-extrabold text-carbon">
                    Bản khai {selectedManifest.manifestNumber}
                  </h3>
                  <ShippingBadge status={selectedManifest.status} />
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                    selectedManifest.direction === 'EXPORT'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-purple-100 text-purple-800'
                  }`}>
                    {selectedManifest.direction === 'EXPORT' ? 'Xuất khẩu' : 'Nhập khẩu'}
                  </span>
                  <span className="px-2 py-0.5 rounded text-xs font-bold bg-fog text-slate border border-chalk font-mono">
                    Phiên bản: v{selectedManifest.version || 1}
                  </span>
                </div>
                <p className="text-xs text-slate font-mono mt-1">
                  Chuyến tàu: <strong className="text-carbon font-bold">{selectedManifest.voyageInfo?.voyageNumber || selectedManifest.voyageNumber}</strong>
                  {' · '}Tàu biển: <strong className="text-carbon font-bold">{selectedManifest.voyageInfo?.vesselName || selectedManifest.vesselName}</strong>
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  onClick={handleReconcile}
                  disabled={reconciling}
                  className="px-4 py-2 text-xs font-bold text-white bg-signal-orange hover:opacity-90 rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <span className={`material-symbols-outlined text-base ${reconciling ? 'animate-spin' : ''}`}>
                    compare_arrows
                  </span>
                  <span>{reconciling ? 'Đang đối soát...' : 'Đối soát dữ liệu cảng'}</span>
                </button>
              </div>
            </div>

            {/* Chi tiết hành trình & cảng biển */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs bg-fog/70 border border-chalk rounded-xl p-3.5">
              <div className="min-w-0">
                <span className="text-[10px] uppercase font-bold text-slate block">Cảng bốc (POL)</span>
                <span className="font-bold text-carbon font-mono truncate block" title={selectedManifest.voyageInfo?.pol || 'Cảng Tiên Sa, Đà Nẵng (VNDAD)'}>
                  {selectedManifest.voyageInfo?.pol || 'Cảng Tiên Sa, Đà Nẵng (VNDAD)'}
                </span>
              </div>
              <div className="min-w-0">
                <span className="text-[10px] uppercase font-bold text-slate block">Cảng dỡ (POD)</span>
                <span className="font-bold text-carbon font-mono truncate block" title={selectedManifest.voyageInfo?.pod || 'Tokyo, Nhật Bản (JPTYO)'}>
                  {selectedManifest.voyageInfo?.pod || 'Tokyo, Nhật Bản (JPTYO)'}
                </span>
              </div>
              <div className="min-w-0">
                <span className="text-[10px] uppercase font-bold text-slate block">Cầu bến tiếp nhận</span>
                <span className="font-bold text-carbon font-mono truncate block" title={selectedManifest.voyageInfo?.terminal || 'Bến số 1 (TS-01) - Cảng Tiên Sa'}>
                  {selectedManifest.voyageInfo?.terminal || 'Bến số 1 (TS-01) - Cảng Tiên Sa'}
                </span>
              </div>
              <div className="min-w-0">
                <span className="text-[10px] uppercase font-bold text-slate block">Dự kiến xuất bến (ETD)</span>
                <span className="font-bold text-carbon font-mono truncate block">
                  {selectedManifest.voyageInfo?.etd || '—'}
                </span>
              </div>
            </div>

            {/* Cảnh báo B/L chưa phát hành (nếu có) */}
            {selectedManifest.hasUnissuedBls ? (
              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs flex items-center gap-3">
                <span className="material-symbols-outlined text-amber-600 text-lg shrink-0">warning</span>
                <div>
                  <strong className="font-bold">Cảnh báo nghiệp vụ vận đơn:</strong> Chuyến tàu còn vận đơn (B/L) chưa phát hành chính thức. Theo quy định hàng hải quốc tế, chỉ các vận đơn đã phát hành (hoặc Telex Release) mới đủ điều kiện lập bản khai hàng hóa (manifest).
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2.5">
                <span className="material-symbols-outlined text-emerald-600 text-base shrink-0">verified</span>
                <span>
                  <strong>Đủ điều kiện pháp lý:</strong> Toàn bộ 100% vận đơn (B/L) trong bản khai đã được phát hành chính thức (Issued / Telex Released).
                </span>
              </div>
            )}

            {/* 4 Thẻ KPI Chỉ số của Bản Khai */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-1">
              <div className="bg-fog rounded-xl border border-chalk p-3.5 flex flex-col justify-between">
                <span className="text-[10px] font-bold text-slate uppercase">Tổng container</span>
                <div className="text-2xl font-bold font-mono text-carbon mt-1">
                  {selectedManifest.records?.length || 0}
                </div>
              </div>
              <div className="bg-fog rounded-xl border border-chalk p-3.5 flex flex-col justify-between">
                <span className="text-[10px] font-bold text-slate uppercase">Container hợp lệ</span>
                <div className="text-2xl font-bold font-mono text-emerald-700 mt-1">
                  {selectedManifest.validContainersCount ?? selectedManifest.records?.filter(r => r.status === 'VALID' || r.status === 'VALIDATED').length ?? 0}
                </div>
              </div>
              <div className="bg-fog rounded-xl border border-chalk p-3.5 flex flex-col justify-between">
                <span className="text-[10px] font-bold text-slate uppercase">Ngoại lệ cần sửa</span>
                <div className="text-2xl font-bold font-mono text-red-600 mt-1">
                  {selectedManifest.exceptionContainersCount ?? selectedManifest.records?.filter(r => r.status === 'EXCEPTION').length ?? 0}
                </div>
              </div>
              <div className="bg-fog rounded-xl border border-chalk p-3.5 flex flex-col justify-between">
                <span className="text-[10px] font-bold text-slate uppercase">Thời điểm lập bản khai</span>
                <div className="text-xs font-bold font-mono text-carbon mt-1">
                  {selectedManifest.submittedAt || '—'}
                </div>
                <div className="text-[11px] text-slate mt-0.5 truncate">
                  Người lập: <span className="font-bold text-carbon">{selectedManifest.submittedBy === 'shipping01' ? 'Đại diện Hãng tàu' : (selectedManifest.submittedBy || 'Đại diện Hãng tàu')}</span>
                </div>
              </div>
            </div>
          </div>

          {/* ── Khối Đối Soát Dữ Liệu Tự Động Với Cảng Tiên Sa ── */}
          {!reconciliationResult ? (
            <div className="bg-white border border-chalk rounded-2xl p-6 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-200 text-signal-orange flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-xl">compare_arrows</span>
                </div>
                <div>
                  <h4 className="font-heading font-extrabold text-carbon text-sm">
                    Chưa có dữ liệu đối soát từ Cảng Tiên Sa
                  </h4>
                  <p className="text-xs text-slate mt-0.5">
                    Hệ thống cần kết nối với Cổng kiểm soát (Gate-In) và Cân điện tử cảng để đối chiếu số niêm chì và trọng lượng VGM thực tế. Nhấn nút đối soát để bắt đầu kiểm tra.
                  </p>
                </div>
              </div>
              <button
                onClick={handleReconcile}
                disabled={reconciling}
                className="px-4 py-2 text-xs font-bold text-white bg-signal-orange hover:opacity-90 rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
              >
                <span className={`material-symbols-outlined text-base ${reconciling ? 'animate-spin' : ''}`}>
                  compare_arrows
                </span>
                <span>{reconciling ? 'Đang đối soát...' : 'Đối soát dữ liệu cảng'}</span>
              </button>
            </div>
          ) : (
            <div className="bg-white border border-emerald-300 rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 border-b border-emerald-200 pb-3">
                <div>
                  <h3 className="font-heading text-lg font-extrabold text-emerald-950 flex items-center gap-2">
                    <span className="material-symbols-outlined text-emerald-600">check_circle</span>
                    Kết quả đối soát tự động với dữ liệu Cảng Tiên Sa
                  </h3>
                  <p className="text-xs text-slate mt-0.5">
                    So sánh số seal niêm chì thực tế và trọng lượng VGM khai báo với cân điện tử cảng (Ngưỡng dung sai cho phép: &plusmn;{reconciliationResult.summary?.toleranceKg || 100} kg).
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-bold font-mono text-emerald-800 bg-emerald-100 px-3 py-1 rounded-full border border-emerald-300">
                    Tỷ lệ khớp: {reconciliationResult.summary?.matchPercentage ?? reconciliationResult.matchPercentage}%
                  </span>
                </div>
              </div>

              {/* Thông số tổng hợp đối soát */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs bg-emerald-50/50 border border-emerald-100 rounded-xl p-3">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate block">Đã qua cổng cảng</span>
                  <span className="font-bold text-carbon font-mono text-sm">
                    {reconciliationResult.summary?.portReceivedCount || 0} container
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate block">Chờ cảng (Chưa qua cổng)</span>
                  <span className="font-bold text-sky-800 font-mono text-sm">
                    {reconciliationResult.summary?.pendingPortCount || 0} container
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate block">Khớp số liệu</span>
                  <span className="font-bold text-emerald-700 font-mono text-sm">
                    {reconciliationResult.summary?.matchedCount || 0} container
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate block">Lệch số liệu</span>
                  <span className="font-bold text-rose-600 font-mono text-sm">
                    {reconciliationResult.summary?.mismatchedCount || 0} container
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px] text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-fog text-slate font-bold uppercase text-[10px] border-b border-chalk">
                      <th className="py-3 px-3 w-36">Số container</th>
                      <th className="py-3 px-3 w-32">Trọng lượng (Bản khai)</th>
                      <th className="py-3 px-3 w-32">Trọng lượng (Cân cảng)</th>
                      <th className="py-3 px-3 w-24">Chênh lệch</th>
                      <th className="py-3 px-3 w-28">Số seal (Bản khai)</th>
                      <th className="py-3 px-3 w-28">Số seal (Cảng)</th>
                      <th className="py-3 px-3 w-36">Thời điểm qua cổng</th>
                      <th className="py-3 px-3 w-32">Trạng thái đối soát</th>
                      <th className="py-3 px-3 min-w-[200px]">Ghi chú nghiệp vụ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-chalk font-medium font-mono">
                    {reconciliationResult.reconciliationDetails?.map((det, idx) => (
                      <tr key={idx} className="hover:bg-fog/60 transition-colors">
                        <td className="py-3 px-3 font-bold text-carbon text-sm">{det.containerNumber}</td>
                        <td className="py-3 px-3">{formatKg(det.manifestWeight)}</td>
                        <td className="py-3 px-3">{det.portWeight ? formatKg(det.portWeight) : '—'}</td>
                        <td className="py-3 px-3">
                          {det.weightDiff !== null && det.weightDiff !== undefined ? (
                            <span className={`font-bold ${det.weightDiff === 0 ? 'text-slate' : Math.abs(det.weightDiff) <= 100 ? 'text-blue-700' : 'text-red-600'}`}>
                              {det.weightDiff > 0 ? `+${det.weightDiff} kg` : det.weightDiff === 0 ? '0 kg' : `${det.weightDiff} kg`}
                            </span>
                          ) : '—'}
                        </td>
                        <td className="py-3 px-3 font-bold text-carbon">{det.manifestSeal}</td>
                        <td className="py-3 px-3 font-bold text-carbon">{det.portSeal || '—'}</td>
                        <td className="py-3 px-3 text-slate font-sans text-[11px]">{det.portGateInTime || '—'}</td>
                        <td className="py-3 px-3 font-sans">
                          {det.isPending ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-sky-50 text-sky-800 border border-sky-300">
                              ● Chờ cảng
                            </span>
                          ) : det.isMatched ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              ● Khớp 100%
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                              ⚠ Lệch dữ liệu
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 font-sans text-slate text-[11px]">{det.notes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Danh Sách Hàng Hóa Nhóm Theo Vận Đơn (B/L) Mở Rộng ── */}
          <div className="bg-white border border-chalk rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-chalk pb-3">
              <div>
                <h3 className="font-heading text-lg font-extrabold text-carbon">
                  Danh sách hàng hóa theo vận đơn (B/L) &amp; container
                </h3>
                <p className="text-xs text-slate mt-0.5">
                  Bản khai manifest được tổ chức chuẩn theo từng Vận đơn B/L. Nhấn vào từng dòng B/L để xem chi tiết container.
                </p>
              </div>
              <span className="text-xs text-slate font-mono font-bold">
                {selectedManifest.blGroups?.length || 0} vận đơn · {selectedManifest.records?.length || 0} container
              </span>
            </div>

            {/* Loop through B/L Groups */}
            <div className="space-y-4">
              {(selectedManifest.blGroups || [])
                .slice((blGroupPage - 1) * blGroupPageSize, blGroupPage * blGroupPageSize)
                .map((bg) => {
                const isExpanded = expandedBls[bg.blNumber] !== false;
                return (
                  <div key={bg.blNumber} className="border border-chalk rounded-2xl overflow-hidden shadow-2xs">
                    {/* B/L Header Card */}
                    <div
                      onClick={() => toggleBlExpand(bg.blNumber)}
                      className="bg-fog/80 hover:bg-fog p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 cursor-pointer border-b border-chalk select-none transition-colors"
                    >
                      <div className="flex items-start md:items-center gap-3 flex-1 min-w-0">
                        <button
                          type="button"
                          className="w-7 h-7 rounded-lg bg-white border border-chalk flex items-center justify-center text-slate hover:text-carbon shrink-0 mt-0.5 md:mt-0 cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-base">
                            {isExpanded ? 'expand_less' : 'expand_more'}
                          </span>
                        </button>

                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold font-mono text-sm text-carbon">{bg.blNumber}</span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-300">
                              {bg.blType || 'VẬN ĐƠN HÀNG HẢI'}
                            </span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              bg.isIssued
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                : 'bg-amber-50 text-amber-800 border-amber-300'
                            }`}>
                              ● {bg.isIssued ? 'Đã phát hành' : 'Chưa phát hành'}
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs text-slate mt-2.5">
                            <div className="bg-white/70 p-2 rounded-xl border border-chalk/60 min-w-0">
                              <span className="font-bold text-carbon block text-[10px] uppercase text-slate">Người gửi hàng</span>
                              <span className="font-medium text-carbon truncate block" title={bg.shipper || '—'}>{bg.shipper || '—'}</span>
                            </div>
                            <div className="bg-white/70 p-2 rounded-xl border border-chalk/60 min-w-0">
                              <span className="font-bold text-carbon block text-[10px] uppercase text-slate">Người nhận hàng</span>
                              <span className="font-medium text-carbon truncate block" title={bg.consignee || '—'}>{bg.consignee || '—'}</span>
                            </div>
                            <div className="bg-white/70 p-2 rounded-xl border border-chalk/60 min-w-0">
                              <span className="font-bold text-carbon block text-[10px] uppercase text-slate">Mô tả mặt hàng</span>
                              <span className="font-medium text-carbon truncate block" title={bg.cargoDescription || '—'}>{bg.cargoDescription || '—'}</span>
                            </div>
                            <div className="bg-white/70 p-2 rounded-xl border border-chalk/60 min-w-0">
                              <span className="font-bold text-carbon block text-[10px] uppercase text-slate">Số kiện &amp; Trọng lượng</span>
                              <span className="font-mono font-bold text-carbon truncate block">
                                {bg.packageCount ? `${bg.packageCount.toLocaleString('vi-VN')} ${bg.packageUnit || 'kiện'}` : '—'}
                                {' · '}
                                {formatKg(bg.grossWeightKg)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                        <span className="px-3 py-1.5 bg-white border border-chalk rounded-xl text-xs font-bold font-mono text-carbon shadow-2xs">
                          {bg.containers?.length || 0} container
                        </span>
                      </div>
                    </div>

                    {/* Container Table inside B/L */}
                    {isExpanded && (
                      <div className="overflow-x-auto bg-white p-2">
                        <table className="w-full min-w-[1050px] text-left border-collapse text-xs">
                          <thead>
                            <tr className="bg-fog/50 text-slate font-bold uppercase text-[10px] border-b border-chalk">
                              <th className="py-2.5 px-3 w-44">Số container</th>
                              <th className="py-2.5 px-3 w-20">Loại ISO</th>
                              <th className="py-2.5 px-3 min-w-[240px]">Phân loại hàng &amp; Thông số đặc thù</th>
                              <th className="py-2.5 px-3 w-28">Số niêm chì</th>
                              <th className="py-2.5 px-3 w-36">Khối lượng toàn bộ - VGM (kg)</th>
                              <th className="py-2.5 px-3 min-w-[160px]">Mô tả hàng hóa</th>
                              <th className="py-2.5 px-3 w-32">Trạng thái</th>
                              <th className="py-2.5 px-3 w-24 text-right">Thao tác</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-chalk font-medium font-mono">
                            {(bg.containers || []).map((rec) => (
                              <tr key={rec.id} className="hover:bg-fog/40 transition-colors">
                                <td className="py-3 px-3 font-bold text-carbon text-sm">
                                  {rec.containerNumber}
                                  {rec.isIsoValid ? (
                                    <span className="ml-2 text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded font-sans font-bold">
                                      Chuẩn ISO
                                    </span>
                                  ) : (
                                    <span className="ml-2 text-[10px] text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded font-sans font-bold" title={`Cần chữ số kiểm tra: ${rec.expectedCheckDigit}`}>
                                      Sai ISO (Cần {rec.expectedCheckDigit})
                                    </span>
                                  )}
                                </td>
                                <td className="py-3 px-3 font-bold text-carbon">{rec.isoType}</td>
                                <td className="py-3 px-3 font-sans">
                                  {rec.unNumber || rec.dgClass || rec.cargoType === 'DG' || rec.cargoType === 'DANGEROUS' ? (
                                    <div className="space-y-1">
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                                        <span className="material-symbols-outlined text-xs text-amber-700">warning</span>
                                        Hàng nguy hiểm: {rec.unNumber || 'UN 1993'} ({rec.dgClass || 'Class 3'})
                                      </span>
                                      <div className="text-[10px] flex items-center gap-2 text-slate flex-wrap font-sans">
                                        <span className={rec.hasDgd || rec.dgdFile ? 'text-emerald-700 font-bold' : 'text-red-600 font-bold'}>
                                          Bản khai DGD: {rec.hasDgd || rec.dgdFile ? '✓ Đã nộp' : '✕ Thiếu'}
                                        </span>
                                        <span>•</span>
                                        <span className={rec.hasMsds || rec.msdsFile ? 'text-emerald-700 font-bold' : 'text-red-600 font-bold'}>
                                          Phiếu MSDS: {rec.hasMsds || rec.msdsFile ? '✓ Đã duyệt' : '✕ Thiếu'}
                                        </span>
                                      </div>
                                    </div>
                                  ) : (rec.isoType && rec.isoType.includes('RF')) || rec.cargoType === 'REEFER' || rec.tempRequired ? (
                                    <div className="space-y-1">
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-50 text-sky-800 border border-sky-300">
                                        <span className="material-symbols-outlined text-xs">ac_unit</span>
                                        Hàng lạnh: {rec.tempRequired || '-18.0°C'}
                                      </span>
                                      <div className="text-[10px] text-slate font-sans">
                                        Gió: {rec.ventilation || '25 CBM/h'} · Ẩm: {rec.humidity || '85% RH'}
                                      </div>
                                    </div>
                                  ) : (rec.isoType && (rec.isoType.includes('FR') || rec.isoType.includes('OT'))) || rec.cargoType === 'OOG' || rec.overHeightCm ? (
                                    <div className="space-y-1">
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-800 border border-purple-300">
                                        <span className="material-symbols-outlined text-xs">straighten</span>
                                        Quá khổ (OOG): OH +{rec.overHeightCm || 45}cm · OW +{rec.overWidthCm || 30}cm
                                      </span>
                                      <div className="text-[10px] text-slate font-sans">
                                        KT: {rec.dimensions || '12.2 x 2.6 x 3.1 m'}
                                      </div>
                                    </div>
                                  ) : rec.cargoType === 'CONDITIONAL' || rec.quarantineType || rec.certificateNo ? (
                                    <div className="space-y-1">
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-300">
                                        <span className="material-symbols-outlined text-xs">eco</span>
                                        Kiểm dịch: {rec.quarantineType || 'Thực vật'}
                                      </span>
                                      <div className="text-[10px] text-slate font-sans">
                                        GCN: {rec.certificateNo || 'KD-2026-8812'}
                                      </div>
                                    </div>
                                  ) : (
                                    <span className="text-slate text-[11px] font-sans">Hàng bách hóa thông thường</span>
                                  )}
                                </td>
                                <td className="py-3 px-3 font-bold text-carbon">
                                  {rec.sealNumber ? (
                                    rec.sealNumber
                                  ) : (
                                    <span className="text-red-600 italic font-sans">Thiếu seal</span>
                                  )}
                                </td>
                                <td className="py-3 px-3 font-bold text-carbon">{formatKg(rec.grossWeightKg)}</td>
                                <td className="py-3 px-3 font-sans text-slate text-[11px]">{rec.commodity}</td>
                                <td className="py-3 px-3 font-sans whitespace-nowrap">
                                  {rec.status === 'VALID' || rec.status === 'VALIDATED' ? (
                                    <span className="inline-flex items-center whitespace-nowrap px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-300">
                                      ● Hợp lệ
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center whitespace-nowrap px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-300">
                                      ⚠ Ngoại lệ ({rec.exceptionReason || 'Sai chuẩn'})
                                    </span>
                                  )}
                                </td>
                                <td className="py-3 px-3 text-right font-sans">
                                  {rec.status === 'EXCEPTION' ? (
                                    <button
                                      onClick={() => handleOpenException(rec)}
                                      className="px-2.5 py-1 text-xs font-bold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors cursor-pointer"
                                    >
                                      Sửa ngoại lệ
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => handleOpenException(rec)}
                                      className="px-2.5 py-1 text-xs font-medium text-slate hover:text-carbon bg-fog hover:bg-chalk border border-chalk rounded-lg transition-colors cursor-pointer"
                                    >
                                      Sửa
                                    </button>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Phân trang nhóm Vận đơn trong Bản khai */}
            {(selectedManifest.blGroups?.length || 0) > 0 && (
              <div className="-mx-6 -mb-6">
                <ShippingPagination
                  currentPage={blGroupPage}
                  totalItems={selectedManifest.blGroups?.length || 0}
                  pageSize={blGroupPageSize}
                  onPageChange={setBlGroupPage}
                  onPageSizeChange={setBlGroupPageSize}
                  itemName="vận đơn trong bản khai"
                />
              </div>
            )}
          </div>

        </div>
      )}

      {/* ── MODAL: XỬ LÝ NGOẠI LỆ / CHỈNH SỬA CONTAINER ĐƠN LẺ ── */}
      {showExceptionModal && selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-chalk max-w-xl w-full overflow-hidden animate-fadeIn flex flex-col max-h-[88vh]">
            <div className="px-6 py-4 border-b border-chalk bg-fog flex items-center justify-between shrink-0">
              <div>
                <h3 className="font-heading text-lg font-extrabold text-carbon">
                  Cập nhật &amp; thẩm định container
                </h3>
                <p className="text-xs text-slate mt-0.5">Mã container: {selectedRecord.containerNumber}</p>
              </div>
              <button
                onClick={() => setShowExceptionModal(false)}
                className="w-8 h-8 rounded-lg text-slate hover:bg-chalk flex items-center justify-center cursor-pointer font-bold text-lg"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveException} className="p-6 space-y-4 text-xs font-sans overflow-y-auto flex-1">
              {/* Số Container & Số Seal */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-carbon uppercase mb-1">
                    Số container (Chuẩn ISO 6346) *
                  </label>
                  <input
                    type="text"
                    required
                    value={editExceptionForm.containerNumber}
                    onChange={(e) => setEditExceptionForm({ ...editExceptionForm, containerNumber: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 bg-fog border border-chalk rounded-xl font-mono text-carbon font-bold focus:outline-none focus:border-signal-orange focus:ring-0 uppercase"
                  />
                  <span className="text-[10px] text-slate mt-1 block">
                    Chữ số thứ 11 là số kiểm tra (check digit) ISO 6346.
                  </span>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-carbon uppercase mb-1">
                    Số niêm chì (Seal) *
                  </label>
                  <input
                    type="text"
                    required
                    value={editExceptionForm.sealNumber}
                    onChange={(e) => setEditExceptionForm({ ...editExceptionForm, sealNumber: e.target.value })}
                    placeholder="VD: SL-99311"
                    className="w-full px-3 py-2 bg-fog border border-chalk rounded-xl font-mono text-carbon font-bold focus:outline-none focus:border-signal-orange focus:ring-0"
                  />
                </div>
              </div>

              {/* Khối lượng VGM & Phân loại hàng */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-carbon uppercase mb-1">
                    Khối lượng toàn bộ VGM (kg) *
                  </label>
                  <input
                    type="number"
                    required
                    value={editExceptionForm.grossWeightKg}
                    onChange={(e) => setEditExceptionForm({ ...editExceptionForm, grossWeightKg: e.target.value })}
                    className="w-full px-3 py-2 bg-fog border border-chalk rounded-xl font-mono text-carbon font-bold focus:outline-none focus:border-signal-orange focus:ring-0"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-carbon uppercase mb-1">
                    Phân loại tính chất hàng hóa *
                  </label>
                  <select
                    value={editExceptionForm.cargoType}
                    onChange={(e) => setEditExceptionForm({ ...editExceptionForm, cargoType: e.target.value })}
                    className="w-full px-3 py-2 bg-fog border border-chalk rounded-xl font-bold text-carbon focus:outline-none focus:border-signal-orange focus:ring-0"
                  >
                    <option value="GENERAL">Hàng bách hóa thông thường</option>
                    <option value="DG">Hàng nguy hiểm (DG / IMO Class)</option>
                    <option value="REEFER">Hàng lạnh / Bảo quản nhiệt độ</option>
                    <option value="OOG">Hàng quá khổ / Siêu trường siêu trọng</option>
                    <option value="CONDITIONAL">Hàng có điều kiện / Kiểm dịch</option>
                  </select>
                </div>
              </div>

              {/* ── CẤU HÌNH HÀNG NGUY HIỂM (DG / IMO) ── */}
              {editExceptionForm.cargoType === 'DG' && (
                <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-300 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-amber-700 text-lg">warning</span>
                    <strong className="text-amber-950 font-heading text-xs">
                      Thông số an toàn hàng nguy hiểm (DG / IMO Code)
                    </strong>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-amber-900 uppercase mb-1">
                        Mã số Liên Hiệp Quốc (Mã UN) *
                      </label>
                      <input
                        type="text"
                        required
                        value={editExceptionForm.unNumber}
                        onChange={(e) => setEditExceptionForm({ ...editExceptionForm, unNumber: e.target.value })}
                        placeholder="VD: UN 1993 hoặc UN 3480"
                        className="w-full px-3 py-2 bg-white border border-amber-300 rounded-xl font-mono text-carbon font-bold focus:outline-none focus:border-signal-orange"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-amber-900 uppercase mb-1">
                        Phân nhóm IMO (DG Class) *
                      </label>
                      <input
                        type="text"
                        required
                        value={editExceptionForm.dgClass}
                        onChange={(e) => setEditExceptionForm({ ...editExceptionForm, dgClass: e.target.value })}
                        placeholder="VD: Class 3 hoặc Class 9"
                        className="w-full px-3 py-2 bg-white border border-amber-300 rounded-xl font-bold text-carbon focus:outline-none focus:border-signal-orange"
                      />
                    </div>
                  </div>

                  {/* Chứng từ bắt buộc: Bản khai DGD và MSDS */}
                  <div className="pt-2 border-t border-amber-200/80 space-y-2">
                    <span className="text-[10px] font-bold text-amber-950 uppercase block">
                      Hồ sơ pháp lý &amp; Giấy chứng nhận bắt buộc tại Cảng Tiên Sa:
                    </span>
                    <label className="flex items-start gap-2.5 cursor-pointer bg-white/80 p-2.5 rounded-xl border border-amber-200 hover:bg-white transition-colors">
                      <input
                        type="checkbox"
                        checked={editExceptionForm.hasDgd}
                        onChange={(e) => setEditExceptionForm({ ...editExceptionForm, hasDgd: e.target.checked })}
                        className="mt-0.5 rounded text-signal-orange focus:ring-0"
                      />
                      <div>
                        <span className="font-bold text-carbon">
                          Bản khai hàng nguy hiểm (DGD - Dangerous Goods Declaration)
                        </span>
                        <p className="text-[10px] text-slate mt-0.5">
                          Đã ký xác nhận bởi người gửi hàng và được đại lý hãng tàu tiếp nhận hợp lệ.
                        </p>
                      </div>
                    </label>

                    <label className="flex items-start gap-2.5 cursor-pointer bg-white/80 p-2.5 rounded-xl border border-amber-200 hover:bg-white transition-colors">
                      <input
                        type="checkbox"
                        checked={editExceptionForm.hasMsds}
                        onChange={(e) => setEditExceptionForm({ ...editExceptionForm, hasMsds: e.target.checked })}
                        className="mt-0.5 rounded text-signal-orange focus:ring-0"
                      />
                      <div>
                        <span className="font-bold text-carbon">
                          Phiếu an toàn hóa chất (MSDS - Material Safety Data Sheet)
                        </span>
                        <p className="text-[10px] text-slate mt-0.5">
                          Đã được bộ phận an toàn phòng chống cháy nổ Cảng Tiên Sa thẩm duyệt và lưu trữ.
                        </p>
                      </div>
                    </label>
                  </div>
                </div>
              )}

              {/* ── CẤU HÌNH CONTAINER LẠNH (REEFER) ── */}
              {editExceptionForm.cargoType === 'REEFER' && (
                <div className="p-4 rounded-2xl bg-sky-50/80 border border-sky-300 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-sky-700 text-lg">ac_unit</span>
                    <strong className="text-sky-950 font-heading text-xs">
                      Thông số vận hành container lạnh (Reefer Parameters)
                    </strong>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-sky-900 uppercase mb-1">
                        Nhiệt độ cài đặt *
                      </label>
                      <input
                        type="text"
                        required
                        value={editExceptionForm.tempRequired}
                        onChange={(e) => setEditExceptionForm({ ...editExceptionForm, tempRequired: e.target.value })}
                        placeholder="VD: -18.0°C"
                        className="w-full px-3 py-2 bg-white border border-sky-300 rounded-xl font-mono text-sky-900 font-bold focus:outline-none focus:border-signal-orange"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-sky-900 uppercase mb-1">
                        Lưu lượng gió (Ventilation)
                      </label>
                      <input
                        type="text"
                        value={editExceptionForm.ventilation}
                        onChange={(e) => setEditExceptionForm({ ...editExceptionForm, ventilation: e.target.value })}
                        placeholder="VD: 25 CBM/h"
                        className="w-full px-3 py-2 bg-white border border-sky-300 rounded-xl text-carbon focus:outline-none focus:border-signal-orange"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-sky-900 uppercase mb-1">
                        Độ ẩm (Humidity)
                      </label>
                      <input
                        type="text"
                        value={editExceptionForm.humidity}
                        onChange={(e) => setEditExceptionForm({ ...editExceptionForm, humidity: e.target.value })}
                        placeholder="VD: 85% RH"
                        className="w-full px-3 py-2 bg-white border border-sky-300 rounded-xl text-carbon focus:outline-none focus:border-signal-orange"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* ── CẤU HÌNH HÀNG QUÁ KHỔ (OOG) ── */}
              {editExceptionForm.cargoType === 'OOG' && (
                <div className="p-4 rounded-2xl bg-purple-50/80 border border-purple-300 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-purple-700 text-lg">straighten</span>
                    <strong className="text-purple-950 font-heading text-xs">
                      Thông số kích thước hàng quá khổ (Out of Gauge - OOG)
                    </strong>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-purple-900 uppercase mb-1">
                        Vượt chiều cao OH (cm)
                      </label>
                      <input
                        type="number"
                        value={editExceptionForm.overHeightCm}
                        onChange={(e) => setEditExceptionForm({ ...editExceptionForm, overHeightCm: e.target.value })}
                        placeholder="VD: 45"
                        className="w-full px-3 py-2 bg-white border border-purple-300 rounded-xl font-mono text-carbon focus:outline-none focus:border-signal-orange"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-purple-900 uppercase mb-1">
                        Vượt chiều rộng OW (cm)
                      </label>
                      <input
                        type="number"
                        value={editExceptionForm.overWidthCm}
                        onChange={(e) => setEditExceptionForm({ ...editExceptionForm, overWidthCm: e.target.value })}
                        placeholder="VD: 30"
                        className="w-full px-3 py-2 bg-white border border-purple-300 rounded-xl font-mono text-carbon focus:outline-none focus:border-signal-orange"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-purple-900 uppercase mb-1">
                        Kích thước dài x rộng x cao
                      </label>
                      <input
                        type="text"
                        value={editExceptionForm.dimensions}
                        onChange={(e) => setEditExceptionForm({ ...editExceptionForm, dimensions: e.target.value })}
                        placeholder="VD: 12.2 x 2.6 x 3.1 m"
                        className="w-full px-3 py-2 bg-white border border-purple-300 rounded-xl text-carbon focus:outline-none focus:border-signal-orange"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* ── CẤU HÌNH HÀNG CÓ ĐIỀU KIỆN / KIỂM DỊCH ── */}
              {editExceptionForm.cargoType === 'CONDITIONAL' && (
                <div className="p-4 rounded-2xl bg-emerald-50/80 border border-emerald-300 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-emerald-700 text-lg">eco</span>
                    <strong className="text-emerald-950 font-heading text-xs">
                      Thông tin kiểm dịch &amp; cấp phép chuyên ngành
                    </strong>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-emerald-900 uppercase mb-1">
                        Loại kiểm dịch *
                      </label>
                      <input
                        type="text"
                        required
                        value={editExceptionForm.quarantineType}
                        onChange={(e) => setEditExceptionForm({ ...editExceptionForm, quarantineType: e.target.value })}
                        placeholder="VD: Kiểm dịch thực vật (Phytosanitary)"
                        className="w-full px-3 py-2 bg-white border border-emerald-300 rounded-xl text-carbon focus:outline-none focus:border-signal-orange"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-emerald-900 uppercase mb-1">
                        Số giấy chứng nhận *
                      </label>
                      <input
                        type="text"
                        required
                        value={editExceptionForm.certificateNo}
                        onChange={(e) => setEditExceptionForm({ ...editExceptionForm, certificateNo: e.target.value })}
                        placeholder="VD: KD-2026-8812"
                        className="w-full px-3 py-2 bg-white border border-emerald-300 rounded-xl font-mono text-carbon font-bold focus:outline-none focus:border-signal-orange"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-3 border-t border-chalk flex justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowExceptionModal(false)}
                  className="px-4 py-2 bg-white border border-chalk text-carbon hover:bg-fog rounded-xl text-xs font-bold cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-signal-orange text-white hover:opacity-90 rounded-xl text-xs font-bold shadow-sm cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  <span className={`material-symbols-outlined text-sm ${saving ? 'animate-spin' : ''}`}>
                    {saving ? 'sync' : 'verified'}
                  </span>
                  <span>{saving ? 'Đang lưu...' : 'Lưu & thẩm định lại'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── 4. MODAL NÂNG CẤP: KHAI BÁO BẢN KHAI HÀNG HÓA (MANIFEST) ── */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 md:p-6 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl border border-chalk max-w-5xl w-full my-auto overflow-hidden animate-fadeIn flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-chalk bg-fog flex items-center justify-between shrink-0">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 text-orange-800 uppercase">
                    Quy trình tạo bản khai
                  </span>
                  <span className="text-xs text-slate">
                    Bước {createStep}/2: {createStep === 1 ? 'Cấu hình chuyến tàu & Phương thức nhập' : 'Xem trước & Thẩm định dữ liệu'}
                  </span>
                </div>
                <h3 className="font-heading text-lg md:text-xl font-extrabold text-carbon mt-0.5">
                  Khai báo bản khai hàng hóa (manifest)
                </h3>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="w-8 h-8 rounded-lg text-slate hover:bg-chalk flex items-center justify-center cursor-pointer font-bold text-lg"
              >
                &times;
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 md:p-6 overflow-y-auto space-y-5 text-xs font-sans flex-1">
              
              {/* ── BƯỚC 1: CẤU HÌNH CHUYẾN TÀU & PHƯƠNG THỨC NHẬP DỮ LIỆU ── */}
              {createStep === 1 && (
                <div className="space-y-5">
                  
                  {/* Hàng chọn Chuyến tàu & Hướng khai */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-[11px] font-bold text-carbon uppercase mb-1">
                        Chọn chuyến tàu vận chuyển *
                      </label>
                      <select
                        value={createForm.voyageNumber}
                        onChange={(e) => handleVoyageChange(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-fog border border-chalk rounded-xl text-carbon font-bold focus:outline-none focus:border-signal-orange focus:ring-0 text-xs"
                      >
                        {voyages.map((v) => (
                          <option key={v.id} value={v.voyageNumber}>
                            {v.voyageNumber} — Tàu {v.vesselName} ({v.pol ? v.pol.replace(/,.*$/, '') : 'Tiên Sa'} → {v.pod ? v.pod.replace(/,.*$/, '') : 'Cảng dỡ'})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-carbon uppercase mb-1">
                        Hướng khai báo *
                      </label>
                      <div className="flex bg-fog p-1 rounded-xl border border-chalk text-xs font-bold">
                        <button
                          type="button"
                          onClick={() => setCreateForm(prev => ({ ...prev, direction: 'EXPORT' }))}
                          className={`flex-1 py-2 rounded-lg transition-colors cursor-pointer ${
                            createForm.direction === 'EXPORT'
                              ? 'bg-carbon text-white shadow-xs'
                              : 'text-slate hover:text-carbon'
                          }`}
                        >
                          Xuất khẩu
                        </button>
                        <button
                          type="button"
                          onClick={() => setCreateForm(prev => ({ ...prev, direction: 'IMPORT' }))}
                          className={`flex-1 py-2 rounded-lg transition-colors cursor-pointer ${
                            createForm.direction === 'IMPORT'
                              ? 'bg-carbon text-white shadow-xs'
                              : 'text-slate hover:text-carbon'
                          }`}
                        >
                          Nhập khẩu
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* THẺ THÔNG TIN CHUYẾN TÀU (Read-only Summary Card) */}
                  {selectedVoyage && (
                    <div className="bg-fog/60 border border-chalk rounded-2xl p-4 space-y-2.5">
                      <div className="flex items-center justify-between border-b border-chalk pb-2">
                        <span className="font-heading font-extrabold text-carbon text-xs flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-sm text-signal-orange">directions_boat</span>
                          Thông tin hành trình chuyến tàu
                        </span>
                        <span className="text-[11px] font-bold text-slate font-mono">
                          Mã chuyến: <strong className="text-carbon">{selectedVoyage.voyageNumber}</strong>
                        </span>
                      </div>

                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                        <div className="min-w-0">
                          <span className="text-[10px] uppercase font-bold text-slate block">Tàu biển</span>
                          <span className="font-bold text-carbon truncate block">{selectedVoyage.vesselName}</span>
                        </div>
                        <div className="min-w-0">
                          <span className="text-[10px] uppercase font-bold text-slate block">Cầu bến tiếp nhận</span>
                          <span className="font-bold text-carbon truncate block">{selectedVoyage.terminal}</span>
                        </div>
                        <div className="min-w-0">
                          <span className="text-[10px] uppercase font-bold text-slate block">Cảng bốc (POL)</span>
                          <span className="font-bold text-carbon font-mono truncate block" title={selectedVoyage.pol}>{selectedVoyage.pol}</span>
                        </div>
                        <div className="min-w-0">
                          <span className="text-[10px] uppercase font-bold text-slate block">Cảng dỡ (POD)</span>
                          <span className="font-bold text-carbon font-mono truncate block" title={selectedVoyage.pod}>{selectedVoyage.pod}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs pt-1 border-t border-chalk/60">
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate block">Kế hoạch đến (ETA)</span>
                          <span className="font-mono text-carbon font-bold">{selectedVoyage.eta || '—'}</span>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate block">Kế hoạch đi (ETD)</span>
                          <span className="font-mono text-carbon font-bold">{selectedVoyage.etd || '—'}</span>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase font-bold text-amber-800 block">Hạn hạ bãi (CY)</span>
                          <span className="font-mono text-amber-900 font-bold">{selectedVoyage.cyCutOff || '—'}</span>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate block">Hạn nộp VGM</span>
                          <span className="font-mono text-carbon font-bold">{selectedVoyage.vgmCutOff || '—'}</span>
                        </div>
                      </div>

                      {/* Cảnh báo khai trùng nếu đã có manifest cho chuyến này */}
                      {existingActiveManifest && (
                        <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs flex items-center justify-between gap-3 mt-1">
                          <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-amber-600 text-base shrink-0">info</span>
                            <span>
                              Chuyến tàu này đã có bản khai <strong>{existingActiveManifest.manifestNumber}</strong> ({existingActiveManifest.status}).
                            </span>
                          </div>
                          <label className="flex items-center gap-1.5 cursor-pointer font-bold text-xs shrink-0 select-none">
                            <input
                              type="checkbox"
                              checked={createForm.isAmendment}
                              onChange={(e) => setCreateForm(prev => ({ ...prev, isAmendment: e.target.checked }))}
                              className="w-4 h-4 rounded text-signal-orange focus:ring-0 cursor-pointer"
                            />
                            <span>Tạo bản khai sửa đổi (Amendment v{(existingActiveManifest.version || 1) + 1})</span>
                          </label>
                        </div>
                      )}
                    </div>
                  )}

                  {/* CHỌN PHƯƠNG THỨC NHẬP DỮ LIỆU */}
                  <div className="space-y-3">
                    <label className="block text-[11px] font-bold text-carbon uppercase">
                      Phương thức nhập danh sách container:
                    </label>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div
                        onClick={() => setInputMode('AUTO_BL')}
                        className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                          inputMode === 'AUTO_BL'
                            ? 'bg-orange-50/50 border-signal-orange ring-1 ring-signal-orange/20 shadow-xs'
                            : 'bg-white border-chalk hover:bg-fog/60'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 font-bold text-carbon text-xs">
                            <span className="material-symbols-outlined text-base text-signal-orange">auto_awesome</span>
                            Tự động trích xuất từ B/L đã phát hành
                          </div>
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                            Ưu tiên xuất khẩu
                          </span>
                        </div>
                        <p className="text-[11px] text-slate mt-1.5">
                          Tự động nạp toàn bộ container, số seal, VGM và thông tin chủ hàng từ các B/L đã phát hành thuộc chuyến tàu.
                        </p>
                      </div>

                      <div
                        onClick={() => setInputMode('FILE_CSV')}
                        className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                          inputMode === 'FILE_CSV'
                            ? 'bg-orange-50/50 border-signal-orange ring-1 ring-signal-orange/20 shadow-xs'
                            : 'bg-white border-chalk hover:bg-fog/60'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 font-bold text-carbon text-xs">
                            <span className="material-symbols-outlined text-base text-signal-orange">upload_file</span>
                            Tải tệp CSV từ máy tính
                          </div>
                          <span className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                            Tệp CSV từ máy
                          </span>
                        </div>
                        <p className="text-[11px] text-slate mt-1.5">
                          Tải lên tệp CSV từ máy tính theo định dạng chuẩn để hệ thống tự động trích xuất và thẩm định danh sách container.
                        </p>
                      </div>
                    </div>

                    {/* NỘI DUNG CHẾ ĐỘ 1: AUTO TỪ B/L */}
                    {inputMode === 'AUTO_BL' && (
                      <div className="border border-chalk rounded-2xl p-4 bg-white space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="font-heading font-extrabold text-carbon text-xs">
                            Danh mục vận đơn (B/L) đã phát hành của chuyến tàu
                          </span>
                          <span className="text-xs text-slate font-mono">
                            {loadingCandidate ? 'Đang tra cứu B/L...' : `${candidateBlData?.candidateBls?.length || 0} vận đơn tìm thấy (${candidateBlData?.totalContainers || 0} container)`}
                          </span>
                        </div>

                        {loadingCandidate ? (
                          <div className="p-8 text-center text-slate">Đang truy vấn vận đơn...</div>
                        ) : candidateBlData?.candidateBls?.length > 0 ? (
                          <div className="space-y-2">
                            {candidateBlData.candidateBls.map((bl) => (
                              <div key={bl.id} className="p-3 bg-fog/70 border border-chalk rounded-xl flex items-center justify-between text-xs">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <strong className="text-carbon font-mono">{bl.blNumber}</strong>
                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                                      {bl.blType}
                                    </span>
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-300">
                                      ● {bl.status}
                                    </span>
                                  </div>
                                  <div className="text-slate text-[11px] mt-1">
                                    Người gửi: <span className="text-carbon font-bold">{bl.shipper}</span> · Hàng: <span>{bl.cargoDescription}</span>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <span className="font-mono font-bold text-carbon block">
                                    {bl.containers?.length || 0} container
                                  </span>
                                  <span className="text-[11px] text-slate font-mono">
                                    {formatKg(bl.grossWeightKg)}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="p-6 text-center text-slate bg-fog rounded-xl">
                            Không tìm thấy Vận đơn B/L nào được phát hành cho chuyến tàu này. Vui lòng chọn chuyến khác hoặc chuyển sang chế độ &ldquo;Tải tệp CSV từ máy tính&rdquo;.
                          </div>
                        )}
                      </div>
                    )}

                    {/* NỘI DUNG CHẾ ĐỘ 2: TẢI TỆP CSV TỪ MÁY TÍNH (KHÔNG CHO PHÉP NHẬP TAY) */}
                    {inputMode === 'FILE_CSV' && (
                      <div className="border border-chalk rounded-2xl p-5 bg-white space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-chalk pb-3">
                          <div>
                            <span className="font-heading font-extrabold text-carbon text-xs block">
                              Chọn tệp CSV từ máy tính
                            </span>
                            <span className="text-xs text-slate mt-0.5 block">
                              Hệ thống tự động phân tích dữ liệu container từ tệp CSV (.csv, .txt). Không cho phép nhập tay.
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={handleDownloadSampleCsv}
                            className="px-3 py-1.5 bg-fog hover:bg-chalk border border-chalk rounded-xl text-xs font-bold text-carbon transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
                          >
                            <span className="material-symbols-outlined text-sm">download</span>
                            Tải tệp mẫu CSV
                          </button>
                        </div>

                        {/* Khi CHƯA có tệp nào được chọn: Vùng kéo thả / nút chọn tệp */}
                        {!uploadedFileInfo ? (
                          <div
                            onDragOver={(e) => { e.preventDefault(); setIsDraggingCsv(true); }}
                            onDragLeave={() => setIsDraggingCsv(false)}
                            onDrop={(e) => {
                              e.preventDefault();
                              setIsDraggingCsv(false);
                              const file = e.dataTransfer.files?.[0];
                              if (file) processCsvFile(file);
                            }}
                            className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all ${
                              isDraggingCsv
                                ? 'border-signal-orange bg-orange-50/50 scale-[0.99]'
                                : 'border-chalk bg-fog/40 hover:bg-fog/70 hover:border-slate-300'
                            }`}
                          >
                            <div className="w-14 h-14 mx-auto rounded-2xl bg-orange-100/80 text-signal-orange flex items-center justify-center mb-3 shadow-2xs">
                              <span className="material-symbols-outlined text-3xl">upload_file</span>
                            </div>
                            <h4 className="font-heading font-extrabold text-sm text-carbon mb-1">
                              Chọn tệp CSV từ máy tính để tải lên
                            </h4>
                            <p className="text-xs text-slate mb-4 max-w-md mx-auto leading-relaxed">
                              Kéo và thả tệp CSV vào đây, hoặc bấm nút bên dưới để chọn tệp từ máy tính của bạn (.csv, .txt)
                            </p>
                            <label className="inline-flex items-center gap-2 px-5 py-2.5 bg-signal-orange hover:opacity-90 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer">
                              <span className="material-symbols-outlined text-base">folder_open</span>
                              <span>Chọn tệp CSV từ máy</span>
                              <input
                                type="file"
                                accept=".csv,.txt"
                                onChange={handleFileUpload}
                                className="hidden"
                              />
                            </label>
                            <div className="text-[11px] text-slate mt-3.5">
                              Định dạng chuẩn: Số container, Loại ISO, Số seal, Khối lượng VGM, Số B/L, Mô tả hàng hóa, Nhiệt độ...
                            </div>
                          </div>
                        ) : (
                          /* Khi ĐÃ có tệp được chọn: Thẻ hiển thị tệp */
                          <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-300 space-y-3">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                              <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                                  <span className="material-symbols-outlined text-2xl">table_chart</span>
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <strong className="text-sm font-bold text-emerald-950 font-mono">
                                      {uploadedFileInfo.name}
                                    </strong>
                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                      Đã nạp tệp thành công ✓
                                    </span>
                                  </div>
                                  <p className="text-xs text-slate mt-0.5 font-sans">
                                    Dung lượng: <b className="text-carbon font-mono">{uploadedFileInfo.size}</b> · Đã nhận diện: <b className="text-signal-orange font-mono">{uploadedFileInfo.count} container</b>
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 self-end sm:self-center">
                                <label className="px-3.5 py-1.5 bg-white hover:bg-fog border border-chalk text-carbon font-bold text-xs rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs">
                                  <span className="material-symbols-outlined text-sm">swap_horiz</span>
                                  <span>Chọn tệp khác</span>
                                  <input
                                    type="file"
                                    accept=".csv,.txt"
                                    onChange={handleFileUpload}
                                    className="hidden"
                                  />
                                </label>
                                <button
                                  type="button"
                                  onClick={handleRemoveUploadedFile}
                                  className="px-3 py-1.5 bg-white hover:bg-red-50 text-red-600 border border-red-200 font-bold text-xs rounded-xl transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                                  title="Hủy bỏ tệp đã chọn"
                                >
                                  <span className="material-symbols-outlined text-sm">delete</span>
                                  <span>Xóa tệp</span>
                                </button>
                              </div>
                            </div>

                            <div className="p-3 bg-white/90 rounded-xl border border-emerald-200 text-xs text-slate flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                              <span className="flex items-center gap-1.5 text-emerald-900 font-medium">
                                <span className="material-symbols-outlined text-sm text-emerald-700 shrink-0">verified</span>
                                Tệp CSV đã sẵn sàng. Nhấn <strong>&ldquo;Tiếp tục sang bước 2&rdquo;</strong> ở dưới để thẩm định chi tiết danh sách container.
                              </span>
                              <span className="font-mono text-[11px] font-bold text-carbon shrink-0">
                                {uploadedFileInfo.count} container
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                </div>
              )}

              {/* ── BƯỚC 2: XEM TRƯỚC & THẨM ĐỊNH DỮ LIỆU CONTAINER ── */}
              {createStep === 2 && (
                <div className="space-y-4">
                  
                  {/* Thanh tóm tắt thẩm định */}
                  <div className="p-3.5 bg-fog rounded-2xl border border-chalk flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="text-xs text-slate uppercase font-bold">Thẩm định sơ bộ:</span>
                      <span className="px-3 py-1 rounded-xl bg-white border border-chalk text-xs font-bold text-carbon font-mono shadow-2xs">
                        Tổng cộng: {previewContainers.length} container
                      </span>
                      <span className="px-3 py-1 rounded-xl bg-emerald-50 border border-emerald-300 text-xs font-bold text-emerald-800 font-mono">
                        ✓ Hợp lệ: {previewValidCount}
                      </span>
                      {previewErrorCount > 0 ? (
                        <span className="px-3 py-1 rounded-xl bg-red-50 border border-red-300 text-xs font-bold text-red-700 font-mono">
                          ⚠ Có lỗi: {previewErrorCount} container
                        </span>
                      ) : (
                        <span className="px-3 py-1 rounded-xl bg-emerald-100 text-emerald-900 text-xs font-bold">
                          ● Đạt 100% điều kiện thẩm định
                        </span>
                      )}
                    </div>

                    <span className="text-[11px] text-slate">
                      Nhấn nút &ldquo;Sửa&rdquo; tại từng dòng để điều chỉnh trực tiếp số liệu trước khi nộp.
                    </span>
                  </div>

                  {/* Bảng danh sách container xem trước */}
                  <div className="overflow-x-auto border border-chalk rounded-2xl max-h-[46vh]">
                    <table className="w-full min-w-[1020px] text-left border-collapse text-xs">
                      <thead className="sticky top-0 bg-fog z-10">
                        <tr className="text-slate font-bold uppercase text-[10px] border-b border-chalk">
                          <th className="py-2.5 px-3 w-44">Số container (ISO 6346)</th>
                          <th className="py-2.5 px-3 w-20">Loại ISO</th>
                          <th className="py-2.5 px-3 w-28">Số seal</th>
                          <th className="py-2.5 px-3 w-36">Khối lượng toàn bộ - VGM</th>
                          <th className="py-2.5 px-3 w-28">Nhiệt độ (40RF)</th>
                          <th className="py-2.5 px-3 w-32">Vận đơn (B/L)</th>
                          <th className="py-2.5 px-3 min-w-[160px]">Mô tả hàng</th>
                          <th className="py-2.5 px-3 w-40">Kết quả thẩm định</th>
                          <th className="py-2.5 px-3 w-20 text-right">Thao tác</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-chalk font-mono font-medium">
                        {previewContainers
                          .slice((previewPage - 1) * previewPageSize, previewPage * previewPageSize)
                          .map((c, idx) => {
                          const realIdx = (previewPage - 1) * previewPageSize + idx;
                          const isEditingThis = editingPreviewIndex === realIdx;

                          if (isEditingThis) {
                            return (
                              <tr key={realIdx} className="bg-amber-50/70 p-2">
                                <td className="p-2">
                                  <input
                                    type="text"
                                    value={inlineEditForm.containerNumber}
                                    onChange={(e) => setInlineEditForm({ ...inlineEditForm, containerNumber: e.target.value.toUpperCase() })}
                                    className="w-full px-2 py-1 bg-white border border-signal-orange rounded text-xs font-mono font-bold uppercase"
                                  />
                                </td>
                                <td className="p-2">
                                  <input
                                    type="text"
                                    value={inlineEditForm.isoType}
                                    onChange={(e) => setInlineEditForm({ ...inlineEditForm, isoType: e.target.value.toUpperCase() })}
                                    className="w-full px-2 py-1 bg-white border border-chalk rounded text-xs font-mono"
                                  />
                                </td>
                                <td className="p-2">
                                  <input
                                    type="text"
                                    value={inlineEditForm.sealNumber}
                                    onChange={(e) => setInlineEditForm({ ...inlineEditForm, sealNumber: e.target.value })}
                                    className="w-full px-2 py-1 bg-white border border-chalk rounded text-xs font-mono font-bold"
                                  />
                                </td>
                                <td className="p-2">
                                  <input
                                    type="number"
                                    value={inlineEditForm.grossWeightKg}
                                    onChange={(e) => setInlineEditForm({ ...inlineEditForm, grossWeightKg: e.target.value })}
                                    className="w-full px-2 py-1 bg-white border border-chalk rounded text-xs font-mono font-bold"
                                  />
                                </td>
                                <td className="p-2">
                                  <input
                                    type="text"
                                    value={inlineEditForm.tempRequired}
                                    onChange={(e) => setInlineEditForm({ ...inlineEditForm, tempRequired: e.target.value })}
                                    placeholder="-18.0°C"
                                    className="w-full px-2 py-1 bg-white border border-chalk rounded text-xs font-mono"
                                  />
                                </td>
                                <td className="p-2">
                                  <input
                                    type="text"
                                    value={inlineEditForm.blNumber}
                                    onChange={(e) => setInlineEditForm({ ...inlineEditForm, blNumber: e.target.value })}
                                    className="w-full px-2 py-1 bg-white border border-chalk rounded text-xs font-mono"
                                  />
                                </td>
                                <td className="p-2">
                                  <input
                                    type="text"
                                    value={inlineEditForm.commodity}
                                    onChange={(e) => setInlineEditForm({ ...inlineEditForm, commodity: e.target.value })}
                                    className="w-full px-2 py-1 bg-white border border-chalk rounded text-xs font-sans"
                                  />
                                </td>
                                <td className="p-2 text-center" colSpan={2}>
                                  <div className="flex items-center gap-1.5 justify-end">
                                    <button
                                      type="button"
                                      onClick={handleSaveInlineEdit}
                                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded text-[11px] cursor-pointer"
                                    >
                                      Lưu
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setEditingPreviewIndex(null)}
                                      className="px-2 py-1 bg-white border border-chalk rounded text-[11px] cursor-pointer"
                                    >
                                      Hủy
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          }

                          return (
                            <tr key={realIdx} className={`transition-colors ${c.isValid ? 'hover:bg-fog/60' : 'bg-red-50/40 hover:bg-red-50/70'}`}>
                              <td className="py-2.5 px-3 font-bold text-carbon text-sm">
                                {c.containerNumber}
                                {c.expectedCheckDigit !== undefined && (
                                  c.expectedCheckDigit === c.actualCheckDigit ? (
                                    <span className="ml-2 text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-1 py-0.5 rounded font-sans font-bold">
                                      ISO chuẩn
                                    </span>
                                  ) : (
                                    <span className="ml-2 text-[10px] text-red-600 bg-red-50 border border-red-200 px-1 py-0.5 rounded font-sans font-bold">
                                      Sai ISO (cần {c.expectedCheckDigit})
                                    </span>
                                  )
                                )}
                              </td>
                              <td className="py-2.5 px-3 font-bold text-carbon">{c.isoType}</td>
                              <td className="py-2.5 px-3">
                                {c.sealNumber ? (
                                  <span className="font-bold text-carbon">{c.sealNumber}</span>
                                ) : (
                                  <span className="text-red-600 italic font-sans font-bold">Thiếu chì</span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 font-bold text-carbon">{formatKg(c.grossWeightKg)}</td>
                              <td className="py-2.5 px-3 font-sans">
                                {c.tempRequired ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-50 text-sky-800 border border-sky-300">
                                    <span className="material-symbols-outlined text-xs">ac_unit</span>
                                    {c.tempRequired}
                                  </span>
                                ) : (
                                  <span className="text-slate">—</span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 font-bold text-carbon">{c.blNumber}</td>
                              <td className="py-2.5 px-3 font-sans text-slate text-[11px] max-w-xs truncate" title={c.commodity}>
                                {c.commodity}
                              </td>
                              <td className="py-2.5 px-3 font-sans">
                                {c.isValid ? (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-300">
                                    ● Hợp lệ
                                  </span>
                                ) : (
                                  <div className="space-y-0.5">
                                    {c.errors.map((err, eIdx) => (
                                      <span key={eIdx} className="block text-[10px] text-red-700 font-bold">
                                        ⚠ {err}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-right font-sans">
                                <button
                                  type="button"
                                  onClick={() => handleStartInlineEdit(realIdx)}
                                  className="px-2.5 py-1 text-[11px] font-bold text-carbon bg-white hover:bg-fog border border-chalk rounded-lg transition-colors cursor-pointer"
                                >
                                  Sửa
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Phân trang bảng xem trước container */}
                  {previewContainers.length > previewPageSize && (
                    <div className="border border-chalk rounded-xl overflow-hidden mt-2">
                      <ShippingPagination
                        currentPage={previewPage}
                        totalItems={previewContainers.length}
                        pageSize={previewPageSize}
                        onPageChange={setPreviewPage}
                        onPageSizeChange={setPreviewPageSize}
                        pageSizeOptions={[5, 10, 20]}
                        itemName="container"
                      />
                    </div>
                  )}

                </div>
              )}

            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 border-t border-chalk bg-fog flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
              <div>
                {createStep === 2 && (
                  <button
                    type="button"
                    onClick={() => setCreateStep(1)}
                    className="px-4 py-2 bg-white border border-chalk text-carbon hover:bg-fog rounded-xl text-xs font-bold cursor-pointer flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-sm">arrow_back</span>
                    Quay lại chọn nguồn
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-white border border-chalk text-carbon hover:bg-fog rounded-xl text-xs font-bold cursor-pointer"
                >
                  Đóng
                </button>

                {createStep === 1 ? (
                  <button
                    type="button"
                    onClick={handleProceedToPreview}
                    className="px-5 py-2.5 bg-signal-orange text-white hover:opacity-90 rounded-xl text-xs font-bold shadow-sm cursor-pointer flex items-center gap-1.5"
                  >
                    <span>Tiếp tục: Xem trước &amp; Thẩm định dữ liệu</span>
                    <span className="material-symbols-outlined text-sm">arrow_forward</span>
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => handleSaveManifest(true)}
                      disabled={saving}
                      className="px-4 py-2 bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                    >
                      <span className="material-symbols-outlined text-sm">save_as</span>
                      <span>Lưu bản nháp</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowConfirmSubmitModal(true)}
                      disabled={saving || previewErrorCount > 0}
                      className={`px-5 py-2.5 rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 ${
                        previewErrorCount > 0
                          ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                          : 'bg-signal-orange text-white hover:opacity-90 cursor-pointer'
                      }`}
                      title={previewErrorCount > 0 ? 'Vui lòng sửa các container báo đỏ trước khi nộp chính thức' : ''}
                    >
                      <span className="material-symbols-outlined text-base">send</span>
                      <span>Nộp bản khai sang Cảng</span>
                    </button>
                  </>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ── MODAL XÁC NHẬN NỘP BẢN KHAI CHÍNH THỨC SANG CẢNG TIÊN SA ── */}
      {showConfirmSubmitModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-chalk max-w-md w-full p-6 space-y-4 animate-fadeIn">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-100 text-signal-orange flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-2xl">send</span>
              </div>
              <div>
                <h4 className="font-heading font-extrabold text-carbon text-base">
                  Xác nhận nộp bản khai hàng hóa
                </h4>
                <p className="text-xs text-slate mt-1">
                  Bản khai gồm <strong className="text-carbon">{previewContainers.length} container</strong> sẽ được nộp chính thức đến hệ thống điều hành Cảng Tiên Sa để đối soát với cổng kiểm soát và trạm cân VGM.
                </p>
              </div>
            </div>

            <div className="p-3 bg-fog rounded-xl border border-chalk text-xs space-y-1">
              <div>Chuyến tàu: <strong>{createForm.voyageNumber}</strong> ({createForm.direction === 'EXPORT' ? 'Xuất khẩu' : 'Nhập khẩu'})</div>
              <div>Người nộp: <strong>Đại diện Hãng tàu</strong></div>
              <div>Trạng thái sau nộp: <strong className="text-emerald-700">Đã gửi cảng</strong></div>
            </div>

            <div className="pt-2 flex justify-end gap-3 border-t border-chalk">
              <button
                type="button"
                onClick={() => setShowConfirmSubmitModal(false)}
                className="px-4 py-2 bg-white border border-chalk text-carbon hover:bg-fog rounded-xl text-xs font-bold cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={() => handleSaveManifest(false)}
                disabled={saving}
                className="px-5 py-2.5 bg-signal-orange text-white hover:opacity-90 rounded-xl text-xs font-bold shadow-sm cursor-pointer disabled:opacity-50"
              >
                {saving ? 'Đang nộp...' : 'Đồng ý nộp bản khai'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
