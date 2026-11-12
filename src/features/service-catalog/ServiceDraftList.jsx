import { useEffect, useId, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight, ClipboardList, Container, FileText, Loader2, Pencil, Plus, RefreshCw, Search, ShieldCheck, X } from 'lucide-react'
import CatalogDialog from './CatalogDialog'
import { money } from './catalogApi'
import { draftDateTime, draftError, draftSession, serviceDraftKey, serviceDraftsApi } from './serviceDraftsApi'
import { orderStatusLabels } from './serviceOrdersApi'

export default function ServiceDraftList({ onCreate, onEdit, onReview, onClose }) {
  const id = useId()
  const [search, setSearch] = useState('')
  const [term, setTerm] = useState('')
  const [page, setPage] = useState(1)
  useEffect(() => { const timer = setTimeout(() => { setTerm(search); setPage(1) }, 250); return () => clearTimeout(timer) }, [search])
  const query = useQuery({ queryKey: [...serviceDraftKey, draftSession(), 'list', term, page], queryFn: () => serviceDraftsApi.list({ search: term || undefined, page, pageSize: 10 }), retry: false })
  const total = query.data?.total || 0
  const pages = Math.max(1, Math.ceil(total / 10))
  return <CatalogDialog className="epd-dialog epd-list-dialog" labelledBy={`${id}-title`} describedBy={`${id}-description`} onClose={onClose}>
    <header className="epd-header"><div><span className="epc-eyebrow">NEXUSPORT / HỒ SƠ DỊCH VỤ</span><h2 id={`${id}-title`} tabIndex={-1} data-dialog-initial-focus>Hồ sơ của tôi</h2><p id={`${id}-description`}>Tiếp tục bản nháp, kiểm tra phí và theo dõi hồ sơ đã xác nhận của công ty.</p></div><button type="button" className="epc-icon-button" aria-label="Đóng danh sách hồ sơ" onClick={onClose}><X size={21} /></button></header>
    <div className="epd-list-toolbar"><label className="epd-search"><Search size={17} /><input aria-label="Tìm hồ sơ dịch vụ" value={search} onChange={event => setSearch(event.target.value)} placeholder="Tìm mã hồ sơ hoặc dịch vụ…" /></label><button type="button" className="epc-button primary" onClick={onCreate}><Plus size={16} />Tạo đăng ký</button></div>
    <div className="epd-body epd-list-body">
      {query.isPending ? <div className="epd-loading" role="status"><Loader2 className="epc-spin" size={22} />Đang tải hồ sơ…</div> : query.isError ? <div className="epd-empty"><FileText size={32} /><h3>Chưa tải được hồ sơ</h3><p>{draftError(query.error)}</p><button type="button" className="epc-button secondary" onClick={() => query.refetch()}><RefreshCw size={15} />Thử lại</button></div> : !query.data?.items?.length ? <div className="epd-empty"><span className="epd-empty-icon"><ClipboardList size={31} /></span><h3>{term ? 'Không tìm thấy hồ sơ phù hợp' : 'Bắt đầu hồ sơ dịch vụ đầu tiên'}</h3><p>{term ? 'Thử mã hồ sơ hoặc từ khóa khác.' : 'Chọn dịch vụ, hồ sơ nguồn và container. Bạn có thể lưu nháp để tiếp tục sau.'}</p><button type="button" className="epc-button secondary" onClick={term ? () => setSearch('') : onCreate}>{term ? <Search size={16} /> : <Plus size={16} />}{term ? 'Xóa tìm kiếm' : 'Tạo đăng ký dịch vụ'}</button></div> : <div className="epd-draft-list">{query.data.items.map(draft => {
        const registered = !!draft.registrationId
        const editable = draft.status === 'DRAFT'
        const pending = draft.status === 'PENDING_APPROVAL'
        return <article className="epd-draft-card" key={draft.id}>
          <button type="button" className="epd-draft-open" onClick={() => editable ? onEdit(draft.id) : onReview(draft.id)} aria-haspopup="dialog"><span className={`epd-draft-icon ${draft.flow === 'IMPORT' ? 'blue' : ''}`}><ClipboardList size={23} /></span><span className="epd-draft-card-main"><small>{draft.registrationNumber || draft.number}</small><strong>{draft.mainServiceName || 'Đăng ký dịch vụ chưa chọn dịch vụ chính'}</strong><span><FileText size={13} />{draft.sourceLabel || 'Chưa chọn hồ sơ nguồn'}</span><span className="epd-draft-card-meta"><span><Container size={13} />{draft.containerCount} container</span><span>{draft.flow === 'IMPORT' ? 'Hàng nhập' : 'Hàng xuất'}</span><time dateTime={draft.updatedAt}>Cập nhật {draftDateTime(draft.updatedAt)}</time></span></span></button>
          <div className="epd-draft-card-end"><span className={`epd-status ${registered ? pending ? 'pending' : 'confirmed' : ''}`}>{orderStatusLabels[draft.status] || draft.status}</span>{registered && draft.total != null && <strong className="epr-list-total">{money(draft.total)}</strong>}<div className="epd-draft-card-actions">{editable && <button type="button" className="epc-button secondary" onClick={() => onEdit(draft.id)}><Pencil size={13} />Sửa nháp</button>}<button type="button" className="epc-button secondary" onClick={() => onReview(draft.id)}>{editable ? <ShieldCheck size={14} /> : <FileText size={14} />}{editable ? 'Kiểm tra & xác nhận' : registered ? 'Xem đăng ký' : 'Xem hồ sơ'}</button></div></div>
        </article>
      })}</div>}
    </div>
    <footer className="epd-footer"><span className="epd-list-count">{query.isPending ? 'Đang tải…' : `${total} hồ sơ`}</span><div><button type="button" className="epc-icon-button" aria-label="Trang hồ sơ trước" disabled={page <= 1 || query.isFetching} onClick={() => setPage(previous => previous - 1)}><ArrowLeft size={17} /></button><span className="epd-pagination">{page} / {pages}</span><button type="button" className="epc-icon-button" aria-label="Trang hồ sơ tiếp theo" disabled={page >= pages || query.isFetching} onClick={() => setPage(previous => previous + 1)}><ArrowRight size={17} /></button><button type="button" className="epc-button secondary" onClick={onClose}>Đóng</button></div></footer>
  </CatalogDialog>
}
