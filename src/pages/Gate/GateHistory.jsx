import React, { useState, useMemo } from 'react'
import { gateHistoryData } from '../../data/gateOfficerData'

export default function GateHistory() {
  const [search, setSearch] = useState('')
  const [actionFilter, setActionFilter] = useState('All')
  const [resultFilter, setResultFilter] = useState('All')
  const [gateFilter, setGateFilter] = useState('All')
  const [selectedLog, setSelectedLog] = useState(null)

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return gateHistoryData.filter(log => {
      const matchQ = log.vehicle.toLowerCase().includes(q) || log.plate.toLowerCase().includes(q) ||
        log.driver.toLowerCase().includes(q) || log.container.toLowerCase().includes(q) ||
        (log.bookingId || '').toLowerCase().includes(q)
      const matchA = actionFilter === 'All' || log.action === actionFilter
      const matchR = resultFilter === 'All' || log.result === resultFilter
      const matchG = gateFilter === 'All' || log.gate === gateFilter
      return matchQ && matchA && matchR && matchG
    })
  }, [search, actionFilter, resultFilter, gateFilter])

  const resultBadge = (result) => {
    const map = {
      Passed:   'bg-green-100 text-green-900 border-green-300',
      Rejected: 'bg-red-100 text-red-900 border-red-300',
      Pending:  'bg-amber-100 text-amber-900 border-amber-300',
    }
    const icon = { Passed: '✓', Rejected: '✕', Pending: '⋯' }
    return (
      <span className={`px-2.5 py-0.5 rounded-full border text-[10px] font-extrabold inline-flex items-center gap-1 ${map[result] || 'bg-slate-100 text-slate-700 border-slate-300'}`}>
        <span>{icon[result] || '?'}</span>{result}
      </span>
    )
  }

  const actionBadge = (action) => (
    <span className={`px-2.5 py-0.5 rounded-full border text-[10px] font-extrabold font-mono ${
      action === 'CHECK-IN' ? 'bg-blue-100 text-blue-900 border-blue-300' : 'bg-slate-100 text-slate-800 border-slate-300'
    }`}>{action}</span>
  )

  const stats = {
    total: gateHistoryData.length,
    passed: gateHistoryData.filter(l => l.result === 'Passed').length,
    rejected: gateHistoryData.filter(l => l.result === 'Rejected').length,
    checkin: gateHistoryData.filter(l => l.action === 'CHECK-IN').length,
    checkout: gateHistoryData.filter(l => l.action === 'CHECK-OUT').length,
  }

  return (
    <div className="p-6 md:p-8 w-full font-sans flex flex-col gap-6 bg-slate-50 min-h-screen">

      {/* Header */}
      <div className="bg-white border border-chalk rounded-2xl p-5 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span className="text-xs font-extrabold bg-orange-100 text-orange-800 px-3 py-0.5 rounded-full uppercase">GATE OFFICER</span>
          <h2 className="font-heading text-3xl font-extrabold text-carbon mt-1">Gate History</h2>
          <p className="text-xs text-slate mt-0.5">Toàn bộ lịch sử kiểm soát xe ra vào cổng cảng hôm nay.</p>
        </div>
        <button className="h-10 px-4 border border-chalk text-slate rounded-xl font-extrabold text-xs hover:bg-fog flex items-center gap-1.5">
          <span className="material-symbols-outlined text-sm">download</span>Export CSV
        </button>
      </div>

      {/* KPI mini row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        {[
          ['Tổng', stats.total, 'text-carbon', 'border-chalk'],
          ['Passed', stats.passed, 'text-green-700', 'border-green-300'],
          ['Rejected', stats.rejected, 'text-red-700', 'border-red-300'],
          ['Check-in', stats.checkin, 'text-blue-700', 'border-blue-300'],
          ['Check-out', stats.checkout, 'text-slate-700', 'border-slate-300'],
        ].map(([label, val, color, border]) => (
          <div key={label} className={`bg-white rounded-2xl border-2 ${border} p-4 shadow-sm`}>
            <div className="text-[10px] font-bold text-slate uppercase">{label}</div>
            <div className={`text-3xl font-extrabold font-mono ${color}`}>{val}</div>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div className="bg-white border border-chalk rounded-2xl p-4 shadow-sm flex flex-col md:flex-row gap-3 items-center">
        <div className="relative w-full max-w-xs">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate text-sm">search</span>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Vehicle / container / driver / booking..."
            className="w-full pl-9 pr-4 py-2 bg-fog border border-chalk rounded-xl text-xs font-bold text-carbon placeholder:text-slate focus:outline-none focus:border-signal-orange" />
        </div>
        <div className="flex flex-wrap gap-2 text-xs font-bold">
          {[
            ['Action', actionFilter, setActionFilter, ['All', 'CHECK-IN', 'CHECK-OUT']],
            ['Result', resultFilter, setResultFilter, ['All', 'Passed', 'Rejected', 'Pending']],
            ['Gate', gateFilter, setGateFilter, ['All', 'Gate A', 'Gate B', 'Gate C']],
          ].map(([label, val, setter, opts]) => (
            <select key={label} value={val} onChange={e => setter(e.target.value)}
              className="px-3.5 py-2 bg-fog border border-chalk rounded-xl text-carbon focus:outline-none focus:border-signal-orange">
              {opts.map(o => <option key={o}>{o === 'All' ? `${label}: All` : o}</option>)}
            </select>
          ))}
          <span className="text-xs text-slate self-center">{filtered.length} bản ghi</span>
        </div>
      </div>

      {/* History Table */}
      <div className="bg-white rounded-2xl border border-chalk shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-fog border-b border-chalk text-slate font-bold uppercase text-[10px] tracking-wider">
                {['ID', 'Thời gian', 'Vehicle & Plate', 'Driver', 'Container', 'Gate', 'Action', 'Result', 'Booking ID', 'Chi tiết'].map(h => (
                  <th key={h} className={`py-3.5 px-4 whitespace-nowrap ${h === 'Chi tiết' ? 'text-right' : ''}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-chalk">
              {filtered.length === 0 ? (
                <tr><td colSpan="10" className="py-12 text-center text-slate font-bold text-sm">Không tìm thấy bản ghi phù hợp.</td></tr>
              ) : filtered.map(log => (
                <tr key={log.id} className="hover:bg-fog/70">
                  <td className="py-3 px-4 font-mono text-[11px] text-slate">{log.id}</td>
                  <td className="py-3 px-4 font-mono font-extrabold text-carbon">{log.time}</td>
                  <td className="py-3 px-4">
                    <div className="font-bold text-carbon">{log.vehicle}</div>
                    <div className="text-[10px] font-mono text-slate">{log.plate}</div>
                  </td>
                  <td className="py-3 px-4 font-bold text-carbon">{log.driver}</td>
                  <td className="py-3 px-4 font-mono text-carbon">{log.container}</td>
                  <td className="py-3 px-4 font-mono font-bold">{log.gate}</td>
                  <td className="py-3 px-4">{actionBadge(log.action)}</td>
                  <td className="py-3 px-4">{resultBadge(log.result)}</td>
                  <td className="py-3 px-4 font-mono text-signal-orange text-[11px]">{log.bookingId || '—'}</td>
                  <td className="py-3 px-4 text-right">
                    <button onClick={() => setSelectedLog(log)}
                      className="px-3 py-1.5 bg-carbon text-white rounded-lg font-extrabold text-[11px] hover:bg-black flex items-center gap-1 ml-auto">
                      <span className="material-symbols-outlined text-xs">visibility</span>View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Log Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 bg-carbon/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md max-h-[92vh] rounded-3xl p-7 shadow-2xl overflow-y-auto animate-in zoom-in-95 space-y-4">
            <div className="flex justify-between items-center border-b border-chalk pb-3">
              <div>
                <span className="text-[10px] font-extrabold text-signal-orange uppercase font-mono block">GATE LOG DETAIL</span>
                <h3 className="font-heading text-lg font-extrabold text-carbon font-mono">{selectedLog.id}</h3>
              </div>
              <button onClick={() => setSelectedLog(null)} className="w-8 h-8 rounded-full bg-fog border border-chalk flex items-center justify-center">
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              {[
                ['Thời gian', selectedLog.time], ['Gate', selectedLog.gate],
                ['Vehicle', selectedLog.vehicle], ['Biển số', selectedLog.plate],
                ['Driver', selectedLog.driver], ['Container', selectedLog.container],
                ['Booking ID', selectedLog.bookingId || '—'],
              ].map(([k, v]) => (
                <div key={k} className="bg-fog p-3 rounded-xl border border-chalk">
                  <div className="text-[10px] text-slate uppercase">{k}</div>
                  <div className="font-bold text-carbon">{v}</div>
                </div>
              ))}
            </div>
            <div className="flex gap-3 items-center">
              {actionBadge(selectedLog.action)}
              {resultBadge(selectedLog.result)}
            </div>
            {selectedLog.reason && (
              <div className="bg-red-50 border border-red-300 rounded-xl p-3 text-xs">
                <div className="font-extrabold text-red-900">Lý do từ chối:</div>
                <div className="text-red-800 mt-0.5">{selectedLog.reason}</div>
              </div>
            )}
            <button onClick={() => setSelectedLog(null)} className="w-full h-10 bg-carbon text-white rounded-xl font-extrabold text-xs">Đóng</button>
          </div>
        </div>
      )}
    </div>
  )
}
