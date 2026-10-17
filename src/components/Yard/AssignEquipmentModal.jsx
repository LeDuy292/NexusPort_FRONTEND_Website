import React, { useState, useEffect } from 'react'
import yardTaskService from '../../services/yardTaskService'

export default function AssignEquipmentModal({ task, isOpen, onClose, onSuccess }) {
  const [equipments, setEquipments] = useState([])
  const [operators, setOperators] = useState([])
  const [selectedEquipmentId, setSelectedEquipmentId] = useState('')
  const [selectedOperatorId, setSelectedOperatorId] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [fetchingData, setFetchingData] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [filterBlockOnly, setFilterBlockOnly] = useState(true)

  useEffect(() => {
    if (isOpen && task) {
      setErrorMessage('')
      setNotes('')
      fetchAvailableResources()
    }
  }, [isOpen, task, filterBlockOnly])

  const fetchAvailableResources = async () => {
    setFetchingData(true)
    try {
      const blockParam = filterBlockOnly ? (task.blockCode || 'A01') : ''
      const [eqList, opList] = await Promise.all([
        yardTaskService.getAvailableEquipments(blockParam),
        yardTaskService.getAvailableOperators()
      ])

      setEquipments(eqList)
      setOperators(opList)

      // Auto-select first available equipment if exists
      const availableEq = eqList.find(e => {
        const s = (e.status || '').toLowerCase()
        return s === 'available' || s === 'active' || s === 'ready' || s === 'idle'
      })
      if (availableEq) {
        setSelectedEquipmentId(availableEq.id)
      } else if (eqList.length > 0) {
        setSelectedEquipmentId(eqList[0].id)
      }

      // Auto-select first available operator if exists
      const availableOp = opList.find(o => o.isAvailable)
      if (availableOp) {
        setSelectedOperatorId(availableOp.id)
      } else if (opList.length > 0) {
        setSelectedOperatorId(opList[0].id)
      }
    } catch (err) {
      console.error('Error loading resources:', err)
      setErrorMessage('Không thể tải danh sách thiết bị và cần thủ từ máy chủ.')
    } finally {
      setFetchingData(false)
    }
  }

  if (!isOpen || !task) return null

  const selectedEquipment = equipments.find(e => e.id === selectedEquipmentId)
  const selectedOperator = operators.find(o => o.id === selectedOperatorId)

  // Client-side rule checks for UI indicators
  const isEquipmentBusyOrMaintenance = selectedEquipment && 
    !['available', 'active', 'ready', 'idle'].includes((selectedEquipment.status || '').toLowerCase())

  const isOperatorBusy = selectedOperator && !selectedOperator.isAvailable

  const isZoneMismatch = selectedEquipment && selectedEquipment.blockCode && task.blockCode &&
    selectedEquipment.blockCode.toLowerCase().trim() !== task.blockCode.toLowerCase().trim()

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!selectedEquipmentId) {
      setErrorMessage('Vui lòng chọn Thiết bị Nâng hạ!')
      return
    }
    if (!selectedOperatorId) {
      setErrorMessage('Vui lòng chọn Cần thủ vận hành!')
      return
    }

    setLoading(true)
    setErrorMessage('')

    try {
      const payload = {
        equipmentId: selectedEquipmentId,
        operatorId: selectedOperatorId,
        operatorName: selectedOperator ? selectedOperator.fullName : '',
        notes: notes.trim()
      }

      const res = await yardTaskService.assignEquipment(task.id, payload)
      if (onSuccess) {
        onSuccess(res.data || res)
      }
      onClose()
    } catch (err) {
      console.error('Assignment error:', err)
      const msg = err.response?.data?.message || err.message || 'Lỗi khi gán thiết bị nâng hạ!'
      setErrorMessage(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white max-w-2xl w-full rounded-xl p-6 shadow-xl space-y-4 font-sans border border-slate-200 max-h-[90vh] overflow-y-auto">
        
        {/* Modal Header */}
        <div className="flex justify-between items-start border-b border-slate-100 pb-3.5">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold bg-indigo-50 text-indigo-800 px-2 py-0.5 rounded border border-indigo-200">
                Điều Phối Thiết Bị
              </span>
              <span className="text-xs text-slate-500 font-medium">Chỉ định cẩu & cần thủ</span>
            </div>
            <h3 className="text-base font-bold text-slate-900 mt-1">
              Gán Thiết Bị Nâng Hạ & Cần Thủ
            </h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>

        {/* Task Summary Banner */}
        <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200/80 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div>
            <span className="text-[11px] text-slate-500 block">Mã Nhiệm Vụ</span>
            <strong className="text-slate-900 font-mono font-bold">{task.taskCode || task.id}</strong>
          </div>
          <div>
            <span className="text-[11px] text-slate-500 block">Container</span>
            <strong className="text-slate-900 font-mono font-bold">{task.containerNo || task.containerId}</strong>
          </div>
          <div>
            <span className="text-[11px] text-slate-500 block">Khu Vực Bãi</span>
            <strong className="text-slate-900 font-semibold">Block {task.blockCode || 'A01'}</strong>
          </div>
          <div>
            <span className="text-[11px] text-slate-500 block">Lộ Trình</span>
            <span className="text-slate-700 font-mono font-medium truncate block">
              {task.fromLocation || 'Cầu Bến'} ➔ {task.toLocation || 'A01-05-02-3'}
            </span>
          </div>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2.5 text-red-800 text-xs font-medium">
            <span className="material-symbols-outlined text-red-600 text-sm flex-shrink-0 mt-0.5">error</span>
            <div className="flex-1 leading-relaxed">{errorMessage}</div>
          </div>
        )}

        {/* Form Controls */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          
          {/* Section 1: Equipment Selection */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-slate-700 text-xs font-bold flex items-center gap-1.5">
                <span className="material-symbols-outlined text-slate-500 text-sm">forklift</span>
                1. Chọn Thiết Bị Nâng Hạ (Cẩu RTG / QC) *
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer select-none text-[11px] font-medium text-slate-600">
                <input
                  type="checkbox"
                  checked={filterBlockOnly}
                  onChange={e => setFilterBlockOnly(e.target.checked)}
                  className="rounded text-slate-900 focus:ring-slate-500"
                />
                Chỉ hiện Cẩu tại Block {task.blockCode || 'A01'}
              </label>
            </div>

            {fetchingData ? (
              <div className="py-6 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
                <span className="animate-spin material-symbols-outlined text-base">progress_activity</span>
                Đang tải danh sách thiết bị...
              </div>
            ) : equipments.length === 0 ? (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-xs">
                Không có thiết bị nào sẵn sàng tại Block này. Bỏ chọn bộ lọc để xem toàn bãi.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {equipments.map(eq => {
                  const isAvail = ['available', 'active', 'ready', 'idle'].includes((eq.status || '').toLowerCase())
                  const isSelected = eq.id === selectedEquipmentId
                  const isMismatch = eq.blockCode && task.blockCode && eq.blockCode.toLowerCase() !== task.blockCode.toLowerCase()

                  return (
                    <div
                      key={eq.id}
                      onClick={() => setSelectedEquipmentId(eq.id)}
                      className={`p-3 rounded-lg border cursor-pointer transition-all flex flex-col justify-between gap-1.5 ${
                        isSelected
                          ? 'border-slate-900 bg-slate-50/70 shadow-2xs'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-slate-900 text-xs">{eq.equipmentCode}</span>
                          <span className="px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded text-[9px] font-mono">
                            {eq.equipmentType || 'RTG'}
                          </span>
                        </div>
                        <span className={`px-2 py-0.2 rounded text-[9px] font-medium border ${
                          isAvail
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : (eq.status || '').toLowerCase() === 'maintenance'
                            ? 'bg-amber-50 text-amber-800 border-amber-200'
                            : 'bg-red-50 text-red-700 border-red-200'
                        }`}>
                          {eq.status}
                        </span>
                      </div>

                      <div className="text-[11px] text-slate-600 truncate">
                        {eq.name || eq.description || 'Cẩu bánh lốp RTG'}
                      </div>

                      <div className="flex justify-between items-center text-[10px] text-slate-500 pt-1 border-t border-slate-100">
                        <span>Vị trí: <strong className={isMismatch ? 'text-amber-700 font-semibold' : 'text-slate-700'}>Block {eq.blockCode || 'N/A'}</strong></span>
                        {isSelected && <span className="text-slate-900 font-semibold">✓ Đã chọn</span>}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Rule 1 & Rule 3 Alerts */}
            {isEquipmentBusyOrMaintenance && (
              <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-xs flex items-center gap-2">
                <span>⚠️ Thiết bị:</span> Cẩu <strong>{selectedEquipment.equipmentCode}</strong> hiện đang {selectedEquipment.status}.
              </div>
            )}
            {isZoneMismatch && (
              <div className="p-2.5 bg-slate-100 border border-slate-200 rounded-lg text-slate-700 text-xs flex items-center gap-2">
                <span>ℹ️ Lưu ý:</span> Cẩu đỗ tại <strong>Block {selectedEquipment.blockCode}</strong> khác Block {task.blockCode} của nhiệm vụ.
              </div>
            )}
          </div>

          {/* Section 2: Operator Selection */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <label className="text-slate-700 text-xs font-bold flex items-center gap-1.5">
              <span className="material-symbols-outlined text-slate-500 text-sm">person</span>
              2. Chọn Cần Thủ / Nhân Viên Vận Hành *
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {operators.map(op => {
                const isSelected = op.id === selectedOperatorId
                return (
                  <div
                    key={op.id}
                    onClick={() => setSelectedOperatorId(op.id)}
                    className={`p-3 rounded-lg border cursor-pointer transition-all flex justify-between items-center gap-2 ${
                      isSelected
                        ? 'border-slate-900 bg-slate-50/70 shadow-2xs'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div>
                      <div className="font-semibold text-slate-900 text-xs">{op.fullName}</div>
                      <div className="text-[10px] text-slate-500">@{op.username} · {op.role}</div>
                    </div>

                    <div className="text-right">
                      <span className={`px-2 py-0.2 rounded text-[9px] font-medium border ${
                        op.isAvailable
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-red-50 text-red-700 border-red-200'
                      }`}>
                        {op.isAvailable ? 'Rảnh' : 'Đang bận'}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>

            {isOperatorBusy && (
              <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-xs flex items-center gap-2">
                <span>⚠️ Cần thủ:</span> <strong>{selectedOperator.fullName}</strong> hiện đang xử lý task khác ({selectedOperator.currentTaskCode}).
              </div>
            )}
          </div>

          {/* Section 3: Notes */}
          <div className="space-y-1 pt-2 border-t border-slate-100">
            <label className="text-slate-600 text-xs font-medium block">
              Ghi Chú Điều Phối Hiện Trường (Tùy chọn)
            </label>
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="VD: Ưu tiên đảo cont trước 11:30..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 text-xs focus:outline-none focus:border-slate-500 focus:bg-white"
            />
          </div>

          {/* Footer Buttons */}
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
              disabled={loading || !selectedEquipmentId || !selectedOperatorId}
              className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-lg transition-colors disabled:opacity-50 disabled:pointer-events-none cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
            >
              {loading ? (
                <>
                  <span className="animate-spin material-symbols-outlined text-xs">progress_activity</span>
                  Đang xử lý...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-xs">check</span>
                  Xác Nhận Gán Thiết Bị
                </>
              )}
            </button>
          </div>
        </form>

      </div>
    </div>
  )
}
