import { useState } from 'react'
import { journeyStep, journeySteps } from './dispatchJourney'

export default function DispatchJourney({ booking, route }) {
  const active = journeyStep(booking, route)
  const [inspect, setInspect] = useState(null)
  const selected = inspect ?? active
  return <section className="dispatch-journey" aria-label="Các chặng hành trình">
    <h3>Các chặng hành trình</h3>
    <ol>{journeySteps.map(([label], index) => <li key={label} className={active === 6 || index < active ? 'done' : index === active ? 'active' : 'pending'}>
      <button type="button" onClick={() => setInspect(index)} aria-current={index === active ? 'step' : undefined} aria-pressed={selected === index}>
        <span>{active === 6 || index < active ? '✓' : index + 1}</span><strong>{label}</strong>
        <small>{active === 6 || index < active ? 'Hoàn tất' : index === active ? 'Đang thực hiện' : 'Sắp tới'}</small>
      </button>
    </li>)}</ol>
    <div className="dispatch-stage-description"><strong>{journeySteps[selected][0]}</strong><p>{journeySteps[selected][1]}</p>
      {inspect !== null && inspect !== active && <button type="button" onClick={() => setInspect(null)}>Về chặng hiện tại</button>}
    </div>
  </section>
}
