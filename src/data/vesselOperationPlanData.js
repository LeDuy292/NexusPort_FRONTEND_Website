// ============================================================
// DỮ LIỆU KẾ HOẠCH XẾP DỠ TÀU CONTAINER (VESSEL OPERATION PLAN)
// NexusPort — Cảng Tiên Sa, Đà Nẵng
// ============================================================

export const INITIAL_OPERATION_PLAN = {
  vesselName: 'EVER GIVEN',
  imo: 'IMO9811000',
  berth: 'Cầu B-02',
  eta: '08:30',
  etd: '18:00',
  operationType: 'Dỡ Hàng (Discharging)',
  status: 'Draft', // 'Draft' | 'Validated' | 'Published' | 'In Progress' | 'Completed'
  
  // KPI
  totalContainers: 1247,
  plannedContainers: 1247,
  completedContainers: 0,
  remainingContainers: 1247,
  assignedCranesCount: 3,
  assignedYardTeamsCount: 2,

  // Cranes
  cranes: [
    { id: 'CR-01', crane: 'Cẩu Bờ QC-01', hatch: 'Hầm Tàu 01', range: 'MSCU001 - MSCU150', priority: 'Ưu Tiên Cao', moves: 150, status: 'Đã Lập Lịch' },
    { id: 'CR-02', crane: 'Cẩu Bờ QC-02', hatch: 'Hầm Tàu 02', range: 'MSCU151 - MSCU300', priority: 'Trung Bình', moves: 150, status: 'Đã Lập Lịch', conflict: true },
    { id: 'CR-03', crane: 'Cẩu Bờ QC-03', hatch: 'Hầm Tàu 03', range: 'MSCU301 - MSCU450', priority: 'Trung Bình', moves: 150, status: 'Đã Lập Lịch' },
  ],

  // Discharge Sequence
  sequence: [
    { seq: '01', containerId: 'MSCU1234567', type: '40HC', weight: '28 Tấn', hatch: 'Hầm Tàu 01', priority: 'Ưu Tiên Cao', destination: 'Bãi Block A', status: 'Đã Lập Lịch' },
    { seq: '02', containerId: 'MSCU9876543', type: '40HC', weight: '30 Tấn', hatch: 'Hầm Tàu 01', priority: 'Ưu Tiên Cao', destination: 'Bãi Block A', status: 'Đã Lập Lịch' },
    { seq: '03', containerId: 'MSCU5544332', type: '20GP', weight: '18 Tấn', hatch: 'Hầm Tàu 02', priority: 'Trung Bình', destination: 'Bãi Block B', status: 'Đã Lập Lịch' },
    { seq: '04', containerId: 'MSCU1122334', type: '40RF', weight: '26 Tấn', hatch: 'Hầm Tàu 02', priority: 'Ưu Tiên Cao', destination: 'Bãi Cold Block C', status: 'Đã Lập Lịch' },
    { seq: '05', containerId: 'MSCU7788990', type: '40HC', weight: '24 Tấn', hatch: 'Hầm Tàu 03', priority: 'Thấp', destination: 'Bãi Block B', status: 'Đã Lập Lịch' },
    { seq: '06', containerId: 'COSU3344556', type: '20GP', weight: '21 Tấn', hatch: 'Hầm Tàu 03', priority: 'Trung Bình', destination: 'Bãi Block A', status: 'Đã Lập Lịch' },
  ],

  // Yard Teams
  yardTeams: [
    { id: 'YT-1', name: 'Đội Bãi A', rtg: 'Cẩu Bãi RTG-03', itv: 'Xe Đầu Kéo ITV-012', block: 'Bãi Block A', status: 'Đã Phân Công' },
    { id: 'YT-2', name: 'Đội Bãi B', rtg: 'Cẩu Bãi RTG-05', itv: 'Xe Đầu Kéo ITV-018', block: 'Bãi Block B', status: 'Đã Phân Công' },
  ],

  // Operation Timeline
  timeline: [
    { time: '08:30', title: 'Tàu Cập Cầu An Toàn', desc: 'Tàu EVER GIVEN buộc dây neo cố định tại Cầu B-02', status: 'completed' },
    { time: '09:00', title: 'Bắt Đầu Mở Hầm & Dỡ Hàng', desc: 'Cẩu QC-01 & QC-03 bắt đầu dỡ container hầm 01 & 03', status: 'current' },
    { time: '09:00 - 12:00', title: 'Tác Nghiệp Hầm Tàu 01', desc: 'Dự kiến 150 container (moves) thực hiện bởi Cẩu QC-01', status: 'upcoming' },
    { time: '12:00 - 15:00', title: 'Tác Nghiệp Hầm Tàu 02', desc: 'Dự kiến 150 container (moves) thực hiện bởi Cẩu QC-02', status: 'upcoming' },
    { time: '15:00 - 17:30', title: 'Tác Nghiệp Hầm Tàu 03', desc: 'Dự kiến 150 container (moves) thực hiện bởi Cẩu QC-03', status: 'upcoming' },
    { time: '17:30', title: 'Dự Kiến Hoàn Tất Tác Nghiệp', desc: 'Hoàn thành 1,247 container, làm thủ tục tháo neo rời cầu', status: 'upcoming' },
  ],

  // Conflicts
  conflictData: {
    hasConflict: true,
    resource: 'Cẩu bờ QC-02',
    vessel: 'MSC MAYA',
    time: '10:00 - 14:00',
    details: 'Cẩu bờ QC-02 hiện đang được phân công cho tàu MSC MAYA tại Cầu B-02 trong khung giờ 10:00 - 14:00.',
  },

  // AI Suggestion
  aiSuggestion: {
    suggestedCrane: 'Cẩu Bờ QC-04',
    suggestedYard: 'Bãi Block A',
    suggestedRtg: 'Cẩu Bãi RTG-03',
    reason: 'Cẩu bờ QC-04 đang trống từ 09:00 đến 18:00, khoảng cách di chuyển xe đầu kéo ITV ngắn nhất và Block A còn sức chứa.',
  }
}
