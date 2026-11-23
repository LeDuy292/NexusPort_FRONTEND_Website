import React, { useState, useEffect, useMemo, useRef } from 'react'
import apiClient from '../../services/apiClient'
import Select from '../../components/ui/Select'
import yardTaskService from '../../services/yardTaskService'
import yardDischargeService from '../../services/yardDischargeService'
import AssignEquipmentModal from '../../components/Yard/AssignEquipmentModal'
import YardReceivingModal from '../../components/Yard/YardReceivingModal'
import CompleteLiftModal from '../../components/Yard/CompleteLiftModal'
import YardSlotReservationModal from '../../components/Yard/YardSlotReservationModal'
import YardZoneBlockSelectorModal from '../../components/Yard/YardZoneBlockSelectorModal'
import sourceLayout from '../../features/yard-design/tienSaLayout.json'
import { manifestPortSyncService, computeAutoYardSlot } from '../../services/manifestPortSyncService'
import { yardReservationStore } from '../../services/yardReservationStore'

export default function YardOperationsDashboard() {
  const [toastMessage, setToastMessage] = useState('')
  const [selectedBlockFilter, setSelectedBlockFilter] = useState('ALL')
  const [planPage, setPlanPage] = useState(1)
  const [planPageSize, setPlanPageSize] = useState(10)
  const [yardOccupancy, setYardOccupancy] = useState(null) // { used, total } từ bản đồ bãi thật
  const [taskStatusTab, setTaskStatusTab] = useState('ALL') // 'ALL' | 'Assigned' | 'Ready' | 'In_Progress' | 'Completed'
  const [searchQuery, setSearchQuery] = useState('')

  // Modals state
  const [selectedTaskToAssign, setSelectedTaskToAssign] = useState(null)
  const [receivingModalOpen, setReceivingModalOpen] = useState(false)
  const [selectedTaskToReceive, setSelectedTaskToReceive] = useState(null)
  const [completeLiftModalOpen, setCompleteLiftModalOpen] = useState(false)
  const [selectedTaskToCompleteLift, setSelectedTaskToCompleteLift] = useState(null)

  // Visual 2D Yard Slot Picker State
  const [pickerBlock, setPickerBlock] = useState(null)
  const [pickerContainer, setPickerContainer] = useState(null)

  // Sơ Đồ Phân Khu Bãi Container Tiên Sa (Zone A ➔ G & Block Selector Modal)
  const [zoneModalOpen, setZoneModalOpen] = useState(false)
  const [zoneContainer, setZoneContainer] = useState(null)
  const [zoneCurrentSlot, setZoneCurrentSlot] = useState('')

  // Bộ lọc Phân Bổ Nghiệp Vụ (AI Explainability Filter Pills)
  const [statusFilter, setStatusFilter] = useState('ALL') // ALL | PENDING | IN_YARD
  const [containerSearch, setContainerSearch] = useState('')

  const [loadingTasks, setLoadingTasks] = useState(false)
  const [operatingTaskId, setOperatingTaskId] = useState(null)

  // Inbound Vessel Discharge & Smart Yard Allocation State
  const [dischargePlans, setDischargePlans] = useState([])
  const [selectedPlanId, setSelectedPlanId] = useState('ALL')
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
            seal: t.expectedSealNo || '',
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

  // Load Inbound Vessel Discharge Plans from Backend (.NET) & Manifests
  const loadDischargePlans = async (keepSelection = true) => {
    try {
      setLoadingPlans(true)
      let data = []
      try {
        const res = await yardDischargeService.getPlans()
        if (Array.isArray(res)) data = [...res]
      } catch (err) {
        console.warn('Lỗi gọi API getPlans:', err)
      }

      // Kéo trực tiếp dữ liệu từ DB Deploy (PostgreSQL thông qua Node Core & C# Core)
      try {
        const syncedManifests = await manifestPortSyncService.fetchRemoteSyncedManifests()
        const approvedManifests = (syncedManifests || []).filter(m =>
          m.portApprovalStatus === 'PORT_APPROVED' || m.status === 'PORT_APPROVED' || m.status === 'DISCHARGING' || m.status === 'SENT_TO_PORT'
        )

        approvedManifests.forEach(m => {
          const mId = m.manifestId || m.id || m.manifestNumber
          if (!data.some(p => p.manifestId === mId || p.manifestNumber === m.manifestNumber || p.voyageNumber === m.voyageNumber)) {
            const conts = Array.isArray(m.containers) ? m.containers : []
            data.push({
              manifestId: mId,
              manifestNumber: m.manifestNumber,
              vesselName: m.vesselName,
              voyageNumber: m.voyageNumber,
              berthCode: m.berth ? String(m.berth).replace(/[^0-9]/g, '') || '01' : '01',
              direction: m.direction || 'IMPORT',
              status: m.status || 'PORT_APPROVED',
              totalContainers: conts.length,
              reeferCount: conts.filter(c => c.isReefer || /RF|RH|R[01]/.test(c.isoType || '')).length,
              totalWeightKg: conts.reduce((sum, c) => sum + (Number(c.grossWeightKg) || 20000), 0),
              allocatedCount: conts.filter(c => c.yardSlot || c.allocatedSlot || c.reservedSlot).length,
              dischargedCount: conts.filter(c => c.dischargeStatus === 'IN_YARD').length,
              inYardCount: conts.filter(c => c.dischargeStatus === 'IN_YARD').length,
              isPreAllocated: conts.some(c => c.yardSlot || c.allocatedSlot || c.reservedSlot),
              containers: conts.map(c => ({
                containerNumber: c.containerNumber,
                isoType: c.isoType || '40HC',
                isReefer: Boolean(c.isReefer) || /RF|RH|R[01]/.test(c.isoType || ''),
                grossWeightKg: c.grossWeightKg || 22000,
                cargoType: 'FCL',
                shippingLine: m.shippingLine || 'EVERGREEN',
                blNumber: c.blNumber || 'BL-NXP',
                consignee: c.consignee || c.shipper || 'Chủ hàng',
                sealNumber: c.sealNumber || 'SEAL-01',
                reservedSlot: c.yardSlot || c.allocatedSlot || c.reservedSlot || 'A01-01-01-1',
                isPreAllocated: Boolean(c.yardSlot || c.allocatedSlot || c.reservedSlot),
                allocationScore: 95,
                allocationReason: c.allocationReason || 'Phân bổ tự động chuẩn quy tắc Cảng Tiên Sa',
                dischargeStatus: c.dischargeStatus || 'PLANNED',
                condition: 'GOOD',
                inspectionNotes: '',
                damagePhotos: []
              }))
            })
          }
        })
      } catch (syncErr) {
        console.warn('Lỗi hợp nhất manifest từ DB deploy:', syncErr)
      }

      // Khử trùng lặp chuyến tàu tuyệt đối từ DB Deploy (mỗi cặp Tàu - Chuyến hiển thị 1 lần)
      const uniqueMap = new Map()
      for (const p of data) {
        const key = `${(p.vesselName || '').trim().toUpperCase()}_${(p.voyageNumber || '').trim().toUpperCase()}`
        if (!uniqueMap.has(key)) {
          uniqueMap.set(key, { ...p, containers: [...(p.containers || [])] })
        } else {
          const existing = uniqueMap.get(key)
          const existingConts = new Set(existing.containers.map(c => (c.containerNumber || '').trim().toUpperCase()))
          for (const c of (p.containers || [])) {
            const ck = (c.containerNumber || '').trim().toUpperCase()
            if (ck && !existingConts.has(ck)) {
              existing.containers.push(c)
              existingConts.add(ck)
            }
          }
          existing.totalContainers = existing.containers.length
          existing.reeferCount = existing.containers.filter(c => c.isReefer || /RF|RH|R[01]/.test(c.isoType || '')).length
          existing.allocatedCount = existing.containers.filter(c => c.reservedSlot || c.yardSlot).length
        }
      }
      data = Array.from(uniqueMap.values())

      setDischargePlans(data)
      if (data.length > 0) {
        setSelectedPlanId(prev => (keepSelection && prev && (prev === 'ALL' || data.some(p => p.manifestId === prev)) ? prev : 'ALL'))
      } else {
        setSelectedPlanId('ALL')
      }
    } catch (err) {
      console.warn('Error loading discharge plans:', err)
    } finally {
      setLoadingPlans(false)
    }
  }

  const [yardResVersion, setYardResVersion] = useState(0)

  // Pre-allocation algorithm execution (Hỗ trợ phân bổ tự động cho TẤT CẢ các chuyến tàu cùng lúc)
  const handlePreAllocate = async (manifestId) => {
    try {
      setIsPreAllocating(true)
      if (manifestId === 'ALL') {
        let totalCount = 0
        for (const p of dischargePlans) {
          try {
            const updated = await yardDischargeService.preAllocate(p.manifestId)
            if (updated?.containers) {
              for (const c of updated.containers) {
                if (c.reservedSlot) {
                  await manifestPortSyncService.syncYardSlotAcrossAll({
                    containerNumber: c.containerNumber,
                    manifestId: p.manifestId,
                    newSlotCoordinate: c.reservedSlot,
                    reason: c.allocationReason || 'Thuật toán Smart Yard Pre-Allocation tự động phân bổ',
                    status: c.dischargeStatus === 'IN_YARD' ? 'in_yard' : 'reserved',
                    vesselName: p.vesselName,
                    voyageNumber: p.voyageNumber,
                  })
                }
              }
            }
            totalCount += (updated?.allocatedCount || p.totalContainers || 0)
          } catch (e) {
            console.warn(`Pre-allocate warning for manifest ${p.manifestId}:`, e)
          }
        }
        showToast(`Thuật toán phân bổ bãi thành công cho TẤT CẢ ${dischargePlans.length} chuyến tàu! Đã đồng bộ sang Sơ Đồ Bãi & Lịch Tài Xế.`)
      } else {
        const updatedPlan = await yardDischargeService.preAllocate(manifestId)
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
      }

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
            reason: result.allocationReason || 'Đối chiếu khớp bản khai (tally cầu cảng)',
            vesselName: result.vesselName || activePlan?.vesselName,
            voyageNumber: result.voyageNumber || activePlan?.voyageNumber,
          }).catch(e => console.warn('Sync on tally scan warning:', e))
        }
      } else {
        showToast(`CẢNH BÁO: Container không có trong bản khai nhập! Đã gán khu cách ly bãi tạm BUFFER-S01.`)
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

  // Công suất bãi thật: đếm ô đã dùng / tổng số ô trên bản đồ bãi
  const loadYardOccupancy = async () => {
    try {
      const res = await apiClient.get('/yard/layout')
      const slots = res.data?.data?.slots || []
      if (!slots.length) { setYardOccupancy(null); return }
      const used = slots.filter(sl => sl.containerNumber || sl.status === 'occupied' || sl.status === 'reserved').length
      setYardOccupancy({ used, total: slots.length })
    } catch {
      setYardOccupancy(null)
    }
  }

  // Initial load & real-time sync across all 3 sides
  useEffect(() => {
    yardReservationStore.getReservationsAsync().catch(() => { })
    loadLiveTasks()
    loadDischargePlans()
    loadYardOccupancy()

    const handleSync = () => {
      setYardResVersion(v => v + 1)
      loadLiveTasks()
      loadDischargePlans()
      loadYardOccupancy()
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
  const capacityPercent = yardOccupancy && yardOccupancy.total
    ? Math.min(100, Math.round((yardOccupancy.used / yardOccupancy.total) * 100))
    : 0
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
        toLocation: containerOrTask.suggestedPosition || '',
        expectedSealNo: containerOrTask.seal || ''
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

  // Tập hợp toàn bộ containers của TẤT CẢ các chuyến tàu đã duyệt (Lọc theo tất cả các chuyến luôn)
  const allContainersAcrossAllPlans = useMemo(() => {
    const combined = []
    const seenConts = new Set()
    const allStoreRes = yardReservationStore.getReservations()

    dischargePlans.forEach(p => {
      (p.containers || []).forEach((c, idx) => {
        const cKey = (c.containerNumber || '').trim().toUpperCase()
        if (cKey && seenConts.has(cKey)) return
        if (cKey) seenConts.add(cKey)

        const storeRes = allStoreRes.find(r => (r.containerNo || r.containerId || '').trim().toUpperCase() === cKey)
        const isException = Boolean(
          c.isException ||
          c.dischargeStatus === 'EXCEPTION' ||
          String(c.condition || '').toUpperCase() === 'EXCEPTION' ||
          String(c.notes || '').includes('NGOẠI LỆ') ||
          String(c.allocationReason || '').includes('NGOẠI LỆ')
        )

        let resolvedSlot = null
        if (storeRes && storeRes.blockCode && !storeRes.isTemporaryBuffer && storeRes.allocationScore !== 50) {
          resolvedSlot = `${storeRes.blockCode}-${String(storeRes.bay).padStart(2, '0')}-${String(storeRes.row).padStart(2, '0')}-${storeRes.tier}`
        } else if (c.reservedSlot && !c.reservedSlot.startsWith('A01-01-01-1') && !c.isTemporaryBuffer && c.allocationScore !== 50) {
          resolvedSlot = c.reservedSlot
        } else if (isException) {
          resolvedSlot = 'BUFFER-S01-01-1'
        } else {
          // Tự động phân bổ bãi theo quy tắc chuẩn Cảng Tiên Sa:
          // Cont lạnh -> Block D01, Hàng nhập STS -> Block B01/A01, Cont nặng >= 22T -> Tier 1, Cont 40ft -> Bay chẵn, Cont 20ft -> Bay lẻ
          const auto = computeAutoYardSlot(c, p.direction || c.direction || 'IMPORT', idx, p.containers || [])
          resolvedSlot = auto.coordinate || `${auto.blockCode}-${String(auto.bay).padStart(2, '0')}-${String(auto.row).padStart(2, '0')}-${auto.tier}`
        }

        const isRf = Boolean(c.isReefer) || /RF|RH|R[01]/.test(c.isoType || '')
        const isHeavy = Number(c.grossWeightKg || 0) >= 22000
        const is40 = !String(c.isoType || '40').includes('20')
        const is20 = String(c.isoType || '').includes('20')
        const bCode = resolvedSlot.split('-')[0].trim().toUpperCase()

        combined.push({
          ...c,
          vesselName: p.vesselName,
          voyageNumber: p.voyageNumber,
          berthCode: p.berthCode,
          manifestId: p.manifestId,
          direction: p.direction || c.direction || 'IMPORT',
          resolvedSlot,
          isAllocated: !!resolvedSlot,
          isException,
          storeRes,
          isRf,
          isHeavy,
          is40,
          is20,
          blockCode: bCode,
          allocationReason: storeRes?.allocationReason || c.allocationReason || 'Phân bổ theo chuẩn quy tắc Cảng Tiên Sa',
          allocationScore: c.allocationScore || 95
        })
      })
    })
    return combined
  }, [dischargePlans, yardResVersion])

  // Active Manifest & Discharge Plan computation (Hỗ trợ chế độ 'ALL' để lọc theo tất cả các chuyến luôn)
  const activePlan = useMemo(() => {
    if (selectedPlanId === 'ALL') {
      const inYard = allContainersAcrossAllPlans.filter(c => c.dischargeStatus === 'IN_YARD').length
      const discharged = allContainersAcrossAllPlans.filter(c => c.dischargeStatus === 'DISCHARGED').length
      return {
        manifestId: 'ALL',
        manifestNumber: 'ALL-VOYAGES',
        vesselName: 'Tất Cả Chuyến Tàu',
        voyageNumber: `${dischargePlans.length} Chuyến Tàu Đã Duyệt`,
        berthCode: 'Đa Bến Cảng Tiên Sa',
        direction: 'ĐA HƯỚNG (XUẤT / NHẬP)',
        totalContainers: allContainersAcrossAllPlans.length,
        inYardCount: inYard,
        dischargedCount: discharged,
        allocatedCount: allContainersAcrossAllPlans.filter(c => c.isAllocated).length,
        reeferCount: allContainersAcrossAllPlans.filter(c => c.isRf).length,
        totalWeightKg: allContainersAcrossAllPlans.reduce((sum, c) => sum + (Number(c.grossWeightKg) || 0), 0),
        isPreAllocated: allContainersAcrossAllPlans.length > 0 && allContainersAcrossAllPlans.every(c => c.isAllocated),
        containers: allContainersAcrossAllPlans
      }
    }
    return dischargePlans.find(p => p.manifestId === selectedPlanId) || dischargePlans[0] || null
  }, [selectedPlanId, dischargePlans, allContainersAcrossAllPlans])

  // Lấy toàn bộ containers cần hiển thị trên bảng lớn (TẤT CẢ CÁC CHUYẾN TÀU)
  const allPlanContainers = useMemo(() => {
    if (selectedPlanId === 'ALL') {
      return allContainersAcrossAllPlans
    }
    const list = activePlan?.containers || []
    const allStoreRes = yardReservationStore.getReservations()
    return list.map((c, idx) => {
      const cKey = (c.containerNumber || '').trim().toUpperCase()
      const storeRes = allStoreRes.find(r => (r.containerNo || r.containerId || '').trim().toUpperCase() === cKey)
      const isException = Boolean(
        c.isException ||
        c.dischargeStatus === 'EXCEPTION' ||
        String(c.condition || '').toUpperCase() === 'EXCEPTION' ||
        String(c.notes || '').includes('NGOẠI LỆ') ||
        String(c.allocationReason || '').includes('NGOẠI LỆ')
      )

      let resolvedSlot = null
      if (storeRes && storeRes.blockCode && !storeRes.isTemporaryBuffer && storeRes.allocationScore !== 50) {
        resolvedSlot = `${storeRes.blockCode}-${String(storeRes.bay).padStart(2, '0')}-${String(storeRes.row).padStart(2, '0')}-${storeRes.tier}`
      } else if (c.reservedSlot && !c.reservedSlot.startsWith('A01-01-01-1') && !c.isTemporaryBuffer && c.allocationScore !== 50) {
        resolvedSlot = c.reservedSlot
      } else if (isException) {
        resolvedSlot = 'BUFFER-S01-01-1'
      } else {
        const auto = computeAutoYardSlot(c, activePlan?.direction || c.direction || 'IMPORT', idx, list)
        resolvedSlot = auto.coordinate || `${auto.blockCode}-${String(auto.bay).padStart(2, '0')}-${String(auto.row).padStart(2, '0')}-${auto.tier}`
      }

      const isRf = Boolean(c.isReefer) || /RF|RH|R[01]/.test(c.isoType || '')
      const isHeavy = Number(c.grossWeightKg || 0) >= 22000
      const is40 = !String(c.isoType || '40').includes('20')
      const is20 = String(c.isoType || '').includes('20')
      const bCode = resolvedSlot.split('-')[0].trim().toUpperCase()

      return {
        ...c,
        vesselName: c.vesselName || activePlan.vesselName,
        voyageNumber: c.voyageNumber || activePlan.voyageNumber,
        berthCode: c.berthCode || activePlan.berthCode,
        manifestId: c.manifestId || activePlan.manifestId,
        resolvedSlot,
        isAllocated: !!resolvedSlot,
        isException,
        storeRes,
        isRf,
        isHeavy,
        is40,
        is20,
        blockCode: bCode,
        allocationReason: storeRes?.allocationReason || c.allocationReason || 'Phân bổ theo chuẩn quy tắc Cảng Tiên Sa',
        allocationScore: c.allocationScore || 95
      }
    })
  }, [selectedPlanId, activePlan, allContainersAcrossAllPlans, yardResVersion])

  // Lọc theo thanh AI Explainability Filter Pills & Ô Tìm Kiếm
  const filteredPlanContainers = useMemo(() => {
    let result = allPlanContainers

    if (statusFilter === 'IN_YARD') result = result.filter(c => c.dischargeStatus === 'IN_YARD')
    else if (statusFilter === 'PENDING') result = result.filter(c => c.dischargeStatus !== 'IN_YARD')

    if (containerSearch.trim()) {
      const q = containerSearch.trim().toLowerCase()
      result = result.filter(c =>
        (c.containerNumber || '').toLowerCase().includes(q) ||
        (c.blNumber || '').toLowerCase().includes(q) ||
        (c.consignee || '').toLowerCase().includes(q) ||
        (c.sealNumber || '').toLowerCase().includes(q) ||
        (c.resolvedSlot || '').toLowerCase().includes(q)
      )
    }

    return result
  }, [allPlanContainers, statusFilter, containerSearch])

  // Phân trang bảng container
  const planTotalPages = Math.max(1, Math.ceil(filteredPlanContainers.length / planPageSize))
  const planCurrentPage = Math.min(planPage, planTotalPages)
  const pagedPlanContainers = filteredPlanContainers.slice((planCurrentPage - 1) * planPageSize, planCurrentPage * planPageSize)
  useEffect(() => { setPlanPage(1) }, [statusFilter, containerSearch, selectedPlanId, planPageSize])


  return (
    <div className="p-4 md:p-6 lg:p-8 w-full font-sans flex flex-col gap-5 bg-slate-50/60 min-h-screen text-slate-800">

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl text-xs font-semibold flex items-center gap-3 z-[100] border border-slate-700 animate-in fade-in slide-in-from-top-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 flex-shrink-0 animate-pulse"></span>
          <span className="text-white font-medium leading-tight">{toastMessage}</span>
        </div>
      )}


      {/* ── 2. CHỈ SỐ KHAI THÁC (dữ liệu thật) ── */}
      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[
          {
            key: 'occupancy',
            label: 'Ô bãi đang dùng',
            icon: 'grid_view',
            tone: 'text-blue-600 bg-blue-50',
            value: yardOccupancy ? yardOccupancy.used.toLocaleString('vi-VN') : '—',
            suffix: yardOccupancy ? `/ ${yardOccupancy.total.toLocaleString('vi-VN')} ô` : '',
            note: yardOccupancy ? `${capacityPercent}% công suất` : 'Chưa tải được sơ đồ bãi',
            bar: yardOccupancy ? capacityPercent : null,
          },
          { key: 'pending', label: 'Chờ đối soát & nhận', icon: 'qr_code_scanner', tone: 'text-amber-600 bg-amber-50', value: uninspectedCount, suffix: 'cont', note: 'Chờ quét mã và đối soát seal' },
          { key: 'ready', label: 'Sẵn sàng cẩu', icon: 'forklift', tone: 'text-sky-600 bg-sky-50', value: readyCount, suffix: 'lệnh', note: 'Đã chỉ định thiết bị và cần thủ' },
          { key: 'progress', label: 'Đang nâng hạ', icon: 'precision_manufacturing', tone: 'text-orange-600 bg-orange-50', value: inProgressCount, suffix: 'lệnh', note: 'Cần thủ đang tác nghiệp' },
          { key: 'done', label: 'Đã hoàn tất', icon: 'task_alt', tone: 'text-emerald-600 bg-emerald-50', value: completedCount, suffix: 'lệnh', note: 'Đã hạ bãi an toàn' },
        ].map((k) => (
          <div key={k.key} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-500">{k.label}</span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className={`text-2xl font-bold tabular-nums tracking-tight ${k.tone.split(' ')[0]}`}>{k.value}</span>
              {k.suffix ? <span className="text-xs text-slate-400">{k.suffix}</span> : null}
            </div>
            {k.bar != null ? (
              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${k.bar}%` }} />
              </div>
            ) : null}
            <div className="text-[11px] text-slate-500">{k.note}</div>
          </div>
        ))}
      </section>

      {/* ── 2.5 KẾ HOẠCH DỠ TÀU & PHÂN BỔ BÃI THÔNG MINH (SMART YARD PRE-ALLOCATION) ── */}
      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-6 flex flex-col gap-5">

        {/* Section Header: Title & Action Bar */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">Điều phối dỡ tàu &amp; đặt chỗ trước</h2>
            <p className="text-xs text-slate-500 mt-1">
              Xếp ô bãi theo bản khai chuyến tàu, quét tally đối soát và chốt vị trí bãi.
            </p>
          </div>

          {/* Toolbar: Vessel Select & Main Actions */}
          <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto justify-start lg:justify-end">
            {/* Chọn chuyến tàu */}
            <Select
              value={selectedPlanId}
              onChange={(e) => setSelectedPlanId(e.target.value)}
              size="md"
              className="min-w-[260px] max-w-[340px]"
              options={[
                {
                  value: 'ALL',
                  label: dischargePlans.length === 0 ? 'Tất cả chuyến tàu (đang tải…)' : 'Tất cả chuyến tàu',
                  sub: dischargePlans.length === 0 ? null : `${allContainersAcrossAllPlans.length} container`,
                },
                ...dischargePlans.map((p, idx) => ({
                  value: p.manifestId,
                  label: `${p.vesselName}${p.voyageNumber ? ` (${p.voyageNumber})` : ''}`,
                  sub: `${p.totalContainers} container${p.berthCode ? ` · Bến ${p.berthCode}` : ''}`,
                  key: idx,
                })),
              ]}
            />

            {/* Run Pre-allocation button */}
            <button
              onClick={() => handlePreAllocate(activePlan?.manifestId)}
              disabled={isPreAllocating || !activePlan}
              className="px-4 h-10 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 cursor-pointer"
            >
              {isPreAllocating ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin"></span>
                  <span>Đang phân bổ…</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-sm">auto_awesome</span>
                  <span>Phân bổ bãi tự động</span>
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
              className="px-4 h-10 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm text-amber-300">qr_code_scanner</span>
              <span>Quét tally cầu cảng</span>
            </button>
          </div>
        </div>

        {/* Vessel Discharge Quick Metric Cards Grid */}
        {activePlan && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
            {/* Card 1: Vessel Info */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-xs font-semibold">Chuyến tàu &amp; bến</span>
              </div>
              <div className="font-bold text-slate-900 text-sm truncate" title={activePlan.vesselName}>
                {activePlan.vesselName}
              </div>
              <div className="text-[11px] text-slate-500 tabular-nums flex items-center gap-1 mt-0.5">
                <span>{activePlan.voyageNumber}</span>
                <span>•</span>
                <span className="font-semibold text-blue-700 bg-blue-50 px-1 rounded">Bến {activePlan.berthCode || '—'}</span>
              </div>
            </div>

            {/* Card 2: Total Containers */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-xs font-semibold">Tổng container</span>
              </div>
              <div className="font-bold text-indigo-950 text-base tabular-nums">
                {activePlan.totalContainers} <span className="text-xs font-sans font-normal text-slate-500">Cont</span>
              </div>
              <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                {activePlan.reeferCount > 0 ? (
                  <span className="text-sky-700 font-semibold bg-sky-50 border border-sky-200/60 px-1.5 py-0.2 rounded text-[10px]">
                    {activePlan.reeferCount} cont lạnh
                  </span>
                ) : (
                  <span>Không có cont lạnh</span>
                )}
                <span className="text-[10px] tabular-nums text-slate-400">({(Number(activePlan.totalWeightKg || 0) / 1000).toFixed(1)}T)</span>
              </div>
            </div>

            {/* Card 3: Allocation Status */}
            <div className={`rounded-xl p-3.5 flex flex-col justify-between border ${activePlan.allocatedCount >= activePlan.totalContainers ? 'bg-emerald-50/50 border-emerald-200' : 'bg-amber-50/50 border-amber-200'}`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-slate-500">Chốt vị trí bãi</span>
              </div>
              <div className={`font-bold text-sm tabular-nums flex items-center gap-1.5 ${activePlan.allocatedCount >= activePlan.totalContainers ? 'text-emerald-800' : 'text-amber-800'}`}>
                <span>{activePlan.allocatedCount}/{activePlan.totalContainers} container</span>
              </div>
              <div className="text-[11px] mt-0.5">
                <span className={activePlan.allocatedCount >= activePlan.totalContainers ? 'text-emerald-700 font-medium' : 'text-amber-700 font-medium'}>
                  {activePlan.allocatedCount >= activePlan.totalContainers ? 'Đã chốt đủ vị trí' : `Còn ${activePlan.totalContainers - activePlan.allocatedCount} chưa có vị trí`}
                </span>
              </div>
            </div>

            {/* Card 4: Discharged at Quay */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-xs font-semibold">Đã dỡ cầu cảng</span>
              </div>
              <div className="font-bold text-amber-900 text-base tabular-nums">
                {activePlan.dischargedCount} <span className="text-xs font-sans font-normal text-slate-500">/ {activePlan.totalContainers}</span>
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                {activePlan.dischargedCount === activePlan.totalContainers ? 'Đã dỡ toàn bộ' : 'Đang dỡ'}
              </div>
            </div>

            {/* Card 5: Safe in Yard */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-xs font-semibold">Đã hạ bãi</span>
              </div>
              <div className="font-bold text-teal-900 text-base tabular-nums">
                {activePlan.inYardCount} <span className="text-xs font-sans font-normal text-slate-500">/ {activePlan.totalContainers}</span>
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                {activePlan.inYardCount === activePlan.totalContainers ? 'Đã vào bãi toàn bộ' : 'Chờ hạ bãi'}
              </div>
            </div>
          </div>
        )}

        {/* Tình trạng phân bổ (theo số liệu thật của chuyến) */}
        {activePlan && (activePlan.allocatedCount < activePlan.totalContainers ? (
          <div className="px-4 py-3 rounded-xl border border-amber-200 bg-amber-50 text-amber-900 text-xs flex items-center gap-2.5">
            <span className="material-symbols-outlined text-lg text-amber-600 shrink-0">info</span>
            <span>
              Còn <strong>{activePlan.totalContainers - activePlan.allocatedCount}</strong> container chưa có vị trí bãi.
              Bấm &quot;Phân bổ bãi tự động&quot; hoặc đổi vị trí thủ công ở từng dòng.
            </span>
          </div>
        ) : (
          <div className="px-4 py-3 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-900 text-xs flex items-center gap-2.5">
            <span className="material-symbols-outlined text-lg text-emerald-600 shrink-0">task_alt</span>
            <span>Đã chốt vị trí bãi cho toàn bộ <strong>{activePlan.totalContainers}</strong> container của chuyến.</span>
          </div>
        ))}

        {/* Containers in Manifest Table: Modern, Spaced, No Cut-off Text */}
        {activePlan && (
          <div className="flex flex-col gap-3">
            {/* Thanh lọc: tab trạng thái + phân loại + tìm kiếm */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="inline-flex p-1 rounded-xl bg-slate-100 self-start" role="tablist" aria-label="Lọc theo trạng thái">
                {[
                  { key: 'ALL', label: 'Tất cả', count: allPlanContainers.length },
                  { key: 'PENDING', label: 'Chờ hạ bãi', count: allPlanContainers.filter(c => c.dischargeStatus !== 'IN_YARD').length },
                  { key: 'IN_YARD', label: 'Đã hạ bãi', count: allPlanContainers.filter(c => c.dischargeStatus === 'IN_YARD').length },
                ].map(t => {
                  const on = statusFilter === t.key
                  return (
                    <button
                      key={t.key}
                      type="button"
                      role="tab"
                      aria-selected={on}
                      onClick={() => setStatusFilter(t.key)}
                      className={`px-3.5 h-8 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer ${on ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                    >
                      <span>{t.label}</span>
                      <span className={`tabular-nums text-[11px] px-1.5 rounded-md ${on ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-200/70 text-slate-500'}`}>{t.count}</span>
                    </button>
                  )
                })}
              </div>

              <div className="flex flex-col sm:flex-row gap-2 lg:items-center">
                <div className="relative w-full sm:w-64">
                  <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-base">search</span>
                  <input
                    type="text"
                    placeholder="Tìm số cont, vận đơn, ô bãi…"
                    value={containerSearch}
                    onChange={e => setContainerSearch(e.target.value)}
                    className="w-full pl-8 pr-8 h-10 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                  />
                  {containerSearch && (
                    <button
                      type="button"
                      onClick={() => setContainerSearch('')}
                      aria-label="Xóa từ khóa"
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* BẢNG LỚN TỔNG QUAN HIỂN THỊ TẤT CẢ CONTAINER */}
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold text-xs whitespace-nowrap">
                    <th className="py-3 px-4">Container</th>
                    <th className="py-3 px-4">Vị trí đặt trước</th>
                    <th className="py-3 px-4">Trọng lượng</th>
                    <th className="py-3 px-4">Số seal</th>
                    <th className="py-3 px-4">Trạng thái</th>
                    <th className="py-3 px-4 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredPlanContainers.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="py-12 text-center text-slate-400 text-xs">
                        <p className="font-semibold text-slate-600">Không có container nào phù hợp với bộ lọc đang chọn</p>
                      </td>
                    </tr>
                  ) : (
                    pagedPlanContainers.map((c, idx) => {
                      const resolvedSlot = c.resolvedSlot
                      const isAllocated = !!resolvedSlot
                      const isDischarged = c.dischargeStatus === 'DISCHARGED'
                      const isInYard = c.dischargeStatus === 'IN_YARD'
                      const isException = Boolean(c.isException || c.dischargeStatus === 'EXCEPTION')

                      return (
                        <tr key={`${c.containerNumber || 'cont'}-${c.blNumber || ''}-${idx}`} className="hover:bg-indigo-50/20 transition-colors">
                          {/* 1. Container */}
                          <td className="py-3 px-4 align-middle">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="tabular-nums font-bold text-slate-900 text-sm">{c.containerNumber}</span>
                              <span className="text-[11px] tabular-nums font-semibold px-1.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                                {c.isoType || '—'}
                              </span>
                              {c.isRf && (
                                <span className="text-[11px] font-semibold text-sky-700 bg-sky-50 border border-sky-200 px-1.5 rounded flex items-center gap-0.5">
                                  <span className="material-symbols-outlined text-xs text-sky-600">ac_unit</span>
                                  Lạnh
                                </span>
                              )}
                              {c.condition === 'DAMAGED' && (
                                <span className="text-[11px] font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-1.5 rounded">Vỏ hỏng</span>
                              )}
                              {c.damagePhotos && c.damagePhotos.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => setPreviewImage(c.damagePhotos[0])}
                                  className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 px-1.5 rounded flex items-center gap-0.5 cursor-pointer"
                                  title="Xem ảnh hư hỏng"
                                >
                                  <span className="material-symbols-outlined text-xs">photo_camera</span>
                                  {c.damagePhotos.length}
                                </button>
                              )}
                            </div>
                          </td>

                          {/* 2. Vị trí đặt trước */}
                          <td className="py-3 px-4 align-middle">
                            {isException ? (
                              <div>
                                <span className="text-xs font-semibold text-rose-700">Không có trong bản khai</span>
                                {resolvedSlot ? <div className="text-[11px] text-rose-600 tabular-nums">Cách ly tại {resolvedSlot}</div> : null}
                              </div>
                            ) : isAllocated ? (
                              <span className="tabular-nums font-bold px-2.5 py-1 rounded-lg text-xs border text-indigo-950 bg-indigo-50 border-indigo-200 inline-block">
                                {resolvedSlot}
                              </span>
                            ) : (
                              <span className="text-xs text-slate-400">Chưa đặt chỗ</span>
                            )}
                          </td>

                          {/* 3. Trọng lượng */}
                          <td className="py-3 px-4 align-middle tabular-nums text-slate-800 text-xs whitespace-nowrap">
                            {c.grossWeightKg ? <><strong>{Number(c.grossWeightKg).toLocaleString('vi-VN')}</strong> kg</> : '—'}
                          </td>

                          {/* 4. Số seal */}
                          <td className="py-3 px-4 align-middle tabular-nums text-slate-700 text-xs whitespace-nowrap">
                            {c.sealNumber || <span className="text-slate-400">Chưa có</span>}
                          </td>

                          {/* 5. Trạng thái */}
                          <td className="py-3 px-4 align-middle whitespace-nowrap">
                            {isException ? (
                              <span className="text-[11px] font-semibold text-rose-800 bg-rose-50 border border-rose-300 px-2.5 py-1 rounded-full">Ngoại lệ</span>
                            ) : isInYard ? (
                              <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">Đã hạ bãi</span>
                            ) : isDischarged ? (
                              <span className="text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">Đã dỡ, chờ hạ bãi</span>
                            ) : isAllocated ? (
                              <span className="text-[11px] font-semibold text-indigo-800 bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-full">Đã đặt chỗ</span>
                            ) : (
                              <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-full">Chờ xếp</span>
                            )}
                          </td>

                          {/* 6. Thao Tác (Nút Chính: Đổi Bãi 2D Mở Sơ Đồ Phân Khu Tiên Sa Chuẩn Ảnh) */}
                          <td className="py-3 px-4 text-right align-middle whitespace-nowrap">
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
                                  className="px-2.5 py-1.5 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold transition-all shadow-2xs flex items-center gap-1 cursor-pointer hover:border-indigo-400"
                                >
                                  <span className="material-symbols-outlined text-sm text-indigo-600">qr_code_scanner</span>
                                  <span>Tally</span>
                                </button>
                              )}

                              {isDischarged && !isInYard && (
                                <button
                                  onClick={() => handleConfirmPutdown(c.containerNumber)}
                                  disabled={tallyConfirming}
                                  title="Xác nhận RTG đã hạ bãi an toàn"
                                  className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition-all shadow-xs flex items-center gap-1 cursor-pointer"
                                >
                                  <span className="material-symbols-outlined text-sm">task_alt</span>
                                  <span>Hạ bãi</span>
                                </button>
                              )}

                              {/* NÚT THAO TÁC CHÍNH: Mở Sơ Đồ Phân Khu Bãi Container Tiên Sa (Zone A ➔ G) */}
                              <button
                                onClick={() => {
                                  setZoneContainer(c)
                                  setZoneCurrentSlot(resolvedSlot)
                                  setZoneModalOpen(true)
                                }}
                                title="Mở sơ đồ bãi để đổi khu và vị trí"
                                className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
                              >
                                <span className="material-symbols-outlined text-sm">swap_horiz</span>
                                <span>Đổi vị trí</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>

            {filteredPlanContainers.length > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
                <div className="flex items-center gap-3">
                  <span className="tabular-nums">
                    Hiển thị {(planCurrentPage - 1) * planPageSize + 1}–{Math.min(planCurrentPage * planPageSize, filteredPlanContainers.length)} / {filteredPlanContainers.length}
                  </span>
                  <label className="flex items-center gap-1.5">
                    <span>Dòng / trang</span>
                    <Select size="sm" className="w-20" value={planPageSize} onChange={(e) => setPlanPageSize(Number(e.target.value))} options={[10, 20, 50].map((n) => ({ value: n, label: String(n) }))} />
                  </label>
                </div>
                <div className="flex items-center gap-1">
                  <button type="button" disabled={planCurrentPage <= 1} onClick={() => setPlanPage(planCurrentPage - 1)} aria-label="Trang trước" className="h-8 w-8 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center cursor-pointer">
                    <span className="material-symbols-outlined text-lg">chevron_left</span>
                  </button>
                  <span className="px-3 tabular-nums font-semibold text-slate-700">{planCurrentPage} / {planTotalPages}</span>
                  <button type="button" disabled={planCurrentPage >= planTotalPages} onClick={() => setPlanPage(planCurrentPage + 1)} aria-label="Trang sau" className="h-8 w-8 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center cursor-pointer">
                    <span className="material-symbols-outlined text-lg">chevron_right</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </section>

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
                    actualSealNo: updated?.actualSealNo || t.actualSealNo || ''
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
                  <span>Tiếp nhận tại cầu cảng</span>
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
                      className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-sm tabular-nums font-bold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 transition-colors shadow-2xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Tình trạng ngoại quan
                    </label>
                    <Select
                      value={tallyCondition}
                      onChange={(e) => setTallyCondition(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-indigo-500 cursor-pointer shadow-2xs"
                    >
                      <option value="GOOD">Tốt / Nguyên vẹn</option>
                      <option value="DAMAGED">Hư hỏng / Móp méo</option>
                      <option value="SEAL_BROKEN">Mất / Đứt seal</option>
                    </Select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Ghi chú ngoại quan
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
                <div className={`p-3 rounded-xl border transition-all ${tallyCondition !== 'GOOD'
                  ? 'bg-amber-50/80 border-amber-300'
                  : 'bg-white border-slate-200'
                  }`}>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-sm text-indigo-600">photo_camera</span>
                      <span>Ảnh Hiện Trường & Tổn Thất EIR {tallyCondition !== 'GOOD' && <span className="text-rose-500 font-bold">*</span>}</span>
                    </label>
                    <span className="text-[10px] text-slate-500 tabular-nums">
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
                      <span>Đang đối soát bản khai…</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-sm">search</span>
                      <span>Quét & đối soát bản khai</span>
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
                        Nhập số container và chụp ảnh kiểm tra ngoại quan ở cột bên trái, sau đó nhấn <strong>Quét & đối soát bản khai</strong> để hiển thị vị trí bãi và xác nhận hạ bãi.
                      </p>
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
                            <span>Khớp bản khai: {tallyScanResult.vesselName} ({tallyScanResult.voyageNumber})</span>
                          </div>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200">
                            HỢP LỆ
                          </span>
                        </div>

                        {/* Thông tin vị trí & Container */}
                        <div className="grid grid-cols-2 gap-2 text-xs bg-white p-3 rounded-lg border border-emerald-100 shadow-2xs">
                          <div>
                            <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider block mb-0.5">Số Container:</span>
                            <div className="tabular-nums font-bold text-sm text-slate-900">{tallyScanResult.containerNumber}</div>
                          </div>
                          <div>
                            <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider block mb-0.5">Vị Trí Đặt Chỗ:</span>
                            <div className="tabular-nums font-bold text-xs text-indigo-900 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded inline-block">
                              {tallyScanResult.reservedSlot || 'Chưa phân bổ'}
                            </div>
                          </div>
                          <div>
                            <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider block mb-0.5">Vận Đơn (B/L):</span>
                            <div className="tabular-nums font-semibold text-slate-700">{tallyScanResult.blNumber || 'N/A'}</div>
                          </div>
                          <div>
                            <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider block mb-0.5">Điểm AI:</span>
                            <div className="tabular-nums font-bold text-amber-700">{tallyScanResult.allocationScore} điểm</div>
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
                            <span>Đã hoàn tất hạ bãi</span>
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
                          <span className="tabular-nums font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
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
                  <span className="tabular-nums font-bold text-slate-900">{overrideContainer.containerNumber}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">Ô hiện tại:</span>
                  <span className="tabular-nums font-bold text-indigo-800 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                    {overrideContainer.reservedSlot || 'Chưa gán'}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Vị trí mới (Khu-Bay-Hàng-Tầng) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={overrideNewSlot}
                  onChange={(e) => setOverrideNewSlot(e.target.value.toUpperCase())}
                  placeholder="VD: R-02-01-3 hoặc A01-01-01-1"
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs tabular-nums font-bold text-slate-900 focus:outline-none focus:border-indigo-500"
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

      {/* MODAL 0: SƠ ĐỒ PHÂN KHU BÃI CONTAINER TIÊN SA (ZONE A ➔ G & BLOCK SELECTOR - Chuẩn ảnh người dùng) */}
      {zoneModalOpen && zoneContainer && (
        <YardZoneBlockSelectorModal
          isOpen={zoneModalOpen}
          onClose={() => {
            setZoneModalOpen(false)
            setZoneContainer(null)
          }}
          container={zoneContainer}
          currentSlot={zoneCurrentSlot}
          onSelectBlock={(selectedBlock) => {
            setZoneModalOpen(false)
            const contSize = String(zoneContainer.isoType || '40HC').startsWith('20') ? 20 : 40
            setPickerContainer({
              containerId: zoneContainer.containerNumber,
              containerNo: zoneContainer.containerNumber,
              containerType: zoneContainer.isoType || `${contSize}HC`,
              size: contSize,
              blNumber: zoneContainer.blNumber,
              manifestId: activePlan?.manifestId || selectedPlanId,
              sourceManifestId: activePlan?.manifestId || selectedPlanId,
              vesselName: activePlan?.vesselName,
              voyageNumber: activePlan?.voyageNumber,
              reservedSlot: zoneCurrentSlot
            })
            setPickerBlock(selectedBlock)
          }}
        />
      )}

      {/* MODAL 7: POP-UP CHỌN VỊ TRÍ BÃI 2D TRỰC QUAN (HỖ TRỢ 20FT & 40FT) */}
      {pickerBlock && pickerContainer && (
        <YardSlotReservationModal
          isOpen={!!pickerBlock}
          onClose={() => {
            setPickerBlock(null)
            setPickerContainer(null)
          }}
          block={pickerBlock}
          booking={pickerContainer}
          currentReservation={pickerContainer?.reservedSlot}
          onConfirm={async (slotInfo) => {
            try {
              const newTier = Number(slotInfo.tier) || 1
              const bayStr = String(slotInfo.bay).padStart(2, '0')
              const rowStr = String(slotInfo.row).padStart(2, '0')
              const coordinate = `${slotInfo.blockCode}-${bayStr}-${rowStr}-${newTier}`

              // 1. Cập nhật qua C# backend
              await yardDischargeService.overrideSlot({
                manifestId: pickerContainer.manifestId,
                containerNumber: pickerContainer.containerId,
                newSlotCoordinate: coordinate,
                reason: 'Điều độ viên đổi vị trí trực tiếp trên Sơ đồ bãi 2D'
              }).catch(e => console.warn('C# override warning:', e))

              // 2. Đồng bộ 4 bên: Sơ đồ bãi + Gate Bookings + Manifest + Lịch tài xế
              await manifestPortSyncService.syncYardSlotAcrossAll({
                containerNumber: pickerContainer.containerId,
                manifestId: pickerContainer.manifestId,
                newSlotCoordinate: coordinate,
                reason: 'Điều độ viên đổi vị trí trực tiếp trên Sơ đồ bãi 2D',
                status: 'reserved',
                vesselName: pickerContainer.vesselName,
                voyageNumber: pickerContainer.voyageNumber,
              })

              showToast(`Đã đổi vị trí container ${pickerContainer.containerId} sang ô ${coordinate} thành công!`)
              setPickerBlock(null)
              setPickerContainer(null)
              await loadDischargePlans()
              await loadLiveTasks()
              setYardResVersion(v => v + 1)
            } catch (err) {
              console.error('Lỗi khi lưu vị trí mới:', err)
              showToast(`Lỗi: ${err.message || 'Không thể đổi vị trí bãi'}`)
            }
          }}
        />
      )}

    </div>
  )
}
