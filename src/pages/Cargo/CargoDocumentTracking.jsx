import React, { useState, useEffect } from 'react';
import { cargoNotificationService } from '../../services/cargoNotificationService';

export default function CargoDocumentTracking() {
  const [activeTab, setActiveTab] = useState('todo'); // 'todo' | 'notifications' | 'documents' | 'simulator' | 'unclaimed'
  const [loading, setLoading] = useState(false);

  // Data states
  const [todos, setTodos] = useState([]);
  const [todoFilter, setTodoFilter] = useState('all'); // 'all' | 'export' | 'import'

  const [notifications, setNotifications] = useState([]);
  const [notifPagination, setNotifPagination] = useState({ total: 0, unreadCount: 0, urgentCount: 0 });
  const [notifPriority, setNotifPriority] = useState('');
  const [notifDirection, setNotifDirection] = useState('');
  const [notifOnlyUnread, setNotifOnlyUnread] = useState(false);

  const [documents, setDocuments] = useState([]);
  const [docType, setDocType] = useState('all');
  const [docSearch, setDocSearch] = useState('');

  const [unclaimedList, setUnclaimedList] = useState([]);

  // Modal detail state
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [docDetailLoading, setDocDetailLoading] = useState(false);

  // Simulator state
  const [simEventCode, setSimEventCode] = useState('BookingConfirmed');
  const [simPayload, setSimPayload] = useState('');
  const [simMessage, setSimMessage] = useState(null);

  // Initial load
  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchTodos(),
        fetchNotifications(),
        fetchDocuments(),
        fetchUnclaimed(),
      ]);
    } catch (err) {
      console.error('Lỗi tải dữ liệu Người 1:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTodos = async () => {
    try {
      const res = await cargoNotificationService.getTodoList(todoFilter);
      setTodos(res.data || []);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchNotifications = async () => {
    try {
      const res = await cargoNotificationService.getNotifications({
        priority: notifPriority || undefined,
        direction: notifDirection || undefined,
        isRead: notifOnlyUnread ? false : undefined,
      });
      setNotifications(res.data || []);
      setNotifPagination(res.pagination || { total: 0, unreadCount: 0, urgentCount: 0 });
    } catch (e) {
      console.error(e);
    }
  };

  const fetchDocuments = async () => {
    try {
      const res = await cargoNotificationService.getDocuments({
        type: docType,
        search: docSearch,
      });
      setDocuments(res.data || []);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchUnclaimed = async () => {
    try {
      const res = await cargoNotificationService.getUnclaimedConsignees();
      setUnclaimedList(res.data || []);
    } catch (e) {
      console.error(e);
    }
  };

  // Re-fetch when tab or filters change
  useEffect(() => {
    if (activeTab === 'todo') fetchTodos();
    if (activeTab === 'notifications') fetchNotifications();
    if (activeTab === 'documents') fetchDocuments();
    if (activeTab === 'unclaimed') fetchUnclaimed();
  }, [activeTab, todoFilter, notifPriority, notifDirection, notifOnlyUnread, docType]);

  const handleSearchDocs = (e) => {
    e.preventDefault();
    fetchDocuments();
  };

  const handleMarkAsRead = async (id) => {
    try {
      await cargoNotificationService.markAsRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      setNotifPagination(prev => ({ ...prev, unreadCount: Math.max(0, prev.unreadCount - 1) }));
    } catch (e) {
      console.error(e);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await cargoNotificationService.markAllAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setNotifPagination(prev => ({ ...prev, unreadCount: 0, urgentCount: 0 }));
    } catch (e) {
      console.error(e);
    }
  };

  const handleOpenDocModal = async (type, id) => {
    setDocDetailLoading(true);
    setSelectedDoc(null);
    try {
      const detail = await cargoNotificationService.getDocumentDetail(type, id);
      setSelectedDoc(detail);
    } catch (e) {
      alert('Không thể tải chi tiết chứng từ: ' + (e.response?.data?.message || e.message));
    } finally {
      setDocDetailLoading(false);
    }
  };

  // Simulator preset payloads
  const presetEvents = [
    {
      code: 'BookingConfirmed',
      label: 'X1. Hãng tàu duyệt Booking (Xuất)',
      direction: 'export',
      payload: {
        bookingNo: `BKG-TEST-${Math.floor(1000 + Math.random() * 9000)}`,
        vesselName: 'EVER GLORY',
        voyageNo: '2601N',
        etd: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
        cyCutOff: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
        vgmCutOff: new Date(Date.now() + 20 * 3600 * 1000).toISOString(),
        siCutOff: new Date(Date.now() + 16 * 3600 * 1000).toISOString(),
        emptyPickupPlace: 'Depot Tân Cảng Đà Nẵng',
        shipperTaxCode: '0401889988',
        shipper: 'Công ty Cổ phần Thép Hòa Phát',
        containers: ['MSKU9082134', 'TCKU4829102'],
      },
    },
    {
      code: 'ContainerGatedIn',
      label: 'X4. Xe vào cổng thành công - Cấp EIR (Xuất)',
      direction: 'export',
      payload: {
        eirNo: `EIR-IN-${Math.floor(100000 + Math.random() * 900000)}`,
        containerNo: 'MSKU9082134',
        bookingNo: 'BKG-TEST-1001',
        gateCode: 'GATE-01',
        gateInAt: new Date().toISOString(),
        truckPlate: '43C-888.88',
        sealNo: 'ML-VN-99214',
        condition: 'Vỏ tốt, niêm chì nguyên vẹn',
        shipperTaxCode: '0401889988',
      },
    },
    {
      code: 'ContainerGateRejected',
      label: 'X4. Xe bị từ chối ở cổng vào (Xuất - Khẩn)',
      direction: 'export',
      payload: {
        containerNo: 'TCKU4829102',
        bookingNo: 'BKG-TEST-1001',
        truckPlate: '43C-777.99',
        gateCode: 'GATE-01',
        reason: 'Quá hạn CY cut-off và chưa có khai báo VGM hợp lệ',
        shipperTaxCode: '0401889988',
      },
    },
    {
      code: 'DraftBLIssued',
      label: 'X5. Hãng tàu gửi Draft B/L cần xác nhận (Xuất)',
      direction: 'export',
      payload: {
        blNumber: `HDMU-DAD-${Math.floor(10000 + Math.random() * 90000)}`,
        bookingNo: 'BKG-TEST-1001',
        confirmationDeadline: new Date(Date.now() + 10 * 3600 * 1000).toISOString(),
        shipperTaxCode: '0401889988',
      },
    },
    {
      code: 'ManifestSent',
      label: 'M1. Hãng tàu gửi Manifest nhập - Giấy báo hàng đến',
      direction: 'import',
      payload: {
        manifestId: `MNF-IN-${Math.floor(1000 + Math.random() * 9000)}`,
        blNumber: `BL-IMPORT-${Math.floor(10000 + Math.random() * 90000)}`,
        vesselName: 'CMA CGM CHENNAI',
        voyageNo: '2604S',
        eta: new Date(Date.now() + 36 * 3600 * 1000).toISOString(),
        consigneeName: 'Công ty Cổ phần Thép Hòa Phát',
        consigneeTaxCode: '0401889988',
        freeTimeDays: 5,
        containers: ['CMAU7788991', 'CMAU7788992'],
      },
    },
    {
      code: 'EDoIssued',
      label: 'M3. Hãng tàu cấp e-D/O lấy hàng (Nhập)',
      direction: 'import',
      payload: {
        doNumber: `EDO-${Math.floor(100000 + Math.random() * 900000)}`,
        blNumber: 'BL-IMPORT-88991',
        consigneeName: 'Công ty Cổ phần Thép Hòa Phát',
        consigneeTaxCode: '0401889988',
        validUntil: new Date(Date.now() + 72 * 3600 * 1000).toISOString(),
        emptyReturnDepot: 'Depot Tiên Sa Gate-03',
        containerNos: ['CMAU7788991'],
      },
    },
    {
      code: 'EDoHeld',
      label: 'M6. Hãng tàu TẠM GIỮ e-D/O (Nhập - Khẩn)',
      direction: 'import',
      payload: {
        doNumber: 'EDO-DEMO-HELD',
        blNumber: 'BL-IMPORT-88991',
        reason: 'Yêu cầu kiểm tra niêm phong hải quan và thanh toán phụ phí lưu container',
        consigneeTaxCode: '0401889988',
      },
    },
    {
      code: 'ContainerGatedOut',
      label: 'M5. Lấy container ra cổng - Nhắc trả vỏ rỗng (Nhập)',
      direction: 'import',
      payload: {
        eirNo: `EIR-OUT-${Math.floor(100000 + Math.random() * 900000)}`,
        containerNo: 'CMAU7788991',
        blNumber: 'BL-IMPORT-88991',
        truckPlate: '43C-888.88',
        gateCode: 'GATE-02',
        gateOutAt: new Date().toISOString(),
        emptyReturnDepot: 'Depot Tân Cảng Đà Nẵng',
        consigneeTaxCode: '0401889988',
      },
    },
    {
      code: 'ServiceOrderPaid',
      label: 'Dịch vụ: Lệnh hạ/lấy cont đã thanh toán (Người 3)',
      direction: 'general',
      payload: {
        orderCode: `SRV-${Math.floor(10000 + Math.random() * 90000)}`,
        serviceName: 'Nâng hạ container bãi (Lift On/Off)',
        amount: 850000,
        paymentRef: `PAY-MOCK-${Math.floor(100000 + Math.random() * 900000)}`,
        shipperTaxCode: '0401889988',
      },
    },
  ];

  const handleSelectPreset = (preset) => {
    setSimEventCode(preset.code);
    setSimPayload(JSON.stringify(preset.payload, null, 2));
  };

  const handleSimulateSubmit = async () => {
    try {
      setSimMessage(null);
      let parsed = {};
      try {
        parsed = simPayload ? JSON.parse(simPayload) : {};
      } catch {
        alert('Payload JSON không hợp lệ!');
        return;
      }

      const res = await cargoNotificationService.ingestEvent({
        eventId: `sim-evt-${Date.now()}`,
        eventCode: simEventCode,
        direction: simEventCode.startsWith('Booking') || simEventCode.startsWith('ContainerGateIn') ? 'export' : 'import',
        payload: parsed,
      });

      setSimMessage({ type: 'success', text: `Bắn sự kiện thành công! ${res.message || ''}` });
      loadAllData();
    } catch (e) {
      setSimMessage({ type: 'error', text: 'Lỗi phát sự kiện: ' + (e.response?.data?.message || e.message) });
    }
  };

  return (
    <div className="p-6 bg-slate-50 min-h-screen">
      {/* ── HEADER & KPI CARDS ── */}
      <div className="mb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 text-xs font-bold rounded-md bg-amber-100 text-amber-800 border border-amber-300">
                MÔ-ĐUN NGƯỜI 1
              </span>
              <h1 className="text-2xl font-extrabold text-slate-800">
                Theo Dõi Chứng Từ & Trung Tâm Thông Báo Chủ Hàng
              </h1>
            </div>
            <p className="text-sm text-slate-500 mt-1">
              Tiếp nhận sự kiện từ Hãng tàu, Điều độ cảng (TOS) và e-Port; tự động hóa cảnh báo hạn và theo dõi chứng từ điện tử.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={loadAllData}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50 shadow-sm"
            >
              <span className="material-symbols-outlined text-sm">{loading ? 'sync' : 'refresh'}</span>
              Làm mới
            </button>
            <button
              onClick={() => setActiveTab('simulator')}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-lg text-sm font-semibold shadow hover:opacity-95"
            >
              <span className="material-symbols-outlined text-sm">bolt</span>
              Mô phỏng sự kiện
            </button>
          </div>
        </div>

        {/* Thống kê nhanh */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-5">
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Việc cần làm</span>
              <span className="p-2 rounded-lg bg-red-50 text-red-600 material-symbols-outlined text-xl">assignment_late</span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-800">{todos.length}</span>
              <span className="text-xs text-red-600 font-semibold">
                ({todos.filter(t => t.priority === 'urgent').length} việc khẩn cấp)
              </span>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Thông báo chưa đọc</span>
              <span className="p-2 rounded-lg bg-amber-50 text-amber-600 material-symbols-outlined text-xl">notifications_active</span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-800">{notifPagination.unreadCount}</span>
              <span className="text-xs text-slate-500">/ tổng {notifPagination.total} tin</span>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Kho chứng từ điện tử</span>
              <span className="p-2 rounded-lg bg-emerald-50 text-emerald-600 material-symbols-outlined text-xl">receipt_long</span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-800">{documents.length}</span>
              <span className="text-xs text-emerald-600 font-semibold">EIR, e-D/O, B/L, AN</span>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Người nhận chờ gán</span>
              <span className="p-2 rounded-lg bg-indigo-50 text-indigo-600 material-symbols-outlined text-xl">person_search</span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-800">{unclaimedList.length}</span>
              <span className="text-xs text-indigo-600 font-semibold">Mục 4.2 tài liệu</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── TABS NAVIGATION ── */}
      <div className="flex border-b border-slate-200 mb-6 bg-white rounded-t-xl px-4 pt-2 shadow-sm gap-2">
        <button
          onClick={() => setActiveTab('todo')}
          className={`flex items-center gap-2 py-3 px-4 font-bold text-sm border-b-2 transition-all ${
            activeTab === 'todo'
              ? 'border-orange-500 text-orange-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <span className="material-symbols-outlined text-lg">checklist</span>
          Việc cần làm của tôi
          {todos.length > 0 && (
            <span className="px-2 py-0.5 text-xs rounded-full bg-red-100 text-red-700 font-extrabold">
              {todos.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('notifications')}
          className={`flex items-center gap-2 py-3 px-4 font-bold text-sm border-b-2 transition-all ${
            activeTab === 'notifications'
              ? 'border-orange-500 text-orange-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <span className="material-symbols-outlined text-lg">notifications</span>
          Trung tâm thông báo
          {notifPagination.unreadCount > 0 && (
            <span className="px-2 py-0.5 text-xs rounded-full bg-amber-100 text-amber-700 font-extrabold">
              {notifPagination.unreadCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('documents')}
          className={`flex items-center gap-2 py-3 px-4 font-bold text-sm border-b-2 transition-all ${
            activeTab === 'documents'
              ? 'border-orange-500 text-orange-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <span className="material-symbols-outlined text-lg">description</span>
          Theo dõi chứng từ điện tử
        </button>

        <button
          onClick={() => setActiveTab('unclaimed')}
          className={`flex items-center gap-2 py-3 px-4 font-bold text-sm border-b-2 transition-all ${
            activeTab === 'unclaimed'
              ? 'border-orange-500 text-orange-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <span className="material-symbols-outlined text-lg">pending_actions</span>
          Hàng đợi ngoại lệ Consignee
        </button>

        <button
          onClick={() => setActiveTab('simulator')}
          className={`flex items-center gap-2 py-3 px-4 font-bold text-sm border-b-2 transition-all ${
            activeTab === 'simulator'
              ? 'border-orange-500 text-orange-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <span className="material-symbols-outlined text-lg">terminal</span>
          Mô phỏng phát sự kiện
        </button>
      </div>

      {/* ── TAB 1: VIỆC CẦN LÀM (TO-DO & ACTION CENTER) ── */}
      {activeTab === 'todo' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-700">Lọc theo luồng:</span>
              {['all', 'export', 'import'].map((type) => (
                <button
                  key={type}
                  onClick={() => setTodoFilter(type)}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                    todoFilter === type
                      ? 'bg-slate-800 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {type === 'all' ? 'Tất cả' : type === 'export' ? 'Xuất khẩu' : 'Nhập khẩu'}
                </button>
              ))}
            </div>
            <span className="text-xs text-slate-400 font-medium">
              Tự động đối soát từ trạng thái Booking, VGM, e-D/O và EIR
            </span>
          </div>

          {todos.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-sm">
              <span className="material-symbols-outlined text-4xl text-slate-300">task_alt</span>
              <h3 className="text-base font-bold text-slate-700 mt-2">Hiện không có công việc nào đang chờ xử lý!</h3>
              <p className="text-xs text-slate-400 mt-1">
                Tất cả các thủ tục khai báo container, nộp VGM, e-D/O và trả vỏ rỗng đều đã hoàn tất.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {todos.map((todo) => {
                const isUrgent = todo.priority === 'urgent';
                return (
                  <div
                    key={todo.id}
                    className={`bg-white rounded-xl border p-5 shadow-sm transition-all hover:shadow-md flex flex-col justify-between ${
                      isUrgent ? 'border-red-300 bg-red-50/20' : 'border-slate-200'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span
                          className={`px-2 py-0.5 text-xs font-extrabold rounded-md uppercase ${
                            todo.direction === 'export'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-emerald-100 text-emerald-700'
                          }`}
                        >
                          {todo.direction === 'export' ? 'Chiều Xuất' : 'Chiều Nhập'}
                        </span>
                        <span
                          className={`px-2 py-0.5 text-xs font-bold rounded-md ${
                            isUrgent ? 'bg-red-100 text-red-700 font-extrabold animate-pulse' : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {isUrgent ? 'KHẨN CẤP' : 'BÌNH THƯỜNG'}
                        </span>
                      </div>

                      <h4 className="text-base font-bold text-slate-800">{todo.title}</h4>
                      <p className="text-xs text-slate-600 mt-1 leading-relaxed">{todo.description}</p>

                      {todo.deadline && (
                        <div className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200 inline-flex">
                          <span className="material-symbols-outlined text-sm">schedule</span>
                          Hạn chót: {new Date(todo.deadline).toLocaleString('vi-VN')}
                        </div>
                      )}
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-end">
                      {todo.actionUrl?.startsWith('/cargo/documents') ? (
                        <button
                          onClick={() => {
                            const parts = todo.actionUrl.split('/');
                            handleOpenDocModal(parts[3], parts[4]);
                          }}
                          className={`px-4 py-2 text-xs font-bold rounded-lg shadow-sm transition-all ${
                            isUrgent
                              ? 'bg-red-600 hover:bg-red-700 text-white'
                              : 'bg-slate-800 hover:bg-slate-900 text-white'
                          }`}
                        >
                          {todo.actionLabel} →
                        </button>
                      ) : (
                        <a
                          href={todo.actionUrl}
                          className={`px-4 py-2 text-xs font-bold rounded-lg shadow-sm transition-all ${
                            isUrgent
                              ? 'bg-red-600 hover:bg-red-700 text-white'
                              : 'bg-slate-800 hover:bg-slate-900 text-white'
                          }`}
                        >
                          {todo.actionLabel} →
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── TAB 2: TRUNG TÂM THÔNG BÁO (NOTIFICATION CENTER) ── */}
      {activeTab === 'notifications' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-slate-700">Lọc theo:</span>
              <select
                value={notifPriority}
                onChange={(e) => setNotifPriority(e.target.value)}
                className="px-3 py-1.5 text-xs font-semibold bg-slate-50 border border-slate-300 rounded-lg text-slate-700"
              >
                <option value="">Tất cả mức độ</option>
                <option value="urgent">Khẩn cấp</option>
                <option value="normal">Thường</option>
                <option value="info">Thông tin</option>
              </select>

              <select
                value={notifDirection}
                onChange={(e) => setNotifDirection(e.target.value)}
                className="px-3 py-1.5 text-xs font-semibold bg-slate-50 border border-slate-300 rounded-lg text-slate-700"
              >
                <option value="">Tất cả luồng</option>
                <option value="export">Xuất khẩu</option>
                <option value="import">Nhập khẩu</option>
              </select>

              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 cursor-pointer ml-2">
                <input
                  type="checkbox"
                  checked={notifOnlyUnread}
                  onChange={(e) => setNotifOnlyUnread(e.target.checked)}
                  className="rounded text-orange-500 focus:ring-orange-400"
                />
                Chỉ chưa đọc
              </label>
            </div>

            <button
              onClick={handleMarkAllRead}
              className="text-xs font-bold text-slate-600 hover:text-orange-600 underline"
            >
              Đánh dấu tất cả đã đọc
            </button>
          </div>

          {notifications.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-sm">
              <span className="material-symbols-outlined text-4xl text-slate-300">notifications_off</span>
              <h3 className="text-base font-bold text-slate-700 mt-2">Không tìm thấy thông báo nào!</h3>
            </div>
          ) : (
            <div className="space-y-3">
              {notifications.map((item) => {
                const isUrgent = item.priority === 'urgent';
                return (
                  <div
                    key={item.id}
                    className={`bg-white rounded-xl border p-4 shadow-sm transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                      item.is_read ? 'border-slate-200 opacity-90' : 'border-amber-300 bg-amber-50/10'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`p-2.5 rounded-xl shrink-0 material-symbols-outlined text-xl ${
                          isUrgent
                            ? 'bg-red-100 text-red-600'
                            : item.direction === 'import'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}
                      >
                        {isUrgent ? 'warning' : item.direction === 'import' ? 'move_to_inbox' : 'outbox'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span
                            className={`px-2 py-0.5 text-xs font-extrabold rounded ${
                              isUrgent ? 'bg-red-600 text-white' : item.priority === 'normal' ? 'bg-slate-200 text-slate-700' : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {item.priority?.toUpperCase()}
                          </span>
                          <span className="text-xs text-slate-400 font-medium">
                            {new Date(item.created_at).toLocaleString('vi-VN')}
                          </span>
                          {!item.is_read && (
                            <span className="px-1.5 py-0.2 text-[10px] font-bold rounded bg-amber-500 text-white">
                              MỚI
                            </span>
                          )}
                        </div>
                        <h4 className="text-sm font-bold text-slate-800">{item.title}</h4>
                        <p className="text-xs text-slate-600 mt-1">{item.message}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                      {item.document_type && item.document_id && (
                        <button
                          onClick={() => handleOpenDocModal(item.document_type, item.document_id)}
                          className="px-3 py-1.5 bg-orange-50 hover:bg-orange-100 text-orange-700 text-xs font-bold rounded-lg border border-orange-200"
                        >
                          Xem {item.document_type}
                        </button>
                      )}

                      {!item.is_read && (
                        <button
                          onClick={() => handleMarkAsRead(item.id)}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg"
                        >
                          Đã đọc
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── TAB 3: KHO CHỨNG TỪ ĐIỆN TỬ (DOCUMENT TRACKER & VIEWER) ── */}
      {activeTab === 'documents' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              <span className="text-sm font-semibold text-slate-700">Loại:</span>
              {[
                { key: 'all', label: 'Tất cả' },
                { key: 'EIR', label: 'Phiếu EIR' },
                { key: 'EDO', label: 'Lệnh e-D/O' },
                { key: 'BL', label: 'Vận đơn B/L' },
                { key: 'ARRIVAL_NOTICE', label: 'Giấy báo hàng đến' },
                { key: 'BOOKING', label: 'Booking' },
              ].map((t) => (
                <button
                  key={t.key}
                  onClick={() => setDocType(t.key)}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                    docType === t.key
                      ? 'bg-slate-800 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <form onSubmit={handleSearchDocs} className="flex items-center gap-2 w-full md:w-80">
              <input
                type="text"
                placeholder="Tìm số EIR, e-D/O, B/L, Cont..."
                value={docSearch}
                onChange={(e) => setDocSearch(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-orange-500"
              />
              <button
                type="submit"
                className="px-3 py-1.5 bg-slate-800 text-white rounded-lg text-xs font-bold hover:bg-slate-900"
              >
                Tìm
              </button>
            </form>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs font-bold uppercase tracking-wider border-b border-slate-200">
                  <th className="p-3">Loại chứng từ</th>
                  <th className="p-3">Số chứng từ</th>
                  <th className="p-3">Luồng</th>
                  <th className="p-3">Tóm tắt nghiệp vụ</th>
                  <th className="p-3">Ngày phát hành</th>
                  <th className="p-3">Trạng thái</th>
                  <th className="p-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                {documents.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-400">
                      Không tìm thấy chứng từ điện tử nào phù hợp.
                    </td>
                  </tr>
                ) : (
                  documents.map((d) => (
                    <tr key={`${d.documentType}-${d.id}`} className="hover:bg-slate-50/70 transition-colors">
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 font-extrabold rounded text-[11px] ${
                            d.documentType === 'EIR'
                              ? 'bg-amber-100 text-amber-800'
                              : d.documentType === 'EDO'
                              ? 'bg-emerald-100 text-emerald-800'
                              : d.documentType === 'BL'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-purple-100 text-purple-800'
                          }`}
                        >
                          {d.documentType}
                        </span>
                      </td>
                      <td className="p-3 font-bold text-slate-900">{d.documentNumber}</td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            d.direction === 'export' ? 'bg-blue-50 text-blue-700' : 'bg-green-50 text-green-700'
                          }`}
                        >
                          {d.direction === 'export' ? 'Xuất khẩu' : 'Nhập khẩu'}
                        </span>
                      </td>
                      <td className="p-3 max-w-xs truncate text-slate-600">{d.summary}</td>
                      <td className="p-3 font-medium text-slate-500">
                        {d.issueDate ? new Date(d.issueDate).toLocaleDateString('vi-VN') : 'N/A'}
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded font-semibold text-[11px] bg-slate-100 text-slate-700">
                          {d.status}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => handleOpenDocModal(d.documentType, d.documentNumber || d.id)}
                          className="px-3 py-1 bg-slate-800 hover:bg-slate-900 text-white rounded text-xs font-bold"
                        >
                          Xem chi tiết
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB 4: HÀNG ĐỢI NGOẠI LỆ CONSIGNEE CHƯA CÓ TÀI KHOẢN (MỤC 4.2) ── */}
      {activeTab === 'unclaimed' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="text-base font-bold text-slate-800">
              Hàng đợi ngoại lệ: "Người nhận chưa có tài khoản" (Mục 4.2 Tài liệu)
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Quy tắc riêng chiều nhập: Gán người nhận bằng cách ghép MST hoặc tên công ty trên B/L với công ty trong hệ thống.
              Không ghép được thì không bỏ rơi: đưa vào hàng đợi ngoại lệ để hỗ trợ thủ tục.
            </p>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs font-bold uppercase tracking-wider border-b border-slate-200">
                  <th className="p-3">Số Vận đơn (B/L)</th>
                  <th className="p-3">Người nhận (Consignee)</th>
                  <th className="p-3">Mã số thuế</th>
                  <th className="p-3">Tàu / Chuyến</th>
                  <th className="p-3">Số lượng Cont</th>
                  <th className="p-3">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                {unclaimedList.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-400">
                      Không có ngoại lệ nào trong hàng đợi. Tất cả Consignee trên Manifest đều đã được gán tự động!
                    </td>
                  </tr>
                ) : (
                  unclaimedList.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="p-3 font-bold text-slate-900">{item.bl_number}</td>
                      <td className="p-3 font-medium text-slate-800">{item.consignee_name}</td>
                      <td className="p-3 text-slate-600">{item.consignee_tax_code || 'Chưa khai báo'}</td>
                      <td className="p-3 text-slate-600">{item.vessel_name} ({item.voyage_number})</td>
                      <td className="p-3 font-semibold">{item.container_count} cont</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded font-bold text-[10px] bg-amber-100 text-amber-800">
                          {item.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB 5: MÔ PHỎNG PHÁT SỰ KIỆN (SIMULATOR) ── */}
      {activeTab === 'simulator' && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <div>
            <h3 className="text-base font-bold text-slate-800">
              Công cụ mô phỏng phát sự kiện (Event Ingestion Engine)
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Chọn sự kiện mẫu kích hoạt từ Hãng tàu, Người 2 (Điều độ TOS) hoặc Người 3 (Dịch vụ) để kiểm thử luồng phản ứng thời gian thực của Người 1.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            {presetEvents.map((preset) => (
              <button
                key={preset.code}
                type="button"
                onClick={() => handleSelectPreset(preset)}
                className={`p-2.5 text-left text-xs font-semibold rounded-lg border transition-all ${
                  simEventCode === preset.code
                    ? 'border-orange-500 bg-orange-50 text-orange-800'
                    : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700'
                }`}
              >
                <div className="font-bold">{preset.code}</div>
                <div className="text-[11px] text-slate-500 mt-0.5">{preset.label}</div>
              </button>
            ))}
          </div>

          <div className="pt-2">
            <label className="block text-xs font-bold text-slate-700 mb-1">Dữ liệu sự kiện (Payload JSON):</label>
            <textarea
              rows={8}
              value={simPayload}
              onChange={(e) => setSimPayload(e.target.value)}
              className="w-full p-3 font-mono text-xs bg-slate-900 text-emerald-400 rounded-lg border border-slate-700 focus:outline-none"
            />
          </div>

          {simMessage && (
            <div
              className={`p-3 rounded-lg text-xs font-bold ${
                simMessage.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
              }`}
            >
              {simMessage.text}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button
              onClick={handleSimulateSubmit}
              className="px-6 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:opacity-90 text-white rounded-lg text-xs font-extrabold shadow"
            >
              Phát sự kiện ngay (Publish Event)
            </button>
          </div>
        </div>
      )}

      {/* ── MODAL XEM CHI TIẾT CHỨNG TỪ ĐIỆN TỬ (DOCUMENT VIEWER MODAL) ── */}
      {selectedDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95">
            {/* Header chứng từ */}
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <div>
                <span className="px-2 py-0.5 text-[10px] font-black rounded bg-orange-500 text-white uppercase tracking-wider">
                  CHỨNG TỪ ĐIỆN TỬ CHÍNH THỨC
                </span>
                <h3 className="text-lg font-black mt-1">{selectedDoc.title}</h3>
                <p className="text-xs text-slate-400">
                  Mã chứng từ: <span className="text-white font-mono font-bold">{selectedDoc.referenceNo || selectedDoc.doNumber || selectedDoc.blNumber || selectedDoc.bookingNo}</span>
                </p>
              </div>
              <button
                onClick={() => setSelectedDoc(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <span className="material-symbols-outlined text-2xl">close</span>
              </button>
            </div>

            {/* Nội dung chứng từ */}
            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Thẻ khuyến nghị hành động */}
              {selectedDoc.actionRecommendation && (
                <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2.5">
                  <span className="material-symbols-outlined text-amber-600 text-lg">info</span>
                  <div>
                    <span className="font-bold">Khuyến nghị nghiệp vụ: </span>
                    {selectedDoc.actionRecommendation}
                  </div>
                </div>
              )}

              {/* Thông tin bảng chi tiết */}
              <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 text-xs">
                {selectedDoc.documentType === 'EIR' && (
                  <>
                    <div className="grid grid-cols-2 p-3 bg-slate-50 font-semibold">
                      <span className="text-slate-500">Tác nghiệp:</span>
                      <span className="font-bold text-slate-800">{selectedDoc.activityLabel}</span>
                    </div>
                    <div className="grid grid-cols-2 p-3">
                      <span className="text-slate-500">Xe & Tài xế:</span>
                      <span className="font-bold text-slate-800">{selectedDoc.truckPlate} ({selectedDoc.driverName})</span>
                    </div>
                    <div className="grid grid-cols-2 p-3 bg-slate-50">
                      <span className="text-slate-500">Số niêm chì (Seal):</span>
                      <span className="font-bold text-slate-800">{selectedDoc.sealNo}</span>
                    </div>
                    <div className="grid grid-cols-2 p-3">
                      <span className="text-slate-500">Tình trạng vỏ container:</span>
                      <span className="font-bold text-emerald-700">{selectedDoc.condition}</span>
                    </div>
                    {selectedDoc.emptyReturnDepot && (
                      <div className="grid grid-cols-2 p-3 bg-slate-50">
                        <span className="text-slate-500">Địa điểm hạ vỏ rỗng:</span>
                        <span className="font-bold text-amber-800">{selectedDoc.emptyReturnDepot}</span>
                      </div>
                    )}
                    <div className="grid grid-cols-2 p-3">
                      <span className="text-slate-500">Cổng giao nhận:</span>
                      <span className="font-bold text-slate-800">{selectedDoc.terminalName} - {selectedDoc.gateLabel}</span>
                    </div>
                  </>
                )}

                {selectedDoc.documentType === 'EDO' && (
                  <>
                    <div className="grid grid-cols-2 p-3 bg-slate-50 font-semibold">
                      <span className="text-slate-500">Trạng thái e-D/O:</span>
                      <span className={`font-bold ${selectedDoc.status === 'RELEASED' ? 'text-emerald-700' : 'text-red-600'}`}>
                        {selectedDoc.statusLabel}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 p-3">
                      <span className="text-slate-500">Vận đơn (B/L) liên kết:</span>
                      <span className="font-bold text-slate-800">{selectedDoc.blNumber}</span>
                    </div>
                    <div className="grid grid-cols-2 p-3 bg-slate-50">
                      <span className="text-slate-500">Người nhận hàng (Consignee):</span>
                      <span className="font-bold text-slate-800">{selectedDoc.consignee} (MST: {selectedDoc.consigneeTaxCode})</span>
                    </div>
                    <div className="grid grid-cols-2 p-3">
                      <span className="text-slate-500">Tàu & Chuyến:</span>
                      <span className="font-bold text-slate-800">{selectedDoc.vesselName} ({selectedDoc.voyageNo})</span>
                    </div>
                    <div className="grid grid-cols-2 p-3 bg-slate-50">
                      <span className="text-slate-500">Hạn hiệu lực lấy container:</span>
                      <span className="font-bold text-amber-800">{new Date(selectedDoc.validUntil).toLocaleString('vi-VN')}</span>
                    </div>
                    <div className="grid grid-cols-2 p-3">
                      <span className="text-slate-500">Nơi trả vỏ rỗng chỉ định:</span>
                      <span className="font-bold text-slate-800">{selectedDoc.emptyReturnDepot}</span>
                    </div>
                  </>
                )}

                {selectedDoc.documentType === 'BL' && (
                  <>
                    <div className="grid grid-cols-2 p-3 bg-slate-50">
                      <span className="text-slate-500">Người gửi (Shipper):</span>
                      <span className="font-bold text-slate-800">{selectedDoc.shipper}</span>
                    </div>
                    <div className="grid grid-cols-2 p-3">
                      <span className="text-slate-500">Người nhận (Consignee):</span>
                      <span className="font-bold text-slate-800">{selectedDoc.consignee}</span>
                    </div>
                    <div className="grid grid-cols-2 p-3 bg-slate-50">
                      <span className="text-slate-500">Cảng xếp / dỡ:</span>
                      <span className="font-bold text-slate-800">{selectedDoc.pol} → {selectedDoc.pod}</span>
                    </div>
                    <div className="grid grid-cols-2 p-3">
                      <span className="text-slate-500">Thanh toán cước:</span>
                      <span className="font-bold text-emerald-700">{selectedDoc.freightStatus}</span>
                    </div>
                    <div className="grid grid-cols-2 p-3 bg-slate-50">
                      <span className="text-slate-500">Tàu & Chuyến:</span>
                      <span className="font-bold text-slate-800">{selectedDoc.vesselName} ({selectedDoc.voyageNo})</span>
                    </div>
                  </>
                )}
              </div>

              {/* Mô phỏng mã QR xác thực */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-slate-800">Mã kiểm thực QR cảng biển</div>
                  <div className="text-[11px] font-mono text-slate-500 mt-0.5 truncate max-w-sm">
                    {selectedDoc.qrData}
                  </div>
                </div>
                <div className="p-2 bg-white border border-slate-300 rounded-lg shadow-sm font-mono text-xs font-bold text-slate-800">
                  [QR CODE]
                </div>
              </div>
            </div>

            {/* Footer nút bấm */}
            <div className="bg-slate-50 p-4 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                onClick={() => window.print()}
                className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg text-xs font-bold text-slate-700 inline-flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-sm">print</span>
                In chứng từ
              </button>
              <button
                onClick={() => setSelectedDoc(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 rounded-lg text-xs font-bold text-white"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
