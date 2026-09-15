import React, { useState, useEffect } from 'react';
import yardReceivingService from '../../services/yardReceivingService';

export default function YardReceiving() {
  const [activeTab, setActiveTab] = useState('create'); // 'create' | 'history'

  // Form State
  const [containerNo, setContainerNo] = useState('TCNU1234567');
  const [actualSealNo, setActualSealNo] = useState('SEAL-889922');
  const [isSealIntact, setIsSealIntact] = useState(true);
  const [condition, setCondition] = useState('Good'); // 'Good' | 'Damaged' | 'SealBroken'
  const [notes, setNotes] = useState('');
  const [yardBlockCode, setYardBlockCode] = useState('A01');
  const [locationCoordinate, setLocationCoordinate] = useState('A01-05-02-3');
  const [inspectorName, setInspectorName] = useState('Nguyễn Văn Bãi (Yard Officer)');

  // Verification & Submission State
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(null);

  // History State
  const [receipts, setReceipts] = useState([]);
  const [filterBlock, setFilterBlock] = useState('');
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Initial Verification
  useEffect(() => {
    handleVerify();
  }, []);

  // Fetch History on Tab Switch
  useEffect(() => {
    if (activeTab === 'history') {
      fetchHistory();
    }
  }, [activeTab, filterBlock]);

  const handleVerify = async () => {
    if (!containerNo.trim()) return;
    setIsVerifying(true);
    try {
      const res = await yardReceivingService.verifyContainerAndSeal(containerNo, actualSealNo);
      setVerificationResult(res);
    } catch (err) {
      console.error(err);
    } finally {
      setIsVerifying(false);
    }
  };

  const fetchHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const list = await yardReceivingService.getReceipts(filterBlock);
      setReceipts(list);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleSubmitReceipt = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitSuccess(null);
    try {
      const payload = {
        containerNo,
        actualSealNo,
        isSealIntact,
        condition,
        notes,
        yardBlockCode,
        locationCoordinate,
        inspectorName,
      };
      const res = await yardReceivingService.createReceipt(payload);
      setSubmitSuccess(res);
      fetchHistory();
    } catch (err) {
      console.error(err);
      alert('Không thể tạo phiếu nhận bãi. Vui lòng thử lại!');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetForm = () => {
    setContainerNo('TCNU9988776');
    setActualSealNo('SEAL-771144');
    setIsSealIntact(true);
    setCondition('Good');
    setNotes('');
    setSubmitSuccess(null);
    handleVerify();
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 space-y-8 font-sans">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-blue-900/60 via-indigo-900/40 to-slate-900 border border-blue-500/20 p-6 md:p-8 shadow-2xl backdrop-blur-xl">
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-semibold uppercase tracking-wider mb-3">
              <span>✨ Quy Trình Tiếp Nhận & Kiểm Tra Bãi</span>
            </div>
            <h1 className="text-2xl md:text-4xl font-extrabold text-white tracking-tight flex items-center gap-3">
              <span className="text-3xl">🛡️</span> Nhận Container Vào Bãi (Yard Receiving)
            </h1>
            <p className="text-slate-400 text-sm md:text-base mt-1 max-w-2xl">
              Đối soát số hiệu Container ID, kiểm tra Chì Seal thực tế, đánh giá ngoại quan vỏ cont và xác nhận tiếp nhận vào tọa độ bãi lưu giữ.
            </p>
          </div>

          {/* Tab Navigation Switches */}
          <div className="flex bg-slate-900/80 p-1.5 rounded-2xl border border-slate-800 backdrop-blur-md">
            <button
              onClick={() => setActiveTab('create')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 ${
                activeTab === 'create'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/25'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <span>📝</span> Tạo Phiếu Nhận Mới
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 ${
                activeTab === 'history'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/25'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <span>📜</span> Nhật Ký Nhận Bãi
            </button>
          </div>
        </div>
      </div>

      {/* Main Tab Content */}
      {activeTab === 'create' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Input Form & Inspection Options */}
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 md:p-8 backdrop-blur-xl shadow-xl space-y-6">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2.5">
                  <span>📦</span> Khai Báo & Đối Soát Thực Tế
                </h2>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Hiện Trường Bãi
                </span>
              </div>

              {/* Step 1: Search / Enter Container & Seal */}
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                      Số Hiệu Container ID <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={containerNo}
                        onChange={(e) => setContainerNo(e.target.value.toUpperCase())}
                        placeholder="VD: TCNU1234567"
                        className="w-full bg-slate-950/80 border border-slate-700/80 focus:border-blue-500 rounded-2xl px-4 py-3 text-sm text-slate-100 font-mono tracking-wider placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 uppercase transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                      Mã Seal Chì Thực Tế <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={actualSealNo}
                      onChange={(e) => setActualSealNo(e.target.value)}
                      placeholder="VD: SEAL-889922"
                      className="w-full bg-slate-950/80 border border-slate-700/80 focus:border-blue-500 rounded-2xl px-4 py-3 text-sm text-slate-100 font-mono tracking-wider placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleVerify}
                  disabled={isVerifying}
                  className="w-full bg-slate-800 hover:bg-slate-700 text-blue-400 hover:text-blue-300 font-medium py-2.5 px-4 rounded-xl text-sm border border-slate-700/80 flex items-center justify-center gap-2 transition-all"
                >
                  <span>🔍</span> {isVerifying ? 'Đang kiểm tra đối soát...' : 'Kiểm Tra Đối Soát Mã Cont & Seal'}
                </button>
              </div>

              {/* Step 2: Inspection Conditions */}
              <div className="space-y-4 pt-2 border-t border-slate-800/80">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Tình Trạng Vỏ Container Ngoại Quan
                </label>

                <div className="grid grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => { setCondition('Good'); setIsSealIntact(true); }}
                    className={`flex flex-col items-center justify-center p-3.5 rounded-2xl border text-center transition-all ${
                      condition === 'Good'
                        ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400 font-semibold shadow-lg shadow-emerald-500/10'
                        : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <span className="text-lg mb-1">🟢</span>
                    <span className="text-xs">Tốt (Good)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCondition('Damaged')}
                    className={`flex flex-col items-center justify-center p-3.5 rounded-2xl border text-center transition-all ${
                      condition === 'Damaged'
                        ? 'bg-amber-500/10 border-amber-500 text-amber-400 font-semibold shadow-lg shadow-amber-500/10'
                        : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <span className="text-lg mb-1">⚠️</span>
                    <span className="text-xs">Móp Hỏng (Damaged)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => { setCondition('SealBroken'); setIsSealIntact(false); }}
                    className={`flex flex-col items-center justify-center p-3.5 rounded-2xl border text-center transition-all ${
                      condition === 'SealBroken'
                        ? 'bg-rose-500/10 border-rose-500 text-rose-400 font-semibold shadow-lg shadow-rose-500/10'
                        : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <span className="text-lg mb-1">🚨</span>
                    <span className="text-xs">Rách/Mất Seal</span>
                  </button>
                </div>

                <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-950/50 border border-slate-800">
                  <input
                    type="checkbox"
                    id="sealIntact"
                    checked={isSealIntact}
                    onChange={(e) => setIsSealIntact(e.target.checked)}
                    className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="sealIntact" className="text-xs text-slate-300 cursor-pointer">
                    Xác nhận Niêm phong Chì Seal nguyên vẹn (Is Seal Intact)
                  </label>
                </div>
              </div>

              {/* Step 3: Location Assignment */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                    Khu Vực Block Bãi
                  </label>
                  <select
                    value={yardBlockCode}
                    onChange={(e) => setYardBlockCode(e.target.value)}
                    className="w-full bg-slate-950/80 border border-slate-700/80 rounded-2xl px-4 py-3 text-sm text-slate-100 focus:border-blue-500 focus:outline-none"
                  >
                    <option value="A01">Block A01 (Khu Cont Hàng Outbound)</option>
                    <option value="B02">Block B02 (Khu Cont Rỗng Inbound)</option>
                    <option value="C03">Block C03 (Khu Cont Lạnh Reefer)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                    Tọa Độ Lưu Bãi (Block-Bay-Row-Tier)
                  </label>
                  <input
                    type="text"
                    value={locationCoordinate}
                    onChange={(e) => setLocationCoordinate(e.target.value)}
                    className="w-full bg-slate-950/80 border border-slate-700/80 rounded-2xl px-4 py-3 text-sm font-mono text-slate-100 focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Step 4: Notes */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Ghi Chú Kiểm Tra Hiện Trường
                </label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Nhập ghi chú ngoại quan vỏ container hoặc vết trầy xước hỏng hóc nếu có..."
                  className="w-full bg-slate-950/80 border border-slate-700/80 rounded-2xl px-4 py-3 text-sm text-slate-100 placeholder-slate-600 focus:border-blue-500 focus:outline-none"
                />
              </div>

              {/* Submit Button */}
              <button
                type="button"
                onClick={handleSubmitReceipt}
                disabled={isSubmitting}
                className="w-full bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-4 px-6 rounded-2xl shadow-xl shadow-blue-600/25 flex items-center justify-center gap-2.5 transition-all text-base disabled:opacity-50"
              >
                <span>✅</span>
                {isSubmitting ? 'Đang Lưu Ghi Nhận Nhận Bãi...' : 'XÁC NHẬN NHẬN CONTAINER VÀO BÃI'}
              </button>
            </div>
          </div>

          {/* Right Column: Verification Results & Receipt Badge Card */}
          <div className="lg:col-span-5 space-y-6">
            {/* Live Verification Card */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 md:p-8 backdrop-blur-xl shadow-xl space-y-6">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                  <span>🛡️</span> Kết Quả Đối Soát Hệ Thống
                </h3>
                <span className="text-xs text-slate-500 font-mono">Live Audit</span>
              </div>

              {verificationResult ? (
                <div className="space-y-4">
                  {/* Container Verification Item */}
                  <div className={`p-4 rounded-2xl border ${
                    verificationResult.isMatchingContainer
                      ? 'bg-emerald-500/10 border-emerald-500/30'
                      : 'bg-rose-500/10 border-rose-500/30'
                  }`}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-400 uppercase">Mã Container</span>
                      {verificationResult.isMatchingContainer ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-400">
                          ✅ Trùng Khớp 100%
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-400">
                          ⚠️ Không Tìm Thấy
                        </span>
                      )}
                    </div>
                    <div className="text-lg font-mono font-bold text-white mt-1">
                      {verificationResult.containerNo}
                    </div>
                    <div className="text-xs text-slate-400 mt-1 flex items-center gap-3">
                      <span>Loại: <strong className="text-slate-200">{verificationResult.isoType}</strong></span>
                      <span>Trạng thái: <strong className="text-blue-400">{verificationResult.currentStatus}</strong></span>
                    </div>
                  </div>

                  {/* Seal Verification Item */}
                  <div className={`p-4 rounded-2xl border ${
                    verificationResult.isMatchingSeal
                      ? 'bg-emerald-500/10 border-emerald-500/30'
                      : 'bg-amber-500/10 border-amber-500/30'
                  }`}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-400 uppercase">Đối Soát Mã Seal Chì</span>
                      {verificationResult.isMatchingSeal ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-400">
                          ✅ Mã Seal Trùng Khớp
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-400">
                          ⚠️ Khác Khai Báo
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-slate-800/60 text-xs">
                      <div>
                        <span className="text-slate-500 block">Khai báo Booking:</span>
                        <span className="font-mono font-bold text-slate-300">{verificationResult.expectedSealNo}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Thực tế nhận bãi:</span>
                        <span className="font-mono font-bold text-slate-100">{verificationResult.actualSealNo}</span>
                      </div>
                    </div>
                  </div>

                  {/* Assigned Location Badge */}
                  <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-xs space-y-1">
                    <div className="flex items-center gap-2 text-blue-400 font-semibold">
                      📍 Vị Trí Hạ Bãi Chỉ Định
                    </div>
                    <div className="text-base font-mono font-extrabold text-blue-300">
                      {verificationResult.assignedLocation} ({verificationResult.assignedBlock})
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-slate-500 text-sm">
                  Vui lòng bấm nút Kiểm tra để xem dữ liệu đối soát...
                </div>
              )}
            </div>

            {/* Submission Success Confirmation Modal / Card */}
            {submitSuccess && (
              <div className="bg-gradient-to-br from-emerald-950/80 via-slate-900 to-slate-950 border border-emerald-500/40 rounded-3xl p-6 shadow-2xl backdrop-blur-xl space-y-4 animate-fade-in">
                <div className="flex items-center gap-3 text-emerald-400 font-bold text-lg">
                  <span>🎉</span> Đã Lưu Phiếu Nhận Bãi Thành Công!
                </div>
                <div className="space-y-2 text-xs text-slate-300 border-t border-emerald-500/20 pt-3">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Thời gian nhận (ReceivedAt):</span>
                    <strong className="font-mono text-emerald-300">
                      {new Date(submitSuccess.receivedAt).toLocaleTimeString('vi-VN')} {new Date(submitSuccess.receivedAt).toLocaleDateString('vi-VN')}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Cán bộ thực hiện (ReceivedBy):</span>
                    <strong>{submitSuccess.inspectorName}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Tọa độ bãi:</span>
                    <strong className="font-mono text-blue-400">{submitSuccess.locationCoordinate}</strong>
                  </div>
                </div>

                <button
                  onClick={handleResetForm}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 transition-all mt-2"
                >
                  <span>🔄</span> Nhận Container Tiếp Theo
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* History Tab Content */
        <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 md:p-8 backdrop-blur-xl shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2.5">
                <span>📜</span> Nhật Ký Phiếu Nhận Container Vào Bãi
              </h2>
              <p className="text-xs text-slate-400 mt-1">Lịch sử đối soát và nhận container thực tế lưu trong PostgreSQL Database</p>
            </div>

            {/* Filter by Block */}
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-400 whitespace-nowrap">Lọc theo Block:</label>
              <select
                value={filterBlock}
                onChange={(e) => setFilterBlock(e.target.value)}
                className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none"
              >
                <option value="">Tất cả Block</option>
                <option value="A01">Block A01</option>
                <option value="B02">Block B02</option>
                <option value="C03">Block C03</option>
              </select>
            </div>
          </div>

          {isLoadingHistory ? (
            <div className="text-center py-12 text-slate-400 text-sm">Đang tải lịch sử phiếu nhận bãi...</div>
          ) : receipts.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-sm">Chưa có bản ghi phiếu nhận container nào trong hệ thống.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider bg-slate-950/40">
                    <th className="p-3">Mã Cont</th>
                    <th className="p-3">Mã Seal Chì</th>
                    <th className="p-3">Niêm Phong</th>
                    <th className="p-3">Tình Trạng</th>
                    <th className="p-3">Vị Trí Bãi</th>
                    <th className="p-3">Cán Bộ Nhận</th>
                    <th className="p-3">Thời Gian Nhận</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {receipts.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="p-3 font-bold text-white">{item.containerNo}</td>
                      <td className="p-3 text-slate-300">{item.actualSealNo || item.expectedSealNo}</td>
                      <td className="p-3 font-sans">
                        {item.isSealIntact ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-semibold">
                            🟢 Nguyên vẹn
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[10px] font-semibold">
                            🔴 Rách/Hỏng
                          </span>
                        )}
                      </td>
                      <td className="p-3 font-sans">
                        <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px]">
                          {item.condition}
                        </span>
                      </td>
                      <td className="p-3 text-blue-400 font-bold">{item.locationCoordinate}</td>
                      <td className="p-3 text-slate-300 font-sans">{item.inspectorName}</td>
                      <td className="p-3 text-slate-400">
                        {new Date(item.receivedAt).toLocaleTimeString('vi-VN')} {new Date(item.receivedAt).toLocaleDateString('vi-VN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
