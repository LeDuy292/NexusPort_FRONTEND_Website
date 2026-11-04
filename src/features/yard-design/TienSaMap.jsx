import { useMemo, useRef, useState } from 'react'
import referenceLayout from './tienSaLayout.json'
import { areaPolygon, pointInArea, cleanDesign, roundedPolygon, STRAIGHT_ANGLE } from './geometry'
import './TienSaMap.css'

const points = polygon => polygon.map(point => point.join(',')).join(' ')
const activate = callback => event => { if (['Enter',' '].includes(event.key)) {event.preventDefault();callback()} }
const facilityNames = {'CFS-01':'Kho CFS','CFS-02':'CFS 2',OFFICE:'Văn phòng',CUSTOMS:'Hải quan',WAREHOUSE:'Kho',WORKSHOP:'Xưởng'}

export default function TienSaMap({layout=referenceLayout,selectedCode,onSelectArea}) {
  const design=useMemo(()=>cleanDesign(layout),[layout])
  const [source,setSource]=useState('design')
  const [includeProposed,setIncludeProposed]=useState(true)
  const [compare,setCompare]=useState(false)
  const [zoom,setZoom]=useState(1)
  const [pan,setPan]=useState({x:0,y:0})
  const viewport=useRef(null),drag=useRef(null)
  const image=source==='investment'?layout.references.find(item=>item.id==='investment'):null
  const drawing=design
  const geometryAngle=-STRAIGHT_ANGLE
  const upright=(x,y)=>geometryAngle?`rotate(${-geometryAngle} ${x} ${y})`:undefined
  const frame={x:260,y:270,width:1490,height:970}
  const view=image?{x:0,y:0,width:layout.width,height:layout.height}:frame
  const visibleAreas=drawing.areas.filter(item=>includeProposed||item.geometryStatus!=='proposed')
  const fit=()=>{setZoom(1);setPan({x:0,y:0})}
  const changeSource=value=>{setSource(value);fit()}
  const changeZoom=value=>{const next=Math.max(1,Math.min(3,value));setZoom(next);if(next===1)setPan({x:0,y:0})}
  const startDrag=event=>{
    if(zoom===1||event.button!==0||event.target.closest('[data-map-item]'))return
    const box=event.currentTarget.getBoundingClientRect()
    drag.current={x:event.clientX,y:event.clientY,pan,scale:Math.max(view.width/zoom/box.width,view.height/zoom/box.height)}
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const moveDrag=event=>{
    if(!drag.current)return
    const item=drag.current
    setPan({x:Math.max(0,Math.min(view.width-view.width/zoom,item.pan.x-(event.clientX-item.x)*item.scale)),y:Math.max(0,Math.min(view.height-view.height/zoom,item.pan.y-(event.clientY-item.y)*item.scale))})
  }
  return <section className="tien-sa-design-map" aria-label="Mặt bằng cảng Tiên Sa">
    <div className="yard-map-controls">
      <div className="yard-map-tabs" role="group" aria-label="Nguồn bản đồ">
        <button type="button" aria-pressed={!image} onClick={()=>changeSource('design')}>Mặt bằng 2D</button>
        <button type="button" aria-pressed={!!image} onClick={()=>changeSource('investment')}>Sơ đồ đầu tư</button>
      </div>
      <div className="yard-map-view-controls">
        <button type="button" aria-label="Thu nhỏ bản đồ" disabled={zoom===1} onClick={()=>changeZoom(zoom-.35)}>−</button>
        <span>{Math.round(zoom*100)}%</span>
        <button type="button" aria-label="Phóng to bản đồ" disabled={zoom===3} onClick={()=>changeZoom(zoom+.35)}>+</button>
        <button type="button" onClick={fit}>Vừa khung</button>
        <button type="button" onClick={()=>viewport.current?.requestFullscreen?.()}>Toàn màn hình</button>
      </div>
    </div>
    <div className="yard-layout-legend">
      {image?<label><input type="checkbox" checked={compare} onChange={event=>setCompare(event.target.checked)}/>Đối chiếu nét vẽ</label>:<>
        <span><i className="reference-key"/>Block theo sơ đồ</span>
        <span><i className="proposed-key"/>Block bổ sung</span>
        <label><input type="checkbox" checked={includeProposed} onChange={event=>setIncludeProposed(event.target.checked)}/>Hiện block bổ sung</label>
      </>}
    </div>
    <div ref={viewport} className={`yard-layout-viewport ${zoom>1?'can-pan':''}`}>
      <svg className="yard-layout-drawing" viewBox={`${view.x+pan.x} ${view.y+pan.y} ${view.width/zoom} ${view.height/zoom}`} role="group" aria-label="Sơ đồ cảng Tiên Sa" onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={()=>{drag.current=null}} onPointerCancel={()=>{drag.current=null}}>
        {image&&<image href={image.asset} width={layout.width} height={layout.height}/>}
        {(!image||compare)&&<g data-map-geometry="source" transform={geometryAngle?`rotate(${geometryAngle})`:undefined} opacity={image ? .55 : 1}>
          {!image&&<path d={roundedPolygon(design.terminal,9)} fill="#fff" stroke="#b9c6c7" strokeWidth="1.1"/>}
          {design.aprons.map(item=><path className="yard-apron" key={item.code} d={roundedPolygon(item.polygon,2)} fill="#eef0e9" stroke="#a4b1ad" strokeWidth="1.3"/>)}
          {drawing.yardEnclosures.map(item=><path data-yard-outline={item.code} key={item.code} d={roundedPolygon(item.polygon,12)} fill="none" stroke="#6c96aa" strokeWidth="1.6"/>)}
          {drawing.mixedYards.map(item=><path data-mixed-yard={item.code} key={item.code} d={roundedPolygon(item.polygon,10)} fill="#f2f3ec" stroke="#a2b1aa" strokeWidth="1.2"/>)}
          {drawing.roads.map(road=><g key={road.id} data-circulation-lane={road.id} data-waiting-area={road.queue?'office':undefined}>
            {road.polygon?<path data-flared-road="office" d={roundedPolygon(road.polygon,2)} fill="#e1e7e9"/>:<polyline points={points(road.points)} fill="none" stroke="#e1e7e9" strokeWidth={road.width} strokeLinejoin="round" strokeLinecap="round"/>}
            {road.laneDividers?road.laneDividers.map((divider,index)=><polyline key={index} data-lane-divider={index+1} points={points(divider)} fill="none" stroke="#fff" strokeWidth=".9" strokeDasharray="7 5"/>):road.lanes?Array.from({length:road.lanes-1},(_,i)=>{
              const offset=road.width*((i+1)/road.lanes-.5)
              return <line key={i} data-lane-divider={i+1} x1={road.points[0][0]} y1={road.points[0][1]+offset} x2={road.points[1][0]} y2={road.points[1][1]+offset} stroke="#fff" strokeWidth=".9" strokeDasharray="7 5"/>
            }):<polyline points={points(road.points)} fill="none" stroke="#fff" strokeWidth="1" strokeDasharray="5 5" strokeLinejoin="round"/>}
          </g>)}
          {drawing.transferLanes.map(lane=><g key={lane.id} data-bay-access={lane.id}>
            <polyline points={points(lane.points)} fill="none" stroke="#e1e7e9" strokeWidth={lane.width} strokeLinecap="butt"/>
            <polyline points={points(lane.points)} fill="none" stroke="#fff" strokeWidth=".65" strokeDasharray="4 5"/>
          </g>)}
          {drawing.facilities.filter(item=>!item.external).map(facility=>{
            const shape=areaPolygon(facility),center=shape.reduce((sum,p)=>[sum[0]+p[0]/shape.length,sum[1]+p[1]/shape.length],[0,0])
            const name=facilityNames[facility.code]
            const labelAngle=90
            return <g key={facility.code} className="yard-building" data-building-code={facility.code}>
              <polygon points={points(shape)} fill={['OFFICE','CUSTOMS','BUILDING-02'].includes(facility.code)?'#edce91':facility.kind==='power'?'#9fabb6':facility.status==='unconfirmed'?'#f8f8f4':'#d5e5ee'} stroke="#91a8b2" strokeWidth="1"/>
              {name&&!image&&<text transform={`rotate(${labelAngle} ${center.join(' ')})`} x={center[0]} y={center[1]+4} textAnchor="middle" className="yard-facility-label">{name}</text>}
            </g>
          })}
          {visibleAreas.map(area=>{
            const shape=areaPolygon(area),center=area.label,proposed=area.geometryStatus==='proposed',active=selectedCode===area.code
            const length=Math.hypot(shape[3][0]-shape[0][0],shape[3][1]-shape[0][1]),divisions=Math.max(3,Math.round(length/15))
            return <g key={area.code} className="design-area-hit" data-map-item="block" data-area-code={area.code} role="button" tabIndex={0} aria-label={`Block ${area.code}`} aria-pressed={active} onClick={()=>onSelectArea?.(area)} onKeyDown={activate(()=>onSelectArea?.(area))}>
              <polygon points={points(shape)} fill={proposed?'#f1e5cc':'#dcebe3'} stroke={active?'#173e48':proposed?'#b8995e':'#6e9e8a'} strokeWidth={active?2.5:1}/>
              {Array.from({length:5},(_,i)=><path key={`row-${i}`} d={`M${pointInArea(area,0,(i+1)/6).join(' ')} L${pointInArea(area,1,(i+1)/6).join(' ')}`} stroke={proposed?'#ceb98c':'#a2c1af'} strokeWidth=".5"/>)}
              {Array.from({length:divisions-1},(_,i)=><path key={`bay-${i}`} d={`M${pointInArea(area,(i+1)/divisions,0).join(' ')} L${pointInArea(area,(i+1)/divisions,1).join(' ')}`} stroke={proposed?'#ceb98c':'#a2c1af'} strokeWidth=".5"/>)}
              <g transform={upright(...center)}><rect x={center[0]-16} y={center[1]-12} width="32" height="24" rx="3" fill={active?'#173e48':'#fffffff2'}/>
              <text x={center[0]} y={center[1]+5} textAnchor="middle" className={`yard-block-label ${active?'active':''}`}>{area.code}</text></g>
            </g>
          })}
          {design.berthLabels.map(item=><text key={item.label} transform={upright(...item.point)} x={item.point[0]} y={item.point[1]} textAnchor="middle" className="yard-berth-label">{item.label}</text>)}
          {drawing.accessPoints.map(gate=><g key={gate.code}><path d={`M${gate.x} ${gate.y-gate.width/2}V${gate.y+gate.width/2}`} stroke="#876c2c" strokeWidth="4"/><text transform={upright(gate.x-8,gate.y-24)} x={gate.x-8} y={gate.y-24} textAnchor="end" className="yard-facility-label">Cổng vào / ra</text></g>)}
        </g>}
      </svg>
    </div>
  </section>
}
