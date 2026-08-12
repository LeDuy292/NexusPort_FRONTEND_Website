import React, { useState, useEffect } from 'react'

const invoicesData = [
  {
    id: 'INV-0042',
    status: 'Unpaid',
    statusTag: 'Thanh toán ngay',
    dueDate: '24/10/2024',
    issuedDate: '10/10/2024',
    amount: 4250.00,
    items: [
      { desc: 'Lưu bãi Container (TEU)', qty: '14 ngày', rate: 50.00, total: 700.00 },
      { desc: 'Vận hành Cẩu bốc dỡ nặng', qty: '4.5 giờ', rate: 600.00, total: 2700.00 },
      { desc: 'Cấp điện Container lạnh (Reefer)', qty: '5 ngày', rate: 120.00, total: 600.00 },
      { desc: 'Phụ phí bảo vệ môi trường cảng', qty: 'Cố định', rate: 'Fixed', total: 250.00 },
    ]
  },
  {
    id: 'INV-0041',
    status: 'Overdue',
    statusTag: 'Quá hạn',
    dueDate: '10/10/2024',
    issuedDate: '26/09/2024',
    amount: 8200.00,
    items: [
      { desc: 'Hạ bãi Container quá khổ', qty: '20 ngày', rate: 100.00, total: 2000.00 },
      { desc: 'Dịch vụ kẹp trì & niêm phong Hải quan', qty: '12 lượt', rate: 150.00, total: 1800.00 },
      { desc: 'Vận chuyển nội bộ xe đầu kéo', qty: '8 chuyến', rate: 550.00, total: 4400.00 },
    ]
  },
  {
    id: 'INV-0040',
    status: 'Paid',
    statusTag: 'Đã thanh toán',
    dueDate: '01/10/2024',
    issuedDate: '15/09/2024',
    amount: 3100.00,
    items: [
      { desc: 'Phí lưu cầu bến bốc dỡ', qty: '2 ngày', rate: 1000.00, total: 2000.00 },
      { desc: 'Cân tải trọng tự động Trạm Gate A', qty: '11 xe', rate: 100.00, total: 1100.00 },
    ]
  }
]

