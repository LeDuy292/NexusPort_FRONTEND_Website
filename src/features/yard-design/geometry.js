export const areaPolygon = area => area.polygon || [[area.x,area.y],[area.x+area.width,area.y],[area.x+area.width,area.y+area.height],[area.x,area.y+area.height]]
export const pointInArea = (area,t,r) => {
  const [a,b,c,d]=areaPolygon(area)
  return [0,1].map(i=>(a[i]*(1-t)+d[i]*t)*(1-r)+(b[i]*(1-t)+c[i]*t)*r)
}
export const areaColor = (layout,area) => layout.zones.find(zone=>zone.code===area.zone)?.color || '#3b776d'

// The nearest cardinal direction is vertical: +37.7 degrees, not -52.3.
export const MODULE_PITCH = 7.5 // schematic units per 20-foot module; not metres
export const STRAIGHT_ANGLE = Math.atan2(.61,.79)*180/Math.PI
export const rotatePoint = ([x,y],angle) => {
  const radians=angle*Math.PI/180
  return [x*Math.cos(radians)-y*Math.sin(radians),x*Math.sin(radians)+y*Math.cos(radians)]
}
export function mapFrame(layout,angle=0) {
  if(!angle)return {x:0,y:0,width:layout.width,height:layout.height}
  const shapes=[...layout.areas,...layout.berths,...layout.facilities.filter(item=>!item.external)]
  const vertices=[...shapes.flatMap(item=>[...areaPolygon(item),...(item.labelPosition?[item.labelPosition]:[])]),...layout.facilities.filter(item=>item.external).map(item=>item.labelPosition)]
  const transformed=vertices.map(point=>rotatePoint(point,angle))
  const xs=transformed.map(point=>point[0]),ys=transformed.map(point=>point[1])
  const x=Math.min(...xs)-70,y=Math.min(...ys)-65
  return {x,y,width:Math.max(...xs)-x+100,height:Math.max(...ys)-y+90}
}

const rectangle = (x,y,width,height) => [[x,y],[x+width,y],[x+width,y+height],[x,y+height]]
const center = polygon => polygon.reduce((sum,p)=>[sum[0]+p[0]/polygon.length,sum[1]+p[1]/polygon.length],[0,0])
const bounds = polygon => {
  const xs=polygon.map(p=>p[0]),ys=polygon.map(p=>p[1])
  const x=Math.min(...xs),y=Math.min(...ys)
  return {x,y,width:Math.max(...xs)-x,height:Math.max(...ys)-y}
}

/** Presentation geometry in one shared orthogonal frame. The source drawing
 * remains separate for comparison. Snap building/block edges, never each layer
 * independently; the yard margins below leave shared circulation corridors. */
