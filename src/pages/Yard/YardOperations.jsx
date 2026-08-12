import React, { useState } from 'react'
import CreateYardMoveModal from '../../components/Yard/CreateYardMoveModal'
import {
  INITIAL_CONTAINERS,
  INITIAL_YARD_TRACTORS,
  INITIAL_YARD_DRIVERS,
} from '../../data/yardMoveData'

const initialOrders = [
  {
    id: 'YM-20260811-001',
    code: 'YM-20260811-001',
    container: 'TEMU 882219-0',
    from: 'Block A / A-01',
    to: 'Block D / D-02',
    weight: '28.4T',
    carrier: 'ONE Line',
    cargoType: 'High Cube 40ft',
    status: 'Đang thực hiện',
    step: 2, // 1: Chờ xác nhận, 2: Đang di chuyển, 3: Tại vị trí
    timeEta: '04:12',
    isMyTask: true
  },
  {
    id: 'MO-8922-URG',
    code: 'MO-8922-URG',
    container: 'MSCU 493021-9',
    from: 'Block B',
    to: 'Gate 3',
    weight: '28T',
    carrier: 'MSC',
    cargoType: 'Hàng tiêu dùng',
    status: 'Đang thực hiện',
    step: 2,
    timeEta: '04:12',
    isMyTask: true
  },
  {
    id: 'MO-8923-STD',
    code: 'MO-8923-STD',
    container: 'TGHU 102934-2',
    from: 'Gate 1',
    to: 'Block C',
    weight: '22T',
    carrier: 'TGHU',
    cargoType: 'Máy móc',
    status: 'Đang chờ',
    step: 1,
    timeEta: '--:--',
    isMyTask: false
  },
  {
    id: 'MO-8B24-STD',
    code: 'MO-8B24-STD',
    container: 'HLBU 993210-5',
    from: 'Block E',
    to: 'Block A',
    weight: '30T',
    carrier: 'Hapag-Lloyd',
    cargoType: 'Hóa chất',
    status: 'Đang chờ',
    step: 1,
    timeEta: '--:--',
    isMyTask: true
  }
]

