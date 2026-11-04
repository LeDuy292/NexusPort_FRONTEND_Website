import { useEffect, useMemo, useRef, useState } from 'react'
import TienSaMap from '../../features/yard-design/TienSaMap'
import sourceLayout from '../../features/yard-design/tienSaLayout.json'
import {cleanDesign} from '../../features/yard-design/geometry'
import BlockDetail from '../../features/yard-design/BlockDetail'
import '../../features/yard-design/YardDesignPreview.css'

export default function YardDesignPreview() {
  const pageRoot=useRef(null)
  const layout=useMemo(()=>cleanDesign(sourceLayout),[])
  const [detail,setDetail]=useState(false)
  const [code,setCode]=useState('')
  const [query,setQuery]=useState('')
  const [message,setMessage]=useState('')
  useEffect(()=>{if(detail)pageRoot.current?.closest('main')?.scrollTo({top:0})},[code,detail])
  const selected=layout.areas.find(area=>area.code===code)
  const choose=area=>{setCode(area.code);setDetail(true);setMessage('')}
  function search(event){
    event.preventDefault()
    const term=query.trim().toUpperCase().replace(/^BLOCK\s*/,'')
    if(!term)return
    const area=layout.areas.find(item=>item.code===term)
    if(area){choose(area);return}
    setMessage('Không tìm thấy block này.')
  }
  return <div ref={pageRoot} className="yard-design-preview"><div className="yard-map-page">
    <header className="yard-page-heading">
      <div><h1>Bản đồ bãi container</h1><p>Cảng Tiên Sa</p></div>
      <form className="yard-map-search" onSubmit={search}>
        <label className="yard-sr-only" htmlFor="design-map-search">Tìm block</label>
        <input id="design-map-search" value={query} onChange={event=>setQuery(event.target.value)} placeholder="A01, B02, G04…"/>
        <button type="submit">Tìm</button>
      </form>
    </header>
    {message&&<p className="yard-page-message" role="status">{message}</p>}
    <div hidden={detail}><TienSaMap layout={sourceLayout} selectedCode={code} onSelectArea={choose}/></div>
    {detail&&selected&&<BlockDetail key={selected.code} area={selected} maxModules={Math.max(...layout.areas.map(area=>area.planning.bayModules))} onBack={()=>setDetail(false)}/>}
    <div className="yard-selection-strip" aria-live="polite">
      {selected?<><strong>Block {selected.code}</strong><span>{layout.sectors.find(sector=>sector.code===selected.sector).label}</span><button type="button" onClick={()=>{setCode('');setDetail(false)}}>Bỏ chọn</button></>:<span>Chọn một block trên bản đồ để xem khu bãi.</span>}
    </div>
    <details className="yard-block-directory"><summary>Danh sách block <span>7 khu · 32 block</span></summary>
      {layout.sectors.map(zone=><div className="yard-block-group" key={zone.code}><strong>{zone.label}</strong><div>{layout.areas.filter(area=>area.sector===zone.code).map(area=><button type="button" key={area.code} aria-label={`Chọn block ${area.code}`} aria-pressed={code===area.code} onClick={()=>choose(area)}>{area.code}</button>)}</div></div>)}
    </details>
  </div></div>
}
