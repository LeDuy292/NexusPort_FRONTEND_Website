import gateService from './gateService'
import { createGatePassageSimulation, passageOpenSeconds } from './gatePassageSimulation'

export const gateOpenSeconds = passageOpenSeconds(import.meta.env.VITE_GATE_OPEN_SECONDS)

// Scope recovery to the signed-in account. Keep the small pending cycle in this
// tab across refreshes; image evidence is already persisted by verification.
const accountKey = () => {
  const user = JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user') || 'null')
  return user?.id || user?.userId || user?.username || user?.email || 'anonymous'
}
let activeAccount
let simulator
export function getGatePassageSimulation() {
  const account = accountKey()
  if (!simulator || account !== activeAccount) {
    activeAccount = account
    const prefix = `gate:${account}:`
    simulator = createGatePassageSimulation({
      storage: {
        getItem: key => sessionStorage.getItem(prefix + key),
        setItem: (key, value) => sessionStorage.setItem(prefix + key, value),
        removeItem: key => sessionStorage.removeItem(prefix + key),
      },
      recordPassage: async cycle => {
        if (accountKey() !== account) throw new Error('Tài khoản đã thay đổi. Đăng nhập lại tài khoản đang xử lý lượt cổng.')
        return cycle.mode === 'checkin' ? gateService.recordPassageIn(cycle.evidence)
          : gateService.completeGateOut(cycle.booking.id, cycle.gate.id)
      },
      closeBarrier: cycle => {
        if (accountKey() !== account) throw new Error('Tài khoản đã thay đổi.')
        return gateService.commandBarrier({ requestId: cycle.closeRequestId,
          gateCode: cycle.gate.code, action: 'close', source: 'automatic' })
      },
    })
  }
  return simulator
}
