import React, { useState, useEffect, useMemo } from 'react';
import reeferService from '../../services/reeferService';
import reeferSignalRService from '../../services/reeferSignalRService';

export default function ReeferManagement() {
  const [activeTab, setActiveTab] = useState('plugs'); // 'plugs' | 'sessions' | 'requests' | 'alerts'
  const [lastUpdatedSessionId, setLastUpdatedSessionId] = useState(null);

  // Dữ liệu từ máy chủ
  const [overview, setOverview] = useState({
    total_plugs: 0,
    available_plugs: 0,
    occupied_plugs: 0,
    reserved_plugs: 0,
    faulty_plugs: 0,
    active_sessions: 0,
    awaiting_power_sessions: 0,
    pending_requests: 0,
    active_alerts: 0,
  });

  const [plugs, setPlugs] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [requests, setRequests] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [eligibleContainers, setEligibleContainers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');

  // Trạng thái hộp thoại (Modal)
  const [modalType, setModalType] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [modalForm, setModalForm] = useState({});
  const [modalSubmitting, setModalSubmitting] = useState(false);
  const [tempHistory, setTempHistory] = useState([]);
  const [historyFilter, setHistoryFilter] = useState('ALL');
  const [historyHover, setHistoryHover] = useState(null);

  // Thông báo nhanh
  const [notification, setNotification] = useState(null);

  const showToast = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3500);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [ovRes, plRes, seRes, reRes, alRes, ecRes, monOvRes] = await Promise.allSettled([
        reeferService.getOverview(),
        reeferService.getPlugs(),
        reeferService.getSessions(),
        reeferService.getRequests(),
        reeferService.getAlerts(),
        reeferService.getEligibleContainers(),
        reeferService.getMonitoringOverview(),
      ]);

      if (ovRes.status === 'fulfilled') setOverview(ovRes.value);
      if (reRes.status === 'fulfilled') setRequests(reRes.value || []);
      if (alRes.status === 'fulfilled') setAlerts(alRes.value || []);
      if (ecRes.status === 'fulfilled') setEligibleContainers(ecRes.value || []);

      let rawPlugs = plRes.status === 'fulfilled' ? (plRes.value || []) : [];
      let rawSessions = seRes.status === 'fulfilled' ? (seRes.value || []) : [];

      // Đồng bộ các thông số nhiệt độ mới nhất từ C# Monitoring Service vào Plugs và Sessions
      const monitoredSessions = monOvRes.status === 'fulfilled' ? (monOvRes.value?.monitoredSessions || []) : [];
      if (monitoredSessions.length > 0) {
        const monMap = new Map(monitoredSessions.map((m) => [m.sessionId, m]));

        rawPlugs = rawPlugs.map((p) => {
          if (!p.active_session) return p;
          const mon = monMap.get(p.active_session.id);
          if (!mon) return p;
          return {
            ...p,
            is_power_on: mon.actualPowerStatus === 'POWERED_ON',
            active_session: {
              ...p.active_session,
              last_temperature: mon.latestTemperature ?? p.active_session.last_temperature,
              supply_temperature: mon.latestSupplyTemperature ?? p.active_session.supply_temperature,
              last_checked_at: mon.lastMeasuredAt ?? p.active_session.last_checked_at,
              actual_power_status: mon.actualPowerStatus ?? p.active_session.actual_power_status,
              is_abnormal: mon.latestIsAbnormal ?? false,
            },
          };
        });

        rawSessions = rawSessions.map((s) => {
          const mon = monMap.get(s.id);
          if (!mon) return s;
          return {
            ...s,
            last_temperature: mon.latestTemperature ?? s.last_temperature,
            supply_temperature: mon.latestSupplyTemperature ?? s.supply_temperature,
            last_checked_at: mon.lastMeasuredAt ?? s.last_checked_at,
            actual_power_status: mon.actualPowerStatus ?? s.actual_power_status,
            is_abnormal: mon.latestIsAbnormal ?? false,
          };
        });
      }

      setPlugs(rawPlugs);
      setSessions(rawSessions);
    } catch (err) {
      console.error(err);
      showToast('Không thể kết nối đến máy chủ.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    // 1. Lắng nghe sự kiện đo đạc nhiệt độ thời gian thực (MonitoringUpdated)
    const unsubMonitoring = reeferSignalRService.onMonitoringUpdated((payload) => {
      // Đánh dấu session vừa nhận dữ liệu để tạo hiệu ứng nhấp nháy thị giác (Visual Pulse)
      setLastUpdatedSessionId(payload.sessionId);
      setTimeout(() => {
        setLastUpdatedSessionId((cur) => (cur === payload.sessionId ? null : cur));
      }, 1800);

      // Cập nhật danh sách ổ cắm
      setPlugs((prevPlugs) =>
        prevPlugs.map((p) => {
          const matchPlug = p.id === payload.plugId || p.active_session?.id === payload.sessionId;
          if (!matchPlug) return p;
          return {
            ...p,
            is_power_on: payload.actualPowerStatus === 'POWERED_ON',
            active_session: p.active_session
              ? {
                  ...p.active_session,
                  last_temperature: payload.returnTemperature,
                  supply_temperature: payload.supplyTemperature,
                  last_checked_at: payload.recordedAt,
                  actual_power_status: payload.actualPowerStatus,
                  is_abnormal: payload.isAbnormal,
                }
              : {
                  id: payload.sessionId,
                  container_id: payload.containerId,
                  container_no: payload.containerNo,
                  plug_id: payload.plugId,
                  session_status: 'ACTIVE',
                  actual_power_status: payload.actualPowerStatus,
                  target_temperature: payload.targetTemperature,
                  temp_tolerance: payload.tempTolerance,
                  last_temperature: payload.returnTemperature,
                  supply_temperature: payload.supplyTemperature,
                  last_checked_at: payload.recordedAt,
                  is_abnormal: payload.isAbnormal,
                },
          };
        })
      );

      // Cập nhật danh sách phiên
      setSessions((prevSessions) =>
        prevSessions.map((s) => {
          if (s.id !== payload.sessionId) return s;
          return {
            ...s,
            last_temperature: payload.returnTemperature,
            supply_temperature: payload.supplyTemperature,
            last_checked_at: payload.recordedAt,
            actual_power_status: payload.actualPowerStatus,
            is_abnormal: payload.isAbnormal,
          };
        })
      );

      // Nếu đang mở modal lịch sử đo cho phiên này, thêm bản ghi mới ngay lập tức
      setTempHistory((prevHist) => {
        if (!prevHist || prevHist.length === 0) return prevHist;
        const matchSession = prevHist[0]?.session_id === payload.sessionId || prevHist[prevHist.length - 1]?.session_id === payload.sessionId;
        if (!matchSession) return prevHist;
        const newRecord = {
          id: 'rt_' + Date.now(),
          session_id: payload.sessionId,
          return_temperature: Number(payload.returnTemperature),
          supply_temperature: payload.supplyTemperature != null ? Number(payload.supplyTemperature) : null,
          ambient_temperature: 32,
          data_source: payload.dataSource || 'IOT_TELEMATICS',
          is_abnormal: Boolean(payload.isAbnormal),
          power_status: payload.actualPowerStatus || 'POWERED_ON',
          alert_message: payload.isAbnormal ? `Lệch nhiệt độ: ${Number(payload.returnTemperature).toFixed(1)}°C` : null,
          recorded_at: payload.recordedAt,
          notes: 'Dữ liệu thời gian thực (SignalR)',
        };
        return [...prevHist, newRecord];
      });
    });

    // 3. Lắng nghe sự kiện phát sinh cảnh báo (ReeferAlertCreated)
    const unsubAlertCreated = reeferSignalRService.onAlertCreated((payload) => {
      // Âm thanh cảnh báo khẩn cấp bãi cảng (Web Audio API)
      try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(880, audioCtx.currentTime);
        osc.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.35);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.35);
      } catch {}

      setAlerts((prevAlerts) => [
        {
          id: payload.id,
          alert_code: payload.alertCode,
          session_id: payload.sessionId,
          plug_id: payload.plugId,
          plug_code: payload.plugCode,
          container_id: payload.containerId,
          container_no: payload.containerNo,
          alert_type: payload.alertType,
          severity: payload.severity,
          status: payload.status,
          message: payload.message,
          created_at: payload.createdAt,
        },
        ...prevAlerts,
      ]);

      setOverview((prev) => ({
        ...prev,
        active_alerts: (prev.active_alerts || 0) + 1,
      }));

      showToast(`🚨 CẢNH BÁO KHẨN CẤP: ${payload.message}`, 'error');
    });

    // 4. Lắng nghe cập nhật trạng thái cảnh báo (ReeferAlertUpdated)
    const unsubAlertUpdated = reeferSignalRService.onAlertUpdated((payload) => {
      setAlerts((prevAlerts) =>
        prevAlerts.map((a) => {
          if (a.id !== payload.id) return a;
          return {
            ...a,
            status: payload.status,
            resolved_at: payload.resolvedAt || a.resolved_at,
            acknowledged_at: payload.acknowledgedAt || a.acknowledged_at,
            resolution_notes: payload.resolutionNotes || a.resolution_notes,
          };
        })
      );

      if (payload.status === 'RESOLVED') {
        setOverview((prev) => ({
          ...prev,
          active_alerts: Math.max(0, (prev.active_alerts || 1) - 1),
        }));
      }
    });

    // Kết nối SignalR Hub kèm hàm tự động đồng bộ khi kết nối lại
    reeferSignalRService.start(() => loadData());

    // Chu kỳ đồng bộ sự cố và giám sát bãi lạnh thời gian thực (Real-time 3s)
    const timer = setInterval(async () => {
      try {
        const [alRes, ovRes] = await Promise.all([
          reeferService.getAlerts().catch(() => null),
          reeferService.getOverview().catch(() => null),
        ]);
        if (alRes) setAlerts(alRes);
        if (ovRes) {
          setOverview((prev) => ({
            ...prev,
            active_alerts: ovRes.active_alerts ?? prev.active_alerts,
          }));
        }
      } catch {}
    }, 3000);

    return () => {
      clearInterval(timer);
      unsubMonitoring();
      unsubAlertCreated();
      unsubAlertUpdated();
      reeferSignalRService.stop();
    };
  }, []);

  // Lọc ổ cắm theo điều kiện
  const filteredPlugs = useMemo(() => {
    return plugs.filter((p) => {
      const q = searchQuery.trim().toLowerCase();
      const matchSearch =
        !q ||
        p.plug_code?.toLowerCase().includes(q) ||
        p.slot_code?.toLowerCase().includes(q) ||
        p.active_session?.container_no?.toLowerCase().includes(q);
      if (!matchSearch) return false;
      if (filterStatus === 'AVAILABLE') return p.usage_status === 'AVAILABLE' && p.technical_status === 'HEALTHY';
      if (filterStatus === 'OCCUPIED') return p.usage_status === 'OCCUPIED';
      if (filterStatus === 'RESERVED') return p.usage_status === 'RESERVED';
      if (filterStatus === 'FAULTY') return p.technical_status !== 'HEALTHY';
      return true;
    });
  }, [plugs, searchQuery, filterStatus]);

  // Mở hộp thoại xử lý
  const openModal = async (type, item = null) => {
    setModalType(type);
    setSelectedItem(item);
    setModalForm({});

    if (type === 'ALLOCATE_POWER') {
      const defaultCont = item?.container_id
        ? eligibleContainers.find((c) => c.id === item.container_id)
        : eligibleContainers[0];

      const contId = item?.container_id || defaultCont?.id || '';
      const chosenCont = eligibleContainers.find((c) => c.id === contId);

      const targetTemp =
        item?.target_temperature != null
          ? Number(item.target_temperature)
          : (chosenCont?.target_temperature != null ? Number(chosenCont.target_temperature) : -18);

      const reqId = item?.request_id || item?.id || chosenCont?.pending_request_id || undefined;
      const availablePlugs = plugs.filter((p) => p.usage_status === 'AVAILABLE' && p.technical_status === 'HEALTHY');

      setModalForm({
        container_id: contId,
        container_no: item?.container_no || chosenCont?.container_no || '',
        request_id: reqId,
        plug_id: item?.plug_id || (availablePlugs[0]?.id || ''),
        fixed_plug: Boolean(item?.plug_id),
        plug_code: item?.plug_code || '',
        slot_code: item?.slot_code || '',
        target_temperature: targetTemp,
        temp_tolerance: item?.temp_tolerance != null ? Number(item.temp_tolerance) : (chosenCont?.temp_tolerance || 2.0),
        cargo_description: item?.cargo_description || (chosenCont?.cargo_type === 'perishable' ? 'Hàng đông lạnh cần bảo quản' : 'Hàng container bãi'),
        note: '',
      });
    } else if (type === 'CREATE_PLUG') {
      const nextNum = plugs.length + 1;
      setModalForm({
        plug_code: `PLUG-R02-${String(nextNum).padStart(2, '0')}`,
        voltage_type: '380V-3Ph-32A',
        max_power_kw: 15.0,
      });
    } else if (type === 'CONFIRM_POWER' && item) {
      setModalForm({
        initial_temperature: item.target_temperature != null ? Number(item.target_temperature) : '',
      });
    } else if (type === 'LOG_TEMP' && item) {
      setModalForm({
        return_temperature: item.last_temperature ?? (item.target_temperature != null ? Number(item.target_temperature) : 0),
        supply_temperature: '',
        ambient_temperature: 30,
        data_source: 'MANUAL_INSPECTION',
        notes: '',
      });
    } else if (type === 'CANCEL_RESERVATION' && item) {
      setModalForm({
        reason: 'Hủy gán ổ cắm theo yêu cầu điều độ',
      });
    } else if (type === 'TERMINATE' && item) {
      setModalForm({
        reason: 'Xuất bãi / Rút ruột / Hoàn tất cấp điện',
      });
    } else if (type === 'TRANSFER' && item) {
      setModalForm({
        new_plug_id: '',
        reason: 'Sự cố nguồn điện ổ cắm cũ',
      });
    } else if (type === 'RESOLVE_ALERT' && item) {
      setModalForm({
        notes: 'Đã kiểm tra kỹ thuật và điều chỉnh nhiệt độ về mức an toàn.',
      });
    } else if (type === 'TEMP_HISTORY' && item) {
      const targetSessionId = item.session_id || item.active_session?.id || item.id;
      const foundSession = sessions.find((s) => s.id === targetSessionId) || item.active_session || item;
      const foundPlug = plugs.find((p) => p.id === foundSession.plug_id || p.active_session?.id === targetSessionId);
      setSelectedItem({
        ...foundSession,
        session_id: targetSessionId,
        plug_code: foundSession.plug_code || foundPlug?.plug_code || item.plug_code || 'Ổ cắm bãi',
        container_no: foundSession.container_no || item.container_no || item.container_id,
        target_temperature: foundSession.target_temperature != null ? Number(foundSession.target_temperature) : -18,
        temp_tolerance: foundSession.temp_tolerance != null ? Number(foundSession.temp_tolerance) : 2,
        actual_power_status: foundSession.actual_power_status || item.actual_power_status || 'POWERED_ON',
      });
      setTempHistory([]);
      setHistoryFilter('ALL');
      setHistoryHover(null);
      setModalSubmitting(true);
      try {
        const hist = await reeferService.getSessionMonitoringHistory(targetSessionId);
        const normalized = (hist || []).map((h) => ({
          id: h.id,
          session_id: h.sessionId || h.session_id || targetSessionId,
          return_temperature: Number(h.returnTemperature ?? h.return_temperature ?? 0),
          supply_temperature: h.supplyTemperature != null ? Number(h.supplyTemperature) : (h.supply_temperature != null ? Number(h.supply_temperature) : null),
          ambient_temperature: h.ambientTemperature != null ? Number(h.ambientTemperature) : (h.ambient_temperature != null ? Number(h.ambient_temperature) : 32),
          is_abnormal: Boolean(h.isAbnormal ?? h.is_abnormal),
          power_status: h.powerStatus || h.power_status || (h.notes?.includes('POWER_LOSS') || h.notes?.includes('Mất điện') ? 'POWER_LOST' : 'POWERED_ON'),
          alert_message: h.alertMessage || h.alert_message || null,
          alert_type: h.alertType || h.alert_type || null,
          alert_severity: h.alertSeverity || h.alert_severity || null,
          data_source: h.dataSource || h.data_source || 'IOT_TELEMATICS',
          recorded_at: h.recordedAt || h.recorded_at,
          notes: h.notes || '',
        }));
        setTempHistory(normalized);
      } catch (err) {
        try {
          const hist2 = await reeferService.getTemperatureHistory(targetSessionId);
          const normalized = (hist2 || []).map((h) => ({
            id: h.id,
            session_id: h.session_id || targetSessionId,
            return_temperature: Number(h.return_temperature ?? 0),
            supply_temperature: h.supply_temperature != null ? Number(h.supply_temperature) : null,
            ambient_temperature: h.ambient_temperature != null ? Number(h.ambient_temperature) : 32,
            is_abnormal: Boolean(h.is_abnormal),
            power_status: h.notes?.includes('POWER_LOSS') || h.notes?.includes('Mất điện') ? 'POWER_LOST' : 'POWERED_ON',
            alert_message: null,
            data_source: h.data_source || 'IOT_TELEMATICS',
            recorded_at: h.recorded_at,
            notes: h.notes || '',
          }));
          setTempHistory(normalized);
        } catch {
          setTempHistory([]);
        }
      } finally {
        setModalSubmitting(false);
      }
    }
  };

  const handleSeedDemoSessions = async () => {
    setLoading(true);
    try {
      const availPlugs = plugs.filter((p) => p.usage_status === 'AVAILABLE' && p.technical_status === 'HEALTHY');
      const eligConts = eligibleContainers.filter((c) => !c.pending_request_id);

      if (availPlugs.length === 0) {
        showToast('Không có ổ cắm nào đang trống để tạo phiên mẫu.', 'error');
        return;
      }
      if (eligConts.length === 0) {
        showToast('Không có container lạnh nào trong bãi sẵn sàng.', 'error');
        return;
      }

      // Tạo phiên 1
      const p1 = availPlugs[0];
      const c1 = eligConts[0];
      const assign1 = await reeferService.assignPlug({
        container_id: c1.id,
        plug_id: p1.id,
        target_temperature: -18,
        temp_tolerance: 2,
      });

      const sId1 = assign1?.data?.id || assign1?.id;
      if (sId1) {
        await reeferService.confirmPower(sId1, -18.2);
      }

      // Tạo phiên 2 (nếu còn ổ cắm và container)
      if (availPlugs.length > 1 && eligConts.length > 1) {
        const p2 = availPlugs[1];
        const c2 = eligConts[1];
        const assign2 = await reeferService.assignPlug({
          container_id: c2.id,
          plug_id: p2.id,
          target_temperature: -20,
          temp_tolerance: 2,
        });

        const sId2 = assign2?.data?.id || assign2?.id;
        if (sId2) {
          await reeferService.confirmPower(sId2, -19.8);
        }
      }

      showToast('Đã khởi tạo thành công container cấp điện mẫu. Telemetry Realtime đang hoạt động!');
      await loadData();
      await reeferService.triggerSimulatorTick();
    } catch (err) {
      console.error(err);
      showToast(err.message || 'Lỗi khởi tạo phiên mẫu.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const closeModal = () => {
    setModalType(null);
    setSelectedItem(null);
    setModalForm({});
    setHistoryFilter('ALL');
    setHistoryHover(null);
  };

  const handleModalSubmit = async (e) => {
    e.preventDefault();
    setModalSubmitting(true);
    try {
      if (modalType === 'ALLOCATE_POWER') {
        if (!modalForm.container_id) {
          throw new Error('Vui lòng chọn Container cần cấp điện.');
        }
        if (!modalForm.plug_id) {
          throw new Error('Vui lòng chọn ổ cắm điện sẵn sàng.');
        }

        await reeferService.assignPlug({
          container_id: modalForm.container_id,
          plug_id: modalForm.plug_id,
          request_id: modalForm.request_id || undefined,
          target_temperature: modalForm.target_temperature !== '' ? Number(modalForm.target_temperature) : -18,
          temp_tolerance: modalForm.temp_tolerance !== '' ? Number(modalForm.temp_tolerance) : 2.0,
          cargo_description: modalForm.cargo_description,
          note: modalForm.note,
        });
        showToast('Đã gán ổ cắm thành công. Trạng thái ổ: Đã gán | Nguồn điện: Chờ xác nhận nguồn.');
      } else if (modalType === 'CONFIRM_POWER') {
        await reeferService.confirmPower(
          selectedItem.id,
          modalForm.initial_temperature !== '' ? Number(modalForm.initial_temperature) : undefined
        );
        showToast('Đã xác nhận bật điện. Trạng thái ổ: Đang sử dụng | Nguồn điện: Có điện (mô phỏng).');
      } else if (modalType === 'CANCEL_RESERVATION') {
        await reeferService.cancelReservation(selectedItem.id, modalForm.reason || 'Hủy gán theo yêu cầu điều độ');
        showToast('Đã hủy gán thành công. Ổ cắm đã trở về trạng thái Sẵn sàng.');
      } else if (modalType === 'LOG_TEMP') {
        await reeferService.recordTemperature(selectedItem.id, {
          return_temperature: Number(modalForm.return_temperature),
          supply_temperature: modalForm.supply_temperature ? Number(modalForm.supply_temperature) : undefined,
          ambient_temperature: modalForm.ambient_temperature ? Number(modalForm.ambient_temperature) : undefined,
          data_source: modalForm.data_source || 'MANUAL_INSPECTION',
          notes: modalForm.notes,
        });
        showToast('Đã lưu nhiệt độ đo được.');
      } else if (modalType === 'TERMINATE') {
        await reeferService.terminateSession(selectedItem.id, modalForm.reason);
        showToast('Đã ngắt điện và giải phóng ổ cắm. Ổ cắm đã trở về trạng thái Sẵn sàng.');
      } else if (modalType === 'TRANSFER') {
        await reeferService.transferPlug(selectedItem.id, modalForm.new_plug_id, modalForm.reason);
        showToast('Đã chuyển sang ổ cắm mới thành công.');
      } else if (modalType === 'CREATE_PLUG') {
        if (!modalForm.plug_code?.trim()) {
          showToast('Vui lòng nhập mã máy cấp điện.', 'error');
          return;
        }
        await reeferService.createPlug({
          plug_code: modalForm.plug_code.trim().toUpperCase(),
          voltage_type: modalForm.voltage_type || '380V-3Ph-32A',
          max_power_kw: Number(modalForm.max_power_kw || 15.0),
        });
        showToast(`Đã thêm mới máy cấp điện ${modalForm.plug_code.trim().toUpperCase()} thành công.`);
      } else if (modalType === 'RESOLVE_ALERT') {
        await reeferService.resolveAlert(selectedItem.id, modalForm.notes);
        showToast('Đã hoàn tất xử lý sự cố.');
      }

      closeModal();
      loadData();
    } catch (err) {
      showToast(err.message || 'Thao tác không thành công.', 'error');
    } finally {
      setModalSubmitting(false);
    }
  };

  const handleAcknowledgeAlert = async (alertId) => {
    // Cập nhật giao diện tức thì (Optimistic UI 0ms)
    setAlerts((prev) => prev.map((a) => (a.id === alertId ? { ...a, status: 'ACKNOWLEDGED' } : a)));
    try {
      await reeferService.acknowledgeAlert(alertId);
      showToast('Đã tiếp nhận xử lý cảnh báo.');
    } catch (err) {
      showToast(err.message || 'Lỗi tiếp nhận.', 'error');
      loadData();
    }
  };

  const handleQuickResolveAlert = async (alertId) => {
    // Cập nhật giao diện tức thì (Optimistic UI 0ms)
    setAlerts((prev) => prev.filter((a) => a.id !== alertId));
    setOverview((prev) => ({
      ...prev,
      active_alerts: Math.max(0, (prev.active_alerts || 1) - 1),
    }));
    try {
      await reeferService.resolveAlert(alertId, 'Đã kiểm tra an toàn và khôi phục nguồn điện tại bãi.');
      showToast('Đã đóng sự cố thành công.');
    } catch (err) {
      showToast(err.message || 'Lỗi xử lý sự cố.', 'error');
      loadData();
    }
  };

  const handleResolveAllAlerts = async () => {
    const activeAlerts = alerts.filter((a) => a.status === 'TRIGGERED' || a.status === 'ACKNOWLEDGED');
    if (activeAlerts.length === 0) return;
    // Cập nhật giao diện tức thì (Optimistic UI 0ms)
    setAlerts((prev) => prev.map((a) => ({ ...a, status: 'RESOLVED' })));
    setOverview((prev) => ({ ...prev, active_alerts: 0 }));
    showToast(`Đang khắc phục toàn bộ ${activeAlerts.length} sự cố an toàn...`);
    try {
      await Promise.all(
        activeAlerts.map((a) => reeferService.resolveAlert(a.id, 'Đã kiểm tra an toàn và xử lý đồng loạt.'))
      );
      showToast('Đã khắc phục toàn bộ sự cố bãi lạnh thành công.');
    } catch (err) {
      console.warn(err);
    } finally {
      loadData();
    }
  };

  const handleTogglePlugPower = async (plug) => {
    try {
      const nextPower = !plug.is_power_on;
      await reeferService.togglePlugPower(plug.id, nextPower);
      showToast(`Đã ${nextPower ? 'BẬT nguồn điện' : 'NGẮT nguồn điện'} máy ${plug.plug_code}.`);
      loadData();
    } catch (err) {
      showToast(err.message || 'Lỗi thao tác nguồn.', 'error');
    }
  };

  const handleTogglePlugMaintenance = async (plug) => {
    const nextStatus = plug.technical_status === 'HEALTHY' ? 'UNDER_MAINTENANCE' : 'HEALTHY';
    try {
      await reeferService.updatePlugStatus(plug.id, nextStatus);
      showToast(nextStatus === 'HEALTHY' ? 'Đã khôi phục ổ cắm hoạt động.' : 'Đã chuyển ổ cắm sang bảo trì.');
      loadData();
    } catch (err) {
      showToast(err.message || 'Lỗi cập nhật trạng thái.', 'error');
    }
  };

  // 1. Trạng thái phân bổ / sử dụng của ổ cắm (Socket Allocation / Usage Status)
  const renderPlugUsageStatus = (plug) => {
    if (plug.technical_status !== 'HEALTHY') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
          Đang bảo trì
        </span>
      );
    }
    if (plug.usage_status === 'OCCUPIED') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
          Đang sử dụng
        </span>
      );
    }
    if (plug.usage_status === 'RESERVED') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
          Đã gán
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
        Sẵn sàng
      </span>
    );
  };

  // 2. Trạng thái nguồn điện riêng biệt (Power Supply Status)
  const renderPowerSupplyStatus = (plug) => {
    if (plug.technical_status !== 'HEALTHY') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-500">
          Ngắt nguồn
        </span>
      );
    }
    if (plug.usage_status === 'AVAILABLE') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-500">
          Chưa kết nối
        </span>
      );
    }
    if (plug.usage_status === 'RESERVED') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-200">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
          Chờ xác nhận nguồn
        </span>
      );
    }
    // Khi OCCUPIED
    const powerStat = plug.active_session?.actual_power_status;
    if (powerStat === 'POWER_LOST') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-300 animate-pulse">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-600" />
          Mất điện (mô phỏng)
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        Có điện (mô phỏng)
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-4 md:p-6 space-y-6 font-sans">
      {/* Thông báo dạng Toast */}
      {notification && (
        <div
          className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-lg shadow-md border text-sm font-medium transition-all flex items-center gap-2 ${
            notification.type === 'error'
              ? 'bg-rose-50 text-rose-800 border-rose-200'
              : 'bg-emerald-50 text-emerald-800 border-emerald-200'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-current" />
          <span>{notification.message}</span>
        </div>
      )}

      {/* Thanh Tiêu Đề Doanh Nghiệp (Light Header) */}
      {/* Thanh Tiêu Đề Doanh Nghiệp (White & Orange Enterprise TOS Header) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-5 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-orange-700 bg-orange-50 px-2 py-0.5 rounded border border-orange-200">
              Khu Vực Bãi Lạnh (Reefer Yard Operations)
            </span>
            <span className="text-slate-400 text-xs">•</span>
            <span className="text-slate-500 text-xs font-medium">Cảng Quốc Tế NexusPort</span>
          </div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 mt-1.5">
            Quản Lý Cấp Điện Container Lạnh
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Theo dõi ổ cắm điện 3 pha (380V), nhiệt độ bảo quản IoT và kiểm soát thời gian cấp điện container tại bãi.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={loadData}
            disabled={loading}
            className="px-3.5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition-colors flex items-center gap-1.5"
          >
            <svg className={`w-3.5 h-3.5 text-slate-500 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>Làm mới</span>
          </button>
          <button
            onClick={() => openModal('ALLOCATE_POWER')}
            className="px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5 active:scale-98"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>Cấp điện Container</span>
          </button>
        </div>
      </div>

      {/* Thẻ Thống Kê Chỉ Số Vận Hành (White & Orange Enterprise KPI Cards) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
          <div className="text-xs font-medium text-slate-500">Tổng số ổ cắm</div>
          <div className="text-2xl font-bold text-slate-900 mt-1 font-mono">{overview.total_plugs}</div>
          <div className="text-xs text-slate-400 mt-0.5">Tiêu chuẩn 380V - 32A</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 border-l-4 border-l-orange-500 p-4 shadow-2xs">
          <div className="text-xs font-semibold text-orange-700">Đang cấp điện</div>
          <div className="text-2xl font-bold text-orange-600 mt-1 font-mono">{overview.active_sessions}</div>
          <div className="text-xs text-slate-500 mt-0.5">Container đang chạy máy</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 border-l-4 border-l-emerald-600 p-4 shadow-2xs">
          <div className="text-xs font-semibold text-emerald-700">Ổ sẵn sàng</div>
          <div className="text-2xl font-bold text-emerald-700 mt-1 font-mono">{overview.available_plugs}</div>
          <div className="text-xs text-slate-500 mt-0.5">Sẵn sàng tiếp nhận</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 border-l-4 border-l-amber-500 p-4 shadow-2xs">
          <div className="text-xs font-semibold text-amber-700">Chờ cắm dây</div>
          <div className="text-2xl font-bold text-amber-700 mt-1 font-mono">{overview.awaiting_power_sessions}</div>
          <div className="text-xs text-slate-500 mt-0.5">Đã gán ổ, chờ kỹ thuật</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 border-l-4 border-l-rose-500 p-4 shadow-2xs col-span-2 sm:col-span-1">
          <div className="text-xs font-semibold text-rose-700">Sự cố / Cảnh báo</div>
          <div className="text-2xl font-bold text-rose-700 mt-1 font-mono">{overview.active_alerts}</div>
          <div className="text-xs text-slate-500 mt-0.5">Lệch nhiệt / mất điện</div>
        </div>
      </div>

      {/* THANH CẢNH BÁO AN TOÀN VẬN HÀNH (Enterprise Safety Notification Bar) */}
      {alerts.filter((a) => a.status === 'TRIGGERED' || a.status === 'ACKNOWLEDGED').length > 0 ? (
        <div className="bg-white border border-orange-300 border-l-4 border-l-orange-500 rounded-xl p-4 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-700 flex items-center justify-center shrink-0 border border-orange-200">
              <svg className="w-5 h-5 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                  Thông báo an toàn vận hành bãi lạnh
                </span>
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-orange-100 text-orange-800 border border-orange-200">
                  {alerts.filter((a) => a.status === 'TRIGGERED' || a.status === 'ACKNOWLEDGED').length} sự cố cần xử lý
                </span>
              </div>
              <div className="text-xs text-slate-600 mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                {alerts
                  .filter((a) => a.status === 'TRIGGERED' || a.status === 'ACKNOWLEDGED')
                  .slice(0, 3)
                  .map((alert) => (
                    <span key={alert.id} className="inline-flex items-center gap-1.5 font-medium bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200 shadow-2xs">
                      <strong className="text-slate-900">{alert.container_no || alert.container_id || 'Container'}</strong>
                      <span className="text-slate-500">(Ổ: {alert.plug_code || 'Chưa rõ'}):</span>
                      <span className="text-rose-700 font-semibold">{alert.message}</span>
                      <button
                        type="button"
                        onClick={() => handleQuickResolveAlert(alert.id)}
                        className="ml-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors cursor-pointer shadow-2xs"
                        title="Khắc phục ngay sự cố này"
                      >
                        ✓ Khắc phục
                      </button>
                    </span>
                  ))}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end md:self-center flex-wrap">
            {alerts.find((a) => a.status === 'TRIGGERED' || a.status === 'ACKNOWLEDGED') && (
              <>
                <button
                  type="button"
                  onClick={handleResolveAllAlerts}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                  title="Khắc phục toàn bộ các sự cố an toàn đang phát sinh"
                >
                  <span className="material-symbols-outlined text-sm">verified</span>
                  <span>Khắc phục tất cả</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const firstAlert = alerts.find((a) => a.status === 'TRIGGERED' || a.status === 'ACKNOWLEDGED');
                    const relatedSession = sessions.find((s) => s.id === firstAlert?.session_id) || {
                      id: firstAlert?.session_id,
                      container_no: firstAlert?.container_no,
                      plug_code: firstAlert?.plug_code,
                      target_temperature: -18,
                      temp_tolerance: 2,
                    };
                    openModal('TEMP_HISTORY', relatedSession);
                  }}
                  className="px-3.5 py-2 bg-white hover:bg-orange-50 text-orange-800 border border-orange-300 text-xs font-semibold rounded-lg shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer"
                  title="Mở biểu đồ đối chiếu biến thiên nhiệt độ và mốc phát sinh sự cố"
                >
                  <span>Biểu đồ đối chiếu</span>
                </button>
              </>
            )}
            <button
              onClick={() => setActiveTab('alerts')}
              className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <span>Xem chi tiết sự cố</span>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-700 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
            <span className="font-semibold text-slate-900">
              Giám sát trực tuyến (IoT Telematics):
            </span>
            <span className="text-slate-600">
              Toàn bộ {sessions.filter((s) => s.session_status === 'ACTIVE').length} container lạnh đang duy trì nhiệt độ an toàn và cấp điện liên tục.
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] font-mono text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200">
            <span>Kênh truyền SignalR: Ổn định</span>
          </div>
        </div>
      )}

      {/* Thanh Tab Chuyển Đổi Danh Mục (Enterprise White & Orange Tabs) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-1.5 flex gap-1.5 overflow-x-auto">
        <button
          onClick={() => setActiveTab('plugs')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'plugs'
              ? 'bg-orange-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-orange-700 hover:bg-orange-50/50'
          }`}
        >
          <span>Sơ đồ ổ cắm</span>
          <span className={`px-2 py-0.5 text-xs rounded-full ${activeTab === 'plugs' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}`}>
            {plugs.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('sessions')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'sessions'
              ? 'bg-orange-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-orange-700 hover:bg-orange-50/50'
          }`}
        >
          <span>Container đang cắm điện</span>
          <span className={`px-2 py-0.5 text-xs rounded-full ${activeTab === 'sessions' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}`}>
            {sessions.filter((s) => ['AWAITING_POWER', 'ACTIVE'].includes(s.session_status)).length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('requests')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'requests'
              ? 'bg-orange-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-orange-700 hover:bg-orange-50/50'
          }`}
        >
          <span>Yêu cầu chờ xử lý</span>
          <span className={`px-2 py-0.5 text-xs rounded-full ${activeTab === 'requests' ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-800'}`}>
            {requests.filter((r) => r.status === 'PENDING_ASSIGNMENT').length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('alerts')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'alerts'
              ? 'bg-rose-600 text-white shadow-xs'
              : alerts.filter((a) => a.status === 'TRIGGERED' || a.status === 'ACKNOWLEDGED').length > 0
              ? 'bg-rose-50 text-rose-800 border border-rose-300 font-bold'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <span className="flex items-center gap-1.5">
            {alerts.filter((a) => a.status === 'TRIGGERED' || a.status === 'ACKNOWLEDGED').length > 0 && (
              <span className="w-2 h-2 rounded-full bg-rose-500" />
            )}
            <span>Cảnh báo & Sự cố</span>
          </span>
          {alerts.filter((a) => a.status === 'TRIGGERED' || a.status === 'ACKNOWLEDGED').length > 0 ? (
            <span className="px-2 py-0.5 text-xs rounded-full bg-rose-600 text-white font-black shadow-xs">
              {alerts.filter((a) => a.status === 'TRIGGERED' || a.status === 'ACKNOWLEDGED').length}
            </span>
          ) : alerts.length > 0 ? (
            <span className="px-2 py-0.5 text-xs rounded-full bg-slate-100 text-slate-600">
              {alerts.length}
            </span>
          ) : null}
        </button>
      </div>

      {/* TAB 1: SƠ ĐỒ Ổ CẮM BÃI */}
      {activeTab === 'plugs' && (
        <div className="space-y-4">
          {/* Bộ Lọc Tìm Kiếm */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <input
                type="text"
                placeholder="Tìm mã ổ cắm, container..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-3 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
              />
            </div>

            <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto">
              {[
                { key: 'ALL', label: 'Tất cả' },
                { key: 'AVAILABLE', label: 'Đang trống' },
                { key: 'OCCUPIED', label: 'Đang cấp điện' },
                { key: 'RESERVED', label: 'Đã giữ chỗ' },
                { key: 'FAULTY', label: 'Bảo trì' },
              ].map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFilterStatus(f.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                    filterStatus === f.key
                      ? 'bg-orange-600 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => openModal('CREATE_PLUG')}
              className="px-3.5 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer shrink-0"
            >
              <span className="material-symbols-outlined text-sm">add_circle</span>
              <span>Thêm Máy Cấp Điện</span>
            </button>
          </div>

          {/* Lưới Thẻ Ổ Cắm Doanh Nghiệp */}
          {filteredPlugs.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400 text-sm">
              Không tìm thấy ổ cắm nào phù hợp với bộ lọc.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
              {filteredPlugs.map((plug) => {
                const isRecentlyUpdated = lastUpdatedSessionId && plug.active_session?.id === lastUpdatedSessionId;
                const isAbnormal = plug.active_session?.is_abnormal || (
                  plug.active_session?.last_temperature != null &&
                  plug.active_session?.target_temperature != null &&
                  Math.abs(Number(plug.active_session.last_temperature) - Number(plug.active_session.target_temperature)) > Number(plug.active_session.temp_tolerance || 2)
                );

                const isPowerLost = plug.active_session?.actual_power_status === 'POWER_LOST';
                const tempDiff = plug.active_session?.last_temperature != null && plug.active_session?.target_temperature != null
                  ? Number(plug.active_session.last_temperature) - Number(plug.active_session.target_temperature)
                  : null;

                return (
                  <div
                    key={plug.id}
                    className={`bg-white rounded-xl border p-4 shadow-xs flex flex-col justify-between transition-all duration-200 h-full ${
                      isAbnormal
                        ? 'border-l-4 border-l-rose-500 border-slate-200'
                        : isPowerLost
                        ? 'border-l-4 border-l-amber-500 border-slate-200'
                        : isRecentlyUpdated
                        ? 'border-l-4 border-l-orange-500 border-slate-300 ring-1 ring-orange-200/60'
                        : plug.usage_status === 'OCCUPIED'
                        ? 'border-l-4 border-l-emerald-500 border-slate-200'
                        : plug.usage_status === 'RESERVED'
                        ? 'border-l-4 border-l-amber-500 border-slate-200'
                        : plug.technical_status !== 'HEALTHY'
                        ? 'border-l-4 border-l-slate-400 border-slate-200 bg-slate-50/50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div>
                      {/* 1. TIÊU ĐỀ Ổ CẮM (LUÔN Ở ĐẦU THẺ - ĐỒNG ĐỀU TRÊN CÙNG 1 ĐƯỜNG THẲNG) */}
                      <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-base text-slate-900">
                            {plug.plug_code}
                          </span>
                          {isRecentlyUpdated && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-orange-100 text-orange-800 border border-orange-200">
                              ĐỒNG BỘ
                            </span>
                          )}
                        </div>
                        {renderPlugUsageStatus(plug)}
                      </div>

                      {/* 2. THÔNG SỐ VỊ TRÍ, ĐIỆN ÁP & NGUỒN CẤP */}
                      <div className="mt-2.5 space-y-1.5 text-xs text-slate-600">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Vị trí bãi:</span>
                          <span className="font-medium text-slate-800">
                            {plug.slot_code || 'Khu R - Bãi Lạnh'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Điện áp & Công suất:</span>
                          <span className="font-mono text-slate-800 font-semibold">
                            {plug.voltage_type || '380V-3Ph-32A'} · {plug.max_power_kw ? `${Number(plug.max_power_kw).toFixed(0)} kW` : '15 kW'}
                          </span>
                        </div>
                        <div className="flex justify-between items-center pt-1 border-t border-slate-100/60">
                          <span className="text-slate-400">Nguồn điện:</span>
                          <div className="flex items-center gap-2">
                            {renderPowerSupplyStatus(plug)}
                          </div>
                        </div>
                      </div>

                      {/* 3. KHỐI CONTAINER & TELEMETRY (ĐỒNG ĐỀU KÍCH THƯỚC) */}
                      {plug.active_session ? (
                        <div className="mt-3 p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-2">
                          
                          {/* Thanh Trạng Thái / Cảnh Báo An Toàn Đồng Nhất (Tự Động Realtime 100%) */}
                          {isAbnormal || isPowerLost ? (
                            <div className={`px-2.5 py-1.5 rounded-md border text-[11px] font-semibold flex items-center justify-between gap-1.5 ${
                              isPowerLost
                                ? 'bg-amber-50/90 border-amber-300 text-amber-950'
                                : 'bg-orange-50 border-orange-200 text-orange-950'
                            }`}>
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className={`w-2 h-2 rounded-full shrink-0 animate-pulse ${isPowerLost ? 'bg-amber-500' : 'bg-orange-600'}`} />
                                <span className="truncate font-medium">
                                  {isAbnormal && isPowerLost
                                    ? 'Cảnh báo: Lệch nhiệt & Mất điện'
                                    : isAbnormal
                                    ? `Cảnh báo: Lệch nhiệt (${tempDiff != null ? (tempDiff > 0 ? `+${tempDiff.toFixed(1)}` : tempDiff.toFixed(1)) : ''}°C)`
                                    : 'Cảnh báo: Mất điện nguồn'}
                                </span>
                              </div>
                              <span className={`font-mono text-[10px] font-bold px-1.5 py-0.2 rounded border shrink-0 ${
                                isPowerLost
                                  ? 'bg-amber-100 text-amber-800 border-amber-300'
                                  : 'bg-white text-orange-700 border-orange-200'
                              }`}>
                                {isPowerLost ? 'MẤT ĐIỆN' : 'CẢNH BÁO'}
                              </span>
                            </div>
                          ) : (
                            <div className="px-2.5 py-1.5 rounded-md bg-emerald-50/70 border border-emerald-200 text-emerald-800 text-[11px] font-medium flex items-center justify-between">
                              <span className="flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                <span>Vận hành ổn định</span>
                              </span>
                              <span className="font-mono text-[10px] font-semibold text-emerald-700 bg-white px-1.5 py-0.2 rounded border border-emerald-200">
                                AN TOÀN
                              </span>
                            </div>
                          )}

                          {/* Số hiệu Container */}
                          <div className="flex justify-between items-center pt-0.5">
                            <span className="text-slate-500 font-medium">Container lạnh:</span>
                            <span className="font-mono font-bold text-orange-700 bg-orange-50 px-1.5 py-0.5 rounded border border-orange-200">
                              {plug.active_session.container_no || plug.active_session.container_id}
                            </span>
                          </div>

                          {/* Thông tin Booking liên kết & Nguồn cấp theo Booking */}
                          {plug.active_session.booking_code && (
                            <div className="space-y-1 pt-0.5">
                              <div className="flex justify-between items-center text-[11px]">
                                <span className="text-slate-500 font-medium">Lịch hẹn Booking:</span>
                                <span className="font-mono font-bold text-sky-800 bg-sky-50 px-1.5 py-0.2 rounded border border-sky-200">
                                  ❄️ {plug.active_session.booking_code}
                                </span>
                              </div>
                              <div className="flex justify-between items-center text-[11px]">
                                <span className="text-slate-500 font-medium">Cấp điện theo Booking:</span>
                                <span className="font-mono font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                                  ⚡ 380V · {plug.active_session.required_power_kw || plug.max_power_kw || 15} kW (3 Pha)
                                </span>
                              </div>
                            </div>
                          )}

                          {/* Khối Nhiệt Độ Đo Đạc Thời Gian Thực (Live Telemetry - Tone Trắng Cam) */}
                          <div
                            className={`p-2.5 rounded-lg border flex items-center justify-between transition-colors ${
                              isAbnormal
                                ? 'bg-orange-50/50 border-orange-200'
                                : isPowerLost
                                ? 'bg-amber-50/60 border-amber-200'
                                : 'bg-white border-slate-200 shadow-2xs'
                            }`}
                          >
                            <div>
                              <div className="text-[10px] uppercase font-bold tracking-wider text-slate-500 flex items-center gap-1.5">
                                <span
                                  className={`w-1.5 h-1.5 rounded-full ${
                                    isAbnormal
                                      ? 'bg-orange-600'
                                      : 'bg-emerald-500'
                                  }`}
                                />
                                <span>Gió hồi (Telemetry):</span>
                              </div>
                              <div
                                className={`text-base font-bold font-mono mt-0.5 ${
                                  isAbnormal
                                    ? 'text-orange-700'
                                    : 'text-slate-900'
                                }`}
                              >
                                {plug.active_session.last_temperature != null
                                  ? `${Number(plug.active_session.last_temperature).toFixed(1)}°C`
                                  : 'Đang kết nối...'}
                              </div>
                              {plug.active_session.supply_temperature != null && (
                                <div className="text-[10px] text-slate-500 font-mono">
                                  Gió cấp: {Number(plug.active_session.supply_temperature).toFixed(1)}°C
                                </div>
                              )}
                            </div>

                            <div className="text-right text-[11px] space-y-0.5">
                              <div className="text-slate-500">
                                Cài đặt: <span className="font-bold text-slate-800">{plug.active_session.target_temperature}°C</span>
                              </div>
                              <div className="text-[10px] text-slate-400">
                                Ngưỡng an toàn:
                              </div>
                              <div className="text-[10px] font-mono font-semibold text-slate-700 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200">
                                {(Number(plug.active_session.target_temperature) - Number(plug.active_session.temp_tolerance || 2)).toFixed(1)}° → {(Number(plug.active_session.target_temperature) + Number(plug.active_session.temp_tolerance || 2)).toFixed(1)}°C
                              </div>
                            </div>
                          </div>

                          {plug.active_session.last_checked_at && (
                            <div className="flex justify-between items-center text-[10px] text-slate-400 pt-0.5">
                              <span>Cập nhật qua IoT Telematics:</span>
                              <span className="font-mono font-medium text-slate-600">
                                {new Date(plug.active_session.last_checked_at).toLocaleTimeString('vi-VN')}
                              </span>
                            </div>
                          )}

                          <button
                            type="button"
                            onClick={() => openModal('TEMP_HISTORY', plug.active_session)}
                            className="w-full mt-2 py-1.5 px-2.5 rounded-lg bg-orange-50 hover:bg-orange-100 text-orange-700 hover:text-orange-800 border border-orange-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-2xs"
                            title="Xem đường cong biến thiên nhiệt độ và đối chiếu cảnh báo"
                          >
                            <span>📈 Biến thiên & Đối chiếu cảnh báo</span>
                          </button>
                        </div>
                      ) : (
                        <div className="mt-3 p-5 rounded-lg bg-slate-50/70 border border-dashed border-slate-200 text-center flex flex-col items-center justify-center min-h-[160px]">
                          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-1.5">
                            ⚡
                          </div>
                          <div className="text-xs font-semibold text-slate-600">Ổ cắm sẵn sàng</div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            {plug.technical_status === 'HEALTHY' ? 'Sẵn sàng cấp điện' : 'Đang tạm dừng / bảo trì'}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 4. NÚT THAO TÁC NHANH (LUÔN CĂN ĐỀU 1 HÀNG KHÔNG BỊ TRÀN) */}
                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-1.5">
                      <button
                        onClick={() => handleTogglePlugMaintenance(plug)}
                        className="text-xs text-slate-400 hover:text-slate-700 font-medium"
                      >
                        {plug.technical_status === 'HEALTHY' ? 'Bảo trì' : 'Khôi phục'}
                      </button>

                      <div className="flex items-center gap-1.5">
                        {plug.usage_status === 'AVAILABLE' && plug.technical_status === 'HEALTHY' && (
                          <button
                            onClick={() => openModal('ALLOCATE_POWER', { plug_id: plug.id, plug_code: plug.plug_code, slot_code: plug.slot_code })}
                            className="px-2.5 py-1 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold transition-colors shadow-2xs"
                          >
                            Gán ổ cắm
                          </button>
                        )}

                        {plug.usage_status === 'RESERVED' && plug.active_session && (
                          <>
                            <button
                              onClick={() => openModal('CANCEL_RESERVATION', plug.active_session)}
                              className="px-2 py-1 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 text-xs font-medium transition-colors"
                            >
                              Hủy gán
                            </button>
                            <button
                              onClick={() => openModal('CONFIRM_POWER', plug.active_session)}
                              className="px-2.5 py-1 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold shadow-2xs transition-colors"
                            >
                              Bật điện
                            </button>
                          </>
                        )}

                        {plug.usage_status === 'OCCUPIED' && plug.active_session && (
                          <>
                            <button
                              onClick={() => openModal('LOG_TEMP', plug.active_session)}
                              className="px-2.5 py-1 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-medium transition-colors"
                            >
                              Đo nhiệt
                            </button>
                            <button
                              onClick={() => openModal('TERMINATE', plug.active_session)}
                              className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-medium transition-colors"
                            >
                              Ngắt điện
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: CONTAINER ĐANG CẤP ĐIỆN */}
      {activeTab === 'sessions' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase">
                <tr>
                  <th className="py-3 px-4">Số hiệu Container</th>
                  <th className="py-3 px-4">Ổ cắm & Vị trí</th>
                  <th className="py-3 px-4">Trạng thái</th>
                  <th className="py-3 px-4">Nhiệt độ cài / Đo được</th>
                  <th className="py-3 px-4">Thời gian bắt đầu</th>
                  <th className="py-3 px-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sessions.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="py-10 text-center text-slate-400 text-sm">
                      Chưa có container nào đang cấp điện.
                    </td>
                  </tr>
                ) : (
                  sessions.map((ses) => (
                    <tr key={ses.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">
                        {ses.container_no || ses.container_id}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-semibold text-slate-900">{ses.plug_code}</span>
                        <div className="text-xs text-slate-400">
                          {ses.slot_code || 'Bãi Lạnh Block R'}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="space-y-1">
                          <div>
                            {ses.session_status === 'ACTIVE' ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-orange-50 text-orange-700 border border-orange-200">
                                Đang sử dụng
                              </span>
                            ) : ses.session_status === 'AWAITING_POWER' ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                                Đã gán ổ
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600">
                                {ses.session_status === 'COMPLETED' ? 'Đã kết thúc' : ses.session_status}
                              </span>
                            )}
                          </div>
                          <div>
                            {ses.session_status === 'AWAITING_POWER' ? (
                              <span className="inline-flex items-center gap-1 text-[11px] text-amber-700 font-medium">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                Chờ xác nhận nguồn
                              </span>
                            ) : ses.actual_power_status === 'POWER_LOST' ? (
                              <span className="inline-flex items-center gap-1 text-[11px] text-rose-700 font-bold">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-600" />
                                Mất điện (mô phỏng)
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-medium">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                Có điện (mô phỏng)
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-xs text-slate-600">
                          Cài đặt: <span className="font-semibold text-slate-900">{ses.target_temperature != null ? `${ses.target_temperature}°C` : '-'}</span>
                          {ses.temp_tolerance != null && (
                            <span className="text-slate-400"> (±{ses.temp_tolerance}°C)</span>
                          )}
                        </div>
                        {ses.target_temperature != null && (
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            Vùng an toàn: [{(Number(ses.target_temperature) - Number(ses.temp_tolerance || 2)).toFixed(1)}°C đến {(Number(ses.target_temperature) + Number(ses.temp_tolerance || 2)).toFixed(1)}°C]
                          </div>
                        )}
                        <div className="text-xs mt-1">
                          Đo gần nhất:{' '}
                          <span
                            className={`font-bold ${
                              ses.last_temperature != null &&
                              ses.target_temperature != null &&
                              Math.abs(Number(ses.last_temperature) - Number(ses.target_temperature)) > Number(ses.temp_tolerance || 2)
                                ? 'text-rose-600'
                                : 'text-slate-900'
                            }`}
                          >
                            {ses.last_temperature != null ? `${ses.last_temperature}°C` : 'Chưa đo'}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-500">
                        {ses.started_at ? new Date(ses.started_at).toLocaleString('vi-VN') : 'Chờ bật điện'}
                        {ses.billable_hours ? (
                          <div className="text-slate-700 font-medium mt-0.5">
                            {ses.billable_hours} giờ tính phí
                          </div>
                        ) : null}
                      </td>
                      <td className="py-3 px-4 text-right space-x-1.5">
                        {ses.session_status === 'AWAITING_POWER' && (
                          <>
                            <button
                              onClick={() => openModal('CANCEL_RESERVATION', ses)}
                              className="px-2.5 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-600 text-xs font-medium transition-colors"
                            >
                              Hủy gán
                            </button>
                            <button
                              onClick={() => openModal('CONFIRM_POWER', ses)}
                              className="px-2.5 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold shadow-2xs transition-colors"
                            >
                              Xác nhận bật điện
                            </button>
                          </>
                        )}

                        {ses.session_status === 'ACTIVE' && (
                          <>
                            <button
                              onClick={() => openModal('LOG_TEMP', ses)}
                              className="px-2.5 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-medium transition-colors"
                            >
                              Ghi nhiệt độ
                            </button>
                            <button
                              onClick={() => openModal('TRANSFER', ses)}
                              className="px-2.5 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-medium transition-colors"
                            >
                              Đổi ổ
                            </button>
                            <button
                              onClick={() => openModal('TERMINATE', ses)}
                              className="px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-medium transition-colors"
                            >
                              Ngắt điện
                            </button>
                          </>
                        )}

                        <button
                          onClick={() => openModal('TEMP_HISTORY', ses)}
                          className="px-2.5 py-1.5 rounded-lg bg-orange-50 hover:bg-orange-100 border border-orange-200 text-orange-700 hover:text-orange-800 text-xs font-semibold inline-flex items-center gap-1 transition-colors shadow-2xs"
                          title="Xem biểu đồ biến thiên nhiệt độ và đối chiếu cảnh báo"
                        >
                          <span>📈 Biến thiên & Cảnh báo</span>
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

      {/* TAB 3: YÊU CẦU CẤP ĐIỆN CHỜ XỬ LÝ */}
      {activeTab === 'requests' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase">
                <tr>
                  <th className="py-3 px-4">Mã yêu cầu</th>
                  <th className="py-3 px-4">Container</th>
                  <th className="py-3 px-4">Nhiệt độ yêu cầu</th>
                  <th className="py-3 px-4">Hàng hóa</th>
                  <th className="py-3 px-4">Trạng thái</th>
                  <th className="py-3 px-4">Thời gian tạo</th>
                  <th className="py-3 px-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {requests.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="py-10 text-center text-slate-400 text-sm">
                      Hiện tại không có yêu cầu cấp điện nào.
                    </td>
                  </tr>
                ) : (
                  requests.map((req) => (
                    <tr key={req.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4 font-mono font-medium text-slate-900">
                        {req.request_no}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">
                        {req.container_no || req.container_id}
                      </td>
                      <td className="py-3 px-4 text-slate-800 font-medium">
                        {req.target_temperature}°C (±{req.temp_tolerance}°C)
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-500">
                        {req.cargo_description || 'Hàng đông lạnh'}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                            req.status === 'PENDING_ASSIGNMENT'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : req.status === 'IN_PROGRESS'
                              ? 'bg-orange-50 text-orange-700 border border-orange-200'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {req.status === 'PENDING_ASSIGNMENT'
                            ? 'Chờ gán ổ'
                            : req.status === 'ASSIGNED'
                            ? 'Đã gán ổ'
                            : req.status === 'IN_PROGRESS'
                            ? 'Đang cấp điện'
                            : 'Đã hoàn tất'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-400">
                        {new Date(req.created_at).toLocaleString('vi-VN')}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {req.status === 'PENDING_ASSIGNMENT' && (
                          <button
                            onClick={() => openModal('ALLOCATE_POWER', req)}
                            className="px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold shadow-2xs transition-colors"
                          >
                            Gán ổ cắm
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

      {/* TAB 4: CẢNH BÁO & SỰ CỐ */}
      {activeTab === 'alerts' && (
        <div className="space-y-3">
          {alerts.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400 text-sm">
              Không có sự cố nào. Tất cả container lạnh đang duy trì nhiệt độ an toàn.
            </div>
          ) : (
            alerts.map((al) => (
              <div
                key={al.id}
                className={`bg-white rounded-xl border p-4 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-all ${
                  al.severity === 'CRITICAL' ? 'border-l-4 border-l-rose-500' : 'border-l-4 border-l-amber-500'
                }`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-slate-900 text-sm">{al.alert_code}</span>
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-semibold ${
                        al.severity === 'CRITICAL'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {al.severity === 'CRITICAL' ? 'Nghiêm trọng' : 'Cảnh báo'}
                    </span>
                    <span className="text-xs text-slate-400">
                      Trạng thái: {al.status === 'TRIGGERED' ? 'Mới phát sinh' : 'Đang xử lý'}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-slate-800 mt-1">{al.message}</p>
                  <div className="text-xs text-slate-400 mt-1 flex gap-4">
                    <span>Container: {al.container_no || al.container_id}</span>
                    <span>Ổ cắm: {al.plug_code || 'Chưa xác định'}</span>
                    <span>Thời gian: {new Date(al.created_at).toLocaleString('vi-VN')}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const relatedSession = sessions.find((s) => s.id === al.session_id) || {
                        id: al.session_id,
                        container_no: al.container_no,
                        plug_code: al.plug_code,
                        target_temperature: -18,
                        temp_tolerance: 2,
                      };
                      openModal('TEMP_HISTORY', relatedSession);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 text-xs font-semibold flex items-center gap-1 transition-colors shadow-2xs"
                    title="Đối chiếu thời điểm phát sinh sự cố này trên biểu đồ biến thiên nhiệt độ"
                  >
                    <span>📈 Đối chiếu biểu đồ</span>
                  </button>
                  {al.status === 'TRIGGERED' && (
                    <button
                      onClick={() => handleAcknowledgeAlert(al.id)}
                      className="px-3 py-1.5 rounded border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-medium shadow-sm transition-colors"
                    >
                      Tiếp nhận
                    </button>
                  )}
                  {['TRIGGERED', 'ACKNOWLEDGED', 'IN_PROGRESS'].includes(al.status) && (
                    <button
                      onClick={() => openModal('RESOLVE_ALERT', al)}
                      className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition-colors"
                    >
                      Đóng sự cố
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ======================= HỘP THOẠI THÊM MÁY CẤP ĐIỆN KHO LẠNH ======================= */}
      {modalType === 'CREATE_PLUG' && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-xl">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Thêm Máy Cấp Điện Kho Đông Lạnh</h3>
                <p className="text-slate-500 text-xs mt-0.5">
                  Đăng ký máy/trụ cấp điện 3 pha mới tại Bãi Kho Lạnh Block R
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="text-slate-400 hover:text-slate-600 text-xl font-semibold leading-none p-1 cursor-pointer"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleModalSubmit} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Mã Máy Cấp Điện (Plug Code) <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={modalForm.plug_code || ''}
                  onChange={(e) => setModalForm({ ...modalForm, plug_code: e.target.value.toUpperCase() })}
                  placeholder="VD: PLUG-R02-07"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 font-mono font-bold focus:outline-none focus:bg-white focus:border-orange-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Chuẩn Điện Áp
                  </label>
                  <select
                    value={modalForm.voltage_type || '380V-3Ph-32A'}
                    onChange={(e) => setModalForm({ ...modalForm, voltage_type: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono text-slate-900 focus:outline-none focus:bg-white focus:border-orange-500"
                  >
                    <option value="380V-3Ph-32A">380V - 3 Pha - 32A</option>
                    <option value="440V-3Ph-32A">440V - 3 Pha - 32A</option>
                    <option value="220V-1Ph-16A">220V - 1 Pha - 16A</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Công Suất Tối Đa (kW)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={modalForm.max_power_kw || 15}
                    onChange={(e) => setModalForm({ ...modalForm, max_power_kw: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono text-slate-900 focus:outline-none focus:bg-white focus:border-orange-500"
                  />
                </div>
              </div>

              <div className="p-3 rounded-lg bg-sky-50 border border-sky-200 text-xs text-sky-900 space-y-1">
                <div className="font-semibold flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm text-sky-600">info</span>
                  <span>Vị trí đặt máy:</span>
                </div>
                <p className="text-[11px] text-sky-800">
                  Máy sẽ tự động được gán vào khu vực Kho Đông Lạnh Block R, trang bị rơ-le ngắt quá tải và IoT Telematics đo nhiệt độ liên tục.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={modalSubmitting}
                  className="px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors cursor-pointer"
                >
                  {modalSubmitting ? 'Đang tạo...' : 'Tạo Máy Cấp Điện'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================= HỘP THOẠI GÁN Ổ CẮM (BƯỚC 1 CỦA ĐIỀU ĐỘ) ======================= */}
      {modalType === 'ALLOCATE_POWER' && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-lg w-full p-6 shadow-xl">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Gán Ổ Cắm Cho Container Lạnh</h3>
                <p className="text-slate-500 text-xs mt-0.5">
                  Bước 1: Điều độ phân bổ ổ cắm. Trạng thái ổ cắm chuyển sang <strong>Đã gán</strong>, nguồn điện ở trạng thái <strong>Chờ xác nhận nguồn điện</strong>.
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="text-slate-400 hover:text-slate-600 text-xl font-semibold leading-none p-1"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleModalSubmit} className="space-y-4 mt-4">
              {/* 1. CONTAINER */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Container cần cấp điện <span className="text-rose-600">*</span>
                </label>
                {modalForm.container_no && modalForm.request_id ? (
                  <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg flex items-center justify-between">
                    <div>
                      <div className="font-mono font-bold text-base text-orange-950">
                        {modalForm.container_no}
                      </div>
                      <div className="text-xs text-orange-800 mt-0.5">
                        Yêu cầu chờ cấp điện • Nhiệt độ yêu cầu: {modalForm.target_temperature}°C
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-orange-100 text-orange-800 border border-orange-200 text-xs font-semibold">
                      Chờ gán ổ
                    </span>
                  </div>
                ) : (
                  <select
                    required
                    value={modalForm.container_id || ''}
                    onChange={(e) => {
                      const selected = eligibleContainers.find((c) => c.id === e.target.value);
                      setModalForm({
                        ...modalForm,
                        container_id: e.target.value,
                        container_no: selected?.container_no || '',
                        request_id: selected?.pending_request_id || undefined,
                        target_temperature: selected?.target_temperature != null ? Number(selected.target_temperature) : -18,
                        temp_tolerance: selected?.temp_tolerance != null ? Number(selected.temp_tolerance) : 2.0,
                        cargo_description: selected?.cargo_type === 'perishable' ? 'Hàng đông lạnh cần bảo quản' : (modalForm.cargo_description || 'Hàng container bãi'),
                      });
                    }}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:bg-white focus:border-orange-500 focus:ring-1 focus:ring-orange-500 font-mono font-medium"
                  >
                    <option value="">-- Chọn container lạnh tại bãi ({eligibleContainers.length} container khả dụng) --</option>
                    {eligibleContainers.map((cont) => (
                      <option key={cont.id} value={cont.id}>
                        {cont.pending_request_id ? '[Chờ cấp điện] ' : ''}
                        {cont.container_no} • {cont.container_type_code || 'Reefer'} ({cont.cargo_type === 'perishable' ? 'Hàng đông lạnh' : 'Hàng lạnh'})
                        {cont.target_temperature != null ? ` • Cần: ${cont.target_temperature}°C` : ''}
                      </option>
                    ))}
                  </select>
                )}
                {eligibleContainers.length === 0 && !modalForm.container_no ? (
                  <p className="text-[11px] text-amber-600 mt-1">
                    Hiện không có container lạnh nào tại bãi chưa được cấp điện.
                  </p>
                ) : (
                  <p className="text-[11px] text-slate-400 mt-1">
                    Hệ thống chỉ lọc và cho phép cấp điện đối với các container lạnh (Reefer) đã nhập cảng.
                  </p>
                )}
              </div>

              {/* 2. Ổ CẮM ĐIỆN 3 PHA */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Ổ cắm điện 3 pha (380V) <span className="text-rose-600">*</span>
                </label>
                {modalForm.fixed_plug ? (
                  <div className="p-3 bg-slate-100 border border-slate-200 rounded-lg flex items-center justify-between">
                    <div>
                      <div className="font-mono font-bold text-base text-slate-900">
                        {modalForm.plug_code}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {modalForm.slot_code || 'Khu R - Bãi Lạnh'} • Điện áp 380V - 3 Pha
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-orange-100 text-orange-800 border border-orange-200 text-xs font-semibold">
                      Sẵn sàng
                    </span>
                  </div>
                ) : (
                  <select
                    required
                    value={modalForm.plug_id || ''}
                    onChange={(e) => setModalForm({ ...modalForm, plug_id: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:bg-white focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                  >
                    <option value="">
                      -- Chọn ổ cắm đang trống ({plugs.filter((p) => p.usage_status === 'AVAILABLE' && p.technical_status === 'HEALTHY').length} ổ khả dụng) --
                    </option>
                    {plugs
                      .filter((p) => p.usage_status === 'AVAILABLE' && p.technical_status === 'HEALTHY')
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.plug_code} ({p.slot_code || 'Bãi R'} - {p.voltage_type})
                        </option>
                      ))}
                  </select>
                )}
              </div>

              {/* 3. NHIỆT ĐỘ CÀI ĐẶT & BIÊN ĐỘ */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nhiệt độ cài đặt (°C) <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    required
                    placeholder="-18"
                    value={modalForm.target_temperature ?? ''}
                    onChange={(e) => setModalForm({ ...modalForm, target_temperature: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:bg-white focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                  />
                  <span className="text-[11px] text-slate-400 mt-0.5 block">Tiêu chuẩn: -18°C (đông lạnh) / +4°C (mát)</span>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Biên độ cho phép (±°C)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    placeholder="2.0"
                    value={modalForm.temp_tolerance ?? 2.0}
                    onChange={(e) => setModalForm({ ...modalForm, temp_tolerance: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:bg-white focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                  />
                  <span className="text-[11px] text-slate-500 mt-0.5 block font-medium">
                    Vùng an toàn: [{(Number(modalForm.target_temperature || -18) - Number(modalForm.temp_tolerance || 2)).toFixed(1)}°C đến {(Number(modalForm.target_temperature || -18) + Number(modalForm.temp_tolerance || 2)).toFixed(1)}°C]
                  </span>
                </div>
              </div>

              {/* 4. MÔ TẢ HÀNG & GHI CHÚ */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Mô tả hàng hóa
                  </label>
                  <input
                    type="text"
                    placeholder="Thịt đông lạnh, hoa quả..."
                    value={modalForm.cargo_description || ''}
                    onChange={(e) => setModalForm({ ...modalForm, cargo_description: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:bg-white focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Ghi chú điều độ
                  </label>
                  <input
                    type="text"
                    placeholder="Ghi chú thêm..."
                    value={modalForm.note || ''}
                    onChange={(e) => setModalForm({ ...modalForm, note: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:bg-white focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                  />
                </div>
              </div>

              {/* 5. NÚT HÀNH ĐỘNG */}
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 text-sm font-medium transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={modalSubmitting || !modalForm.container_id || !modalForm.plug_id}
                  className="px-5 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 disabled:bg-orange-300 text-white text-sm font-semibold shadow-xs transition-colors"
                >
                  {modalSubmitting ? 'Đang lưu...' : 'Xác nhận gán ổ cắm'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Bật điện & xác nhận (Bước 2 của Hiện trường / Kỹ thuật viên) */}
      {modalType === 'CONFIRM_POWER' && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900">Xác Nhận Đóng Điện & Bật Nguồn</h3>
            <p className="text-slate-500 text-xs mt-0.5">
              Bước 2: Kỹ thuật viên xác nhận đã cắm cáp 3 pha và đóng aptomat. Trạng thái ổ cắm chuyển sang <strong>Đang sử dụng</strong>, nguồn điện chuyển sang <strong>Có điện (mô phỏng)</strong>.
            </p>

            <form onSubmit={handleModalSubmit} className="space-y-3.5 mt-4">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-700 space-y-1">
                <div>Container: <span className="font-mono font-bold text-slate-900">{selectedItem?.container_no}</span></div>
                <div>Ổ cắm: <span className="font-bold text-orange-700">{selectedItem?.plug_code}</span></div>
                <div>Nhiệt độ cài đặt: <span className="font-bold text-slate-800">{selectedItem?.target_temperature}°C</span></div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700">Nhiệt độ đo được ban đầu (°C)</label>
                <input
                  type="number"
                  step="0.5"
                  value={modalForm.initial_temperature ?? ''}
                  onChange={(e) => setModalForm({ ...modalForm, initial_temperature: e.target.value })}
                  placeholder="-18"
                  className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:bg-white focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-3.5 py-2 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 text-sm font-medium"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={modalSubmitting}
                  className="px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold shadow-xs"
                >
                  {modalSubmitting ? 'Đang bật điện...' : 'Xác nhận bật nguồn điện'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Hủy gán ổ cắm (Cancel Reservation) */}
      {modalType === 'CANCEL_RESERVATION' && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900">Hủy Gán Ổ Cắm</h3>
            <p className="text-slate-500 text-xs mt-0.5">
              Giải phóng ổ cắm về trạng thái <strong>Sẵn sàng</strong> khi chưa đóng điện.
            </p>

            <form onSubmit={handleModalSubmit} className="space-y-3.5 mt-4">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-700 space-y-1">
                <div>Container: <span className="font-mono font-bold text-slate-900">{selectedItem?.container_no}</span></div>
                <div>Ổ cắm: <span className="font-bold text-slate-800">{selectedItem?.plug_code}</span></div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700">Lý do hủy gán *</label>
                <input
                  type="text"
                  required
                  value={modalForm.reason || ''}
                  onChange={(e) => setModalForm({ ...modalForm, reason: e.target.value })}
                  placeholder="Thay đổi kế hoạch điều độ..."
                  className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:bg-white focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-3.5 py-2 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 text-sm font-medium"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={modalSubmitting}
                  className="px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold shadow-xs"
                >
                  {modalSubmitting ? 'Đang hủy...' : 'Xác nhận hủy gán'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 4: Ghi nhật ký nhiệt độ */}
      {modalType === 'LOG_TEMP' && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900">Ghi nhật ký nhiệt độ</h3>
            <p className="text-slate-500 text-xs mt-0.5">Nhập nhiệt độ đo được trong đợt kiểm tra định kỳ.</p>

            <form onSubmit={handleModalSubmit} className="space-y-3.5 mt-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700">Nhiệt độ hồi Return (°C) *</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={modalForm.return_temperature ?? ''}
                    onChange={(e) => setModalForm({ ...modalForm, return_temperature: e.target.value })}
                    className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:bg-white focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700">Nhiệt độ thổi Supply (°C)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={modalForm.supply_temperature ?? ''}
                    onChange={(e) => setModalForm({ ...modalForm, supply_temperature: e.target.value })}
                    className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:bg-white focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700">Ghi chú kiểm tra</label>
                <input
                  type="text"
                  placeholder="Tình trạng máy lạnh, tiếng ồn..."
                  value={modalForm.notes || ''}
                  onChange={(e) => setModalForm({ ...modalForm, notes: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:bg-white focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-3.5 py-2 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 text-sm font-medium"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={modalSubmitting}
                  className="px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold shadow-xs"
                >
                  {modalSubmitting ? 'Đang lưu...' : 'Lưu nhiệt độ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 5: Ngắt điện hoàn tất */}
      {modalType === 'TERMINATE' && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900">Ngắt Điện & Giải Phóng Ổ Cắm</h3>
            <p className="text-slate-500 text-xs mt-0.5">
              Rút giắc cáp 3 pha, chốt giờ cấp điện để tính phí, ngắt dữ liệu mô phỏng và trả ổ cắm về trạng thái <strong>Sẵn sàng</strong>.
            </p>

            <form onSubmit={handleModalSubmit} className="space-y-3.5 mt-4">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-700 space-y-1">
                <div>Container: <span className="font-mono font-bold text-slate-900">{selectedItem?.container_no}</span></div>
                <div>Ổ cắm: <span className="font-bold text-orange-700">{selectedItem?.plug_code}</span></div>
                <div>Bắt đầu từ: <span className="font-medium text-slate-800">{selectedItem?.started_at ? new Date(selectedItem.started_at).toLocaleString('vi-VN') : 'Chưa ghi nhận'}</span></div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700">Lý do ngắt điện *</label>
                <select
                  value={modalForm.reason || ''}
                  onChange={(e) => setModalForm({ ...modalForm, reason: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:bg-white focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                >
                  <option value="Xuất bãi / Rút ruột container">Xuất bãi / Rút ruột container</option>
                  <option value="Khách hàng yêu cầu dừng cấp điện">Khách hàng yêu cầu dừng cấp điện</option>
                  <option value="Di dời container sang vị trí bãi khác">Di dời container sang vị trí bãi khác</option>
                  <option value="Bảo trì hoặc sự cố nguồn điện">Bảo trì hoặc sự cố nguồn điện</option>
                  <option value="Khác">Lý do khác...</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-3.5 py-2 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 text-sm font-medium"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={modalSubmitting}
                  className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold shadow-xs"
                >
                  {modalSubmitting ? 'Đang ngắt...' : 'Xác nhận ngắt điện'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 6: Đổi ổ cắm (Transfer) */}
      {modalType === 'TRANSFER' && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900">Chuyển sang ổ cắm khác</h3>
            <p className="text-slate-500 text-xs mt-0.5">Dùng khi ổ cắm hiện tại bị sự cố kỹ thuật hoặc cần di chuyển container.</p>

            <form onSubmit={handleModalSubmit} className="space-y-3.5 mt-4">
              <div>
                <label className="text-xs font-semibold text-slate-700">Chọn ổ cắm mới đang trống</label>
                <select
                  required
                  value={modalForm.new_plug_id || ''}
                  onChange={(e) => setModalForm({ ...modalForm, new_plug_id: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:bg-white focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                >
                  <option value="">-- Chọn ổ cắm đích --</option>
                  {plugs
                    .filter((p) => p.usage_status === 'AVAILABLE' && p.technical_status === 'HEALTHY')
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.plug_code} ({p.slot_code || 'Bãi R'})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700">Lý do chuyển ổ</label>
                <input
                  type="text"
                  required
                  value={modalForm.reason || ''}
                  onChange={(e) => setModalForm({ ...modalForm, reason: e.target.value })}
                  placeholder="Ổ cũ hỏng aptomat, chuyển vị trí bãi..."
                  className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:bg-white focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-3.5 py-2 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 text-sm font-medium"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={modalSubmitting}
                  className="px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold shadow-xs"
                >
                  {modalSubmitting ? 'Đang chuyển...' : 'Xác nhận đổi ổ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 7: Biểu đồ biến thiên nhiệt độ, đối chiếu cảnh báo & trạng thái nguồn điện (Giao diện Sáng - Light TOS Professional) */}
      {modalType === 'TEMP_HISTORY' && (() => {
        const records = tempHistory || [];
        const targetTemp = selectedItem?.target_temperature != null ? Number(selectedItem.target_temperature) : -18;
        const tempTolerance = selectedItem?.temp_tolerance != null ? Number(selectedItem.temp_tolerance) : 2;
        const minSafe = targetTemp - tempTolerance;
        const maxSafe = targetTemp + tempTolerance;

        // Tính toán khoảng scale Y động
        const allTemps = [
          targetTemp,
          minSafe,
          maxSafe,
          ...records.map((r) => r.return_temperature).filter((t) => t != null),
          ...records.map((r) => r.supply_temperature).filter((t) => t != null),
        ];
        const rawMin = Math.min(...allTemps);
        const rawMax = Math.max(...allTemps);
        const minYVal = Math.floor(rawMin - 2);
        const maxYVal = Math.ceil(rawMax + 2);
        const yRange = Math.max(maxYVal - minYVal, 6);

        // Kích thước khung vẽ SVG
        const svgW = 900;
        const svgH = 250;
        const padL = 50;
        const padR = 85;
        const padT = 28;
        const padB = 36;
        const plotW = svgW - padL - padR;
        const plotH = svgH - padT - padB;

        const getY = (val) => padT + plotH - ((val - minYVal) / yRange) * plotH;
        const getX = (i, total) => (total <= 1 ? padL + plotW / 2 : padL + (i / (total - 1)) * plotW);

        // Tọa độ dải an toàn
        const safeTop = Math.max(padT, getY(maxSafe));
        const safeBottom = Math.min(padT + plotH, getY(minSafe));
        const safeHeight = Math.max(4, safeBottom - safeTop);

        // Tạo path mượt cho nhiệt độ hồi
        const returnPoints = records.map((r, i) => ({
          x: getX(i, records.length),
          y: getY(r.return_temperature),
          rec: r,
          index: i,
        }));

        let returnPathD = '';
        let returnAreaD = '';
        if (returnPoints.length > 0) {
          returnPathD = returnPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
          const firstX = returnPoints[0].x.toFixed(1);
          const lastX = returnPoints[returnPoints.length - 1].x.toFixed(1);
          const bottomY = (padT + plotH).toFixed(1);
          returnAreaD = `${returnPathD} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`;
        }

        // Tạo path cho nhiệt độ thổi
        const supplyPoints = records
          .map((r, i) => (r.supply_temperature != null ? { x: getX(i, records.length), y: getY(r.supply_temperature) } : null))
          .filter(Boolean);
        const supplyPathD = supplyPoints.length > 0
          ? supplyPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
          : '';

        // Các mốc lưới Y-axis
        const yTicks = [
          minYVal,
          Number((minYVal + yRange * 0.25).toFixed(1)),
          Number((minYVal + yRange * 0.5).toFixed(1)),
          Number((minYVal + yRange * 0.75).toFixed(1)),
          maxYVal,
        ];

        // Phát hiện các dải sự cố liên tục để tô màu vùng thay vì vẽ chồng chéo từng điểm
        const incidentSpans = [];
        let curSpan = null;
        records.forEach((r, idx) => {
          const isLoss = r.power_status === 'POWER_LOST';
          const isAbn = r.is_abnormal;
          if (isLoss || isAbn) {
            const spanType = isLoss ? 'POWER_LOST' : 'ABNORMAL';
            if (!curSpan || curSpan.type !== spanType) {
              if (curSpan) incidentSpans.push(curSpan);
              curSpan = {
                type: spanType,
                startIndex: idx,
                endIndex: idx,
                message: r.alert_message || (isLoss ? 'Mất điện nguồn mô phỏng' : 'Nhiệt độ ngoài dải an toàn'),
              };
            } else {
              curSpan.endIndex = idx;
            }
          } else {
            if (curSpan) {
              incidentSpans.push(curSpan);
              curSpan = null;
            }
          }
        });
        if (curSpan) incidentSpans.push(curSpan);

        // Thống kê số lượng
        const alertCount = records.filter((r) => r.alert_message || r.is_abnormal).length;
        const powerLossCount = records.filter((r) => r.power_status === 'POWER_LOST').length;
        const abnormalCount = records.filter((r) => r.is_abnormal).length;
        const normalCount = records.length - alertCount;

        const filteredRecords = records.filter((r) => {
          if (historyFilter === 'ALERTS') return Boolean(r.alert_message || r.is_abnormal);
          if (historyFilter === 'POWER_LOSS') return r.power_status === 'POWER_LOST';
          if (historyFilter === 'ABNORMAL') return Boolean(r.is_abnormal);
          if (historyFilter === 'NORMAL') return !r.is_abnormal && r.power_status !== 'POWER_LOST';
          return true;
        });

        // Điểm được chọn kiểm tra
        const activeInspector = historyHover || (records.length > 0 ? records[records.length - 1] : null);
        const activeInspectorIndex = activeInspector ? records.findIndex((r) => r.id === activeInspector.id) : -1;
        const activeInspectorX = activeInspectorIndex >= 0 ? getX(activeInspectorIndex, records.length) : null;

        return (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-y-auto">
            <div className="bg-white border border-slate-200/90 rounded-2xl max-w-6xl w-full shadow-2xl my-auto flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              
              {/* ================= HEADER GIAO DIỆN DOANH NGHIỆP TRẮNG CAM ================= */}
              <div className="px-5 py-4 bg-white border-b border-slate-200 flex items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-200 text-orange-600 flex items-center justify-center font-bold text-lg shadow-2xs">
                    📈
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base sm:text-lg font-bold text-slate-900">
                        Biến thiên Nhiệt độ & Giám sát Sự cố Bãi Lạnh
                      </h3>
                      <span className="font-mono font-bold text-xs px-2.5 py-0.5 rounded-md bg-orange-50 text-orange-700 border border-orange-200">
                        {selectedItem?.container_no || 'CONTAINER'}
                      </span>
                      <span className="font-mono text-xs px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                        Ổ: {selectedItem?.plug_code || 'Ổ cắm bãi'}
                      </span>
                      {selectedItem?.actual_power_status === 'POWER_LOST' || powerLossCount > 0 ? (
                        <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-amber-50 text-amber-700 border border-amber-300 flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-amber-500" />
                          <span>⚡ MẤT ĐIỆN NGUỒN</span>
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-md text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                          <span>Đang cấp điện</span>
                        </span>
                      )}
                    </div>
                    <div className="text-slate-500 text-xs mt-0.5 flex items-center gap-2">
                      <span>Cài đặt: <strong className="text-slate-800">{targetTemp.toFixed(1)}°C</strong> (±{tempTolerance.toFixed(1)}°C)</span>
                      <span>•</span>
                      <span className="text-orange-700 font-medium">IoT Telematics & SignalR đồng bộ liên tục</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors text-base font-semibold"
                    title="Đóng cửa sổ"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* ================= THÂN MODAL CUỘN ĐƯỢC (LIGHT BACKGROUND) ================= */}
              <div className="p-4 sm:p-5 overflow-y-auto space-y-4 bg-slate-50/50">
                
                {/* 4 Thẻ KPI Tóm Tắt (White Minimalist Cards) */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
                    <div className="text-[11px] font-medium text-slate-500">Mục tiêu quy định</div>
                    <div className="text-xl font-black text-slate-900 mt-0.5 font-mono">
                      {targetTemp.toFixed(1)}°C
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      Dải an toàn: {minSafe.toFixed(1)}° → {maxSafe.toFixed(1)}°C
                    </div>
                  </div>

                  <div className={`p-3 bg-white rounded-xl border shadow-2xs ${
                    activeInspector?.is_abnormal ? 'border-rose-300 ring-1 ring-rose-200' : 'border-slate-200'
                  }`}>
                    <div className="text-[11px] font-medium text-slate-500">Nhiệt độ hồi (Thời điểm chọn)</div>
                    <div className="text-xl font-black mt-0.5 font-mono flex items-center gap-2">
                      <span className={activeInspector?.is_abnormal ? 'text-rose-600' : 'text-orange-600'}>
                        {activeInspector?.return_temperature != null ? `${activeInspector.return_temperature.toFixed(2)}°C` : '--'}
                      </span>
                      {activeInspector?.return_temperature != null && (
                        <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                          Math.abs(activeInspector.return_temperature - targetTemp) > tempTolerance
                            ? 'bg-rose-100 text-rose-700'
                            : 'bg-emerald-100 text-emerald-700'
                        }`}>
                          {activeInspector.return_temperature > targetTemp ? '+' : ''}
                          {(activeInspector.return_temperature - targetTemp).toFixed(1)}°C
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      Thổi (Supply): {activeInspector?.supply_temperature != null ? `${activeInspector.supply_temperature.toFixed(2)}°C` : 'N/A'}
                    </div>
                  </div>

                  <div className={`p-3 bg-white rounded-xl border shadow-2xs ${
                    activeInspector?.power_status === 'POWER_LOST' ? 'border-amber-300 ring-1 ring-amber-200' : 'border-slate-200'
                  }`}>
                    <div className="text-[11px] font-medium text-slate-500">Nguồn điện (Thời điểm chọn)</div>
                    <div className="text-base font-bold mt-1 flex items-center gap-1.5">
                      {activeInspector?.power_status === 'POWER_LOST' ? (
                        <span className="text-amber-700 flex items-center gap-1">
                          <span>⚡ Mất điện nguồn</span>
                        </span>
                      ) : (
                        <span className="text-emerald-700 flex items-center gap-1">
                          <span>🟢 Đang cấp điện</span>
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      Tổng số chu kỳ mất điện: <strong className="text-slate-800">{powerLossCount}</strong>
                    </div>
                  </div>

                  <div className={`p-3 bg-white rounded-xl border shadow-2xs ${
                    alertCount > 0 ? 'border-rose-300 ring-1 ring-rose-200' : 'border-slate-200'
                  }`}>
                    <div className="text-[11px] font-medium text-slate-500">Sự cố phát sinh</div>
                    <div className="text-xl font-black text-rose-700 mt-0.5 font-mono">
                      {alertCount} <span className="text-xs font-normal text-slate-500">chu kỳ</span>
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      {abnormalCount} lần vượt ngưỡng an toàn
                    </div>
                  </div>
                </div>

                {/* ================= KHUNG BIỂU ĐỒ CHUYÊN NGHIỆP (WHITE CANVAS) ================= */}
                <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-2xs">
                  
                  {/* Tiêu đề & Chú giải Biểu đồ */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 mb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
                        Đồ thị biểu diễn nhiệt độ & Sự kiện
                      </span>
                      <span className="text-[11px] font-mono text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                        {records.length} chu kỳ đo đạc
                      </span>
                    </div>

                    {/* Legend thanh lịch */}
                    <div className="flex flex-wrap items-center gap-3.5 text-[11px] text-slate-600 font-medium">
                      <span className="flex items-center gap-1.5">
                        <span className="w-3.5 h-1 bg-orange-600 rounded-full" />
                        <span>Nhiệt độ hồi (°C)</span>
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="w-3.5 h-0.5 border-t-2 border-dashed border-sky-500" />
                        <span>Nhiệt độ thổi</span>
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="w-3.5 h-2 bg-emerald-50 border border-emerald-400 rounded-xs" />
                        <span>Dải an toàn (±{tempTolerance}°)</span>
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="w-3.5 h-2 bg-amber-100 border border-amber-300 rounded-xs" />
                        <span>Vùng mất điện</span>
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-600 ring-2 ring-rose-200" />
                        <span>Cảnh báo</span>
                      </span>
                    </div>
                  </div>

                  {records.length === 0 ? (
                    <div className="py-20 text-center text-slate-400 text-sm">
                      Chưa có dữ liệu đo đạc nào được ghi nhận cho phiên cấp điện này.
                    </div>
                  ) : (
                    <div>
                      {/* SVG Chart Canvas */}
                      <div className="w-full overflow-x-auto">
                        <svg
                          viewBox={`0 0 ${svgW} ${svgH}`}
                          className="w-full h-auto min-w-[720px] select-none"
                        >
                          <defs>
                            {/* Gradient vùng dưới đường nhiệt độ hồi (Corporate Orange) */}
                            <linearGradient id="returnTempAreaGradLight" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#ea580c" stopOpacity="0.16" />
                              <stop offset="100%" stopColor="#ea580c" stopOpacity="0.01" />
                            </linearGradient>
                            {/* Gradient dải nhiệt an toàn */}
                            <linearGradient id="safeZoneLightGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#10b981" stopOpacity="0.09" />
                              <stop offset="100%" stopColor="#10b981" stopOpacity="0.04" />
                            </linearGradient>
                          </defs>

                          {/* Lưới ngang mờ (Subtle Gridlines) */}
                          {yTicks.map((tickVal) => {
                            const yPos = getY(tickVal);
                            return (
                              <g key={tickVal}>
                                <line
                                  x1={padL}
                                  y1={yPos}
                                  x2={svgW - padR}
                                  y2={yPos}
                                  stroke="#f1f5f9"
                                  strokeWidth="1"
                                />
                                <text
                                  x={padL - 8}
                                  y={yPos + 3.5}
                                  textAnchor="end"
                                  fontSize="10"
                                  fill="#94a3b8"
                                  fontFamily="monospace"
                                >
                                  {tickVal > 0 ? `+${tickVal}` : tickVal}°C
                                </text>
                              </g>
                            );
                          })}

                          {/* Dải nhiệt độ an toàn (Safe Zone Band) */}
                          <rect
                            x={padL}
                            y={safeTop}
                            width={plotW}
                            height={safeHeight}
                            fill="url(#safeZoneLightGrad)"
                            stroke="#10b981"
                            strokeWidth="1"
                            strokeDasharray="4 2"
                            strokeOpacity="0.5"
                          />
                          <text
                            x={svgW - padR + 6}
                            y={safeTop + 4}
                            fontSize="9"
                            fill="#059669"
                            fontWeight="bold"
                            fontFamily="monospace"
                          >
                            Max {maxSafe.toFixed(1)}°
                          </text>
                          <text
                            x={svgW - padR + 6}
                            y={safeBottom + 4}
                            fontSize="9"
                            fill="#059669"
                            fontWeight="bold"
                            fontFamily="monospace"
                          >
                            Min {minSafe.toFixed(1)}°
                          </text>

                          {/* Đường chuẩn nhiệt độ mục tiêu (Target Line) */}
                          <line
                            x1={padL}
                            y1={getY(targetTemp)}
                            x2={svgW - padR}
                            y2={getY(targetTemp)}
                            stroke="#ea580c"
                            strokeWidth="1.2"
                            strokeDasharray="5 3"
                            strokeOpacity="0.8"
                          />
                          <text
                            x={svgW - padR + 6}
                            y={getY(targetTemp) + 3.5}
                            fontSize="9.5"
                            fill="#ea580c"
                            fontWeight="bold"
                            fontFamily="monospace"
                          >
                            🎯 {targetTemp.toFixed(1)}°C
                          </text>

                          {/* Vùng sự cố liên tục (Shaded Incident Zones) */}
                          {incidentSpans.map((span, sIdx) => {
                            const startX = getX(span.startIndex, records.length);
                            const endX = getX(span.endIndex, records.length);
                            const spanWidth = Math.max(12, endX - startX);
                            const isPowerLoss = span.type === 'POWER_LOST';

                            return (
                              <g key={`span-${sIdx}`}>
                                <rect
                                  x={startX}
                                  y={padT}
                                  width={spanWidth}
                                  height={plotH}
                                  fill={isPowerLoss ? '#fef3c7' : '#fee2e2'}
                                  fillOpacity="0.45"
                                  stroke={isPowerLoss ? '#f59e0b' : '#ef4444'}
                                  strokeWidth="1"
                                  strokeDasharray="3 2"
                                  rx="3"
                                />
                                {/* Huy hiệu sự cố đầu dải */}
                                <g transform={`translate(${startX + 4}, ${padT + 12})`}>
                                  <rect
                                    x="0"
                                    y="-10"
                                    width={isPowerLoss ? "75" : "80"}
                                    height="16"
                                    rx="3"
                                    fill={isPowerLoss ? '#f59e0b' : '#ef4444'}
                                  />
                                  <text
                                    x="5"
                                    y="1.5"
                                    fontSize="8.5"
                                    fontWeight="bold"
                                    fill="#ffffff"
                                  >
                                    {isPowerLoss ? '⚡ MẤT ĐIỆN' : '🚨 VƯỢT NGƯỠNG'}
                                  </text>
                                </g>
                              </g>
                            );
                          })}

                          {/* Vùng diện tích mờ dưới đường nhiệt độ hồi */}
                          {returnAreaD && (
                            <path
                              d={returnAreaD}
                              fill="url(#returnTempAreaGradLight)"
                            />
                          )}

                          {/* Polyline nhiệt độ thổi (Supply Temp) */}
                          {supplyPathD && (
                            <path
                              d={supplyPathD}
                              fill="none"
                              stroke="#0284c7"
                              strokeWidth="1.5"
                              strokeDasharray="4 3"
                              strokeLinecap="round"
                              opacity="0.8"
                            />
                          )}

                          {/* Polyline nhiệt độ hồi (Return Temp - Corporate Orange) */}
                          {returnPathD && (
                            <path
                              d={returnPathD}
                              fill="none"
                              stroke="#ea580c"
                              strokeWidth="2.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          )}

                          {/* Con trỏ gióng dọc tương tác (Interactive Vertical Crosshair) */}
                          {activeInspectorX != null && (
                            <line
                              x1={activeInspectorX}
                              y1={padT}
                              x2={activeInspectorX}
                              y2={padT + plotH}
                              stroke="#ea580c"
                              strokeWidth="1.5"
                              strokeDasharray="3 2"
                              opacity="0.75"
                            />
                          )}

                          {/* Các điểm đo nhiệt độ (Data Points) */}
                          {records.map((r, i) => {
                            const x = getX(i, records.length);
                            const y = getY(r.return_temperature);
                            const isSelected = activeInspector?.id === r.id;
                            const isAbnormal = r.is_abnormal;
                            const isPowerLost = r.power_status === 'POWER_LOST';

                            return (
                              <g
                                key={r.id || i}
                                className="cursor-pointer"
                                onMouseEnter={() => setHistoryHover(r)}
                                onClick={() => setHistoryHover(r)}
                              >
                                {isSelected && (
                                  <circle
                                    cx={x}
                                    cy={y}
                                    r="8"
                                    fill="none"
                                    stroke={isAbnormal ? '#ef4444' : '#ea580c'}
                                    strokeWidth="2"
                                    opacity="0.6"
                                  />
                                )}
                                <circle
                                  cx={x}
                                  cy={y}
                                  r={isSelected ? '5' : isAbnormal ? '4.5' : '3.5'}
                                  fill={
                                    isAbnormal
                                      ? '#ef4444'
                                      : isPowerLost
                                      ? '#f59e0b'
                                      : '#ea580c'
                                  }
                                  stroke="#ffffff"
                                  strokeWidth={isSelected ? '2' : '1.5'}
                                />
                              </g>
                            );
                          })}

                          {/* Trục hoành và nhãn thời gian */}
                          <line
                            x1={padL}
                            y1={padT + plotH}
                            x2={svgW - padR}
                            y2={padT + plotH}
                            stroke="#e2e8f0"
                            strokeWidth="1"
                          />

                          {records.map((r, i) => {
                            const step = Math.max(1, Math.floor(records.length / 7));
                            if (i % step !== 0 && i !== records.length - 1) return null;
                            const x = getX(i, records.length);
                            const timeStr = new Date(r.recorded_at).toLocaleTimeString('vi-VN', {
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                            });

                            return (
                              <g key={`time-${i}`}>
                                <line
                                  x1={x}
                                  y1={padT + plotH}
                                  x2={x}
                                  y2={padT + plotH + 4}
                                  stroke="#cbd5e1"
                                />
                                <text
                                  x={x}
                                  y={padT + plotH + 15}
                                  textAnchor="middle"
                                  fontSize="9.5"
                                  fill="#64748b"
                                  fontFamily="monospace"
                                >
                                  {timeStr}
                                </text>
                              </g>
                            );
                          })}
                        </svg>
                      </div>

                      {/* Băng Giám Sát Nguồn Điện Dưới Chân Trục Thời Gian */}
                      <div className="mt-2 pt-2.5 border-t border-slate-100">
                        <div className="flex items-center justify-between text-xs mb-1.5">
                          <span className="font-bold text-slate-700 flex items-center gap-1.5">
                            <span>⚡ Trạng thái nguồn điện tương ứng theo thời gian:</span>
                          </span>
                          <div className="flex items-center gap-3 text-[11px] font-medium">
                            <span className="inline-flex items-center gap-1 text-emerald-700">
                              <span className="w-2.5 h-2 rounded-xs bg-emerald-500" /> Cấp điện bình thường
                            </span>
                            <span className="inline-flex items-center gap-1 text-amber-700">
                              <span className="w-2.5 h-2 rounded-xs bg-amber-500" /> Mất điện nguồn
                            </span>
                          </div>
                        </div>

                        <div className="h-6 w-full bg-slate-100 rounded-lg overflow-hidden flex border border-slate-200">
                          {records.map((r, i) => {
                            const isPowerLost = r.power_status === 'POWER_LOST';
                            const isSelected = activeInspector?.id === r.id;
                            const widthPercent = (100 / records.length).toFixed(3);

                            return (
                              <div
                                key={`pwr-track-${r.id || i}`}
                                style={{ width: `${widthPercent}%` }}
                                className={`h-full transition-all cursor-pointer relative ${
                                  isPowerLost
                                    ? 'bg-amber-500 hover:bg-amber-600'
                                    : 'bg-emerald-500 hover:bg-emerald-600'
                                } ${isSelected ? 'ring-2 ring-slate-900 z-10 brightness-110' : ''}`}
                                onMouseEnter={() => setHistoryHover(r)}
                                onClick={() => setHistoryHover(r)}
                                title={`${new Date(r.recorded_at).toLocaleTimeString('vi-VN')}: ${
                                  isPowerLost ? '⚡ Mất điện nguồn' : '🟢 Có điện'
                                }`}
                              />
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* ================= KHU VỰC PHÂN TÍCH & BẢNG NHẬT KÝ (SPLIT COCKPIT) ================= */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
                  
                  {/* Cột Trái: Hộp Tra Cứu Điểm Đo Đang Chọn (Inspector Box - 4 Cols) */}
                  <div className="lg:col-span-4 bg-white rounded-xl border border-slate-200 p-4 shadow-2xs flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                          Chi tiết thời điểm khảo sát
                        </span>
                        <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                          {activeInspector?.data_source || 'IOT'}
                        </span>
                      </div>

                      {activeInspector ? (
                        <div className="mt-3 space-y-2.5 text-xs">
                          <div className="flex justify-between items-center">
                            <span className="text-slate-500">Thời gian ghi nhận:</span>
                            <span className="font-mono font-bold text-slate-800">
                              {new Date(activeInspector.recorded_at).toLocaleTimeString('vi-VN')} ({new Date(activeInspector.recorded_at).toLocaleDateString('vi-VN')})
                            </span>
                          </div>

                          <div className="flex justify-between items-center">
                            <span className="text-slate-500">Nguồn điện:</span>
                            <div>
                              {activeInspector.power_status === 'POWER_LOST' ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                  ⚡ MẤT ĐIỆN NGUỒN
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                  🟢 CÓ ĐIỆN
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80 space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="text-slate-600 font-medium">Nhiệt độ hồi:</span>
                              <span className={`font-mono font-black text-sm ${
                                activeInspector.is_abnormal ? 'text-rose-600' : 'text-slate-900'
                              }`}>
                                {activeInspector.return_temperature}°C
                              </span>
                            </div>

                            <div className="flex justify-between items-center">
                              <span className="text-slate-600 font-medium">Nhiệt độ thổi:</span>
                              <span className="font-mono font-medium text-slate-800">
                                {activeInspector.supply_temperature != null ? `${activeInspector.supply_temperature}°C` : '--'}
                              </span>
                            </div>

                            <div className="flex justify-between items-center pt-1.5 border-t border-slate-200/60">
                              <span className="text-slate-600 font-medium">Độ lệch vs Mục tiêu:</span>
                              <span className={`font-mono font-bold ${
                                activeInspector.is_abnormal ? 'text-rose-600' : 'text-orange-700'
                              }`}>
                                {activeInspector.return_temperature > targetTemp ? '+' : ''}
                                {(activeInspector.return_temperature - targetTemp).toFixed(2)}°C
                              </span>
                            </div>
                          </div>

                          {/* Cảnh báo đính kèm nếu có */}
                          {activeInspector.alert_message ? (
                            <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-[11px]">
                              <div className="font-bold flex items-center gap-1 text-rose-900 mb-1">
                                <span>🚨 Cảnh báo hệ thống:</span>
                              </div>
                              <p className="leading-snug">{activeInspector.alert_message}</p>
                            </div>
                          ) : activeInspector.is_abnormal ? (
                            <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-[11px]">
                              ⚠️ Nhiệt độ đo đạc đã vượt dải dung sai an toàn quy định ({minSafe.toFixed(1)}° → {maxSafe.toFixed(1)}°C).
                            </div>
                          ) : (
                            <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] flex items-center gap-1.5">
                              <span>✓ Thông số hoạt động trong phạm vi cho phép.</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="py-8 text-center text-slate-400 text-xs">
                          Chưa chọn điểm đo. Di chuột lên biểu đồ để kiểm tra chi tiết.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Cột Phải: Bảng Nhật Ký Đối Chiếu (Audit Table - 8 Cols) */}
                  <div className="lg:col-span-8 bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="text-xs font-bold uppercase tracking-wider text-slate-700">
                        Nhật ký đo đạc & Đối chiếu ({filteredRecords.length}/{records.length})
                      </div>

                      {/* Filter tabs */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                          type="button"
                          onClick={() => setHistoryFilter('ALL')}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                            historyFilter === 'ALL'
                              ? 'bg-orange-600 text-white font-semibold'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          Tất cả ({records.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setHistoryFilter('ALERTS')}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 ${
                            historyFilter === 'ALERTS'
                              ? 'bg-rose-600 text-white font-bold'
                              : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                          }`}
                        >
                          🚨 Có cảnh báo ({alertCount})
                        </button>
                        <button
                          type="button"
                          onClick={() => setHistoryFilter('POWER_LOSS')}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 ${
                            historyFilter === 'POWER_LOSS'
                              ? 'bg-amber-600 text-white font-bold'
                              : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                          }`}
                        >
                          ⚡ Mất điện ({powerLossCount})
                        </button>
                        <button
                          type="button"
                          onClick={() => setHistoryFilter('NORMAL')}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                            historyFilter === 'NORMAL'
                              ? 'bg-emerald-600 text-white font-bold'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          Bình thường ({normalCount})
                        </button>
                      </div>
                    </div>

                    <div className="border border-slate-200 rounded-lg overflow-hidden max-h-60 overflow-y-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 sticky top-0 z-10">
                          <tr>
                            <th className="py-2.5 px-3">Thời gian ghi</th>
                            <th className="py-2.5 px-3">Nguồn điện</th>
                            <th className="py-2.5 px-3">Nhiệt hồi</th>
                            <th className="py-2.5 px-3">Nhiệt thổi</th>
                            <th className="py-2.5 px-3">Độ lệch</th>
                            <th className="py-2.5 px-3">Cảnh báo / Sự cố đối chiếu</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {filteredRecords.length === 0 ? (
                            <tr>
                              <td colSpan="6" className="py-8 text-center text-slate-400">
                                Không có bản ghi nào phù hợp với bộ lọc đã chọn.
                              </td>
                            </tr>
                          ) : (
                            filteredRecords.slice().reverse().map((rec) => {
                              const isAbnormal = rec.is_abnormal;
                              const isPowerLost = rec.power_status === 'POWER_LOST';
                              const hasAlert = Boolean(rec.alert_message);
                              const isSelected = activeInspector?.id === rec.id;

                              return (
                                <tr
                                  key={rec.id}
                                  className={`transition-colors cursor-pointer ${
                                    isSelected
                                      ? 'bg-orange-50/80 font-medium border-l-2 border-l-orange-500'
                                      : hasAlert
                                      ? 'bg-rose-50/40 hover:bg-rose-50/70'
                                      : isPowerLost
                                      ? 'bg-amber-50/30 hover:bg-amber-50/60'
                                      : 'hover:bg-slate-50'
                                  }`}
                                  onClick={() => setHistoryHover(rec)}
                                >
                                  <td className="py-2 px-3 font-mono text-slate-600">
                                    {new Date(rec.recorded_at).toLocaleTimeString('vi-VN')}
                                  </td>
                                  <td className="py-2 px-3">
                                    {isPowerLost ? (
                                      <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                        ⚡ Mất điện
                                      </span>
                                    ) : (
                                      <span className="px-1.5 py-0.2 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                                        🟢 Có điện
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-2 px-3">
                                    <span className={`font-bold font-mono ${isAbnormal ? 'text-rose-600' : 'text-slate-900'}`}>
                                      {rec.return_temperature}°C
                                    </span>
                                  </td>
                                  <td className="py-2 px-3 text-slate-600 font-mono">
                                    {rec.supply_temperature != null ? `${rec.supply_temperature}°C` : '--'}
                                  </td>
                                  <td className="py-2 px-3">
                                    <span className={`font-mono text-[11px] ${
                                      Math.abs(rec.return_temperature - targetTemp) > tempTolerance
                                        ? 'text-rose-600 font-bold'
                                        : 'text-slate-600'
                                    }`}>
                                      {rec.return_temperature > targetTemp ? '+' : ''}
                                      {(rec.return_temperature - targetTemp).toFixed(1)}°C
                                    </span>
                                  </td>
                                  <td className="py-2 px-3">
                                    {hasAlert ? (
                                      <div className="flex items-center gap-1 text-rose-700 font-medium">
                                        <span className="px-1 py-0.2 rounded bg-rose-100 text-rose-800 text-[10px] font-bold shrink-0">
                                          🚨 {rec.alert_type || 'CẢNH BÁO'}
                                        </span>
                                        <span className="text-[11px] truncate max-w-xs" title={rec.alert_message}>
                                          {rec.alert_message}
                                        </span>
                                      </div>
                                    ) : isAbnormal ? (
                                      <span className="px-1 py-0.2 rounded bg-rose-100 text-rose-700 text-[10px] font-semibold">
                                        ⚠️ Vượt ngưỡng an toàn
                                      </span>
                                    ) : (
                                      <span className="text-slate-400 text-[11px]">—</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                </div>

              </div>

              {/* ================= FOOTER GIAO DIỆN SÁNG ================= */}
              <div className="px-5 py-3.5 bg-white border-t border-slate-200 flex items-center justify-between shrink-0">
                <div className="text-xs text-slate-500">
                  Dữ liệu được cập nhật tự động thời gian thực qua kênh IoT Telematics và SignalR.
                </div>
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-5 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold shadow-xs transition-colors"
                >
                  Đóng cửa sổ
                </button>
              </div>

            </div>
          </div>
        );
      })()}

      {/* Modal 8: Đóng cảnh báo */}
      {modalType === 'RESOLVE_ALERT' && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900">Xác nhận xử lý sự cố</h3>
            <p className="text-slate-500 text-xs mt-0.5">Nhập phương án khắc phục sự cố để đóng cảnh báo.</p>

            <form onSubmit={handleModalSubmit} className="space-y-3.5 mt-4">
              <div>
                <label className="text-xs font-semibold text-slate-700">Biện pháp khắc phục *</label>
                <textarea
                  rows="3"
                  required
                  value={modalForm.notes || ''}
                  onChange={(e) => setModalForm({ ...modalForm, notes: e.target.value })}
                  placeholder="Đã kiểm tra gas, khởi động lại block làm lạnh..."
                  className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:bg-white focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-3.5 py-2 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 text-sm font-medium"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={modalSubmitting}
                  className="px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold shadow-xs"
                >
                  {modalSubmitting ? 'Đang lưu...' : 'Hoàn tất xử lý'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
