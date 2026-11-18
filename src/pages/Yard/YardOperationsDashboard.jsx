import React, { useState, useEffect, useMemo } from 'react'
import yardTaskService from '../../services/yardTaskService'
import yardDischargeService from '../../services/yardDischargeService'
import AssignEquipmentModal from '../../components/Yard/AssignEquipmentModal'
import YardReceivingModal from '../../components/Yard/YardReceivingModal'
import CompleteLiftModal from '../../components/Yard/CompleteLiftModal'
import { manifestPortSyncService } from '../../services/manifestPortSyncService'
import { yardReservationStore } from '../../services/yardReservationStore'

export default function YardOperationsDashboard() {
  const [toastMessage, setToastMessage] = useState('')
  const [todayDate] = useState(
    new Date().toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
  )
  const [activeShift] = useState('Ca 1 (06:00 – 14:00)')
  const [selectedBlockFilter, setSelectedBlockFilter] = useState('ALL')
  const [taskStatusTab, setTaskStatusTab] = useState('ALL') // 'ALL' | 'Assigned' | 'Ready' | 'In_Progress' | 'Completed'
  const [searchQuery, setSearchQuery] = useState('')
  
  // Modals state
  const [selectedTaskToAssign, setSelectedTaskToAssign] = useState(null)
  const [receivingModalOpen, setReceivingModalOpen] = useState(false)
  const [selectedTaskToReceive, setSelectedTaskToReceive] = useState(null)
  const [completeLiftModalOpen, setCompleteLiftModalOpen] = useState(false)
  const [selectedTaskToCompleteLift, setSelectedTaskToCompleteLift] = useState(null)
  
  const [loadingTasks, setLoadingTasks] = useState(false)
  const [operatingTaskId, setOperatingTaskId] = useState(null)

  // Inbound Vessel Discharge & Smart Yard Allocation State
  const [dischargePlans, setDischargePlans] = useState([])
  const [selectedPlanId, setSelectedPlanId] = useState('')
  const [loadingPlans, setLoadingPlans] = useState(false)
  const [isPreAllocating, setIsPreAllocating] = useState(false)

  // Tally Quayside Scan Modal State
  const [tallyModalOpen, setTallyModalOpen] = useState(false)
  const [tallyContainerInput, setTallyContainerInput] = useState('')
  const [tallyCondition, setTallyCondition] = useState('GOOD')
  const [tallyNotes, setTallyNotes] = useState('')
  const [tallyDamagePhotos, setTallyDamagePhotos] = useState([])
  const [previewImage, setPreviewImage] = useState(null)
  const [tallyScanResult, setTallyScanResult] = useState(null)
  const [tallyScanning, setTallyScanning] = useState(false)
  const [tallyConfirming, setTallyConfirming] = useState(false)

  // Handle Photo Upload / Snap
  const handlePhotoUpload = (e) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    files.forEach(file => {
      const reader = new FileReader()
      reader.onload = (event) => {
        setTallyDamagePhotos(prev => [...prev, event.target.result])
      }
      reader.readAsDataURL(file)
    })
  }

  const handleRemovePhoto = (index) => {
    setTallyDamagePhotos(prev => prev.filter((_, i) => i !== index))
  }

  // Manual Override Slot Modal State
  const [overrideModalOpen, setOverrideModalOpen] = useState(false)
  const [overrideContainer, setOverrideContainer] = useState(null)
  const [overrideNewSlot, setOverrideNewSlot] = useState('')
  const [overrideReason, setOverrideReason] = useState('')
  const [overrideSubmitting, setOverrideSubmitting] = useState(false)

  // Incoming Containers List (Được đồng bộ tự động 100% theo Database & Manifest nhập)
  const [incomingContainers, setIncomingContainers] = useState([])

  // AI Positioning Recommendations
  const [positioningTasks, setPositioningTasks] = useState([])

  // Yard Tasks List
  const [yardTasks, setYardTasks] = useState([])

  // Load live tasks from API & Sync with Database
  const loadLiveTasks = async (plansList = null) => {
    try {
      setLoadingTasks(true)
      const data = await yardTaskService.getTasks()
      if (Array.isArray(data)) {
        setYardTasks(data)

        // Lọc bỏ bất kỳ Container nào đã được tiếp nhận trong Database (receivedAt != null)
        const receivedContSet = new Set(
          data.filter(t => !!t.receivedAt).map(t => t.containerNo?.toUpperCase())
        )

        // Lấy danh sách nhiệm vụ đang chờ tiếp nhận thực tế từ DB
        const pendingFromDb = data
          .filter(t => !t.receivedAt && (t.status?.toLowerCase() === 'assigned' || t.status?.toLowerCase() === 'ready'))
          .map(t => ({
            id: t.containerNo,
            vessel: t.fromLocation || 'Cầu Tàu B-01',
            berth: 'B-01',
            type: t.containerType || '40FT HC',
            weight: '24,000 KG',
            seal: t.expectedSealNo || 'SEAL-889922',
            status: t.status?.toLowerCase() === 'ready' ? 'UNLOADED' : 'IN TRANSIT',
            statusBadge: t.status?.toLowerCase() === 'ready' ? 'Đã dỡ cầu cảng' : 'Chờ tiếp nhận',
            suggestedPosition: t.toLocation || 'R-02-01-2',
            blockCode: t.blockCode || 'R',
            taskCode: t.taskCode
          }))

        setIncomingContainers(pendingFromDb)
      }
    } catch (err) {
      console.warn('Error loading live tasks:', err)
    } finally {
      setLoadingTasks(false)
    }
  }

  // Load Inbound Vessel Discharge Plans from Backend (.NET)
  const loadDischargePlans = async (keepSelection = true) => {
    try {
      setLoadingPlans(true)
      const data = await yardDischargeService.getPlans()
      if (Array.isArray(data)) {
        setDischargePlans(data)
        if (data.length > 0) {
          setSelectedPlanId(prev => (keepSelection && prev && data.some(p => p.manifestId === prev) ? prev : data[0].manifestId))
        }
      }
    } catch (err) {
      console.warn('Error loading discharge plans:', err)
    } finally {
      setLoadingPlans(false)
    }
  }

  const [yardResVersion, setYardResVersion] = useState(0)

  // Pre-allocation algorithm execution
  const handlePreAllocate = async (manifestId) => {
    if (!manifestId) return
    try {
      setIsPreAllocating(true)
      const updatedPlan = await yardDischargeService.preAllocate(manifestId)

      // Đồng bộ 4 bên: Sơ Đồ Bãi Tiên Sa + Danh Sách Container Theo Ngày & Chuyến Tàu + Lịch Tài Xế Transport
      if (updatedPlan?.containers && Array.isArray(updatedPlan.containers)) {
        for (const c of updatedPlan.containers) {
          if (c.reservedSlot) {
            await manifestPortSyncService.syncYardSlotAcrossAll({
              containerNumber: c.containerNumber,
              manifestId,
              newSlotCoordinate: c.reservedSlot,
              reason: c.allocationReason || 'Thuật toán Smart Yard Pre-Allocation tự động phân bổ',
              status: c.dischargeStatus === 'IN_YARD' ? 'in_yard' : 'reserved',
              vesselName: updatedPlan.vesselName,
              voyageNumber: updatedPlan.voyageNumber,
            })
          }
        }
      }

      showToast(`Thuật toán phân bổ bãi thành công! Đã đồng bộ ${updatedPlan.allocatedCount} container sang Sơ Đồ Bãi, Danh Sách Theo Ngày & Lịch Tài Xế.`)
      await loadDischargePlans()
      await loadLiveTasks()
      setYardResVersion(v => v + 1)
    } catch (err) {
      console.error('Pre-allocate error:', err)
      const msg = err.response?.data?.message || err.message || 'Lỗi khi chạy thuật toán đặt chỗ!'
      showToast(`Lỗi: ${msg}`)
    } finally {
      setIsPreAllocating(false)
    }
  }

  // Handle Tally Scan
  const handleTallyScan = async () => {
    if (!tallyContainerInput.trim()) {
      showToast('Vui lòng nhập hoặc quét số container!')
      return
    }
    try {
      setTallyScanning(true)
      setTallyScanResult(null)
      const result = await yardDischargeService.tallyScan({
        containerNumber: tallyContainerInput.trim().toUpperCase(),
        condition: tallyCondition,
        notes: tallyNotes,
        damagePhotos: tallyDamagePhotos,
        confirmPutdown: false
      })
      setTallyScanResult(result)
      if (result.isMatch) {
        const photoMsg = tallyDamagePhotos.length > 0 ? ` (Đã đính kèm ${tallyDamagePhotos.length} ảnh EIR)` : ''
        showToast(`Đối chiếu thành công: Container ${result.containerNumber} thuộc tàu ${result.vesselName || ''}! Vị trí đặt trước: ${result.reservedSlot || 'Chưa gán'}${photoMsg}`)
        
        // Đồng bộ vị trí đặt trước đã đối soát sang Sơ đồ bãi & Danh sách theo ngày
        if (result.reservedSlot) {
          manifestPortSyncService.syncYardSlotAcrossAll({
            containerNumber: result.containerNumber,
            manifestId: result.manifestId || selectedPlanId,
            newSlotCoordinate: result.reservedSlot,
            reason: result.allocationReason || 'Đối chiếu khớp Manifest Tally cầu cảng',
            vesselName: result.vesselName || activePlan?.vesselName,
            voyageNumber: result.voyageNumber || activePlan?.voyageNumber,
          }).catch(e => console.warn('Sync on tally scan warning:', e))
        }
      } else {
        showToast(`CẢNH BÁO: Container không có trong Manifest nhập! Đã gán khu cách ly bãi tạm BUFFER-S01.`)
      }
      await loadDischargePlans()
    } catch (err) {
      console.error('Tally scan error:', err)
      showToast(`Lỗi quét Tally: ${err.response?.data?.message || err.message}`)
    } finally {
      setTallyScanning(false)
    }
  }

  // Handle Confirm RTG Putdown
  const handleConfirmPutdown = async (containerNumber) => {
    try {
      setTallyConfirming(true)
      const result = await yardDischargeService.tallyScan({
        containerNumber,
        confirmPutdown: true
      })
      showToast(result.message || `Đã xác nhận hạ bãi container ${containerNumber}!`)
      setTallyScanResult(result)

      // Đồng bộ 4 bên: Sơ Đồ Bãi Tiên Sa + Danh Sách Container Theo Ngày & Chuyến Tàu + Lịch Tài Xế
      if (result.reservedSlot) {
        await manifestPortSyncService.syncYardSlotAcrossAll({
          containerNumber,
          manifestId: result.manifestId || selectedPlanId,
          newSlotCoordinate: result.reservedSlot,
          reason: 'Xác nhận RTG hạ bãi an toàn (IN YARD)',
          status: 'in_yard',
          vesselName: result.vesselName || activePlan?.vesselName,
          voyageNumber: result.voyageNumber || activePlan?.voyageNumber,
        })
      }

      await loadDischargePlans()
      await loadLiveTasks()
    } catch (err) {
      console.error('Confirm putdown error:', err)
      showToast(`Lỗi xác nhận hạ bãi: ${err.response?.data?.message || err.message}`)
    } finally {
      setTallyConfirming(false)
    }
  }

  // Handle Manual Override Slot - Đồng bộ 4 bên tuyệt đối
  const handleOverrideSubmit = async (e) => {
    e.preventDefault()
    if (!overrideContainer || !overrideNewSlot.trim() || !overrideReason.trim()) {
      showToast('Vui lòng nhập vị trí mới và lý do ghi đè!')
      return
    }
    try {
      setOverrideSubmitting(true)
      const coordinate = overrideNewSlot.trim().toUpperCase()

      // Đồng bộ 4 bên: Smart Yard Pre-Allocation + Danh Sách Container Theo Ngày & Chuyến Tàu + Sơ Đồ Bãi + Lịch Tài Xế Đã Gửi Cho Transport
      await manifestPortSyncService.syncYardSlotAcrossAll({
        containerNumber: overrideContainer.containerNumber,
        manifestId: selectedPlanId,
        newSlotCoordinate: coordinate,
        reason: overrideReason.trim(),
        vesselName: activePlan?.vesselName,
        voyageNumber: activePlan?.voyageNumber,
      })

      showToast(`Đã đồng bộ vị trí container ${overrideContainer.containerNumber} sang ô ${coordinate} cho cả 3 bên và lịch tài xế!`)
      setOverrideModalOpen(false)
      setOverrideContainer(null)
      setOverrideNewSlot('')
      setOverrideReason('')
      await loadDischargePlans()
      await loadLiveTasks()
      setYardResVersion(v => v + 1)
    } catch (err) {
      console.error('Override slot error:', err)
      showToast(`Lỗi ghi đè vị trí: ${err.response?.data?.message || err.message}`)
    } finally {
      setOverrideSubmitting(false)
    }
  }

  // Initial load & real-time sync across all 3 sides
  useEffect(() => {
    loadLiveTasks()
    loadDischargePlans()

    const handleSync = () => {
      setYardResVersion(v => v + 1)
      loadLiveTasks()
    }
    window.addEventListener('yard-reservation-updated', handleSync)
    window.addEventListener('nexusport:manifest_synced', handleSync)
    window.addEventListener('storage', handleSync)
    return () => {
      window.removeEventListener('yard-reservation-updated', handleSync)
      window.removeEventListener('nexusport:manifest_synced', handleSync)
      window.removeEventListener('storage', handleSync)
    }
  }, [])

  const showToast = (msg) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(''), 4000)
  }

  // Dynamic KPI counts
  const totalInYard = yardTasks.filter(t => t.status?.toLowerCase() === 'completed').length + 16
  const maxCapacity = 150
  const capacityPercent = Math.min(100, Math.round((totalInYard / maxCapacity) * 100))
  const uninspectedCount = yardTasks.filter(t => !t.receivedAt).length
  const assignedCount = yardTasks.filter(t => t.status?.toLowerCase() === 'assigned').length
  const readyCount = yardTasks.filter(t => t.status?.toLowerCase() === 'ready').length
  const inProgressCount = yardTasks.filter(t => t.status?.toLowerCase() === 'in_progress').length
  const completedCount = yardTasks.filter(t => t.status?.toLowerCase() === 'completed').length

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  // Dynamic list of Block codes from real database tasks
  const availableBlocks = ['ALL', ...Array.from(new Set(yardTasks.map(t => t.blockCode?.toUpperCase()).filter(Boolean))).sort()]

  // Filtered tasks logic
  const filteredTasks = yardTasks.filter(task => {
    if (selectedBlockFilter !== 'ALL' && task.blockCode?.toUpperCase() !== selectedBlockFilter) {
      return false
    }
    if (taskStatusTab !== 'ALL' && task.status?.toLowerCase() !== taskStatusTab.toLowerCase()) {
      return false
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      const matchCode = task.taskCode?.toLowerCase().includes(q)
      const matchCont = task.containerNo?.toLowerCase().includes(q)
      const matchPlate = task.vehiclePlate?.toLowerCase().includes(q)
      const matchDriver = task.driverName?.toLowerCase().includes(q)
      if (!matchCode && !matchCont && !matchPlate && !matchDriver) return false
    }
    return true
  })

  const totalPages = Math.max(1, Math.ceil(filteredTasks.length / pageSize))
  const paginatedTasks = filteredTasks.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  // Reset to page 1 on filter changes
  const handleBlockFilterChange = (val) => {
    setSelectedBlockFilter(val)
    setCurrentPage(1)
  }

  const handleStatusTabChange = (val) => {
    setTaskStatusTab(val)
    setCurrentPage(1)
  }

  const handleSearchChange = (val) => {
    setSearchQuery(val)
    setCurrentPage(1)
  }

  // Handle NXP-055: Open Receiving & Inspection Modal
  const handleOpenReceiveModal = (containerOrTask) => {
    if (containerOrTask.taskCode) {
      setSelectedTaskToReceive(containerOrTask)
    } else {
      const matched = yardTasks.find(t => t.containerNo?.toLowerCase() === containerOrTask.id?.toLowerCase())
      setSelectedTaskToReceive(matched || {
        containerNo: containerOrTask.id,
        blockCode: containerOrTask.blockCode || 'A01',
        toLocation: containerOrTask.suggestedPosition || 'A01-05-02-3',
        expectedSealNo: containerOrTask.seal || 'SEAL-889922'
      })
    }
    setReceivingModalOpen(true)
  }

  // Handle NXP-060 STEP 1: Start Lift
  const handleStartLift = async (task) => {
    setOperatingTaskId(task.id)
    try {
      const payload = {
        notes: `Cần thủ ${task.operatorName || 'hiện trường'} bắt đầu cẩu container ${task.containerNo}`
      }
      const res = await yardTaskService.startLift(task.id, payload)
      showToast(`Đã bắt đầu cẩu container ${task.containerNo} (Task ${task.taskCode}).`)
      
      setYardTasks(prev => prev.map(t => t.id === task.id ? {
        ...t,
        status: 'In_Progress',
        startTime: res.data?.startTime || new Date().toISOString(),
        notes: res.data?.notes || t.notes
      } : t))
    } catch (err) {
      console.error('Start lift error:', err)
      const msg = err.response?.data?.message || err.message || 'Lỗi khi bắt đầu cẩu!'
      showToast(`Lỗi: ${msg}`)
    } finally {
      setOperatingTaskId(null)
    }
  }

  // Handle NXP-060 STEP 3: Open Complete Lift Modal
  const handleOpenCompleteLift = (task) => {
    setSelectedTaskToCompleteLift(task)
    setCompleteLiftModalOpen(true)
  }

  // Active Manifest & Discharge Plan computation
  const activePlan = dischargePlans.find(p => p.manifestId === selectedPlanId) || dischargePlans[0] || null

  // Dynamic AI Positioning Recommendations from active manifest (Đồng bộ với Sơ Đồ Bãi & Pre-Allocation)
  const dynamicPositioning = (activePlan?.containers || []).map(c => {
    const cKey = (c.containerNumber || '').trim().toUpperCase()
    const storeRes = yardReservationStore.getReservations().find(r => (r.containerNo || r.containerId || '').trim().toUpperCase() === cKey)
    const resolvedSlot = (storeRes && storeRes.blockCode)
      ? `${storeRes.blockCode}-${String(storeRes.bay).padStart(2, '0')}-${String(storeRes.row).padStart(2, '0')}-${storeRes.tier}`
      : c.reservedSlot
    if (!resolvedSlot) return null
    return {
      id: c.containerNumber,
      type: c.isoType || (c.isReefer ? '40FT RF' : '40FT HC'),
      weight: `${Number(c.grossWeightKg || 0).toLocaleString()} KG`,
      cargoType: c.isReefer ? 'Hàng Lạnh (Reefer)' : 'Hàng Khô Nhập Khẩu',
      departure: `Tàu ${activePlan.vesselName} (Bến ${activePlan.berthCode || 'B-01'})`,
      aiSuggestedPos: resolvedSlot,
      blockCode: resolvedSlot.split('-')[0] || 'R',
      reasoning: c.allocationReason || `Điểm tối ưu: ${c.allocationScore || 90}đ`,
      score: c.allocationScore || 90,
      container: { ...c, reservedSlot: resolvedSlot }
    }
  }).filter(Boolean)

  const displayPositioning = dynamicPositioning.length > 0 ? dynamicPositioning : positioningTasks

  return (
    <div className="p-4 md:p-6 lg:p-8 w-full font-sans flex flex-col gap-5 bg-slate-50/60 min-h-screen text-slate-800">

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl text-xs font-semibold flex items-center gap-3 z-[100] border border-slate-700 animate-in fade-in slide-in-from-top-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 flex-shrink-0 animate-pulse"></span>
          <span className="text-white font-medium leading-tight">{toastMessage}</span>
        </div>
      )}

      {/* ── 1. HEADER (Bố cục chuẩn Enterprise hiện đại) ── */}
      <header className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden border-t-4 border-t-indigo-600 bg-gradient-to-r from-white via-white to-indigo-50/20">
        <div>
          <div className="flex items-center gap-2 mb-1.5 text-xs text-slate-500 font-medium">
            <span className="flex items-center gap-1 text-slate-500">
              <span className="material-symbols-outlined text-sm text-indigo-500">grid_view</span>
              Quản Lý Bãi Container
            </span>
            <span className="text-slate-300">/</span>
            <span className="text-indigo-800 font-semibold bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200/60">
              Điều Hành Tác Nghiệp Hiện Trường
            </span>
          </div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <span>Bảng Điều Hành Khai Thác Bãi</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Quy trình khép kín: Nhận lệnh Dispatcher → Gán cẩu RTG → Đối soát Seal → Nâng hạ container bãi.
          </p>
        </div>

        {/* Right Side: Metadata & Refresh Action */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Shift info */}
          <div className="px-3 py-1.5 bg-teal-50/80 border border-teal-200/80 rounded-xl text-xs font-semibold text-teal-900 flex items-center gap-1.5 shadow-2xs">
            <span className="material-symbols-outlined text-sm text-teal-600">schedule</span>
            <span>{activeShift}</span>
          </div>

          {/* Date info */}
          <div className="px-3 py-1.5 bg-blue-50/80 border border-blue-200/80 rounded-xl text-xs font-semibold text-blue-900 flex items-center gap-1.5 shadow-2xs">
            <span className="material-symbols-outlined text-sm text-blue-600">calendar_today</span>
            <span className="font-mono">{todayDate}</span>
          </div>

          {/* Operator Profile */}
          <div className="px-3 py-1.5 bg-violet-50/80 border border-violet-200/80 rounded-xl text-xs flex items-center gap-1.5 text-violet-900 font-medium shadow-2xs">
            <span className="material-symbols-outlined text-sm text-violet-600">person</span>
            <span className="font-bold">Phạm Bãi Hàng</span>
            <span className="text-[11px] text-violet-600/80 font-normal">(Yard Staff)</span>
          </div>
        </div>
      </header>

      {/* ── 2. KPI METRICS (5 Thẻ chỉ số sắc nét, màu sắc hài hòa) ── */}
      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        
        {/* Card 1: Total Yard Occupancy */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 border-t-4 border-t-blue-600 shadow-xs flex flex-col justify-between hover:shadow-md hover:border-slate-300 transition-all bg-gradient-to-b from-blue-50/20 to-white">
          <div className="flex justify-between items-start">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Tồn Bãi Khai Thác</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200/70 flex items-center justify-center text-blue-600">
              <span className="material-symbols-outlined text-base">grid_view</span>
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-2xl font-bold font-mono text-blue-950 tracking-tight">
              {totalInYard.toLocaleString()} <span className="text-xs font-normal text-slate-400 font-sans">TEU</span>
            </div>
            <div className="mt-2 space-y-1">
              <div className="flex justify-between text-[11px] text-slate-500">
                <span>Dung lượng</span>
                <span className="font-bold text-blue-700">{capacityPercent}%</span>
              </div>
              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full" style={{ width: `${capacityPercent}%` }}></div>
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Pending Inspection (NXP-055) */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 border-t-4 border-t-amber-500 shadow-xs flex flex-col justify-between hover:shadow-md hover:border-slate-300 transition-all bg-gradient-to-b from-amber-50/20 to-white">
          <div className="flex justify-between items-start">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Chờ Đối Soát & Nhận</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200/70 flex items-center justify-center text-amber-700">
              <span className="material-symbols-outlined text-base">qr_code_scanner</span>
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-2xl font-bold font-mono text-amber-950 tracking-tight">
              {uninspectedCount} <span className="text-xs font-normal text-slate-400 font-sans">Cont</span>
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-[11px] text-amber-800 font-medium">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
              <span>Chờ quét mã & đối soát seal</span>
            </div>
          </div>
        </div>

        {/* Card 3: Ready for Lift (NXP-056) */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 border-t-4 border-t-sky-500 shadow-xs flex flex-col justify-between hover:shadow-md hover:border-slate-300 transition-all bg-gradient-to-b from-sky-50/20 to-white">
          <div className="flex justify-between items-start">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Sẵn Sàng Cẩu</span>
            <div className="w-8 h-8 rounded-lg bg-sky-50 border border-sky-200/70 flex items-center justify-center text-sky-700">
              <span className="material-symbols-outlined text-base">forklift</span>
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-2xl font-bold font-mono text-sky-950 tracking-tight">
              {readyCount} <span className="text-xs font-normal text-slate-400 font-sans">Task</span>
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-[11px] text-sky-800 font-medium">
              <span className="w-2 h-2 rounded-full bg-sky-500"></span>
              <span>Đã chỉ định cẩu & cần thủ</span>
            </div>
          </div>
        </div>

        {/* Card 4: In Progress Lift (NXP-060) */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 border-t-4 border-t-orange-500 shadow-xs flex flex-col justify-between hover:shadow-md hover:border-slate-300 transition-all bg-gradient-to-b from-orange-50/20 to-white">
          <div className="flex justify-between items-start">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Đang Cẩu Nâng Hạ</span>
            <div className="w-8 h-8 rounded-lg bg-orange-50 border border-orange-200/70 flex items-center justify-center text-orange-700">
              <span className="material-symbols-outlined text-base">precision_manufacturing</span>
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-2xl font-bold font-mono text-orange-950 tracking-tight">
              {inProgressCount} <span className="text-xs font-normal text-slate-400 font-sans">Task</span>
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-[11px] text-orange-800 font-medium">
              <span className="w-2 h-2 rounded-full bg-orange-500 animate-ping"></span>
              <span>Cần thủ đang tác nghiệp</span>
            </div>
          </div>
        </div>

        {/* Card 5: Completed */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 border-t-4 border-t-emerald-500 shadow-xs flex flex-col justify-between hover:shadow-md hover:border-slate-300 transition-all col-span-2 sm:col-span-1 bg-gradient-to-b from-emerald-50/20 to-white">
          <div className="flex justify-between items-start">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Hoàn Tất Trong Ca</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200/70 flex items-center justify-center text-emerald-700">
              <span className="material-symbols-outlined text-base">task_alt</span>
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-2xl font-bold font-mono text-emerald-950 tracking-tight">
              {completedCount} <span className="text-xs font-normal text-slate-400 font-sans">Task</span>
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-[11px] text-emerald-800 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>Đã hạ bãi an toàn</span>
            </div>
          </div>
        </div>

      </section>

      {/* ── 2.5 KẾ HOẠCH DỠ TÀU NHẬP KHẨU & PHÂN BỔ BÃI THÔNG MINH (INBOUND VESSEL DISCHARGE) ── */}
      <section className="bg-white rounded-2xl border border-indigo-200/80 p-5 shadow-xs flex flex-col gap-4 relative overflow-hidden bg-gradient-to-r from-white via-indigo-50/10 to-blue-50/20">
        
        {/* Section Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="flex items-center gap-1 text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200/70 px-2 py-0.5 rounded-md">
                <span className="material-symbols-outlined text-xs">directions_boat</span>
                Kế Hoạch Dỡ Hàng Chiều Nhập (Inbound Manifest)
              </span>
              <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Port Approved
              </span>
            </div>
            <h2 className="text-base md:text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <span>Điều Phối Dỡ Tàu & Đặt Chỗ Trước (Smart Yard Pre-Allocation)</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Thuật toán tự động đặt trước vị trí bãi tối ưu theo Manifest đã duyệt, đối soát Tally cầu cảng & ghi nhận hạ bãi.
            </p>
          </div>

          {/* Controls: Manifest Selector & Actions */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Manifest Select */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl shadow-2xs">
              <span className="material-symbols-outlined text-sm text-slate-500">directions_boat</span>
              <select
                value={selectedPlanId}
                onChange={e => setSelectedPlanId(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer pr-2"
              >
                {dischargePlans.length === 0 ? (
                  <option value="">Không có tàu nhập nào đã duyệt</option>
                ) : (
                  dischargePlans.map(p => (
                    <option key={p.manifestId} value={p.manifestId}>
                      🚢 {p.vesselName} ({p.voyageNumber}) - {p.totalContainers} Cont (Bến {p.berthCode})
                    </option>
                  ))
                )}
              </select>
            </div>

            {/* Run Pre-allocation button */}
            <button
              onClick={() => handlePreAllocate(activePlan?.manifestId)}
              disabled={isPreAllocating || !activePlan}
              className="px-3.5 py-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs active:scale-[0.98] disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
            >
              {isPreAllocating ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin"></span>
                  <span>Đang tính toán phân bổ...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-sm">auto_awesome</span>
                  <span>⚡ Phân Bổ Bãi Tự Động</span>
                </>
              )}
            </button>

            {/* Tally Scan Button */}
            <button
              onClick={() => {
                setTallyContainerInput('')
                setTallyCondition('GOOD')
                setTallyNotes('')
                setTallyDamagePhotos([])
                setTallyScanResult(null)
                setTallyModalOpen(true)
              }}
              className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition-all shadow-xs active:scale-[0.98] flex items-center gap-1.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm text-amber-300">qr_code_scanner</span>
              <span>Quét Tally Cầu Cảng</span>
            </button>

            {/* Refresh */}
            <button
              onClick={() => loadDischargePlans()}
              disabled={loadingPlans}
              title="Làm mới kế hoạch dỡ tàu"
              className="p-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-slate-600 transition-colors cursor-pointer"
            >
              <span className={`material-symbols-outlined text-sm ${loadingPlans ? 'animate-spin' : ''}`}>sync</span>
            </button>
          </div>
        </div>

        {/* Vessel Discharge Quick KPI Bar */}
        {activePlan && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/80">
            <div className="flex flex-col">
              <span className="text-[10px] uppercase font-bold text-slate-500">Tàu & Chuyến</span>
              <span className="text-xs font-mono font-bold text-slate-900 mt-0.5">
                {activePlan.vesselName} ({activePlan.voyageNumber})
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] uppercase font-bold text-slate-500">Tổng Số Container</span>
              <span className="text-xs font-mono font-bold text-blue-900 mt-0.5">
                {activePlan.totalContainers} Cont ({activePlan.reeferCount} lạnh)
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] uppercase font-bold text-slate-500">Trạng Thái Đặt Chỗ</span>
              <span className="text-xs font-mono font-bold text-indigo-900 mt-0.5 flex items-center gap-1">
                {activePlan.isPreAllocated ? (
                  <>
                    <span className="text-emerald-700">{activePlan.allocatedCount} / {activePlan.totalContainers} (Đã chốt)</span>
                    <span className="material-symbols-outlined text-xs text-emerald-600">check_circle</span>
                  </>
                ) : (
                  <span className="text-amber-700">Tập kết tạm Khu A (chờ phân bổ)</span>
                )}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] uppercase font-bold text-slate-500">Đã Dỡ Cầu Cảng</span>
              <span className="text-xs font-mono font-bold text-amber-800 mt-0.5">
                {activePlan.dischargedCount} Cont
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] uppercase font-bold text-slate-500">Đã Hạ Bãi An Toàn</span>
              <span className="text-xs font-mono font-bold text-emerald-800 mt-0.5">
                {activePlan.inYardCount} Cont
              </span>
            </div>
          </div>
        )}

        {/* Quy trình kiểm soát dỡ tàu & Đặt chỗ bãi */}
        {activePlan && (
          <div className={`p-3 rounded-xl border flex items-center gap-3 text-xs ${
            !activePlan.isPreAllocated 
              ? 'bg-amber-50/90 border-amber-200 text-amber-900' 
              : 'bg-emerald-50/90 border-emerald-200 text-emerald-900'
          }`}>
            <span className={`material-symbols-outlined text-lg ${!activePlan.isPreAllocated ? 'text-amber-600' : 'text-emerald-600'}`}>
              {!activePlan.isPreAllocated ? 'pending_actions' : 'verified'}
            </span>
            <div className="flex-1 leading-relaxed">
              {!activePlan.isPreAllocated ? (
                <span>
                  <strong>Giai đoạn dỡ tàu &amp; đối soát:</strong> Container dỡ từ tàu đang được <strong>tập kết tạm thời tại Khu A (Block A01)</strong> để nhân viên kiểm tra Tally &amp; số niêm chì (Seal). Sau khi kiểm tra xong, bấm <strong>⚡ Phân Bổ Bãi Tự Động</strong> để thuật toán xếp container về bãi tối ưu (Cont lạnh về D01, cont thường về B) và <strong>chốt vị trí chuẩn toàn bài</strong> (đồng bộ sang Booking &amp; Sơ đồ bãi).
                </span>
              ) : (
                <span>
                  <strong>Đã hoàn thành phân bổ bãi &amp; Chốt toàn bài:</strong> Toàn bộ container đã được chuyển từ Khu A về vị trí tối ưu chuyên dụng (Cont lạnh Block D01 trạm điện, cont xuất khẩu sát Cổng Gate Block F/E, cont nhập gần biển Block B) và chốt chính thức xuyên suốt hệ thống (Sơ đồ bãi, Danh sách theo ngày, Đơn ePort).
                </span>
              )}
            </div>
            {!activePlan.isPreAllocated && (
              <button
                onClick={() => handlePreAllocate(activePlan?.manifestId)}
                disabled={isPreAllocating}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-xs shadow-2xs cursor-pointer flex items-center gap-1 shrink-0"
              >
                <span className="material-symbols-outlined text-xs">bolt</span>
                <span>Phân Bổ Bãi Ngay</span>
              </button>
            )}
          </div>
        )}

        {/* Containers in Manifest Table */}
        {activePlan && (
          <div className="overflow-x-auto rounded-xl border border-slate-200/80 shadow-2xs">
            <table className="w-full text-left text-xs border-collapse min-w-[950px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/90 text-slate-500 font-semibold uppercase text-[10px] tracking-wider whitespace-nowrap">
                  <th className="py-2.5 px-3.5">Số Container & Loại</th>
                  <th className="py-2.5 px-3.5">Vận Đơn (B/L) & Chủ Hàng</th>
                  <th className="py-2.5 px-3.5">Trọng Lượng</th>
                  <th className="py-2.5 px-3.5">Vị Trí Đặt Trước (Reserved Slot)</th>
                  <th className="py-2.5 px-3.5">Lý Do Phân Bổ (Explainability)</th>
                  <th className="py-2.5 px-3.5 text-center">Trạng Thái Dỡ</th>
                  <th className="py-2.5 px-3.5 text-right">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {(!activePlan.containers || activePlan.containers.length === 0) ? (
                  <tr>
                    <td colSpan="7" className="py-8 text-center text-slate-400 text-xs">
                      Không có container nào trong manifest này.
                    </td>
                  </tr>
                ) : (
                  activePlan.containers.map((c, idx) => {
                    const cKey = (c.containerNumber || '').trim().toUpperCase()
                    const storeRes = yardReservationStore.getReservations().find(r => (r.containerNo || r.containerId || '').trim().toUpperCase() === cKey)
                    const resolvedSlot = (storeRes && storeRes.blockCode)
                      ? `${storeRes.blockCode}-${String(storeRes.bay).padStart(2, '0')}-${String(storeRes.row).padStart(2, '0')}-${storeRes.tier}`
                      : c.reservedSlot
                    const isAllocated = !!resolvedSlot
                    const isDischarged = c.dischargeStatus === 'DISCHARGED'
                    const isInYard = c.dischargeStatus === 'IN_YARD'
                    const isA01Buffer = (resolvedSlot && resolvedSlot.startsWith('A01')) || (!c.isPreAllocated && !activePlan.isPreAllocated)

                    return (
                      <tr key={`${c.containerNumber || 'cont'}-${c.blNumber || ''}-${idx}`} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-3.5">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 text-xs">
                              {c.containerNumber}
                            </span>
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                              {c.isoType || '40HC'}
                            </span>
                            {c.isReefer && (
                              <span className="text-[10px] font-semibold text-sky-700 bg-sky-50 border border-sky-200 px-1.5 py-0.2 rounded flex items-center gap-0.5">
                                <span className="material-symbols-outlined text-[11px] text-sky-600">ac_unit</span>
                                Reefer
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            <span className="text-[10px] text-slate-500 font-mono">
                              Seal: {c.sealNumber || 'N/A'}
                            </span>
                            {c.condition === 'DAMAGED' && (
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                Vỏ hỏng
                              </span>
                            )}
                            {c.condition === 'SEAL_BROKEN' && (
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                Mất/Sai seal
                              </span>
                            )}
                            {c.damagePhotos && c.damagePhotos.length > 0 && (
                              <button
                                type="button"
                                onClick={() => setPreviewImage(c.damagePhotos[0])}
                                className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition-colors flex items-center gap-0.5 cursor-pointer"
                                title="Xem ảnh tổn thất EIR"
                              >
                                <span className="material-symbols-outlined text-[11px]">photo_camera</span>
                                <span>{c.damagePhotos.length} ảnh</span>
                              </button>
                            )}
                          </div>
                        </td>

                        <td className="py-3 px-3.5">
                          <div className="font-mono font-semibold text-slate-800 text-[11px]">
                            {c.blNumber || 'N/A'}
                          </div>
                          <div className="text-[11px] text-slate-500 truncate max-w-[160px]">
                            {c.consignee || 'Chưa định danh'}
                          </div>
                        </td>

                        <td className="py-3 px-3.5 font-mono text-slate-700">
                          {Number(c.grossWeightKg || 0).toLocaleString()} kg
                        </td>

                        <td className="py-3 px-3.5">
                          {isAllocated ? (
                            <div className="flex items-center gap-1.5">
                              <span className={`font-mono font-bold px-2 py-0.5 rounded-md text-xs shadow-2xs border ${
                                isA01Buffer 
                                  ? 'text-amber-900 bg-amber-50 border-amber-200' 
                                  : 'text-indigo-900 bg-indigo-50 border-indigo-200'
                              }`}>
                                {resolvedSlot}
                              </span>
                              {isA01Buffer ? (
                                <span className="text-[10px] font-semibold text-amber-700 bg-amber-100/70 border border-amber-200 px-1.5 py-0.2 rounded" title="Khu tập kết tạm chờ kiểm tra">
                                  📍 Tạm Khu A
                                </span>
                              ) : (
                                <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded">
                                  ✅ {c.allocationScore || 95}đ
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">
                              Chưa đặt chỗ
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-3.5 max-w-[280px]">
                          {c.allocationReason ? (
                            <p className="text-[11px] text-slate-600 leading-tight line-clamp-2 bg-slate-50 p-1.5 rounded border border-slate-200/70" title={c.allocationReason}>
                              {c.allocationReason}
                            </p>
                          ) : (
                            <span className="text-[11px] text-slate-400">-</span>
                          )}
                        </td>

                        <td className="py-3 px-3.5 text-center">
                          {isInYard ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                              <span className="material-symbols-outlined text-xs text-emerald-600">task_alt</span>
                              IN YARD
                            </span>
                          ) : isDischarged ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                              DISCHARGED
                            </span>
                          ) : isAllocated ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-800 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
                              RESERVED
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
                              PLANNED
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {!isInYard && (
                              <button
                                onClick={() => {
                                  setTallyContainerInput(c.containerNumber)
                                  setTallyCondition(c.condition || 'GOOD')
                                  setTallyNotes(c.inspectionNotes || '')
                                  setTallyDamagePhotos(c.damagePhotos || [])
                                  setTallyScanResult(null)
                                  setTallyModalOpen(true)
                                }}
                                title="Quét đối soát Tally cầu cảng"
                                className="px-2 py-1 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-lg text-[11px] font-medium transition-all shadow-2xs flex items-center gap-1 cursor-pointer"
                              >
                                <span className="material-symbols-outlined text-xs text-indigo-600">qr_code_scanner</span>
                                <span>Tally</span>
                              </button>
                            )}

                            {isDischarged && !isInYard && (
                              <button
                                onClick={() => handleConfirmPutdown(c.containerNumber)}
                                disabled={tallyConfirming}
                                title="Xác nhận RTG đã hạ bãi an toàn"
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-semibold transition-all shadow-xs flex items-center gap-1 cursor-pointer"
                              >
                                <span className="material-symbols-outlined text-xs">task_alt</span>
                                <span>Hạ Bãi</span>
                              </button>
                            )}

                            {isAllocated && !isInYard && (
                              <button
                                onClick={() => {
                                  setOverrideContainer({ ...c, reservedSlot: resolvedSlot })
                                  setOverrideNewSlot(resolvedSlot || '')
                                  setOverrideReason('')
                                  setOverrideModalOpen(true)
                                }}
                                title="Điều độ viên ghi đè vị trí bãi thủ công"
                                className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-[11px] font-medium transition-all flex items-center gap-1 cursor-pointer"
                              >
                                <span className="material-symbols-outlined text-xs">edit_location</span>
                                <span>Đổi Ô</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

      </section>

      {/* ── 3. MAIN WORKSPACE (Bố cục 8 - 4 cân đối) ── */}
      <main className="grid grid-cols-1 lg:grid-cols-12 gap-5">

        {/* ── KHU VỰC CHÍNH (8/12): BẢNG QUẢN LÝ NHIỆM VỤ BÃI ── */}
        <section className="lg:col-span-8 flex flex-col gap-4">
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-5 flex flex-col gap-4">
            
            {/* Header Toolbar */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-3.5">
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-600"></span>
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  Nhiệm Vụ Khai Thác Bãi
                </h2>
                <span className="text-xs font-mono font-bold bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded-full border border-indigo-200">
                  {filteredTasks.length}
                </span>
              </div>

              {/* Block Filter Selector */}
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-500 font-medium">Khu vực (Block):</span>
                <select
                  value={selectedBlockFilter}
                  onChange={e => handleBlockFilterChange(e.target.value)}
                  className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:border-indigo-500 cursor-pointer shadow-2xs"
                >
                  {availableBlocks.map(b => (
                    <option key={b} value={b}>
                      {b === 'ALL' ? 'Tất cả Block' : `Block ${b}`}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Search & Modern Segmented Status Tabs Bar */}
            <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
              {/* Search input */}
              <div className="relative flex-1">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">
                  search
                </span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => handleSearchChange(e.target.value)}
                  placeholder="Tìm kiếm mã task, số container, biển số xe..."
                  className="w-full pl-9 pr-3 py-2 bg-slate-50/70 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors shadow-2xs"
                />
              </div>

              {/* Segmented Status Tabs */}
              <div className="flex flex-wrap gap-1 bg-slate-100/90 p-1 rounded-xl border border-slate-200/80 text-xs">
                {[
                  { key: 'ALL', label: 'Tất cả', count: yardTasks.length, activeBg: 'bg-slate-900 text-white', badgeActive: 'bg-slate-700 text-slate-200' },
                  { key: 'Assigned', label: 'Chờ gán', count: assignedCount, activeBg: 'bg-amber-500 text-white', badgeActive: 'bg-amber-600 text-amber-100' },
                  { key: 'Ready', label: 'Sẵn sàng', count: readyCount, activeBg: 'bg-sky-600 text-white', badgeActive: 'bg-sky-700 text-sky-100' },
                  { key: 'In_Progress', label: 'Đang cẩu', count: inProgressCount, activeBg: 'bg-orange-500 text-white', badgeActive: 'bg-orange-600 text-orange-100' },
                  { key: 'Completed', label: 'Xong', count: completedCount, activeBg: 'bg-emerald-600 text-white', badgeActive: 'bg-emerald-700 text-emerald-100' }
                ].map(tab => {
                  const isActive = taskStatusTab === tab.key
                  return (
                    <button
                      key={tab.key}
                      onClick={() => handleStatusTabChange(tab.key)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                        isActive
                          ? `${tab.activeBg} shadow-xs`
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                      }`}
                    >
                      <span>{tab.label}</span>
                      <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold ${
                        isActive ? tab.badgeActive : 'bg-slate-200/80 text-slate-600'
                      }`}>
                        {tab.count}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Task Table / Row List */}
            <div className="overflow-x-auto rounded-xl border border-slate-200/80 shadow-2xs">
              {filteredTasks.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs bg-slate-50/30">
                  <span className="material-symbols-outlined text-3xl text-slate-300 block mb-1.5">inbox</span>
                  Không tìm thấy nhiệm vụ nào phù hợp với điều kiện lọc.
                </div>
              ) : (
                <table className="w-full text-left text-xs border-collapse min-w-[1000px]">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/90 text-slate-500 font-semibold uppercase text-[10px] tracking-wider whitespace-nowrap">
                      <th className="py-3 px-4 min-w-[180px]">Mã Task & Loại</th>
                      <th className="py-3 px-4 min-w-[220px]">Container & Xe</th>
                      <th className="py-3 px-4 min-w-[240px]">Lộ Trình Bãi</th>
                      <th className="py-3 px-4 min-w-[190px]">Thiết Bị / Cần Thủ</th>
                      <th className="py-3 px-4 min-w-[130px] text-center">Trạng Thái</th>
                      <th className="py-3 px-4 min-w-[190px] text-right">Hành Động</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {paginatedTasks.map(task => {
                      const isAssigned = task.status?.toLowerCase() === 'assigned'
                      const isReady = task.status?.toLowerCase() === 'ready'
                      const isInProgress = task.status?.toLowerCase() === 'in_progress'
                      const isCompleted = task.status?.toLowerCase() === 'completed'
                      const isInspected = !!task.receivedAt

                      // Determine operation badge style
                      const opStr = (task.operationType || '').toLowerCase()
                      let opBadgeStyle = {
                        bg: 'bg-emerald-50 text-emerald-800 border-emerald-200/90',
                        icon: 'download'
                      }
                      if (opStr.includes('xuất') || opStr.includes('export') || opStr.includes('giao xe')) {
                        opBadgeStyle = {
                          bg: 'bg-blue-50 text-blue-800 border-blue-200/90',
                          icon: 'upload'
                        }
                      } else if (opStr.includes('đảo') || opStr.includes('chuyển') || opStr.includes('shift')) {
                        opBadgeStyle = {
                          bg: 'bg-purple-50 text-purple-800 border-purple-200/90',
                          icon: 'sync_alt'
                        }
                      }

                      return (
                        <tr
                          key={task.id}
                          className="hover:bg-slate-50/80 transition-colors group"
                        >
                          {/* Mã Task & Loại */}
                          <td className="py-3.5 px-4 align-top whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-bold text-slate-900 text-xs px-2 py-0.5 bg-slate-100/90 rounded border border-slate-200">
                                {task.taskCode}
                              </span>
                              {task.priority?.toLowerCase() === 'critical' && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping"></span>
                                  Khẩn
                                </span>
                              )}
                            </div>
                            <div className="mt-1.5 flex items-center gap-1.5">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border ${opBadgeStyle.bg}`}>
                                <span className="material-symbols-outlined text-[11px]">{opBadgeStyle.icon}</span>
                                <span>{task.operationType}</span>
                              </span>
                              {task.blockCode && (
                                <span className="font-mono font-bold text-indigo-800 bg-indigo-50 border border-indigo-200/80 px-1.5 py-0.5 rounded text-[10px]">
                                  Block {task.blockCode}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Container & Xe */}
                          <td className="py-3.5 px-4 align-top whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-bold text-sky-950 bg-sky-50 border border-sky-200/90 px-2 py-0.5 rounded text-xs shadow-2xs">
                                {task.containerNo}
                              </span>
                              <span className="text-[10px] text-slate-600 bg-slate-100 font-mono font-semibold px-1.5 py-0.5 rounded border border-slate-200/60">
                                {task.containerType || '40FT HC'}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-700 mt-1.5 flex items-center gap-1.5">
                              <span className="material-symbols-outlined text-xs text-slate-400">local_shipping</span>
                              <span className="font-mono font-semibold text-slate-800 bg-slate-50 border border-slate-200/80 px-1.5 py-0.5 rounded text-[11px]">
                                {task.vehiclePlate || 'Chưa gán xe'}
                              </span>
                              {task.driverName && (
                                <span className="text-slate-500 font-medium">({task.driverName})</span>
                              )}
                            </div>
                          </td>

                          {/* Lộ Trình Bãi */}
                          <td className="py-3.5 px-4 align-top whitespace-nowrap">
                            <div className="flex items-center gap-1.5 text-[11px]">
                              <span className="text-slate-400 font-medium">Từ:</span>
                              <span className="text-slate-700 font-medium bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200/60 font-mono">
                                {task.fromLocation || 'Cầu Tàu B-01'}
                              </span>
                              <span className="material-symbols-outlined text-xs text-slate-300">arrow_forward</span>
                              <span className="text-slate-400 font-medium">Đích:</span>
                              <span className="font-mono font-bold text-indigo-900 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded text-xs">
                                {task.completedLocation || task.toLocation || 'A01-05-02-3'}
                              </span>
                            </div>
                            <div className="mt-1.5">
                              {isInspected ? (
                                <span className="inline-flex items-center gap-1 text-[10px] text-emerald-800 bg-emerald-50 border border-emerald-200/90 px-2 py-0.5 rounded font-medium">
                                  <span className="material-symbols-outlined text-xs text-emerald-600">verified</span>
                                  <span>Seal: {task.actualSealNo || 'Đã khớp seal'}</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] text-amber-800 bg-amber-50 border border-amber-200/90 px-2 py-0.5 rounded font-medium">
                                  <span className="material-symbols-outlined text-xs text-amber-600">pending</span>
                                  <span>Chưa đối soát seal</span>
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Thiết Bị / Cần Thủ */}
                          <td className="py-3.5 px-4 align-top whitespace-nowrap">
                            {task.equipmentCode ? (
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <span className="material-symbols-outlined text-xs text-teal-600">precision_manufacturing</span>
                                  <span className="font-mono font-bold text-teal-900 bg-teal-50 border border-teal-200/90 px-2 py-0.5 rounded text-xs">
                                    {task.equipmentCode}
                                  </span>
                                  <span className="text-[10px] text-teal-700 bg-teal-50/60 font-mono px-1.5 py-0.5 rounded border border-teal-100">
                                    {task.equipmentType || 'RTG'}
                                  </span>
                                </div>
                                <div className="text-[11px] text-slate-600 mt-1 flex items-center gap-1">
                                  <span className="material-symbols-outlined text-xs text-slate-400">person</span>
                                  <span className="font-medium text-slate-700">{task.operatorName || 'Chưa gán cần thủ'}</span>
                                </div>
                              </div>
                            ) : (
                              <span className="text-[11px] text-slate-400 bg-slate-50 border border-dashed border-slate-200 px-2.5 py-1 rounded-lg italic inline-flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                                <span>Chưa chỉ định cẩu</span>
                              </span>
                            )}
                          </td>

                          {/* Trạng Thái */}
                          <td className="py-3.5 px-4 align-top text-center whitespace-nowrap">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
                              isCompleted
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : isInProgress
                                ? 'bg-orange-50 text-orange-700 border-orange-200'
                                : isReady
                                ? 'bg-blue-50 text-blue-700 border-blue-200'
                                : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${
                                isCompleted
                                  ? 'bg-emerald-500'
                                  : isInProgress
                                  ? 'bg-orange-500 animate-pulse'
                                  : isReady
                                  ? 'bg-blue-500'
                                  : 'bg-amber-500'
                              }`}></span>
                              <span>{task.status}</span>
                            </span>
                          </td>

                          {/* Hành Động Nút Bấm */}
                          <td className="py-3.5 px-4 align-top text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              {isAssigned && (
                                <>
                                  {!isInspected && (
                                    <button
                                      onClick={() => handleOpenReceiveModal(task)}
                                      title="Đối soát seal & ngoại quan container"
                                      className="px-2.5 py-1.5 bg-white hover:bg-amber-50 border border-amber-300 text-amber-800 rounded-lg text-[11px] font-semibold transition-all cursor-pointer shadow-2xs active:scale-[0.98] flex items-center gap-1"
                                    >
                                      <span className="material-symbols-outlined text-xs text-amber-600">qr_code_scanner</span>
                                      <span>Đối Soát</span>
                                    </button>
                                  )}
                                  <button
                                    onClick={() => setSelectedTaskToAssign(task)}
                                    title="Gán Cẩu RTG & Cần thủ"
                                    className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-[11px] font-medium transition-all cursor-pointer shadow-xs active:scale-[0.98] flex items-center gap-1"
                                  >
                                    <span className="material-symbols-outlined text-xs text-slate-300">forklift</span>
                                    <span>Gán Cẩu</span>
                                  </button>
                                </>
                              )}

                              {isReady && (
                                <button
                                  onClick={() => handleStartLift(task)}
                                  disabled={operatingTaskId === task.id}
                                  title="Bắt đầu nâng hạ container"
                                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1 shadow-xs active:scale-[0.98] disabled:opacity-50"
                                >
                                  <span className="material-symbols-outlined text-xs">play_arrow</span>
                                  <span>Bắt Đầu Cẩu</span>
                                </button>
                              )}

                              {isInProgress && (
                                <button
                                  onClick={() => handleOpenCompleteLift(task)}
                                  title="Xác nhận hạ bãi & giải phóng cẩu"
                                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1 shadow-xs active:scale-[0.98]"
                                >
                                  <span className="material-symbols-outlined text-xs">task_alt</span>
                                  <span>Hoàn Tất</span>
                                </button>
                              )}

                              {isCompleted && (
                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
                                  <span className="material-symbols-outlined text-xs text-emerald-600">check_circle</span>
                                  <span>Đã hạ bãi</span>
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Pagination Controls */}
            {filteredTasks.length > 0 && (
              <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-2 text-xs">
                <div className="flex items-center gap-2 text-slate-500">
                  <span>Hiển thị</span>
                  <select
                    value={pageSize}
                    onChange={e => {
                      setPageSize(Number(e.target.value))
                      setCurrentPage(1)
                    }}
                    className="pl-3 pr-8 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:border-indigo-500 cursor-pointer shadow-2xs"
                  >
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                  </select>
                  <span>nhiệm vụ / trang (Tổng <strong>{filteredTasks.length}</strong>)</span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-2.5 py-1 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded-lg text-xs font-medium disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer shadow-2xs"
                  >
                    Trang trước
                  </button>

                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNo => (
                      <button
                        key={pageNo}
                        onClick={() => setCurrentPage(pageNo)}
                        className={`w-7 h-7 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                          currentPage === pageNo
                            ? 'bg-slate-900 text-white font-bold shadow-2xs'
                            : 'bg-white hover:bg-slate-50 border border-slate-300 text-slate-700'
                        }`}
                      >
                        {pageNo}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-2.5 py-1 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded-lg text-xs font-medium disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer shadow-2xs"
                  >
                    Trang sau
                  </button>
                </div>
              </div>
            )}

          </div>
        </section>

        {/* ── KHU VỰC PHỤ (4/12): TIẾP NHẬN CONTAINER & GỢI Ý VỊ TRÍ AI ── */}
        <aside className="lg:col-span-4 flex flex-col gap-5">
          
          {/* Panel 1: Container Đang Tới Làn Bãi */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-5 flex flex-col gap-4 border-t-4 border-t-sky-500">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-sky-50 border border-sky-200/80 flex items-center justify-center text-sky-600">
                  <span className="material-symbols-outlined text-base">input</span>
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Hàng Chờ Tiếp Nhận (Làn Bãi)
                  </h3>
                  <p className="text-[11px] text-slate-500">Đối soát cont từ cầu cảng & xe kéo</p>
                </div>
              </div>
              <span className="text-xs font-mono font-bold bg-sky-50 text-sky-700 px-2.5 py-0.5 rounded-full border border-sky-200">
                {incomingContainers.length}
              </span>
            </div>

            <div className="flex flex-col gap-3">
              {incomingContainers.length === 0 ? (
                <div className="py-8 text-center text-slate-500 text-xs bg-emerald-50/40 rounded-xl border border-dashed border-emerald-200 p-4">
                  <span className="material-symbols-outlined text-3xl text-emerald-600 block mb-1">task_alt</span>
                  <p className="font-semibold text-emerald-900">Đã tiếp nhận hết các container</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Không còn container nào chờ đối soát tại làn bãi.</p>
                </div>
              ) : (
                incomingContainers.map(c => (
                <div
                  key={c.id}
                  className="p-3.5 bg-slate-50/80 border border-slate-200/90 rounded-xl flex flex-col gap-2.5 hover:border-sky-300 hover:bg-sky-50/20 transition-all shadow-2xs"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-sky-950 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded text-xs shadow-2xs">
                          {c.id}
                        </span>
                        <span className="text-[10px] text-slate-600 font-mono bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200/60 font-semibold">
                          {c.type}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-600 mt-1.5 flex items-center gap-1">
                        <span className="material-symbols-outlined text-xs text-blue-500">directions_boat</span>
                        <span className="font-medium text-slate-700">{c.vessel}</span>
                        <span className="text-[10px] bg-blue-50 text-blue-700 font-semibold px-1.5 py-0.2 rounded border border-blue-200/60">Bến {c.berth}</span>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold rounded-md">
                      {c.statusBadge}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-[11px] text-slate-600 pt-2 border-t border-slate-200/70 font-mono">
                    <span className="flex items-center gap-1">
                      <span className="text-slate-400 font-sans">Seal:</span>
                      <strong className="text-slate-800 bg-white px-1.5 py-0.5 rounded border border-slate-200 text-[11px]">{c.seal}</strong>
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="text-slate-400 font-sans">Ô hạ:</span>
                      <strong className="text-indigo-900 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 text-xs">{c.suggestedPosition}</strong>
                    </span>
                  </div>

                  <button
                    onClick={() => handleOpenReceiveModal(c)}
                    className="w-full py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-xs active:scale-[0.98]"
                  >
                    <span className="material-symbols-outlined text-xs">qr_code_scanner</span>
                    <span>Đối Soát & Nhận Cont</span>
                  </button>
                </div>
              )))}
            </div>
          </div>

          {/* Panel 2: Gợi Ý Vị Trí Bãi AI */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-5 flex flex-col gap-4 border-t-4 border-t-purple-500">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-purple-50 border border-purple-200/80 flex items-center justify-center text-purple-600">
                  <span className="material-symbols-outlined text-base">auto_awesome</span>
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Gợi Ý Vị Trí Bãi AI
                  </h3>
                  <p className="text-[11px] text-slate-500">Tối ưu hóa phân tầng & giảm đảo chuyển</p>
                </div>
              </div>
              <span className="text-[10px] font-bold bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-2.5 py-0.5 rounded-full shadow-2xs">
                AI Engine
              </span>
            </div>

            <div className="flex flex-col gap-3">
              {displayPositioning.map(pt => (
                <div
                  key={pt.id}
                  className="p-3.5 bg-slate-50/80 border border-slate-200/90 rounded-xl flex flex-col gap-2 hover:border-purple-300 hover:bg-purple-50/20 transition-all shadow-2xs"
                >
                  <div className="flex justify-between items-center">
                    <span className="font-mono font-bold text-slate-900 bg-white border border-slate-200 px-2 py-0.5 rounded text-xs">
                      {pt.id}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {pt.score && (
                        <span className="text-[10px] font-mono font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded">
                          {pt.score}đ
                        </span>
                      )}
                      <span className="font-mono font-bold text-purple-900 text-xs bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200/80 flex items-center gap-1">
                        <span className="material-symbols-outlined text-[11px] text-purple-600">location_on</span>
                        {pt.aiSuggestedPos}
                      </span>
                    </div>
                  </div>
                  <div className="text-[11px] text-slate-600 flex items-center justify-between">
                    <span className="font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-[10px]">{pt.cargoType}</span>
                    <span className="text-slate-500 text-[10px] font-mono">{pt.departure}</span>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-1 leading-relaxed bg-white p-2.5 rounded-lg border border-purple-100/80 text-justify">
                    {pt.reasoning}
                  </p>
                </div>
              ))}
            </div>
          </div>

        </aside>

      </main>

      {/* ── MODALS QUY TRÌNH ── */}

      {/* MODAL 1: Yard Receiving Modal */}
      {receivingModalOpen && (
        <YardReceivingModal
          task={selectedTaskToReceive}
          allTasks={yardTasks}
          isOpen={receivingModalOpen}
          onClose={() => {
            setReceivingModalOpen(false)
            setSelectedTaskToReceive(null)
          }}
          onSuccess={(updated) => {
            const contNo = updated?.containerNo || updated?.data?.containerNo || selectedTaskToReceive?.containerNo
            showToast(`Tiếp nhận thành công container ${contNo || ''}. Đã cập nhật vào bãi.`)
            if (contNo) {
              setIncomingContainers(prev => prev.filter(c => c.id?.toLowerCase() !== contNo.toLowerCase()))
              setYardTasks(prev => prev.map(t => {
                if (t.containerNo?.toLowerCase() === contNo.toLowerCase()) {
                  return {
                    ...t,
                    receivedAt: new Date().toISOString(),
                    actualSealNo: updated?.actualSealNo || t.actualSealNo || 'SEAL-889922'
                  }
                }
                return t
              }))
            }
            loadLiveTasks()
          }}
        />
      )}

      {/* MODAL 2: NXP-056 Assign Equipment Modal */}
      {selectedTaskToAssign && (
        <AssignEquipmentModal
          task={selectedTaskToAssign}
          isOpen={!!selectedTaskToAssign}
          onClose={() => setSelectedTaskToAssign(null)}
          onSuccess={(updatedTask) => {
            showToast(`Đã gán Cẩu ${updatedTask.equipmentCode} cho nhiệm vụ ${updatedTask.taskCode}.`)
            loadLiveTasks()
          }}
        />
      )}

      {/* MODAL 3: NXP-060 Complete Lift Modal */}
      {completeLiftModalOpen && selectedTaskToCompleteLift && (
        <CompleteLiftModal
          task={selectedTaskToCompleteLift}
          isOpen={completeLiftModalOpen}
          onClose={() => {
            setCompleteLiftModalOpen(false)
            setSelectedTaskToCompleteLift(null)
          }}
          onSuccess={(updatedTask) => {
            showToast(`Hoàn thành cẩu container ${updatedTask.containerNo}. Đã hạ bãi an toàn.`)
            loadLiveTasks()
          }}
        />
      )}

      {/* MODAL 4: Tally Quayside Scan & Exception Handling Modal (2-Column Side-by-Side Layout) */}
      {tallyModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-4xl w-full p-6 shadow-2xl border border-slate-200 flex flex-col gap-4 max-h-[92vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex justify-between items-start border-b border-slate-100 pb-3">
              <div>
                <div className="flex items-center gap-1.5 text-xs text-indigo-600 font-bold uppercase tracking-wider mb-0.5">
                  <span className="material-symbols-outlined text-sm">qr_code_scanner</span>
                  <span>Tally Quayside Scanner & Inspection</span>
                </div>
                <h3 className="text-lg font-bold text-slate-900">Quét Tally Cầu Cảng & Đối Soát Dỡ Hàng</h3>
              </div>
              <button
                onClick={() => setTallyModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            {/* Modal Body: 2 Columns Side-by-Side */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
              {/* CỘT TRÁI: Nhập Thông Tin, Giám Định Vỏ EIR & Upload Ảnh */}
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  handleTallyScan()
                }}
                className="flex flex-col gap-4 bg-slate-50/60 p-4 rounded-xl border border-slate-200/80"
              >
                <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm text-indigo-600">input</span>
                    1. Ghi Nhận Tại Cầu Cảng
                  </span>
                  <span className="text-[11px] text-slate-500 font-medium">Bước 1: Quét vỏ & EIR</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Số Container <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                      inventory_2
                    </span>
                    <input
                      type="text"
                      value={tallyContainerInput}
                      onChange={(e) => setTallyContainerInput(e.target.value.toUpperCase())}
                      placeholder="VD: NXPU9113795 hoặc quét mã..."
                      autoFocus
                      required
                      className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-mono font-bold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 transition-colors shadow-2xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Tình Trạng Ngoại Quan
                    </label>
                    <select
                      value={tallyCondition}
                      onChange={(e) => setTallyCondition(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-indigo-500 cursor-pointer shadow-2xs"
                    >
                      <option value="GOOD">Tốt / Nguyên vẹn (GOOD)</option>
                      <option value="DAMAGED">Hư hỏng / Móp méo (DAMAGED)</option>
                      <option value="SEAL_BROKEN">Mất / Đứt Seal (SEAL_BROKEN)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Ghi Chú Ngoại Quan (EIR)
                    </label>
                    <input
                      type="text"
                      value={tallyNotes}
                      onChange={(e) => setTallyNotes(e.target.value)}
                      placeholder="Ghi chú vết xước, rách seal..."
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 shadow-2xs"
                    >
                    </input>
                  </div>
                </div>

                {/* Khu vực Tải / Chụp Ảnh Hiện Trường Tổn Thất (EIR Damage Photos) */}
                <div className={`p-3 rounded-xl border transition-all ${
                  tallyCondition !== 'GOOD' 
                    ? 'bg-amber-50/80 border-amber-300' 
                    : 'bg-white border-slate-200'
                }`}>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-sm text-indigo-600">photo_camera</span>
                      <span>Ảnh Hiện Trường & Tổn Thất EIR {tallyCondition !== 'GOOD' && <span className="text-rose-500 font-bold">*</span>}</span>
                    </label>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {tallyDamagePhotos.length} ảnh
                    </span>
                  </div>

                  {tallyCondition !== 'GOOD' && (
                    <p className="text-[11px] text-amber-900 mb-2 font-medium flex items-center gap-1">
                      <span className="material-symbols-outlined text-xs text-amber-600">warning</span>
                      Vỏ có dấu hiệu hư hại: Chụp ảnh hiện trường để lập biên bản EIR gửi hãng tàu.
                    </p>
                  )}

                  {/* Upload Buttons */}
                  <div className="flex items-center gap-2">
                    <label className="flex-1 py-2 px-3 border border-dashed border-indigo-300 hover:border-indigo-500 bg-indigo-50/40 hover:bg-indigo-50/80 rounded-xl text-center text-xs font-medium text-indigo-700 cursor-pointer transition-all flex items-center justify-center gap-1.5 shadow-2xs">
                      <span className="material-symbols-outlined text-base">add_a_photo</span>
                      <span>Chụp / Thêm Ảnh Hư Hỏng</span>
                      <input
                        type="file"
                        multiple
                        accept="image/*"
                        capture="environment"
                        onChange={handlePhotoUpload}
                        className="hidden"
                      />
                    </label>
                    {tallyDamagePhotos.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setTallyDamagePhotos([])}
                        className="px-2.5 py-2 text-xs text-rose-600 hover:bg-rose-50 rounded-xl border border-rose-200 transition-colors cursor-pointer"
                      >
                        Xóa tất cả
                      </button>
                    )}
                  </div>

                  {/* Photo Previews */}
                  {tallyDamagePhotos.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2.5 pt-2 border-t border-slate-200/70">
                      {tallyDamagePhotos.map((photo, index) => (
                        <div key={index} className="relative group w-14 h-14 rounded-lg overflow-hidden border border-slate-300 shadow-2xs">
                          <img
                            src={photo}
                            alt={`damage-${index}`}
                            onClick={() => setPreviewImage(photo)}
                            className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemovePhoto(index)}
                            className="absolute top-0.5 right-0.5 bg-slate-900/80 hover:bg-rose-600 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px] opacity-80 group-hover:opacity-100 transition-opacity cursor-pointer"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={tallyScanning}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer mt-1"
                >
                  {tallyScanning ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin"></span>
                      <span>Đang đối soát Manifest...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-sm">search</span>
                      <span>Quét & Đối Soát Manifest</span>
                    </>
                  )}
                </button>
              </form>

              {/* CỘT PHẢI: Kết Quả Đối Soát & Thao Tác Hạ Bãi */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm text-emerald-600">verified</span>
                    2. Kết Quả Đối Soát & Vị Trí Bãi
                  </span>
                  <span className="text-[11px] text-slate-500 font-medium">Bước 2: Phân bổ & Hạ bãi</span>
                </div>

                {/* Khi chưa quét: Trạng thái chờ quét */}
                {!tallyScanResult && (
                  <div className="p-8 rounded-xl border border-dashed border-slate-300 bg-slate-50/50 flex flex-col items-center justify-center text-center gap-3 min-h-[300px]">
                    <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-2xs">
                      <span className="material-symbols-outlined text-3xl">forklift</span>
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-800 mb-1">Chờ Quét & Đối Soát Container</h4>
                      <p className="text-xs text-slate-500 max-w-xs leading-relaxed">
                        Nhập số container và chụp ảnh kiểm tra ngoại quan ở cột bên trái, sau đó nhấn <strong>Quét & Đối Soát Manifest</strong> để hiển thị vị trí bãi và xác nhận hạ bãi.
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-slate-600 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-2xs">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                      <span>Hệ thống phân bổ thông minh .NET Core sẵn sàng</span>
                    </div>
                  </div>
                )}

                {/* Khi đã có kết quả quét: Hiển thị Thẻ Khớp hoặc Ngoại lệ */}
                {tallyScanResult && (
                  <>
                    {tallyScanResult.isMatch ? (
                      <div className="p-4 bg-emerald-50/70 border border-emerald-300/80 rounded-xl flex flex-col gap-3 shadow-xs">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-950">
                            <span className="material-symbols-outlined text-base text-emerald-600">check_circle</span>
                            <span>Khớp Manifest: {tallyScanResult.vesselName} ({tallyScanResult.voyageNumber})</span>
                          </div>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200">
                            HỢP LỆ
                          </span>
                        </div>

                        {/* Thông tin vị trí & Container */}
                        <div className="grid grid-cols-2 gap-2 text-xs bg-white p-3 rounded-lg border border-emerald-100 shadow-2xs">
                          <div>
                            <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider block mb-0.5">Số Container:</span>
                            <div className="font-mono font-bold text-sm text-slate-900">{tallyScanResult.containerNumber}</div>
                          </div>
                          <div>
                            <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider block mb-0.5">Vị Trí Đặt Chỗ:</span>
                            <div className="font-mono font-bold text-xs text-indigo-900 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded inline-block">
                              {tallyScanResult.reservedSlot || 'Chưa phân bổ'}
                            </div>
                          </div>
                          <div>
                            <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider block mb-0.5">Vận Đơn (B/L):</span>
                            <div className="font-mono font-semibold text-slate-700">{tallyScanResult.blNumber || 'N/A'}</div>
                          </div>
                          <div>
                            <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider block mb-0.5">Điểm AI:</span>
                            <div className="font-mono font-bold text-amber-700">{tallyScanResult.allocationScore} điểm</div>
                          </div>
                        </div>

                        {tallyScanResult.allocationReason && (
                          <div className="text-[11px] text-slate-700 bg-white p-2.5 rounded-lg border border-emerald-100 leading-relaxed">
                            <span className="font-bold text-slate-900">Tiêu chí phân bổ: </span>
                            {tallyScanResult.allocationReason}
                          </div>
                        )}

                        {tallyScanResult.damagePhotos && tallyScanResult.damagePhotos.length > 0 && (
                          <div className="bg-white p-2.5 rounded-xl border border-amber-200">
                            <span className="text-[11px] font-bold text-amber-900 block mb-1.5 flex items-center gap-1">
                              <span className="material-symbols-outlined text-xs text-amber-600">photo_library</span>
                              Ảnh hiện trường tổn thất EIR ({tallyScanResult.damagePhotos.length} ảnh):
                            </span>
                            <div className="flex flex-wrap gap-2">
                              {tallyScanResult.damagePhotos.map((img, i) => (
                                <img
                                  key={i}
                                  src={img}
                                  alt="EIR Photo"
                                  onClick={() => setPreviewImage(img)}
                                  className="w-12 h-12 object-cover rounded-lg border border-slate-200 cursor-pointer hover:border-amber-500 hover:scale-105 transition-all shadow-2xs"
                                />
                              ))}
                            </div>
                          </div>
                        )}

                        {tallyScanResult.dischargeStatus === 'IN_YARD' ? (
                          <div className="flex items-center justify-center gap-1.5 py-2.5 bg-emerald-600 text-white font-bold text-xs rounded-xl shadow-xs">
                            <span className="material-symbols-outlined text-sm">task_alt</span>
                            <span>Đã Hoàn Tất Hạ Bãi (IN YARD)</span>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleConfirmPutdown(tallyScanResult.containerNumber)}
                            disabled={tallyConfirming}
                            className="w-full py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer mt-1"
                          >
                            {tallyConfirming ? (
                              <>
                                <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin"></span>
                                <span>Đang ghi nhận hạ bãi...</span>
                              </>
                            ) : (
                              <>
                                <span className="material-symbols-outlined text-sm">forklift</span>
                                <span>Xác Nhận RTG Hạ Bãi (Put-down to Yard)</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    ) : tallyScanResult.isException ? (
                      <div className="p-4 bg-rose-50/80 border border-rose-300 rounded-xl flex flex-col gap-2.5 shadow-xs">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-rose-900">
                          <span className="material-symbols-outlined text-base text-rose-600">warning</span>
                          <span>NGOẠI LỆ: CONTAINER KHÔNG CÓ TRONG MANIFEST</span>
                        </div>
                        <p className="text-xs text-rose-800 leading-relaxed">
                          {tallyScanResult.message}
                        </p>
                        <div className="flex items-center justify-between bg-white p-2.5 rounded-lg border border-rose-200 text-xs shadow-2xs">
                          <span className="text-slate-600 font-medium">Khu cách ly bãi tạm:</span>
                          <span className="font-mono font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                            {tallyScanResult.assignedBufferSlot}
                          </span>
                        </div>
                        {tallyScanResult.suggestedAction && (
                          <p className="text-[11px] text-slate-600 bg-amber-50 p-2 rounded border border-amber-200 font-medium leading-relaxed">
                            💡 <strong>Khuyến nghị:</strong> {tallyScanResult.suggestedAction}
                          </p>
                        )}
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: Manual Slot Override Modal */}
      {overrideModalOpen && overrideContainer && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 flex flex-col gap-4">
            <div className="flex justify-between items-start border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Ghi Đè Vị Trí Bãi Thủ Công</h3>
                <p className="text-xs text-slate-500">Điều chỉnh vị trí slot theo quyết định của Điều độ viên</p>
              </div>
              <button
                onClick={() => setOverrideModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <form onSubmit={handleOverrideSubmit} className="flex flex-col gap-3.5">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs flex justify-between items-center">
                <div>
                  <span className="text-slate-500 block text-[11px]">Container:</span>
                  <span className="font-mono font-bold text-slate-900">{overrideContainer.containerNumber}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">Ô hiện tại:</span>
                  <span className="font-mono font-bold text-indigo-800 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                    {overrideContainer.reservedSlot || 'Chưa gán'}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Vị Trí Mới (Block-Bay-Row-Tier) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={overrideNewSlot}
                  onChange={(e) => setOverrideNewSlot(e.target.value.toUpperCase())}
                  placeholder="VD: R-02-01-3 hoặc A01-01-01-1"
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Lý Do Đảo Chuyển / Ghi Đè <span className="text-rose-500">*</span>
                </label>
                <textarea
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="Nhập lý do nghiệp vụ (VD: Tránh cản trở cẩu, đổi theo yêu cầu chủ hàng...)"
                  required
                  rows={3}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setOverrideModalOpen(false)}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Hủy Bỏ
                </button>
                <button
                  type="submit"
                  disabled={overrideSubmitting}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {overrideSubmitting ? 'Đang lưu...' : 'Xác Nhận Đổi Ô'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 6: Lightbox Image Preview Modal */}
      {previewImage && (
        <div 
          onClick={() => setPreviewImage(null)}
          className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4 z-[999] animate-in fade-in cursor-pointer"
        >
          <div className="relative max-w-3xl max-h-[90vh] bg-slate-900 rounded-2xl overflow-hidden shadow-2xl p-3 border border-slate-800" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center px-2 py-1.5 text-white border-b border-slate-800 mb-2">
              <span className="text-xs font-semibold flex items-center gap-1.5 text-amber-300">
                <span className="material-symbols-outlined text-sm">photo</span>
                Ảnh Biên Bản Hiện Trường Ngoại Quan EIR
              </span>
              <button
                type="button"
                onClick={() => setPreviewImage(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>
            <img src={previewImage} alt="Damage Full" className="max-h-[75vh] w-auto max-w-full rounded-xl object-contain mx-auto" />
          </div>
        </div>
      )}

    </div>
  )
}
