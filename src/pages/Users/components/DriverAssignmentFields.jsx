import { useEffect, useState } from 'react'
import { getDriverAssignmentOptions } from '../../../services/driverBookingService'

export default function DriverAssignmentFields({ userId, carrierId, driverId, onChange }) {
  const [carriers, setCarriers] = useState([])
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    let active = true
    setLoading(true)
    getDriverAssignmentOptions().then(({ carriers: companies, profiles: items }) => {
      if (!active) return
      setCarriers(companies)
      setProfiles(items)
      const linked = userId && items.find(item => item.userId === userId)
      if (linked && !carrierId && !driverId) onChange({ carrierId: linked.carrierId, driverId: linked.id })
      setError('')
    }).catch(err => { if (active) setError(err.message || 'Không tải được hồ sơ tài xế.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [userId, revision])

  return <div className="space-y-3 rounded-xl border border-orange-200 bg-orange-50 p-4">
    <div>
      <p className="text-sm font-bold text-carbon">Hồ sơ tài xế & công ty vận tải</p>
      <p className="text-xs text-slate mt-1">Chọn công ty trước, sau đó chọn hồ sơ tài xế của công ty. Tài khoản và liên kết được lưu cùng lúc.</p>
    </div>
    <label className="block text-xs font-bold text-slate">Công ty vận tải *</label>
    <select required disabled={loading} value={carrierId || ''} onChange={event => onChange({ carrierId: event.target.value, driverId: '' })}
      className="w-full rounded-lg border border-chalk bg-white p-2 text-sm">
      <option value="">{loading ? 'Đang tải…' : 'Chọn công ty vận tải'}</option>
      {carriers.map(company => <option key={company.id} value={company.id}>{company.companyName}</option>)}
    </select>
    <label className="block text-xs font-bold text-slate">Hồ sơ tài xế *</label>
    <select required disabled={loading || !carrierId} value={driverId || ''} onChange={event => onChange({ carrierId, driverId: event.target.value })}
      className="w-full rounded-lg border border-chalk bg-white p-2 text-sm">
      <option value="">Chọn tài xế thuộc công ty</option>
      {profiles.filter(profile => profile.carrierId === carrierId).map(profile => <option key={profile.id} value={profile.id} disabled={!!profile.userId && profile.userId !== userId}>
        {profile.fullName} · GPLX {profile.licenseNumber}{profile.userId && profile.userId !== userId ? ' (đã có tài khoản)' : ''}
      </option>)}
    </select>
    {error && <p className="text-xs text-red-600">{error} <button type="button" onClick={() => setRevision(value => value + 1)} className="underline">Thử lại</button></p>}
    {carrierId && !loading && !profiles.some(profile => profile.carrierId === carrierId) && <p className="text-xs text-slate">Công ty chưa có hồ sơ tài xế. Hãy thêm tài xế trong đội xe của công ty trước khi cấp tài khoản.</p>}
  </div>
}
