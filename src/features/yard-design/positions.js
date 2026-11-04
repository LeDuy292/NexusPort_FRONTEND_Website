export const padPosition = value => String(value).padStart(2,'0')
export function slotAddress(area,moduleIndex,row,tier,size=20){
 const {bayModules,rows,tiers}=area.planning
 if(![20,40].includes(size)||![moduleIndex,row,tier].every(Number.isInteger)||moduleIndex<0||moduleIndex+(size===40?2:1)>bayModules||row<1||row>rows||tier<1||tier>tiers)return null
 const bay=moduleIndex*2+(size===40?2:1)
 return {bay,row,tier,code:`${area.code}.${padPosition(bay)}.${padPosition(row)}.${tier}`,modules:size===40?[moduleIndex*2+1,moduleIndex*2+3]:[moduleIndex*2+1]}
}
