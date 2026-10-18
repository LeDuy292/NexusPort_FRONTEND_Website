// Socket events remain immediate; HTTP is a fallback for missed events.
export const SESSION_HEARTBEAT_MS = 15000

export function createSessionHeartbeat({getToken,isVisible,request,onUnauthorized,now=Date.now}) {
  let active=true,inFlight=false,lastStarted=-Infinity
  const controller=new AbortController()
  return {
    async check() {
      if(!active||!isVisible()||inFlight||now()-lastStarted<2000)return
      const token=getToken()
      if(!token)return
      inFlight=true;lastStarted=now()
      try{
        const response=await request(token,controller.signal)
        if(response.status===401){
          const body=await response.json().catch(()=>({}))
          // An older account/request cannot log out a newer login.
          if(active&&getToken()===token&&(body.code==='SESSION_KICKED'||!body.success))onUnauthorized()
        }
      }catch{ /* A network outage is not an authentication failure. */ }
      finally{inFlight=false}
    },
    stop(){active=false;controller.abort()}
  }
}
