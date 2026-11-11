import { orderStatusLabels, paymentStatusLabels, statusTone } from './serviceOrdersApi'

export default function ServiceOrderBadge({ status, payment = false }) {
  const label = (payment ? paymentStatusLabels : orderStatusLabels)[status] || status
  return label ? <span className={`epo-badge ${statusTone(status)}`}><span aria-hidden="true" />{label}</span> : null
}
