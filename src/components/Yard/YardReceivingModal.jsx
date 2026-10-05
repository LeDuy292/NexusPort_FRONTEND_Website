import React, { useState, useEffect } from 'react'
import yardTaskService from '../../services/yardTaskService'

export default function YardReceivingModal({ task, isOpen, onClose, onSuccess, allTasks = [] }) {
  const [selectedTask, setSelectedTask] = useState(task || null)
  const [containerInput, setContainerInput] = useState('')
  const [actualSealNo, setActualSealNo] = useState('')
  const [isSealIntact, setIsSealIntact] = useState(true)
  const [condition, setCondition] = useState('Good') // Good, Damaged, Seal_Broken
  const [notes, setNotes] = useState('')
  const [inspectorName, setInspectorName] = useState('Phạm Bãi Hàng')
  const [yardBlockCode, setYardBlockCode] = useState('')
  const [locationCoordinate, setLocationCoordinate] = useState('')
  const [isScanning, setIsScanning] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  useEffect(() => {
    if (isOpen) {
      setErrorMessage('')
      setSuccessMessage('')
      if (task) {
        setSelectedTask(task)
        setContainerInput(task.containerNo || '')
        setActualSealNo(task.actualSealNo || task.expectedSealNo || 'SEAL-VN-8831')
        setIsSealIntact(task.condition !== 'Seal_Broken')
        setCondition(task.condition || 'Good')
        setNotes(task.notes || '')
        setYardBlockCode(task.blockCode || 'A01')
        setLocationCoordinate(task.toLocation || 'A01-05-02-3')
      } else if (allTasks && allTasks.length > 0) {
        const first = allTasks[0]
        setSelectedTask(first)
        setContainerInput(first.containerNo || '')
        setActualSealNo(first.actualSealNo || first.expectedSealNo || 'SEAL-VN-8831')
        setYardBlockCode(first.blockCode || 'A01')
        setLocationCoordinate(first.toLocation || 'A01-05-02-3')
      }
    }
  }, [isOpen, task, allTasks])

  // Handle changing container selection
  const handleContainerSelect = (contNo) => {
    setContainerInput(contNo)
    const found = allTasks.find(t => t.containerNo?.toLowerCase() === contNo.toLowerCase())
    if (found) {
      setSelectedTask(found)
      setYardBlockCode(found.blockCode || 'A01')
      setLocationCoordinate(found.toLocation || 'A01-05-02-3')
      if (found.expectedSealNo) {
        setActualSealNo(found.expectedSealNo)
      }
    }
  }

  // Simulate scanning QR / Barcode
  const handleSimulateScan = () => {
    setIsScanning(true)
    setTimeout(() => {
      setIsScanning(false)
      if (allTasks && allTasks.length > 0) {
        const uninspected = allTasks.find(t => !t.receivedAt) || allTasks[0]
        handleContainerSelect(uninspected.containerNo)
        setSuccessMessage(`Đã quét QR thành công: ${uninspected.containerNo}`)
      } else {
        handleContainerSelect('TEMU4451920')
      }
    }, 800)
  }

  if (!isOpen) return null

  const expectedSeal = selectedTask?.expectedSealNo || 'SEAL-VN-8831'
  const isSealMatched = actualSealNo.trim() !== '' && 
    (expectedSeal.trim().toLowerCase() === actualSealNo.trim().toLowerCase())

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!containerInput.trim()) {
      setErrorMessage('Vui lòng nhập hoặc chọn Container ID!')
      return
    }
    if (!actualSealNo.trim()) {
      setErrorMessage('Vui lòng nhập Mã Seal đối soát thực tế!')
      return
    }

    setLoading(true)
    setErrorMessage('')
    setSuccessMessage('')

    const isGuid = (val) => typeof val === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val)
    const validTaskId = isGuid(selectedTask?.id) ? selectedTask.id : null

    try {
      const payload = {
        taskId: validTaskId,
        containerNo: containerInput.trim().toUpperCase(),
        actualSealNo: actualSealNo.trim().toUpperCase(),
        expectedSealNo: expectedSeal,
        isSealIntact: isSealIntact && condition !== 'Seal_Broken',
        condition: condition,
        notes: notes.trim(),
        inspectorName: inspectorName.trim() || 'Yard Staff',
        yardBlockCode: yardBlockCode.trim() || selectedTask?.blockCode || 'A01',
        locationCoordinate: locationCoordinate.trim() || selectedTask?.toLocation || 'A01-05-02-3'
      }

      const res = await yardTaskService.receiveContainer(payload)
      setSuccessMessage('Xác nhận nhận Container & Đối soát thành công!')
      
      setTimeout(() => {
        if (onSuccess) {
          onSuccess(res.data || res)
        }
        onClose()
      }, 600)
    } catch (err) {
      console.error('Receiving error:', err)
      const msg = err.response?.data?.message || err.message || 'Lỗi khi đối soát tiếp nhận Container!'
      setErrorMessage(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white max-w-2xl w-full rounded-xl p-6 shadow-xl space-y-4 font-sans border border-slate-200 max-h-[92vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex justify-between items-start border-b border-slate-100 pb-3.5">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold bg-blue-50 text-blue-800 px-2 py-0.5 rounded border border-blue-200">
                Tiếp Nhận Container
              </span>
              <span className="text-xs text-slate-500 font-medium">Đối soát bãi</span>
            </div>
            <h3 className="text-base font-bold text-slate-900 mt-1">
              Tiếp Nhận & Kiểm Tra Container Tại Bãi
            </h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>

        {/* Workflow Info */}
        <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/80 text-xs text-slate-600 flex items-center gap-2.5">
          <span className="material-symbols-outlined text-slate-500 text-base flex-shrink-0">local_shipping</span>
          <div>
            Đối soát Container & Seal Gate-in khi xe tới bãi. Ghi nhận tình trạng ngoại quan vào hệ thống bãi (<code className="font-mono bg-slate-200/70 px-1 py-0.5 rounded text-slate-800">In_Yard</code>).
          </div>
        </div>

        {/* Alerts */}
        {errorMessage && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2.5 text-red-800 text-xs font-medium">
            <span className="material-symbols-outlined text-red-600 text-sm flex-shrink-0 mt-0.5">error</span>
            <div className="flex-1 leading-relaxed">{errorMessage}</div>
          </div>
        )}

        {successMessage && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2.5 text-emerald-800 text-xs font-medium">
            <span className="material-symbols-outlined text-emerald-600 text-sm flex-shrink-0">check_circle</span>
            <div className="flex-1">{successMessage}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          
          {/* Step 1: Scan / Select Container */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-slate-700 text-xs font-bold flex items-center gap-1.5">
                <span className="material-symbols-outlined text-slate-500 text-sm">inventory_2</span>
                1. Container ID (Quét mã / Chọn nhanh) *
              </label>
              <button
                type="button"
                onClick={handleSimulateScan}
                disabled={isScanning}
                className="px-2.5 py-1 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded-md text-[11px] font-medium flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
              >
                {isScanning ? (
                  <>
                    <span className="animate-spin material-symbols-outlined text-xs">progress_activity</span>
                    Đang quét...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-xs text-slate-500">photo_camera</span>
                    Quét Mã QR
                  </>
                )}
              </button>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={containerInput}
                onChange={e => handleContainerSelect(e.target.value.toUpperCase())}
                placeholder="VD: TEMU4451920, MSCU9901123..."
                className="flex-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-mono font-bold text-xs uppercase focus:outline-none focus:border-slate-500 focus:bg-white"
              />
              {allTasks && allTasks.length > 0 && (
                <select
                  value={containerInput}
                  onChange={e => handleContainerSelect(e.target.value)}
                  className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-700 font-mono text-xs focus:outline-none focus:border-slate-500"
                >
                  <option value="">-- Chọn danh sách nhiệm vụ --</option>
                  {allTasks.map(t => (
                    <option key={t.id} value={t.containerNo}>
                      {t.containerNo} ({t.taskCode} - {t.blockCode})
                    </option>
                  ))}
                </select>
              )}
            </div>

            {selectedTask && (
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200/80 grid grid-cols-3 gap-2 text-[11px]">
                <div>
                  <span className="text-slate-500 block text-[10px]">Mã Task:</span>
                  <strong className="text-slate-900 font-mono">{selectedTask.taskCode}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Loại Cont:</span>
                  <strong className="text-slate-900 font-mono">{selectedTask.containerType || '40FT HC'}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Xe / Tài xế:</span>
                  <strong className="text-slate-800">{selectedTask.vehiclePlate || 'N/A'}</strong>
                </div>
              </div>
            )}
          </div>

          {/* Step 2: Seal Reconciliation */}
          <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200/80 space-y-3">
            <div className="flex justify-between items-center">
              <label className="text-slate-800 text-xs font-bold flex items-center gap-1.5">
                <span className="material-symbols-outlined text-slate-500 text-sm">lock</span>
                2. Đối Soát Niêm Phong (Seal Check)
              </label>

              <span className={`px-2 py-0.2 rounded text-[10px] font-medium border flex items-center gap-1 ${
                isSealMatched
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-amber-50 text-amber-800 border-amber-200'
              }`}>
                <span className="material-symbols-outlined text-xs">
                  {isSealMatched ? 'verified' : 'warning'}
                </span>
                {isSealMatched ? 'Seal Trùng Khớp' : 'Lệch Mã Seal'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <span className="text-[11px] text-slate-500 block mb-1">
                  Mã Seal Khai Báo (Gate-in):
                </span>
                <input
                  type="text"
                  disabled
                  value={expectedSeal}
                  className="w-full px-3 py-1.5 bg-slate-200/60 border border-slate-300 rounded-lg font-mono text-slate-600 text-xs cursor-not-allowed"
                />
              </div>

              <div>
                <span className="text-[11px] text-slate-700 font-medium block mb-1">
                  Mã Seal Thực Tế Trên Cont: *
                </span>
                <input
                  type="text"
                  value={actualSealNo}
                  onChange={e => setActualSealNo(e.target.value.toUpperCase())}
                  placeholder="Nhập mã seal trên chốt chì..."
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-mono font-bold text-slate-900 text-xs uppercase focus:outline-none focus:border-slate-500"
                />
              </div>
            </div>

            <div className="pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-slate-700">
                <input
                  type="checkbox"
                  checked={isSealIntact}
                  onChange={e => setIsSealIntact(e.target.checked)}
                  className="w-3.5 h-3.5 rounded text-slate-900 focus:ring-slate-500"
                />
                Chốt chì còn nguyên vẹn, không biến dạng hay có dấu hiệu cạy phá
              </label>
            </div>
          </div>

          {/* Step 3: Visual Condition */}
          <div className="space-y-1.5">
            <label className="text-slate-700 text-xs font-bold flex items-center gap-1.5">
              <span className="material-symbols-outlined text-slate-500 text-sm">visibility</span>
              3. Đánh Giá Ngoại Quan Vỏ Container *
            </label>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setCondition('Good')}
                className={`p-2.5 rounded-lg border text-center transition-all cursor-pointer flex flex-col items-center gap-1 ${
                  condition === 'Good'
                    ? 'border-slate-900 bg-slate-50 text-slate-900 font-semibold'
                    : 'border-slate-200 hover:border-slate-300 bg-white text-slate-600'
                }`}
              >
                <span className="text-xs">Tốt (Good)</span>
                <span className="text-[10px] text-slate-400">Nguyên vẹn</span>
              </button>

              <button
                type="button"
                onClick={() => setCondition('Damaged')}
                className={`p-2.5 rounded-lg border text-center transition-all cursor-pointer flex flex-col items-center gap-1 ${
                  condition === 'Damaged'
                    ? 'border-slate-900 bg-slate-50 text-slate-900 font-semibold'
                    : 'border-slate-200 hover:border-slate-300 bg-white text-slate-600'
                }`}
              >
                <span className="text-xs">Hư hỏng (Damaged)</span>
                <span className="text-[10px] text-slate-400">Móp méo / rách vách</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setCondition('Seal_Broken')
                  setIsSealIntact(false)
                }}
                className={`p-2.5 rounded-lg border text-center transition-all cursor-pointer flex flex-col items-center gap-1 ${
                  condition === 'Seal_Broken'
                    ? 'border-slate-900 bg-slate-50 text-slate-900 font-semibold'
                    : 'border-slate-200 hover:border-slate-300 bg-white text-slate-600'
                }`}
              >
                <span className="text-xs">Mất Chì (Seal Broken)</span>
                <span className="text-[10px] text-slate-400">Chì bị đứt / mất</span>
              </button>
            </div>
          </div>

          {/* Step 4: Block & Coordinates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
            <div>
              <label className="text-slate-600 text-xs font-medium block mb-1">
                Khu Vực Bãi (Block)
              </label>
              <input
                type="text"
                value={yardBlockCode}
                onChange={e => setYardBlockCode(e.target.value.toUpperCase())}
                placeholder="VD: A01, B02"
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg font-mono font-bold text-slate-900 text-xs uppercase focus:outline-none focus:border-slate-500 focus:bg-white"
              />
            </div>

            <div>
              <label className="text-slate-600 text-xs font-medium block mb-1">
                Tọa Độ Vị Trí Hạ (Bay-Row-Tier)
              </label>
              <input
                type="text"
                value={locationCoordinate}
                onChange={e => setLocationCoordinate(e.target.value.toUpperCase())}
                placeholder="VD: A01-05-02-3"
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg font-mono font-bold text-slate-900 text-xs uppercase focus:outline-none focus:border-slate-500 focus:bg-white"
              />
            </div>
          </div>

          {/* Step 5: Notes & Inspector */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="text-slate-600 text-xs font-medium block mb-1">
                Ghi Chú Kiểm Soát
              </label>
              <input
                type="text"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Ghi chú chi tiết vỏ cont, nhiệt độ..."
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 text-xs focus:outline-none focus:border-slate-500 focus:bg-white"
              />
            </div>

            <div>
              <label className="text-slate-600 text-xs font-medium block mb-1">
                Người Thực Hiện
              </label>
              <input
                type="text"
                value={inspectorName}
                onChange={e => setInspectorName(e.target.value)}
                placeholder="Tên nhân viên"
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 text-xs focus:outline-none focus:border-slate-500 focus:bg-white"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 font-semibold text-xs rounded-lg transition-colors cursor-pointer"
            >
              Hủy
            </button>

            <button
              type="submit"
              disabled={loading || !containerInput.trim() || !actualSealNo.trim()}
              className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-lg transition-colors disabled:opacity-50 disabled:pointer-events-none cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
            >
              {loading ? (
                <>
                  <span className="animate-spin material-symbols-outlined text-xs">progress_activity</span>
                  Đang lưu đối soát...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-xs">check</span>
                  Xác Nhận Nhận Container
                </>
              )}
            </button>
          </div>

        </form>

      </div>
    </div>
  )
}
