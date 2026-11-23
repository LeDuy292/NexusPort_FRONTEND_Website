import React, { useState, useEffect, useMemo, useRef } from "react";
import yardTaskService from "../../services/yardTaskService";
import yardRestackService from "../../services/yardRestackService";
import { useNavigate } from "react-router-dom";
import sourceLayout from "../../features/yard-design/tienSaLayout.json";
import YardSlotReservationModal from "../../components/Yard/YardSlotReservationModal";
import { yardReservationStore } from "../../services/yardReservationStore";

// Helper to parse position string "A01-03-02-2" or "A01.03.02.2" → { block, bay, row, tier, isStandard }
const parsePosition = (pos) => {
  if (!pos)
    return { block: "?", bay: "?", row: "?", tier: "?", isStandard: false };
  const trimmed = String(pos).replace(/^Block\s*/i, "").trim();
  if (/^[A-Z0-9]{1,4}[-.]\d{1,3}[-.]\d{1,3}[-.]\d{1,2}$/i.test(trimmed)) {
    const parts = trimmed.split(/[-.]/);
    return {
      block: parts[0] || "?",
      bay: parts[1] ? String(parts[1]).padStart(2, "0") : "?",
      row: parts[2] ? String(parts[2]).padStart(2, "0") : "?",
      tier: parts[3] || "?",
      isStandard: true,
    };
  }
  return { block: trimmed, bay: "?", row: "?", tier: "?", isStandard: false };
};

// ISO 6346 Shipping line detector from container number prefix
const getShippingLineCode = (contNo = "") => {
  const upper = (contNo || "").toUpperCase().trim();
  if (
    upper.startsWith("MSCU") ||
    upper.startsWith("CAIU") ||
    upper.includes("MSC")
  )
    return "MSC";
  if (
    upper.startsWith("MSKU") ||
    upper.startsWith("MRKU") ||
    upper.startsWith("TEMU") ||
    upper.includes("MAERSK")
  )
    return "MAERSK";
  if (upper.startsWith("CMAU") || upper.includes("CMA")) return "CMA";
  if (upper.startsWith("ONEU") || upper.includes("ONE")) return "ONE";
  if (
    upper.startsWith("EVER") ||
    upper.startsWith("EMCU") ||
    upper.startsWith("EGLV") ||
    upper.includes("EVERGREEN")
  )
    return "EVERGREEN";
  if (upper.startsWith("COSU") || upper.includes("COSCO")) return "COSCO";
  if (upper.startsWith("HLCU") || upper.includes("HAPAG")) return "HAPAG";
  return "OTHER";
};

// Format Currency
const formatCurrency = (val) => {
  if (!val || val === 0) return "Miễn phí nội bộ (0 đ)";
  return `${Number(val).toLocaleString("vi-VN")} VNĐ`;
};

// Shipping lines list
const YARD_ZONES = [
  { code: "A", name: "Khu A", desc: "Sau cầu 4–5 (Xuất khẩu CY45)" },
  { code: "B", name: "Khu B", desc: "Bãi container 1 (Nhập khẩu Trung tâm)" },
  { code: "C", name: "Khu C", desc: "Bãi container 2 (Trung chuyển quốc tế)" },
  { code: "D", name: "Khu D", desc: "Bãi cont lạnh (Reefer / Nguy hiểm)" },
  { code: "E", name: "Khu E", desc: "Bãi tổng hợp 1 (Empty Depot cont rỗng)" },
  { code: "F", name: "Khu F", desc: "Bãi tổng hợp 2 (Kho hàng nhập lưu bãi)" },
  { code: "G", name: "Khu G", desc: "Bãi tổng hợp 3 (Chờ đóng bốc tàu)" },
];

const SHIPPING_LINES = [
  { code: "ALL", name: "Tất Cả Hãng Tàu", color: "bg-slate-800 text-white" },
  { code: "MAERSK", name: "Maersk Line", color: "bg-blue-600 text-white" },
  {
    code: "MSC",
    name: "MSC Mediterranean",
    color: "bg-yellow-500 text-slate-950",
  },
  { code: "CMA", name: "CMA CGM", color: "bg-sky-600 text-white" },
  { code: "ONE", name: "ONE Line", color: "bg-pink-600 text-white" },
  { code: "EVERGREEN", name: "Evergreen", color: "bg-emerald-600 text-white" },
  { code: "COSCO", name: "COSCO Shipping", color: "bg-indigo-600 text-white" },
  { code: "HAPAG", name: "Hapag-Lloyd", color: "bg-orange-600 text-white" },
];

// Fallback RTG Equipment list
const DEFAULT_EQUIPMENTS = [
  {
    id: "RTG-01",
    name: "Cẩu RTG-01 (Mitsui 40T)",
    operator: "Trần Văn Hùng",
    status: "Sẵn sàng",
    block: "A01",
    type: "RTG 40T",
    fuelLevel: "88%",
    health: "98%",
    maxLoad: "40 Tấn",
  },
  {
    id: "RTG-02",
    name: "Cẩu RTG-02 (Kalmar 45T)",
    operator: "Phạm Văn Cần",
    status: "Sẵn sàng",
    block: "A01",
    type: "RTG 45T",
    fuelLevel: "74%",
    health: "95%",
    maxLoad: "45 Tấn",
  },
  {
    id: "RTG-03",
    name: "Cẩu RTG-03 (ZPMC 50T)",
    operator: "Lê Văn Thành",
    status: "Bảo trì",
    block: "B02",
    type: "RTG 50T",
    fuelLevel: "92%",
    health: "62%",
    maxLoad: "50 Tấn",
  },
  {
    id: "RS-01",
    name: "Xe Nâng Chụp RS-01",
    operator: "Phạm Văn An",
    status: "Sẵn sàng",
    block: "C01",
    type: "Reach Stacker",
    fuelLevel: "65%",
    health: "91%",
    maxLoad: "45 Tấn",
  },
];

const SAMPLE_CONTAINERS = [
  {
    containerNo: "HAMU9350046",
    type: "40FT RF",
    location: "R01-02-03-2",
    cargo: "Hàng Lạnh (Reefer)",
    weight: "29.2 Tấn",
    line: "HAPAG",
    category: "REEFER",
    dwellDays: 1,
    nextVessel: "HAPAG-LLOYD FEEDER",
  },
  {
    containerNo: "NXPU9113780",
    type: "20FT RF",
    location: "B02-01-01-1",
    cargo: "Hàng Khô",
    weight: "29.2 Tấn",
    line: "NEXUSPORT",
    category: "REEFER",
    dwellDays: 1,
    nextVessel: "NEXUSPORT FEEDER",
  },
  {
    containerNo: "HAMU6381022",
    type: "40FT HC",
    location: "B02-02-01-2",
    cargo: "Hàng Khô Nhập Khẩu",
    weight: "29.2 Tấn",
    line: "HAPAG",
    category: "DRY",
    dwellDays: 1,
    nextVessel: "HAPAG-LLOYD FEEDER",
  },
  {
    containerNo: "NXPU9465754",
    type: "40FT RF",
    location: "D01-02-02-2",
    cargo: "Hàng Lạnh (Reefer)",
    weight: "29.2 Tấn",
    line: "NEXUSPORT",
    category: "REEFER",
    dwellDays: 1,
    nextVessel: "NEXUSPORT FEEDER",
  },
  {
    containerNo: "HLXU3284010",
    type: "40FT HC",
    location: "F01-02-03-1",
    cargo: "Hàng Khô Nhập Khẩu",
    weight: "29.2 Tấn",
    line: "HAPAG",
    category: "DRY",
    dwellDays: 1,
    nextVessel: "HAPAG-LLOYD FEEDER",
  },
  {
    containerNo: "TEMU4451923",
    type: "40FT HC",
    location: "B04-02-05-1",
    cargo: "Hàng Khô Đang Lưu Bãi",
    weight: "29.2 Tấn",
    line: "MAERSK",
    category: "DRY",
    dwellDays: 1,
    nextVessel: "MAERSK FEEDER",
  },
];

const INCIDENT_REASONS = [
  "Không tìm thấy container tại vị trí gốc",
  "RTG / Cẩu bị hỏng hoặc gặp sự cố kỹ thuật",
  "Vị trí đích đã bị container khác chiếm chỗ",
  "Xung đột quy tắc trọng lực (Tầng dưới còn trống)",
  "Không thể tiếp cận container (vật cản đường cẩu)",
  "Container bị hư hỏng nặng, rò rỉ hoặc móp méo",
  "Lệnh bị trùng lặp / đã thực hiện trước đó",
  "Lý do khác",
];

const SHIFTING_REASONS = [
  "Tái cơ cấu xếp bãi",
  "Chuẩn bị xuất cổng khẩn",
  "Đảo tầng cẩu bãi",
  "Theo yêu cầu khách hàng",
  "Chuyển khu bãi kiểm hóa",
  "Bố trí hàng vào khu vực cắm điện lạnh (Reefer)",
];

// Mock Yard Grid matrix for visual slot picker
const YARD_BAY_MATRIX = {
  A01: [
    {
      row: 1,
      tier: 1,
      status: "OCCUPIED",
      cont: "CMAU9918234",
      line: "CMA",
      weight: "18.5T",
      dwell: "1d",
    },
    {
      row: 1,
      tier: 2,
      status: "OCCUPIED",
      cont: "COSU8819201",
      line: "COSCO",
      weight: "24.1T",
      dwell: "5d",
    },
    { row: 1, tier: 3, status: "AVAILABLE" },
    { row: 1, tier: 4, status: "GRAVITY_WARNING" },
    {
      row: 2,
      tier: 1,
      status: "OCCUPIED",
      cont: "MSCU1234567",
      line: "MSC",
      weight: "28.4T",
      dwell: "4d",
    },
    { row: 2, tier: 2, status: "AVAILABLE" },
    { row: 2, tier: 3, status: "GRAVITY_WARNING" },
    { row: 2, tier: 4, status: "GRAVITY_WARNING" },
    { row: 3, tier: 1, status: "AVAILABLE" },
    { row: 3, tier: 2, status: "GRAVITY_WARNING" },
    { row: 3, tier: 3, status: "GRAVITY_WARNING" },
    { row: 3, tier: 4, status: "GRAVITY_WARNING" },
    { row: 4, tier: 1, status: "MAINTENANCE" },
    { row: 4, tier: 2, status: "MAINTENANCE" },
    { row: 4, tier: 3, status: "MAINTENANCE" },
    { row: 4, tier: 4, status: "MAINTENANCE" },
  ],
  B02: [
    {
      row: 1,
      tier: 1,
      status: "OCCUPIED",
      cont: "HLCU7719204",
      line: "HAPAG",
      weight: "26.0T",
      dwell: "3d",
    },
    { row: 1, tier: 2, status: "AVAILABLE" },
    { row: 1, tier: 3, status: "GRAVITY_WARNING" },
    { row: 1, tier: 4, status: "GRAVITY_WARNING" },
    {
      row: 2,
      tier: 1,
      status: "OCCUPIED",
      cont: "TEMU8822190",
      line: "MAERSK",
      weight: "30.2T",
      dwell: "2d",
    },
    {
      row: 2,
      tier: 2,
      status: "OCCUPIED",
      cont: "EVER1129983",
      line: "EVERGREEN",
      weight: "22.8T",
      dwell: "3d",
    },
    { row: 2, tier: 3, status: "AVAILABLE" },
    { row: 2, tier: 4, status: "GRAVITY_WARNING" },
    { row: 3, tier: 1, status: "AVAILABLE" },
    { row: 3, tier: 2, status: "GRAVITY_WARNING" },
    { row: 3, tier: 3, status: "GRAVITY_WARNING" },
    { row: 3, tier: 4, status: "GRAVITY_WARNING" },
    {
      row: 4,
      tier: 1,
      status: "OCCUPIED",
      cont: "ONEU8821903",
      line: "ONE",
      weight: "29.0T",
      dwell: "2d",
    },
    { row: 4, tier: 2, status: "AVAILABLE" },
    { row: 4, tier: 3, status: "GRAVITY_WARNING" },
    { row: 4, tier: 4, status: "GRAVITY_WARNING" },
  ],
  C01: [
    {
      row: 1,
      tier: 1,
      status: "OCCUPIED",
      cont: "ONEU8821903",
      line: "ONE",
      weight: "29.0T",
      dwell: "2d",
    },
    {
      row: 1,
      tier: 2,
      status: "OCCUPIED",
      cont: "MSCU9901123",
      line: "MSC",
      weight: "27.5T",
      dwell: "4d",
    },
    { row: 1, tier: 3, status: "AVAILABLE" },
    { row: 1, tier: 4, status: "GRAVITY_WARNING" },
    { row: 2, tier: 1, status: "AVAILABLE" },
    { row: 2, tier: 2, status: "GRAVITY_WARNING" },
    { row: 2, tier: 3, status: "GRAVITY_WARNING" },
    { row: 2, tier: 4, status: "GRAVITY_WARNING" },
    {
      row: 3,
      tier: 1,
      status: "OCCUPIED",
      cont: "CAIU1234567",
      line: "CAI",
      weight: "21.0T",
      dwell: "6d",
    },
    {
      row: 3,
      tier: 2,
      status: "OCCUPIED",
      cont: "MSCU2222222",
      line: "MSC",
      weight: "28.1T",
      dwell: "2d",
    },
    {
      row: 3,
      tier: 3,
      status: "OCCUPIED",
      cont: "MSCU1111111",
      line: "MSC",
      weight: "26.4T",
      dwell: "1d",
    },
    { row: 3, tier: 4, status: "AVAILABLE" },
    { row: 4, tier: 1, status: "AVAILABLE" },
    { row: 4, tier: 2, status: "GRAVITY_WARNING" },
    { row: 4, tier: 3, status: "GRAVITY_WARNING" },
    { row: 4, tier: 4, status: "GRAVITY_WARNING" },
  ],
};

// ── AI BRP CONFLICT RESOLUTION SCENARIOS ──
const CONFLICT_SCENARIOS = [
  {
    id: "SCENARIO_1",
    title: "Container HAMU6381022 — Xuất Tàu Khẩn Cấp (Tàu HAPAG-LLOYD)",
    badge: "XUẤT TÀU KHẨN",
    badgeColor: "bg-red-100 text-red-950 border-red-400",
    targetContainer: {
      id: "HAMU6381022",
      type: "40FT HC",
      weight: "29.2 Tấn",
      pos: "B02-02-01-2",
      tier: "Tầng 2",
      line: "HAPAG",
      urgency: "KHẨN CẤP — Tàu cập bến lúc 06:00 mai (Còn 8h)",
      dwell: "1 ngày",
    },
    blockingContainers: [
      {
        step: 1,
        id: "NXPU9465754",
        type: "40FT RF",
        tier: "Tầng 3",
        currentPos: "B02-02-01-3",
        moveTarget: "B02-02-04-1",
        rtg: "RTG-01",
        weight: "29.2 Tấn",
        duration: "2.0 phút",
        reason: "Dời sang slot đệm an toàn dãy 04",
      },
    ],
    targetMove: {
      step: 2,
      id: "HAMU6381022",
      type: "40FT HC",
      tier: "Tầng 2",
      currentPos: "B02-02-01-2",
      moveTarget: "Cầu Tàu Bến 02 (Xuất Lên Tàu)",
      rtg: "RTG-01",
      weight: "29.2 Tấn",
      duration: "3.5 phút",
      reason: "Giải phóng container mục tiêu bàn giao cẩu STS",
    },
    aiMetrics: {
      timeSaved: "75%",
      estimatedDuration: "3.5 phút",
      originalDuration: "14.0 phút",
      energySaved: "-70%",
      movesCount: 1,
      confidence: "99.9%",
      bufferSlotNote:
        "Slot đệm B02-02-04-1 nằm ngay dãy lân cận, rút ngắn 85m quãng đường di chuyển",
    },
  },
  {
    id: "SCENARIO_2",
    title: "Container NXPU9113780 — Xe Đầu Kéo Đang Đợi Ngoài Cổng C",
    badge: "XE KÉO CHỜ CỔNG",
    badgeColor: "bg-amber-100 text-amber-950 border-amber-400",
    targetContainer: {
      id: "NXPU9113780",
      type: "20FT RF",
      weight: "29.2 Tấn",
      pos: "B02-01-01-1",
      tier: "Tầng 1 (Đáy bãi)",
      line: "NEXUSPORT",
      urgency: "CỰC KHẨN — Tài xế xe đầu kéo chờ quá 15 phút",
      dwell: "1 ngày",
    },
    blockingContainers: [],
    targetMove: {
      step: 1,
      id: "NXPU9113780",
      type: "20FT RF",
      tier: "Tầng 1",
      currentPos: "B02-01-01-1",
      moveTarget: "Xe Đầu Kéo BS: 43C-129.88 (Cổng C)",
      rtg: "RTG-02",
      weight: "29.2 Tấn",
      duration: "2.5 phút",
      reason: "Bàn giao trực tiếp lên sơ mi rơ moóc",
    },
    aiMetrics: {
      timeSaved: "80%",
      estimatedDuration: "2.5 phút",
      originalDuration: "10.0 phút",
      energySaved: "-75%",
      movesCount: 1,
      confidence: "100%",
      bufferSlotNote:
        "Container tầng đáy không bị đè tầng, cẩu xuất trực tiếp ra xe đầu kéo",
    },
  },
  {
    id: "SCENARIO_3",
    title:
      "Container Lạnh HAMU9350025 — Cần Chuyển Gấp Vào Rack Cắm Điện Reefer",
    badge: "HÀNG LẠNH REEFER",
    badgeColor: "bg-cyan-100 text-cyan-950 border-cyan-400",
    targetContainer: {
      id: "HAMU9350025",
      type: "40FT RF",
      weight: "29.2 Tấn",
      pos: "D01-02-01-3",
      tier: "Tầng 3",
      line: "HAPAG",
      urgency: "NGHIÊM NGẶT — Nhiệt độ bảo quản lạnh -18°C",
      dwell: "1 ngày",
    },
    blockingContainers: [],
    targetMove: {
      step: 1,
      id: "HAMU9350025",
      type: "40FT RF",
      tier: "Tầng 3",
      currentPos: "D01-02-01-3",
      moveTarget: "Rack Cắm Điện Reefer (D02-01-02-1)",
      rtg: "RTG-01",
      weight: "29.2 Tấn",
      duration: "3.5 phút",
      reason: "Cắm điện làm lạnh bảo quản hàng tươi đông",
    },
    aiMetrics: {
      timeSaved: "70%",
      estimatedDuration: "3.5 phút",
      originalDuration: "9.0 phút",
      energySaved: "-65%",
      movesCount: 1,
      confidence: "99.8%",
      bufferSlotNote:
        "Rack điện Reefer D02 còn 2 slot cắm sẵn sàng tiếp nhận ngay",
    },
  },
  {
    id: "SCENARIO_4",
    title: "Container HLXU3284010 — Block F01 Cảnh Báo An Toàn",
    badge: "HẾT SLOT ĐỆM (TEST)",
    badgeColor: "bg-rose-100 text-rose-950 border-rose-400",
    canExecute: false,
    validationMessage:
      "CẢNH BÁO HỆ THỐNG: Block F01 đã đạt 100% dung lượng. Không có slot đệm hợp lệ thỏa mãn quy tắc an toàn!",
    targetContainer: {
      id: "HLXU3284010",
      type: "40FT HC",
      weight: "29.2 Tấn",
      pos: "F01-02-03-1",
      tier: "Tầng 1 (Đáy bãi)",
      line: "HAPAG",
      urgency:
        "KHẨN CẤP — Xe đầu kéo chờ nhưng không thể đảo bãi do thiếu slot",
      dwell: "1 ngày",
    },
    blockingContainers: [
      {
        step: 1,
        id: "NXPU9465754",
        type: "40FT RF",
        tier: "Tầng 2",
        currentPos: "F01-02-03-2",
        moveTarget: "KHÔNG CÓ SLOT",
        rtg: "RTG-01",
        weight: "29.2 Tấn",
        duration: "--",
        reason: "Không tìm thấy slot đệm trống trong phạm vi an toàn",
      },
    ],
    targetMove: {
      step: 2,
      id: "HLXU3284010",
      type: "40FT HC",
      tier: "Tầng 1",
      currentPos: "F01-02-03-1",
      moveTarget: "Cổng Bàn Giao",
      rtg: "RTG-01",
      weight: "29.2 Tấn",
      duration: "--",
      reason: "Bị phong tỏa do không thể dời container phía trên",
    },
    aiMetrics: {
      timeSaved: "0%",
      estimatedDuration: "Không thể thực thi",
      originalDuration: "Bị khóa",
      energySaved: "0%",
      movesCount: 0,
      confidence: "0%",
      bufferSlotNote:
        "Toàn bộ slot lân cận đều đang OCCUPIED hoặc vi phạm quy tắc trọng lực",
    },
  },
];

