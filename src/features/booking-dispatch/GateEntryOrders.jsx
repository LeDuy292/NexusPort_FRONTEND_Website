import { useEffect, useState } from 'react'
import gateService from '../../services/gateService'
import { formatPlateNumber } from '../../utils/format'

const labels={pending_ack:'Chờ tài xế nhận lệnh',active:'Được phép vào cổng',expired:'Hết hạn',revoked:'Đã thu hồi',consumed:'Đã Gate In'}
export default function GateEntryOrders({onSelect}) {
  const [data,setData]=useState(null)
  const [error,setError]=useState('')
  useEffect(()=>{
    let active=true,busy=false
    const reload=async()=>{
      if(busy)return
      busy=true
      try {const next=await gateService.getEntryOrders();if(active){setData(next);setError('')}}
      catch(err){if(active)setError(err.message)}
      finally{busy=false}
    }
    void reload()
    const timer=setInterval(()=>{if(!document.hidden)void reload()},15000)
    return()=>{active=false;clearInterval(timer)}
  },[])
  return <section className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
    <h2 className="font-bold text-slate-900">Lệnh vào cổng từ điều độ</h2>
    <p className="text-xs text-slate-600">Tự cập nhật mỗi 15 giây. Nhận lệnh trên app để kích hoạt quyền vào cổng trong 15 phút.</p>
    {error&&<p role="alert" className="text-sm text-red-700">Không xác nhận được dữ liệu mới: {error}. Các lệnh đang hiển thị cần kiểm tra lại.</p>}
    {!data&&!error&&<p>Đang tải lệnh…</p>}
    {data&&!data.items?.length&&<p className="text-sm text-slate-500">Chưa có lệnh vào cổng trong 24 giờ qua.</p>}
    <div className="max-h-64 overflow-auto space-y-2">
      {data?.items?.map(order=><div key={order.id} className="flex flex-wrap items-center gap-3 border border-slate-200 rounded-lg p-3 text-sm">
        <strong>{formatPlateNumber(order.vehiclePlate)}</strong><span>{order.bookingCode} · {order.driverName}</span>
        <span className={order.status==='active'?'text-emerald-700 font-bold':'text-slate-600'}>{labels[order.status]||order.status}</span>
        <span className="text-xs text-slate-500">Hạn: {new Date(order.validUntil).toLocaleString('vi-VN')}</span>
        {onSelect&&order.status==='active'&&<button type="button" disabled={Boolean(error)} className="text-orange-700 font-bold disabled:opacity-40" onClick={()=>onSelect(order)}>Nhập xe này</button>}
      </div>)}
    </div>
  </section>
}
