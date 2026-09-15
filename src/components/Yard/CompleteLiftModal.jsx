import React, { useState, useEffect } from 'react'
import yardTaskService from '../../services/yardTaskService'

export default function CompleteLiftModal({ task, isOpen, onClose, onSuccess }) {
  const [completedLocation, setCompletedLocation] = useState('')
  const [notes, setNotes] = useState('')
  const [completedBy, setCompletedBy] = useState('Phạm Bãi Hàng')
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    if (isOpen && task) {
      setErrorMessage('')
      setCompletedLocation(task.toLocation || task.completedLocation || 'A01-05-02-3')
      setNotes(`Hạ container an toàn vào vị trí ${task.toLocation || 'A01-05-02-3'}`)
    }
  }, [isOpen, task])

  if (!isOpen || !task) return null

  // Calculate duration if StartTime exists
  let durationText = 'Đang tính...'
  if (task.startTime) {
    const start = new Date(task.startTime)
    const now = new Date()
    const diffSec = Math.max(0, Math.floor((now - start) / 1000))
    const minutes = Math.floor(diffSec / 60)
    const seconds = diffSec % 60
    durationText = `${minutes} phút ${seconds} giây`
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!completedLocation.trim()) {
      setErrorMessage('Vui lòng xác nhận Vị trí hạ bãi / đích đến thực tế!')
      return
    }

    setLoading(true)
    setErrorMessage('')

    try {
      const payload = {
        completedLocation: completedLocation.trim(),
        notes: notes.trim(),
        completedBy: completedBy.trim() || 'Yard Operator'
      }

      const res = await yardTaskService.completeLift(task.id, payload)
      if (onSuccess) {
        onSuccess(res.data || res)
      }
      onClose()
    } catch (err) {
      console.error('Complete lift error:', err)
      const msg = err.response?.data?.message || err.message || 'Lỗi khi xác nhận hoàn thành cẩu!'
      setErrorMessage(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white max-w-lg w-full rounded-xl p-6 shadow-xl space-y-4 font-sans border border-slate-200 max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex justify-between items-start border-b border-slate-100 pb-3.5">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded border border-emerald-200">
                Hoàn Tất Tác Nghiệp
              </span>
              <span className="text-xs text-slate-500 font-medium">Hạ bãi an toàn</span>
            </div>
            <h3 className="text-base font-bold text-slate-900 mt-1">
              Xác Nhận Hoàn Thành Cẩu Container
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
        <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200/80 grid grid-cols-2 gap-3 text-xs">
          <div>
            <span className="text-[11px] text-slate-500 block">Nhiệm Vụ & Cont</span>
            <strong className="text-slate-900 font-mono">{task.taskCode}</strong>
            <div className="text-slate-700 font-mono font-semibold">{task.containerNo}</div>
          </div>
          <div>
            <span className="text-[11px] text-slate-500 block">Thiết Bị & Cần Thủ</span>
            <strong className="text-slate-900 font-mono">{task.equipmentCode || 'RTG-02'}</strong>
            <div className="text-slate-600">{task.operatorName || 'Cần thủ'}</div>
          </div>
          <div>
            <span className="text-[11px] text-slate-500 block">Bắt Đầu Lúc</span>
            <span className="text-slate-700 font-mono">
              {task.startTime ? new Date(task.startTime).toLocaleTimeString() : 'Vừa xong'}
            </span>
          </div>
          <div>
            <span className="text-[11px] text-slate-500 block">Thời Gian Thực Thi</span>
            <span className="text-slate-900 font-semibold">{durationText}</span>
          </div>
        </div>

        {/* State Transition Info */}
        <div className="p-3 bg-slate-100/70 border border-slate-200 rounded-lg text-xs space-y-1 text-slate-700">
          <div className="font-semibold text-slate-800 text-[11px]">Cập nhật trạng thái tự động:</div>
          <div className="text-[11px] flex items-center gap-1.5 text-slate-600">
            <span>• Task: <code className="text-amber-700 font-semibold">In_Progress</code> ➔ <code className="text-emerald-700 font-semibold">Completed</code></span>
          </div>
          <div className="text-[11px] flex items-center gap-1.5 text-slate-600">
            <span>• Cẩu [{task.equipmentCode || 'RTG'}]: <code className="text-red-700 font-semibold">Busy</code> ➔ <code className="text-emerald-700 font-semibold">Available</code></span>
          </div>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2.5 text-red-800 text-xs font-medium">
            <span className="material-symbols-outlined text-red-600 text-sm flex-shrink-0 mt-0.5">error</span>
            <div className="flex-1 leading-relaxed">{errorMessage}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          {/* Target Slot Coordinate */}
          <div className="space-y-1">
            <label className="text-slate-700 font-semibold text-xs flex items-center gap-1.5">
              <span className="material-symbols-outlined text-slate-500 text-sm">location_on</span>
              Vị Trí Hạ Container Thực Tế (Bay-Row-Tier) *
            </label>
            <input
              type="text"
              value={completedLocation}
              onChange={e => setCompletedLocation(e.target.value.toUpperCase())}
              placeholder="VD: A01-05-02-3"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-mono font-bold text-xs uppercase focus:outline-none focus:border-slate-500 focus:bg-white"
            />
          </div>

          {/* Operator Notes */}
          <div className="space-y-1">
            <label className="text-slate-600 text-xs font-medium block">
              Ghi Chú Nhật Ký Cẩu (Tùy chọn)
            </label>
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="VD: Hạ cont an toàn, xếp đúng vị trí tier 2..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 text-xs focus:outline-none focus:border-slate-500 focus:bg-white"
            />
          </div>

          {/* Completed By */}
          <div className="space-y-1">
            <label className="text-slate-600 text-xs font-medium block">
              Người Xác Nhận Hoàn Thành
            </label>
            <input
              type="text"
              value={completedBy}
              onChange={e => setCompletedBy(e.target.value)}
              placeholder="Tên Cần thủ hoặc Yard Staff"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 text-xs focus:outline-none focus:border-slate-500 focus:bg-white"
            />
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
              disabled={loading || !completedLocation.trim()}
              className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-lg transition-colors disabled:opacity-50 disabled:pointer-events-none cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
            >
              {loading ? (
                <>
                  <span className="animate-spin material-symbols-outlined text-xs">progress_activity</span>
                  Đang lưu...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-xs">check</span>
                  Xác Nhận Hoàn Thành Cẩu
                </>
              )}
            </button>
          </div>
        </form>

      </div>
    </div>
  )
}