export function cleanDesign(layout) {
  const rotate = polygon => polygon.map(p=>rotatePoint(p,STRAIGHT_ANGLE))
  // Shared columns across the main road; equal strip widths and clear gaps.
  const columns={}
  const columnPairs=[['E','I'],['F','J'],['G','K'],['H','L'],['U','M'],['V','N'],['W','O'],['X','P'],['Y','Q'],['Z','R'],['AA','S'],['AB','T']]
  columnPairs.forEach((codes,index)=>codes.forEach(code=>{columns[code]=352+index*40}))
  ;['A','B','C','D'].forEach((code,index)=>{columns[code]=124+index*40})
  ;['AC','AD','AE','AF'].forEach((code,index)=>{columns[code]=352+index*40})
  const areas=layout.areas.map(area=>{
    const p=rotate(area.polygon),b=bounds(p)
    let x=Math.round((p[0][0]+p[3][0])/2),y=Math.round(b.y)
    let width=Math.round(((p[1][0]+p[2][0])-(p[0][0]+p[3][0]))/2)
    const referenceCode=area.referenceCode||area.code
    if(columns[referenceCode]!==undefined){width=20;x=columns[referenceCode]-width/2}
    let bottom=Math.round(b.y+b.height)
    if(area.zone==='CY45')bottom=810
    if(area.zone==='CENTRAL'){y=980;bottom=1185}
    if(area.zone==='WAREHOUSE-YARD'){y=1325;bottom=1485}
    // All road-facing block heads share the E–H baseline.
    if(['mixed-1','mixed-2'].includes(area.sourceGroup))bottom=1185
    // Keep the stepped landward ends inside their sloped yard boundary.
    if(area.sourceGroup==='mixed-1')y=Math.max(y,Math.ceil(900+(x+width-498)*108/152)+8)
    if(area.sourceGroup==='mixed-2')y=Math.max(y,Math.ceil(1014+(x+width-654)*117/156)+8)
    const bayModules=area.planning?.bayModules??Math.max(1,Math.floor((bottom-y)/MODULE_PITCH))
    y=bottom-bayModules*MODULE_PITCH
    const polygon=rectangle(x,y,width,bottom-y)
    const planning={...area.planning,bayModules,rows:area.planning?.rows||6,tiers:area.planning?.tiers||4,lengthBasis:area.planning?.lengthBasis||'estimated'}
    return {...area,...bounds(polygon),polygon,label:center(polygon),planning}
  })
  const facilities=layout.facilities.filter(f=>!f.external).map(item=>{
    const p=rotate(item.polygon),c=center(p)
    const width=Math.round((Math.hypot(p[1][0]-p[0][0],p[1][1]-p[0][1])+Math.hypot(p[2][0]-p[3][0],p[2][1]-p[3][1]))/2)
    let height=Math.round((Math.hypot(p[3][0]-p[0][0],p[3][1]-p[0][1])+Math.hypot(p[2][0]-p[1][0],p[2][1]-p[1][1]))/2)
    let y=Math.round(c[1]-height/2)
    if(item.code==='OFFICE')y=1232
    if(item.code==='CUSTOMS')y=1230
    if(item.code==='CFS-02')height=Math.min(...areas.filter(area=>area.sector==='D').map(area=>area.y))-12-y
    const polygon=rectangle(Math.round(c[0]-width/2),y,width,height)
    return {...item,...bounds(polygon),polygon,labelPosition:center(polygon)}
  })
  const mixedYards=[
    {code:'mixed-1',label:'Bãi tổng hợp 1',polygon:[[498,900],[650,1008],[650,1192],[498,1192]]},
    {code:'mixed-2',label:'Bãi tổng hợp 2',polygon:[[654,1014],[810,1131],[810,1192],[654,1192]]},
    {code:'mixed-3',label:'Bãi tổng hợp 3',polygon:rectangle(334,894,156,70)},
  ]
  // Reserve the gaps between strips for Bay-axis truck access. Coordinates are
  // schematic image units, not certified road widths or turning clearances.
  const laneGroups={}
  for(const area of areas){
    const group=area.zone==='MIXED'?area.sourceGroup:['SOUTH','RTG','ERTG'].includes(area.zone)?'waterfront':area.zone
    ;(laneGroups[group]??=[]).push(area)
  }
  const transferLanes=[]
  for(const [group,items] of Object.entries(laneGroups)) {
    const ordered=[...items].sort((a,b)=>a.x-b.x)
    for(let i=1;i<ordered.length;i++) {
      const left=ordered[i-1],right=ordered[i],gap=right.x-left.x-left.width
      const x=left.x+left.width+gap/2
      // This gap already has the existing full-length circulation aisle.
      if(group==='waterfront'&&Math.abs(x-532)<2)continue
      const end=group==='CY45'?832:group==='mixed-3'?972:['waterfront','WAREHOUSE-YARD'].includes(group)?1518:1210
      const start=group==='waterfront'?1210:Math.min(left.y,right.y)
      transferLanes.push({id:`bay-access-${left.code}-${right.code}`,axis:'bay',serves:[left.code,right.code],width:Math.min(8,gap-2),points:[[x,start],[x,end]]})
    }
  }
  transferLanes.push({id:'central-head-aisle',axis:'row',serves:areas.filter(a=>a.sourceGroup==='mixed-3').map(a=>a.code),width:6,points:[[314,972],[485,972]]})
  transferLanes.push({id:'bay-access-R-S',axis:'bay',serves:['C10','D01'],width:8,points:[[732,1210],[732,1518]]})
  return {...layout,areas,facilities,mixedYards,
    transferLanes,
    frame:{x:0,y:470,width:1050,height:1260},
    // One perimeter, then disjoint yard outlines. No duplicate land/yard edges.
    terminal:[[74,510],[310,690],[310,850],[340,875],[480,890],[640,1015],[800,1138],[920,1180],[1032,1180],[1032,1552],[425,1552],[395,1580],[350,1705],[315,1705],[315,1300],[305,1280],[305,885],[74,885]],
    yardEnclosures:[
      {code:'cy45',polygon:[[90,528],[278,670],[278,824],[90,824]]},
      {code:'central',polygon:rectangle(330,970,156,222)},
      {code:'south',polygon:rectangle(338,1236,388,272)},
      {code:'warehouse-yard',polygon:rectangle(738,1359,72,149)},
    ],
    aprons:[
      {code:'TS45',polygon:[[28,490],[74,490],[74,840],[300,840],[300,885],[28,885]],convexParts:[rectangle(28,490,46,350),rectangle(28,840,272,45)]},
      {code:'TS1',polygon:rectangle(52,1040,260,45)},
      {code:'TS2',polygon:rectangle(85,1205,242,42)},
      {code:'TS3',polygon:rectangle(270,1330,45,370)},
    ],
    berthLabels:[{label:'CẦU 4',point:[51,720],vertical:true},{label:'CẦU 5',point:[190,863]},{label:'CẦU 1',point:[175,1067]},{label:'CẦU 2',point:[192,1231]},{label:'CẦU 3',point:[293,1530],vertical:true}],
    // Suggested circulation for the design review, not surveyed traffic lanes.
    // The yellow source strip is deliberately not classified as a road.
    roads:[
      {id:'gate-to-yard',kind:'internal',width:12,lanes:2,points:[[1050,1210],[335,1210]],
        // Two lanes at both ends; only the office frontage fans out to five.
        queue:{lanes:5,width:30,start:865,end:945,taperStart:835,taperEnd:975},
        polygon:[[1050,1204],[975,1204],[945,1195],[865,1195],[835,1204],[335,1204],[335,1216],[835,1216],[865,1225],[945,1225],[975,1216],[1050,1216]],
        laneDividers:[[[1050,1210],[975,1210]],[[835,1210],[335,1210]],...[-9,-3,3,9].map(offset=>[[975,1210+offset*.4],[945,1210+offset],[865,1210+offset],[835,1210+offset*.4]])],
      },
      {id:'yard-service',kind:'internal',width:10,points:[[85,832],[292,832],[314,855],[314,1210],[330,1225],[330,1518],[835,1518],[835,1210]]},
      {id:'waterfront-aisle',kind:'internal',width:8,points:[[532,1210],[532,1518]]},
    ],
    waitingArea:{code:'OFFICE-WAITING',integrated:true,lanes:5,polygon:rectangle(865,1195,80,30),status:'proposed',purpose:'5 làn chờ trước văn phòng'},
    accessPoints:[{code:'MAIN-GATE',x:1032,y:1210,width:12}],
  }
}

/** Short tangent segments and quadratic corners, including concave corners. */
export function roundedPolygon(polygon,radius=10) {
  const corners=polygon.map((p,i)=>{
    const prev=polygon[(i+polygon.length-1)%polygon.length],next=polygon[(i+1)%polygon.length]
    const before=Math.hypot(prev[0]-p[0],prev[1]-p[1]),after=Math.hypot(next[0]-p[0],next[1]-p[1])
    const r=Math.min(radius,before/3,after/3)
    return {p,start:[p[0]+(prev[0]-p[0])*r/before,p[1]+(prev[1]-p[1])*r/before],end:[p[0]+(next[0]-p[0])*r/after,p[1]+(next[1]-p[1])*r/after]}
  })
  return `M${corners[0].start.join(' ')} `+corners.map((c,i)=>`Q${c.p.join(' ')} ${c.end.join(' ')} L${corners[(i+1)%corners.length].start.join(' ')}`).join(' ')+' Z'
}
