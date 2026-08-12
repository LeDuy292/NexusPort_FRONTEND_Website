import React, { useState, useMemo } from 'react'

// Mock Initial Invoices
const INITIAL_INVOICES = [
  { id: 'INV-2026-001', customer: 'Maersk Line', type: 'Container Handling Fee', date: '2026-08-01', dueDate: '2026-08-15', amount: 85000000, status: 'Đã thanh toán', category: 'Carrier' },
  { id: 'INV-2026-002', customer: 'Evergreen Marine', type: 'Storage Fee', date: '2026-08-02', dueDate: '2026-08-16', amount: 34000000, status: 'Chờ thanh toán', category: 'Carrier' },
  { id: 'INV-2026-003', customer: 'Logistics Hoành Sơn', type: 'Gate Booking Fee', date: '2026-08-03', dueDate: '2026-08-10', amount: 12500000, status: 'Đã thanh toán', category: 'Transport Company' },
  { id: 'INV-2026-004', customer: 'Vận tải Thành Hưng', type: 'Reefer Fee', date: '2026-07-20', dueDate: '2026-08-03', amount: 18000000, status: 'Quá hạn', category: 'Transport Company' },
  { id: 'INV-2026-005', customer: 'Mediterranean Shipping Co.', type: 'Dangerous Goods Fee', date: '2026-08-05', dueDate: '2026-08-20', amount: 120000000, status: 'Chờ thanh toán', category: 'Carrier' },
  { id: 'INV-2026-006', customer: 'Gemadept Logistics', type: 'Equipment Usage Fee', date: '2026-08-06', dueDate: '2026-08-20', amount: 45000000, status: 'Nháp', category: 'Transport Company' },
  { id: 'INV-2026-007', customer: 'Ocean Network Express', type: 'Other Terminal Service Fee', date: '2026-07-15', dueDate: '2026-07-30', amount: 28000000, status: 'Đã hủy', category: 'Carrier' }
]

// Mock Initial Pricing Rules
const INITIAL_PRICING = [
  { id: 'PRC-001', category: 'Gate Booking', name: 'Phí booking thông thường', unit: 'Mỗi lượt xe', price: 50000, effectiveDate: '2026-01-01', status: 'Hoạt động' },
  { id: 'PRC-002', category: 'Container', name: 'Phí nâng hạ (Handling) 20\'', unit: 'Mỗi container', price: 500000, effectiveDate: '2026-01-01', status: 'Hoạt động' },
  { id: 'PRC-003', category: 'Container', name: 'Phí nâng hạ (Handling) 40\'', unit: 'Mỗi container', price: 850000, effectiveDate: '2026-01-01', status: 'Hoạt động' },
  { id: 'PRC-004', category: 'Container', name: 'Phí lưu bãi thông thường', unit: 'Mỗi cont / ngày', price: 100000, effectiveDate: '2026-01-01', status: 'Hoạt động' },
  { id: 'PRC-005', category: 'Container', name: 'Phí phạt container quá hạn', unit: 'Mỗi cont / ngày', price: 250000, effectiveDate: '2026-01-01', status: 'Hoạt động' },
  { id: 'PRC-006', category: 'Reefer', name: 'Phí cắm điện điện lạnh', unit: 'Mỗi cont / ngày', price: 250000, effectiveDate: '2026-01-01', status: 'Hoạt động' },
  { id: 'PRC-007', category: 'HazMat', name: 'Phí lưu kho hàng nguy hiểm (DG)', unit: 'Mỗi container', price: 1200000, effectiveDate: '2026-01-01', status: 'Hoạt động' },
  { id: 'PRC-008', category: 'Equipment', name: 'Phí cẩu di động Liebherr siêu tải', unit: 'Mỗi giờ sử dụng', price: 300000, effectiveDate: '2026-01-01', status: 'Hoạt động' }
]

// Mock Initial Payments
const INITIAL_PAYMENTS = [
  { invoiceId: 'INV-2026-001', customer: 'Maersk Line', amount: 85000000, date: '2026-08-10', method: 'Chuyển khoản ngân hàng (VND)', transactionId: 'TXN-902102931', status: 'Thành công' },
  { invoiceId: 'INV-2026-003', customer: 'Logistics Hoành Sơn', amount: 12500000, date: '2026-08-08', method: 'Thẻ thanh toán nội địa', transactionId: 'TXN-881290312', status: 'Thành công' }
]

