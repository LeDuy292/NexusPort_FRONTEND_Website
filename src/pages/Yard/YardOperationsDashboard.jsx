import React, { useState, useEffect } from 'react'

export default function YardOperationsDashboard() {
  const [toastMessage, setToastMessage] = useState('')
  const [timeString, setTimeString] = useState('')
  const [activeShift] = useState('Ca 1 (06:00 – 14:00)')

  // Top KPI Stats
  const [kpiStats] = useState({
    inYard: '4,820 TEU',
    waitingPosition: '14 TEU',
    pendingMovements: '8 Lệnh',
    readyGateOut: '32 TEU',
    openIncidents: '2 Sự Cố 🔴',
  })

  // Incoming Containers List
  const [incomingContainers, setIncomingContainers] = useState([
    {
      id: 'MSCU1234567',
      vessel: 'EVER GIVEN',
      berth: 'B-01',
      type: '40FT HC',
      weight: '28,500 KG',
      seal: 'SEAL-88921',
      status: 'UNLOADED',
      statusBadge: 'ĐÃ DỠ TÀU 🟢',
      suggestedPosition: 'A-03-12-2',
    },
    {
      id: 'CMAU9918234',
      vessel: 'EVER GIVEN',
      berth: 'B-01',
      type: '20FT ST',
      weight: '14,200 KG',
      seal: 'SEAL-99102',
      status: 'UNLOADED',
      statusBadge: 'ĐÃ DỠ TÀU 🟢',
      suggestedPosition: 'B-01-08-1',
    },
    {
      id: 'TEMU4451920',
      vessel: 'MSC GULSUN',
      berth: 'B-02',
      type: '40FT RF',
      weight: '31,000 KG',
      seal: 'SEAL-44819',
      status: 'IN TRANSIT',
      statusBadge: 'ĐANG VẬN CHUYỂN 🟡',
      suggestedPosition: 'REEFER-02-04',
    },
  ])

  // Positioning Tasks
  const [positioningTasks, setPositioningTasks] = useState([
    {
      id: 'COSU8819201',
      type: '40FT HC',
      weight: '26,800 KG',
      cargoType: 'Xuất Khẩu Khô',
      departure: '22:00 - 12/08/2026',
      aiSuggestedPos: 'Bãi A - Dãy 03 - Tầng 2 (A-03-12-2)',
      reasoning: 'Tối ưu khoảng cách tới Cẩu bờ QC-01 & phân tải tầng 2 bãi A',
    },
    {
      id: 'EVER1129983',
      type: '20FT ST',
      weight: '12,500 KG',
      cargoType: 'Hàng Nguy Hiểm (Hóa Chất Loại 3)',
      departure: '04:00 - 13/08/2026',
      aiSuggestedPos: 'Bãi Nguy Hiểm - Dãy 01 - Tầng 1 (DG-01-02-1)',
      reasoning: 'Bãi cách ly an toàn hóa chất nguy hiểm, trang bị cảm biến nhiệt',
    },
  ])

  // Pending Yard Tasks List
  const [yardTasks, setYardTasks] = useState([
    {
      id: 'TASK-Y-101',
      taskType: 'Đảo chuyển container trong bãi',
      priority: 'HIGH',
      priorityBadge: '🟠 CAO',
      containerId: 'HLBU7781920',
      from: 'A-02-04-1',
      to: 'A-05-10-3',
      status: 'IN PROGRESS',
      dueTime: '11:30 (Trong 25 phút)',
    },
    {
      id: 'TASK-Y-102',
      taskType: 'Chuẩn bị xuất cổng container',
      priority: 'CRITICAL',
      priorityBadge: '🔴 RẤT NGHIÊM TRỌNG',
      containerId: 'MSCU9901123',
      from: 'B-04-02-1',
      to: 'KHU-VỰC-XUẤT-CỔNG-01',
      status: 'PENDING',
      dueTime: '11:15 (Khẩn cấp)',
    },
    {
      id: 'TASK-Y-103',
      taskType: 'Gỡ xung đột xếp tầng container',
      priority: 'MEDIUM',
      priorityBadge: '🟡 TRUNG BÌNH',
      containerId: 'CMAU3381920',
      from: 'A-01-01-3',
      to: 'A-01-05-1',
      status: 'PENDING',
      dueTime: '12:00',
    },
    {
      id: 'TASK-Y-104',
      taskType: 'Kiểm kê tồn bãi Khu B',
      priority: 'LOW',
      priorityBadge: '🟢 THẤP',
      containerId: 'K-LINE-ZONE-B',
      from: 'Khu B Dãy 1-4',
      to: 'Nhật Ký Hệ Thống',
      status: 'PENDING',
      dueTime: '14:00 (Cuối ca)',
    },
  ])

  // Modals
  const [selectedReceiveContainer, setSelectedReceiveContainer] = useState(null)
  const [inspectionForm, setInspectionForm] = useState({
    condition: 'Tốt (Không Hư Hỏng)',
    notes: '',
    photoFiles: ['Anh_Chup_Niem_Phong_Chì.jpg', 'Anh_Chup_Khung_Vo.jpg'],
  })

  const [selectedAiTask, setSelectedAiTask] = useState(null)

  // Real-time clock ticker
  useEffect(() => {
    const updateTime = () => {
      const now = new Date()
      setTimeString(now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' - ' + now.toLocaleDateString('vi-VN'))
    }
    updateTime()
    const timer = setInterval(updateTime, 1000)
    return () => clearInterval(timer)
  }, [])

  const showToast = (msg) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(''), 3500)
  }

  // Handle Receive Container
  const handleOpenReceiveModal = (container) => {
    setSelectedReceiveContainer(container)
    setInspectionForm({
      condition: 'Tốt (Không Hư Hỏng)',
      notes: '',
      photoFiles: ['Anh_Chup_Niem_Phong_Chì.jpg', 'Anh_Chup_Khung_Vo.jpg'],
    })
  }

  const handleConfirmReceivingSubmit = (e) => {
    e.preventDefault()
    if (!selectedReceiveContainer) return

    setIncomingContainers(prev => prev.filter(c => c.id !== selectedReceiveContainer.id))
    showToast(`✅ ĐÃ TIẾP NHẬN CONTAINER ${selectedReceiveContainer.id} VÀO BÃI! Đã định vị tại ô ${selectedReceiveContainer.suggestedPosition}.`)
    setSelectedReceiveContainer(null)
  }

  const handleQuickAction = (actionName) => {
    showToast(`⚡ KÍCH HOẠT THAO TÁC NHANH: "${actionName}" — Hệ thống đang mở giao diện thực địa!`)
  }

  return (
    <div className="p-6 md:p-8 w-full font-sans flex flex-col gap-6 bg-slate-50 min-h-screen text-slate-900 relative">

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-8 bg-amber-100 text-amber-950 border-2 border-amber-400 px-6 py-3.5 rounded-2xl shadow-2xl text-xs font-black flex items-center gap-3 z-[100] animate-bounce">
          <span className="text-amber-600">●</span>{toastMessage}
        </div>
      )}

      {/* ── 1. HEADER ── */}
      <div className="bg-white border-2 border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1 text-xs font-mono">
            <span className="font-heading font-black text-orange-600 tracking-wider">NEXUSPORT</span>
            <span className="text-slate-300">/</span>
            <span className="text-slate-600 font-bold">Khai Thác Bãi</span>
            <span className="text-slate-300">/</span>
            <span className="text-slate-900 font-extrabold">Bảng Điều Hành Khai Thác Bãi</span>
          </div>

          <div className="flex items-center gap-3">
            <h2 className="font-heading text-3xl font-black text-slate-900">Bảng Điều Hành Khai Thác Bãi</h2>
            <span className="px-3.5 py-1 bg-orange-100 text-orange-950 border-2 border-orange-400 font-mono font-black text-xs rounded-xl">
              VAI TRÒ: NHÂN VIÊN BÃI
            </span>
          </div>
          <p className="text-xs text-slate-600 mt-0.5">Màn hình tiếp nhận container từ tàu, định vị trí bãi bằng AI và quản lý công việc tại hiện trường.</p>
        </div>

        {/* Right Widgets */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="px-3.5 py-2 bg-blue-100 text-blue-950 border border-blue-300 rounded-xl text-xs font-mono font-bold">
            CA LÀM VIỆC: <strong className="font-black text-blue-900">{activeShift}</strong>
          </div>

          <div className="flex items-center gap-2 bg-slate-100 border border-slate-300 px-3.5 py-2 rounded-xl text-xs font-mono font-bold text-slate-700">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-emerald-700 uppercase font-sans font-black">TRỰC TUYẾN (LIVE)</span>
            <span className="text-slate-300">|</span>
            <span>{timeString}</span>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={() => showToast('🔔 Thông báo: 4 Container vừa được dỡ từ tàu EVER GIVEN đang chuyển tới Block A.')}
              className="w-10 h-10 bg-white border border-slate-300 rounded-xl flex items-center justify-center text-slate-700 hover:bg-slate-100 shadow-xs relative cursor-pointer">
              <span className="material-symbols-outlined text-lg">notifications</span>
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-orange-500"></span>
            </button>
            
            <div className="flex items-center gap-2 bg-slate-100 text-slate-900 px-3.5 py-1.5 rounded-xl border border-slate-300 shadow-xs text-xs font-extrabold">
              <span className="material-symbols-outlined text-base text-orange-600">person</span>
              <div>
                <div className="text-[11px] font-black leading-tight text-slate-900">Nguyễn Văn Nam</div>
                <div className="text-[9px] text-slate-600 font-mono font-bold">Nhân Viên Bãi · Bãi A</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── 2. TOP KPI CARDS (5 THẺ STATS) ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        
        <div className="bg-white p-4 rounded-2xl border-2 border-slate-200 shadow-sm space-y-1">
          <span className="text-[10px] text-slate-500 uppercase font-sans font-extrabold block">Container Trong Bãi</span>
          <strong className="text-2xl text-slate-900 font-black font-mono block">{kpiStats.inYard}</strong>
          <span className="text-[10px] text-emerald-700 font-bold font-sans">Dung lượng bãi: 74%</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border-2 border-amber-300 shadow-sm space-y-1">
          <span className="text-[10px] text-amber-800 uppercase font-sans font-extrabold block">Chờ Gán Vị Trí</span>
          <strong className="text-2xl text-amber-950 font-black font-mono block">{kpiStats.waitingPosition}</strong>
          <span className="text-[10px] text-amber-900 font-bold font-sans">Chờ AI gợi ý ô bãi</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border-2 border-blue-300 shadow-sm space-y-1">
          <span className="text-[10px] text-blue-800 uppercase font-sans font-extrabold block">Lệnh Đảo Chuyển Tồn Đọng</span>
          <strong className="text-2xl text-blue-950 font-black font-mono block">{kpiStats.pendingMovements}</strong>
          <span className="text-[10px] text-blue-900 font-bold font-sans">Nhiệm vụ chưa hoàn thành</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border-2 border-emerald-300 shadow-sm space-y-1">
          <span className="text-[10px] text-emerald-800 uppercase font-sans font-extrabold block">Sẵn Sàng Xuất Cổng</span>
          <strong className="text-2xl text-emerald-950 font-black font-mono block">{kpiStats.readyGateOut}</strong>
          <span className="text-[10px] text-emerald-900 font-bold font-sans">Đã hạ sẵn bãi xuất</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border-2 border-red-300 shadow-sm space-y-1 col-span-2 sm:col-span-1">
          <span className="text-[10px] text-red-800 uppercase font-sans font-extrabold block">Sự Cố Cần Xử Lý</span>
          <strong className="text-2xl text-red-950 font-black font-mono block">{kpiStats.openIncidents}</strong>
          <span className="text-[10px] text-red-900 font-bold font-sans">Cần xử lý tại hiện trường</span>
        </div>

      </div>

      {/* ── 3. THAO TÁC NHANH TẠI HIỆN TRƯỜNG ── */}
      <div className="bg-white rounded-2xl border-2 border-slate-200 p-5 shadow-sm space-y-3">
        <div className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2 font-mono">
          <span className="material-symbols-outlined text-orange-600">touch_app</span>
          THAO TÁC NHANH TẠI HIỆN TRƯỜNG (TABLET)
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <button onClick={() => handleQuickAction('QUÉT CONTAINER')}
            className="h-13 bg-orange-100 hover:bg-orange-200 text-orange-950 border-2 border-orange-400 rounded-xl font-black text-xs flex items-center justify-center gap-2 shadow-xs cursor-pointer transition-all">
            <span className="material-symbols-outlined text-lg">qr_code_scanner</span>
            [ 🔍 QUÉT CONTAINER ]
          </button>

          <button onClick={() => handleQuickAction('XEM SƠ ĐỒ BÃI 2D')}
            className="h-13 bg-blue-100 hover:bg-blue-200 text-blue-950 border-2 border-blue-400 rounded-xl font-black text-xs flex items-center justify-center gap-2 shadow-xs cursor-pointer transition-all">
            <span className="material-symbols-outlined text-lg">map</span>
            [ 🗺️ SƠ ĐỒ BÃI 2D ]
          </button>

          <button onClick={() => handleQuickAction('LỆNH ĐẢO CHUYỂN')}
            className="h-13 bg-purple-100 hover:bg-purple-200 text-purple-950 border-2 border-purple-400 rounded-xl font-black text-xs flex items-center justify-center gap-2 shadow-xs cursor-pointer transition-all">
            <span className="material-symbols-outlined text-lg">swap_horiz</span>
            [ 🔄 LỆNH ĐẢO CHUYỂN ]
          </button>

          <button onClick={() => handleQuickAction('KIỂM KÊ TỒN BÃI')}
            className="h-13 bg-emerald-100 hover:bg-emerald-200 text-emerald-950 border-2 border-emerald-400 rounded-xl font-black text-xs flex items-center justify-center gap-2 shadow-xs cursor-pointer transition-all">
            <span className="material-symbols-outlined text-lg">inventory_2</span>
            [ 📋 KIỂM KÊ TỒN BÃI ]
          </button>

          <button onClick={() => handleQuickAction('BÁO CÁO HƯ HỎNG')}
            className="h-13 bg-red-100 hover:bg-red-200 text-red-950 border-2 border-red-400 rounded-xl font-black text-xs flex items-center justify-center gap-2 shadow-xs cursor-pointer transition-all col-span-2 sm:col-span-1">
            <span className="material-symbols-outlined text-lg">report_problem</span>
            [ 🚨 BÁO CÁO HƯ HỎNG ]
          </button>
        </div>
      </div>

      {/* ── 4. SECTION "CONTAINER NHẬP BÃI" ── */}
      <div className="bg-white rounded-2xl border-2 border-slate-200 p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-200 pb-3">
          <h3 className="font-heading text-base font-extrabold text-slate-900 flex items-center gap-2">
            <span className="material-symbols-outlined text-orange-600">move_to_inbox</span>
            CONTAINER VỪA DỠ TỪ TÀU ĐANG VÀO BÃI
          </h3>
          <span className="text-xs font-mono font-bold text-slate-500">{incomingContainers.length} Container đang nhập bãi</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold uppercase text-[10px] tracking-wider">
                {['Mã Container', 'Tàu Cầu Bến', 'Cầu Cảng Gốc', 'Loại Container', 'Trọng Lượng', 'Số Niêm Phong', 'Trạng Thái', 'Vị Trí Gợi Ý AI', 'Thao Tác'].map(h => (
                  <th key={h} className={`py-3.5 px-4 ${h === 'Thao Tác' ? 'text-right' : ''}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-mono">
              {incomingContainers.length === 0 ? (
                <tr>
                  <td colSpan="9" className="py-8 text-center text-slate-500 font-bold font-sans">
                    Tất cả container từ tàu đã được tiếp nhận an toàn vào bãi.
                  </td>
                </tr>
              ) : incomingContainers.map(c => (
                <tr key={c.id} className="hover:bg-slate-100/60">
                  <td className="py-3.5 px-4 font-black text-slate-900 text-sm font-heading">{c.id}</td>
                  <td className="py-3.5 px-4 font-bold text-blue-900 font-sans">{c.vessel}</td>
                  <td className="py-3.5 px-4 font-bold text-amber-900">{c.berth}</td>
                  <td className="py-3.5 px-4 font-bold text-slate-800">{c.type}</td>
                  <td className="py-3.5 px-4 font-bold text-slate-700">{c.weight}</td>
                  <td className="py-3.5 px-4 font-bold text-purple-900">{c.seal}</td>
                  <td className="py-3.5 px-4 font-sans">
                    <span className="px-2.5 py-0.5 rounded-full border text-[10px] font-black bg-emerald-100 text-emerald-950 border-emerald-400">
                      {c.statusBadge}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-extrabold text-orange-700 font-mono text-sm">{c.suggestedPosition}</td>
                  <td className="py-3.5 px-4 text-right font-sans">
                    <button onClick={() => handleOpenReceiveModal(c)}
                      className="px-4 py-1.5 bg-orange-100 hover:bg-orange-200 text-orange-950 border-2 border-orange-400 font-black text-xs rounded-xl shadow-xs cursor-pointer ml-auto transition-all">
                      [ 📦 TIẾP NHẬN ]
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── 5 & 6. GÁN VỊ TRÍ AI & NHIỆM VỤ CA LÀM VIỆC ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* 5. GÁN VỊ TRÍ AI */}
        <div className="bg-white rounded-2xl border-2 border-slate-200 p-6 shadow-sm space-y-4 flex flex-col justify-between">
          <div>
            <div className="border-b border-slate-200 pb-3 flex justify-between items-center">
              <h3 className="font-heading text-base font-extrabold text-slate-900 flex items-center gap-2">
                <span className="material-symbols-outlined text-purple-600">auto_awesome</span>
                CONTAINER CHỜ GÁN VỊ TRÍ BÃI (AI)
              </h3>
              <span className="text-xs font-mono font-bold text-slate-500">{positioningTasks.length} Chờ vị trí</span>
            </div>

            <div className="mt-4 space-y-3">
              {positioningTasks.map(pt => (
                <div key={pt.id} className="p-4 bg-slate-100 rounded-xl border border-slate-200 space-y-2 font-mono text-xs">
                  <div className="flex justify-between items-center">
                    <span className="font-black text-slate-900 text-sm font-heading">{pt.id} · {pt.type}</span>
                    <span className="px-2.5 py-0.5 bg-purple-100 text-purple-950 border border-purple-300 rounded font-black text-[10px]">
                      {pt.weight}
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-700 font-sans">
                    Loại hàng: <strong className="text-slate-900 font-black">{pt.cargoType}</strong> · Rời cảng: <strong className="text-purple-900 font-bold">{pt.departure}</strong>
                  </div>

                  <div className="p-2.5 bg-white rounded-lg border border-purple-300 text-purple-950 font-bold space-y-0.5">
                    <div>🤖 AI Gợi Ý Vị Trí Ô Bãi: <strong className="text-orange-700 font-black text-sm">{pt.aiSuggestedPos}</strong></div>
                    <div className="text-[10px] text-slate-600 font-normal font-sans">Lý do: {pt.reasoning}</div>
                  </div>

                  <button onClick={() => setSelectedAiTask(pt)}
                    className="w-full py-2 bg-purple-100 hover:bg-purple-200 text-purple-950 border border-purple-400 font-black text-xs rounded-xl shadow-xs cursor-pointer transition-all font-sans">
                    [ XEM GỢI Ý AI ]
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="p-3 bg-slate-100 rounded-xl border border-slate-200 text-[11px] text-slate-600 font-sans">
            🤖 <strong>Thuật Toán AI Tối Ưu:</strong> Vị trí gợi ý tự động giảm thiểu số lần đảo chuyển container xuống dưới 3%.
          </div>
        </div>

        {/* 6. NHIỆM VỤ CA LÀM VIỆC */}
        <div className="bg-white rounded-2xl border-2 border-slate-200 p-6 shadow-sm space-y-4">
          <div className="border-b border-slate-200 pb-3 flex justify-between items-center">
            <h3 className="font-heading text-base font-extrabold text-slate-900 flex items-center gap-2">
              <span className="material-symbols-outlined text-blue-600">task</span>
              NHIỆM VỤ CA LÀM VIỆC TỒN ĐỌNG
            </h3>
            <span className="text-xs font-mono font-bold text-slate-500">{yardTasks.length} Nhiệm vụ</span>
          </div>

          <div className="space-y-3">
            {yardTasks.map(task => (
              <div key={task.id} className="p-3.5 bg-slate-100 rounded-xl border border-slate-200 space-y-1.5 font-mono text-xs">
                <div className="flex justify-between items-center">
                  <span className="font-black text-slate-900 font-sans">{task.id} — {task.taskType}</span>
                  <span className={`px-2 py-0.5 rounded font-black text-[10px] border ${
                    task.priority === 'CRITICAL' ? 'bg-red-200 text-red-950 border-red-500' :
                    task.priority === 'HIGH' ? 'bg-orange-100 text-orange-950 border-orange-400' :
                    task.priority === 'MEDIUM' ? 'bg-amber-100 text-amber-950 border-amber-400' :
                    'bg-emerald-100 text-emerald-950 border-emerald-400'
                  }`}>
                    {task.priorityBadge}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] font-sans pt-1">
                  <div>Mã Container: <strong className="text-slate-900 font-mono font-bold">{task.containerId}</strong></div>
                  <div>Hạn chót: <strong className="text-red-700 font-bold">{task.dueTime}</strong></div>
                </div>

                <div className="p-2 bg-white rounded border border-slate-200 text-[11px] flex justify-between items-center">
                  <span>Vị trí gốc: <strong className="text-blue-900">{task.from}</strong></span>
                  <span className="text-slate-400 font-bold">➔</span>
                  <span>Vị trí đích: <strong className="text-emerald-900">{task.to}</strong></span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* ── MODAL 1: INSPECTION & CONFIRM RECEIVING PANEL ── */}
      {selectedReceiveContainer && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white max-w-lg w-full rounded-3xl p-6 shadow-2xl space-y-4 animate-in zoom-in-95 font-sans border-2 border-orange-400">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-orange-600 text-xl">fact_check</span>
                <h3 className="font-heading text-lg font-extrabold text-slate-900">Kiểm Tra & Tiếp Nhận Container Vào Bãi</h3>
              </div>
              <button onClick={() => setSelectedReceiveContainer(null)} className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 hover:text-slate-900">
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>

            <form onSubmit={handleConfirmReceivingSubmit} className="space-y-4 text-xs font-bold">
              <div className="grid grid-cols-2 gap-3 font-mono">
                <div className="bg-slate-100 p-3 rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-600 uppercase font-sans font-bold block">Mã Container</span>
                  <strong className="text-slate-900 font-black text-sm">{selectedReceiveContainer.id}</strong>
                </div>

                <div className="bg-slate-100 p-3 rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-600 uppercase font-sans font-bold block">Số Niêm Phong</span>
                  <strong className="text-purple-900 font-black text-sm">{selectedReceiveContainer.seal}</strong>
                </div>
              </div>

              <div>
                <label className="block text-slate-600 uppercase text-[10px] mb-1 font-extrabold">Tình Trạng Vỏ Container *</label>
                <select value={inspectionForm.condition} onChange={e => setInspectionForm(p => ({ ...p, condition: e.target.value }))}
                  className="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-300 rounded-xl text-slate-900 font-extrabold text-sm focus:outline-none focus:border-slate-900">
                  <option value="Tốt (Không Hư Hỏng)">Tốt (Không Hư Hỏng)</option>
                  <option value="Trầy Xước Nhẹ">Trầy Xước Nhẹ</option>
                  <option value="Móp Méo Vỏ">Móp Méo Vỏ</option>
                  <option value="Hư Hỏng Khóa Niêm Phong">Hư Hỏng Khóa Niêm Phong</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-600 uppercase text-[10px] mb-1 font-extrabold">Ảnh Chụp Thực Địa</label>
                <div className="flex gap-2 font-mono">
                  {inspectionForm.photoFiles.map((file, i) => (
                    <div key={i} className="flex-1 p-2 bg-slate-100 border border-slate-300 rounded-lg text-center text-[10px] text-slate-700 font-bold truncate">
                      📷 {file}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-slate-600 uppercase text-[10px] mb-1 font-extrabold">Ghi Chú Kiểm Tra</label>
                <textarea rows="2" value={inspectionForm.notes} onChange={e => setInspectionForm(p => ({ ...p, notes: e.target.value }))}
                  placeholder="Ghi chú thêm về vị trí tiếp nhận..."
                  className="w-full p-3 bg-slate-100 border border-slate-300 rounded-xl text-xs font-normal text-slate-900 focus:outline-none focus:border-slate-900 resize-none" />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setSelectedReceiveContainer(null)} className="flex-1 h-12 border border-slate-300 text-slate-700 rounded-xl font-extrabold text-xs hover:bg-slate-100">
                  Hủy Bỏ
                </button>
                <button type="submit" className="flex-1 h-12 bg-orange-100 hover:bg-orange-200 text-orange-950 border-2 border-orange-400 rounded-xl font-black text-xs shadow-xs">
                  [ XÁC NHẬN TIẾP NHẬN ]
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 2: AI SUGGESTION DETAILS POPUP ── */}
      {selectedAiTask && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full rounded-3xl p-6 shadow-2xl space-y-4 animate-in zoom-in-95 font-sans border-2 border-purple-400">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-purple-600 text-xl">auto_awesome</span>
                <h3 className="font-heading text-lg font-black text-slate-900">Chi Tiết Gợi Ý Vị Trí AI</h3>
              </div>
              <button onClick={() => setSelectedAiTask(null)} className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 hover:text-slate-900">
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>

            <div className="space-y-3 text-xs font-mono">
              <div className="p-3 bg-purple-50 border border-purple-300 rounded-xl space-y-1">
                <div className="font-black text-purple-950 text-sm">{selectedAiTask.id}</div>
                <div className="text-[11px] text-slate-700 font-sans font-bold">Loại hàng: {selectedAiTask.cargoType}</div>
                <div className="text-[11px] text-orange-900 font-extrabold mt-1">Vị trí đề xuất: {selectedAiTask.aiSuggestedPos}</div>
              </div>

              <div className="p-3 bg-slate-100 border border-slate-200 rounded-xl text-slate-800 font-sans font-medium">
                <strong>Thuật toán tối ưu:</strong> {selectedAiTask.reasoning}
              </div>
            </div>

            <button onClick={() => {
              showToast(`🎯 Đã áp dụng vị trí AI ${selectedAiTask.aiSuggestedPos} cho container ${selectedAiTask.id}`)
              setSelectedAiTask(null)
            }} className="w-full h-12 bg-purple-100 hover:bg-purple-200 text-purple-950 border-2 border-purple-400 rounded-xl font-black text-xs shadow-xs cursor-pointer">
              [ CHẤP NHẬN VỊ TRÍ GỢI Ý ]
            </button>
          </div>
        </div>
      )}

    </div>
  )
}
