/**
 * Quy tắc mã chuyến tàu (giống backend src/modules/shipping-line/voyageNumber.js):
 * {TIỀN TỐ TÀU 3 ký tự}{YY năm ETA}{STT 2 số}{X = xuất khỏi Tiên Sa | N = nhập về Tiên Sa}
 * VD: EVER GIVEN, xuất, năm 2026 → EGV2601X, chuyến tiếp theo EGV2602X.
 * Backend vẫn kiểm tra trùng lần cuối khi lưu.
 */
const TIEN_SA = /TIÊN SA|TIEN SA|VNDAD/i

export function vesselPrefix(vesselName) {
  const words = String(vesselName || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\u0111/gi, 'D')
    .toUpperCase().split(/[^A-Z0-9]+/).filter((w) => /^[A-Z]/.test(w))
  if (words.length === 0) return 'VSL'
  let prefix = words.map((w) => w[0]).join('').slice(0, 3)
  for (let i = 1; prefix.length < 3 && i < words[0].length; i += 1) prefix += words[0][i]
  return prefix.padEnd(3, 'X')
}

export function buildVoyageNumber({ vesselName, eta, pol, pod, taken = [] }) {
  const etaDate = eta ? new Date(String(eta).includes('T') ? eta : String(eta).replace(' ', 'T')) : new Date()
  const yy = String((isNaN(etaDate.getTime()) ? new Date() : etaDate).getFullYear()).slice(-2)
  const head = `${vesselPrefix(vesselName)}${yy}`
  const dir = TIEN_SA.test(String(pol || '')) ? 'X' : TIEN_SA.test(String(pod || '')) ? 'N' : 'X'
  const pattern = new RegExp(`^${head}(\\d{2})${dir}$`)
  const max = taken.reduce((m, no) => {
    const hit = pattern.exec(String(no || '').toUpperCase())
    return hit ? Math.max(m, Number(hit[1])) : m
  }, 0)
  return `${head}${String(max + 1).padStart(2, '0')}${dir}`
}