// Mock Initial Accounts Receivable
const INITIAL_RECEIVABLES = [
  { customer: 'Evergreen Marine', totalBilled: 120000000, paid: 86000000, outstanding: 34000000, overdue: 0, daysOverdue: 0, status: 'Trong hạn' },
  { customer: 'Vận tải Thành Hưng', totalBilled: 48000000, paid: 30000000, outstanding: 18000000, overdue: 18000000, daysOverdue: 9, status: 'Quá hạn' },
  { customer: 'Mediterranean Shipping Co.', totalBilled: 250000000, paid: 130000000, outstanding: 120000000, overdue: 0, daysOverdue: 0, status: 'Trong hạn' }
]

export default function BillingChargesManagement() {
  const [activeTab, setActiveTab] = useState('Tổng quan') // 'Tổng quan' | 'Hóa đơn' | 'Bảng giá' | 'Thanh toán' | 'Công nợ'
  const [invoices, setInvoices] = useState(INITIAL_INVOICES)
  const [pricingRules, setPricingRules] = useState(INITIAL_PRICING)
  const [payments, setPayments] = useState(INITIAL_PAYMENTS)
  const [receivables, setReceivables] = useState(INITIAL_RECEIVABLES)

  // Filters state
  const [customerSearch, setCustomerSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('Tất cả')
  const [categoryFilter, setCategoryFilter] = useState('Tất cả')

  // Modal / Drawer state
  const [selectedInvoice, setSelectedInvoice] = useState(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showRecordModal, setShowRecordModal] = useState(false)
  const [toastMessage, setToastMessage] = useState('')

  // New Invoice Form
  const [newInvoice, setNewInvoice] = useState({
    customer: '',
    type: 'Container Handling Fee',
    amount: '',
    dueDate: '',
    category: 'Carrier'
  })

  // Record Payment Form
  const [newPayment, setNewPayment] = useState({
    invoiceId: '',
    customer: '',
    amount: '',
    method: 'Chuyển khoản ngân hàng (VND)'
  })

  // Financial summary calculations
  const summary = useMemo(() => {
    const totalBilledThisMonth = invoices.filter(inv => inv.status !== 'Đang hủy' && inv.date.includes('2026-08')).reduce((sum, inv) => sum + inv.amount, 0)
    const pendingAmount = invoices.filter(inv => inv.status === 'Chờ thanh toán').reduce((sum, inv) => sum + inv.amount, 0)
    const paidAmount = invoices.filter(inv => inv.status === 'Đã thanh toán').reduce((sum, inv) => sum + inv.amount, 0)
    const overdueAmount = invoices.filter(inv => inv.status === 'Quá hạn').reduce((sum, inv) => sum + inv.amount, 0)
    const totalReceivables = pendingAmount + overdueAmount

    return {
      revenue: totalBilledThisMonth,
      pending: pendingAmount,
      paid: paidAmount,
      overdue: overdueAmount,
      totalAR: totalReceivables
    }
  }, [invoices])

  // Filtered Invoices
  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      const matchSearch = inv.customer.toLowerCase().includes(customerSearch.toLowerCase()) || inv.id.toLowerCase().includes(customerSearch.toLowerCase())
      const matchStatus = statusFilter === 'Tất cả' || inv.status === statusFilter
      const matchCategory = categoryFilter === 'Tất cả' || inv.category === categoryFilter
      return matchSearch && matchStatus && matchCategory
    })
  }, [invoices, customerSearch, statusFilter, categoryFilter])

  // Actions
  const handleCreateInvoice = (e) => {
    e.preventDefault()
    if (!newInvoice.customer || !newInvoice.amount || !newInvoice.dueDate) {
      showToast('❌ Vui lòng điền đầy đủ các thông tin hóa đơn bắt buộc!')
      return
    }

    const invoice = {
      id: `INV-2026-0${invoices.length + 1}`,
      customer: newInvoice.customer,
      type: newInvoice.type,
      date: new Date().toISOString().split('T')[0],
      dueDate: newInvoice.dueDate,
      amount: Number(newInvoice.amount),
      status: 'Chờ thanh toán',
      category: newInvoice.category
    }

    setInvoices(prev => [invoice, ...prev])
    setShowCreateModal(false)
    setNewInvoice({ customer: '', type: 'Container Handling Fee', amount: '', dueDate: '', category: 'Carrier' })
    showToast('➕ Đã khởi tạo và gửi hóa đơn dịch vụ cảng thành công!')
  }

  const handleMarkAsPaid = (id) => {
    const inv = invoices.find(i => i.id === id)
    if (!inv) return

    setInvoices(prev => prev.map(i => i.id === id ? { ...i, status: 'Đã thanh toán' } : i))
    
    // Add to payments table
    const payment = {
      invoiceId: id,
      customer: inv.customer,
      amount: inv.amount,
      date: new Date().toISOString().split('T')[0],
      method: 'Ghi nhận thủ công (Admin)',
      transactionId: `ADM-${Math.floor(100000000 + Math.random() * 900000000)}`,
      status: 'Thành công'
    }
    setPayments(prev => [payment, ...prev])

    // Update receivables
    setReceivables(prev => prev.map(r => r.customer === inv.customer ? { ...r, paid: r.paid + inv.amount, outstanding: Math.max(0, r.outstanding - inv.amount) } : r))

    showToast('✅ Ghi nhận hóa đơn đã thanh toán thành công!')
    if (selectedInvoice && selectedInvoice.id === id) {
      setSelectedInvoice(prev => ({ ...prev, status: 'Đã thanh toán' }))
    }
  }

  const handleCancelInvoice = (id) => {
    setInvoices(prev => prev.map(i => i.id === id ? { ...i, status: 'Đã hủy' } : i))
    showToast('🚫 Đã hủy bỏ hóa đơn dịch vụ.')
    if (selectedInvoice && selectedInvoice.id === id) {
      setSelectedInvoice(prev => ({ ...prev, status: 'Đã hủy' }))
    }
  }

  const showToast = (msg) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(''), 3000)
  }

  return (
    <div className="p-6 space-y-6">
      
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-4 right-4 bg-carbon text-white px-5 py-3 rounded-xl shadow-2xl text-xs font-bold flex items-center gap-2 z-50 border border-signal-orange animate-bounce">
          <span className="text-signal-orange">●</span>
          {toastMessage}
        </div>
      )}

      {/* Warning business rule banner */}
      <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex gap-3 text-xs text-orange-800">
        <span className="material-symbols-outlined text-signal-orange text-lg">monetization_on</span>
        <div>
          <strong className="font-bold">Lưu ý phân nhiệm tài chính (Billing Rule):</strong> Các hãng tàu (Carrier) và đơn vị vận tải (Transport Company) là khách hàng thanh toán phí ngoài cảng. Phân hệ Billing do bộ phận tài chính/quản trị viên Admin xử lý. Mọi nhân viên vận hành thực địa (Dispatcher, Yard Staff, Gate Officer, Berth Staff) tuyệt đối không có quyền thay đổi bảng giá cước, chỉnh sửa hóa đơn hoặc ghi nhận công nợ.
        </div>
      </div>

      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-carbon font-heading">Billing & Thanh toán</h2>
          <p className="text-xs text-slate mt-1">Lập hóa đơn dịch vụ cảng cảng biển, cấu hình đơn giá nâng hạ container, thu phí cắm reefer, và theo dõi công nợ quá hạn.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-signal-orange text-white text-xs font-bold px-4 py-2.5 rounded-lg hover:bg-orange-600 transition-colors shadow-md flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-sm">post_add</span>
            TẠO HÓA ĐƠN
          </button>
        </div>
      </div>

      {/* FINANCIAL KPI CARDS GRID */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        
        {/* KPI: Monthly Revenue */}
        <div className="bg-white border border-chalk rounded-2xl p-4 shadow-sm space-y-1 relative overflow-hidden">
          <span className="text-[9px] font-bold text-slate uppercase tracking-wider block">DOANH THU THÁNG NÀY</span>
          <div className="text-2xl font-extrabold text-carbon font-mono">{(summary.revenue / 1000000).toFixed(1)}M VND</div>
          <div className="text-[9px] text-green-700 font-bold">Tháng 8/2026 (Live)</div>
        </div>

        {/* KPI: Pending Payments */}
        <div className="bg-white border border-chalk rounded-2xl p-4 shadow-sm space-y-1 relative overflow-hidden">
          <span className="text-[9px] font-bold text-slate uppercase tracking-wider block">CHỜ THANH TOÁN</span>
          <div className="text-2xl font-extrabold text-blue-600 font-mono">{(summary.pending / 1000000).toFixed(1)}M VND</div>
          <div className="text-[9px] text-slate font-medium">Hóa đơn trong kỳ hạn nợ</div>
        </div>

        {/* KPI: Paid */}
        <div className="bg-white border border-chalk rounded-2xl p-4 shadow-sm space-y-1 relative overflow-hidden">
          <span className="text-[9px] font-bold text-slate uppercase tracking-wider block">ĐÃ THANH TOÁN</span>
          <div className="text-2xl font-extrabold text-green-600 font-mono">{(summary.paid / 1000000).toFixed(1)}M VND</div>
          <div className="text-[9px] text-slate font-medium">Doanh thu thực thu</div>
        </div>

        {/* KPI: Overdue */}
        <div className="bg-white border border-chalk rounded-2xl p-4 shadow-sm space-y-1 relative overflow-hidden">
          <span className="text-[9px] font-bold text-slate uppercase tracking-wider block">QUÁ HẠN NỢ PHÍ</span>
          <div className="text-2xl font-extrabold text-red-600 font-mono">{(summary.overdue / 1000000).toFixed(1)}M VND</div>
          <div className="text-[9px] text-red-700 font-bold font-sans">Cần gửi thông báo đòi nợ</div>
        </div>

        {/* KPI: Total A/R */}
        <div className="bg-white border border-chalk rounded-2xl p-4 shadow-sm space-y-1 relative overflow-hidden">
          <span className="text-[9px] font-bold text-slate uppercase tracking-wider block">TỔNG CÔNG NỢ PHẢI THU</span>
          <div className="text-2xl font-extrabold text-purple-600 font-mono">{(summary.totalAR / 1000000).toFixed(1)}M VND</div>
          <div className="text-[9px] text-slate font-medium">Tổng số tiền đang nợ cảng</div>
        </div>

      </div>

      {/* TABS SELECTOR */}
      <div className="flex border-b border-chalk gap-4 text-sm font-bold bg-white p-3 rounded-xl border border-chalk">
        {['Tổng quan', 'Hóa đơn', 'Bảng giá', 'Thanh toán', 'Công nợ'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg transition-colors ${
              activeTab === tab 
                ? 'bg-carbon text-white' 
                : 'text-slate hover:bg-fog hover:text-carbon'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* TAB CONTENT 1: TỔNG QUAN */}
      {activeTab === 'Tổng quan' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Revenue distribution */}
          <div className="bg-white border border-chalk rounded-2xl p-5 shadow-sm space-y-4">
            <h3 className="font-extrabold text-carbon text-sm uppercase tracking-wider border-b border-chalk pb-2">
              Phân bổ nguồn thu dịch vụ cảng
            </h3>
            <div className="space-y-3 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate font-medium">Phí nâng hạ (Container Handling)</span>
                <span className="font-bold text-carbon font-mono">85,000,000 VND</span>
              </div>
              <div className="bg-fog h-2 rounded-full overflow-hidden">
                <div className="bg-signal-orange h-full" style={{ width: '45%' }}></div>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-slate font-medium">Cắm điện reefer bãi</span>
                <span className="font-bold text-carbon font-mono">18,000,000 VND</span>
              </div>
              <div className="bg-fog h-2 rounded-full overflow-hidden">
                <div className="bg-blue-600 h-full" style={{ width: '15%' }}></div>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-slate font-medium">Khai thác thiết bị chuyên dụng</span>
                <span className="font-bold text-carbon font-mono">45,000,000 VND</span>
              </div>
              <div className="bg-fog h-2 rounded-full overflow-hidden">
                <div className="bg-purple-600 h-full" style={{ width: '25%' }}></div>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-slate font-medium">Cước booking cổng</span>
                <span className="font-bold text-carbon font-mono">12,500,000 VND</span>
              </div>
              <div className="bg-fog h-2 rounded-full overflow-hidden">
                <div className="bg-teal-600 h-full" style={{ width: '15%' }}></div>
              </div>
            </div>
          </div>

          {/* Pending Alerts */}
          <div className="bg-white border border-chalk rounded-2xl p-5 shadow-sm space-y-4">
            <h3 className="font-extrabold text-carbon text-sm uppercase tracking-wider border-b border-chalk pb-2">
              Hóa đơn quá hạn thanh toán
            </h3>
            <div className="space-y-3">
              {invoices.filter(i => i.status === 'Quá hạn').map(inv => (
                <div key={inv.id} className="p-3 bg-red-50 rounded-xl border border-red-200 flex justify-between items-center text-xs">
                  <div>
                    <div className="font-bold text-red-950">{inv.customer}</div>
                    <div className="text-[10px] text-red-700 mt-0.5">{inv.type} • Hạn trả: {inv.dueDate}</div>
                  </div>
                  <div className="text-right">
                    <span className="font-extrabold text-red-900 font-mono block">{inv.amount.toLocaleString()} VND</span>
                    <button
                      onClick={() => handleMarkAsPaid(inv.id)}
                      className="text-[10px] font-bold text-blue-600 hover:underline mt-1 block"
                    >
                      Nhận thanh toán
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT 2: HÓA ĐƠN */}
      {activeTab === 'Hóa đơn' && (
        <div className="bg-white border border-chalk rounded-2xl shadow-sm overflow-hidden space-y-4 p-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Search */}
            <div className="relative flex-1 max-w-sm">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate text-sm">search</span>
              <input
                type="text"
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                placeholder="Tìm mã hóa đơn, tên đối tác..."
                className="w-full bg-fog border border-chalk rounded-lg pl-9 pr-4 py-2 text-xs text-carbon focus:outline-none focus:border-signal-orange"
              />
            </div>

            {/* Category filter */}
            <div className="flex items-center gap-3 text-xs font-semibold text-slate">
              <span>Đơn vị:</span>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="bg-fog border border-chalk rounded-lg px-3 py-1.5 focus:outline-none focus:border-signal-orange"
              >
                <option value="Tất cả">Tất cả đối tác</option>
                <option value="Carrier">Hãng tàu (Carrier)</option>
                <option value="Transport Company">Nhà xe vận tải</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-fog border-b border-chalk font-mono font-bold text-slate text-[10px] uppercase">
                  <th className="px-6 py-4">Mã Hóa đơn</th>
                  <th className="px-6 py-4">Khách hàng / Đối tác</th>
                  <th className="px-6 py-4">Loại dịch vụ cảng</th>
                  <th className="px-6 py-4">Ngày lập</th>
                  <th className="px-6 py-4 font-mono">Hạn thanh toán</th>
                  <th className="px-6 py-4 text-right">Số tiền</th>
                  <th className="px-6 py-4">Trạng thái</th>
                  <th className="px-6 py-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-chalk">
                {filteredInvoices.map((inv) => (
                  <tr
                    key={inv.id}
                    className="hover:bg-fog/50 cursor-pointer transition-colors"
                    onClick={() => setSelectedInvoice(inv)}
                  >
                    <td className="px-6 py-4 font-mono font-bold text-carbon text-sm">{inv.id}</td>
                    <td className="px-6 py-4">
                      <div>
                        <div className="font-bold text-carbon text-sm">{inv.customer}</div>
                        <div className="text-[10px] text-slate mt-0.5">{inv.category}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-semibold text-carbon">{inv.type}</td>
                    <td className="px-6 py-4 font-mono text-slate">{inv.date}</td>
                    <td className="px-6 py-4 font-mono text-slate">{inv.dueDate}</td>
                    <td className="px-6 py-4 text-right font-extrabold text-carbon font-mono text-sm">{inv.amount.toLocaleString()} VND</td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                        inv.status === 'Đã thanh toán'
                          ? 'bg-green-50 text-green-700 border-green-200'
                          : inv.status === 'Chờ thanh toán'
                          ? 'bg-blue-50 text-blue-700 border-blue-200'
                          : inv.status === 'Quá hạn'
                          ? 'bg-red-50 text-red-700 border-red-200 animate-pulse'
                          : inv.status === 'Nháp'
                          ? 'bg-slate-50 text-slate-700 border-slate-200'
                          : 'bg-slate-100 text-slate-400 border-slate-200 line-through'
                      }`}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right space-x-2" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => setSelectedInvoice(inv)}
                        className="px-2.5 py-1 bg-white border border-chalk rounded text-carbon font-bold hover:bg-chalk transition-colors"
                      >
                        Chi tiết
                      </button>
                      {inv.status === 'Chờ thanh toán' && (
                        <>
                          <button
                            onClick={() => handleMarkAsPaid(inv.id)}
                            className="px-2.5 py-1 bg-green-600 text-white rounded font-bold hover:bg-green-700 transition-colors"
                          >
                            Thu tiền
                          </button>
                          <button
                            onClick={() => handleCancelInvoice(inv.id)}
                            className="px-2.5 py-1 bg-red-50 text-red-700 border border-red-200 rounded font-bold hover:bg-red-100 transition-colors"
                          >
                            Hủy
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB CONTENT 3: BẢNG GIÁ */}
      {activeTab === 'Bảng giá' && (
        <div className="bg-white border border-chalk rounded-2xl shadow-sm overflow-hidden p-5 space-y-4">
          <div className="flex justify-between items-center border-b border-chalk pb-3">
            <h3 className="font-extrabold text-carbon text-sm uppercase tracking-wider">
              Cấu hình giá dịch vụ bến cảng (Pricing Rules Master)
            </h3>
            <span className="text-[10px] font-bold text-slate">Áp dụng từ: 01/01/2026</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-fog border-b border-chalk font-mono font-bold text-slate text-[10px] uppercase">
                  <th className="px-6 py-4">Phân nhóm</th>
                  <th className="px-6 py-4">Tên mục cước phí</th>
                  <th className="px-6 py-4">Đơn vị tính</th>
                  <th className="px-6 py-4 text-right">Đơn giá định mức</th>
                  <th className="px-6 py-4 font-mono">Hiệu lực</th>
                  <th className="px-6 py-4">Trạng thái</th>
                  <th className="px-6 py-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-chalk">
                {pricingRules.map((rule) => (
                  <tr key={rule.id} className="hover:bg-fog/50 transition-colors">
                    <td className="px-6 py-4 font-bold text-carbon">{rule.category}</td>
                    <td className="px-6 py-4 font-semibold text-slate">{rule.name}</td>
                    <td className="px-6 py-4 text-slate">{rule.unit}</td>
                    <td className="px-6 py-4 text-right font-extrabold text-carbon font-mono text-sm">{rule.price.toLocaleString()} VND</td>
                    <td className="px-6 py-4 font-mono text-slate">{rule.effectiveDate}</td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-green-50 text-green-700 border border-green-200">
                        {rule.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => showToast(`✏️ Cho phép điều chỉnh giá dịch vụ ${rule.name}`)}
                        className="px-2 py-1 bg-white border border-chalk text-carbon hover:bg-chalk transition-colors rounded font-bold"
                      >
                        Sửa
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB CONTENT 4: THANH TOÁN */}
      {activeTab === 'Thanh toán' && (
        <div className="bg-white border border-chalk rounded-2xl shadow-sm overflow-hidden p-5 space-y-4">
          <h3 className="font-extrabold text-carbon text-sm uppercase tracking-wider border-b border-chalk pb-3">
            Lịch sử giao dịch & Biên nhận thanh toán
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-fog border-b border-chalk font-mono font-bold text-slate text-[10px] uppercase">
                  <th className="px-6 py-4">Mã hóa đơn</th>
                  <th className="px-6 py-4">Khách hàng / Đối tác</th>
                  <th className="px-6 py-4 text-right">Số tiền nhận</th>
                  <th className="px-6 py-4">Ngày giao dịch</th>
                  <th className="px-6 py-4">Phương thức</th>
                  <th className="px-6 py-4 font-mono">Mã giao dịch ngân hàng</th>
                  <th className="px-6 py-4">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-chalk">
                {payments.map((p, idx) => (
                  <tr key={idx} className="hover:bg-fog/50 transition-colors">
                    <td className="px-6 py-4 font-mono font-bold text-carbon">{p.invoiceId}</td>
                    <td className="px-6 py-4 font-bold text-carbon">{p.customer}</td>
                    <td className="px-6 py-4 text-right font-extrabold text-green-600 font-mono text-sm">{p.amount.toLocaleString()} VND</td>
                    <td className="px-6 py-4 font-mono text-slate">{p.date}</td>
                    <td className="px-6 py-4 text-slate">{p.method}</td>
                    <td className="px-6 py-4 font-mono text-slate">{p.transactionId}</td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-green-50 text-green-700 border border-green-200">
                        {p.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB CONTENT 5: CÔNG NỢ */}
      {activeTab === 'Công nợ' && (
        <div className="bg-white border border-chalk rounded-2xl shadow-sm overflow-hidden p-5 space-y-4">
          <h3 className="font-extrabold text-carbon text-sm uppercase tracking-wider border-b border-chalk pb-3">
            Bảng kê công nợ phải thu (Accounts Receivable)
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-fog border-b border-chalk font-mono font-bold text-slate text-[10px] uppercase">
                  <th className="px-6 py-4">Khách hàng</th>
                  <th className="px-6 py-4 text-right">Tổng phát sinh</th>
                  <th className="px-6 py-4 text-right">Đã thanh toán</th>
                  <th className="px-6 py-4 text-right">Còn phải thu</th>
                  <th className="px-6 py-4 text-right">Quá hạn nợ</th>
                  <th className="px-6 py-4 text-center">Số ngày quá hạn</th>
                  <th className="px-6 py-4">Trạng thái công nợ</th>
                  <th className="px-6 py-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-chalk">
                {receivables.map((r, idx) => (
                  <tr key={idx} className="hover:bg-fog/50 transition-colors">
                    <td className="px-6 py-4 font-bold text-carbon">{r.customer}</td>
                    <td className="px-6 py-4 text-right font-mono text-carbon">{r.totalBilled.toLocaleString()} VND</td>
                    <td className="px-6 py-4 text-right font-mono text-green-600">{r.paid.toLocaleString()} VND</td>
                    <td className="px-6 py-4 text-right font-mono font-bold text-carbon">{r.outstanding.toLocaleString()} VND</td>
                    <td className="px-6 py-4 text-right font-mono text-red-600">{r.overdue.toLocaleString()} VND</td>
                    <td className="px-6 py-4 text-center font-mono font-bold text-carbon">{r.daysOverdue} ngày</td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                        r.status === 'Trong hạn'
                          ? 'bg-green-50 text-green-700 border-green-200'
                          : 'bg-red-50 text-red-700 border-red-200 animate-pulse'
                      }`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => showToast(`📨 Đã gửi thông báo nhắc nợ tới ${r.customer}`)}
                        className="px-2.5 py-1 bg-carbon text-white text-xs font-bold hover:bg-black transition-colors rounded"
                      >
                        Gửi nhắc nợ
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* DETAIL INVOICE MODAL PANEL */}
      {selectedInvoice && (
        <div className="fixed inset-0 bg-carbon/50 backdrop-blur-sm z-40 flex items-center justify-center p-4" onClick={() => setSelectedInvoice(null)}>
          <div
            className="w-full max-w-2xl bg-white max-h-[90vh] rounded-3xl flex flex-col shadow-2xl relative animate-in zoom-in-95 duration-200 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-6 border-b border-chalk flex justify-between items-center bg-fog">
              <div>
                <span className="text-[10px] font-bold text-slate uppercase tracking-wider block">HÓA ĐƠN DỊCH VỤ CẢNG</span>
                <h3 className="text-lg font-extrabold text-carbon mt-0.5">{selectedInvoice.id}</h3>
              </div>
              <button onClick={() => setSelectedInvoice(null)} className="w-8 h-8 rounded-full bg-white border border-chalk flex items-center justify-center">
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">
              <div className="bg-fog p-4 rounded-xl border border-chalk space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate">Khách hàng:</span>
                  <span className="font-bold text-carbon">{selectedInvoice.customer}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate">Loại đối tác:</span>
                  <span className="font-semibold text-carbon">{selectedInvoice.category}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate">Khoản thu dịch vụ:</span>
                  <span className="font-semibold text-carbon">{selectedInvoice.type}</span>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="font-bold text-xs uppercase tracking-wider text-carbon border-b border-chalk pb-1">Chi tiết biên nhận</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-slate block">Ngày phát hành hóa đơn:</span>
                    <span className="font-mono font-semibold text-carbon">{selectedInvoice.date}</span>
                  </div>
                  <div>
                    <span className="text-slate block">Hạn cuối thanh toán:</span>
                    <span className="font-mono font-bold text-red-600">{selectedInvoice.dueDate}</span>
                  </div>
                </div>
              </div>

              <div className="bg-carbon text-white p-4 rounded-xl space-y-1">
                <span className="text-[9px] text-gray-400 font-bold block uppercase tracking-wider">TỔNG SỐ TIỀN THANH TOÁN</span>
                <span className="text-2xl font-mono font-extrabold block">{selectedInvoice.amount.toLocaleString()} VND</span>
              </div>

              {selectedInvoice.status === 'Đã thanh toán' && (
                <div className="bg-green-50 p-3 rounded-xl border border-green-200 text-green-800 font-semibold text-center">
                  ✓ Giao dịch đã thanh toán thành công thông qua cổng kết nối.
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="p-6 border-t border-chalk flex justify-end gap-2 bg-fog">
              <button
                onClick={() => setSelectedInvoice(null)}
                className="px-4 py-2 border border-chalk bg-white text-carbon rounded-lg font-bold hover:bg-chalk transition-colors text-xs"
              >
                ĐÓNG
              </button>
              {selectedInvoice.status === 'Chờ thanh toán' && (
                <button
                  onClick={() => handleMarkAsPaid(selectedInvoice.id)}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 transition-colors text-xs"
                >
                  XÁC NHẬN ĐÃ THU TIỀN
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CREATE INVOICE MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-carbon/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl relative space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center border-b border-chalk pb-3">
              <h3 className="font-extrabold text-carbon text-lg">Khởi tạo Hóa đơn Dịch vụ</h3>
              <button onClick={() => setShowCreateModal(false)} className="w-8 h-8 rounded-full bg-fog hover:bg-chalk flex items-center justify-center">
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>

            <form onSubmit={handleCreateInvoice} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="text-slate font-bold">Đối tác (Hãng tàu / Nhà xe) *</label>
                <input
                  type="text"
                  required
                  placeholder="VD: Maersk Line"
                  value={newInvoice.customer}
                  onChange={(e) => setNewInvoice({ ...newInvoice, customer: e.target.value })}
                  className="w-full bg-fog border border-chalk rounded-lg p-2.5 focus:outline-none focus:border-signal-orange"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-slate font-bold">Phân loại đối tác *</label>
                  <select
                    value={newInvoice.category}
                    onChange={(e) => setNewInvoice({ ...newInvoice, category: e.target.value })}
                    className="w-full bg-fog border border-chalk rounded-lg p-2.5 focus:outline-none"
                  >
                    <option value="Carrier">Hãng tàu (Carrier)</option>
                    <option value="Transport Company">Nhà xe ngoại cảng</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-slate font-bold">Dịch vụ tính phí *</label>
                  <select
                    value={newInvoice.type}
                    onChange={(e) => setNewInvoice({ ...newInvoice, type: e.target.value })}
                    className="w-full bg-fog border border-chalk rounded-lg p-2.5 focus:outline-none"
                  >
                    <option value="Container Handling Fee">Container Handling Fee</option>
                    <option value="Storage Fee">Storage Fee</option>
                    <option value="Gate Booking Fee">Gate Booking Fee</option>
                    <option value="Reefer Fee">Reefer Fee</option>
                    <option value="Dangerous Goods Fee">Dangerous Goods Fee</option>
                    <option value="Equipment Usage Fee">Equipment Usage Fee</option>
                    <option value="Other Terminal Service Fee">Other Terminal Service Fee</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-slate font-bold">Thành tiền (VND) *</label>
                  <input
                    type="number"
                    required
                    placeholder="VD: 5000000"
                    value={newInvoice.amount}
                    onChange={(e) => setNewInvoice({ ...newInvoice, amount: e.target.value })}
                    className="w-full bg-fog border border-chalk rounded-lg p-2.5 focus:outline-none focus:border-signal-orange font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate font-bold">Hạn thanh toán *</label>
                  <input
                    type="date"
                    required
                    value={newInvoice.dueDate}
                    onChange={(e) => setNewInvoice({ ...newInvoice, dueDate: e.target.value })}
                    className="w-full bg-fog border border-chalk rounded-lg p-2.5 focus:outline-none focus:border-signal-orange font-mono"
                  />
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-3 border-t border-chalk">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2.5 border border-chalk text-carbon rounded-lg font-bold hover:bg-chalk transition-colors text-xs"
                >
                  HỦY BỎ
                </button>
                <button
                  type="submit"
                  className="px-4 py-2.5 bg-signal-orange text-white rounded-lg font-bold hover:bg-orange-600 transition-colors shadow-md text-xs"
                >
                  PHÁT HÀNH HÓA ĐƠN
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}
