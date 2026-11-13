import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { shippingLineApi, formatApiErrorMessage } from './api/shippingLineApi'
import ManifestComposer from './components/ManifestComposer'
import ManifestImportDialog from './components/ManifestImportDialog'
import ManifestDrilldown from './components/ManifestDrilldown'
import ShippingBadge from './components/ShippingBadge'
import ShippingPagination from './components/ShippingPagination'
import { readManifestComposerSession } from './utils/manifestComposerSession'
import { formatManifestDate, manifestCounts } from './utils/manifestView'
import { manifestPortSyncService } from '../../services/manifestPortSyncService'

export default function ManifestManagementPage() {
  const [params, setParams] = useSearchParams()
  const manifestId = params.get('manifest') || ''
  const billNumber = params.get('bill') || ''
  const containerNumber = params.get('container') || ''
  const activeTab = manifestId ? 'DETAIL' : 'LIST'
  const [allManifests, setAllManifests] = useState([])
  const [voyages, setVoyages] = useState([])
  const [selectedManifest, setSelectedManifest] = useState(null)
  const [directionFilter, updateDirectionFilter] = useState('')
  const [requestedManifestPage, setManifestPage] = useState(1)
  const [manifestPageSize, setManifestPageSize] = useState(5)
  const [refresh, setRefresh] = useState(0)
  const [loadingList, setLoadingList] = useState(true)
  const [loadingDetail, setLoadingDetail] = useState(Boolean(manifestId))
  const [lastLoadedAt, setLastLoadedAt] = useState(null)
  const [acting, setActing] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [resumeSession, setResumeSession] = useState(readManifestComposerSession)
  const [showCreateModal, setShowCreateModal] = useState(() => Boolean(readManifestComposerSession()))
  const [editingDraft, setEditingDraft] = useState(() => readManifestComposerSession()?.initialManifest || null)
  const [showImport, setShowImport] = useState(false)
  const [importedManifest, setImportedManifest] = useState(null)
  const manifests = useMemo(() => allManifests.filter(m => !directionFilter || m.direction === directionFilter), [allManifests, directionFilter])
  const manifestPage = Math.min(requestedManifestPage, Math.max(1, Math.ceil(manifests.length / manifestPageSize)))
  const loading = loadingList || loadingDetail
  const setDirectionFilter = value => { updateDirectionFilter(value); setManifestPage(1) }
  const loadData = () => setRefresh(value => value + 1)
  const goTo = useCallback((id = '', bill = '', container = '') => {
    const next = new URLSearchParams()
    if (id) next.set('manifest', id)
    if (bill) next.set('bill', bill)
    if (container) next.set('container', container)
    setParams(next)
  }, [setParams])
  const handleSelectManifest = manifest => { setError(''); goTo(manifest.id) }
  const handleOpenCreateModal = () => { setResumeSession(null); setEditingDraft(null); setImportedManifest(null); setShowCreateModal(true) }

  useEffect(() => {
    let cancelled = false
    setLoadingList(true)
    setError('')
    Promise.allSettled([shippingLineApi.getManifests(), shippingLineApi.getVoyages()]).then(([manifestResult, voyageResult]) => {
      if (cancelled) return
      const messages = []
      if (manifestResult.status === 'fulfilled') {
        const rows = Array.isArray(manifestResult.value) ? manifestResult.value : manifestResult.value?.data || []
        setAllManifests(rows)
        setLastLoadedAt(new Date().toISOString())
      } else messages.push(formatApiErrorMessage(manifestResult.reason, 'Không thể tải danh sách bản khai.'))
      if (voyageResult.status === 'fulfilled') setVoyages(Array.isArray(voyageResult.value) ? voyageResult.value : voyageResult.value?.data || [])
      else messages.push(formatApiErrorMessage(voyageResult.reason, 'Không thể tải chuyến tàu.'))
      setError(messages.join(' '))
      setLoadingList(false)
    })
    return () => { cancelled = true }
  }, [refresh])

  useEffect(() => {
    if (!manifestId) { setSelectedManifest(null); setLoadingDetail(false); return }
    let cancelled = false
    setSelectedManifest(null)
    setLoadingDetail(true)
    setError('')
    shippingLineApi.getManifestDetail(manifestId).then(result => {
      if (!cancelled) setSelectedManifest(result?.manifestNumber ? result : result?.data || null)
    }).catch(e => { if (!cancelled) setError(formatApiErrorMessage(e, 'Không thể tải chi tiết bản khai.')) })
      .finally(() => { if (!cancelled) setLoadingDetail(false) })
    return () => { cancelled = true }
  }, [manifestId, refresh])

  const sendManifest = async () => {
    if (!selectedManifest || acting) return
    setActing(true); setError(''); setSuccessMsg('')
    try {
      let result
      try { result = await shippingLineApi.sendManifestToPort(selectedManifest.id) }
      catch (e) { if (selectedManifest.source === 'NODE_CORE') throw e; result = await shippingLineApi.reconcileManifest(selectedManifest.id) }
      const sentToPortAt = result?.sentToPortAt || result?.data?.sentToPortAt || new Date().toISOString()
      manifestPortSyncService.saveSyncedManifest({ ...selectedManifest, sentToPortAt, status: 'SENT_TO_PORT' })
      setSuccessMsg('Đã gửi bản khai cho cảng.')
      loadData()
    } catch (e) { setError(formatApiErrorMessage(e, 'Không thể gửi bản khai.')) }
    finally { setActing(false) }
  }
  const recallManifest = async () => {
    if (!selectedManifest || acting) return
    setActing(true); setError(''); setSuccessMsg('')
    try {
      if (selectedManifest.source === 'NODE_CORE') await shippingLineApi.recallManifest(selectedManifest.id)
      manifestPortSyncService.recallManifestFromPort(selectedManifest.id)
      setSuccessMsg('Đã thu hồi bản khai.')
      loadData()
    } catch (e) { setError(formatApiErrorMessage(e, 'Không thể thu hồi bản khai.')) }
    finally { setActing(false) }
  }
  return (
    <div aria-busy={loading} className="p-4 md:p-6 lg:p-8 w-full max-w-7xl mx-auto font-sans flex flex-col gap-6 bg-slate-50 min-h-screen">
      
      {/* ── 1. HEADER CHUẨN NEXUSPORT ── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white border border-chalk rounded-2xl p-5 shadow-sm gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-extrabold bg-orange-100 text-orange-800 px-3 py-0.5 rounded-full uppercase">
              HÃNG TÀU &amp; VẬN TẢI BIỂN
            </span>
            <span className="text-xs font-mono text-slate">NexusPort · Cảng Tiên Sa, Đà Nẵng (VNDAD)</span>
          </div>
          <h2 className="font-heading text-2xl md:text-3xl font-extrabold text-carbon">
            Quản Lý Bản Khai Hàng Hóa
          </h2>
          <p className="text-xs text-slate mt-0.5">
            Xem bản khai, vận đơn và thông tin hàng hóa theo từng bước.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {activeTab !== 'LIST' && (
            <button
              onClick={() => goTo()}
              className="px-3.5 py-2 text-xs font-bold text-carbon bg-fog hover:bg-chalk border border-chalk rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm">arrow_back</span>
              Danh sách bản khai
            </button>
          )}

          <button type="button" onClick={() => setShowImport(true)} className="flex items-center gap-1.5 rounded-xl border border-orange-200 bg-white px-4 py-2 text-xs font-bold text-signal-orange hover:bg-orange-50">
            <span className="material-symbols-outlined text-base">upload_file</span>Import Excel
          </button>
          <button
            onClick={handleOpenCreateModal}
            className="px-4 py-2 text-xs font-bold text-white bg-signal-orange hover:opacity-90 rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <span className="material-symbols-outlined text-base">add</span>
            Tạo Bản Khai Mới
          </button>

          <button
            onClick={loadData}
            title="Tải lại dữ liệu"
            className="w-9 h-9 bg-white border border-chalk rounded-xl flex items-center justify-center text-slate hover:text-carbon hover:bg-fog shadow-sm transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-lg">refresh</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex justify-between items-center shadow-xs">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-red-600 font-bold px-2 cursor-pointer">✕</button>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs flex justify-between items-center shadow-xs">
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg('')} className="text-emerald-700 font-bold px-2 cursor-pointer">✕</button>
        </div>
      )}

      {/* ── 2. VIEW: DANH SÁCH BẢN KHAI MANIFEST ── */}
      {activeTab === 'LIST' && (
        <div className="space-y-4">
          
          {/* Filter Bar */}
          <div className="p-4 bg-white rounded-2xl border border-chalk shadow-sm flex flex-col md:flex-row items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-3">
              <span className="text-slate uppercase text-[10px] font-bold">Hướng Khai Báo:</span>
              <div className="flex bg-fog p-1 rounded-xl border border-chalk text-xs font-bold">
                <button
                  onClick={() => setDirectionFilter('')}
                  className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                    directionFilter === '' ? 'bg-carbon text-white shadow-sm' : 'text-slate hover:text-carbon'
                  }`}
                >
                  Tất cả ({allManifests.length})
                </button>
                <button
                  onClick={() => setDirectionFilter('EXPORT')}
                  className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                    directionFilter === 'EXPORT' ? 'bg-carbon text-white shadow-sm' : 'text-slate hover:text-carbon'
                  }`}
                >
                  Xuất khẩu
                </button>
                <button
                  onClick={() => setDirectionFilter('IMPORT')}
                  className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                    directionFilter === 'IMPORT' ? 'bg-carbon text-white shadow-sm' : 'text-slate hover:text-carbon'
                  }`}
                >
                  Nhập khẩu
                </button>
              </div>
            </div>

            <div className="text-xs text-slate font-mono">
              Tổng số: <strong className="text-carbon font-bold">{manifests.length}</strong> bản khai
            </div>
          </div>

          {/* Table Bản khai */}
          <div className="bg-white border border-chalk rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex justify-between items-center border-b border-chalk pb-3">
              <div>
                <h3 className="font-heading text-lg font-extrabold text-carbon">
                  Danh Sách Bản Khai Hàng Hóa Tàu Biển
                </h3>
              </div>
              <span className="text-xs text-slate font-mono font-bold">{lastLoadedAt ? 'Cập nhật: ' + formatManifestDate(lastLoadedAt) : 'Đang tải…'}</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] border-collapse text-left text-xs [&_td]:align-middle [&_th]:align-middle">
                <thead>
                  <tr className="bg-fog text-slate font-bold uppercase text-[10px] border-b border-chalk">
                    <th className="py-3 px-3 w-32 whitespace-nowrap">Mã bản khai</th>
                    <th className="py-3 px-3 w-20 text-right whitespace-nowrap">Vận đơn</th>
                    <th className="py-3 px-3 w-28 whitespace-nowrap">Chuyến tàu</th>
                    <th className="py-3 px-3 w-28 whitespace-nowrap">Hướng khai</th>
                    <th className="py-3 px-3 w-28 text-right whitespace-nowrap">Số container</th>
                    <th className="py-3 px-3 w-32 whitespace-nowrap">Trạng thái</th>
                    <th className="py-3 px-3 w-36 whitespace-nowrap">Ngày tạo</th>
                    <th className="py-3 px-3 w-[132px] min-w-[132px] text-center whitespace-nowrap">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-chalk font-medium">
                  {!manifests.length && <tr><td colSpan={8} className="p-8 text-center font-sans text-slate">{loadingList ? 'Đang tải bản khai…' : 'Chưa có bản khai. Chọn “Tạo Bản Khai Mới” để bắt đầu.'}</td></tr>}
                  {manifests
                    .slice((manifestPage - 1) * manifestPageSize, manifestPage * manifestPageSize)
                    .map((mnf) => (
                    <tr key={mnf.id} className="hover:bg-fog/50 transition-colors">
                      <td className="py-3 px-3 font-mono font-bold text-carbon whitespace-nowrap">{mnf.manifestNumber}</td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums">{manifestCounts(mnf).bills}</td>
                      <td className="py-3 px-3 whitespace-nowrap"><span className="font-bold text-carbon">{mnf.voyageNumber}</span><span className="mt-1 block text-[11px] font-sans text-slate">{mnf.vesselName || '—'}</span></td>
                      <td className="py-3 px-3 font-sans whitespace-nowrap">
                        <span className={`inline-flex items-center whitespace-nowrap px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          mnf.direction === 'EXPORT' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                        }`}>
                          {mnf.direction === 'EXPORT' ? 'Xuất khẩu' : 'Nhập khẩu'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums text-carbon whitespace-nowrap">{manifestCounts(mnf).containers}</td>

                      <td className="py-3 px-3 font-sans whitespace-nowrap">
                        <ShippingBadge status={mnf.status} />
                      </td>
                      <td className="py-3 px-3 text-slate text-[11px] whitespace-nowrap">{formatManifestDate(mnf.createdAt || mnf.created_at)}</td>
                      <td className="py-3 px-3 text-center font-sans whitespace-nowrap">
                        <button
                          onClick={() => handleSelectManifest(mnf)}
                          className="inline-flex items-center whitespace-nowrap rounded-xl border border-orange-200 bg-orange-50 px-3 py-1.5 text-xs font-bold text-signal-orange transition-colors hover:bg-orange-100 cursor-pointer"
                        >
                          Chi tiết &rarr;
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Phân trang danh sách Bản khai */}
            <div className="-mx-6 -mb-6">
              <ShippingPagination
                currentPage={manifestPage}
                totalItems={manifests.length}
                pageSize={manifestPageSize}
                onPageChange={setManifestPage}
                onPageSizeChange={setManifestPageSize}
                itemName="bản khai"
              />
            </div>
          </div>

        </div>
      )}

      {activeTab === 'DETAIL' && <>
        <nav aria-label="Đường dẫn bản khai" className="flex flex-wrap items-center gap-2 text-xs text-slate">
          <button type="button" onClick={() => goTo()} className="font-bold hover:text-carbon">Danh sách bản khai</button><span aria-hidden="true">/</span>
          <button type="button" onClick={() => goTo(manifestId)} className="font-semibold hover:text-carbon" aria-current={!billNumber ? 'page' : undefined}>{selectedManifest?.manifestNumber || 'Bản khai'}</button>
          {billNumber && <><span aria-hidden="true">/</span><button type="button" onClick={() => goTo(manifestId, billNumber)} className="font-semibold hover:text-carbon" aria-current={!containerNumber ? 'page' : undefined}>B/L {billNumber}</button></>}
          {containerNumber && <><span aria-hidden="true">/</span><span aria-current="page" className="font-bold text-carbon">{containerNumber}</span></>}
        </nav>
        {loadingDetail && <div role="status" className="rounded-2xl border border-chalk bg-white p-8 text-sm text-slate">Đang tải chi tiết bản khai…</div>}
        {!loadingDetail && selectedManifest && <>
          {(billNumber || containerNumber) && <button type="button" className="self-start rounded-xl border border-chalk bg-white px-3.5 py-2 text-xs font-bold hover:bg-fog" onClick={() => goTo(manifestId, containerNumber ? billNumber : '')}>← {containerNumber ? 'Quay lại vận đơn' : 'Quay lại bản khai'}</button>}
          <ManifestDrilldown key={manifestId} manifest={selectedManifest} billNumber={billNumber} containerNumber={containerNumber}
            onBill={bill => goTo(manifestId, bill)} onContainer={container => goTo(manifestId, billNumber, container)}
            onEdit={() => { setResumeSession(null); setImportedManifest(null); setEditingDraft(selectedManifest); setShowCreateModal(true) }}
            onSend={sendManifest} onRecall={recallManifest} acting={acting} />
        </>}
        {!loadingDetail && !selectedManifest && <div className="rounded-2xl border border-chalk bg-white p-8 text-sm text-slate">Không tải được bản khai. Chọn tải lại hoặc quay về danh sách.</div>}
      </>}
      {showImport && <ManifestImportDialog onClose={() => setShowImport(false)} onReview={manifest => {
        setShowImport(false); setResumeSession(null); setEditingDraft(null); setImportedManifest(manifest); setShowCreateModal(true)
      }} />}
      {showCreateModal && <ManifestComposer voyages={voyages} initialManifest={editingDraft} importedManifest={importedManifest} resumeSession={resumeSession}
        onClose={() => { setShowCreateModal(false); setResumeSession(null); setImportedManifest(null) }} onSaved={document => {
          setShowCreateModal(false); setResumeSession(null); setImportedManifest(null)
          setSuccessMsg(document.status === 'DRAFT' ? 'Đã lưu bản khai nháp.' : 'Đã hoàn tất bản khai.')
          setDirectionFilter(''); goTo(); loadData()
        }} />}
    </div>
  )
}
