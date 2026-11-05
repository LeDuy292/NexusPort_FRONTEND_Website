import expressApiClient from './expressApiClient'

export const yardSlotHistoryService = {
  /**
   * Tra cứu lịch sử Slot hoặc Container theo timeline.
   */
  async getHistory(params = {}) {
    const searchParams = new URLSearchParams()
    if (params.slotId) searchParams.set('slotId', params.slotId)
    if (params.slotCode) searchParams.set('slotCode', params.slotCode)
    if (params.block) searchParams.set('block', params.block)
    if (params.bay != null && params.bay !== '') searchParams.set('bay', params.bay)
    if (params.row != null && params.row !== '') searchParams.set('row', params.row)
    if (params.tier != null && params.tier !== '') searchParams.set('tier', params.tier)
    if (params.containerId) searchParams.set('containerId', params.containerId)
    if (params.containerNo) searchParams.set('containerNo', params.containerNo)
    if (params.search) searchParams.set('search', params.search)
    if (params.dateFrom) searchParams.set('dateFrom', params.dateFrom)
    if (params.dateTo) searchParams.set('dateTo', params.dateTo)
    if (params.order) searchParams.set('order', params.order)
    if (params.page) searchParams.set('page', params.page)
    if (params.limit) searchParams.set('limit', params.limit)

    const queryStr = searchParams.toString() ? `?${searchParams.toString()}` : ''
    const res = await expressApiClient.get(`/yard/slots/history${queryStr}`)
    return res.data
  },

  /**
   * Tải file CSV lịch sử làm bằng chứng (có UTF-8 BOM hiển thị chuẩn trên Excel).
   */
  async exportCsv(params = {}) {
    const searchParams = new URLSearchParams()
    if (params.slotId) searchParams.set('slotId', params.slotId)
    if (params.slotCode) searchParams.set('slotCode', params.slotCode)
    if (params.block) searchParams.set('block', params.block)
    if (params.containerNo) searchParams.set('containerNo', params.containerNo)
    if (params.search) searchParams.set('search', params.search)

    const token = (() => {
      try {
        const stored = localStorage.getItem('user') || sessionStorage.getItem('user')
        return stored ? JSON.parse(stored)?.token : null
      } catch {
        return null
      }
    })()

    const queryStr = searchParams.toString() ? `?${searchParams.toString()}` : ''
    const response = await fetch(`/api/yard/slots/history/export${queryStr}`, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }
    })

    if (!response.ok) {
      throw new Error('Không thể xuất dữ liệu lịch sử.')
    }

    const blob = await response.blob()
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const timestamp = new Date().toISOString().slice(0, 10)
    const suffix = params.containerNo || params.slotCode || 'export'
    a.download = `lich_su_vi_tri_bai_${suffix}_${timestamp}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    window.URL.revokeObjectURL(url)
  }
}

export default yardSlotHistoryService

