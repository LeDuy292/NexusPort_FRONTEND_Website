/**
 * Chuyển trạng thái nội bộ của bản khai thành cách nói người dùng hiểu:
 * tên trạng thái theo ngữ cảnh (chiều xuất/nhập) và việc cần làm tiếp theo.
 * Không hiển thị mã backend (PORT_APPROVED, DISCHARGING...) ra giao diện.
 */
const VIEWS = {
  DRAFT: () => ({ label: 'Bản nháp', hint: 'Hoàn tất bản khai rồi gửi cho cảng', tone: 'amber' }),
  VALIDATED: () => ({ label: 'Chưa gửi cảng', hint: 'Kiểm tra lần cuối rồi gửi cho cảng', tone: 'blue' }),
  SENT_TO_PORT: () => ({ label: 'Chờ cảng duyệt', hint: 'Đã gửi cảng, chưa cần thao tác thêm', tone: 'blue' }),
  PORT_APPROVED: (direction) => (direction === 'EXPORT'
    ? { label: 'Cảng đã duyệt', hint: 'Cảng nhận container theo bản khai này', tone: 'green' }
    : { label: 'Chờ tàu cập, dỡ hàng', hint: 'Cảng đã duyệt, chờ tàu cập và dỡ container', tone: 'green' }),
  DISCHARGING: () => ({ label: 'Cảng đang dỡ hàng', hint: 'Theo dõi số container đã dỡ', tone: 'purple' }),
  DISCHARGED: () => ({ label: 'Đã dỡ xong', hint: 'Có thể đối soát với cảng', tone: 'green' }),
  RECONCILED: () => ({ label: 'Đã đối soát', hint: 'Số liệu khớp với cảng', tone: 'green' }),
  EXCEPTION: () => ({ label: 'Có ngoại lệ', hint: 'Xử lý các dòng lỗi trước khi gửi cảng', tone: 'red' }),
  COMPLETED: () => ({ label: 'Hoàn tất', hint: '', tone: 'green' }),
}

export function manifestStatusView(manifest) {
  const make = VIEWS[manifest?.status]
  if (!make) return { label: 'Đang cập nhật', hint: '', tone: 'slate' }
  return make(manifest.direction)
}
