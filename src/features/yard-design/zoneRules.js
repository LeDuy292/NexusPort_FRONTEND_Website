/**
 * Quy tắc phân khu: container lạnh chỉ được xếp vào khu lạnh (Block D*, R), container thường chỉ được xếp vào khu thường.
 */
export const isReeferBlockCode = (code) => {
  const c = String(code || '').trim().toUpperCase().replace(/^BLOCK\s+/, '')
  return c.startsWith('D') || c === 'R'
}

export const isReeferContainerInfo = (info) => {
  if (!info) return false
  if (info.isReefer === true || info.isRf === true) return true
  return /RF|RH|REEFER/i.test(String(info.containerType || info.isoType || info.type || ''))
}

/** Trả về thông báo lỗi nếu vị trí sai khu, ngược lại trả về chuỗi rỗng. */
export const zoneViolation = (info, blockCode) => {
  const reefer = isReeferContainerInfo(info)
  const area = isReeferBlockCode(blockCode)
  if (reefer && !area) return `Container lạnh chỉ được xếp vào khu lạnh (có ổ cắm điện), không thể xếp vào Block ${blockCode}.`
  if (!reefer && area) return `Container thường không được xếp vào khu lạnh (Block ${blockCode}). Hãy chọn khu bãi thường.`
  return ''
}

export const allowedBlocksFor = (info, blocks) => blocks.filter((b) => isReeferBlockCode(b.blockCode || b.code) === isReeferContainerInfo(info))