export default function YardOperations() {
  const [orders, setOrders] = useState(initialOrders)
  const [activeTab, setActiveTab] = useState('orders')
  const [myTasksOnly, setMyTasksOnly] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [toastMessage, setToastMessage] = useState('')

  // Create Yard Move Modal state
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false)

  const handleStartMove = (id) => {
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status: 'Đang thực hiện', step: 2, timeEta: '05:00' } : o))
    setToastMessage(`🚛 Đã bắt đầu thực hiện lệnh di chuyển ${id}!`)
    setTimeout(() => setToastMessage(''), 3000)
  }

  const handleCompleteMove = (id) => {
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status: 'Hoàn tất', step: 3 } : o))
    setToastMessage(`✅ Đã hoàn tất lệnh di chuyển ${id}!`)
    setTimeout(() => setToastMessage(''), 3000)
  }

  const handleMoveCreated = (newMove) => {
    const newOrderObj = {
      id: newMove.id,
      code: newMove.id,
      container: newMove.containerId,
      from: newMove.from,
      to: newMove.to,
      weight: '28T',
      carrier: 'ONE Line',
      cargoType: 'Container Move',
      status: 'Đang thực hiện',
      step: 2,
      timeEta: '10:00',
      isMyTask: true,
    }

    setOrders(prev => [newOrderObj, ...prev])
    setToastMessage(`✅ Đã tạo Lệnh Di Chuyển Bãi ${newMove.id} cho container ${newMove.containerId}!`)
    setTimeout(() => setToastMessage(''), 4000)
  }

  const filteredOrders = orders.filter(o => {
    const matchesSearch = o.container.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          o.code.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesMyTask = !myTasksOnly || o.isMyTask
    return matchesSearch && matchesMyTask
  })

  return (
    <div className="p-8 w-full font-sans flex flex-col gap-6 relative">
      
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-24 right-8 bg-[#202020] text-white px-6 py-3 rounded-xl shadow-2xl text-xs font-bold flex items-center gap-3 z-50 animate-bounce border border-signal-orange">
          <span className="text-signal-orange">●</span>
          {toastMessage}
        </div>
      )}

      {/* Header Controls */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-chalk pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold bg-green-100 text-green-700 px-2.5 py-0.5 rounded uppercase">
              Yard Operations Suite
            </span>
            <span className="text-xs text-slate font-mono">Role: Yard Operator</span>
          </div>
          <h2 className="font-heading text-3xl text-carbon font-extrabold mt-1">Vận Hành Bãi — Lệnh Di Chuyển Bãi</h2>
          <p className="text-sm text-slate mt-1">Lập kế hoạch dịch chuyển container nội bãi, phân công xe đầu kéo bãi & tài xế bãi.</p>
        </div>

        {/* Action Button & Search */}
        <div className="flex items-center gap-3">
          <div className="relative w-72">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate text-sm">search</span>
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Tìm kiếm container, lệnh di chuyển..."
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-chalk bg-fog text-xs font-bold text-carbon focus:outline-none focus:border-signal-orange"
            />
          </div>

          <button
            onClick={() => setIsMoveModalOpen(true)}
            className="h-10 px-4 bg-signal-orange text-white rounded-xl font-extrabold text-xs hover:opacity-95 transition-opacity shadow-lg flex items-center gap-2 shrink-0"
          >
            <span className="material-symbols-outlined text-base">alt_route</span>
            + TẠO LỆNH DI CHUYỂN BÃI
          </button>
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="flex border-b border-chalk">
        {[
          { key: 'orders', label: 'Lệnh di chuyển' },
          { key: 'inventory', label: 'Kiểm kê bãi' },
          { key: 'planning', label: 'Lập kế hoạch' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`pb-3 px-6 text-xs font-bold transition-colors ${
              activeTab === tab.key
                ? 'text-carbon border-b-2 border-carbon font-extrabold'
                : 'text-slate hover:text-carbon'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB CONTENT: ORDERS */}
      {activeTab === 'orders' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          
          {/* Section Header */}
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <h3 className="font-heading text-xl font-bold text-carbon">Lệnh di chuyển đang hoạt động</h3>
              <span className="bg-carbon text-white text-xs font-bold px-2.5 py-0.5 rounded-full">
                {filteredOrders.length}
              </span>
            </div>

            {/* My Tasks Toggle */}
            <div className="flex items-center gap-3 text-xs font-bold">
              <span className="text-graphite">Chỉ nhiệm vụ của tôi</span>
              <button
                onClick={() => setMyTasksOnly(!myTasksOnly)}
                className={`w-10 h-6 rounded-full relative transition-colors ${
                  myTasksOnly ? 'bg-signal-orange' : 'bg-chalk'
                }`}
              >
                <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                  myTasksOnly ? 'right-1' : 'left-1'
                }`}></span>
              </button>
            </div>
          </div>

          {/* Movement Orders Grid (3 Cols) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredOrders.map(order => (
              <div
                key={order.id}
                className={`bg-white rounded-xl p-6 border shadow-sm flex flex-col justify-between space-y-4 hover:shadow-md transition-shadow ${
                  order.status === 'Đang thực hiện'
                    ? 'border-l-4 border-l-signal-orange border-chalk'
                    : 'border-chalk'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[10px] text-slate font-bold uppercase tracking-wider block">Mã đơn hàng</span>
                    <span className="font-bold text-carbon text-sm">{order.code}</span>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-[10px] font-bold border ${
                    order.status === 'Đang thực hiện'
                      ? 'bg-orange-50 text-signal-orange border-orange-200 animate-pulse'
                      : order.status === 'Hoàn tất'
                      ? 'bg-green-50 text-green-700 border-green-200'
                      : 'bg-fog text-slate border-chalk'
                  }`}>
                    {order.status}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] text-slate font-bold uppercase tracking-wider block">Mã container</span>
                  <span className="font-heading text-xl font-bold text-carbon font-mono tracking-wider">{order.container}</span>
                </div>

                {/* Route Path Badge */}
                <div className="bg-blue-50/80 rounded-xl p-3 border border-blue-100 flex justify-between items-center text-xs font-bold">
                  <span className="bg-white px-2.5 py-1 rounded shadow-sm text-carbon">{order.from}</span>
                  <span className="material-symbols-outlined text-signal-orange">arrow_forward</span>
                  <span className="bg-white px-2.5 py-1 rounded shadow-sm text-carbon">{order.to}</span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs font-bold pt-2 border-t border-chalk">
                  <span className="text-slate">Trọng tải:</span>
                  <span className="text-right text-carbon">{order.weight}</span>
                  <span className="text-slate">Hãng tàu:</span>
                  <span className="text-right text-carbon">{order.carrier}</span>
                  <span className="text-slate">Loại hàng:</span>
                  <span className="text-right text-carbon truncate">{order.cargoType}</span>
                </div>

                {/* Progress Stepper */}
                <div className="pt-3 space-y-3 border-t border-chalk">
                  <div className="flex gap-1 h-1.5 rounded-full overflow-hidden bg-chalk">
                    <div className={`h-full ${order.step >= 1 ? 'bg-signal-orange w-1/3' : 'w-1/3'}`}></div>
                    <div className={`h-full ${order.step >= 2 ? 'bg-signal-orange w-1/3' : 'w-1/3'}`}></div>
                    <div className={`h-full ${order.step >= 3 ? 'bg-signal-orange w-1/3' : 'w-1/3'}`}></div>
                  </div>

                  <div className="flex justify-between text-[10px] font-bold text-slate">
                    <span className={order.step >= 1 ? 'text-signal-orange' : ''}>Chờ xác nhận</span>
                    <span className={order.step >= 2 ? 'text-signal-orange' : ''}>Đang di chuyển</span>
                    <span className={order.step >= 3 ? 'text-signal-orange' : ''}>Tại cổng ({order.timeEta})</span>
                  </div>

                  {/* Actions */}
                  <div className="pt-2">
                    {order.status === 'Đang chờ' && (
                      <button
                        onClick={() => handleStartMove(order.id)}
                        className="w-full h-10 bg-white border border-carbon text-carbon rounded-full text-xs font-bold hover:bg-fog transition-colors flex items-center justify-center gap-2"
                      >
                        <span className="material-symbols-outlined text-[18px]">play_circle</span>
                        Bắt đầu di chuyển
                      </button>
                    )}

                    {order.status === 'Đang thực hiện' && (
                      <button
                        onClick={() => handleCompleteMove(order.id)}
                        className="w-full h-10 bg-signal-orange text-white rounded-full text-xs font-bold hover:opacity-90 transition-opacity shadow"
                      >
                        Hoàn tất di chuyển
                      </button>
                    )}

                    {order.status === 'Hoàn tất' && (
                      <div className="text-center text-xs font-bold text-green-600 py-2">
                        ✓ Lệnh đã hoàn tất
                      </div>
                    )}
                  </div>
                </div>

              </div>
            ))}
          </div>

        </div>
      )}

      {/* OTHER TABS */}
      {(activeTab === 'inventory' || activeTab === 'planning') && (
        <div className="bg-white border border-chalk rounded-xl p-12 text-center text-slate space-y-2 animate-in fade-in duration-200">
          <span className="material-symbols-outlined text-4xl text-slate">inventory_2</span>
          <h4 className="font-bold text-carbon text-lg">Kiểm kê & Lập kế hoạch vị trí bãi</h4>
          <p className="text-xs">Chức năng tự động tối ưu vị trí xếp chồng bãi đang đồng bộ dữ liệu time-real.</p>
        </div>
      )}

      {/* CREATE YARD MOVE MODAL */}
      <CreateYardMoveModal
        isOpen={isMoveModalOpen}
        onClose={() => setIsMoveModalOpen(false)}
        onMoveCreated={handleMoveCreated}
      />

    </div>
  )
}
