import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { cargoNotificationService } from '../../services/cargoNotificationService';

export default function CargoDocumentTracking() {
  const navigate = useNavigate();
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

  // VGM Modal state (Hành động mục 3.2 #5)
  const [vgmModal, setVgmModal] = useState({ open: false, bookingNo: '', containerNo: '' });
  const [vgmForm, setVgmForm] = useState({ vgmWeight: '24500', authorizedPerson: 'Nguyễn Văn Kiểm', signatureMethod: 'ELECTRONIC' });

  // Hướng dẫn xử lý ngoại lệ / Liên hệ Hãng tàu (Hành động mục 3.2 #7)
  const [supportModal, setSupportModal] = useState({ open: false, title: '', reason: '', containerNo: '' });

  // Sửa danh sách container có lỗi (Mục 3.2 #4)
  const [editListModal, setEditListModal] = useState({
    open: false,
    bookingNo: '',
    errors: [],
    containerList: '',
  });

  // Tạo booking mới (Mục 3.2 #2)
  const [createBookingModal, setCreateBookingModal] = useState({
    open: false,
    reason: '',
    vesselName: 'EVER GLORY',
    voyageNo: '2602N',
    quantity: 2,
    containerType: '40HC',
    commodity: 'Thép cuộn cán nóng',
  });

  // Đặt lệnh lấy hàng e-Port (Mục 4.2 #3, #5)
  const [pickupModal, setPickupModal] = useState({
    open: false,
    doNumber: '',
    blNumber: '',
    validUntil: '',
    emptyReturnDepot: '',
  });

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

  // Xác nhận Draft B/L (Mục 3.2 #9)
  const handleConfirmDraftBL = async (blNumber, bookingNo) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xác nhận bản nháp vận đơn (Draft B/L) cho ${blNumber || bookingNo}?`)) return;
    try {
      const res = await cargoNotificationService.confirmDraftBL({ blNumber, bookingNo });
      alert(res.message || 'Xác nhận Draft B/L thành công!');
      setSelectedDoc(null);
      loadAllData();
    } catch (e) {
      alert('Lỗi xác nhận Draft B/L: ' + (e.response?.data?.message || e.message));
    }
  };

  // Nộp khai báo VGM (Mục 3.2 #5)
  const handleSubmitVGM = async (e) => {
    e.preventDefault();
    try {
      const res = await cargoNotificationService.submitVGM({
        bookingNo: vgmModal.bookingNo,
        containerNo: vgmModal.containerNo,
        vgmWeight: vgmForm.vgmWeight,
        authorizedPerson: vgmForm.authorizedPerson,
        signatureMethod: vgmForm.signatureMethod,
      });
      alert(res.message || 'Nộp VGM thành công!');
      setVgmModal({ open: false, bookingNo: '', containerNo: '' });
      loadAllData();
    } catch (e) {
      alert('Lỗi nộp VGM: ' + (e.response?.data?.message || e.message));
    }
  };

  // Quét nhắc hẹn tự động (Mục 3.2 Quy tắc 3)
  const handleProcessReminders = async () => {
    try {
      const res = await cargoNotificationService.processDueReminders();
      alert(res.message || 'Đã quét nhắc hẹn thành công!');
      loadAllData();
    } catch (e) {
      alert('Lỗi quét nhắc việc: ' + (e.response?.data?.message || e.message));
    }
  };

  // Sửa danh sách container có lỗi (Mục 3.2 #4)
  const handleSubmitEditList = async (e) => {
    e.preventDefault();
    try {
      const parsedContainers = editListModal.containerList
        .split(/[\n,]/)
        .map(c => c.trim().toUpperCase())
        .filter(Boolean);

      const res = await cargoNotificationService.ingestEvent({
        eventId: `evt-fix-list-${Date.now()}`,
        eventCode: 'ContainerListAnnounced',
        direction: 'export',
        payload: {
          bookingNo: editListModal.bookingNo,
          containers: parsedContainers,
          errors: [], // Đã sửa xong -> Không còn lỗi!
          shipperTaxCode: '0401889988',
        },
      });
      alert('Đã gửi lại danh sách container chuẩn hóa thành công! ' + (res.message || ''));
      setEditListModal({ open: false, bookingNo: '', errors: [], containerList: '' });
      loadAllData();
    } catch (err) {
      alert('Lỗi gửi lại danh sách: ' + (err.response?.data?.message || err.message));
    }
  };

  // Tạo booking mới sau khi bị từ chối (Mục 3.2 #2)
  const handleSubmitCreateBooking = async (e) => {
    e.preventDefault();
    try {
      const newBkg = `BKG-NEW-${Math.floor(1000 + Math.random() * 9000)}`;
      const res = await cargoNotificationService.ingestEvent({
        eventId: `evt-new-bkg-${Date.now()}`,
        eventCode: 'BookingConfirmed',
        direction: 'export',
        payload: {
          bookingNo: newBkg,
          vesselName: createBookingModal.vesselName,
          voyageNo: createBookingModal.voyageNo,
          etd: new Date(Date.now() + 72 * 3600 * 1000).toISOString(),
          cyCutOff: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
          vgmCutOff: new Date(Date.now() + 44 * 3600 * 1000).toISOString(),
          siCutOff: new Date(Date.now() + 40 * 3600 * 1000).toISOString(),
          emptyPickupPlace: 'Depot Tân Cảng Đà Nẵng',
          shipperTaxCode: '0401889988',
          shipper: 'Công ty Cổ phần Thép Hòa Phát',
          containers: ['MSKU9082134', 'TCKU4829102'],
        },
      });
      alert(`Đã tạo Booking mới [${newBkg}] thành công! Cảng đã tiếp nhận.`);
      setCreateBookingModal(prev => ({ ...prev, open: false }));
      loadAllData();
    } catch (err) {
      alert('Lỗi tạo booking mới: ' + (err.response?.data?.message || err.message));
    }
  };

  // Đặt lệnh lấy container e-Port (Mục 4.2 #3, #5)
  const handleSubmitPickupOrder = async (e) => {
    e.preventDefault();
    try {
      const newOrderCode = `ORD-PU-${Math.floor(100000 + Math.random() * 900000)}`;
      const res = await cargoNotificationService.ingestEvent({
        eventId: `evt-pickup-${Date.now()}`,
        eventCode: 'ServiceOrderSubmitted',
        direction: 'import',
        payload: {
          orderCode: newOrderCode,
          serviceType: 'Lệnh rút/lấy container hàng nhập',
          serviceName: 'Giao nhận container nhập bãi',
          amount: 450000,
          doNumber: pickupModal.doNumber,
          blNumber: pickupModal.blNumber,
          consigneeTaxCode: '0401889988',
        },
      });
      alert(`Đã đặt Lệnh lấy container [${newOrderCode}] thành công! Lệnh đang chờ thanh toán trên e-Port.`);
      setPickupModal({ open: false, doNumber: '', blNumber: '', validUntil: '', emptyReturnDepot: '' });
      loadAllData();
    } catch (err) {
      alert('Lỗi đặt lệnh lấy hàng: ' + (err.response?.data?.message || err.message));
    }
  };

  // Gán người nhận từ Hàng đợi ngoại lệ (Mục 4.2)
  const handleClaimConsignee = async (queueId) => {
    if (!window.confirm('Gán người nhận cho chứng từ này với tài khoản công ty hiện tại?')) return;
    try {
      const res = await cargoNotificationService.claimConsignee(queueId);
      alert(res.message || 'Đã gán người nhận thành công!');
      fetchUnclaimed();
      loadAllData();
    } catch (err) {
      alert('Lỗi gán người nhận: ' + (err.response?.data?.message || err.message));
    }
  };

  // Điều phối hành động kèm theo
  const handleOpenAction = (item) => {
    // 1. Khai hoặc nộp VGM / Declaration (Mục 3.2 #5)
    if (item.action_type === 'submit_declaration' || item.action_type === 'submit_vgm') {
      const bkg = item.bookingNo || item.document_id || 'BKG-TEST-1001';
      setVgmModal({ open: true, bookingNo: bkg, containerNo: item.data?.containerNo || 'MSKU9082134' });
      return;
    }

    // 2. Sửa danh sách container có lỗi (Mục 3.2 #4)
    if (item.action_type === 'edit_container_list') {
      const errs = item.data?.errors || (item.message && item.message.includes('Danh sách lỗi') ? [item.message] : ['Dòng 1: Container MSKU9082134 thiếu khai báo VGM', 'Dòng 2: Container TCKU4829102 sai số niêm chì']);
      setEditListModal({
        open: true,
        bookingNo: item.document_id || item.data?.bookingNo || 'BKG-TEST-1001',
        errors: Array.isArray(errs) ? errs : [errs],
        containerList: (item.data?.containers || ['MSKU9082134', 'TCKU4829102']).join('\n'),
      });
      return;
    }

    // 3. Tạo booking mới (Mục 3.2 #2)
    if (item.action_type === 'create_booking' || item.action_type === 'create_new_booking') {
      setCreateBookingModal({
        open: true,
        reason: item.message || item.data?.reason || 'Hết chỗ trên chuyến chỉ định',
        vesselName: 'EVER GLORY',
        voyageNo: '2602N',
        quantity: 2,
        containerType: '40HC',
        commodity: 'Thép cuộn cán nóng',
      });
      return;
    }

    // 4. Đặt lệnh lấy hàng (Mục 4.2 #3, #5)
    if (item.action_type === 'order_service_pickup') {
      setPickupModal({
        open: true,
        doNumber: item.document_id || item.data?.doNumber || 'EDO-DEMO-991',
        blNumber: item.data?.blNumber || 'BL-IMPORT-88991',
        validUntil: item.data?.validUntil || new Date(Date.now() + 72 * 3600 * 1000).toISOString(),
        emptyReturnDepot: item.data?.emptyReturnDepot || 'Depot Tân Cảng Đà Nẵng',
      });
      return;
    }

    // 5. Liên hệ hãng tàu / Hướng xử lý ngoại lệ (Mục 3.2 #7, Mục 4.2 #4)
    if (item.action_type === 'contact_shipping_line' || item.action_type === 'contact_support') {
      setSupportModal({
        open: true,
        title: item.title,
        reason: item.message,
        containerNo: item.data?.containerNo || (item.data?.containers ? item.data.containers.join(', ') : 'Container liên quan'),
      });
      return;
    }

    // 6. Xác nhận Draft B/L (Mục 3.2 #9)
    if (item.action_type === 'confirm_draft_bl') {
      handleOpenDocModal('BL', item.document_id || item.blNumber || 'HDMU-DAD-88991');
      return;
    }

    // 7. Mở booking hoặc Xem chi tiết (Mục 3.2 #1, #3, #8)
    if (item.action_type === 'open_booking' || item.action_type === 'view_details') {
      handleOpenDocModal('BOOKING', item.document_id || item.bookingNo || 'BKG-TEST-1001');
      return;
    }

    // 8. Xem EIR hoặc Nhắc trả vỏ (Mục 3.2 #6, Mục 4.2 #7)
    if (item.action_type === 'view_eir' || item.action_type === 'remind_empty_return') {
      handleOpenDocModal('EIR', item.document_id || item.eirNo || 'EIR-DEMO-01');
      return;
    }

    // 9. Xem B/L (Mục 3.2 #10)
    if (item.action_type === 'view_bl') {
      handleOpenDocModal('BL', item.document_id || item.blNumber || 'BL-DEMO-01');
      return;
    }

    // 10. Xem thông báo hàng đến / Xem container (Mục 4.2 #1, #2)
    if (item.action_type === 'view_arrival_notice' || item.action_type === 'view_container') {
      handleOpenDocModal('ARRIVAL_NOTICE', item.document_id || item.blNumber || 'BL-IMPORT-88991');
      return;
    }

    // 11. Xem lệnh dịch vụ (Mục 4.2 #6)
    if (item.action_type === 'view_order' || item.action_type === 'pay_order') {
      if (item.action_url) {
        navigate(item.action_url);
        return;
      }
    }

    // 12. Nếu có document_type & document_id
    if (item.document_type && item.document_id) {
      handleOpenDocModal(item.document_type, item.document_id);
      return;
    }

    // 13. Fallback URL
    if (item.action_url) {
      navigate(item.action_url);
    }
  };

  // Simulator preset payloads - Đầy đủ 10 sự kiện Xuất (Mục 3.2) & các sự kiện Nhập (Mục 4.2)
  const presetEvents = [
    {
      code: 'BookingConfirmed',
      label: '1. Booking được duyệt (Hành động: Mở booking)',
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
      code: 'BookingRejected',
      label: '2. Booking bị từ chối (Hành động: Tạo booking mới)',
      direction: 'export',
      payload: {
        bookingNo: `BKG-REJ-${Math.floor(1000 + Math.random() * 9000)}`,
        reason: 'Hết chỗ trên tàu chuyến 2601N và không đáp ứng hạn vận chuyển',
        shipperTaxCode: '0401889988',
      },
    },
    {
      code: 'BookingUpdated',
      label: '3. Đổi lịch tàu hoặc cut-off (Hành động: Xem chi tiết)',
      direction: 'export',
      payload: {
        bookingNo: 'BKG-TEST-1001',
        vesselName: 'EVER GLORY',
        voyageNo: '2601N',
        changes: [
          { field: 'ETD', oldValue: '2026-11-12T10:00:00Z', newValue: '2026-11-13T06:00:00Z' },
          { field: 'CY Cut-off', oldValue: '2026-11-11T18:00:00Z', newValue: '2026-11-12T12:00:00Z' },
        ],
        shipperTaxCode: '0401889988',
      },
    },
    {
      code: 'ContainerListAnnounced',
      label: '4. Danh sách container có lỗi (Hành động: Sửa danh sách)',
      direction: 'export',
      payload: {
        bookingNo: 'BKG-TEST-1001',
        errors: [
          'Dòng 1: Container MSKU9082134 thiếu khai báo VGM',
          'Dòng 2: Container TCKU4829102 số niêm chì không đúng định dạng',
        ],
        shipperTaxCode: '0401889988',
      },
    },
    {
      code: 'CutoffApproaching',
      label: '5. Sắp hết hạn VGM, CY, SI (Hành động: Khai hoặc nộp)',
      direction: 'export',
      payload: {
        bookingNo: 'BKG-TEST-1001',
        cutoffType: 'VGM và CY Cut-off',
        dueAt: new Date(Date.now() + 1.5 * 3600 * 1000).toISOString(), // Còn dưới 2h -> Mức Khẩn
        isUrgent: true,
        shipperTaxCode: '0401889988',
      },
    },
    {
      code: 'ContainerGatedIn',
      label: '6. Container qua cổng (Hành động: Xem EIR)',
      direction: 'export',
      payload: {
        eirNo: `EIR-IN-${Math.floor(100000 + Math.random() * 900000)}`,
        containers: ['MSKU9082134', 'TCKU4829102'], // Gộp nhiều container
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
      label: '7. Container bị từ chối ở cổng (Hành động: Liên hệ hãng tàu)',
      direction: 'export',
      payload: {
        containerNo: 'TCKU4829102',
        bookingNo: 'BKG-TEST-1001',
        truckPlate: '43C-777.99',
        gateCode: 'GATE-01',
        reason: 'Quá hạn CY cut-off và số niêm chì không khớp dữ liệu khai báo',
        shipperTaxCode: '0401889988',
      },
    },
    {
      code: 'ContainerRolledOver',
      label: '8. Container bị loại hoặc rớt tàu (Hành động: Xem chi tiết)',
      direction: 'export',
      payload: {
        bookingNo: 'BKG-TEST-1001',
        containers: ['TCKU4829102'],
        vesselName: 'EVER GLORY',
        voyageNo: '2601N',
        reason: 'Tàu đầy tải, điều độ hãng tàu chuyển container sang chuyến kế tiếp',
        newVoyageNo: '2602S',
        newEtd: new Date(Date.now() + 72 * 3600 * 1000).toISOString(),
        shipperTaxCode: '0401889988',
      },
    },
    {
      code: 'DraftBLIssued',
      label: '9. Draft B/L cần xác nhận (Hành động: Xem và xác nhận draft)',
      direction: 'export',
      payload: {
        blNumber: `HDMU-DAD-${Math.floor(10000 + Math.random() * 90000)}`,
        bookingNo: 'BKG-TEST-1001',
        confirmationDeadline: new Date(Date.now() + 10 * 3600 * 1000).toISOString(),
        shipperTaxCode: '0401889988',
      },
    },
    {
      code: 'BLIssued',
      label: '10. B/L đã phát hành (Hành động: Xem B/L)',
      direction: 'export',
      payload: {
        blNumber: `HDMU-DAD-${Math.floor(10000 + Math.random() * 90000)}`,
        bookingNo: 'BKG-TEST-1001',
        shippedOnBoardDate: new Date().toISOString(),
        shipperTaxCode: '0401889988',
      },
    },
    // Chiều nhập khẩu (Mục 4.2)
    {
      code: 'ManifestSent',
      label: 'M1. Hãng tàu gửi Manifest nhập (Xem thông báo hàng đến)',
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
      code: 'ContainerDischarged',
      label: 'M2. Container đã dỡ khỏi tàu (Xem container)',
      direction: 'import',
      payload: {
        containerNo: 'CMAU7788991',
        blNumber: 'BL-IMPORT-88991',
        vesselName: 'CMA CGM CHENNAI',
        dischargedAt: new Date().toISOString(),
        yardLocation: 'BLOCK-B2-04-03',
        consigneeTaxCode: '0401889988',
      },
    },
    {
      code: 'EDoIssued',
      label: 'M3. Hãng tàu cấp e-D/O lấy hàng (Đặt lệnh lấy hàng)',
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
      label: 'M6. Hãng tàu TẠM GIỮ e-D/O (Liên hệ hãng tàu)',
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
      label: 'M5. Lấy container ra cổng - Nhắc trả vỏ rỗng (Nhắc trả vỏ)',
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
          <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex-wrap gap-2">
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
            <div className="flex items-center gap-2">
              <button
                onClick={handleProcessReminders}
                className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-lg text-xs font-bold inline-flex items-center gap-1 shadow-sm"
                title="Quét các mốc T-24H, T-2H và tự động phát sinh việc cần làm"
              >
                <span className="material-symbols-outlined text-sm">alarm</span>
                Quét mốc nhắc hẹn (T-24H / T-2H)
              </button>
              <span className="text-xs text-slate-400 font-medium hidden md:inline">
                Tự động đối soát từ Booking, VGM, e-D/O và EIR
              </span>
            </div>
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
                      <button
                        onClick={() => handleOpenAction(todo)}
                        className={`px-4 py-2 text-xs font-bold rounded-lg shadow-sm transition-all ${
                          isUrgent
                            ? 'bg-red-600 hover:bg-red-700 text-white'
                            : 'bg-slate-800 hover:bg-slate-900 text-white'
                        }`}
                      >
                        {todo.actionLabel} →
                      </button>
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

                    <div className="flex items-center gap-2 shrink-0 self-end md:self-center flex-wrap justify-end">
                      {(item.action_label || item.document_type || item.action_type) && (
                        <button
                          onClick={() => handleOpenAction(item)}
                          className={`px-3 py-1.5 text-xs font-bold rounded-lg border shadow-sm transition-all flex items-center gap-1 ${
                            isUrgent
                              ? 'bg-red-600 hover:bg-red-700 text-white border-red-700'
                              : 'bg-orange-50 hover:bg-orange-100 text-orange-700 border-orange-200'
                          }`}
                        >
                          {item.action_label || (item.document_type ? `Xem ${item.document_type}` : 'Xem chi tiết')} →
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
                  <th className="p-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                {unclaimedList.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-400">
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
                      <td className="p-3 text-right">
                        {item.status === 'PENDING_CLAIM' && (
                          <button
                            onClick={() => handleClaimConsignee(item.id)}
                            className="px-2.5 py-1 bg-gradient-to-r from-orange-500 to-amber-500 hover:opacity-90 text-white rounded font-bold text-[11px] shadow-sm transition"
                          >
                            Gán người nhận
                          </button>
                        )}
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

                {selectedDoc.documentType === 'ARRIVAL_NOTICE' && (
                  <>
                    <div className="grid grid-cols-2 p-3 bg-slate-50 font-semibold">
                      <span className="text-slate-500">Tàu & Chuyến:</span>
                      <span className="font-bold text-slate-800">{selectedDoc.vesselName} ({selectedDoc.voyageNo})</span>
                    </div>
                    <div className="grid grid-cols-2 p-3">
                      <span className="text-slate-500">Ngày dự kiến cập cảng (ETA):</span>
                      <span className="font-bold text-blue-700">{selectedDoc.eta ? new Date(selectedDoc.eta).toLocaleString('vi-VN') : 'N/A'}</span>
                    </div>
                    <div className="grid grid-cols-2 p-3 bg-slate-50">
                      <span className="text-slate-500">Người nhận hàng (Consignee):</span>
                      <span className="font-bold text-slate-800">{selectedDoc.consigneeName} (MST: {selectedDoc.consigneeTaxCode})</span>
                    </div>
                    <div className="grid grid-cols-2 p-3">
                      <span className="text-slate-500">Thời hạn miễn phí lưu bãi:</span>
                      <span className="font-bold text-emerald-700">{selectedDoc.freeTimeDays} ngày kể từ khi dỡ hàng</span>
                    </div>
                    <div className="grid grid-cols-2 p-3 bg-slate-50">
                      <span className="text-slate-500">Danh sách Container:</span>
                      <span className="font-bold text-slate-800 font-mono">{(selectedDoc.containers || []).join(', ')}</span>
                    </div>
                    {selectedDoc.charges && selectedDoc.charges.length > 0 && (
                      <div className="p-3 bg-amber-50/50">
                        <div className="font-bold text-slate-700 mb-1">Các khoản cước & phụ phí Hãng tàu thu (tạm tính):</div>
                        <div className="space-y-1">
                          {selectedDoc.charges.map((c, i) => (
                            <div key={i} className="flex justify-between text-slate-600">
                              <span>- {c.item}</span>
                              <span className="font-bold text-slate-800">{Number(c.amount).toLocaleString('vi-VN')} VND</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}

                {selectedDoc.documentType === 'BOOKING' && (
                  <>
                    <div className="grid grid-cols-2 p-3 bg-slate-50 font-semibold">
                      <span className="text-slate-500">Số Booking:</span>
                      <span className="font-bold text-slate-800 font-mono">{selectedDoc.bookingNo}</span>
                    </div>
                    <div className="grid grid-cols-2 p-3">
                      <span className="text-slate-500">Tàu & Chuyến dự kiến:</span>
                      <span className="font-bold text-slate-800">{selectedDoc.vesselName} ({selectedDoc.voyageNo})</span>
                    </div>
                    <div className="grid grid-cols-2 p-3 bg-slate-50">
                      <span className="text-slate-500">Chủ hàng (Shipper):</span>
                      <span className="font-bold text-slate-800">{selectedDoc.shipper}</span>
                    </div>
                    <div className="grid grid-cols-2 p-3">
                      <span className="text-slate-500">Số lượng & Loại container:</span>
                      <span className="font-bold text-slate-800">{selectedDoc.quantity} container x {selectedDoc.containerType}</span>
                    </div>
                    <div className="grid grid-cols-2 p-3 bg-slate-50">
                      <span className="text-slate-500">Hạn chót hạ bãi (CY Cut-off):</span>
                      <span className="font-bold text-amber-800">{selectedDoc.cyCutOff ? new Date(selectedDoc.cyCutOff).toLocaleString('vi-VN') : 'Theo thông báo hãng tàu'}</span>
                    </div>
                    <div className="grid grid-cols-2 p-3">
                      <span className="text-slate-500">Hạn chót nộp VGM (VGM Cut-off):</span>
                      <span className="font-bold text-amber-800">{selectedDoc.vgmCutOff ? new Date(selectedDoc.vgmCutOff).toLocaleString('vi-VN') : 'Trước giờ CY Cut-off'}</span>
                    </div>
                    <div className="grid grid-cols-2 p-3 bg-slate-50">
                      <span className="text-slate-500">Địa điểm lấy vỏ rỗng:</span>
                      <span className="font-bold text-slate-800">{selectedDoc.emptyPickupPlace}</span>
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
            <div className="bg-slate-50 p-4 border-t border-slate-200 flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                {selectedDoc.documentType === 'BL' && (
                  <button
                    onClick={() => handleConfirmDraftBL(selectedDoc.blNumber, selectedDoc.bookingNo)}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-xs font-bold text-white inline-flex items-center gap-1.5 shadow-sm"
                  >
                    <span className="material-symbols-outlined text-sm">check_circle</span>
                    Xác nhận bản nháp Draft B/L
                  </button>
                )}
                {selectedDoc.documentType === 'BOOKING' && (
                  <button
                    onClick={() => {
                      setSelectedDoc(null);
                      setVgmModal({ open: true, bookingNo: selectedDoc.bookingNo, containerNo: 'MSKU9082134' });
                    }}
                    className="px-4 py-2 bg-orange-600 hover:bg-orange-700 rounded-lg text-xs font-bold text-white inline-flex items-center gap-1.5 shadow-sm"
                  >
                    <span className="material-symbols-outlined text-sm">scale</span>
                    Khai báo / Nộp VGM
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
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
        </div>
      )}

      {/* ── MODAL KHAI BÁO / NỘP VGM ĐIỆN TỬ (HÀNH ĐỘNG MỤC 3.2 #5) ── */}
      {vgmModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="bg-gradient-to-r from-orange-600 to-amber-600 text-white p-5 flex items-center justify-between">
              <div>
                <span className="px-2 py-0.5 text-[10px] font-black rounded bg-white/20 uppercase tracking-wider">
                  THỦ TỤC XUẤT KHẨU (MỤC 3.2)
                </span>
                <h3 className="text-lg font-black mt-1">Khai báo khối lượng toàn bộ (VGM)</h3>
                <p className="text-xs text-orange-100">Booking: {vgmModal.bookingNo}</p>
              </div>
              <button
                onClick={() => setVgmModal({ open: false, bookingNo: '', containerNo: '' })}
                className="p-1 rounded-lg text-orange-100 hover:text-white"
              >
                <span className="material-symbols-outlined text-2xl">close</span>
              </button>
            </div>

            <form onSubmit={handleSubmitVGM} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Số Container:</label>
                <input
                  type="text"
                  required
                  value={vgmModal.containerNo}
                  onChange={(e) => setVgmModal(prev => ({ ...prev, containerNo: e.target.value.toUpperCase() }))}
                  className="w-full p-2.5 font-mono text-xs border border-slate-300 rounded-lg font-bold text-slate-800"
                  placeholder="VD: MSKU9082134"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Khối lượng toàn bộ xác nhận (VGM Weight - Kg):</label>
                <input
                  type="number"
                  required
                  value={vgmForm.vgmWeight}
                  onChange={(e) => setVgmForm(prev => ({ ...prev, vgmWeight: e.target.value }))}
                  className="w-full p-2.5 text-xs border border-slate-300 rounded-lg font-bold text-slate-800"
                  placeholder="VD: 24500"
                />
                <span className="text-[11px] text-slate-400">Bao gồm trọng lượng hàng hóa + vật liệu chèn lót + trọng lượng vỏ container rỗng.</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Phương pháp xác định:</label>
                <select
                  value={vgmForm.signatureMethod}
                  onChange={(e) => setVgmForm(prev => ({ ...prev, signatureMethod: e.target.value }))}
                  className="w-full p-2.5 text-xs border border-slate-300 rounded-lg bg-slate-50 font-medium text-slate-700"
                >
                  <option value="METHOD_1">Phương pháp 1: Cân toàn bộ xe và container tại trạm cân đạt chuẩn</option>
                  <option value="METHOD_2">Phương pháp 2: Cân từng kiện hàng + bì đóng gói + trọng lượng vỏ</option>
                  <option value="ELECTRONIC">Cân điện tử tích hợp cổng cảng Tiên Sa</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Người ký xác nhận ủy quyền:</label>
                <input
                  type="text"
                  required
                  value={vgmForm.authorizedPerson}
                  onChange={(e) => setVgmForm(prev => ({ ...prev, authorizedPerson: e.target.value }))}
                  className="w-full p-2.5 text-xs border border-slate-300 rounded-lg text-slate-800 font-medium"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setVgmModal({ open: false, bookingNo: '', containerNo: '' })}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:opacity-90 text-white rounded-lg text-xs font-extrabold shadow"
                >
                  Ký & Nộp VGM ngay
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL HƯỚNG DẪN XỬ LÝ NGOẠI LỆ / LIÊN HỆ HÃNG TÀU (HÀNH ĐỘNG MỤC 3.2 #7) ── */}
      {supportModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="bg-red-600 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-2xl">warning</span>
                <div>
                  <h3 className="text-base font-black">Hướng dẫn xử lý sự cố & Liên hệ Hãng tàu</h3>
                  <p className="text-xs text-red-100">{supportModal.containerNo}</p>
                </div>
              </div>
              <button
                onClick={() => setSupportModal({ open: false, title: '', reason: '', containerNo: '' })}
                className="p-1 rounded-lg text-red-200 hover:text-white"
              >
                <span className="material-symbols-outlined text-2xl">close</span>
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-900">
                <span className="font-bold">Lý do ghi nhận tại Cảng: </span>
                {supportModal.reason}
              </div>

              <div>
                <h4 className="font-bold text-slate-800 text-sm mb-2">Quy trình xử lý theo nghiệp vụ cảng container:</h4>
                <ol className="list-decimal list-inside space-y-2 text-slate-600 leading-relaxed">
                  <li>
                    <strong className="text-slate-800">Trường hợp số niêm chì không khớp:</strong> Yêu cầu tài xế giữ nguyên xe tại làn chờ quầy kiểm soát Gate-01, mở lại tờ khai danh sách cont để đối soát số chì thực tế.
                  </li>
                  <li>
                    <strong className="text-slate-800">Trường hợp thiếu khai báo VGM:</strong> Sử dụng chức năng <em>"Khai hoặc nộp VGM"</em> ngay trên màn hình để nộp bổ sung chứng chỉ cân điện tử, hệ thống sẽ cấp phép hạ bãi tức thì.
                  </li>
                  <li>
                    <strong className="text-slate-800">Trường hợp quá hạn CY Cut-off:</strong> Liên hệ ngay đại diện Hãng tàu qua thông tin bên dưới để xin phát hành <em>Công văn chấp thuận hạ trễ (Late Gate-in Authorization)</em> đưa vào hàng đợi ngoại lệ của Điều độ viên.
                  </li>
                </ol>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 font-medium text-slate-700">
                <div className="font-bold text-slate-900">Đầu mối hỗ trợ 24/7 (Cảng Tiên Sa & Hãng tàu):</div>
                <div>- Hotline hỗ trợ khẩn cấp: <span className="font-bold text-orange-600">1900 6868 (Phím 2)</span></div>
                <div>- Email tiếp nhận chỉ thị ngoại lệ: <span className="font-mono text-slate-900">ops@nexusport.vn / exception@shippingline.vn</span></div>
                <div>- Quầy thủ tục hiện trường: <span className="font-semibold">Bộ phận Điều độ Cổng Cảng (Gate Ops)</span></div>
              </div>

              <div className="flex justify-end pt-2 border-t border-slate-100">
                <button
                  onClick={() => setSupportModal({ open: false, title: '', reason: '', containerNo: '' })}
                  className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold"
                >
                  Đã hiểu & Đóng hướng dẫn
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* ── MODAL SỬA DANH SÁCH CONTAINER CÓ LỖI (MỤC 3.2 #4) ── */}
      {editListModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200">
            <div className="bg-amber-600 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-2xl">rule</span>
                <div>
                  <h3 className="text-base font-black">Sửa danh sách container có lỗi</h3>
                  <p className="text-xs text-amber-100">Booking: {editListModal.bookingNo}</p>
                </div>
              </div>
              <button
                onClick={() => setEditListModal({ open: false, bookingNo: '', errors: [], containerList: '' })}
                className="p-1 rounded-lg text-amber-100 hover:text-white"
              >
                <span className="material-symbols-outlined text-2xl">close</span>
              </button>
            </div>

            <form onSubmit={handleSubmitEditList} className="p-6 space-y-4">
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl space-y-1">
                <div className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-base text-amber-600">error</span>
                  Danh sách lỗi từng dòng cần khắc phục:
                </div>
                <div className="space-y-1 pl-5 text-xs text-amber-800">
                  {editListModal.errors.map((err, idx) => (
                    <div key={idx} className="list-disc leading-relaxed">
                      • {typeof err === 'object' ? (err.message || JSON.stringify(err)) : err}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nhập danh sách Container đã chuẩn hóa (mỗi dòng 1 mã container):
                </label>
                <textarea
                  rows={4}
                  required
                  value={editListModal.containerList}
                  onChange={(e) => setEditListModal(prev => ({ ...prev, containerList: e.target.value }))}
                  className="w-full p-3 font-mono text-xs border border-slate-300 rounded-lg text-slate-800 font-semibold focus:ring-2 focus:ring-amber-500"
                  placeholder="MSKU9082134&#10;TCKU4829102"
                />
                <span className="text-[11px] text-slate-400">
                  Định dạng chuẩn ISO 6346: 4 chữ cái + 7 chữ số (Ví dụ: MSKU9082134).
                </span>
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditListModal({ open: false, bookingNo: '', errors: [], containerList: '' })}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-extrabold shadow"
                >
                  Lưu & Gửi lại danh sách chuẩn
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL TẠO BOOKING MỚI SAU KHI BỊ TỪ CHỐI (MỤC 3.2 #2) ── */}
      {createBookingModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200">
            <div className="bg-blue-600 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-2xl">add_shopping_cart</span>
                <div>
                  <h3 className="text-base font-black">Tạo Booking Xuất khẩu mới</h3>
                  <p className="text-xs text-blue-100">Cấp lại chỗ sau khi Booking cũ bị từ chối</p>
                </div>
              </div>
              <button
                onClick={() => setCreateBookingModal(prev => ({ ...prev, open: false }))}
                className="p-1 rounded-lg text-blue-100 hover:text-white"
              >
                <span className="material-symbols-outlined text-2xl">close</span>
              </button>
            </div>

            <form onSubmit={handleSubmitCreateBooking} className="p-6 space-y-4">
              {createBookingModal.reason && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800">
                  <span className="font-bold">Lý do từ chối trước đó: </span>
                  {createBookingModal.reason}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Tên tàu:</label>
                  <input
                    type="text"
                    required
                    value={createBookingModal.vesselName}
                    onChange={(e) => setCreateBookingModal(prev => ({ ...prev, vesselName: e.target.value }))}
                    className="w-full p-2.5 text-xs border border-slate-300 rounded-lg font-bold text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Số chuyến mới:</label>
                  <input
                    type="text"
                    required
                    value={createBookingModal.voyageNo}
                    onChange={(e) => setCreateBookingModal(prev => ({ ...prev, voyageNo: e.target.value }))}
                    className="w-full p-2.5 text-xs border border-slate-300 rounded-lg font-bold text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Số lượng container:</label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    required
                    value={createBookingModal.quantity}
                    onChange={(e) => setCreateBookingModal(prev => ({ ...prev, quantity: Number(e.target.value) }))}
                    className="w-full p-2.5 text-xs border border-slate-300 rounded-lg font-bold text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Loại container:</label>
                  <select
                    value={createBookingModal.containerType}
                    onChange={(e) => setCreateBookingModal(prev => ({ ...prev, containerType: e.target.value }))}
                    className="w-full p-2.5 text-xs border border-slate-300 rounded-lg bg-slate-50 font-bold text-slate-800"
                  >
                    <option value="20GP">20' Dry Standard (20GP)</option>
                    <option value="40HC">40' High Cube (40HC)</option>
                    <option value="40RF">40' Reefer Container (40RF)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Mô tả hàng hóa:</label>
                <input
                  type="text"
                  required
                  value={createBookingModal.commodity}
                  onChange={(e) => setCreateBookingModal(prev => ({ ...prev, commodity: e.target.value }))}
                  className="w-full p-2.5 text-xs border border-slate-300 rounded-lg text-slate-800 font-medium"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCreateBookingModal(prev => ({ ...prev, open: false }))}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-extrabold shadow"
                >
                  Gửi yêu cầu Booking mới
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL ĐẶT LỆNH LẤY HÀNG (MỤC 4.2 #3, #5) ── */}
      {pickupModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200">
            <div className="bg-emerald-600 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-2xl">local_shipping</span>
                <div>
                  <h3 className="text-base font-black">Đặt Lệnh Giao Nhận Lấy Hàng (e-Port)</h3>
                  <p className="text-xs text-emerald-100">e-D/O: {pickupModal.doNumber}</p>
                </div>
              </div>
              <button
                onClick={() => setPickupModal({ open: false, doNumber: '', blNumber: '', validUntil: '', emptyReturnDepot: '' })}
                className="p-1 rounded-lg text-emerald-100 hover:text-white"
              >
                <span className="material-symbols-outlined text-2xl">close</span>
              </button>
            </div>

            <form onSubmit={handleSubmitPickupOrder} className="p-6 space-y-4 text-xs">
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2 text-emerald-950 font-medium">
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">Số lệnh e-D/O:</span>
                  <span className="font-mono font-bold text-slate-900">{pickupModal.doNumber}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">Vận đơn B/L:</span>
                  <span className="font-mono font-bold text-slate-900">{pickupModal.blNumber}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">Hạn hiệu lực e-D/O:</span>
                  <span className="font-bold text-slate-800">{new Date(pickupModal.validUntil).toLocaleString('vi-VN')}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">Nơi trả vỏ rỗng:</span>
                  <span className="font-bold text-emerald-800">{pickupModal.emptyReturnDepot}</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-emerald-200">
                  <span className="text-slate-600">Biểu phí nâng hạ container:</span>
                  <span className="font-bold text-slate-900">450.000 VND / cont</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">Phí lưu bãi tạm tính:</span>
                  <span className="font-bold text-emerald-700">0 VND (Trong hạn Free Time)</span>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setPickupModal({ open: false, doNumber: '', blNumber: '', validUntil: '', emptyReturnDepot: '' })}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-extrabold shadow"
                >
                  Xác nhận đặt lệnh lấy hàng
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
