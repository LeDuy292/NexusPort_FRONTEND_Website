import React, { useState, useEffect, useRef } from 'react';
import { shippingLineApi, formatApiErrorMessage } from '../api/shippingLineApi';

export default function EdoIssueModal({ isOpen, initialBlNumber = '', onClose, onSuccess }) {
  const [blNumber, setBlNumber] = useState(initialBlNumber);
  const [availableBls, setAvailableBls] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestionsRef = useRef(null);

  const [checkResult, setCheckResult] = useState(null);
  const [checking, setChecking] = useState(false);
  const [actionInProgress, setActionInProgress] = useState(null);

  // Thông tin eDO sắp phát hành
  const [validUntil, setValidUntil] = useState('');
  const [emptyReturnDepot, setEmptyReturnDepot] = useState('Bãi Depot Cảng Tiên Sa (Khu C)');
  const [freeTimeDays, setFreeTimeDays] = useState(7);
  const [selectedContainers, setSelectedContainers] = useState([]);
  const [notes, setNotes] = useState('');

  // Hộp thoại xác nhận trước khi phát hành
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successInfo, setSuccessInfo] = useState('');

  // Tải danh sách B/L nhập khẩu để gợi ý tìm kiếm
  useEffect(() => {
    if (isOpen) {
      const fetchBlList = async () => {
        try {
          const res = await shippingLineApi.getBillsOfLading();
          const list = Array.isArray(res) ? res : (res?.data || []);
          // Ưu tiên các B/L nhập hoặc có đích đến Tiên Sa
          setAvailableBls(list);
        } catch {
          // Bỏ qua lỗi ngầm khi gợi ý
        }
      };
      fetchBlList();

      if (initialBlNumber) {
        setBlNumber(initialBlNumber);
        doCheck(initialBlNumber);
      } else {
        setCheckResult(null);
        setError('');
        setSuccessInfo('');
        setShowConfirmDialog(false);
      }
    }
  }, [isOpen, initialBlNumber]);

  // Đóng dropdown khi click bên ngoài
  useEffect(() => {
    function handleClickOutside(e) {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!isOpen) return null;

  // Lọc danh sách gợi ý khi gõ: CHỈ GỢI Ý VẬN ĐƠN NHẬP KHẨU (IMPORT)
  const filteredSuggestions = availableBls.filter(b => {
    if (b.direction && b.direction !== 'IMPORT') return false;
    if (!blNumber.trim()) return true;
    const q = blNumber.trim().toUpperCase();
    return (
      b.blNumber.toUpperCase().includes(q) ||
      (b.consignee && b.consignee.toUpperCase().includes(q)) ||
      (b.cargoDescription && b.cargoDescription.toUpperCase().includes(q))
    );
  }).slice(0, 5);

  const doCheck = async (targetBl) => {
    const blToQuery = (targetBl || blNumber).trim();
    if (!blToQuery) return;
    setChecking(true);
    setError('');
    setSuccessInfo('');
    setCheckResult(null);
    setShowSuggestions(false);

    try {
      const res = await shippingLineApi.checkEdoEligibility(blToQuery);
      const payload = res?.criteria ? res : (res?.data || null);
      if (payload) {
        setCheckResult(payload);
        if (payload.eligible && payload.containers) {
          setSelectedContainers(payload.containers.map(c => c.containerNumber));
          if (payload.edoDraftInfo?.suggestedValidUntil) {
            setValidUntil(payload.edoDraftInfo.suggestedValidUntil);
          }
          if (payload.edoDraftInfo?.defaultEmptyReturnDepot) {
            setEmptyReturnDepot(payload.edoDraftInfo.defaultEmptyReturnDepot);
          }
          if (payload.edoDraftInfo?.freeTimeDays) {
            setFreeTimeDays(payload.edoDraftInfo.freeTimeDays);
          }
        } else {
          setSelectedContainers([]);
        }
      }
    } catch (err) {
      setError(formatApiErrorMessage(err, 'Không thể kiểm tra điều kiện vận đơn'));
    } finally {
      setChecking(false);
    }
  };

  const handleSelectBlSuggestion = (selected) => {
    setBlNumber(selected.blNumber);
    setShowSuggestions(false);
    doCheck(selected.blNumber);
  };

  // Xử lý nộp B/L gốc trực tiếp
  const handleSurrenderBl = async () => {
    const target = (blNumber || '').trim();
    if (!target) return;
    setActionInProgress('SURRENDER');
    setError('');
    try {
      await shippingLineApi.surrenderBl(target);
      setSuccessInfo(`Đã xác nhận thu hồi B/L gốc cho vận đơn ${target}.`);
      await doCheck(target);
    } catch (err) {
      setError(formatApiErrorMessage(err, 'Lỗi khi thu hồi B/L gốc'));
    } finally {
      setActionInProgress(null);
    }
  };

  // Xử lý thu đủ cước và phụ phí trực tiếp
  const handleCollectFees = async () => {
    const target = (blNumber || '').trim();
    if (!target) return;
    setActionInProgress('COLLECT_FEES');
    setError('');
    try {
      await shippingLineApi.collectFees(target);
      setSuccessInfo(`Đã thu đủ phí và mở khóa tài chính cho vận đơn ${target}.`);
      await doCheck(target);
    } catch (err) {
      setError(formatApiErrorMessage(err, 'Lỗi khi ghi nhận thu phí'));
    } finally {
      setActionInProgress(null);
    }
  };

  // Xử lý hủy eDO cũ đang hiệu lực để mở khóa phát hành lại
  const handleCancelExistingEdo = async () => {
    const targetEdo = checkResult?.activeEdo;
    const edoId = targetEdo?.id || targetEdo?.edoNumber;
    if (!edoId) return;

    const reason = window.prompt(`Nhập lý do hủy lệnh eDO ${targetEdo.edoNumber || ''} (để có thể cấp lại):`);
    if (reason === null) return;

    setActionInProgress('CANCEL_EDO');
    setError('');
    try {
      await shippingLineApi.cancelEdo(edoId, reason || 'Hủy lệnh theo yêu cầu cấp lại');
      setSuccessInfo(`Đã hủy lệnh giao hàng điện tử cũ (${targetEdo.edoNumber}). Vận đơn hiện đã đủ điều kiện cấp lại!`);
      await doCheck(blNumber);
    } catch (err) {
      setError(formatApiErrorMessage(err, 'Lỗi khi hủy lệnh eDO'));
    } finally {
      setActionInProgress(null);
    }
  };

  // Mở popup xác nhận cấp lệnh
  const handleOpenConfirm = () => {
    if (!checkResult?.eligible) return;
    if (selectedContainers.length === 0) {
      setError('Vui lòng chọn ít nhất một container để cấp lệnh');
      return;
    }
    if (!validUntil.trim()) {
      setError('Vui lòng chọn thời hạn hiệu lực cho lệnh eDO');
      return;
    }
    setError('');
    setShowConfirmDialog(true);
  };

  // Xác nhận phát hành eDO
  const handleConfirmIssue = async () => {
    setSubmitting(true);
    setError('');

    try {
      const res = await shippingLineApi.issueEdo({
        blNumber: blNumber.trim(),
        validUntil: validUntil.trim(),
        emptyReturnDepot,
        freeTimeDays,
        containerNumbers: selectedContainers,
        notes,
      });
      const createdEdo = res?.data || res;
      setShowConfirmDialog(false);
      onSuccess(createdEdo);
      onClose();
    } catch (err) {
      setError(formatApiErrorMessage(err, 'Lỗi khi phát hành lệnh eDO'));
    } finally {
      setSubmitting(false);
    }
  };

  const toggleContainer = (containerNo) => {
    if (!checkResult?.eligible) return;
    if (selectedContainers.includes(containerNo)) {
      setSelectedContainers(selectedContainers.filter(c => c !== containerNo));
    } else {
      setSelectedContainers([...selectedContainers, containerNo]);
    }
  };

  const defaultDepots = [
    'Bãi Depot Cảng Tiên Sa (Khu C)',
    'Bãi Depot Cảng Liên Chiểu',
    'Bãi Depot ICD Hòa Cầm - Đà Nẵng',
    'Bãi Depot Khu Kinh Tế Chu Lai',
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-chalk max-w-2xl w-full overflow-hidden max-h-[92vh] flex flex-col animate-fadeIn relative">
        
        {/* ── HEADER ── */}
        <div className="px-6 py-4 border-b border-chalk bg-fog flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-xl text-signal-orange">assignment_turned_in</span>
            <div>
              <h3 className="font-heading text-lg font-extrabold text-carbon">
                Phát hành lệnh giao hàng điện tử (eDO)
              </h3>
              <p className="text-xs text-slate mt-0.5">
                Chỉ áp dụng cho hàng NHẬP KHẨU tại Cảng Tiên Sa. Kiểm tra điều kiện trước khi cấp lệnh.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-slate hover:bg-chalk flex items-center justify-center cursor-pointer font-bold text-lg"
          >
            &times;
          </button>
        </div>

        {/* ── NỘI DUNG CHÍNH ── */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1 text-xs font-sans">
          {error && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-start gap-2">
              <span className="material-symbols-outlined text-red-600 text-base shrink-0 mt-0.5">error</span>
              <div className="font-medium leading-relaxed">{error}</div>
            </div>
          )}

          {successInfo && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs flex items-start gap-2">
              <span className="material-symbols-outlined text-emerald-600 text-base shrink-0 mt-0.5">check_circle</span>
              <div className="font-medium leading-relaxed">{successInfo}</div>
            </div>
          )}

          {/* Ô Nhập B/L & Dropdown Tự Động Gợi Ý */}
          <div className="space-y-1.5 relative" ref={suggestionsRef}>
            <label className="block text-[11px] font-bold text-carbon uppercase">
              Số Vận Đơn (B/L) *
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={blNumber}
                  onChange={(e) => {
                    setBlNumber(e.target.value.toUpperCase());
                    setShowSuggestions(true);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      setShowSuggestions(false);
                      doCheck(blNumber);
                    }
                  }}
                  placeholder="Gõ hoặc chọn B/L (VD: BL-INB-DAD-2601)..."
                  className="w-full px-3.5 py-2.5 bg-fog border border-chalk rounded-xl font-mono text-carbon font-bold focus:outline-none focus:border-signal-orange focus:ring-0 uppercase text-xs"
                />

                {/* Dropdown Gợi Ý Khi Gõ */}
                {showSuggestions && filteredSuggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-chalk rounded-xl shadow-xl z-20 overflow-hidden divide-y divide-chalk max-h-56 overflow-y-auto">
                    <div className="px-3 py-1.5 bg-fog/80 text-[10px] font-bold uppercase text-slate">
                      Gợi ý vận đơn nhập khẩu trong hệ thống:
                    </div>
                    {filteredSuggestions.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => handleSelectBlSuggestion(item)}
                        className="p-2.5 hover:bg-fog cursor-pointer transition-colors text-xs flex justify-between items-center gap-2"
                      >
                        <div>
                          <div className="font-mono font-bold text-carbon flex items-center gap-1.5">
                            <span>{item.blNumber}</span>
                            {item.direction === 'IMPORT' && (
                              <span className="text-[9px] bg-purple-100 text-purple-800 px-1.5 py-0.2 rounded font-sans font-bold">
                                Nhập khẩu
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate truncate max-w-sm">
                            {item.consignee}
                          </div>
                        </div>
                        <div className="text-right text-[10px] text-slate font-mono shrink-0">
                          {item.containers?.length || 0} cont
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => doCheck(blNumber)}
                disabled={checking || !blNumber.trim()}
                className="px-4 py-2.5 bg-carbon hover:bg-black disabled:bg-slate-300 text-white text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                <span className={`material-symbols-outlined text-sm ${checking ? 'animate-spin' : ''}`}>
                  {checking ? 'sync' : 'verified_user'}
                </span>
                {checking ? 'Đang kiểm tra...' : 'Kiểm tra điều kiện'}
              </button>
            </div>
          </div>

          {/* ── KẾT QUẢ KIỂM TRA 4 ĐIỀU KIỆN CỐT LÕI ── */}
          {checkResult && (
            <div className="space-y-3 pt-1">
              
              {/* Thẻ Tiêu Đề Tổng Kết Điều Kiện */}
              <div className={`p-4 rounded-2xl border transition-all ${
                checkResult.eligible
                  ? 'bg-emerald-50/90 border-emerald-300'
                  : 'bg-rose-50/90 border-rose-300'
              }`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className={`material-symbols-outlined text-2xl ${
                      checkResult.eligible ? 'text-emerald-700' : 'text-rose-700'
                    }`}>
                      {checkResult.eligible ? 'check_circle' : 'cancel'}
                    </span>
                    <div>
                      <h4 className={`font-heading font-extrabold text-sm ${
                        checkResult.eligible ? 'text-emerald-950' : 'text-rose-950'
                      }`}>
                        {checkResult.eligible
                          ? 'ĐỦ ĐIỀU KIỆN PHÁT HÀNH LỆNH GIAO HÀNG (eDO)'
                          : checkResult.isExport
                            ? 'VẬN ĐƠN XUẤT KHẨU — KHÔNG ÁP DỤNG LỆNH GIAO HÀNG (eDO)'
                            : checkResult.isAlreadyIssued
                              ? 'VẬN ĐƠN ĐÃ CÓ LỆNH eDO ĐANG HIỆU LỰC'
                              : 'CHƯA ĐỦ ĐIỀU KIỆN PHÁT HÀNH eDO'}
                      </h4>
                      <p className={`text-xs mt-0.5 font-medium ${
                        checkResult.eligible ? 'text-emerald-800' : 'text-rose-800'
                      }`}>
                        {checkResult.eligible
                          ? 'Toàn bộ tiêu chí kiểm tra nghiệp vụ đã đạt chuẩn. Vui lòng xác nhận thông tin phát hành bên dưới.'
                          : checkResult.isExport
                            ? 'Quy định hàng hải quốc tế: Lệnh giao hàng (D/O / eDO) CHỈ phát hành ở chiều NHẬP KHẨU tại cảng đến để người nhận lấy hàng; KHÔNG phát hành ở chiều xuất khẩu.'
                            : checkResult.isAlreadyIssued
                              ? 'Vận đơn này đã có lệnh giao hàng điện tử. Nghiệp vụ hàng hải nghiêm cấm cấp trùng. Vui lòng hủy lệnh cũ trước khi cấp lại.'
                              : 'Hệ thống phát hiện điều kiện chưa đạt. Nút phát hành eDO tạm thời bị khóa.'}
                      </p>
                    </div>
                  </div>

                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase shrink-0 border ${
                    checkResult.eligible
                      ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                      : 'bg-rose-100 text-rose-900 border-rose-300'
                  }`}>
                    {checkResult.criteria?.filter(c => c.passed).length}/{checkResult.criteria?.length} ĐẠT
                  </span>
                </div>
              </div>

              {/* Thông báo nếu lệnh cũ đã bị hủy */}
              {checkResult.lastCancelledEdo && !checkResult.isAlreadyIssued && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-center gap-2">
                  <span className="material-symbols-outlined text-blue-600 text-base shrink-0">history</span>
                  <div>
                    Lệnh eDO trước đó (<b>{checkResult.lastCancelledEdo.edoNumber}</b>) đã được hủy. Hệ thống cho phép phát hành lệnh eDO mới thay thế.
                  </div>
                </div>
              )}

              {/* Danh Sách Chi Tiết Các Điều Kiện Cấp D/O */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold uppercase text-slate block px-1">
                  Chi tiết {checkResult.criteria?.length || 5} tiêu chuẩn kiểm tra bắt buộc:
                </span>

                <div className="grid grid-cols-1 gap-2">
                  {(checkResult.criteria || []).map((cr, idx) => (
                    <div
                      key={cr.id || idx}
                      className={`p-3 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 transition-colors ${
                        cr.passed
                          ? 'bg-emerald-50/40 border-emerald-200'
                          : 'bg-rose-50/50 border-rose-200'
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <span className={`material-symbols-outlined text-lg shrink-0 mt-0.5 ${
                          cr.passed ? 'text-emerald-600' : 'text-rose-600'
                        }`}>
                          {cr.passed ? 'check_circle' : 'cancel'}
                        </span>
                        <div>
                          <div className={`font-bold text-xs flex items-center gap-1.5 ${
                            cr.passed ? 'text-emerald-950' : 'text-rose-950'
                          }`}>
                            <span>{cr.name}</span>
                            <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                              cr.passed ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                            }`}>
                              {cr.passed ? 'Đạt' : 'Chưa đạt'}
                            </span>
                          </div>
                          <div className={`text-[11px] mt-0.5 ${
                            cr.passed ? 'text-slate' : 'text-rose-800 font-medium'
                          }`}>
                            {cr.detail}
                          </div>
                        </div>
                      </div>

                      {/* Nút Hành Động Trực Tiếp Cho Từng Điều Kiện Chưa Đạt */}
                      {!cr.passed && cr.actionRequired && (
                        <div className="shrink-0 self-end sm:self-center">
                          {cr.actionRequired === 'COLLECT_FEES' && (
                            <button
                              type="button"
                              onClick={handleCollectFees}
                              disabled={actionInProgress === 'COLLECT_FEES'}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1 cursor-pointer"
                            >
                              <span className="material-symbols-outlined text-xs">payments</span>
                              <span>{actionInProgress === 'COLLECT_FEES' ? 'Đang ghi...' : 'Xác nhận thu đủ phí'}</span>
                            </button>
                          )}
                          {cr.actionRequired === 'SURRENDER_ORIGINAL' && (
                            <button
                              type="button"
                              onClick={handleSurrenderBl}
                              disabled={actionInProgress === 'SURRENDER'}
                              className="px-3 py-1.5 bg-purple-700 hover:bg-purple-800 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1 cursor-pointer"
                            >
                              <span className="material-symbols-outlined text-xs">inventory_2</span>
                              <span>{actionInProgress === 'SURRENDER' ? 'Đang ghi...' : 'Thu hồi B/L gốc'}</span>
                            </button>
                          )}
                          {cr.actionRequired === 'CANCEL_EXISTING_EDO' && (
                            <button
                              type="button"
                              onClick={handleCancelExistingEdo}
                              disabled={actionInProgress === 'CANCEL_EDO'}
                              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1 cursor-pointer"
                              title="Hủy lệnh eDO cũ để mở khóa quyền cấp lại lệnh mới"
                            >
                              <span className="material-symbols-outlined text-xs">cancel</span>
                              <span>{actionInProgress === 'CANCEL_EDO' ? 'Đang hủy...' : 'Hủy lệnh cũ để cấp lại'}</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* ── THÔNG TIN XÁC NHẬN LỆNH eDO SẼ PHÁT HÀNH (CHỈ MỞ KHI 4/4 ĐẠT) ── */}
              {checkResult.eligible && (
                <div className="space-y-3 pt-2 border-t border-chalk">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase text-carbon flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-sm text-signal-orange">description</span>
                      Thông tin lệnh giao hàng (eDO) sẽ phát hành:
                    </span>
                    <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      Sẵn sàng cấp lệnh
                    </span>
                  </div>

                  {/* Khối Thông Tin Tự Động Từ B/L (Chỉ Đọc) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs bg-fog p-3 rounded-xl border border-chalk">
                    <div>
                      <span className="text-[10px] text-slate font-bold uppercase block">Người Nhận Hàng (Consignee)</span>
                      <strong className="text-carbon font-bold truncate block" title={checkResult.bl?.consignee}>
                        {checkResult.bl?.consignee}
                      </strong>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate font-bold uppercase block">Tàu &amp; Chuyến Tàu</span>
                      <span className="text-carbon font-bold">
                        {checkResult.bl?.vesselName} ({checkResult.bl?.voyageNumber})
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate font-bold uppercase block">Cảng Bốc &rarr; Cảng Dỡ</span>
                      <span className="text-slate font-sans text-[11px]">
                        {checkResult.bl?.pol} &rarr; <b className="text-carbon">{checkResult.bl?.pod}</b>
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate font-bold uppercase block">Thời Gian Miễn Phí (Free Time)</span>
                      <span className="text-emerald-800 font-bold font-mono">
                        {freeTimeDays} ngày (Lưu bãi / Lưu vỏ cont)
                      </span>
                    </div>
                  </div>

                  {/* Danh Sách Container Được Cấp Lệnh Lấy Hàng */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="block text-[11px] font-bold text-carbon uppercase">
                        Chọn container cấp lệnh lấy hàng ({selectedContainers.length}/{checkResult.containers?.length || 0}):
                      </label>
                      <button
                        type="button"
                        onClick={() => setSelectedContainers(checkResult.containers.map(c => c.containerNumber))}
                        className="text-[10px] text-signal-orange font-bold hover:underline cursor-pointer"
                      >
                        Chọn tất cả
                      </button>
                    </div>

                    <div className="space-y-1.5 bg-fog p-2 rounded-xl border border-chalk">
                      {(checkResult.containers || []).map((c) => {
                        const isSelected = selectedContainers.includes(c.containerNumber);
                        return (
                          <div
                            key={c.containerNumber}
                            onClick={() => toggleContainer(c.containerNumber)}
                            className={`flex items-center justify-between p-2.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                              isSelected
                                ? 'bg-white border-signal-orange text-carbon font-bold shadow-2xs'
                                : 'bg-white border-chalk hover:bg-chalk/50'
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => {}}
                                className="rounded text-signal-orange focus:ring-signal-orange cursor-pointer"
                              />
                              <span className="font-mono font-bold text-carbon">{c.containerNumber}</span>
                              <span className="text-slate text-[11px]">({c.isoType} — Chì: {c.sealNumber || 'N/A'})</span>
                            </div>

                            <span className="text-emerald-700 font-bold text-[10px] bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                              Sẵn sàng cấp
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Khối Cấu Hình: Hạn Hiệu Lực & Nơi Trả Vỏ Rỗng (Cho Phép Sửa) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block text-[11px] font-bold text-carbon uppercase mb-1">
                        Hạn Hiệu Lực Lấy Hàng (eDO) *
                      </label>
                      <input
                        type="text"
                        value={validUntil}
                        onChange={(e) => setValidUntil(e.target.value)}
                        placeholder="YYYY-MM-DD HH:mm:ss"
                        className="w-full px-3 py-2 bg-fog border border-chalk rounded-xl font-mono text-carbon font-bold focus:outline-none focus:border-signal-orange focus:ring-0 text-xs"
                      />
                      <span className="text-[10px] text-slate mt-0.5 block">Mặc định: 7 ngày kể từ hôm nay</span>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-carbon uppercase mb-1">
                        Nơi Trả Vỏ Container Rỗng *
                      </label>
                      <select
                        value={emptyReturnDepot}
                        onChange={(e) => setEmptyReturnDepot(e.target.value)}
                        className="w-full px-3 py-2 bg-fog border border-chalk rounded-xl text-carbon font-bold focus:outline-none focus:border-signal-orange focus:ring-0 text-xs cursor-pointer"
                      >
                        {defaultDepots.map(depot => (
                          <option key={depot} value={depot}>{depot}</option>
                        ))}
                      </select>
                      <span className="text-[10px] text-slate mt-0.5 block">Hãng tàu chỉ định bãi hạ vỏ</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-carbon uppercase mb-1">
                      Ghi Chú Lệnh Giao Hàng
                    </label>
                    <input
                      type="text"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Ghi chú thêm cho chủ hàng hoặc cán bộ cổng cảng..."
                      className="w-full px-3 py-2 bg-fog border border-chalk rounded-xl text-carbon focus:outline-none focus:border-signal-orange focus:ring-0 text-xs"
                    />
                  </div>

                </div>
              )}

            </div>
          )}
        </div>

        {/* ── FOOTER CHUẨN: NÚT KHÓA KHI CHƯA KIỂM TRA HOẶC CHƯA ĐỦ ── */}
        <div className="px-6 py-4 border-t border-chalk bg-fog/50 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div>
            {checkResult && !checkResult.eligible && (
              <span className="text-[11px] text-rose-700 font-bold flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">lock</span>
                {checkResult.isExport
                  ? 'Nút phát hành khóa: Lệnh eDO chỉ phát hành cho hàng nhập khẩu'
                  : checkResult.isAlreadyIssued
                    ? 'Nút phát hành khóa: Đã có lệnh eDO đang có hiệu lực'
                    : 'Nút phát hành đang khóa do chưa đủ điều kiện nghiệp vụ'}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5 self-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white border border-chalk text-carbon hover:bg-fog rounded-xl text-xs font-bold cursor-pointer"
            >
              Đóng
            </button>

            {/* Nút Phát Hành eDO */}
            <button
              type="button"
              onClick={handleOpenConfirm}
              disabled={!checkResult || !checkResult.eligible || selectedContainers.length === 0}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 ${
                !checkResult || !checkResult.eligible || selectedContainers.length === 0
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed border border-chalk'
                  : 'bg-signal-orange hover:opacity-90 text-white cursor-pointer'
              }`}
            >
              <span className="material-symbols-outlined text-base">
                {!checkResult || !checkResult.eligible ? 'lock' : 'done_all'}
              </span>
              <span>
                {!checkResult
                  ? 'Phát hành eDO'
                  : checkResult.isExport
                    ? 'Không áp dụng cho hàng xuất khẩu'
                    : checkResult.isAlreadyIssued
                      ? 'Đã có lệnh eDO (Không thể cấp trùng)'
                      : !checkResult.eligible
                        ? 'Chưa đủ điều kiện phát hành'
                        : checkResult.lastCancelledEdo
                          ? 'Cấp lại lệnh eDO'
                          : 'Phát hành eDO'}
              </span>
            </button>
          </div>
        </div>

        {/* ── HỘP THOẠI XÁC NHẬN PHÁT HÀNH (CONFIRMATION MODAL) ── */}
        {showConfirmDialog && (
          <div className="absolute inset-0 z-30 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl border border-chalk max-w-md w-full p-6 space-y-4 animate-fadeIn">
              <div className="flex items-center gap-3 border-b border-chalk pb-3">
                <div className="w-10 h-10 rounded-xl bg-orange-100 text-signal-orange flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-2xl">verified</span>
                </div>
                <div>
                  <h4 className="font-heading font-extrabold text-base text-carbon">
                    Xác nhận phát hành lệnh eDO
                  </h4>
                  <p className="text-xs text-slate">Lệnh điện tử sẽ được gửi trực tiếp sang Cảng Tiên Sa</p>
                </div>
              </div>

              <div className="space-y-2 text-xs bg-fog p-3.5 rounded-xl border border-chalk font-sans">
                <div className="flex justify-between">
                  <span className="text-slate">Vận đơn (B/L):</span>
                  <strong className="font-mono text-carbon">{blNumber}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate">Chủ hàng nhận:</span>
                  <strong className="text-carbon truncate max-w-[200px]" title={checkResult.bl?.consignee}>
                    {checkResult.bl?.consignee}
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate">Số lượng cấp lệnh:</span>
                  <strong className="text-signal-orange font-bold">{selectedContainers.length} Container</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate">Hiệu lực đến:</span>
                  <span className="font-mono font-bold text-carbon">{validUntil}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate">Nơi trả vỏ:</span>
                  <span className="text-carbon font-semibold text-right">{emptyReturnDepot}</span>
                </div>
              </div>

              <p className="text-[11px] text-slate italic leading-relaxed">
                Sau khi xác nhận, hệ thống sẽ tự động sinh mã PIN bảo mật cho chủ hàng và cấp phép mở cổng cảng nhận container.
              </p>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-chalk">
                <button
                  type="button"
                  onClick={() => setShowConfirmDialog(false)}
                  disabled={submitting}
                  className="px-4 py-2 bg-white border border-chalk text-carbon hover:bg-fog rounded-xl text-xs font-bold cursor-pointer"
                >
                  Xem lại
                </button>
                <button
                  type="button"
                  onClick={handleConfirmIssue}
                  disabled={submitting}
                  className="px-5 py-2 bg-signal-orange hover:opacity-90 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <span className={`material-symbols-outlined text-sm ${submitting ? 'animate-spin' : ''}`}>
                    {submitting ? 'sync' : 'check'}
                  </span>
                  <span>{submitting ? 'Đang cấp lệnh...' : 'Xác nhận & Cấp lệnh'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
