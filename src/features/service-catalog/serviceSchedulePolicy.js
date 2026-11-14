export const localTime = value => {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

/**
 * Tính toán tự động ngày giao nhận / lấy hàng container:
 * - Xuất khẩu (EXPORT): Tự động chọn TRƯỚC ngày xuất (ngày tàu rời bến / ETD hoặc CY Cut-off)
 * - Nhập khẩu (IMPORT): Tự động chọn SAU ngày tàu tới (ETA / ngày tàu cập bến dỡ hàng)
 */
export function computeAutoSchedule({ flow, booking, edoItem, source }) {
  const now = new Date()

  if (flow === 'EXPORT') {
    const target = booking || source || {}
    const etdVal = target.etd || target.departureDate
    const cutoffVal = target.cyCutoff || target.validUntil
    const receiveVal = target.receiveFrom

    let candidateDate = null
    let refLabel = ''

    // Hàng xuất: Ưu tiên tuyệt đối mốc CY Cut-off (giờ cắt máng cổng cảng)
    if (cutoffVal) {
      const cutoff = new Date(cutoffVal)
      if (!Number.isNaN(cutoff.getTime())) {
        // Chọn trước giờ cắt máng CY Cut-off 24 tiếng (lúc 08:00 sáng)
        candidateDate = new Date(cutoff.getTime() - 24 * 3600000)
        candidateDate.setHours(8, 0, 0, 0)
        if (candidateDate.getTime() > cutoff.getTime() - 4 * 3600000) {
          candidateDate = new Date(cutoff.getTime() - 4 * 3600000)
        }
        refLabel = `trước giờ cắt máng CY Cut-off (${cutoff.toLocaleDateString('vi-VN')})`
      }
    } else if (etdVal) {
      const etd = new Date(etdVal)
      if (!Number.isNaN(etd.getTime())) {
        candidateDate = new Date(etd.getTime() - 24 * 3600000)
        candidateDate.setHours(8, 0, 0, 0)
        refLabel = `trước ngày tàu rời bến (${etd.toLocaleDateString('vi-VN')})`
      }
    }

    // Đảm bảo không trước ngày cảng mở bãi tiếp nhận (receiveFrom)
    if (receiveVal) {
      const receive = new Date(receiveVal)
      if (!Number.isNaN(receive.getTime()) && candidateDate && candidateDate < receive) {
        candidateDate = new Date(receive.getTime())
        candidateDate.setHours(8, 0, 0, 0)
        if (candidateDate < receive) candidateDate = new Date(receive.getTime() + 3600000)
      }
    }

    // Đảm bảo không vượt quá CY Cut-off
    if (cutoffVal) {
      const cutoff = new Date(cutoffVal)
      if (!Number.isNaN(cutoff.getTime()) && candidateDate && candidateDate >= cutoff) {
        candidateDate = new Date(cutoff.getTime() - 4 * 3600000)
      }
    }

    // Nếu không có mốc hoặc ngày tính ra đã qua trong quá khứ -> lấy ngày mai 08:00 sáng
    if (!candidateDate || candidateDate.getTime() <= now.getTime()) {
      candidateDate = new Date(now.getTime() + 24 * 3600000)
      candidateDate.setHours(8, 0, 0, 0)
      if (cutoffVal) {
        const cutoff = new Date(cutoffVal)
        if (!Number.isNaN(cutoff.getTime()) && candidateDate >= cutoff) {
          candidateDate = new Date(cutoff.getTime() - 2 * 3600000)
        }
      }
    }

    const maxLimit = cutoffVal ? new Date(cutoffVal) : (etdVal ? new Date(etdVal) : null)
    const minLimit = receiveVal ? new Date(Math.max(now.getTime(), new Date(receiveVal).getTime())) : now

    return {
      plannedAt: localTime(candidateDate.toISOString()),
      minDate: localTime(minLimit.toISOString()),
      maxDate: maxLimit ? localTime(maxLimit.toISOString()) : '',
      notice: `Hệ thống tự động chọn ngày ${refLabel || 'trước ngày tàu xuất'} để hạ bãi container kịp giờ.`,
    }
  } else {
    // NHẬP KHẨU: Tự động chọn SAU ngày tàu tới (ETA / tàu cập bến)
    const target = edoItem || source || {}
    const etaVal = target.eta || target.arrivalDate || target.startedAt
    const validUntilVal = target.validUntil

    let candidateDate = null
    let refLabel = ''

    if (etaVal) {
      const eta = new Date(etaVal)
      if (!Number.isNaN(eta.getTime())) {
        // Chọn sau ngày tàu tới 1 ngày (đảm bảo cont đã cẩu dỡ lên bãi), lúc 08:00 sáng
        candidateDate = new Date(eta.getTime() + 24 * 3600000)
        candidateDate.setHours(8, 0, 0, 0)
        refLabel = `sau ngày tàu tới (${eta.toLocaleDateString('vi-VN')})`
      }
    }

    // Nếu tàu đã cập cảng trong quá khứ hoặc chưa có mốc ETA -> chọn ngày mai lúc 08:00 sáng
    if (!candidateDate || candidateDate.getTime() <= now.getTime()) {
      candidateDate = new Date(now.getTime() + 24 * 3600000)
      candidateDate.setHours(8, 0, 0, 0)
      if (!refLabel) refLabel = 'sau khi tàu đã cập bến dỡ bãi'
    }

    // Đảm bảo không vượt quá hạn lệnh giao nhận (eDO validUntil)
    if (validUntilVal) {
      const validUntil = new Date(validUntilVal)
      if (!Number.isNaN(validUntil.getTime()) && candidateDate > validUntil) {
        candidateDate = new Date(validUntil.getTime())
        candidateDate.setHours(8, 0, 0, 0)
      }
    }

    const minLimit = etaVal ? new Date(Math.max(now.getTime(), new Date(etaVal).getTime())) : now
    const maxLimit = validUntilVal ? new Date(validUntilVal) : null

    return {
      plannedAt: localTime(candidateDate.toISOString()),
      minDate: localTime(minLimit.toISOString()),
      maxDate: maxLimit ? localTime(maxLimit.toISOString()) : '',
      notice: `Hệ thống tự động chọn ngày ${refLabel} để đảm bảo container đã dỡ xuống bãi sẵn sàng giao nhận.`,
    }
  }
}