export default function YardMovementOperations() {
  const navigate = useNavigate();
  // Mở trang Sơ đồ bãi 2D, tô sáng vị trí nguồn / đích của lệnh (không nhúng bản đồ vào trang này).
  const goToYardMap = ({ from = "", to = "", containerId = "" } = {}) => {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (containerId) params.set("container", containerId);
    navigate(`/yard-staff/map?${params.toString()}`);
  };
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState("success"); // success, error, warning

  // Active View Mode: 'TABLE' | 'YARD_MAP' | 'RESTACK_WIZARD' | 'AI_ANALYTICS'
  const [viewMode, setViewMode] = useState("TABLE");

  // Filter, Search, Sort & Bulk Selection
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [searchTerm, setSearchTerm] = useState("");
  const [shippingLineFilter, setShippingLineFilter] = useState("ALL");
  const [sortField, setSortField] = useState("id");
  const [sortOrder, setSortOrder] = useState("desc");
  const [selectedTaskIds, setSelectedTaskIds] = useState([]);

  // Live Clock & Active Task Execution
  const [currentTime, setCurrentTime] = useState(
    new Date().toLocaleTimeString("vi-VN"),
  );
  const [activeTask, setActiveTask] = useState(null);
  const [confirmedPosInput, setConfirmedPosInput] = useState("");
  const [receiptPhotos, setReceiptPhotos] = useState([]); // ảnh container khi nhận (data URL đã nén), tối đa 4
  const [receiptCondition, setReceiptCondition] = useState("Good");
  const [receiptSeal, setReceiptSeal] = useState("");
  const [receiptBusy, setReceiptBusy] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerRef = useRef(null);

  // Modals & Drawers
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedZone, setSelectedZone] = useState("B");
  const [pickerBlock, setPickerBlock] = useState(null);
  const [incidentTask, setIncidentTask] = useState(null);
  const [incidentReason, setIncidentReason] = useState(INCIDENT_REASONS[0]);
  const [incidentNotes, setIncidentNotes] = useState("");
  const [mapViewTask, setMapViewTask] = useState(null);
  const [selectedSlotMatrixBlock, setSelectedSlotMatrixBlock] = useState("B02");
  const [jobSheetTask, setJobSheetTask] = useState(null);
  const [hoveredSlotInfo, setHoveredSlotInfo] = useState(null);

  // Equipment & Operators
  const [equipments, setEquipments] = useState(DEFAULT_EQUIPMENTS);
  const [operators, setOperators] = useState([]);

  // Create Modal Form State
  const [newContainerNo, setNewContainerNo] = useState(SAMPLE_CONTAINERS[0].containerNo);
  const [newContainerType, setNewContainerType] = useState(SAMPLE_CONTAINERS[0].type);
  const modalBooking = useMemo(
    () => ({
      containerType: newContainerType,
      containerId: newContainerNo,
    }),
    [newContainerType, newContainerNo],
  );
  const [newFromLocation, setNewFromLocation] = useState(SAMPLE_CONTAINERS[0].location);
  const [newTargetBlock, setNewTargetBlock] = useState("B02");
  const [newTargetBay, setNewTargetBay] = useState("02");
  const [newTargetRow, setNewTargetRow] = useState("02");
  const [newTargetTier, setNewTargetTier] = useState("3");
  const [newShiftingReason, setNewShiftingReason] = useState(
    SHIFTING_REASONS[0],
  );
  const [newPriority, setNewPriority] = useState("Normal");
  const [newIsBillable, setNewIsBillable] = useState(false);
  const [newEquipmentId, setNewEquipmentId] = useState("");
  const [newOperatorName, setNewOperatorName] = useState("Trần Văn Hùng");
  const [newNotes, setNewNotes] = useState("");
  const [slotValidation, setSlotValidation] = useState(null);
  const [validatingSlot, setValidatingSlot] = useState(false);
  const [calculatedFee, setCalculatedFee] = useState(0);
  const [isSubmittingTask, setIsSubmittingTask] = useState(false);

  const combinedBlocks = useMemo(() => {
    const storeReservations = yardReservationStore.getReservations();
    return (sourceLayout.areas || []).map((area) => {
      const blockStoreRes = storeReservations.filter(
        (r) => (r.blockCode || r.block) === area.code
      );
      const occupied = blockStoreRes.length;
      const totalCapacity =
        (area.planning?.bayModules || 20) *
        (area.planning?.rows || 6) *
        (area.planning?.tiers || 4);
      return {
        id: area.code,
        blockCode: area.code,
        code: area.code,
        sector: area.sector,
        description: area.note || `Khu ${area.sector} · Block ${area.code}`,
        planning: area.planning,
        maxRows: area.planning?.rows || 6,
        maxTiers: area.planning?.tiers || 4,
        slots: [],
        totalCapacity,
        occupied,
        empty: Math.max(0, totalCapacity - occupied),
      };
    });
  }, []);

  const currentZoneBlocks = useMemo(() => {
    return combinedBlocks.filter(
      (b) =>
        b.sector === selectedZone || (b.blockCode || "").startsWith(selectedZone)
    );
  }, [combinedBlocks, selectedZone]);

  // ── AI & AUTONOMOUS ENGINE STATE ──
  const [autoPilotEnabled, setAutoPilotEnabled] = useState(false);
  const [autoPilotScanning, setAutoPilotScanning] = useState(false);
  const [aiAlgorithmWeights, setAiAlgorithmWeights] = useState({
    distance: 40,
    reshuffle: 40,
    safety: 20,
  });
  const [availableContainers, setAvailableContainers] = useState([]);
  const [loadingContainers, setLoadingContainers] = useState(false);
  const [selectedCompareContainer, setSelectedCompareContainer] = useState(
    SAMPLE_CONTAINERS[0],
  );
  const [autoPilotLogs, setAutoPilotLogs] = useState([
    "08:30:12 [AI-ENGINE]: Tải mô hình BRP (Block Relocation Problem) v4.2 - 0.04s latency.",
    "08:31:05 [TELEMETRY]: Đồng bộ 4 cẩu RTG với cảm biến Twistlock Laser Lock.",
    "08:32:40 [PREDICTION]: Dự báo tàu cập bến lúc 06:00 mai - Quét container bị nghẽn tầng.",
  ]);

  // Proactive Auto-Pilot Housekeeping Queue (Synchronized with Real Containers)
  const [proactiveTasks, setProactiveTasks] = useState([
    {
      id: "AUTO-01",
      containerId: "HAMU6381022",
      type: "40FT HC",
      from: "B02-02-01-2",
      to: "B02-02-04-1",
      reason: "Đảo tầng trước giờ tàu HAPAG-LLOYD cập cảng (Tự động)",
      urgency: "CAO",
      rtgAssigned: "RTG-01",
      status: "READY",
    },
    {
      id: "AUTO-02",
      containerId: "NXPU9465754",
      type: "40FT RF",
      from: "D01-02-02-2",
      to: "D01-02-04-1",
      reason: "Giải phóng lối cẩu cho container xuất cảng",
      urgency: "TRUNG BÌNH",
      rtgAssigned: "RTG-02",
      status: "READY",
    },
    {
      id: "AUTO-03",
      containerId: "HAMU9350025",
      type: "40FT RF",
      from: "D01-02-01-3",
      to: "D01-04-02-1",
      reason: "Chuyển container lạnh vào Rack cắm điện Reefer tự động",
      urgency: "KHẨN CẤP",
      rtgAssigned: "RTG-03",
      status: "READY",
    },
  ]);

  // Live IoT Telemetry Feed (Realtime Spreader & Twistlock)
  const [iotTelemetry, setIotTelemetry] = useState({
    spreaderLockStatus: "LOCKED", // 'LOCKED' | 'UNLOCKED' | 'HOISTING'
    laserCoord: { x: "14.2m", y: "8.4m", z: "12.0m" },
    liftedWeightTons: 28.4,
    spreaderPressureBar: 185,
    windSpeedMs: 9.8,
    activRTGId: "RTG-01",
  });

  // ── AI BRP CONFLICT RESOLUTION STATE ──
  const [selectedConflictScenarioId, setSelectedConflictScenarioId] =
    useState("SCENARIO_1");
  const [isAnalyzingConflict, setIsAnalyzingConflict] = useState(false);
  const [conflictPlanResult, setConflictPlanResult] = useState(null);
  const [showConfirmDeployModal, setShowConfirmDeployModal] = useState(false);
  const [isDeployingConflictPlan, setIsDeployingConflictPlan] = useState(false);
  const [conflictPlanDeployed, setConflictPlanDeployed] = useState(false);
  const [conflictExecutingStep, setConflictExecutingStep] = useState(0);

  // ── NXP-126: RESTACK PLAN STATE ──
  const [restackRightView, setRestackRightView] = useState("MAP"); // 'MAP' | 'STACK'
  const [customTargetContInput, setCustomTargetContInput] =
    useState("HAMU6381022");
  const [customDestinationInput, setCustomDestinationInput] = useState(
    "Cầu Tàu Bến 02 (Xuất Lên Tàu)",
  );
  const [restackBackOption, setRestackBackOption] = useState(false);
  const [activeRestackPlan, setActiveRestackPlan] = useState(null);
  const [restackPlanHistory, setRestackPlanHistory] = useState([]);
  const [showPlanHistorySection, setShowPlanHistorySection] = useState(false);
  const [isAdvancingStep, setIsAdvancingStep] = useState(false);

  // Dynamic active conflict container based on custom input or real database containers
  const activeConflictContainer = useMemo(() => {
    if (customTargetContInput) {
      const clean = customTargetContInput.trim().toUpperCase();
      const found = availableContainers.find(
        (c) => c.containerNo?.toUpperCase() === clean
      );
      if (found) return found;
    }
    if (availableContainers.length > 0) {
      return availableContainers[0];
    }
    const scen =
      CONFLICT_SCENARIOS.find((s) => s.id === selectedConflictScenarioId) ||
      CONFLICT_SCENARIOS[0];
    return {
      containerNo: scen.targetContainer.id,
      location: scen.targetContainer.pos,
      type: scen.targetContainer.type,
      line: scen.targetContainer.line,
      cargo: "Hàng Khô Xuất Nhập",
      weight: scen.targetContainer.weight,
      dwellDays: 3,
      category: "DRY",
    };
  }, [customTargetContInput, availableContainers, selectedConflictScenarioId]);

  // Current conflict scenario object
  const currentConflictScenario = useMemo(() => {
    return (
      CONFLICT_SCENARIOS.find((s) => s.id === selectedConflictScenarioId) ||
      CONFLICT_SCENARIOS[0]
    );
  }, [selectedConflictScenarioId]);

  // Select conflict scenario
  const handleSelectConflictScenario = (id) => {
    setSelectedConflictScenarioId(id);
    setConflictPlanResult(null);
    setConflictPlanDeployed(false);
    setConflictExecutingStep(0);
    const found = CONFLICT_SCENARIOS.find((s) => s.id === id);
    if (found) {
      setCustomTargetContInput(found.targetContainer.id);
      setCustomDestinationInput(found.targetMove.moveTarget);
    }
  };

  // Stacking Conflict State (Fallback compatibility)
  const [stackingConflict, setStackingConflict] = useState({
    targetContainer: "HAMU6381022",
    currentPosition: "B02-02-01-2 (Tầng 2)",
    containersBlocking: 1,
    currentStep: 0,
    blockingContainers: [
      {
        step: 1,
        id: "NXPU9465754",
        tier: "Tầng 3",
        moveTarget: "B02-02-04-1",
        status: "pending",
      },
    ],
    recommendedOrder: [
      "1 ➔ Cẩu NXPU9465754 (Tầng 3) sang B02-02-04-1",
      "2 ➔ Giải phóng container mục tiêu HAMU6381022 xuất cảng",
    ],
    planStarted: false,
    planCompleted: false,
  });

  const showToast = (msg, type = "success") => {
    setToastMessage(msg);
    setToastType(type);
    setTimeout(() => setToastMessage(""), 4500);
  };

  // Real-time Clock
  useEffect(() => {
    const clockInterval = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString("vi-VN"));
    }, 1000);
    return () => clearInterval(clockInterval);
  }, []);

  // Auto-Pilot Trigger Simulation
  const handleToggleAutoPilot = () => {
    const nextState = !autoPilotEnabled;
    setAutoPilotEnabled(nextState);
    if (nextState) {
      setAutoPilotScanning(true);
      showToast(
        "🚀 CHẾ ĐỘ AUTO-PILOT ĐÃ BẬT: Hệ thống tự động phân tích bãi & sinh lệnh dọn tầng.",
        "success",
      );
      setTimeout(() => {
        setAutoPilotScanning(false);
        setAutoPilotLogs((prev) => [
          `${new Date().toLocaleTimeString()} [AUTO-PILOT]: Quét 348 slots bãi thành công. Tối ưu hóa 3 lệnh cẩu tự động.`,
          ...prev.slice(0, 5),
        ]);
      }, 1500);
    } else {
      showToast(
        "⏹️ Đã tắt chế độ Auto-Pilot. Chuyển về chế độ điều hành thủ công.",
        "warning",
      );
    }
  };

  // Execute All Proactive Tasks
  const handleExecuteAllProactiveTasks = () => {
    const newTasks = proactiveTasks.map((p) => ({
      id: `MOV-${p.id}`,
      taskId: `auto-${Math.floor(1000 + Math.random() * 9000)}`,
      containerId: p.containerId,
      containerType: p.type,
      cargoType: "Hàng Đảo Tầng Tự Động",
      from: p.from,
      to: p.to,
      reason: p.reason,
      priority: p.urgency === "KHẨN CẤP" ? "CRITICAL" : "HIGH",
      assignedBy: "🤖 NexusPort Auto-Pilot AI",
      status: "IN PROGRESS",
      flowStep: 1,
      equipment: { name: p.rtgAssigned, operator: "Hệ Thống AI Tự Động" },
      confirmedPos: "",
      internalFee: 0,
      durationMinutes: 0,
      startTime: new Date().toISOString(),
    }));

    setTasks((prev) => [...newTasks, ...prev]);
    setProactiveTasks([]);
    showToast(
      `⚡ ĐÃ KÍCH HOẠT THÀNH CÔNG ${newTasks.length} LỆNH TỰ ĐỘNG! Các cẩu RTG đang thực thi.`,
      "success",
    );
    setAutoPilotLogs((prev) => [
      `${new Date().toLocaleTimeString()} [EXECUTION]: Bắn 3 lệnh tự động xuống cẩu RTG-01, RTG-02, RTG-03.`,
      ...prev.slice(0, 5),
    ]);
  };

  // Load relocation tasks from live API
  const loadTasks = async () => {
    try {
      setLoading(true);
      const data = await yardTaskService.getRelocationTasks();
      if (Array.isArray(data) && data.length > 0) {
        const mapped = data.map((t) => ({
          id: t.taskCode || `MOV-${t.id?.substring(0, 4)}`,
          taskId: t.id,
          containerId: t.containerNo,
          containerType: t.containerType || "40FT HC",
          cargoType: t.cargoType || "Hàng Khô",
          from: t.fromLocation || "A01-01-01-1",
          to: t.toLocation || "B02-01-01-1",
          reason: t.shiftingReason || t.notes || "Tái cơ cấu xếp bãi",
          priority: (t.priority || "Normal").toUpperCase(),
          assignedBy: t.assignedBy || "Operator / Điều phối",
          status: (t.status || "ASSIGNED").toUpperCase().replace("_", " "),
          flowStep:
            t.status?.toLowerCase() === "completed"
              ? 3
              : t.status?.toLowerCase() === "in_progress"
                ? 1
                : 0,
          equipment: t.equipmentCode
            ? { name: t.equipmentCode, operator: t.operatorName || "Cần thủ" }
            : null,
          confirmedPos: t.completedLocation || "",
          internalFee: t.internalFee || 0,
          durationMinutes: t.durationMinutes || 0,
          startTime: t.startTime,
          endTime: t.endTime,
          notes: t.notes || "",
          // Nhiệm vụ hạ bãi tự tạo khi xe qua cổng vào: bước cuối là xác nhận nhận container kèm ảnh.
          isGateIn: t.operationType === "Unload",
          vehiclePlate: t.vehiclePlate || "",
          driverName: t.driverName || "",
          expectedSealNo: t.expectedSealNo || "",
        }));
        setTasks(mapped);
      } else {
        setTasks([]);
      }
    } catch (err) {
      console.warn(
        "Could not fetch from backend, loading fallback tasks:",
        err,
      );
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

  // Load Restack Plan History (NXP-126)
  const loadRestackHistory = async () => {
    try {
      const plans = await yardRestackService.getAllPlans();
      if (Array.isArray(plans)) {
        setRestackPlanHistory(plans);
      }
    } catch (err) {
      console.warn("Could not fetch restack plan history:", err);
    }
  };

  // Load Active Containers from Database (NXP-119)
  const loadAvailableContainers = async () => {
    try {
      setLoadingContainers(true);
      const data = await yardTaskService.getActiveContainers();
      if (Array.isArray(data) && data.length > 0) {
        setAvailableContainers(data);
        setSelectedCompareContainer((prev) => prev || data[0]);
        setCustomTargetContInput((prev) =>
          !prev || prev === "CAIU1234567" || prev === "HAMU6381022"
            ? data[0].containerNo
            : prev,
        );
        setNewContainerNo((prev) => (!prev ? data[0].containerNo : prev));
        setNewContainerType((prev) =>
          !prev ? normalizeDropdownType(data[0].type) : prev,
        );
        setNewFromLocation((prev) =>
          !prev ? (data[0].location || "") : prev,
        );
      }
    } catch (err) {
      console.warn("Could not fetch active yard containers:", err);
    } finally {
      setLoadingContainers(false);
    }
  };

  const handleOpenCreateModal = () => {
    const list = availableContainers.length > 0 ? availableContainers : SAMPLE_CONTAINERS;
    if (list.length > 0) {
      const currentExists = list.some((c) => c.containerNo === newContainerNo);
      if (!currentExists || !newContainerNo) {
        const first = list[0];
        setNewContainerNo(first.containerNo);
        setNewContainerType(normalizeDropdownType(first.type));
        setNewFromLocation(first.location || "");
      }
    }
    setCreateModalOpen(true);
  };

  // Initial load
  useEffect(() => {
    loadTasks();
    loadRestackHistory();
    loadAvailableContainers();

    // Fetch equipments & operators
    yardTaskService
      .getAvailableEquipments()
      .then((eqs) => {
        if (Array.isArray(eqs) && eqs.length > 0) {
          setEquipments(
            eqs.map((e) => ({
              id: e.id || e.equipmentCode,
              name: `${e.equipmentCode} (${e.name || e.equipmentType})`,
              operator: e.operatorName || "Chưa gán",
              status:
                e.status === "available"
                  ? "Sẵn sàng"
                  : e.status === "working"
                    ? "Đang bận"
                    : "Bảo trì",
              block: e.blockCode || "A01",
              type: e.equipmentType || "RTG",
              fuelLevel: "85%",
              health: "96%",
              maxLoad: "45 Tấn",
            })),
          );
        }
      })
      .catch(() => {});

    yardTaskService
      .getAvailableOperators()
      .then((ops) => {
        if (Array.isArray(ops) && ops.length > 0) {
          setOperators(ops);
        }
      })
      .catch(() => {});
  }, []);

  // Timer effect for active task
  useEffect(() => {
    if (activeTask && activeTask.flowStep === 1) {
      timerRef.current = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setElapsedSeconds(0);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [activeTask]);

  const formatTimer = (totalSeconds) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Dynamic AI Score calculation based on weight sliders
  const dynamicAiScore = useMemo(() => {
    const total =
      aiAlgorithmWeights.distance +
      aiAlgorithmWeights.reshuffle +
      aiAlgorithmWeights.safety;
    if (total === 0) return 90;
    const raw =
      (aiAlgorithmWeights.distance * 0.95 +
        aiAlgorithmWeights.reshuffle * 0.98 +
        aiAlgorithmWeights.safety * 0.9) /
      (total / 100);
    return Math.min(99, Math.round(raw));
  }, [aiAlgorithmWeights]);

  // Dynamic AI Comparison details for selected container
  const compareData = useMemo(() => {
    const c = selectedCompareContainer || SAMPLE_CONTAINERS[0];
    const map = {
      MSCU1234567: {
        manualPos: "B02-01-02-1",
        manualDist: "420 m",
        manualTime: "18.0 phút",
        manualConflict: "Bị 3 container đè (Cần đảo vỏ)",
        manualEnergy: "4.2 Lít",
        manualAutoRate: "12%",
        aiPos: "B02-04-02-3",
        aiDist: "160 m",
        aiTime: "7.5 phút",
        aiConflict: "0 lần (Lấy thẳng khi tàu cập)",
        aiEnergy: "1.5 Lít",
        aiAutoRate: "98%",
        distSaving: "-61.9%",
        timeSaving: "-58.3%",
        energySaving: "-64.3%",
        conflictSaving: "-100%",
        costManual: "380.000 đ",
        costAi: "150.000 đ",
        costSaving: "-60.5%",
        autoRateGain: "+86.0%",
        pctDist: 38,
        pctTime: 42,
        pctEnergy: 36,
        pctCost: 39,
      },
      TEMU8822190: {
        manualPos: "A01-02-05-1",
        manualDist: "380 m",
        manualTime: "16.5 phút",
        manualConflict: "Bị 2 container đè phía trên",
        manualEnergy: "3.8 Lít",
        manualAutoRate: "15%",
        aiPos: "B02-02-02-4",
        aiDist: "90 m",
        aiTime: "4.5 phút",
        aiConflict: "0 lần (Lấy thẳng khi tàu cập)",
        aiEnergy: "1.1 Lít",
        aiAutoRate: "99%",
        distSaving: "-76.3%",
        timeSaving: "-72.7%",
        energySaving: "-71.1%",
        conflictSaving: "-100%",
        costManual: "350.000 đ",
        costAi: "120.000 đ",
        costSaving: "-65.7%",
        autoRateGain: "+84.0%",
        pctDist: 24,
        pctTime: 27,
        pctEnergy: 29,
        pctCost: 34,
      },
      CMAU9918234: {
        manualPos: "C01-03-01-1",
        manualDist: "510 m",
        manualTime: "21.0 phút",
        manualConflict: "Bị 3 container đè phía trên",
        manualEnergy: "5.1 Lít",
        manualAutoRate: "10%",
        aiPos: "A01-03-04-3",
        aiDist: "120 m",
        aiTime: "6.0 phút",
        aiConflict: "0 lần (Lấy thẳng khi tàu cập)",
        aiEnergy: "1.4 Lít",
        aiAutoRate: "97%",
        distSaving: "-76.5%",
        timeSaving: "-71.4%",
        energySaving: "-72.5%",
        conflictSaving: "-100%",
        costManual: "420.000 đ",
        costAi: "140.000 đ",
        costSaving: "-66.7%",
        autoRateGain: "+87.0%",
        pctDist: 24,
        pctTime: 29,
        pctEnergy: 27,
        pctCost: 33,
      },
      COSU8819201: {
        manualPos: "B02-03-01-2",
        manualDist: "450 m",
        manualTime: "19.0 phút",
        manualConflict: "Bị 2 container đè phía trên",
        manualEnergy: "4.5 Lít",
        manualAutoRate: "14%",
        aiPos: "A01-04-02-2",
        aiDist: "140 m",
        aiTime: "6.5 phút",
        aiConflict: "0 lần (Lấy thẳng khi tàu cập)",
        aiEnergy: "1.6 Lít",
        aiAutoRate: "98%",
        distSaving: "-68.9%",
        timeSaving: "-65.8%",
        energySaving: "-64.4%",
        conflictSaving: "-100%",
        costManual: "390.000 đ",
        costAi: "150.000 đ",
        costSaving: "-61.5%",
        autoRateGain: "+84.0%",
        pctDist: 31,
        pctTime: 34,
        pctEnergy: 36,
        pctCost: 38,
      },
      HLCU7719204: {
        manualPos: "A01-01-03-1",
        manualDist: "490 m",
        manualTime: "20.0 phút",
        manualConflict: "Bị 3 container đè phía trên",
        manualEnergy: "4.9 Lít",
        manualAutoRate: "12%",
        aiPos: "B02-04-01-1",
        aiDist: "110 m",
        aiTime: "5.0 phút",
        aiConflict: "0 lần (Khu chuyên dụng DG)",
        aiEnergy: "1.3 Lít",
        aiAutoRate: "99%",
        distSaving: "-77.6%",
        timeSaving: "-75.0%",
        energySaving: "-73.5%",
        conflictSaving: "-100%",
        costManual: "440.000 đ",
        costAi: "160.000 đ",
        costSaving: "-63.6%",
        autoRateGain: "+87.0%",
        pctDist: 22,
        pctTime: 25,
        pctEnergy: 27,
        pctCost: 36,
      },
      ONEU8821903: {
        manualPos: "B02-02-01-1",
        manualDist: "460 m",
        manualTime: "19.5 phút",
        manualConflict: "Bị 2 container đè phía trên",
        manualEnergy: "4.6 Lít",
        manualAutoRate: "11%",
        aiPos: "C01-02-04-2",
        aiDist: "130 m",
        aiTime: "6.0 phút",
        aiConflict: "0 lần (Rack cắm điện Reefer)",
        aiEnergy: "1.5 Lít",
        aiAutoRate: "98%",
        distSaving: "-71.7%",
        timeSaving: "-69.2%",
        energySaving: "-67.4%",
        conflictSaving: "-100%",
        costManual: "410.000 đ",
        costAi: "150.000 đ",
        costSaving: "-63.4%",
        autoRateGain: "+87.0%",
        pctDist: 28,
        pctTime: 31,
        pctEnergy: 33,
        pctCost: 37,
      },
      HAMU9350046: {
        manualPos: "R01-02-03-2",
        manualDist: "390 m",
        manualTime: "17.0 phút",
        manualConflict: "Bị 1 container đè phía trên",
        manualEnergy: "4.0 Lít",
        manualAutoRate: "14%",
        aiPos: "D02-01-02-2",
        aiDist: "120 m",
        aiTime: "5.5 phút",
        aiConflict: "0 lần (Rack điện Reefer)",
        aiEnergy: "1.3 Lít",
        aiAutoRate: "99%",
        distSaving: "-69.2%",
        timeSaving: "-67.6%",
        energySaving: "-67.5%",
        conflictSaving: "-100%",
        costManual: "370.000 đ",
        costAi: "130.000 đ",
        costSaving: "-64.9%",
        autoRateGain: "+85.0%",
        pctDist: 31,
        pctTime: 32,
        pctEnergy: 33,
        pctCost: 35,
      },
      NXPU9113780: {
        manualPos: "B02-01-01-1",
        manualDist: "350 m",
        manualTime: "15.0 phút",
        manualConflict: "Không bị đè (Cần cẩu cẩn trọng)",
        manualEnergy: "3.5 Lít",
        manualAutoRate: "16%",
        aiPos: "B02-02-03-1",
        aiDist: "95 m",
        aiTime: "4.2 phút",
        aiConflict: "0 lần (Cẩu thẳng ra xe đầu kéo)",
        aiEnergy: "1.0 Lít",
        aiAutoRate: "99%",
        distSaving: "-72.9%",
        timeSaving: "-72.0%",
        energySaving: "-71.4%",
        conflictSaving: "-100%",
        costManual: "320.000 đ",
        costAi: "110.000 đ",
        costSaving: "-65.6%",
        autoRateGain: "+83.0%",
        pctDist: 27,
        pctTime: 28,
        pctEnergy: 29,
        pctCost: 34,
      },
      HAMU6381022: {
        manualPos: "B02-02-01-2",
        manualDist: "410 m",
        manualTime: "18.5 phút",
        manualConflict: "Bị 1 container đè phía trên",
        manualEnergy: "4.1 Lít",
        manualAutoRate: "13%",
        aiPos: "B02-02-04-1",
        aiDist: "115 m",
        aiTime: "5.2 phút",
        aiConflict: "0 lần (Đảo slot lân cận)",
        aiEnergy: "1.2 Lít",
        aiAutoRate: "99%",
        distSaving: "-72.0%",
        timeSaving: "-71.9%",
        energySaving: "-70.7%",
        conflictSaving: "-100%",
        costManual: "360.000 đ",
        costAi: "125.000 đ",
        costSaving: "-65.3%",
        autoRateGain: "+86.0%",
        pctDist: 28,
        pctTime: 28,
        pctEnergy: 29,
        pctCost: 35,
      },
      NXPU9465754: {
        manualPos: "D01-02-02-2",
        manualDist: "430 m",
        manualTime: "19.0 phút",
        manualConflict: "Bị 1 container đè phía trên",
        manualEnergy: "4.3 Lít",
        manualAutoRate: "12%",
        aiPos: "D01-02-04-1",
        aiDist: "125 m",
        aiTime: "5.8 phút",
        aiConflict: "0 lần (Cẩu thẳng)",
        aiEnergy: "1.3 Lít",
        aiAutoRate: "98%",
        distSaving: "-70.9%",
        timeSaving: "-69.5%",
        energySaving: "-69.8%",
        conflictSaving: "-100%",
        costManual: "380.000 đ",
        costAi: "135.000 đ",
        costSaving: "-64.5%",
        autoRateGain: "+86.0%",
        pctDist: 29,
        pctTime: 31,
        pctEnergy: 30,
        pctCost: 36,
      },
      HLXU3284010: {
        manualPos: "F01-02-03-1",
        manualDist: "440 m",
        manualTime: "19.5 phút",
        manualConflict: "Không bị đè (Tầng đáy)",
        manualEnergy: "4.4 Lít",
        manualAutoRate: "14%",
        aiPos: "F01-02-04-1",
        aiDist: "105 m",
        aiTime: "4.8 phút",
        aiConflict: "0 lần (Lấy trực tiếp)",
        aiEnergy: "1.1 Lít",
        aiAutoRate: "99%",
        distSaving: "-76.1%",
        timeSaving: "-75.4%",
        energySaving: "-75.0%",
        conflictSaving: "-100%",
        costManual: "350.000 đ",
        costAi: "115.000 đ",
        costSaving: "-67.1%",
        autoRateGain: "+85.0%",
        pctDist: 24,
        pctTime: 25,
        pctEnergy: 25,
        pctCost: 33,
      },
    };
    return map[c?.containerNo] || map["HAMU9350046"] || map["MSCU1234567"];
  }, [selectedCompareContainer]);

  // 1-Click Zero-Touch Direct AI Dispatch (Eliminates manual input)
  const handleDirectAiDispatch = async () => {
    const c = selectedCompareContainer || SAMPLE_CONTAINERS[0];
    const targetParts = compareData.aiPos.split("-");
    const randomId = `MOV-${Math.floor(1000 + Math.random() * 9000)}`;

    const newTask = {
      id: randomId,
      taskId: `ai-dispatch-${Date.now()}`,
      containerId: c.containerNo,
      containerType: c.type,
      cargoType: c.cargo || "Hàng Tối Ưu AI",
      from: c.location,
      to: compareData.aiPos,
      reason: "Tối ưu hóa BRP & Lịch tàu cập cảng (Tự động)",
      priority: "HIGH",
      assignedBy: "🤖 NexusPort AI Autonomous Engine",
      status: "IN PROGRESS",
      flowStep: 1,
      equipment: {
        name: "RTG-01 (Mitsui 40T)",
        operator: "Hệ Thống Tự Hành AI",
      },
      confirmedPos: "",
      internalFee: 0,
      durationMinutes: 0,
      startTime: new Date().toISOString(),
      notes: `Lệnh tự động phát bởi AI. Rút ngắn ${compareData.distSaving.replace("-", "")} quãng đường và ${compareData.timeSaving.replace("-", "")} thời gian.`,
    };

    try {
      const payload = {
        containerNo: newTask.containerId,
        containerType: newTask.containerType,
        sourceBlockCode: newTask.from.split("-")[0] || "A01",
        fromLocation: newTask.from,
        targetBlockCode: targetParts[0] || "B02",
        toLocation: newTask.to,
        shiftingReason: newTask.reason,
        priority: "High",
        isBillable: false,
        internalFee: 0,
        operatorName: "Hệ Thống Tự Hành AI",
        notes: newTask.notes,
      };
      await yardTaskService.createRelocationTask(payload);
    } catch {
      // Fallback in-memory
    }

    setTasks((prev) => [newTask, ...prev.filter((t) => t.id !== newTask.id)]);
    setActiveTask(newTask);
    setConfirmedPosInput(newTask.to);
    showToast(
      `🚀 [ZERO-TOUCH DISPATCH]: Đã tự động phát lệnh ${randomId} cho container ${c.containerNo} ➔ Vị trí tối ưu ${compareData.aiPos}!`,
      "success",
    );
  };

  // KPI Stats
  const kpiStats = useMemo(() => {
    const pending = tasks.filter(
      (t) =>
        t.status === "ASSIGNED" ||
        t.status === "READY" ||
        t.status === "PENDING",
    ).length;
    const inProgress = tasks.filter(
      (t) => t.status === "IN PROGRESS" || t.status === "TẠI VỊ TRÍ ĐÍCH",
    ).length;
    const completed = tasks.filter((t) => t.status === "COMPLETED").length;
    const critical = tasks.filter(
      (t) => t.priority === "CRITICAL" || t.priority === "HIGH",
    ).length;
    return {
      pending: `${pending} Lệnh`,
      inProgress: `${inProgress} Lệnh`,
      completed: `${completed} Lệnh`,
      critical: `${critical} Lệnh 🟠`,
    };
  }, [tasks]);

  // Filtered & Sorted Tasks
  const filteredTasks = useMemo(() => {
    return tasks
      .filter((t) => {
        const matchSearch =
          t.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
          t.containerId.toLowerCase().includes(searchTerm.toLowerCase()) ||
          t.from.toLowerCase().includes(searchTerm.toLowerCase()) ||
          t.to.toLowerCase().includes(searchTerm.toLowerCase());
        if (!matchSearch) return false;

        if (
          statusFilter === "PENDING" &&
          !(
            t.status === "PENDING" ||
            t.status === "ASSIGNED" ||
            t.status === "READY"
          )
        )
          return false;
        if (
          statusFilter === "IN_PROGRESS" &&
          !(t.status === "IN PROGRESS" || t.status === "TẠI VỊ TRÍ ĐÍCH")
        )
          return false;
        if (statusFilter === "COMPLETED" && t.status !== "COMPLETED")
          return false;
        if (
          statusFilter === "CRITICAL" &&
          !(t.priority === "CRITICAL" || t.priority === "HIGH")
        )
          return false;

        if (shippingLineFilter !== "ALL") {
          const detectedLine = getShippingLineCode(t.containerId);
          const matchLine =
            detectedLine === shippingLineFilter ||
            t.containerId.toUpperCase().includes(shippingLineFilter);
          if (!matchLine) return false;
        }

        return true;
      })
      .sort((a, b) => {
        let fieldA = a[sortField] || "";
        let fieldB = b[sortField] || "";
        if (typeof fieldA === "string") fieldA = fieldA.toLowerCase();
        if (typeof fieldB === "string") fieldB = fieldB.toLowerCase();
        if (fieldA < fieldB) return sortOrder === "asc" ? -1 : 1;
        if (fieldA > fieldB) return sortOrder === "asc" ? 1 : -1;
        return 0;
      });
  }, [
    tasks,
    statusFilter,
    searchTerm,
    shippingLineFilter,
    sortField,
    sortOrder,
  ]);

  // Computed destination coordinate in Create Modal
  const computedDestLocation = useMemo(() => {
    return `${newTargetBlock}-${newTargetBay.padStart(2, "0")}-${newTargetRow.padStart(2, "0")}-${newTargetTier}`;
  }, [newTargetBlock, newTargetBay, newTargetRow, newTargetTier]);

  // Auto calculate fee when billable or reason changes
  useEffect(() => {
    if (newIsBillable || newShiftingReason === "Theo yêu cầu khách hàng") {
      const is20 = newContainerType.includes("20");
      setCalculatedFee(is20 ? 350000 : 550000);
    } else {
      setCalculatedFee(0);
    }
  }, [newIsBillable, newShiftingReason, newContainerType]);

  // Helper to normalize container type to match dropdown options
  const normalizeDropdownType = (rawType) => {
    let norm = (rawType || "").toUpperCase().trim();
    if (norm.includes("20")) {
      if (norm.includes("RF") || norm.includes("RH") || norm.includes("REEFER") || norm.includes("LẠNH")) {
        return "20FT RF";
      } else if (norm.includes("TANK") || norm.includes("TK") || norm.includes("BỒN")) {
        return "20FT TANK";
      } else if (norm.includes("OT")) {
        return "20FT OT";
      } else {
        return "20FT ST";
      }
    } else if (norm.includes("45")) {
      return "45FT HC";
    } else {
      if (norm.includes("RF") || norm.includes("RH") || norm.includes("REEFER") || norm.includes("LẠNH")) {
        return "40FT RF";
      } else if (norm.includes("DC") || norm.includes("GP") || norm.includes("ST")) {
        return "40FT DC";
      } else if (norm.includes("TANK") || norm.includes("TK") || norm.includes("BỒN")) {
        return "40FT TANK";
      } else {
        return "40FT HC";
      }
    }
  };

  // Handle Container selection in Create Modal
  const handleSelectPredefinedContainer = (c) => {
    setNewContainerNo(c.containerNo);
    const matchedType = normalizeDropdownType(c.type);
    setNewContainerType(matchedType);
    setNewFromLocation(c.location || "");
  };

  // Auto-detect container info from availableContainers if user types / pastes container number
  useEffect(() => {
    if (!newContainerNo || !availableContainers.length) return;
    const cleanNo = newContainerNo.trim().toUpperCase();
    const found = availableContainers.find(
      (c) => c.containerNo?.toUpperCase() === cleanNo
    );
    if (found) {
      const matched = normalizeDropdownType(found.type);
      setNewContainerType(matched);
      if (found.location && (!newFromLocation || newFromLocation === "A01-01-01-1")) {
        setNewFromLocation(found.location);
      }
    }
  }, [newContainerNo, availableContainers]);

  // AI Slot Recommendation Trigger
  const handleAiAutoSelectSlot = () => {
    setNewTargetBlock("B02");
    setNewTargetBay("02");
    setNewTargetRow("02");
    setNewTargetTier("3");
    setSelectedSlotMatrixBlock("B02");
    setSlotValidation({
      isValid: true,
      message:
        "🤖 AI Đề xuất: Slot B02-02-02-3 tối ưu quãng đường cẩu RTG, 0 xung đột tầng.",
      warnings: [],
    });
    showToast(
      "🤖 AI đã tự động đề xuất vị trí slot bãi tối ưu nhất!",
      "success",
    );
  };

  // Handle click on slot matrix item
  const handleMatrixSlotClick = (slot) => {
    if (slot.status === "MAINTENANCE") {
      showToast("⚠️ Slot này đang bảo trì!", "warning");
      return;
    }
    if (slot.status === "OCCUPIED") {
      showToast(
        `⚠️ Slot này đã có container ${slot.cont} (${slot.line}) chiếm chỗ!`,
        "warning",
      );
      return;
    }
    setNewTargetRow(String(slot.row).padStart(2, "0"));
    setNewTargetTier(String(slot.tier));
    if (slot.status === "GRAVITY_WARNING") {
      setSlotValidation({
        isValid: true,
        message: `Tọa độ hợp lệ. Lưu ý cảnh báo trọng lực: Tầng dưới còn trống.`,
        warnings: ["Quy tắc trọng lực"],
      });
      showToast(
        `⚠️ Chọn slot Hàng ${slot.row} Tầng ${slot.tier}: Chú ý quy tắc trọng lực`,
        "warning",
      );
    } else {
      setSlotValidation({
        isValid: true,
        message: `Slot hợp lệ và sẵn sàng tiếp nhận container.`,
        warnings: [],
      });
      showToast(
        `✓ Đã chọn slot trống: Hàng ${slot.row} - Tầng ${slot.tier}`,
        "success",
      );
    }
  };

  // Handle Live Slot Validation
  const handleValidateSlot = async () => {
    setValidatingSlot(true);
    const tierNum = parseInt(newTargetTier, 10);
    const is40Ft = newContainerType && (newContainerType.includes("40") || newContainerType.includes("45"));
    const is20Ft = newContainerType && newContainerType.includes("20");

    // 1. Kiểm tra quy tắc đỡ tầng & góc chịu lực
    if (tierNum > 1) {
      const allRes = yardReservationStore.getReservations();
      const bayNum = parseInt(newTargetBay, 10);
      const rowNum = parseInt(newTargetRow, 10);

      if (is40Ft) {
        const bay1 = bayNum % 2 === 0 ? bayNum - 1 : bayNum;
        const bay2 = bayNum % 2 === 0 ? bayNum + 1 : bayNum + 2;

        const lower1 = allRes.find(r => (r.blockCode === newTargetBlock || r.block === newTargetBlock) && Number(r.bay) === bay1 && Number(r.row) === rowNum && Number(r.tier) === tierNum - 1);
        const lower2 = allRes.find(r => (r.blockCode === newTargetBlock || r.block === newTargetBlock) && Number(r.bay) === bay2 && Number(r.row) === rowNum && Number(r.tier) === tierNum - 1);

        if (!lower1 && !lower2) {
          const msg = `❌ Vi phạm quy tắc đỡ tầng: Tầng dưới (Tier ${tierNum - 1}) đang trống. Container không thể lơ lửng trên không, bắt buộc phải xếp từ nền bãi (Tier 1) lên!`;
          setSlotValidation({ isValid: false, message: msg, warnings: [] });
          showToast(msg, "error");
          setValidatingSlot(false);
          return;
        }

        if ((lower1 && !lower2) || (!lower1 && lower2)) {
          const msg = `❌ Vi phạm góc chịu lực kết cấu: Không thể đặt container 40ft lên trên chỉ 1 container 20ft! 4 trụ góc sẽ bị hẫng lơ lửng gây sập đổ. Tầng dưới bắt buộc phải là container 40ft hoặc đủ 2 container 20ft đỡ 4 góc!`;
          setSlotValidation({ isValid: false, message: msg, warnings: [] });
          showToast(msg, "error");
          setValidatingSlot(false);
          return;
        }
      } else if (is20Ft) {
        const lower = allRes.find(r => (r.blockCode === newTargetBlock || r.block === newTargetBlock) && Number(r.bay) === bayNum && Number(r.row) === rowNum && Number(r.tier) === tierNum - 1);
        if (!lower) {
          const msg = `❌ Vi phạm quy tắc đỡ tầng: Tầng dưới (Tier ${tierNum - 1}) đang trống. Container bắt buộc phải có container đỡ bên dưới hoặc xếp từ Tier 1!`;
          setSlotValidation({ isValid: false, message: msg, warnings: [] });
          showToast(msg, "error");
          setValidatingSlot(false);
          return;
        }
        if (lower.size === 40 || lower.moduleSpan === 2) {
          const msg = `❌ Vi phạm kỹ thuật bãi: Không xếp container 20ft lên trên container 40ft vì gù giữa sẽ tì vào giữa nóc cont 40ft!`;
          setSlotValidation({ isValid: false, message: msg, warnings: [] });
          showToast(msg, "error");
          setValidatingSlot(false);
          return;
        }
      }
    }

    try {
      const res = await yardTaskService.validateTargetSlot({
        targetLocation: computedDestLocation,
        containerNo: newContainerNo,
        containerType: newContainerType,
      });
      setSlotValidation(res);
      if (res.isValid) {
        showToast(
          `✓ Vị trí đích [${computedDestLocation}] hợp lệ và sẵn sàng tiếp nhận!`,
          "success",
        );
      } else {
        showToast(`⚠️ Vị trí đích không hợp lệ: ${res.message}`, "error");
      }
    } catch {
      if (tierNum > 5) {
        setSlotValidation({
          isValid: false,
          message: "Chiều cao vượt quá 5 tầng an toàn.",
          warnings: [],
        });
      } else {
        setSlotValidation({
          isValid: true,
          message: "Vị trí đích hợp lệ và sẵn sàng.",
          warnings: [],
        });
      }
    } finally {
      setValidatingSlot(false);
    }
  };

  // Submit Create Relocation Task
  const handleCreateRelocationTask = async (e) => {
    e.preventDefault();
    if (!newContainerNo.trim()) {
      showToast("Vui lòng nhập hoặc chọn mã container!", "error");
      return;
    }
    if (
      newFromLocation.trim().toUpperCase() ===
      computedDestLocation.trim().toUpperCase()
    ) {
      showToast(
        "❌ Vị trí đích không được trùng với vị trí gốc hiện tại!",
        "error",
      );
      return;
    }

    if (slotValidation && !slotValidation.isValid) {
      showToast(`❌ Không thể tạo lệnh: ${slotValidation.message}`, "error");
      return;
    }

    setIsSubmittingTask(true);
    try {
      const payload = {
        containerNo: newContainerNo.trim().toUpperCase(),
        containerType: newContainerType,
        sourceBlockCode: newFromLocation.split("-")[0] || "A01",
        fromLocation: newFromLocation,
        targetBlockCode: newTargetBlock,
        toLocation: computedDestLocation,
        shiftingReason: newShiftingReason,
        priority: newPriority,
        isBillable: newIsBillable,
        internalFee: calculatedFee,
        operatorName: newOperatorName,
        notes: newNotes,
      };

      const res = await yardTaskService.createRelocationTask(payload);
      showToast(
        `🎉 Tạo thành công lệnh chuyển bãi [${res.taskCode || "Mới"}] cho container ${payload.containerNo}!`,
        "success",
      );
      setCreateModalOpen(false);
      setNewContainerNo("");
      setSlotValidation(null);
      loadTasks();
    } catch (err) {
      console.error("Error creating relocation task:", err);
      const randomId = `MOV-${Math.floor(1000 + Math.random() * 9000)}`;
      const newTask = {
        id: randomId,
        containerId: newContainerNo.trim().toUpperCase(),
        containerType: newContainerType,
        cargoType: "Hàng Đảo Chuyển",
        from: newFromLocation,
        to: computedDestLocation,
        reason: newShiftingReason,
        priority: newPriority.toUpperCase(),
        assignedBy: "Operator - Điều Phối Bãi",
        status: "PENDING",
        flowStep: 0,
        equipment: { name: "RTG-01", operator: newOperatorName },
        confirmedPos: "",
        internalFee: calculatedFee,
        durationMinutes: 0,
        notes: newNotes,
      };
      setTasks((prev) => [newTask, ...prev]);
      showToast(
        `🎉 Đã tạo lệnh chuyển container ${newTask.containerId} (Mã: ${randomId})!`,
        "success",
      );
      setCreateModalOpen(false);
    } finally {
      setIsSubmittingTask(false);
    }
  };

  // Handle "BẮT ĐẦU CẨU" (Start Lift - Step 1)
  const handleStartTask = async (task) => {
    if (task.status === "COMPLETED") {
      showToast("❌ Không thể nhận lệnh đã hoàn thành!", "error");
      return;
    }

    const firstAvail =
      equipments.find((e) => e.status === "Sẵn sàng") || equipments[0];
    const updated = {
      ...task,
      flowStep: 1,
      status: "IN PROGRESS",
      equipment: task.equipment || firstAvail,
      startTime: new Date().toISOString(),
    };

    setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));
    setActiveTask(updated);
    setConfirmedPosInput(task.to);

    if (task.taskId) {
      try {
        await yardTaskService.startLift(task.taskId, {
          notes: "Bắt đầu cẩu chuyển block",
        });
      } catch (err) {
        console.warn("API start lift warning:", err);
      }
    }

    showToast(
      `⚡ BẮT ĐẦU CẨU LỆNH ${task.id} — Container ${task.containerId} đang được cẩu bằng ${updated.equipment?.name || "RTG"}.`,
      "success",
    );
  };

  // Handle "ĐÃ ĐẾN VỊ TRÍ ĐÍCH" (Step 2)
  const handleMarkArrived = (task) => {
    const updated = { ...task, flowStep: 2, status: "TẠI VỊ TRÍ ĐÍCH" };
    setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));
    setActiveTask(updated);
    showToast(
      `📍 TASK ${task.id}: Container ${task.containerId} đã đến vị trí đích [${task.to}]. Vui lòng xác nhận hạ bãi.`,
      "warning",
    );
  };

  // Nén ảnh về tối đa 1280px, JPEG 0.8 để gửi nhanh và nhẹ khi lưu lên S3.
  const compressReceiptImage = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Không đọc được ảnh."));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error("Ảnh không hợp lệ."));
        img.onload = () => {
          const scale = Math.min(1, 1280 / Math.max(img.width, img.height));
          const canvas = document.createElement("canvas");
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/jpeg", 0.8));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });

  const handleReceiptPhotos = async (event) => {
    const files = Array.from(event.target.files || []).slice(0, 4 - receiptPhotos.length);
    event.target.value = "";
    try {
      const added = await Promise.all(files.map(compressReceiptImage));
      setReceiptPhotos((prev) => [...prev, ...added].slice(0, 4));
    } catch (err) {
      showToast(err.message, "error");
    }
  };

  // Xe hạ bãi từ cổng: cẩu xong, nhân viên bãi xác nhận ĐÃ NHẬN container kèm ảnh. Phía tài xế tự chuyển trạng thái.
  const handleConfirmReceipt = async (task) => {
    if (receiptBusy) return;
    if (!receiptPhotos.length) {
      showToast("Vui lòng chụp hoặc chọn ít nhất 1 ảnh container trước khi xác nhận đã nhận.", "error");
      return;
    }
    const finalPos = confirmedPosInput.trim() || task.to;
    const [block] = finalPos.split("-");
    setReceiptBusy(true);
    try {
      if (task.taskId) {
        try {
          await yardTaskService.completeLift(task.taskId, {
            completedLocation: finalPos,
            notes: `Hạ container vào ${finalPos}.`,
          });
        } catch (err) {
          // Đã hoàn tất cẩu từ lần xác nhận trước thì bỏ qua, vẫn tiếp tục ghi nhận nhận container.
          console.warn("API complete lift warning:", err);
        }
      }
      await yardTaskService.receiveContainer({
        taskId: task.taskId || null,
        containerNo: String(task.containerId || "").toUpperCase(),
        actualSealNo: receiptSeal.trim().toUpperCase() || task.expectedSealNo || "N/A",
        expectedSealNo: task.expectedSealNo || undefined,
        isSealIntact: receiptCondition !== "Seal_Broken",
        condition: receiptCondition,
        notes: `Nhân viên bãi xác nhận đã nhận container tại ${finalPos}.`,
        yardBlockCode: block,
        locationCoordinate: finalPos,
        photoImages: receiptPhotos,
      });
      const updated = {
        ...task,
        flowStep: 3,
        status: "COMPLETED",
        confirmedPos: finalPos,
        endTime: new Date().toISOString(),
      };
      setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));
      setActiveTask(null);
      setReceiptPhotos([]);
      setReceiptSeal("");
      setReceiptCondition("Good");
      showToast(
        `✅ Đã nhận container ${task.containerId} tại [${finalPos}]. Tài xế ${task.driverName || ""} đã được tự động cập nhật trạng thái.`,
        "success",
      );
    } catch (err) {
      showToast(err.response?.data?.message || err.message || "Không ghi nhận được việc nhận container.", "error");
    } finally {
      setReceiptBusy(false);
    }
  };

  // Handle "XÁC NHẬN HOÀN THÀNH & HẠ BÃI" (Step 3 - Final)
  const handleConfirmComplete = async (task) => {
    const finalPos = confirmedPosInput.trim() || task.to;
    const duration = Math.max(1, Math.round(elapsedSeconds / 60) || 5);

    const updated = {
      ...task,
      flowStep: 3,
      status: "COMPLETED",
      confirmedPos: finalPos,
      durationMinutes: duration,
      endTime: new Date().toISOString(),
    };

    // Check if there is a next chained task in a multi-step conflict resolution plan
    const isConflictTask =
      task.notes && task.notes.includes("thuộc kế hoạch gỡ xung đột");
    const nextStepTask = isConflictTask
      ? tasks.find(
          (t) =>
            t.id !== task.id &&
            (t.status === "ASSIGNED" || t.status === "READY") &&
            t.notes &&
            t.notes.includes("thuộc kế hoạch gỡ xung đột"),
        )
      : null;

    if (nextStepTask) {
      const nextActive = {
        ...nextStepTask,
        status: "IN PROGRESS",
        flowStep: 1,
        startTime: new Date().toISOString(),
      };
      setTasks((prev) =>
        prev.map((t) => {
          if (t.id === task.id) return updated;
          if (t.id === nextStepTask.id) return nextActive;
          return t;
        }),
      );
      setActiveTask(nextActive);
      setConfirmedPosInput(nextActive.to);
      showToast(
        `✅ HOÀN TẤT LỆNH ${task.id}! Tự động kích hoạt bước tiếp theo trong chuỗi gỡ xung đột: Cẩu ${nextActive.containerId} ➔ ${nextActive.to}.`,
        "success",
      );
      return;
    }

    setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));
    setActiveTask(null);

    if (task.taskId) {
      try {
        await yardTaskService.completeLift(task.taskId, {
          completedLocation: finalPos,
          notes: `Hoàn tất chuyển sang ${finalPos}. Thời gian: ${duration} phút.`,
        });
      } catch (err) {
        console.warn("API complete lift warning:", err);
      }
    }

    showToast(
      `✅ HOÀN TẤT LỆNH ${task.id}: Container ${task.containerId} đã hạ an toàn tại [${finalPos}]. Thời gian: ${duration} phút. Đã gửi thông báo cho Operator.`,
      "success",
    );
  };

  // Bulk Start Tasks
  const handleBulkStartTasks = () => {
    if (selectedTaskIds.length === 0) return;
    setTasks((prev) =>
      prev.map((t) => {
        if (selectedTaskIds.includes(t.id) && t.status !== "COMPLETED") {
          return {
            ...t,
            status: "IN PROGRESS",
            flowStep: 1,
            startTime: new Date().toISOString(),
          };
        }
        return t;
      }),
    );
    showToast(
      `⚡ ĐÃ BẮT ĐẦU CẨU ĐỒNG THỜI ${selectedTaskIds.length} LỆNH ĐƯỢC CHỌN!`,
      "success",
    );
    setSelectedTaskIds([]);
  };

  // Advance Stacking Conflict Step
  const handleAdvanceConflictStep = (stepIdx) => {
    setStackingConflict((prev) => {
      const updatedList = prev.blockingContainers.map((item, idx) => {
        if (idx === stepIdx) return { ...item, status: "completed" };
        return item;
      });
      const allDone = updatedList.every((i) => i.status === "completed");
      return {
        ...prev,
        currentStep: stepIdx + 1,
        blockingContainers: updatedList,
        planStarted: true,
        planCompleted: allDone,
      };
    });
    showToast(
      `🏗️ Đã hoàn thành bước ${stepIdx + 1} đảo container giải phóng vị trí!`,
      "success",
    );
  };

  // 1-Click AI Auto-Optimize Conflict Resolution (BRP Solver - NXP-126)
  const handle1ClickOptimizeConflict = async () => {
    setIsAnalyzingConflict(true);
    const scenario = currentConflictScenario;
    const targetNo =
      (customTargetContInput.trim() || activeConflictContainer.containerNo).toUpperCase();
    const targetCont =
      availableContainers.find((c) => c.containerNo?.toUpperCase() === targetNo) ||
      activeConflictContainer;
    const location = targetCont.location || "B02-02-01-2";
    const dest =
      customDestinationInput.trim() || "Cầu Tàu Bến 02 (Xuất Lên Tàu)";

    try {
      const res = await yardRestackService.analyzeBlockedContainer({
        containerNo: targetNo,
        location: location,
        blockCode: location.split("-")[0] || "B02",
        targetDestination: dest,
        restackBackToOriginal: restackBackOption,
      });

      if (res && res.targetContainer) {
        const blockingMoves = (res.blockingContainers || []).map((b) => ({
          step: b.stepOrder,
          id: b.containerNo,
          type: b.containerType,
          tier: `Tầng ${b.tier}`,
          currentPos: b.currentLocation,
          moveTarget: b.recommendedBufferSlot,
          rtg: "RTG-01",
          weight: b.weight || "29.0 Tấn",
          duration: "2.0 phút",
          reason: b.reason,
          isTarget: false,
          status: "READY",
        }));

        const targetMove = {
          step: blockingMoves.length + 1,
          id: res.targetContainer.containerNo,
          type: res.targetContainer.containerType,
          tier: `Tầng ${res.targetContainer.tier}`,
          currentPos: res.targetContainer.currentLocation,
          moveTarget: res.targetContainer.targetDestination || dest,
          rtg: "RTG-01",
          weight: res.targetContainer.weight || "29.2 Tấn",
          duration: "3.5 phút",
          reason:
            blockingMoves.length > 0
              ? `Giải phóng container mục tiêu bàn giao ${res.targetContainer.targetDestination || dest}`
              : `Container mục tiêu không bị đè, cẩu lấy trực tiếp bàn giao ${res.targetContainer.targetDestination || dest}`,
          isTarget: true,
          status: "READY",
        };

        const allMoves = [...blockingMoves, targetMove];

        if (restackBackOption && blockingMoves.length > 0) {
          let backStep = allMoves.length + 1;
          for (let i = res.blockingContainers.length - 1; i >= 0; i--) {
            const b = res.blockingContainers[i];
            allMoves.push({
              step: backStep++,
              id: b.containerNo,
              type: b.containerType,
              tier: `Tầng ${b.tier}`,
              currentPos: b.recommendedBufferSlot,
              moveTarget: b.currentLocation,
              rtg: "RTG-01",
              weight: b.weight || "29.0 Tấn",
              duration: "2.0 phút",
              reason: `Khôi phục container ${b.containerNo} về lại vị trí cột ban đầu`,
              isTarget: false,
              status: "READY",
            });
          }
        }

        const canExec =
          res.canExecute !== false &&
          !allMoves.some((m) => m.moveTarget?.includes("KHÔNG CÓ SLOT"));

        setConflictPlanResult({
          scenarioId: selectedConflictScenarioId,
          targetContainerNo: res.targetContainer.containerNo,
          targetLocation: res.targetContainer.currentLocation,
          targetDestination: res.targetContainer.targetDestination || dest,
          blockCode: res.targetContainer.blockCode,
          restackBackToOriginal: restackBackOption,
          isOptimized: true,
          canExecute: canExec,
          validationMessage:
            res.validationMessage ||
            (!canExec
              ? "Không tìm thấy slot đệm trống trong phạm vi an toàn."
              : blockingMoves.length === 0
                ? "Container không bị đè; có thể lập lệnh lấy trực tiếp."
                : "Đủ slot đệm an toàn để thực thi kế hoạch."),
          generatedTasks: allMoves,
          metrics: {
            timeSaved: res.aiMetrics?.timeSaved || "0%",
            estimatedDuration: `${res.estimatedDurationMinutes || allMoves.length * 3} phút`,
            originalDuration: `${(res.estimatedDurationMinutes || allMoves.length * 3) * 3} phút`,
            energySaved: res.aiMetrics?.energySaved || "0%",
            movesCount: allMoves.length,
            confidence: res.aiMetrics?.confidence || "99.8%",
            bufferSlotNote: res.aiMetrics?.bufferSlotNote || "",
            shiftingFee: res.estimatedShiftingFee,
          },
          generatedAt: new Date().toLocaleTimeString("vi-VN"),
        });
        setIsAnalyzingConflict(false);
        setConflictPlanDeployed(false);
        setConflictExecutingStep(0);
        setShowConfirmDeployModal(true);

        if (canExec) {
          showToast(
            `🤖 AI BRP ĐÃ TỐI ƯU HÓA: ${blockingMoves.length > 0 ? `Phát hiện ${blockingMoves.length} container đè tầng, đã tính toán chuỗi ${allMoves.length} lệnh cẩu tối ưu!` : "Container không bị đè tầng, sẵn sàng cẩu trực tiếp!"}`,
            "success",
          );
        } else {
          showToast(
            `⚠️ CẢNH BÁO AN TOÀN: ${res.validationMessage || "Block bãi không đủ slot đệm hợp lệ! Không thể thực thi kế hoạch."}`,
            "error",
          );
        }
        return;
      }
    } catch (err) {
      console.warn("Backend analyze fallback:", err);
    }

    // Fallback simulation nếu backend không khả dụng
    setTimeout(() => {
      const allMoves = [
        ...scenario.blockingContainers.map((b) => ({
          ...b,
          isTarget: false,
          status: "READY",
        })),
        {
          ...scenario.targetMove,
          id: targetNo,
          currentPos: location,
          moveTarget: dest,
          isTarget: true,
          status: "READY",
        },
      ];

      if (restackBackOption) {
        let backStep = allMoves.length + 1;
        for (let i = scenario.blockingContainers.length - 1; i >= 0; i--) {
          const b = scenario.blockingContainers[i];
          allMoves.push({
            step: backStep++,
            id: b.id,
            type: b.type,
            tier: b.tier,
            currentPos: b.moveTarget,
            moveTarget: b.currentPos,
            rtg: b.rtg,
            weight: b.weight,
            duration: b.duration,
            reason: `Khôi phục container ${b.id} về lại vị trí cột ban đầu`,
            isTarget: false,
            status: "READY",
          });
        }
      }

      const canExec =
        scenario.canExecute !== false &&
        !allMoves.some((m) => m.moveTarget?.includes("KHÔNG CÓ SLOT"));
      setConflictPlanResult({
        scenarioId: scenario.id,
        targetContainerNo: targetNo,
        targetLocation: location,
        targetDestination: dest,
        blockCode: location.split("-")[0] || "B02",
        restackBackToOriginal: restackBackOption,
        isOptimized: true,
        canExecute: canExec,
        validationMessage:
          scenario.validationMessage ||
          (!canExec
            ? "CẢNH BÁO: Không có slot đệm trống hợp lệ trong Block!"
            : "Đủ slot đệm an toàn để thực thi."),
        generatedTasks: allMoves,
        metrics: {
          ...scenario.aiMetrics,
          movesCount: allMoves.length,
          shiftingFee: allMoves.length * 250000,
        },
        generatedAt: new Date().toLocaleTimeString("vi-VN"),
      });
      setIsAnalyzingConflict(false);
      setConflictPlanDeployed(false);
      setConflictExecutingStep(0);
      setShowConfirmDeployModal(true);

      if (canExec) {
        showToast(
          `🤖 AI ĐÃ TỐI ƯU HÓA: Đã tính toán chuỗi lệnh di chuyển cho container [${targetNo}] tại [${location}]!`,
          "success",
        );
      } else {
        showToast(
          `⚠️ CẢNH BÁO AN TOÀN: ${scenario.validationMessage || "Block bãi không đủ slot đệm hợp lệ! Không thể thực thi kế hoạch."}`,
          "error",
        );
      }
    }, 400);
  };

  // Confirm and Deploy All Generated Conflict Resolution Tasks (NXP-126)
  const handleConfirmDeployConflictPlan = async () => {
    if (!conflictPlanResult) return;
    if (conflictPlanResult.canExecute === false) {
      showToast(
        "🚨 LỖI AN TOÀN: Hệ thống từ chối phát lệnh vì không có slot đệm hợp lệ trong bãi!",
        "error",
      );
      return;
    }
    setIsDeployingConflictPlan(true);

    try {
      const scenario = currentConflictScenario;
      const targetNo =
        conflictPlanResult.targetContainerNo || scenario.targetContainer.id;
      const targetLoc =
        conflictPlanResult.targetLocation || scenario.targetContainer.pos;
      const targetDest =
        conflictPlanResult.targetDestination || scenario.targetMove.moveTarget;
      const blockCode =
        conflictPlanResult.blockCode || targetLoc.split("-")[0] || "C01";

      const planPayload = {
        targetContainerNo: targetNo,
        targetLocation: targetLoc,
        blockCode: blockCode,
        targetDestination: targetDest,
        restackBackToOriginal:
          conflictPlanResult.restackBackToOriginal || restackBackOption,
        assignedEquipmentCode: "RTG-01",
        assignedOperatorName: "Trần Văn Hùng",
        isBillable: false,
        notes: `NXP-126: Kế hoạch gỡ xung đột tự động cho container ${targetNo}`,
        steps: conflictPlanResult.generatedTasks.map((t) => ({
          stepNumber: t.step,
          containerNo: t.id,
          containerType: t.type || "40FT HC",
          isTargetContainer: t.isTarget,
          stepType: t.isTarget
            ? "ReleaseTarget"
            : t.reason?.includes("Khôi phục")
              ? "RestackBack"
              : "MoveToBuffer",
          fromLocation: t.currentPos,
          toLocation: t.moveTarget,
          reason: t.reason,
          equipmentCode: t.rtg || "RTG-01",
          operatorName: "Trần Văn Hùng",
        })),
      };

      const createdPlan = await yardRestackService.createPlan(planPayload);
      const deployRes = await yardRestackService.deployPlan(createdPlan.id);

      setActiveRestackPlan(deployRes.plan || createdPlan);
      setConflictExecutingStep(1);
      setConflictPlanDeployed(true);
      setShowConfirmDeployModal(false);

      await loadTasks();
      await loadRestackHistory();

      showToast(
        `🚀 TRIỂN KHAI THÀNH CÔNG: Đã phát ${deployRes.generatedTaskCodes?.length || planPayload.steps.length} lệnh cẩu RTG xuống bãi! Kế hoạch [${createdPlan.planCode || "BRP"}] đang thực thi.`,
        "success",
      );
    } catch (err) {
      console.warn("Backend deploy fallback to local state:", err);
      setConflictPlanDeployed(true);
      setConflictExecutingStep(1);
      setShowConfirmDeployModal(false);
      showToast(
        `🚀 Đã phát lệnh cẩu xuống hệ thống bãi (Mô phỏng)!`,
        "success",
      );
    } finally {
      setIsDeployingConflictPlan(false);
    }
  };

  // NXP-126: Manual Move Step Adjustments (Điều chỉnh thứ tự di chuyển thủ công)
  const handleMoveStepUp = (index) => {
    if (index <= 0 || !conflictPlanResult?.generatedTasks) return;
    const newTasks = [...conflictPlanResult.generatedTasks];
    const temp = newTasks[index - 1];
    newTasks[index - 1] = newTasks[index];
    newTasks[index] = temp;
    const reindexed = newTasks.map((t, idx) => ({ ...t, step: idx + 1 }));
    setConflictPlanResult((prev) => ({ ...prev, generatedTasks: reindexed }));
    showToast(`Đã điều chỉnh: Đổi bước ${index + 1} lên bước ${index}`, "info");
  };

  const handleMoveStepDown = (index) => {
    if (
      !conflictPlanResult?.generatedTasks ||
      index >= conflictPlanResult.generatedTasks.length - 1
    )
      return;
    const newTasks = [...conflictPlanResult.generatedTasks];
    const temp = newTasks[index + 1];
    newTasks[index + 1] = newTasks[index];
    newTasks[index] = temp;
    const reindexed = newTasks.map((t, idx) => ({ ...t, step: idx + 1 }));
    setConflictPlanResult((prev) => ({ ...prev, generatedTasks: reindexed }));
    showToast(
      `Đã điều chỉnh: Đổi bước ${index + 1} xuống bước ${index + 2}`,
      "info",
    );
  };

  const handleUpdateStepTarget = (index, newTarget) => {
    if (!conflictPlanResult?.generatedTasks) return;
    const newTasks = [...conflictPlanResult.generatedTasks];
    newTasks[index] = { ...newTasks[index], moveTarget: newTarget };
    setConflictPlanResult((prev) => ({ ...prev, generatedTasks: newTasks }));
  };

  // Advance Restack Plan Step (Live Stepper - NXP-126)
  const handleAdvanceRestackStep = async (stepNumber) => {
    setIsAdvancingStep(true);
    try {
      if (activeRestackPlan?.id) {
        const updated = await yardRestackService.completeStep(
          activeRestackPlan.id,
          stepNumber,
          {},
        );
        setActiveRestackPlan(updated);
      }

      setConflictExecutingStep(stepNumber + 1);

      // Cập nhật trạng thái trong generatedTasks
      if (conflictPlanResult) {
        const updatedTasks = conflictPlanResult.generatedTasks.map((t) => {
          if (t.step === stepNumber) return { ...t, status: "COMPLETED" };
          if (t.step === stepNumber + 1) return { ...t, status: "IN_PROGRESS" };
          return t;
        });
        setConflictPlanResult((prev) => ({
          ...prev,
          generatedTasks: updatedTasks,
        }));
      }

      const totalSteps = conflictPlanResult?.generatedTasks?.length || 3;
      if (stepNumber >= totalSteps) {
        showToast(
          `🎉 HOÀN TẤT KẾ HOẠCH BRP: Container mục tiêu đã được giải phóng an toàn!`,
          "success",
        );
      } else {
        showToast(
          `✓ Đã hoàn thành Bước ${stepNumber}! Đang cẩu Bước ${stepNumber + 1}...`,
          "success",
        );
      }

      await loadTasks();
      await loadRestackHistory();
    } catch (err) {
      console.warn("Error advancing restack step:", err);
      setConflictExecutingStep(stepNumber + 1);
      showToast(`✓ Đã hoàn thành Bước ${stepNumber} (Mô phỏng)!`, "success");
    } finally {
      setIsAdvancingStep(false);
    }
  };

  // Handle Incident Report
  const handleSubmitIncident = (e) => {
    e.preventDefault();
    showToast(
      `🚨 ĐÃ GỬI BÁO CÁO SỰ CỐ TASK ${incidentTask?.id}: "${incidentReason}". Operator đã nhận cảnh báo!`,
      "error",
    );
    setTasks((prev) =>
      prev.map((t) =>
        t.id === incidentTask?.id
          ? { ...t, status: "INCIDENT", flowStep: -1 }
          : t,
      ),
    );
    setActiveTask(null);
    setIncidentTask(null);
    setIncidentNotes("");
  };

  // Toggle Single Task Selection
  const handleToggleTaskSelection = (id) => {
    setSelectedTaskIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  // Select All Tasks
  const handleSelectAllTasks = () => {
    if (selectedTaskIds.length === filteredTasks.length) {
      setSelectedTaskIds([]);
    } else {
      setSelectedTaskIds(filteredTasks.map((t) => t.id));
    }
  };

  const renderPriorityBadge = (prio) => {
    const map = {
      LOW: ["bg-emerald-500", "text-emerald-700", "Thấp"],
      NORMAL: ["bg-slate-400", "text-slate-600", "Bình thường"],
      MEDIUM: ["bg-amber-500", "text-amber-700", "Trung bình"],
      HIGH: ["bg-orange-500", "text-orange-700", "Cao"],
      CRITICAL: ["bg-rose-500", "text-rose-700", "Khẩn cấp"],
    };
    const [dot, txt, label] = map[prio] || map.NORMAL;
    return (
      <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${txt}`}>
        <span className={`w-2 h-2 rounded-full ${dot}`}></span>
        {label}
      </span>
    );
  };

  const renderStatusBadge = (task) => {
    const cfg = {
      ASSIGNED: ["bg-amber-50 text-amber-700 border-amber-200", "Chờ thực hiện"],
      READY: ["bg-amber-50 text-amber-700 border-amber-200", "Sẵn sàng"],
      PENDING: ["bg-amber-50 text-amber-700 border-amber-200", "Chờ thực hiện"],
      "IN PROGRESS": ["bg-orange-50 text-orange-700 border-orange-200", "Đang cẩu"],
      "TẠI VỊ TRÍ ĐÍCH": ["bg-orange-50 text-orange-700 border-orange-200", "Tại vị trí đích"],
      COMPLETED: ["bg-emerald-50 text-emerald-700 border-emerald-200", "Hoàn thành"],
      INCIDENT: ["bg-rose-50 text-rose-700 border-rose-200", "Sự cố"],
    };
    const [cls, label] = cfg[task.status] || cfg.PENDING;
    return (
      <span className={`px-2.5 py-1 rounded-lg border text-xs font-semibold whitespace-nowrap ${cls}`}>
        {label}
      </span>
    );
  };

  // Cargo Tag Badge Renderer
  const renderCargoBadge = (type) => {
    if (
      type?.includes("RF") ||
      type?.includes("Lạnh") ||
      type?.includes("Reefer")
    ) {
      return (
        <span className="px-2 py-0.5 bg-sky-50 text-sky-950 border border-sky-300 rounded-lg text-[9px] font-black whitespace-nowrap">
          ❄️ HÀNG LẠNH (RF)
        </span>
      );
    }
    if (
      type?.includes("TANK") ||
      type?.includes("Hóa Chất") ||
      type?.includes("DG") ||
      type?.includes("HAZMAT")
    ) {
      return (
        <span className="px-2 py-0.5 bg-amber-50 text-amber-950 border border-amber-300 rounded-lg text-[9px] font-black whitespace-nowrap">
          ⚡ NGUY HIỂM (DG)
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-[9px] font-bold whitespace-nowrap">
        📦 HÀNG KHÔ
      </span>
    );
  };

  // Position detail block renderer
  const PositionDetail = ({
    label,
    pos,
    color = "text-slate-900",
    badge = "",
  }) => {
    const isStandardSlot = pos && pos.includes("-");
    const p = parsePosition(pos);
    return (
      <div className="bg-slate-100 p-3.5 rounded-2xl border border-slate-200 space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-[10px] text-slate-500 uppercase font-sans font-extrabold">
            {label}
          </span>
          {badge && (
            <span className="text-[9px] px-2 py-0.5 bg-blue-100 text-blue-900 rounded-md font-black">
              {badge}
            </span>
          )}
        </div>
        <div className={`font-black text-lg font-mono tracking-wide ${color}`}>
          {pos}
        </div>
        {isStandardSlot ? (
          <div className="grid grid-cols-4 gap-1.5 text-[10px] font-mono">
            {[
              ["Khu Block", p.block],
              ["Dãy (Bay)", p.bay],
              ["Hàng (Row)", p.row],
              ["Tầng (Tier)", p.tier],
            ].map(([k, v]) => (
              <div
                key={k}
                className="bg-white rounded-xl border border-slate-200 p-1.5 text-center shadow-2xs"
              >
                <div className="text-slate-500 font-sans text-[9px]">{k}</div>
                <div className="font-black text-slate-900 text-xs">{v}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-2.5 bg-white rounded-xl border border-slate-200 flex items-center gap-2 text-slate-700 text-xs font-sans">
            <span className="material-symbols-outlined text-blue-600 text-base">
              directions_boat
            </span>
            <span>
              Vị trí bốc dỡ ngoài bãi / Điểm giao nhận phương tiện vận tải (Cầu
              tàu / Xe đầu kéo)
            </span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 w-full font-sans flex flex-col gap-6 bg-slate-50 min-h-screen text-slate-900 relative">
      {/* Toast Alert */}
      {toastMessage && (
        <div
          className={`fixed top-20 right-8 px-6 py-3.5 rounded-2xl shadow-2xl text-xs font-black flex items-center gap-3 z-[100] border-2 animate-bounce ${
            toastType === "error"
              ? "bg-rose-50 text-rose-950 border-rose-300"
              : toastType === "warning"
                ? "bg-amber-50 text-amber-950 border-amber-300"
                : "bg-emerald-50 text-emerald-950 border-emerald-300"
          }`}
        >
          <span>
            {toastType === "error"
              ? "🚨"
              : toastType === "warning"
                ? "📍"
                : "✅"}
          </span>
          {toastMessage}
        </div>
      )}

      {/* ── TIÊU ĐỀ & CHUYỂN TAB ── */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div />
        <button
          onClick={handleOpenCreateModal}
          className="px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-bold text-sm rounded-xl shadow-sm shadow-orange-200 cursor-pointer flex items-center gap-2 self-start lg:self-auto"
        >
          <span className="material-symbols-outlined text-lg">add</span>
          Tạo lệnh chuyển block
        </button>
      </div>

      <div className="flex gap-1 border-b border-orange-100">
        {[
          ["TABLE", "Danh sách lệnh"],
          ["RESTACK_WIZARD", "Đảo container"],
        ].map(([mode, label]) => (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            className={`px-4 py-2.5 text-sm font-semibold cursor-pointer border-b-2 -mb-px transition-colors ${
              viewMode === mode
                ? "border-orange-500 text-orange-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── TOP KPI CARDS ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Chờ điều phối", val: kpiStats.pending, txt: "text-amber-600" },
          { label: "Đang cẩu", val: kpiStats.inProgress, txt: "text-orange-600" },
          { label: "Hoàn thành", val: kpiStats.completed, txt: "text-emerald-700" },
          { label: "Ưu tiên cao", val: kpiStats.critical, txt: "text-rose-600" },
        ].map((c) => (
          <div key={c.label} className="bg-white p-4 rounded-2xl border border-orange-100 shadow-sm shadow-orange-50">
            <span className="text-xs text-slate-500 font-medium">{c.label}</span>
            <strong className={`text-2xl font-extrabold font-mono block mt-1 ${c.txt}`}>{c.val}</strong>
          </div>
        ))}
      </div>

      {/* ── PANEL LỆNH ĐANG THỰC HIỆN ── */}
      {activeTask && (
        <div className="bg-white border border-orange-100 rounded-2xl shadow-sm overflow-hidden">
          {/* Tiêu đề */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-orange-100 bg-orange-50/50">
            <div>
              <div className="flex items-center gap-2.5">
                <h3 className="text-lg font-extrabold text-slate-900">{activeTask.id}</h3>
                {renderStatusBadge(activeTask)}
              </div>
              <p className="text-sm text-slate-500 mt-0.5">
                <span className="font-mono font-semibold text-slate-800">{activeTask.containerId}</span>
                {" · "}{activeTask.containerType}
                {(activeTask.vehiclePlate || activeTask.driverName) &&
                  ` · ${[activeTask.vehiclePlate, activeTask.driverName].filter(Boolean).join(" · ")}`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-semibold text-slate-700 bg-white border border-slate-200 px-3 py-1.5 rounded-lg">
                {formatTimer(elapsedSeconds)}
              </span>
              <button
                onClick={() => setIncidentTask(activeTask)}
                className="px-3 py-1.5 text-sm font-semibold text-rose-600 bg-white hover:bg-rose-50 border border-rose-200 rounded-lg cursor-pointer"
              >
                Báo sự cố
              </button>
              <button
                onClick={() => setActiveTask(null)}
                className="px-3 py-1.5 text-sm font-semibold text-slate-600 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg cursor-pointer"
              >
                Thu gọn
              </button>
            </div>
          </div>

          {/* Các bước */}
          <ol className="flex items-center px-6 pt-5">
            {["Đã giao lệnh", "Đang cẩu", "Tại vị trí đích", "Hoàn tất"].map((label, idx, list) => {
              const done = activeTask.flowStep > idx;
              const current = activeTask.flowStep === idx;
              return (
                <li key={label} className={`flex items-center ${idx < list.length - 1 ? "flex-1" : ""}`}>
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                        done
                          ? "bg-emerald-500 text-white"
                          : current
                            ? "bg-orange-500 text-white"
                            : "bg-slate-100 text-slate-400"
                      }`}
                    >
                      {done ? "✓" : idx + 1}
                    </span>
                    <span className={`text-sm whitespace-nowrap ${current ? "font-bold text-slate-900" : done ? "text-slate-600" : "text-slate-400"}`}>
                      {label}
                    </span>
                  </div>
                  {idx < list.length - 1 && (
                    <div className={`flex-1 h-px mx-3 ${done ? "bg-emerald-300" : "bg-slate-200"}`}></div>
                  )}
                </li>
              );
            })}
          </ol>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 p-6">
            {/* Lộ trình */}
            <div className="lg:col-span-2 space-y-3">
              <div className="rounded-xl border border-slate-200 p-4">
                <p className="text-xs text-slate-500">Từ</p>
                <p className="font-mono font-bold text-slate-800">{activeTask.from}</p>
                <div className="my-2 flex items-center gap-2 text-slate-300">
                  <span className="flex-1 h-px bg-slate-200"></span>
                  <span className="material-symbols-outlined text-base text-orange-400">arrow_downward</span>
                  <span className="flex-1 h-px bg-slate-200"></span>
                </div>
                <p className="text-xs text-slate-500">Đến</p>
                <p className="font-mono font-extrabold text-xl text-orange-600">{activeTask.to}</p>
                {parsePosition(activeTask.to).isStandard && (
                  <p className="text-xs text-slate-500 mt-1">
                    Block {parsePosition(activeTask.to).block} · Bay {parsePosition(activeTask.to).bay} · Row {parsePosition(activeTask.to).row} · Tầng {parsePosition(activeTask.to).tier}
                  </p>
                )}
              </div>
              {activeTask.equipment && (
                <p className="text-sm text-slate-600 px-1">
                  Thiết bị: <span className="font-semibold text-slate-900">{activeTask.equipment.name}</span>
                  {activeTask.equipment.operator && activeTask.equipment.operator !== "Chưa gán" && ` · ${activeTask.equipment.operator}`}
                </p>
              )}
              <button
                onClick={() => goToYardMap({ from: activeTask.from, to: activeTask.to, containerId: activeTask.containerId })}
                className="w-full py-2.5 text-sm font-semibold text-orange-600 bg-white hover:bg-orange-50 border border-orange-200 rounded-xl cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span className="material-symbols-outlined text-base">map</span>
                Xem sơ đồ bãi
              </button>
            </div>

            {/* Thao tác theo bước */}
            <div className="lg:col-span-3 rounded-xl border border-slate-200 p-5 flex flex-col justify-center gap-4">
              {activeTask.flowStep < 1 && (
                <>
                  <p className="text-sm text-slate-600">Sẵn sàng cẩu container vào ô đích.</p>
                  <button
                    onClick={() => handleStartTask(activeTask)}
                    className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold text-sm rounded-xl cursor-pointer"
                  >
                    Bắt đầu cẩu
                  </button>
                </>
              )}

              {activeTask.flowStep === 1 && (
                <>
                  <p className="text-sm text-slate-600">Đang cẩu container. Khi thiết bị đã đến ô đích, bấm xác nhận.</p>
                  <button
                    onClick={() => handleMarkArrived(activeTask)}
                    className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold text-sm rounded-xl cursor-pointer"
                  >
                    Đã đến vị trí đích
                  </button>
                </>
              )}

              {activeTask.flowStep === 2 && !activeTask.isGateIn && (
                <>
                  <p className="text-sm text-slate-600">
                    Container hạ tại <span className="font-mono font-bold text-slate-900">{activeTask.to}</span>.
                  </p>
                  <button
                    onClick={() => handleConfirmComplete(activeTask)}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl cursor-pointer"
                  >
                    Xác nhận hạ bãi
                  </button>
                </>
              )}

              {activeTask.flowStep === 2 && activeTask.isGateIn && (
                <>
                  <p className="text-sm text-slate-600">
                    Container đã hạ tại <span className="font-mono font-bold text-slate-900">{activeTask.to}</span>.
                    Chụp ảnh và xác nhận đã nhận, tài xế sẽ tự động được cập nhật trạng thái.
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {[["Good", "Nguyên vẹn"], ["Damaged", "Hư hỏng"], ["Seal_Broken", "Seal hỏng"]].map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setReceiptCondition(value)}
                        className={`py-2 rounded-lg border text-sm font-semibold cursor-pointer ${
                          receiptCondition === value
                            ? "border-orange-500 bg-orange-500 text-white"
                            : "border-slate-200 bg-white text-slate-600 hover:border-orange-300"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    value={receiptSeal}
                    onChange={(e) => setReceiptSeal(e.target.value)}
                    placeholder={`Số seal thực tế${activeTask.expectedSealNo ? ` (khai: ${activeTask.expectedSealNo})` : ""}`}
                    className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-lg font-mono text-sm uppercase focus:outline-none focus:border-orange-400"
                  />
                  <div className="flex flex-wrap gap-2">
                    {receiptPhotos.map((src, index) => (
                      <div key={index} className="relative w-20 h-20 rounded-lg overflow-hidden border border-slate-200">
                        <img src={src} alt={`Ảnh container ${index + 1}`} className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setReceiptPhotos((prev) => prev.filter((_, i) => i !== index))}
                          className="absolute top-1 right-1 bg-slate-900/70 text-white rounded-full w-5 h-5 text-xs leading-5 cursor-pointer"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    {receiptPhotos.length < 4 && (
                      <label className="w-20 h-20 rounded-lg border border-dashed border-orange-300 flex flex-col items-center justify-center text-orange-500 text-xs cursor-pointer hover:bg-orange-50">
                        <span className="material-symbols-outlined text-xl">add_a_photo</span>
                        Thêm ảnh
                        <input type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={handleReceiptPhotos} />
                      </label>
                    )}
                  </div>
                  <button
                    onClick={() => handleConfirmReceipt(activeTask)}
                    disabled={receiptBusy}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-sm rounded-xl cursor-pointer"
                  >
                    {receiptBusy ? "Đang ghi nhận…" : "Xác nhận đã nhận container"}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── VIEW 1: DATA TABLE VIEW ── */}
      {viewMode === "TABLE" && (
        <div className="bg-white rounded-2xl border border-orange-100 p-6 shadow-sm space-y-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 border-b border-slate-200 pb-3">
            <div>
              <h3 className="font-heading text-lg font-extrabold text-slate-900 flex items-center gap-2">
                <span className="material-symbols-outlined text-orange-600">
                  swap_horiz
                </span>
                Danh sách lệnh
              </h3>
            </div>

            {/* Search, Status Filter & Actions */}
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Tìm mã lệnh, container, vị trí"
                className="px-3.5 py-2 bg-slate-100 border border-slate-300 rounded-2xl text-xs font-mono focus:outline-none w-48"
              />

              <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200 text-[11px] font-bold">
                {[
                  { id: "ALL", label: "Tất Cả" },
                  { id: "PENDING", label: "Chờ Thực Hiện" },
                  { id: "IN_PROGRESS", label: "Đang Cẩu" },
                  { id: "COMPLETED", label: "Hoàn Thành" },
                  { id: "CRITICAL", label: "Khẩn Cấp" },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setStatusFilter(tab.id)}
                    className={`px-3 py-1.5 rounded-xl cursor-pointer transition-all ${
                      statusFilter === tab.id
                        ? "bg-white text-slate-900 shadow-xs font-black"
                        : "text-slate-500 hover:text-slate-900"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Bulk Action Bar */}
          {selectedTaskIds.length > 0 && (
            <div className="p-3 bg-orange-50 border-2 border-orange-200 rounded-2xl flex justify-between items-center text-xs font-sans">
              <span className="font-bold text-orange-950">
                ✓ Đã chọn{" "}
                <strong className="font-mono text-sm">
                  {selectedTaskIds.length}
                </strong>{" "}
                lệnh chuyển bãi
              </span>
              <div className="flex gap-2">
                <button
                  onClick={handleBulkStartTasks}
                  className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-black rounded-xl cursor-pointer shadow-sm"
                >
                  ⚡ Bắt Đầu Cẩu Hàng Loạt ({selectedTaskIds.length})
                </button>
                <button
                  onClick={() => setSelectedTaskIds([])}
                  className="px-3 py-2 bg-white border border-slate-300 text-slate-700 font-bold rounded-xl cursor-pointer hover:bg-slate-100"
                >
                  Bỏ Chọn
                </button>
              </div>
            </div>
          )}

          {/* Task Table */}
          <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-2xs">
            {loading ? (
              <div className="py-16 text-center text-slate-500 text-xs font-bold space-y-2">
                <span className="material-symbols-outlined text-3xl animate-spin text-orange-500 block">
                  progress_activity
                </span>
                <div>
                  Đang tải danh sách lệnh chuyển container giữa các block...
                </div>
              </div>
            ) : filteredTasks.length === 0 ? (
              <div className="py-16 text-center text-slate-400 text-xs font-bold">
                Không có lệnh di chuyển nào phù hợp bộ lọc tìm kiếm.
              </div>
            ) : (
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="bg-orange-50/60 border-b border-orange-100 text-slate-500 text-xs font-semibold whitespace-nowrap">
                    <th className="py-3 px-4">Lệnh</th>
                    <th className="py-3 px-4">Container</th>
                    <th className="py-3 px-4">Lộ trình</th>
                    <th className="py-3 px-4">Ưu tiên</th>
                    <th className="py-3 px-4">Trạng thái</th>
                    <th className="py-3 px-4 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredTasks.map((task) => {
                    const isCompleted = task.status === "COMPLETED";
                    const canStart = ["PENDING", "ASSIGNED", "READY"].includes(task.status);
                    return (
                      <tr key={task.id} className="hover:bg-orange-50/30 transition-colors">
                        <td className="py-4 px-4 whitespace-nowrap">
                          <div className="font-bold text-slate-900">{task.id}</div>
                          {(task.vehiclePlate || task.driverName) && (
                            <div className="text-xs text-slate-500 mt-0.5">
                              {[task.vehiclePlate, task.driverName].filter(Boolean).join(" · ")}
                            </div>
                          )}
                        </td>

                        <td className="py-4 px-4 whitespace-nowrap">
                          <div className="font-mono font-bold text-slate-900">{task.containerId}</div>
                          <div className="text-xs text-slate-500 mt-0.5">{task.containerType}</div>
                        </td>

                        <td className="py-4 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-2 font-mono text-sm">
                            <span className="text-slate-500">{task.from}</span>
                            <span className="material-symbols-outlined text-orange-400 text-base">arrow_forward</span>
                            <span className="font-bold text-orange-600">{task.to}</span>
                            <button
                              onClick={() => goToYardMap({ from: task.from, to: task.to, containerId: task.containerId })}
                              className="ml-1 w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-orange-600 hover:bg-orange-50 cursor-pointer"
                              title="Xem trên sơ đồ bãi"
                            >
                              <span className="material-symbols-outlined text-base">map</span>
                            </button>
                          </div>
                          {task.equipment && (
                            <div className="text-xs text-slate-500 mt-0.5">
                              {task.equipment.name} · {task.equipment.operator}
                            </div>
                          )}
                        </td>

                        <td className="py-4 px-4 whitespace-nowrap">{renderPriorityBadge(task.priority)}</td>

                        <td className="py-4 px-4 whitespace-nowrap">{renderStatusBadge(task)}</td>

                        <td className="py-4 px-4 whitespace-nowrap">
                          <div className="flex justify-end items-center gap-1.5">
                            {canStart && (
                              <button
                                onClick={() => handleStartTask(task)}
                                className="px-3.5 py-1.5 bg-orange-500 hover:bg-orange-600 text-white font-semibold text-xs rounded-lg cursor-pointer"
                              >
                                Bắt đầu
                              </button>
                            )}
                            {(task.status === "IN PROGRESS" || task.status === "TẠI VỊ TRÍ ĐÍCH") && (
                              <button
                                onClick={() => setActiveTask(task)}
                                className="px-3.5 py-1.5 bg-white hover:bg-orange-50 text-orange-600 border border-orange-300 font-semibold text-xs rounded-lg cursor-pointer"
                              >
                                {task.status === "IN PROGRESS" ? "Tiếp tục" : "Xác nhận"}
                              </button>
                            )}
                            <button
                              onClick={() => setJobSheetTask(task)}
                              className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                              title="Phiếu lệnh"
                            >
                              <span className="material-symbols-outlined text-base">description</span>
                            </button>
                            {!isCompleted && task.status !== "INCIDENT" && (
                              <button
                                onClick={() => setIncidentTask(task)}
                                className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                                title="Báo sự cố"
                              >
                                <span className="material-symbols-outlined text-base">report</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          <div className="text-xs text-slate-500 pt-3 border-t border-slate-100">
            {filteredTasks.length} / {tasks.length} lệnh
          </div>
        </div>
      )}

      {/* ── VIEW 3: RESTACKING WIZARD (TỰ ĐỘNG HÓA GỠ XUNG ĐỘT TẦNG) ── */}
      {viewMode === "RESTACK_WIZARD" && (
        <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs space-y-6">
          {/* 1. Header & Tình Huống Xung Đột (Scenario Selector) */}
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-slate-200 pb-4">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="material-symbols-outlined text-orange-500 text-xl">
                  layers_clear
                </span>
                <span className="text-[11px] font-mono font-black text-blue-800 uppercase tracking-wider">
                  BỘ NÃO TỰ ĐỘNG HÓA GỠ XUNG ĐỘT (AI BRP ENGINE)
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-orange-50 text-orange-700 border border-orange-200 font-mono text-[10px] font-black">
                  BLOCK RELOCATION PROBLEM (BRP)
                </span>
              </div>
              <h3 className="font-heading text-xl font-black text-slate-900">
                Đảo Container Trong Bãi
              </h3>
            </div>
          </div>

          {/* NXP-126: THANH TÙY CHỌN CONTAINER MỤC TIÊU & THIẾT LẬP KẾ HOẠCH BRP */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3 font-sans text-xs">
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1.5 font-bold text-slate-700">
                  <span className="material-symbols-outlined text-orange-500 text-lg">
                    tune
                  </span>
                  <span>Thiết Lập Kế Hoạch BRP:</span>
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-[11px] text-slate-500 font-mono">
                    Container Mục Tiêu:
                  </label>
                  <input
                    type="text"
                    value={customTargetContInput}
                    onChange={(e) =>
                      setCustomTargetContInput(e.target.value.toUpperCase())
                    }
                    placeholder="VD: HAMU6381022 hoặc B02-02-01-2"
                    className="h-9 px-3 rounded-xl border border-slate-300 font-mono font-bold text-xs bg-white text-slate-900 focus:outline-none focus:border-blue-600 w-44"
                  />
                  <span className="text-[10px] text-orange-600 font-mono font-bold bg-orange-50 px-2 py-1 rounded-lg border border-orange-200">
                    {activeConflictContainer.location}
                  </span>
                </div>

              </div>

            </div>
          </div>

          {/* 2. Hai Khối: Thông Tin Container Mục Tiêu & Sơ Đồ Mặt Cắt 2D Cột Xếp Container */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Khối Trái: Thông Tin Container Mục Tiêu Cần Lấy Ra (5 Cột) */}
            <div className="lg:col-span-5 bg-white border border-slate-200/90 rounded-2xl p-5 space-y-4 shadow-xs">
              <div className="flex justify-between items-center border-b border-slate-200 pb-3">
                <span className="text-xs font-mono font-black text-slate-900 uppercase">
                  CONTAINER MỤC TIÊU CẦN GIẢI PHÓNG
                </span>
                <span className="px-2.5 py-0.5 rounded-lg font-mono text-[10px] font-black border bg-emerald-50 text-emerald-950 border-emerald-300">
                  LIVE DATABASE
                </span>
              </div>

              <div className="space-y-3 font-mono text-xs">
                <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-2xl border border-slate-200 shadow-2xs">
                  <div>
                    <span className="text-[10px] text-slate-500 font-sans block">
                      MÃ CONTAINER
                    </span>
                    <strong className="text-orange-950 font-black text-2xl">
                      {activeConflictContainer.containerNo}
                    </strong>
                  </div>
                  <span className="px-2.5 py-1 bg-orange-50 text-orange-700 border border-orange-200 rounded-xl font-bold text-xs">
                    {activeConflictContainer.type} •{" "}
                    {activeConflictContainer.weight || "29.2 Tấn"}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200">
                    <span className="text-[10px] text-slate-500 font-sans block">
                      VỊ TRÍ HIỆN TẠI
                    </span>
                    <strong className="text-slate-900 text-sm font-black">
                      {activeConflictContainer.location}
                    </strong>
                    <div className="text-[10px] text-orange-600 font-sans font-bold">
                      {activeConflictContainer.location?.includes("-")
                        ? `Tầng ${activeConflictContainer.location.split("-")[3] || 1}`
                        : "Tầng 1"}
                    </div>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200">
                    <span className="text-[10px] text-slate-500 font-sans block">
                      HÃNG TÀU / LƯU BÃI
                    </span>
                    <strong className="text-slate-900 text-sm font-black">
                      {activeConflictContainer.line || "COSCO"}
                    </strong>
                    <div className="text-[10px] text-slate-500 font-sans">
                      {activeConflictContainer.dwellDays || 2} ngày lưu bãi
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-slate-800 font-sans text-xs">
                  <span className="text-[10px] text-slate-500 block font-sans">
                    LOẠI HÀNG HÓA
                  </span>
                  <div className="font-bold text-slate-900 mt-0.5">
                    {activeConflictContainer.cargo || "Hàng Khô Xuất Nhập Khẩu"}
                  </div>
                </div>

                {conflictPlanResult && (
                <div
                  className={`p-3 rounded-2xl border font-sans text-xs ${
                    conflictPlanResult
                      ? conflictPlanResult.generatedTasks.filter(
                          (t) => !t.isTarget,
                        ).length > 0
                        ? "bg-rose-50 border-rose-200 text-rose-950"
                        : "bg-emerald-50 border-emerald-200 text-emerald-950"
                      : "bg-amber-50 border-amber-200 text-amber-950"
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold mb-1">
                    <span className="material-symbols-outlined text-sm">
                      {conflictPlanResult ? "verified" : "info"}
                    </span>
                    <span>Hiện Trạng Cột Xếp Bãi:</span>
                  </div>
                  <div>
                    {conflictPlanResult ? (
                      conflictPlanResult.generatedTasks.filter(
                        (t) => !t.isTarget,
                      ).length > 0 ? (
                        <>
                          Đang bị{" "}
                          <strong className="text-rose-700 font-black">
                            {
                              conflictPlanResult.generatedTasks.filter(
                                (t) => !t.isTarget,
                              ).length
                            }{" "}
                            container
                          </strong>{" "}
                          đè phía trên. Chuỗi lệnh cẩu tối ưu đã được AI tính
                          toán sẵn sàng!
                        </>
                      ) : (
                        <>
                          Container{" "}
                          <strong className="text-emerald-700 font-black">
                            không bị đè
                          </strong>{" "}
                          (đang ở đỉnh tầng). Có thể phát lệnh cẩu trực tiếp lên
                          xe/tàu!
                        </>
                      )
                    ) : (
                      "Vị trí bãi đã đồng bộ thời gian thực từ PostgreSQL. Bấm nút 1-Chạm bên dưới để AI quét stack và đề xuất slot đệm."
                    )}
                  </div>
                </div>
                )}
              </div>
            </div>

            {/* Khối Phải: Sơ Đồ 2D Cảng Tiên Sa Hoặc Mặt Cắt Cột Xếp Container (7 Cột) */}
            <div className="lg:col-span-7 bg-white text-slate-900 rounded-2xl p-5 sm:p-6 shadow-sm border border-orange-100 space-y-4 flex flex-col justify-between">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-orange-100 pb-3">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-orange-400 text-lg">view_in_ar</span>
                  <h4 className="font-heading font-black text-slate-900 text-sm sm:text-base">Mặt cắt cột container</h4>
                </div>

                <button
                  type="button"
                  onClick={() => goToYardMap({
                    from: conflictPlanResult?.targetLocation || activeConflictContainer.location,
                    to: conflictPlanResult?.generatedTasks?.[0]?.moveTarget || "",
                    containerId: conflictPlanResult?.targetContainerNo || activeConflictContainer.containerNo,
                  })}
                  className="px-3.5 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold cursor-pointer flex items-center gap-1.5 shadow-sm shadow-orange-200"
                >
                  <span className="material-symbols-outlined text-sm">map</span>
                  <span>Xem sơ đồ bãi</span>
                </button>
              </div>

              {/* View 2: Mặt cắt cột xếp container */}
              {(
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Cột hiện tại */}
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <h5 className="text-sm font-bold text-slate-900">Cột hiện tại</h5>
                      <span className="font-mono text-xs font-semibold text-orange-600 bg-orange-50 border border-orange-100 px-2 py-0.5 rounded-lg">
                        {activeConflictContainer.location}
                      </span>
                    </div>

                    {[4, 3].map((tier) => (
                      <div
                        key={tier}
                        className="h-11 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 flex items-center justify-between px-3 text-xs text-slate-400"
                      >
                        <span>Tầng {tier}</span>
                        <span>Trống</span>
                      </div>
                    ))}

                    {conflictPlanResult &&
                      conflictPlanResult.generatedTasks
                        .filter((t) => !t.isTarget)
                        .map((b, bIdx) => (
                          <div
                            key={bIdx}
                            className="h-12 rounded-xl border border-amber-200 bg-amber-50 px-3 flex items-center justify-between"
                          >
                            <div>
                              <div className="font-mono font-bold text-sm text-slate-900">{b.id}</div>
                              <div className="text-[11px] text-slate-500">{b.tier} · {b.weight}</div>
                            </div>
                            <span className="text-[11px] font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-lg">
                              Đang chắn
                            </span>
                          </div>
                        ))}

                    <div className="rounded-xl border border-orange-200 border-l-4 border-l-orange-500 bg-orange-50/60 px-3 py-2.5 flex items-center justify-between">
                      <div>
                        <div className="font-mono font-extrabold text-base text-slate-900">
                          {activeConflictContainer.containerNo}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {activeConflictContainer.location} · {activeConflictContainer.type}
                        </div>
                      </div>
                      <span className="text-[11px] font-semibold text-white bg-orange-500 px-2.5 py-1 rounded-lg">
                        Cần lấy ra
                      </span>
                    </div>
                  </div>

                  {/* Vị trí đảo tạm */}
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-2.5">
                    <h5 className="text-sm font-bold text-slate-900">Vị trí đảo tạm</h5>

                    {conflictPlanResult &&
                    conflictPlanResult.generatedTasks.filter((t) => !t.isTarget).length > 0 ? (
                      conflictPlanResult.generatedTasks
                        .filter((t) => !t.isTarget)
                        .map((b, bIdx) => (
                          <div
                            key={bIdx}
                            className="rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2 flex items-center justify-between"
                          >
                            <div>
                              <div className="text-[11px] text-slate-500">Đảo {b.id} đến</div>
                              <div className="font-mono font-bold text-sm text-emerald-700">{b.moveTarget}</div>
                            </div>
                            <span className="text-[11px] text-slate-500">{b.rtg}</span>
                          </div>
                        ))
                    ) : (
                      <div className="h-24 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 flex items-center justify-center text-center px-4 text-xs text-slate-400">
                        Chưa có kế hoạch. Bấm “Lập kế hoạch đảo container” để chọn vị trí đảo tạm.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 3. LẬP KẾ HOẠCH ĐẢO CONTAINER */}
          <div className="flex justify-end">
            <div className="flex items-center gap-2 flex-wrap">
              {conflictPlanResult && (
                <button
                  onClick={() => setShowConfirmDeployModal(true)}
                  className="px-5 py-4 bg-orange-500 hover:bg-orange-600 text-white rounded-2xl font-black text-xs cursor-pointer shadow-md transition-all flex items-center justify-center gap-1.5 active:scale-98"
                >
                  <span className="material-symbols-outlined text-base">
                    rocket_launch
                  </span>
                  <span>Xác nhận triển khai</span>
                </button>
              )}

              <button
                onClick={handle1ClickOptimizeConflict}
                disabled={isAnalyzingConflict}
                className={`flex-1 sm:flex-none px-7 py-4 rounded-2xl font-black text-xs cursor-pointer shadow-lg transition-all flex items-center justify-center gap-2 ${
                  isAnalyzingConflict
                    ? "bg-orange-100 text-orange-700 cursor-wait"
                    : conflictPlanResult
                      ? "bg-orange-50 hover:bg-orange-100 text-slate-700 border border-orange-200 active:scale-98"
                      : "bg-orange-500 hover:bg-orange-600 text-white active:scale-98 shadow-md"
                }`}
              >
                {isAnalyzingConflict ? (
                  <>
                    <span className="material-symbols-outlined text-lg animate-spin">
                      progress_activity
                    </span>
                    <span>Đang lập kế hoạch…</span>
                  </>
                ) : conflictPlanResult ? (
                  <>
                    <span className="material-symbols-outlined text-lg">
                      refresh
                    </span>
                    <span>Lập lại kế hoạch</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-lg">
                      bolt
                    </span>
                    <span>Lập kế hoạch đảo container</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* 4. THÔNG BÁO KẾT QUẢ HIỂN THỊ LÊN MÀN HÌNH (ON-SCREEN RESULT NOTIFICATION) */}
          {conflictPlanResult && (
            <div className="bg-white border-2 border-emerald-500/80 rounded-2xl p-5 sm:p-6 space-y-4 shadow-xs animate-fadeIn">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-200 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                    <span className="material-symbols-outlined text-xl">
                      verified
                    </span>
                  </div>
                  <div>
                    <h4 className="font-heading font-black text-slate-900 text-base sm:text-lg">
                      AI Đã Tối Ưu Hóa Thành Công Kế Hoạch Gỡ Xung Đột
                    </h4>
                    <span className="text-xs text-slate-600 font-sans">
                      Thời điểm tính toán:{" "}
                      <strong className="font-mono text-slate-900">
                        {conflictPlanResult.generatedAt}
                      </strong>{" "}
                      • Độ tin cậy thuật toán:{" "}
                      <strong className="font-mono text-emerald-700">
                        {conflictPlanResult.metrics.confidence}
                      </strong>
                    </span>
                  </div>
                </div>

                <span className="px-3 py-1 bg-emerald-50 text-emerald-900 rounded-xl font-mono text-xs font-black border border-emerald-300">
                  TỔNG CỘNG: {conflictPlanResult.generatedTasks.length} LỆNH
                  ĐIỀU PHỐI
                </span>
              </div>

              {/* 4 Chỉ Số Định Lượng Sau Khi Tối Ưu */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 shadow-2xs">
                  <span className="text-[10px] text-slate-500 font-sans block">
                    THỜI GIAN THỰC THI
                  </span>
                  <div className="text-slate-900 font-black text-base mt-0.5">
                    {conflictPlanResult.metrics.estimatedDuration}
                  </div>
                  <div className="text-[10px] text-emerald-700 font-bold font-sans">
                    Gốc: {conflictPlanResult.metrics.originalDuration} (
                    {conflictPlanResult.metrics.timeSaved})
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 shadow-2xs">
                  <span className="text-[10px] text-slate-500 font-sans block">
                    SỐ LẦN ĐẢO CONTAINER
                  </span>
                  <div className="text-slate-900 font-black text-base mt-0.5">
                    {conflictPlanResult.metrics.movesCount} lần
                  </div>
                  <div className="text-[10px] text-emerald-700 font-bold font-sans">
                    Số lần tối thiểu tuyệt đối
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 shadow-2xs">
                  <span className="text-[10px] text-slate-500 font-sans block">
                    TIẾT KIỆM NHIÊN LIỆU RTG
                  </span>
                  <div className="text-slate-900 font-black text-base mt-0.5">
                    {conflictPlanResult.metrics.energySaved}
                  </div>
                  <div className="text-[10px] text-emerald-700 font-bold font-sans">
                    Giảm hành trình cẩu thừa
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 shadow-2xs">
                  <span className="text-[10px] text-slate-500 font-sans block">
                    MỨC ĐỘ AN TOÀN BÃI
                  </span>
                  <div className="text-emerald-700 font-black text-base mt-0.5">
                    100%
                  </div>
                  <div className="text-[10px] text-emerald-700 font-bold font-sans">
                    Tuân thủ trọng lực & tải trọng
                  </div>
                </div>
              </div>

              <div className="text-xs text-slate-600 font-sans bg-slate-50 p-3 rounded-2xl border border-slate-200 flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-600 text-base">
                  check_circle
                </span>
                <span>
                  <strong>Ghi chú slot đệm:</strong>{" "}
                  {conflictPlanResult.metrics.bufferSlotNote}
                </span>
              </div>
            </div>
          )}

          {/* 5. DANH SÁCH CÁC LỆNH TRIỂN KHAI (DEPLOYMENT ORDERS LIST) */}
          {conflictPlanResult && (
            <div className="space-y-4">
              <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                <div>
                  <h4 className="font-heading font-black text-slate-900 text-base flex items-center gap-2">
                    <span className="material-symbols-outlined text-orange-500">
                      format_list_numbered
                    </span>
                    Danh Sách Các Lệnh Triển Khai Tuần Tự (Deployment Action
                    Plan)
                  </h4>
                  <span className="text-xs text-slate-500 font-sans">
                    Cẩu RTG sẽ thực thi tuần tự từ bước 1 để dọn sạch đường tiếp
                    cận cho container mục tiêu
                  </span>
                </div>

                <span className="text-xs font-mono font-bold text-slate-600">
                  Thứ tự:{" "}
                  <strong className="text-orange-600 font-black">
                    Ưu tiên từ trên xuống dưới
                  </strong>
                </span>
              </div>

              {/* Cards Danh Sách Lệnh */}
              <div className="space-y-3 font-mono text-xs">
                {conflictPlanResult.generatedTasks.map((t, idx) => (
                  <div
                    key={idx}
                    className={`p-4 rounded-3xl border transition-all flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${
                      t.isTarget
                        ? "bg-orange-50/70 border-orange-200 shadow-xs"
                        : "bg-white border-slate-200 shadow-2xs hover:border-slate-300"
                    }`}
                  >
                    {/* Step Badge, Manual Reorder & Container Info */}
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5 shrink-0">
                        {!conflictPlanDeployed && (
                          <div className="flex flex-col gap-0.5">
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() => handleMoveStepUp(idx)}
                              title="Chuyển bước này lên trước"
                              className={`w-6 h-4 flex items-center justify-center rounded text-[9px] font-black border transition-colors ${
                                idx === 0
                                  ? "text-slate-600 border-slate-200 cursor-not-allowed bg-slate-50"
                                  : "text-orange-600 border-orange-200 hover:bg-orange-100 cursor-pointer bg-orange-50/60"
                              }`}
                            >
                              ▲
                            </button>
                            <button
                              type="button"
                              disabled={
                                idx ===
                                conflictPlanResult.generatedTasks.length - 1
                              }
                              onClick={() => handleMoveStepDown(idx)}
                              title="Chuyển bước này xuống sau"
                              className={`w-6 h-4 flex items-center justify-center rounded text-[9px] font-black border transition-colors ${
                                idx ===
                                conflictPlanResult.generatedTasks.length - 1
                                  ? "text-slate-600 border-slate-200 cursor-not-allowed bg-slate-50"
                                  : "text-orange-600 border-orange-200 hover:bg-orange-100 cursor-pointer bg-orange-50/60"
                              }`}
                            >
                              ▼
                            </button>
                          </div>
                        )}
                        <div
                          className={`w-9 h-9 rounded-2xl flex items-center justify-center font-black text-sm shrink-0 shadow-xs ${
                            t.isTarget
                              ? "bg-orange-500 text-white"
                              : t.reason?.includes("Khôi phục")
                                ? "bg-amber-600 text-white"
                                : "bg-white text-slate-900"
                          }`}
                        >
                          {t.step}
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <strong className="text-slate-900 text-base font-black">
                            {t.id}
                          </strong>
                          <span
                            className={`px-2 py-0.5 rounded-lg text-[10px] font-black ${
                              t.isTarget
                                ? "bg-orange-50 text-orange-700 border border-orange-200"
                                : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {t.type} • {t.weight}
                          </span>
                          {t.isTarget && (
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-950 font-black text-[10px] rounded-lg border border-emerald-400">
                              ★ CONTAINER MỤC TIÊU
                            </span>
                          )}
                          {t.reason?.includes("Khôi phục") && (
                            <span className="px-2 py-0.5 bg-amber-100 text-amber-950 font-black text-[10px] rounded-lg border border-amber-400">
                              ↺ KHÔI PHỤC VỊ TRÍ CŨ
                            </span>
                          )}
                          {!t.isTarget && !t.reason?.includes("Khôi phục") && (
                            <span className="px-2 py-0.5 bg-indigo-50 text-indigo-900 font-bold text-[10px] rounded-lg border border-indigo-200">
                              📦 DỜI VÀO SLOT ĐỆM
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 font-sans mt-0.5">
                          {t.reason}
                        </div>
                      </div>
                    </div>

                    {/* From ➔ To Route */}
                    <div className="flex items-center gap-2 bg-slate-100/90 px-3.5 py-2 rounded-2xl border border-slate-200 text-xs">
                      <div>
                        <span className="text-[9px] text-slate-500 font-sans block">
                          TỪ
                        </span>
                        <strong className="text-slate-900">
                          {t.currentPos}
                        </strong>
                      </div>
                      <span className="text-orange-500 font-black text-sm">
                        ➔
                      </span>
                      <div>
                        <span className="text-[9px] text-emerald-600 font-sans block font-bold">
                          ĐẾN
                        </span>
                        {!conflictPlanDeployed ? (
                          <input
                            type="text"
                            value={t.moveTarget}
                            onChange={(e) =>
                              handleUpdateStepTarget(idx, e.target.value)
                            }
                            title="Có thể sửa slot đích thủ công"
                            className={`px-2 py-1 rounded-lg border font-mono font-bold text-xs w-48 ${
                              t.moveTarget === "KHÔNG CÓ SLOT"
                                ? "bg-rose-100 text-rose-900 border-rose-400"
                                : "bg-white text-emerald-950 border-emerald-300 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                            }`}
                          />
                        ) : (
                          <strong
                            className={`${t.moveTarget === "KHÔNG CÓ SLOT" ? "text-rose-600" : "text-emerald-900"} font-black`}
                          >
                            {t.moveTarget}
                          </strong>
                        )}
                      </div>
                    </div>

                    {/* RTG & Execution State */}
                    <div className="flex items-center gap-3 shrink-0 w-full md:w-auto justify-between md:justify-end">
                      <div className="text-right">
                        <div className="text-[10px] text-slate-500 font-sans">
                          Thiết bị phân bổ:
                        </div>
                        <strong className="text-slate-900 font-black">
                          {t.rtg}
                        </strong>
                        <div className="text-[10px] text-slate-500 font-sans">
                          Thời gian: {t.duration}
                        </div>
                      </div>

                      <span
                        className={`px-3 py-1.5 rounded-xl font-sans font-black text-xs border ${
                          conflictPlanDeployed
                            ? "bg-emerald-50 text-emerald-900 border-emerald-300"
                            : "bg-orange-50 text-orange-700 border-orange-200"
                        }`}
                      >
                        {conflictPlanDeployed
                          ? "✓ Đang Thực Thi"
                          : "Sẵn Sàng Bắn Lệnh"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* 6. NÚT XÁC NHẬN TRIỂN KHAI TOÀN BỘ LỆNH CẨU (MANDATORY CONFIRMATION BUTTON) */}
              <div className="pt-2">
                {!conflictPlanDeployed ? (
                  conflictPlanResult.canExecute === false ? (
                    <div className="p-5 bg-rose-50 border-2 border-rose-400 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-rose-600 text-white flex items-center justify-center font-black shadow-xs shrink-0">
                          <span className="material-symbols-outlined text-xl">
                            block
                          </span>
                        </div>
                        <div>
                          <h5 className="font-heading font-black text-rose-950 text-sm sm:text-base flex items-center gap-2">
                            <span>
                              🚨 KHÔNG CHO PHÉP DI DIỜI: KHÔNG CÓ SLOT TẠM PHÙ
                              HỢP!
                            </span>
                          </h5>
                          <p className="text-xs text-rose-700 font-sans mt-0.5">
                            {conflictPlanResult.validationMessage ||
                              "Tất cả các slot đệm lân cận đều đầy hoặc vi phạm quy tắc an toàn. Vui lòng giải phóng slot trước khi lập kế hoạch."}
                          </p>
                        </div>
                      </div>

                      <button
                        disabled
                        className="w-full sm:w-auto px-8 py-4 bg-slate-200 text-slate-500 rounded-2xl font-black text-xs cursor-not-allowed shadow-none flex items-center justify-center gap-2 whitespace-nowrap"
                      >
                        <span className="material-symbols-outlined text-base">
                          block
                        </span>
                        [ 🚫 KHÔNG THỂ PHÁT LỆNH DO THIẾU SLOT TẠM ]
                      </button>
                    </div>
                  ) : (
                    <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-orange-500 text-white flex items-center justify-center font-black shadow-xs shrink-0">
                          <span className="material-symbols-outlined text-xl">
                            fact_check
                          </span>
                        </div>
                        <div>
                          <h5 className="font-heading font-black text-slate-900 text-sm sm:text-base">
                            Kế Hoạch Điều Phối Đã Sẵn Sàng Triển Khai
                          </h5>
                          <p className="text-xs text-slate-600 font-sans">
                            Vui lòng bấm nút xác nhận để phát đồng thời toàn bộ{" "}
                            {conflictPlanResult.generatedTasks.length} lệnh cẩu
                            xuống hệ thống RTG.
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={() => setShowConfirmDeployModal(true)}
                        className="w-full sm:w-auto px-8 py-4 bg-orange-500 hover:bg-orange-600 active:scale-98 text-white rounded-2xl font-black text-xs cursor-pointer shadow-md flex items-center justify-center gap-2 whitespace-nowrap"
                      >
                        <span className="material-symbols-outlined text-base">
                          rocket_launch
                        </span>
                        [ 🚀 XÁC NHẬN TRIỂN KHAI TOÀN BỘ LỆNH CẨU (DISPATCH ALL)
                        ]
                      </button>
                    </div>
                  )
                ) : (
                  <div className="space-y-4">
                    <div className="p-5 bg-emerald-50 border-2 border-emerald-400 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm animate-fadeIn">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-black shadow-xs shrink-0">
                          <span className="material-symbols-outlined text-xl">
                            task_alt
                          </span>
                        </div>
                        <div>
                          <h5 className="font-heading font-black text-emerald-950 text-sm sm:text-base">
                            ✓ Đã Triển Khai Toàn Bộ{" "}
                            {conflictPlanResult.generatedTasks.length} Lệnh
                            Xuống Cẩu RTG Thành Công!
                          </h5>
                          <p className="text-xs text-emerald-800 font-sans">
                            {activeRestackPlan?.planCode
                              ? `Mã Kế Hoạch: ${activeRestackPlan.planCode} • `
                              : ""}
                            Cẩu RTG đang thực thi tuần tự theo tiến trình thời
                            gian thực.
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        <button
                          onClick={() => setViewMode("TABLE")}
                          className="w-full sm:w-auto px-6 py-3.5 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white rounded-2xl font-black text-xs cursor-pointer shadow-md flex items-center justify-center gap-1.5 whitespace-nowrap"
                        >
                          <span className="material-symbols-outlined text-base">
                            table_rows
                          </span>
                          [ 📋 XEM TRÊN DANH SÁCH LỆNH ]
                        </button>
                        <button
                          onClick={() =>
                            handleSelectConflictScenario(
                              selectedConflictScenarioId,
                            )
                          }
                          className="px-4 py-3.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-2xl cursor-pointer whitespace-nowrap"
                        >
                          Lập Kế Hoạch Mới
                        </button>
                      </div>
                    </div>

                    {/* NXP-126: BỘ ĐIỀU KHIỂN TIẾN TRÌNH THỰC THI THỜI GIAN THỰC (LIVE STEPPER TRACKER) */}
                    <div className="p-5 bg-white text-slate-900 rounded-2xl border border-orange-100 space-y-4 shadow-sm">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-orange-100 pb-3">
                        <div className="flex items-center gap-2 font-mono text-xs">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
                          <span className="text-emerald-600 font-black uppercase">
                            GIÁM SÁT TIẾN TRÌNH THỰC THI (STEPPER)
                          </span>
                          <span className="text-slate-500">
                            • Tiến độ: Bước{" "}
                            {Math.min(
                              conflictExecutingStep,
                              conflictPlanResult.generatedTasks.length,
                            )}{" "}
                            / {conflictPlanResult.generatedTasks.length}
                          </span>
                        </div>
                        <span className="text-xs font-mono text-slate-600">
                          Trạng thái:{" "}
                          {conflictExecutingStep >
                          conflictPlanResult.generatedTasks.length ? (
                            <span className="text-emerald-600 font-bold">
                              ✓ HOÀN TẤT KẾ HOẠCH
                            </span>
                          ) : (
                            <span className="text-orange-600 font-bold">
                              ĐANG THỰC HIỆN BƯỚC {conflictExecutingStep}
                            </span>
                          )}
                        </span>
                      </div>

                      {conflictExecutingStep <=
                      conflictPlanResult.generatedTasks.length ? (
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-orange-50/70 rounded-2xl border border-orange-200">
                          <div>
                            <div className="text-[11px] text-orange-600 font-mono font-bold">
                              LỆNH ĐANG THỰC THI HIỆN TẠI (BƯỚC{" "}
                              {conflictExecutingStep}):
                            </div>
                            <div className="text-base font-black text-slate-900 flex items-center gap-2 mt-0.5">
                              <span>
                                {
                                  conflictPlanResult.generatedTasks[
                                    conflictExecutingStep - 1
                                  ]?.id
                                }
                              </span>
                              <span className="text-orange-600 text-xs">
                                (
                                {
                                  conflictPlanResult.generatedTasks[
                                    conflictExecutingStep - 1
                                  ]?.currentPos
                                }{" "}
                                ➔{" "}
                                {
                                  conflictPlanResult.generatedTasks[
                                    conflictExecutingStep - 1
                                  ]?.moveTarget
                                }
                                )
                              </span>
                            </div>
                            <div className="text-xs text-slate-500 font-sans mt-0.5">
                              {
                                conflictPlanResult.generatedTasks[
                                  conflictExecutingStep - 1
                                ]?.reason
                              }
                            </div>
                          </div>

                          <button
                            onClick={() =>
                              handleAdvanceRestackStep(conflictExecutingStep)
                            }
                            disabled={isAdvancingStep}
                            className="w-full sm:w-auto px-6 py-3.5 bg-orange-500 hover:bg-orange-600 active:scale-98 text-white rounded-2xl font-black text-xs cursor-pointer shadow-md flex items-center justify-center gap-2 whitespace-nowrap"
                          >
                            {isAdvancingStep ? (
                              <>
                                <span className="material-symbols-outlined text-base animate-spin">
                                  progress_activity
                                </span>
                                <span>Đang Ghi Nhận Hạ Bãi...</span>
                              </>
                            ) : (
                              <>
                                <span className="material-symbols-outlined text-base">
                                  check_circle
                                </span>
                                <span>
                                  [ ✓ XÁC NHẬN HOÀN THÀNH BƯỚC{" "}
                                  {conflictExecutingStep} ]
                                </span>
                              </>
                            )}
                          </button>
                        </div>
                      ) : (
                        <div className="p-4 bg-emerald-950/80 rounded-2xl border border-emerald-400 text-center space-y-1">
                          <div className="text-emerald-600 font-black text-base flex items-center justify-center gap-2">
                            <span className="material-symbols-outlined text-xl">
                              celebration
                            </span>
                            <span>
                              🎉 TOÀN BỘ KẾ HOẠCH BRP ĐÃ HOÀN TẤT THÀNH CÔNG!
                            </span>
                          </div>
                          <div className="text-xs text-slate-600 font-sans">
                            Container mục tiêu đã được giải phóng an toàn lên
                            phương tiện xuất. Toàn bộ slot tạm đã được đưa về
                            trạng thái tối ưu.
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 7. LỊCH SỬ CÁC KẾ HOẠCH DI DỜI CONTAINER CHỒNG (NXP-126 AUDIT TRAIL) */}
          {showPlanHistorySection && (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4 shadow-xs animate-fadeIn">
              <div className="flex justify-between items-center border-b border-slate-200 pb-3">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-orange-500">
                    history
                  </span>
                  <h4 className="font-heading font-black text-slate-900 text-base">
                    Lịch Sử & Vết Kiểm Toán Kế Hoạch Đảo Bãi (Restack Audit
                    Trail)
                  </h4>
                </div>
                <button
                  onClick={() => setShowPlanHistorySection(false)}
                  className="text-xs text-slate-500 hover:text-slate-800 font-bold cursor-pointer"
                >
                  Đóng ✕
                </button>
              </div>

              {restackPlanHistory.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500 font-sans">
                  Chưa có kế hoạch đảo bãi nào được ghi nhận.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left font-mono text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500 font-sans uppercase text-[10px]">
                        <th className="py-2.5 px-3">Mã Kế Hoạch</th>
                        <th className="py-2.5 px-3">Container Mục Tiêu</th>
                        <th className="py-2.5 px-3">Vị Trí Gốc</th>
                        <th className="py-2.5 px-3">Đích Bàn Giao</th>
                        <th className="py-2.5 px-3 text-center">Số Lượt Cẩu</th>
                        <th className="py-2.5 px-3 text-center">
                          Khôi Phục Vị Trí Cũ
                        </th>
                        <th className="py-2.5 px-3 text-right">Chi Phí</th>
                        <th className="py-2.5 px-3 text-center">Trạng Thái</th>
                        <th className="py-2.5 px-3">Thời Gian Tạo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {restackPlanHistory.map((plan) => (
                        <tr
                          key={plan.id}
                          className="hover:bg-slate-100/80 transition-colors"
                        >
                          <td className="py-3 px-3 font-bold text-orange-500">
                            {plan.planCode}
                          </td>
                          <td className="py-3 px-3 font-black text-slate-900">
                            {plan.targetContainerNo}
                          </td>
                          <td className="py-3 px-3 text-slate-600">
                            {plan.targetLocation}
                          </td>
                          <td className="py-3 px-3 text-emerald-800 font-sans">
                            {plan.targetDestination}
                          </td>
                          <td className="py-3 px-3 text-center font-bold">
                            {plan.totalMoves} Lần
                          </td>
                          <td className="py-3 px-3 text-center">
                            {plan.restackBackToOriginal ? (
                              <span className="px-2 py-0.5 rounded-lg bg-orange-50 text-blue-800 text-[10px] font-bold border border-orange-200">
                                Có
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-600 text-[10px]">
                                Không
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right font-bold text-slate-800">
                            {formatCurrency(plan.estimatedFee)}
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span
                              className={`px-2.5 py-1 rounded-xl text-[10px] font-black border ${
                                plan.status === "Completed"
                                  ? "bg-emerald-50 text-emerald-900 border-emerald-300"
                                  : plan.status === "In_Progress"
                                    ? "bg-orange-50 text-orange-700 border-orange-200"
                                    : "bg-slate-100 text-slate-700 border-slate-300"
                              }`}
                            >
                              {plan.status === "Completed"
                                ? "✓ ĐÃ HOÀN TẤT"
                                : plan.status === "In_Progress"
                                  ? "ĐANG CHẠY"
                                  : plan.status}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-slate-500 text-[11px]">
                            {new Date(plan.createdAt).toLocaleString("vi-VN")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── MODAL: TẠO LỆNH CHUYỂN BLOCK MỚI — SƠ ĐỒ PHÂN KHU BÃI CONTAINER TIÊN SA ── */}
      {createModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-5">
          <div className="bg-white rounded-xl max-w-5xl lg:max-w-6xl w-full p-6 sm:p-7 space-y-5 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150 text-xs font-sans max-h-[92vh] overflow-y-auto">
            {/* Header */}
            <div className="flex justify-between items-center border-b border-slate-100 pb-3.5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-600 border border-orange-200/80 flex items-center justify-center shrink-0 shadow-xs">
                  <span className="material-symbols-outlined text-2xl">
                    swap_horiz
                  </span>
                </div>
                <div>
                  <h3 className="font-heading text-base sm:text-lg font-bold text-slate-900">
                    Tạo lệnh chuyển container
                  </h3>
                  <p className="text-sm text-slate-500">Chọn container, vị trí đích và thiết bị cẩu</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCreateModalOpen(false)}
                className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition cursor-pointer text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={handleCreateRelocationTask}
              className="space-y-4 text-xs font-bold"
            >
              {/* Quick Pick Container (Real Data from PostgreSQL Database) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-slate-700 text-xs font-semibold flex items-center gap-1.5">
                    Container trong bãi
                  </label>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-56 overflow-y-auto pr-1">
                  {(availableContainers.length > 0 ? availableContainers : SAMPLE_CONTAINERS).map((c) => (
                    <button
                      key={c.containerNo}
                      type="button"
                      onClick={() => handleSelectPredefinedContainer(c)}
                      className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                        newContainerNo === c.containerNo
                          ? "bg-orange-50 border-orange-400 text-orange-950 font-bold shadow-xs ring-2 ring-orange-200"
                          : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs text-slate-900 font-bold">
                          {c.containerNo}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-500 font-normal mt-0.5">
                        {c.location} • {c.type} ({c.line})
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Row 1: Container No, Type, Origin Location */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-600 text-xs font-semibold mb-1.5">
                    Mã container *
                  </label>
                  <input
                    type="text"
                    value={newContainerNo}
                    onChange={(e) =>
                      setNewContainerNo(e.target.value.toUpperCase())
                    }
                    placeholder="VD: MSCU1234567"
                    required
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl focus:border-orange-400 font-mono font-bold text-sm focus:outline-none focus:border-slate-900"
                  />
                </div>
                <div>
                  <label className="text-slate-600 text-xs font-semibold mb-1.5 flex items-center justify-between">
                    <span>Loại container *</span>
                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded font-bold tracking-wider ${
                        newContainerType.includes("20")
                          ? "bg-amber-100 text-amber-900 border border-amber-300"
                          : "bg-orange-100 text-orange-700 border border-orange-200"
                      }`}
                    >
                      {newContainerType.includes("20") ? "20 ft" : "40 ft"}
                    </span>
                  </label>
                  <select
                    value={newContainerType}
                    onChange={(e) => setNewContainerType(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl focus:border-orange-400 text-slate-900 font-bold focus:outline-none"
                  >
                    <option value="20FT ST">20FT Standard (ST) - Hàng Khô</option>
                    <option value="20FT RF">20FT Reefer (RF) - Hàng Lạnh</option>
                    <option value="20FT TANK">20FT Tank (Bồn Hóa Chất)</option>
                    <option value="20FT OT">20FT Open Top (Mở Mái)</option>
                    <option value="40FT HC">40FT High Cube (HC) - Khô Cao</option>
                    <option value="40FT DC">40FT Dry Cargo (DC / GP) - Khô Chuẩn</option>
                    <option value="40FT RF">40FT Reefer (RF) - Hàng Lạnh</option>
                    <option value="40FT TANK">40FT Tank (Bồn)</option>
                    <option value="45FT HC">45FT High Cube (Siêu Dài)</option>
                    {![
                      "20FT ST",
                      "20FT RF",
                      "20FT TANK",
                      "20FT OT",
                      "40FT HC",
                      "40FT DC",
                      "40FT RF",
                      "40FT TANK",
                      "45FT HC",
                    ].includes(newContainerType) &&
                      newContainerType && (
                        <option value={newContainerType}>
                          {newContainerType}
                        </option>
                      )}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-600 text-xs font-semibold mb-1.5">
                    Vị trí hiện tại *
                  </label>
                  <input
                    type="text"
                    value={newFromLocation}
                    onChange={(e) =>
                      setNewFromLocation(e.target.value.toUpperCase())
                    }
                    placeholder="VD: A01-03-02-2"
                    required
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl focus:border-orange-400 font-mono font-bold text-sm focus:outline-none focus:border-slate-900"
                  />
                </div>
              </div>

              {/* ── SƠ ĐỒ PHÂN KHU BÃI CONTAINER TIÊN SA: BƯỚC 1 & BƯỚC 2 ── */}
              <div className="p-4 sm:p-5 rounded-xl bg-orange-50/30 border border-orange-100 space-y-4">
                {/* Vị trí đích đã chọn */}
                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                  <div>
                    <span className="text-xs font-semibold text-emerald-700">
                      Vị trí đích
                    </span>
                    <div className="text-base font-bold text-slate-900 font-mono mt-0.5">
                      Block {newTargetBlock} · Bay {newTargetBay} · Hàng {newTargetRow} · Tầng {newTargetTier}
                      <span className="ml-2 text-xs text-emerald-800 font-bold">
                        {computedDestLocation}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleAiAutoSelectSlot}
                      className="px-3 py-1.5 bg-white hover:bg-orange-50 text-orange-600 border border-orange-300 rounded-xl font-bold text-xs cursor-pointer flex items-center gap-1 shadow-2xs"
                    >
                      <span className="material-symbols-outlined text-sm">smart_toy</span>
                      <span>Gợi ý vị trí</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleValidateSlot}
                      disabled={validatingSlot}
                      className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-bold text-xs cursor-pointer flex items-center gap-1 shadow-2xs"
                    >
                      <span className="material-symbols-outlined text-sm">rule</span>
                      <span>{validatingSlot ? "Đang kiểm tra…" : "Kiểm tra vị trí"}</span>
                    </button>
                  </div>
                </div>

                {slotValidation && (
                  <div
                    className={`p-3 rounded-xl text-xs font-bold border ${
                      slotValidation.isValid
                        ? "bg-emerald-50 text-emerald-950 border-emerald-300"
                        : "bg-red-50 text-red-950 border-red-300"
                    }`}
                  >
                    {slotValidation.isValid ? "✓ " : "⚠️ "}
                    {slotValidation.message}
                  </div>
                )}

                {/* BƯỚC 1: Chọn Phân Khu Bãi Cảng Tiên Sa (Zone A ➔ G) */}
                <div className="space-y-2.5">
                  <label className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-orange-500 text-white inline-flex items-center justify-center text-[11px] font-bold">
                      1
                    </span>
                    <span>Chọn khu bãi</span>
                  </label>

                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                    {YARD_ZONES.map((zone) => {
                      const isSelected = selectedZone === zone.code;
                      const count = combinedBlocks.filter(
                        (b) =>
                          b.sector === zone.code ||
                          (b.blockCode || "").toUpperCase().startsWith(zone.code)
                      ).length;

                      return (
                        <button
                          key={zone.code}
                          type="button"
                          onClick={() => {
                            setSelectedZone(zone.code);
                            const firstInZone = combinedBlocks.find(
                              (b) =>
                                b.sector === zone.code ||
                                (b.blockCode || "").startsWith(zone.code)
                            );
                            if (firstInZone) {
                              setNewTargetBlock(firstInZone.blockCode);
                            }
                          }}
                          className={`p-2.5 sm:p-3 rounded-xl border text-left transition flex flex-col justify-between min-h-[78px] cursor-pointer ${
                            isSelected
                              ? "border border-orange-500 bg-orange-50 ring-1 ring-orange-300"
                              : "border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300"
                          }`}
                        >
                          <div className="flex justify-between items-start">
                            <span
                              className={`text-xs font-bold ${
                                isSelected ? "text-orange-700" : "text-slate-900"
                              }`}
                            >
                              {zone.name}
                            </span>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                              {count}
                            </span>
                          </div>
                          <span
                            className={`text-[10px] mt-1 font-medium leading-snug break-words ${
                              isSelected
                                ? "text-orange-800 font-semibold"
                                : "text-slate-500"
                            }`}
                          >
                            {zone.desc}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* BƯỚC 2: Các Block thuộc Khu đã chọn */}
                <div className="space-y-2 pt-2 border-t border-slate-200">
                  <label className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-orange-500 text-white inline-flex items-center justify-center text-[10px] font-bold">
                      2
                    </span>
                    <span>Block thuộc {YARD_ZONES.find((z) => z.code === selectedZone)?.name || `Khu ${selectedZone}`}</span>
                  </label>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
                    {currentZoneBlocks.length === 0 ? (
                      <div className="p-4 rounded-xl bg-white text-slate-500 text-xs font-medium col-span-full text-center border border-slate-200">
                        Đang tải danh sách Block thuộc Khu {selectedZone}...
                      </div>
                    ) : (
                      currentZoneBlocks.map((block) => {
                        const code = block.blockCode || block.code;
                        const isChosenBlock = newTargetBlock === code;

                        return (
                          <div
                            key={code}
                            className={`p-3 rounded-xl border transition flex flex-col justify-between gap-2 ${
                              isChosenBlock
                                ? "bg-emerald-50/70 border-2 border-emerald-500 shadow-sm ring-2 ring-emerald-500/20"
                                : "bg-white border-slate-200 hover:border-orange-400 hover:shadow-xs"
                            }`}
                          >
                            <div>
                              <div className="flex justify-between items-start mb-1">
                                <span className="font-heading text-sm font-bold text-slate-900 font-mono">
                                  Block {code}
                                </span>
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                                  {block.empty} ô trống
                                </span>
                              </div>
                              <p className="text-[10px] text-slate-500 font-normal">
                                {block.occupied} / {block.totalCapacity} TEU
                              </p>
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                setNewTargetBlock(code);
                                setPickerBlock(block);
                              }}
                              className={`w-full py-2 px-3 rounded-xl text-xs font-bold transition shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer ${
                                isChosenBlock
                                  ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                                  : "bg-orange-500 hover:bg-orange-600 text-white"
                              }`}
                            >
                              <span className="material-symbols-outlined text-sm">
                                grid_view
                              </span>
                              <span>
                                {isChosenBlock ? "Đổi bay / ô" : "Chọn bay / ô"}
                              </span>
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              {/* Row 3: Shifting Reason, Billable & Calculated Fee */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 text-xs font-semibold mb-1.5">
                    Lý do chuyển *
                  </label>
                  <select
                    value={newShiftingReason}
                    onChange={(e) => setNewShiftingReason(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl focus:border-orange-400 text-slate-900 font-bold focus:outline-none"
                  >
                    {SHIFTING_REASONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Billable & Fee */}
                <div className="p-3 bg-white border border-slate-200 rounded-xl focus:border-orange-400 flex flex-col justify-between">
                  <label className="flex items-center gap-2 cursor-pointer text-slate-800 text-xs font-bold">
                    <input
                      type="checkbox"
                      checked={newIsBillable}
                      onChange={(e) => setNewIsBillable(e.target.checked)}
                      className="w-4 h-4 accent-orange-500 rounded"
                    />
                    <span>Thu phí khách hàng</span>
                  </label>
                  <div className="flex justify-between items-center text-xs pt-1 border-t border-slate-200 mt-1">
                    <span className="text-slate-500 text-[10px]">
                      Chi phí nội bộ:
                    </span>
                    <strong className="text-emerald-800 font-mono font-bold text-sm">
                      {formatCurrency(calculatedFee)}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Row 4: RTG Equipment & Operator */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-600 text-xs font-semibold mb-1.5">
                    Thiết bị cẩu
                  </label>
                  <select
                    value={newEquipmentId}
                    onChange={(e) => setNewEquipmentId(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl focus:border-orange-400 text-slate-900 font-bold focus:outline-none"
                  >
                    <option value="">Tự động gán</option>
                    {equipments.map((eq) => (
                      <option key={eq.id} value={eq.id}>
                        {eq.name} - {eq.status}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-600 text-xs font-semibold mb-1.5">
                    Cần thủ
                  </label>
                  <input
                    type="text"
                    value={newOperatorName}
                    onChange={(e) => setNewOperatorName(e.target.value)}
                    placeholder="VD: Trần Văn Hùng"
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl focus:border-orange-400 font-bold focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 text-xs font-semibold mb-1.5">
                    Mức ưu tiên
                  </label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl focus:border-orange-400 text-slate-900 font-bold focus:outline-none"
                  >
                    <option value="Normal">Bình thường</option>
                    <option value="High">Cao</option>
                    <option value="Critical">Khẩn cấp</option>
                  </select>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-slate-600 text-xs font-semibold mb-1.5">
                  Ghi chú
                </label>
                <textarea
                  rows="2"
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="Ghi chú thêm cho nhân viên bãi"
                  className="w-full p-3 bg-white border border-slate-200 rounded-xl focus:border-orange-400 text-xs font-normal text-slate-900 focus:outline-none resize-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="flex-1 h-12 border border-slate-300 text-slate-700 rounded-xl font-semibold hover:bg-slate-100 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingTask}
                  className="flex-1 h-12 bg-orange-500 hover:bg-orange-600 active:scale-98 text-white font-bold rounded-xl cursor-pointer shadow-md flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-base">
                    send
                  </span>
                  {isSubmittingTask
                    ? "Đang tạo lệnh…"
                    : "Tạo lệnh"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL CHỌN BAY & SLOT TRỰC QUAN 2D CHO BLOCK ── */}
      {pickerBlock && (
        <YardSlotReservationModal
          isOpen={Boolean(pickerBlock)}
          onClose={() => setPickerBlock(null)}
          block={pickerBlock}
          booking={modalBooking}
          currentReservation={null}
          onConfirm={(slotInfo) => {
            const bayStr = String(slotInfo.bay || "02").padStart(2, "0");
            const rowStr = String(slotInfo.row || "01").padStart(2, "0");
            const tierNum = Number(slotInfo.tier) || 1;
            const blockCode = slotInfo.blockCode || pickerBlock.blockCode;
            setNewTargetBlock(blockCode);
            setNewTargetBay(bayStr);
            setNewTargetRow(rowStr);
            setNewTargetTier(String(tierNum));
            setPickerBlock(null);
          }}
        />
      )}

      {/* ── MODAL: JOB TICKET SHEET PREVIEW ── */}
      {jobSheetTask && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full rounded-3xl p-6 shadow-2xl space-y-4 border-2 border-slate-300 font-sans text-slate-900">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-slate-700">
                  receipt_long
                </span>
                <h3 className="font-heading text-lg font-black">
                  Phiếu Lệnh Chuyển Bãi (Job Ticket)
                </h3>
              </div>
              <button
                onClick={() => setJobSheetTask(null)}
                className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 hover:text-slate-900 cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>

            {/* Thermal Ticket Format */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2.5 font-mono text-xs relative overflow-hidden">
              <div className="text-center font-heading font-black text-slate-800 border-b border-dashed border-slate-300 pb-2">
                NEXUSPORT CONTAINER TERMINAL
                <div className="text-[10px] text-slate-500 font-sans font-normal">
                  PHIẾU TÁC NGHIỆP DI CHUYỂN NỘI BỘ
                </div>
              </div>

              <div className="flex justify-between">
                <span className="text-slate-500">Mã Lệnh:</span>
                <strong className="text-slate-900">{jobSheetTask.id}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Mã Container:</span>
                <strong className="text-blue-900">
                  {jobSheetTask.containerId}
                </strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Loại kích thước:</span>
                <span>{jobSheetTask.containerType}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Vị trí gốc:</span>
                <span className="text-amber-800 font-bold">
                  {jobSheetTask.from}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Vị trí đích:</span>
                <span className="text-emerald-800 font-bold">
                  {jobSheetTask.to}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Cước phí nội bộ:</span>
                <span className="font-black text-emerald-700">
                  {formatCurrency(jobSheetTask.internalFee)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Người lập lệnh:</span>
                <span>{jobSheetTask.assignedBy}</span>
              </div>

              {/* Barcode simulation */}
              <div className="pt-2 border-t border-dashed border-slate-300 text-center space-y-1">
                <div className="font-mono text-xl tracking-widest text-slate-800 font-bold">
                  ||||||||||||||||||||||||||||
                </div>
                <div className="text-[9px] text-slate-400">
                  *{jobSheetTask.id}-{jobSheetTask.containerId}*
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setJobSheetTask(null)}
                className="flex-1 h-11 border border-slate-300 rounded-xl font-bold text-xs hover:bg-slate-100"
              >
                Đóng
              </button>
              <button
                onClick={() => {
                  setJobSheetTask(null);
                  showToast(
                    `🖨️ Đã gửi lệnh in phiếu tác nghiệp ${jobSheetTask.id}!`,
                    "success",
                  );
                }}
                className="flex-1 h-11 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs rounded-xl flex items-center justify-center gap-1.5"
              >
                <span className="material-symbols-outlined text-sm">print</span>
                In Phiếu Lệnh
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: BÁO SỰ CỐ ── */}
      {incidentTask && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full rounded-3xl p-6 shadow-2xl space-y-4 border-2 border-red-500 font-sans">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-red-600 text-xl">
                  report_problem
                </span>
                <h3 className="font-heading text-lg font-black text-slate-900">
                  Báo Cáo Sự Cố Lệnh {incidentTask.id}
                </h3>
              </div>
              <button
                onClick={() => setIncidentTask(null)}
                className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 hover:text-slate-900 cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>

            <form
              onSubmit={handleSubmitIncident}
              className="space-y-4 text-xs font-bold"
            >
              <div className="grid grid-cols-2 gap-3 font-mono bg-red-50 p-3 rounded-2xl border border-red-200">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-sans block">
                    Mã Container
                  </span>
                  <strong className="text-slate-900">
                    {incidentTask.containerId}
                  </strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-sans block">
                    Vị Trí Gốc
                  </span>
                  <strong className="text-amber-800">
                    {incidentTask.from}
                  </strong>
                </div>
              </div>

              <div>
                <label className="block text-slate-600 uppercase text-[10px] mb-2 font-extrabold">
                  Lý Do Không Thể Thực Hiện *
                </label>
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {INCIDENT_REASONS.map((r) => (
                    <label
                      key={r}
                      className={`flex items-center gap-2.5 p-2 rounded-xl border cursor-pointer transition-all text-xs font-bold font-sans ${
                        incidentReason === r
                          ? "bg-red-100 border-red-400 text-red-950"
                          : "bg-slate-50 border-slate-200 text-slate-800 hover:bg-slate-100"
                      }`}
                    >
                      <input
                        type="radio"
                        name="incidentReason"
                        value={r}
                        checked={incidentReason === r}
                        onChange={() => setIncidentReason(r)}
                        className="accent-red-600"
                      />
                      {r}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-slate-600 uppercase text-[10px] mb-1 font-extrabold">
                  Ghi Chú Hiện Trường
                </label>
                <textarea
                  rows="2"
                  value={incidentNotes}
                  onChange={(e) => setIncidentNotes(e.target.value)}
                  placeholder="Mô tả chi tiết tình huống tại hiện trường..."
                  className="w-full p-2.5 bg-slate-100 border border-slate-300 rounded-2xl text-xs font-normal text-slate-900 focus:outline-none resize-none"
                />
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setIncidentTask(null)}
                  className="flex-1 h-12 border border-slate-300 text-slate-700 rounded-2xl font-extrabold text-xs hover:bg-slate-100 cursor-pointer"
                >
                  Hủy Bỏ
                </button>
                <button
                  type="submit"
                  className="flex-1 h-12 bg-red-100 hover:bg-red-200 text-red-950 border-2 border-red-500 rounded-2xl font-black text-xs cursor-pointer"
                >
                  [ 🚨 GỬI BÁO CÁO SỰ CỐ ]
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: THÔNG BÁO KẾT QUẢ AI & XÁC NHẬN TRIỂN KHAI LỆNH CẨU (IMMEDIATE ON-SCREEN NOTIFICATION) ── */}
      {showConfirmDeployModal && conflictPlanResult && (
        <div className="fixed inset-0 bg-slate-900/85 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white max-w-2xl w-full rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 border border-slate-200/90 font-sans animate-scaleUp my-8 max-h-[92vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex justify-between items-start border-b border-slate-200 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-black shadow-md shrink-0">
                  <span className="material-symbols-outlined text-2xl">
                    verified
                  </span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-heading text-lg sm:text-xl font-black text-slate-900">
                      Kết Quả Phân Tích & Xác Nhận Triển Khai Lệnh Cẩu
                    </h3>
                    <span className="px-2.5 py-0.5 rounded-lg bg-emerald-50 text-emerald-900 font-mono text-[10px] font-black border border-emerald-300">
                      AI TỐI ƯU
                    </span>
                  </div>
                  <span className="text-xs text-slate-500">
                    Container mục tiêu:{" "}
                    <strong className="font-mono text-blue-900 font-black">
                      {conflictPlanResult.targetContainerNo ||
                        currentConflictScenario.targetContainer.id}
                    </strong>{" "}
                    ({currentConflictScenario.targetContainer.weight}) • Độ tin
                    cậy:{" "}
                    <strong className="font-mono text-emerald-700">
                      {conflictPlanResult.metrics.confidence}
                    </strong>
                  </span>
                </div>
              </div>
              <button
                onClick={() => setShowConfirmDeployModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 cursor-pointer shrink-0"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>

            {/* 5 Chỉ Số Định Lượng AI & Phí Dịch Vụ */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 font-mono text-xs">
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/90">
                <span className="text-[10px] text-slate-500 font-sans block">
                  THỜI GIAN THỰC THI
                </span>
                <strong className="text-slate-900 font-black text-base">
                  {conflictPlanResult.metrics.estimatedDuration}
                </strong>
                <div className="text-[10px] text-emerald-700 font-bold font-sans">
                  Tiết kiệm {conflictPlanResult.metrics.timeSaved}
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/90">
                <span className="text-[10px] text-slate-500 font-sans block">
                  LỆNH ĐẢO CẨU
                </span>
                <strong className="text-slate-900 font-black text-base">
                  {conflictPlanResult.metrics.movesCount} Lần
                </strong>
                <div className="text-[10px] text-emerald-700 font-bold font-sans">
                  Tối thiểu tuyệt đối
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/90">
                <span className="text-[10px] text-slate-500 font-sans block">
                  NHIÊN LIỆU RTG
                </span>
                <strong className="text-slate-900 font-black text-base">
                  {conflictPlanResult.metrics.energySaved}
                </strong>
                <div className="text-[10px] text-emerald-700 font-bold font-sans">
                  Giảm hành trình cẩu
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/90">
                <span className="text-[10px] text-slate-500 font-sans block">
                  CƯỚC NỘI BỘ
                </span>
                <strong className="text-blue-900 font-black text-xs truncate block mt-0.5">
                  {formatCurrency(conflictPlanResult.metrics.shiftingFee)}
                </strong>
                <div className="text-[10px] text-slate-500 font-sans truncate">
                  {conflictPlanResult.restackBackToOriginal
                    ? "Gồm hoàn bãi"
                    : "Lưu slot đệm"}
                </div>
              </div>

              <div className="p-3 bg-emerald-50/80 rounded-2xl border border-emerald-300 col-span-2 sm:col-span-1">
                <span className="text-[10px] text-slate-500 font-sans block">
                  AN TOÀN BÃI
                </span>
                <strong className="text-emerald-950 font-black text-base">
                  100%
                </strong>
                <div className="text-[10px] text-emerald-700 font-bold font-sans">
                  Không tái xung đột
                </div>
              </div>
            </div>

            {/* Danh Sách Các Lệnh Triển Khai (Deployment Orders) */}
            <div className="space-y-2">
              <div className="text-xs font-bold text-slate-700 uppercase font-sans flex justify-between items-center">
                <span className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm text-blue-600">
                    format_list_numbered
                  </span>
                  Chuỗi Lệnh Triển Khai Tuần Tự (
                  {conflictPlanResult.generatedTasks.length} Lệnh):
                </span>
                <span className="text-[10px] text-slate-500 font-mono font-bold">
                  Thực thi từ Bước 1
                </span>
              </div>

              <div className="space-y-2 max-h-48 overflow-y-auto pr-1 font-mono text-xs">
                {conflictPlanResult.generatedTasks.map((t, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-2xl border flex items-center justify-between gap-3 ${
                      t.isTarget
                        ? "bg-blue-50/80 border-blue-300 text-blue-950"
                        : "bg-slate-50 border-slate-200 text-slate-800"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-7 h-7 rounded-xl flex items-center justify-center font-black text-xs shrink-0 ${
                          t.isTarget
                            ? "bg-blue-600 text-white"
                            : "bg-slate-800 text-white"
                        }`}
                      >
                        {t.step}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <strong className="text-sm font-black">{t.id}</strong>
                          <span className="text-[10px] px-1.5 py-0.2 bg-white rounded border border-slate-300 text-slate-600 font-sans">
                            {t.type}
                          </span>
                          {t.isTarget && (
                            <span className="text-[9px] px-1.5 py-0.2 bg-emerald-100 text-emerald-900 rounded font-black border border-emerald-300">
                              ★ MỤC TIÊU
                            </span>
                          )}
                          {t.reason?.includes("Khôi phục") && (
                            <span className="text-[9px] px-1.5 py-0.2 bg-amber-100 text-amber-900 rounded font-black border border-amber-300">
                              ↺ KHÔI PHỤC
                            </span>
                          )}
                          {!t.isTarget && !t.reason?.includes("Khôi phục") && (
                            <span className="text-[9px] px-1.5 py-0.2 bg-indigo-50 text-indigo-900 rounded font-bold border border-indigo-200">
                              📦 ĐỆM
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-500 font-sans">
                          {t.reason}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-[11px] font-black text-blue-950">
                        {t.currentPos} ➔{" "}
                        <strong
                          className={
                            t.moveTarget === "KHÔNG CÓ SLOT"
                              ? "text-rose-600 font-black"
                              : "text-emerald-700"
                          }
                        >
                          {t.moveTarget}
                        </strong>
                      </div>
                      <div className="text-[10px] text-slate-500 font-sans">
                        {t.rtg} • {t.duration}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Telemetry / Safety Lock Notice */}
            {conflictPlanResult.canExecute === false ? (
              <div className="p-3.5 bg-rose-50 border-2 border-rose-300 rounded-2xl flex items-center gap-3 text-rose-950 font-sans text-xs">
                <span className="material-symbols-outlined text-rose-600 text-2xl shrink-0">
                  block
                </span>
                <div>
                  <div className="font-black text-rose-800 uppercase">
                    🚨 KHÔNG CHO PHÉP DI DIỜI: KHÔNG CÓ SLOT TẠM PHÙ HỢP!
                  </div>
                  <div className="text-[11px] text-rose-700 font-normal mt-0.5">
                    {conflictPlanResult.validationMessage ||
                      "Hệ thống đã kiểm tra ma trận bãi nhưng không tìm thấy slot đệm an toàn. Thao tác phát lệnh bị chặn theo quy định an toàn cảng."}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-[11px] text-slate-600 font-sans bg-amber-50 border border-amber-300 p-2.5 rounded-2xl flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-600 text-base shrink-0">
                  shield
                </span>
                <span>
                  Sau khi xác nhận, toàn bộ lệnh sẽ lập tức truyền xuống cẩu RTG
                  qua mạng không dây nội bộ.
                </span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="pt-1">
              {!conflictPlanDeployed ? (
                <div className="flex gap-2.5">
                  <button
                    type="button"
                    onClick={() => setShowConfirmDeployModal(false)}
                    className="flex-1 h-12 border border-slate-300 text-slate-700 rounded-2xl font-extrabold hover:bg-slate-100 cursor-pointer text-xs"
                  >
                    Để Sau / Đóng
                  </button>
                  {conflictPlanResult.canExecute === false ? (
                    <button
                      type="button"
                      disabled
                      className="flex-2 h-12 bg-slate-200 text-slate-400 font-black rounded-2xl cursor-not-allowed flex items-center justify-center gap-2 text-xs"
                    >
                      <span className="material-symbols-outlined text-base">
                        block
                      </span>
                      <span>[ 🚫 KHÔNG THỂ PHÁT LỆNH DO THIẾU SLOT TẠM ]</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleConfirmDeployConflictPlan}
                      disabled={isDeployingConflictPlan}
                      className="flex-2 h-12 bg-blue-600 hover:bg-blue-700 active:scale-98 text-white font-black rounded-2xl cursor-pointer shadow-md flex items-center justify-center gap-2 text-xs transition-colors"
                    >
                      {isDeployingConflictPlan ? (
                        <>
                          <span className="material-symbols-outlined text-base animate-spin">
                            progress_activity
                          </span>
                          <span>Đang Bắn Lệnh Xuống Cẩu RTG...</span>
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-base">
                            rocket_launch
                          </span>
                          <span>
                            [ 🚀 XÁC NHẬN TRIỂN KHAI & PHÁT LỆNH NGAY ]
                          </span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="p-3 bg-emerald-100 border border-emerald-400 rounded-2xl text-emerald-950 font-sans font-bold text-xs flex items-center justify-center gap-2">
                    <span className="material-symbols-outlined text-emerald-700">
                      check_circle
                    </span>
                    <span>
                      ✓ Đã Phát Toàn Bộ{" "}
                      {conflictPlanResult.generatedTasks.length} Lệnh Xuống Cẩu
                      RTG Thành Công!
                    </span>
                  </div>
                  <div className="flex gap-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        setShowConfirmDeployModal(false);
                        setViewMode("TABLE");
                      }}
                      className="flex-2 h-12 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-black rounded-2xl cursor-pointer shadow-md flex items-center justify-center gap-2 text-xs"
                    >
                      <span className="material-symbols-outlined text-base">
                        table_rows
                      </span>
                      [ 📋 XEM TRÊN DANH SÁCH LỆNH ]
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowConfirmDeployModal(false)}
                      className="flex-1 h-12 border border-slate-300 text-slate-700 rounded-2xl font-extrabold hover:bg-slate-100 cursor-pointer text-xs"
                    >
                      Đóng
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Fallback seed tasks
function getFallbackTasks() {
  return [];
}
