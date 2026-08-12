import React, { useState, useMemo } from 'react'
import { gateBookingsData } from '../../data/gateOfficerData'

// Normalize mock bookings data to ensure date is Today (12/08/2026) and status is Approved/Checked-in
const TODAY_APPROVED_BOOKINGS = gateBookingsData
  .map(b => ({
    ...b,
    date: '2026-08-12',
    dateDisplay: 'Hôm Nay (12/08/2026)',
    // Map status for demo to ensure Approved status is prominent
    status: b.status === 'Rejected' || b.status === 'Expired' ? 'Approved' : b.status,
  }))
  .filter(b => b.status === 'Approved' || b.status === 'Checked-in' || b.status === 'Completed')

export default function GateBookings() {
  const [bookings, setBookings] = useState(TODAY_APPROVED_BOOKINGS)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('Approved') // Default to ONLY Approved
  const [gateFilter, setGateFilter] = useState('All')
  const [operationFilter, setOperationFilter] = useState('All')
  const [dateFilter, setDateFilter] = useState('Today') // Default to ONLY Today
  
  const [selectedBooking, setSelectedBooking] = useState(null)
  const [showCheckInModal, setShowCheckInModal] = useState(false)
  const [toastMessage, setToastMessage] = useState('')

  const showToast = (msg) => { setToastMessage(msg); setTimeout(() => setToastMessage(''), 3500) }

  const renderStatusBadge = (status) => {
    const map = {
      'Approved': 'bg-emerald-100 text-emerald-950 border-emerald-400',
      'Checked-in': 'bg-blue-100 text-blue-950 border-blue-400',
      'Completed': 'bg-slate-100 text-slate-900 border-slate-300',
      'Waiting': 'bg-amber-100 text-amber-950 border-amber-400',
    }
    const dot = {
      'Approved': 'bg-emerald-600',
      'Checked-in': 'bg-blue-600',
      'Completed': 'bg-slate-600',
      'Waiting': 'bg-amber-600',
    }
    const labelMap = {
      'Approved': 'ĐÃ PHÊ DUYỆT 🟢',
      'Checked-in': 'ĐÃ CHECK-IN 🔵',
      'Completed': 'ĐÃ HOÀN TẤT ⚪',
      'Waiting': 'CHỜ PHÊ DUYỆT 🟡',
    }

    return (
      <span className={`px-3 py-1 rounded-full border font-black text-[10px] inline-flex items-center gap-1.5 font-mono ${map[status] || 'bg-slate-100 text-slate-800 border-slate-300'}`}>
        <span className={`w-2 h-2 rounded-full ${dot[status] || 'bg-slate-500'}`}></span>
        {labelMap[status] || status}
      </span>
    )
  }

  // Filter logic: STRICTLY filter only Approved bookings in Today (12/08/2026)
  const filtered = useMemo(() => {
    return bookings.filter(b => {
      const q = search.toLowerCase()
      const matchQ = b.id.toLowerCase().includes(q) ||
        b.containerId.toLowerCase().includes(q) ||
        b.vehicleId.toLowerCase().includes(q) ||
        b.driverName.toLowerCase().includes(q) ||
        b.licensePlate.toLowerCase().includes(q)
      
      const matchStatus = statusFilter === 'All'
        ? (b.status === 'Approved' || b.status === 'Checked-in' || b.status === 'Completed')
        : b.status === statusFilter

      const matchGate = gateFilter === 'All' || b.gate === gateFilter
      const matchOp = operationFilter === 'All' || b.operation === operationFilter
      const matchDate = dateFilter === 'Today' ? b.date === '2026-08-12' : true

      return matchQ && matchStatus && matchGate && matchOp && matchDate
    })
  }, [bookings, search, statusFilter, gateFilter, operationFilter, dateFilter])

  // Handle Check-in Action
  const handleCheckIn = () => {
    const nowTime = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    setBookings(prev => prev.map(b => b.id === selectedBooking.id
      ? { ...b, status: 'Checked-in', checkInTime: nowTime }
      : b))
    setSelectedBooking(prev => ({ ...prev, status: 'Checked-in', checkInTime: nowTime }))
    setShowCheckInModal(false)
    showToast(`✅ CHECK-IN THÀNH CÔNG — Xe ${selectedBooking.vehicleId} (${selectedBooking.licensePlate}) đã cho phép vào cổng ${selectedBooking.gate} lúc ${nowTime}!`)
  }

  const checklist = selectedBooking ? [
    { label: 'Gate Booking đã được Dispatcher phê duyệt chính thức', ok: ['Approved', 'Checked-in', 'Completed'].includes(selectedBooking.status) },
    { label: 'Ngày đăng ký cập cổng đúng Hôm Nay (12/08/2026)', ok: true },
    { label: 'Giấy phép lái xe (GPLX) tài xế còn hiệu lực', ok: selectedBooking.licenseStatus === 'Valid' },
    { label: 'Mã Container và niêm phong chì (Seal) trùng khớp', ok: !!selectedBooking.containerId },
    { label: 'Khung giờ hẹn (Time Slot) còn hiệu lực', ok: true },
    { label: 'Luồng cổng kiểm soát sẵn sàng', ok: true },
  ] : []

  const allChecksOk = checklist.every(c => c.ok)

  return (
    <div className="p-6 md:p-8 w-full font-sans flex flex-col gap-6 bg-slate-50 min-h-screen text-slate-900 relative">

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-8 bg-amber-100 text-amber-950 border-2 border-amber-400 px-6 py-3.5 rounded-2xl shadow-2xl text-xs font-black flex items-center gap-3 z-[100] animate-bounce">
          <span className="text-amber-600">●</span>{toastMessage}
        </div>
      )}

      {/* ── HEADER ── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-extrabold bg-emerald-100 text-emerald-950 border border-emerald-300 px-3 py-0.5 rounded-full uppercase">
              CỔNG KIỂM SOÁT (GATE OFFICER)
            </span>
            <span className="text-xs font-mono font-bold text-slate-600">Lịch Hẹn Xe Đã Duyệt Trong Ngày · Cảng Tiên Sa</span>
          </div>
          <h2 className="font-heading text-3xl font-extrabold text-slate-900">Danh Sách Gate Booking Trong Hôm Nay</h2>
          <p className="text-xs text-slate-600 mt-0.5">Chỉ hiển thị các lịch hẹn xe đã được Dispatcher phê duyệt chính thức và đăng ký cập cổng trong ngày Hôm Nay (12/08/2026).</p>
        </div>

        <div className="flex items-center gap-2">
          <div className="px-4 py-2 bg-emerald-50 border-2 border-emerald-400 text-emerald-950 rounded-2xl text-xs font-mono font-black shadow-xs">
            🟢 ĐÃ LỌC: {filtered.length} BOOKING ĐÃ DUYỆT HÔM NAY
          </div>
        </div>
      </div>

      {/* ── FILTERS & SEARCH BAR ── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
        
        {/* Search input */}
        <div className="relative w-full max-w-md">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-base">search</span>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Tra cứu theo Booking ID, Mã xe, Biển số, Container..."
            className="w-full pl-9 pr-4 py-2.5 bg-slate-100 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 font-mono uppercase" />
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap gap-2 text-xs font-extrabold">
          
          {/* Filter Date (Default Today) */}
          <div className="flex items-center bg-slate-100 border border-slate-300 rounded-xl p-1">
            <button onClick={() => setDateFilter('Today')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${dateFilter === 'Today' ? 'bg-emerald-600 text-white font-black shadow-xs' : 'text-slate-700 hover:text-slate-900'}`}>
              [ 📅 Hôm Nay (12/08/2026) ]
            </button>
            <button onClick={() => setDateFilter('All')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${dateFilter === 'All' ? 'bg-slate-900 text-white font-black shadow-xs' : 'text-slate-700 hover:text-slate-900'}`}>
              Tất Cả Ngày
            </button>
          </div>

          {/* Filter Status (Default Approved) */}
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="px-3.5 py-2 bg-slate-100 border border-slate-300 rounded-xl text-slate-900 font-bold focus:outline-none focus:border-slate-900">
            <option value="Approved">Trạng thái: Đã Phê Duyệt (Approved)</option>
            <option value="Checked-in">Trạng thái: Đã Check-in</option>
            <option value="Completed">Trạng thái: Đã Hoàn Tất</option>
            <option value="All">Tất Cả Trạng Thái Đã Duyệt</option>
          </select>

          {/* Filter Gate */}
          <select value={gateFilter} onChange={e => setGateFilter(e.target.value)}
            className="px-3.5 py-2 bg-slate-100 border border-slate-300 rounded-xl text-slate-900 font-bold focus:outline-none focus:border-slate-900">
            <option value="All">Cổng: Tất Cả (Gate A, B)</option>
            <option value="Gate A">Gate A</option>
            <option value="Gate B">Gate B</option>
          </select>

          {/* Filter Operation */}
          <select value={operationFilter} onChange={e => setOperationFilter(e.target.value)}
            className="px-3.5 py-2 bg-slate-100 border border-slate-300 rounded-xl text-slate-900 font-bold focus:outline-none focus:border-slate-900">
            <option value="All">Hình thức: Tất Cả</option>
            <option value="Pickup">Giao Container (Pickup)</option>
            <option value="Delivery">Nhận Container (Delivery)</option>
          </select>

        </div>
      </div>

      {/* ── BOOKINGS TABLE ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold uppercase text-[10px] tracking-wider">
                {['Mã Booking', 'Hãng Vận Tải', 'Mã Xe & Biển Số', 'Tài Xế', 'Mã Container', 'Hình Thức', 'Khung Giờ Hẹn', 'Cổng Phân Phối', 'Trạng Thái', 'Thao Tác'].map(h => (
                  <th key={h} className={`py-3.5 px-4 ${h === 'Thao Tác' ? 'text-right' : ''}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-mono">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan="10" className="py-12 text-center text-slate-500 font-bold text-sm">
                    Không tìm thấy Gate Booking nào đã được phê duyệt trong hôm nay.
                  </td>
                </tr>
              ) : filtered.map(b => (
                <tr key={b.id} className="hover:bg-slate-100/60 transition-colors">
                  <td onClick={() => setSelectedBooking(b)} className="py-3.5 px-4 font-black text-blue-800 cursor-pointer hover:underline">
                    {b.id}
                  </td>
                  <td className="py-3.5 px-4 font-sans font-bold text-slate-900">
                    <div>{b.company}</div>
                    <div className="text-[10px] text-slate-500 font-mono">{b.companyId}</div>
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="font-black text-slate-900">{b.vehicleId}</div>
                    <div className="text-[10px] text-slate-600 font-bold">{b.licensePlate}</div>
                  </td>
                  <td className="py-3.5 px-4 font-sans">
                    <div className="font-bold text-slate-900">{b.driverName}</div>
                    <div className="text-[10px] font-mono text-emerald-700 font-bold">GPLX: {b.licenseNumber} (Hợp Lệ)</div>
                  </td>
                  <td className="py-3.5 px-4 font-extrabold text-slate-900">
                    <div>{b.containerId}</div>
                    <div className="text-[10px] text-slate-600 font-sans">{b.containerType}</div>
                  </td>
                  <td className="py-3.5 px-4 font-sans">
                    <span className={`px-2.5 py-0.5 rounded text-[10px] font-extrabold ${b.operation === 'Pickup' ? 'bg-blue-100 text-blue-900' : 'bg-purple-100 text-purple-900'}`}>
                      {b.operation === 'Pickup' ? 'Lấy Cont (Pickup)' : 'Giao Cont (Delivery)'}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-bold text-purple-900">{b.etaDisplay} (Hôm nay)</td>
                  <td className="py-3.5 px-4 font-extrabold text-slate-800">{b.gate}</td>
                  <td className="py-3.5 px-4 font-sans">{renderStatusBadge(b.status)}</td>
                  <td className="py-3.5 px-4 text-right font-sans">
                    <button onClick={() => setSelectedBooking(b)}
                      className={`px-3 py-1.5 rounded-xl font-extrabold text-xs flex items-center gap-1 ml-auto cursor-pointer border transition-all ${
                        b.status === 'Approved'
                          ? 'bg-emerald-100 hover:bg-emerald-200 text-emerald-950 border-emerald-400'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-900 border-slate-300'
                      }`}>
                      <span className="material-symbols-outlined text-sm">{b.status === 'Approved' ? 'fact_check' : 'visibility'}</span>
                      {b.status === 'Approved' ? 'Đối Soát Check-in' : 'Xem Chi Tiết'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── DETAIL MODAL ── */}
      {selectedBooking && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 md:p-8">
          <div className="bg-white w-full max-w-2xl max-h-[92vh] rounded-3xl p-6 md:p-8 space-y-5 shadow-2xl overflow-y-auto animate-in zoom-in-95 font-sans border-2 border-emerald-400">
            <div className="flex justify-between items-start border-b border-slate-200 pb-4">
              <div>
                <span className="text-[10px] font-extrabold text-orange-600 uppercase block font-mono">CHI TIẾT GATE BOOKING HỢP LỆ TRONG NGÀY</span>
                <h3 className="font-heading text-2xl font-black text-slate-900 font-mono">{selectedBooking.id}</h3>
                <div className="mt-1">{renderStatusBadge(selectedBooking.status)}</div>
              </div>
              <button onClick={() => setSelectedBooking(null)} className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 hover:text-slate-900">
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs font-mono">
              {[
                ['Hãng Vận Tải', selectedBooking.company],
                ['Mã Doanh Nghiệp', selectedBooking.companyId],
                ['Mã Xe Đầu Kéo', selectedBooking.vehicleId],
                ['Biển Số Xe', selectedBooking.licensePlate],
                ['Tên Tài Xế', selectedBooking.driverName],
                ['Bằng Lái Xe (GPLX)', `${selectedBooking.licenseNumber} (Còn Hạn)`],
                ['Mã Container', selectedBooking.containerId],
                ['Loại ISO Container', selectedBooking.containerType],
                ['Loại Hàng Hóa', selectedBooking.cargoType],
                ['Hình Thức Tác Nghiệp', selectedBooking.operation === 'Pickup' ? 'Lấy Container' : 'Giao Container'],
                ['Khung Giờ Hẹn (Time Slot)', `${selectedBooking.etaDisplay} - Hôm nay (12/08/2026)`],
                ['Cổng Phân Bổ', selectedBooking.gate],
                ['Người Phê Duyệt', selectedBooking.approvedBy || 'Dispatcher - Nguyễn Văn Q'],
                ['Số Niêm Phong (Seal)', selectedBooking.sealNumber || 'SL-928371'],
                ['Thời Gian Check-in', selectedBooking.checkInTime || '—'],
              ].map(([k, v]) => (
                <div key={k} className="bg-slate-100 p-3 rounded-xl border border-slate-200">
                  <div className="text-[10px] text-slate-600 uppercase font-sans font-bold mb-0.5">{k}</div>
                  <div className="font-extrabold text-slate-900">{v}</div>
                </div>
              ))}
            </div>

            {/* Checklist */}
            <div className="p-4 rounded-2xl border-2 bg-emerald-50 border-emerald-400 space-y-2">
              <span className="text-[10px] font-black text-emerald-950 uppercase block tracking-wider font-mono">DANH MỤC ĐỐI SOÁT ĐIỀU KIỆN QUA CỔNG:</span>
              {checklist.map(c => (
                <div key={c.label} className="flex items-center gap-2 text-xs">
                  <span className="font-black text-emerald-600">✓</span>
                  <span className="text-emerald-950 font-bold">{c.label}</span>
                </div>
              ))}
              <div className="text-center font-black text-sm py-2 rounded-xl bg-emerald-200 text-emerald-950 border border-emerald-400 mt-2">
                🟢 ĐỦ ĐIỀU KIỆN CHO XE CHECK-IN VÀO CỔNG
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setSelectedBooking(null)} className="flex-1 h-11 border border-slate-300 text-slate-700 rounded-xl font-bold text-xs hover:bg-slate-100">
                Đóng
              </button>
              {selectedBooking.status === 'Approved' && (
                <button onClick={() => setShowCheckInModal(true)} disabled={!allChecksOk}
                  className="flex-1 h-11 bg-emerald-100 hover:bg-emerald-200 text-emerald-950 border-2 border-emerald-400 font-black text-sm rounded-xl shadow-xs cursor-pointer">
                  [ ✓ XÁC NHẬN CHECK-IN ]
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Check-in Confirm Modal */}
      {showCheckInModal && selectedBooking && (
        <div className="fixed inset-0 bg-slate-900/80 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full space-y-4 shadow-2xl text-center animate-in zoom-in-95 font-sans border-2 border-emerald-400">
            <span className="material-symbols-outlined text-5xl text-emerald-600">login</span>
            <h3 className="font-heading text-xl font-black text-slate-900">Xác Nhận Cho Xe Check-in?</h3>
            <p className="text-xs text-slate-600 font-medium">Xe {selectedBooking.vehicleId} ({selectedBooking.licensePlate}) đã đủ điều kiện hợp lệ để vào {selectedBooking.gate}.</p>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowCheckInModal(false)} className="flex-1 h-11 border border-slate-300 text-slate-700 rounded-xl font-bold text-xs hover:bg-slate-100">Hủy</button>
              <button onClick={handleCheckIn} className="flex-1 h-11 bg-emerald-100 hover:bg-emerald-200 text-emerald-950 border-2 border-emerald-400 rounded-xl font-black text-xs shadow-xs">Cho Vào Cổng</button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