export default function BillingPayment() {
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('INV-0042')
  const [filter, setFilter] = useState('All')
  const [paymentMethod, setPaymentMethod] = useState('qr')
  const [qrTimer, setQrTimer] = useState(299) // 04:59 in seconds
  const [toastMessage, setToastMessage] = useState('')

  const selectedInvoice = invoicesData.find(i => i.id === selectedInvoiceId) || invoicesData[0]

  // QR Timer Countdown Effect
  useEffect(() => {
    const timer = setInterval(() => {
      setQrTimer(prev => (prev > 0 ? prev - 1 : 299))
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  const formatQrTime = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0')
    const s = Math.floor(secs % 60).toString().padStart(2, '0')
    return `${m}:${s}`
  }

  const filteredInvoices = invoicesData.filter(inv => {
    if (filter === 'All') return true
    return inv.status.toLowerCase() === filter.toLowerCase()
  })

  const totalUnpaid = invoicesData
    .filter(i => i.status !== 'Paid')
    .reduce((sum, i) => sum + i.amount, 0)

  const handlePay = () => {
    setToastMessage(`🎉 Đã khởi tạo thanh toán cho hóa đơn ${selectedInvoice.id} thành công!`)
    setTimeout(() => setToastMessage(''), 3000)
  }

  return (
    <div className="p-8 w-full font-sans flex flex-col gap-6 relative">
      
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-24 right-8 bg-[#202020] text-white px-6 py-3 rounded-xl shadow-2xl text-xs font-bold flex items-center gap-3 z-50 animate-bounce border border-signal-orange">
          <span className="text-signal-orange">●</span>
          {toastMessage}
        </div>
      )}

      {/* Header */}
      <div>
        <h2 className="font-heading text-4xl text-primary font-bold">Thanh toán & Cước phí Cảng</h2>
        <p className="text-sm text-slate mt-1">Quản lý hóa đơn dịch vụ cảng biển, hạ bãi, cẩu nâng và quét mã VietQR thanh toán tự động.</p>
      </div>

      {/* Billing Layout (Left 35% Invoice List / Right 65% Invoice Detail) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* LEFT 35%: INVOICE LIST */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          
          {/* Filter Pills */}
          <div className="flex gap-2 overflow-x-auto pb-1 text-xs font-bold">
            {['All', 'Unpaid', 'Paid', 'Overdue'].map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-full transition-colors ${
                  filter === f ? 'bg-carbon text-white shadow-sm' : 'border border-chalk text-graphite hover:border-carbon'
                }`}
              >
                {f === 'All' ? 'Tất cả' : f === 'Unpaid' ? 'Chưa trả' : f === 'Paid' ? 'Đã trả' : 'Quá hạn'}
              </button>
            ))}
          </div>

          {/* Unpaid Banner */}
          <div className="bg-white rounded-xl p-6 border border-chalk border-l-4 border-l-signal-orange shadow-sm flex justify-between items-center">
            <div>
              <p className="text-xs text-graphite font-bold uppercase mb-1">Tổng nợ chưa thanh toán</p>
              <p className="font-heading text-3xl font-bold text-carbon">${totalUnpaid.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
            </div>
            <button
              onClick={() => {
                setToastMessage('💳 Đã mở cổng thanh toán gộp toàn bộ hóa đơn!')
                setTimeout(() => setToastMessage(''), 3000)
              }}
              className="bg-carbon text-white px-5 py-2.5 rounded-full text-xs font-bold hover:bg-black transition-colors shadow"
            >
              Trả tất cả
            </button>
          </div>

          {/* Invoice Cards Queue */}
          <div className="space-y-4">
            {filteredInvoices.map((inv) => {
              const isSelected = inv.id === selectedInvoiceId
              return (
                <div
                  key={inv.id}
                  onClick={() => setSelectedInvoiceId(inv.id)}
                  className={`bg-white rounded-xl p-5 border cursor-pointer transition-all relative overflow-hidden shadow-sm hover:shadow-md ${
                    isSelected ? 'border-2 border-carbon ring-1 ring-carbon/10' : 'border-chalk hover:border-slate'
                  } ${inv.status === 'Paid' ? 'opacity-70 bg-mist/50' : ''}`}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="font-bold text-carbon text-sm">{inv.id}</p>
                      <p className={`text-xs mt-0.5 ${inv.status === 'Overdue' ? 'text-signal-orange font-bold' : 'text-slate'}`}>
                        Hạn: {inv.dueDate}
                      </p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold ${
                      inv.status === 'Unpaid'
                        ? 'bg-carbon text-white'
                        : inv.status === 'Overdue'
                        ? 'bg-red-100 text-red-700 animate-pulse'
                        : 'bg-chalk text-slate'
                    }`}>
                      {inv.status === 'Unpaid' ? 'Chưa trả' : inv.status === 'Overdue' ? 'Quá hạn' : 'Đã trả'}
                    </span>
                  </div>

                  <p className="font-heading text-2xl font-bold text-carbon">
                    ${inv.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              )
            })}
          </div>
        </div>

        {/* RIGHT 65%: INVOICE DETAIL & VIETQR PAYMENT */}
        <div className="lg:col-span-8 bg-white rounded-xl border border-chalk shadow-sm p-8 space-y-8 relative overflow-hidden">
          
          {/* Watermark Background */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-45 text-8xl font-black text-fog select-none pointer-events-none opacity-40 uppercase">
            {selectedInvoice.status}
          </div>

          {/* Invoice Header */}
          <div className="flex justify-between items-start border-b border-chalk pb-6 relative z-10">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-heading text-2xl font-bold text-carbon">NexusPort</span>
                <span className="w-2 h-2 rounded-full bg-signal-orange"></span>
              </div>
              <p className="text-xs text-graphite leading-relaxed">
                Trung tâm Quản lý Vận hành Cảng biển NexusPort<br />
                Cầu cảng 4, Khu Công nghiệp Cảng Hải Phòng
              </p>
            </div>

            <div className="text-right">
              <h3 className="font-heading text-3xl font-bold text-carbon">{selectedInvoice.id}</h3>
              <p className="text-xs text-slate mt-1">
                Ngày phát hành: <strong className="text-carbon">{selectedInvoice.issuedDate}</strong><br />
                Hạn thanh toán: <strong className="text-carbon">{selectedInvoice.dueDate}</strong>
              </p>
            </div>
          </div>

          {/* Fee Table */}
          <div className="relative z-10 space-y-6">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-chalk text-slate font-bold uppercase text-[10px]">
                  <th className="pb-3">Hạng mục dịch vụ</th>
                  <th className="pb-3 text-right">Số lượng / Giờ</th>
                  <th className="pb-3 text-right">Đơn giá</th>
                  <th className="pb-3 text-right">Thành tiền</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-chalk">
                {selectedInvoice.items.map((item, idx) => (
                  <tr key={idx} className="hover:bg-fog/50">
                    <td className="py-3.5 font-bold text-carbon">{item.desc}</td>
                    <td className="py-3.5 text-right text-slate">{item.qty}</td>
                    <td className="py-3.5 text-right text-slate">
                      {typeof item.rate === 'number' ? `$${item.rate.toFixed(2)}` : item.rate}
                    </td>
                    <td className="py-3.5 text-right font-bold text-carbon">
                      ${item.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Total Calculation */}
            <div className="flex justify-end pt-4">
              <div className="w-full max-w-xs space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-chalk text-slate">
                  <span>Tạm tính (Subtotal)</span>
                  <span className="font-bold text-carbon">${selectedInvoice.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-chalk text-slate">
                  <span>Thuế VAT (0%)</span>
                  <span className="font-bold text-carbon">$0.00</span>
                </div>
                <div className="flex justify-between items-center py-3">
                  <span className="font-bold text-carbon text-sm">Tổng cộng tiền cước</span>
                  <span className="font-heading text-3xl font-bold text-carbon">
                    ${selectedInvoice.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Payment Section */}
          <div className="bg-fog rounded-xl p-6 relative z-10 space-y-6 border border-chalk">
            <h4 className="font-heading text-base font-bold text-carbon">Phương thức Thanh toán</h4>

            {/* Method Selectors */}
            <div className="grid grid-cols-3 gap-4 text-xs font-bold">
              <button
                onClick={() => setPaymentMethod('qr')}
                className={`py-3 px-4 rounded-xl border flex items-center justify-center gap-2 transition-all ${
                  paymentMethod === 'qr'
                    ? 'border-carbon bg-white text-carbon shadow-sm ring-1 ring-carbon'
                    : 'border-chalk text-graphite hover:border-carbon'
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">qr_code_scanner</span>
                Mã QR VietQR
              </button>

              <button
                onClick={() => setPaymentMethod('bank')}
                className={`py-3 px-4 rounded-xl border flex items-center justify-center gap-2 transition-all ${
                  paymentMethod === 'bank'
                    ? 'border-carbon bg-white text-carbon shadow-sm ring-1 ring-carbon'
                    : 'border-chalk text-graphite hover:border-carbon'
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">account_balance</span>
                Chuyển khoản Ngân hàng
              </button>

              <button
                onClick={() => setPaymentMethod('wallet')}
                className={`py-3 px-4 rounded-xl border flex items-center justify-center gap-2 transition-all ${
                  paymentMethod === 'wallet'
                    ? 'border-carbon bg-white text-carbon shadow-sm ring-1 ring-carbon'
                    : 'border-chalk text-graphite hover:border-carbon'
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">account_balance_wallet</span>
                Ví điện tử
              </button>
            </div>

            {/* QR Payment View */}
            {paymentMethod === 'qr' && (
              <div className="bg-white rounded-xl p-6 border border-chalk flex flex-col md:flex-row items-center gap-8 shadow-sm">
                
                {/* QR Display with Scanner Laser Line */}
                <div className="w-[180px] h-[180px] bg-mist rounded-xl border border-chalk p-3 flex items-center justify-center shrink-0 relative overflow-hidden shadow-inner">
                  <img
                    className="w-full h-full object-cover rounded"
                    alt="VietQR Code"
                    src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=NEXUSPORT_PAYMENT_INV0042"
                  />
                  {/* Laser Scan Animation Line */}
                  <div className="absolute top-0 left-0 w-full h-[2px] bg-signal-orange shadow-[0_0_8px_#ff682c] animate-pulse"></div>
                </div>

                <div className="flex-1 text-center md:text-left space-y-3">
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-fog rounded-full text-xs">
                    <span className="font-bold text-carbon">VietQR Chuyển khoản nhanh 24/7</span>
                    <span className="w-2 h-2 rounded-full bg-signal-orange animate-ping"></span>
                  </div>

                  <p className="text-xs text-graphite">Quét mã bằng ứng dụng Ngân hàng để thanh toán chính xác số tiền:</p>

                  <div className="font-heading text-3xl font-bold text-carbon">
                    ${selectedInvoice.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </div>

                  <div className="flex items-center justify-center md:justify-start gap-2 text-graphite text-xs bg-fog py-2 px-4 rounded-lg inline-flex">
                    <span className="material-symbols-outlined text-[18px]">timer</span>
                    Mã QR hết hạn trong: <strong className="text-signal-orange font-mono font-bold">{formatQrTime(qrTimer)}</strong>
                  </div>

                  <div className="pt-2">
                    <button
                      onClick={handlePay}
                      className="h-11 px-8 bg-signal-orange text-white rounded-lg text-xs font-bold hover:opacity-90 transition-opacity shadow-md"
                    >
                      Xác nhận đã chuyển tiền
                    </button>
                  </div>
                </div>

              </div>
            )}

            {/* Bank Transfer View */}
            {paymentMethod === 'bank' && (
              <div className="bg-white rounded-xl p-6 border border-chalk space-y-3 text-xs">
                <h5 className="font-bold text-carbon text-sm">Thông tin tài khoản Chuyển khoản Ngân hàng:</h5>
                <div className="p-4 bg-fog rounded-lg space-y-2 font-mono text-carbon">
                  <div>Tên tài khoản: <strong>CÔNG TY CP CẢNG BIỂN SMART NEXUSPORT</strong></div>
                  <div>Số tài khoản: <strong className="text-signal-orange">9988 1234 5678 (Vietcombank)</strong></div>
                  <div>Nội dung chuyển khoản: <strong className="text-signal-orange">THANH TOAN {selectedInvoice.id}</strong></div>
                </div>
              </div>
            )}

            {/* Wallet View */}
            {paymentMethod === 'wallet' && (
              <div className="bg-white rounded-xl p-6 border border-chalk text-center text-xs space-y-3">
                <span className="material-symbols-outlined text-3xl text-signal-orange">account_balance_wallet</span>
                <p className="font-bold text-carbon">Kết nối ví điện tử MoMo / ZaloPay / ShopeePay để thanh toán tự động.</p>
              </div>
            )}

          </div>

        </div>

      </div>

    </div>
  )
}
