import { useState, useEffect, useRef } from "react";

// ── helpers ───────────────────────────────────────────────────────────────────
const pad = (n) => String(n).padStart(2, "0");
const fmtMs = (ms) => { const s = Math.floor(ms/1000); return `${pad(Math.floor(s/60))}:${pad(s%60)}`; };
const todayKey = () => new Date().toISOString().slice(0,10);
const weekKey = () => { const d=new Date(),day=d.getDay()||7; d.setDate(d.getDate()-day+1); return `W${d.toISOString().slice(0,10)}`; };
const schoolDaysFromNow = (days) => { const d=new Date(); let added=0; while(added<days){d.setDate(d.getDate()+1);const dow=d.getDay();if(dow!==0&&dow!==6)added++;} return d.toISOString().slice(0,10); };
const currentPeriod = (periods) => { const now=new Date(),hm=now.getHours()*60+now.getMinutes(); return periods.find(p=>{const[sh,sm]=p.start.split(":").map(Number),[eh,em]=p.end.split(":").map(Number);return hm>=sh*60+sm&&hm<eh*60+em;})||null; };
// returns null if OK to issue, or an object {blocked, reason, minutesLeft} if blocked
const periodWindowCheck = (periods) => {
  const now = new Date();
  const hm  = now.getHours() * 60 + now.getMinutes();
  const BUFFER = 10; // minutes
  for (const p of periods) {
    const [sh,sm] = p.start.split(":").map(Number);
    const [eh,em] = p.end.split(":").map(Number);
    const start = sh*60+sm, end = eh*60+em;
    if (hm >= start && hm < end) {
      const elapsedInPeriod   = hm - start;
      const remainingInPeriod = end - hm;
      if (elapsedInPeriod < BUFFER)
        return { blocked:true, period:p.name, reason:"first", minutesLeft: BUFFER - elapsedInPeriod };
      if (remainingInPeriod <= BUFFER)
        return { blocked:true, period:p.name, reason:"last", minutesLeft: remainingInPeriod };
      return null; // inside window, OK
    }
  }
  // Not inside any period — find next period to show helpful message
  const upcoming = periods
    .map(p => { const [sh,sm]=p.start.split(":").map(Number); return { name:p.name, start:sh*60+sm }; })
    .filter(p => p.start > hm)
    .sort((a,b) => a.start - b.start)[0];
  const minutesLeft = upcoming ? upcoming.start - hm : null;
  return { blocked:true, period:null, reason:"outside", minutesLeft, nextPeriod: upcoming?.name || null };
};
const initials = (name) => name.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase();
const avatarColor = (id) => { const hues=[210,280,330,170,30,60,190,310,240,0,150,200]; return `hsl(${hues[id%hues.length]},60%,52%)`; };

// ── seed data ─────────────────────────────────────────────────────────────────
let _sid = 1;
const mk = (name, period) => ({ id: _sid++, name, period });

const SEED_PERIODS = [
  { id:"P1",  name:"Period 1",  start:"08:45", end:"09:43" },
  { id:"P2",  name:"Period 2",  start:"09:48", end:"10:46" },
  { id:"P3",  name:"Period 3",  start:"11:41", end:"12:39" },
  { id:"ADV", name:"Advisory",  start:"12:44", end:"13:09" },
  { id:"P4",  name:"Period 4",  start:"13:44", end:"14:12" },
  { id:"P5",  name:"Period 5",  start:"14:17", end:"15:10" },
];

const WVW_PERIODS = [
  { id:"P5",  name:"Period 5",  start:"08:45", end:"09:35" },
  { id:"P1",  name:"Period 1",  start:"09:40", end:"10:30" },
  { id:"P2",  name:"Period 2",  start:"11:25", end:"12:15" },
  { id:"P3",  name:"Period 3",  start:"12:20", end:"13:10" },
  { id:"P4",  name:"Period 4",  start:"13:15", end:"14:05" },
  { id:"ADV", name:"Advisory",  start:"14:10", end:"15:10" },
];

const SCHEDULES = {
  regular: { label:"Regular",  periods: SEED_PERIODS },
  wvw:     { label:"WVW",      periods: WVW_PERIODS  },
};

const SEED_STUDENTS = [
  mk("Paola","P1"), mk("Aida","P1"), mk("Kasey","P1"), mk("Ava","P1"),
  mk("Kamarie","P1"), mk("Don'Maira","P1"), mk("Gregory","P1"), mk("Mayra","P1"),
  mk("Jostin R.","P1"), mk("Jostin S.","P1"), mk("Samantha","P1"),
  mk("Alexander","P1"), mk("Lily","P1"), mk("Zari'Anna","P1"), mk("NeKwaur","P1"),
  mk("Marco","P2"), mk("Andrea","P2"), mk("Tykara","P2"), mk("Nyimah","P2"),
  mk("Delilah","P2"), mk("Valentina","P2"), mk("Ibrahim","P2"), mk("Byron","P2"),
  mk("Carlos","P2"), mk("Andrew","P2"), mk("Manny","P2"),
  mk("Samar'j","P2"), mk("Aisha","P2"), mk("Fernando","P2"), mk("Jackeline","P2"),
  mk("Isaí","P2"), mk("J'Zyra","P2"), mk("Ja'cory","P2"), mk("Marie","P2"),
  mk("Heyner","P2"), mk("Genesis G.","P2"),
  mk("Anthony","P5"), mk("Kimberly","P5"), mk("Lena","P5"), mk("Joshua","P5"),
  mk("Litzy","P5"), mk("Gabriel","P5"), mk("Emily","P5"), mk("Carlos M.","P5"),
  mk("Genesis N.","P5"), mk("Wilson","P5"), mk("Ashley","P5"), mk("Zyykee","P5"),
  mk("Jian","P5"), mk("Tukiya","P5"),
];

const SEED_BATHROOMS = [{ id:"GYM", name:"Gym Corridor", capacity:1 }];

const YELLOW_MS    = 5 * 60 * 1000;
const RED_MS       = 10 * 60 * 1000;
const LOCKOUT_DAYS = 3;

// ── design tokens ─────────────────────────────────────────────────────────────
const C = {
  bg:"#fafafa", white:"#ffffff", border:"#dbdbdb",
  text:"#111111", sub:"#737373", blue:"#0095f6",
  green:"#22c55e", yellow:"#f59e0b", red:"#ef4444",
  greenBg:"#f0fdf4",
};
const GRAD = `linear-gradient(45deg,#f58529,#dd2a7b,#8134af,#515bd4)`;
const GRAD_SOFT = `linear-gradient(135deg,#f58529 0%,#dd2a7b 50%,#515bd4 100%)`;

const pill = (bg,color,size=11) => ({ background:bg,color,borderRadius:20,padding:`2px 9px`,fontSize:size,fontWeight:700,display:"inline-flex",alignItems:"center",gap:3 });
const igBtn = (variant="primary") => ({
  borderRadius:10,fontFamily:"inherit",fontWeight:700,fontSize:14,cursor:"pointer",border:"none",padding:"9px 20px",transition:"opacity .15s,transform .1s",
  ...(variant==="primary"?{background:C.blue,color:"#fff"}:{}),
  ...(variant==="ghost"  ?{background:"transparent",border:`1.5px solid ${C.border}`,color:C.text}:{}),
  ...(variant==="danger" ?{background:"transparent",border:`1.5px solid ${C.red}`,color:C.red}:{}),
  ...(variant==="grad"   ?{background:GRAD,color:"#fff"}:{}),
});
const igInput = { background:"#fafafa",border:`1.5px solid ${C.border}`,borderRadius:10,color:C.text,fontFamily:"inherit",fontSize:14,padding:"10px 14px",outline:"none",width:"100%",boxSizing:"border-box",transition:"border-color .2s" };
const card = { background:C.white,border:`1px solid ${C.border}`,borderRadius:16,padding:"16px",marginBottom:12 };

const NAV = [
  { id:"dashboard", label:"Home",     d:"M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" },
  { id:"students",  label:"Students", d:"M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" },
  { id:"rules",     label:"Rules",    d:"M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" },
  { id:"history",   label:"History",  d:"M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" },
  { id:"settings",  label:"More",     d:"M4 6h16M4 12h16M4 18h16" },
];

function Avatar({ student, size=42, ring=false }) {
  const bg = avatarColor(student.id);
  return (
    <div style={{ position:"relative", flexShrink:0, width:size, height:size }}>
      {ring && <div style={{ position:"absolute",inset:-2.5,borderRadius:"50%",background:GRAD,zIndex:0 }} />}
      <div style={{ width:size,height:size,borderRadius:"50%",background:bg,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:size*0.35,position:"relative",zIndex:1,border:ring?`2.5px solid ${C.white}`:"none" }}>
        {initials(student.name)}
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
export default function App() {
  const [tab, setTab]                   = useState("dashboard");
  const [students, setStudents]         = useState(SEED_STUDENTS);
  const [bathrooms, setBathrooms]       = useState(SEED_BATHROOMS);
  const [scheduleKey, setScheduleKey]   = useState("regular");
  const periods                         = SCHEDULES[scheduleKey].periods;
  const [passes, setPasses]             = useState([]);
  const [history, setHistory]           = useState([]);
  const [alerts, setAlerts]             = useState([]);
  const [dailyCount, setDailyCount]     = useState({});
  const [weeklyCount, setWeeklyCount]   = useState({});
  const [lockouts, setLockouts]         = useState({});
  const [restrictions, setRestrictions] = useState([]);
  const [conflicts, setConflicts]       = useState([]);
  const [settings, setSettings]         = useState({ dailyLimit:3, weeklyLimit:2, adminEmail:"jose.melgarejoanillo@k12.dc.gov" });
  const [newStudent, setNewStudent]     = useState({ name:"", period:"P1" });
  const [passModal, setPassModal]       = useState(null);
  const [selectedBath, setSelectedBath] = useState("GYM");
  const [periodFilter, setPeriodFilter] = useState("ALL");
  const [searchQ, setSearchQ]           = useState("");
  const [tick, setTick]                 = useState(0);
  const tickRef = useRef();

  useEffect(() => { tickRef.current=setInterval(()=>setTick(t=>t+1),1000); return()=>clearInterval(tickRef.current); },[]);

  useEffect(() => {
    const now=Date.now();
    passes.forEach(p=>{
      const el=now-p.startTime;
      if (!p.alertSent&&el>=YELLOW_MS){ pushAlert("warning",`⚠️ ${sName(p.studentId)} has been gone ${fmtMs(el)}`,p.studentId); setPasses(ps=>ps.map(x=>x.id===p.id?{...x,alertSent:true}:x)); }
      if (!p.redSent&&el>=RED_MS){ pushAlert("red",`🚨 RED CODE — ${sName(p.studentId)} gone ${fmtMs(el)}. Locked ${LOCKOUT_DAYS} days.`,p.studentId); setLockouts(l=>({...l,[p.studentId]:schoolDaysFromNow(LOCKOUT_DAYS)})); setPasses(ps=>ps.map(x=>x.id===p.id?{...x,redSent:true}:x)); }
    });
  },[tick]);

  const sName=(id)=>students.find(s=>s.id===id)?.name||"Unknown";
  const pushAlert=(type,msg,studentId)=>setAlerts(a=>[{id:Date.now(),type,msg,studentId,time:new Date().toLocaleTimeString()},...a].slice(0,50));

  const issuePass=()=>{
    const sid=passModal; if(!sid||!selectedBath) return;
    const lo=lockouts[sid]; if(lo&&todayKey()<=lo){pushAlert("warning",`${sName(sid)} is locked out until ${lo}.`,sid);setPassModal(null);return;}
    // period window check — block first & last 10 min and outside period hours
    const win=periodWindowCheck(periods);
    if(win){
      const msg = win.reason==="first"
        ? `🚫 No passes in the first 10 min of ${win.period}. Available in ${win.minutesLeft} min.`
        : win.reason==="last"
        ? `🚫 No passes in the last 10 min of ${win.period}. Only ${win.minutesLeft} min left.`
        : win.nextPeriod
        ? `🚫 No passes outside class time. Next period (${win.nextPeriod}) starts in ${win.minutesLeft} min.`
        : `🚫 No passes outside class hours.`;
      pushAlert("warning", msg, sid); setPassModal(null); return;
    }
    const key=`${sid}_${todayKey()}`,count=dailyCount[key]||0;
    if(count>=settings.dailyLimit){pushAlert("warning",`${sName(sid)} reached daily limit.`,sid);setPassModal(null);return;}
    const wkey=`${sid}_${weekKey()}`,wcount=weeklyCount[wkey]||0;
    if(wcount>=settings.weeklyLimit){pushAlert("warning",`${sName(sid)} reached weekly limit (${settings.weeklyLimit}).`,sid);setPassModal(null);return;}
    const cp=currentPeriod(periods);
    if(cp&&restrictions.find(r=>r.studentId===sid&&r.periodId===cp.id)){pushAlert("warning",`${sName(sid)} restricted during ${cp.name}.`,sid);setPassModal(null);return;}
    const activeIds=passes.map(p=>p.studentId);
    const cf=conflicts.find(c=>(c.a===sid&&activeIds.includes(c.b))||(c.b===sid&&activeIds.includes(c.a)));
    if(cf){const oid=cf.a===sid?cf.b:cf.a;pushAlert("warning",`Conflict: ${sName(sid)} can't be out with ${sName(oid)}.`,sid);setPassModal(null);return;}
    const bath=bathrooms.find(b=>b.id===selectedBath),inBath=passes.filter(p=>p.bathroomId===selectedBath).length;
    if(bath&&inBath>=bath.capacity){pushAlert("warning",`${bath.name} is at capacity.`,sid);setPassModal(null);return;}
    setPasses(ps=>[...ps,{id:Date.now(),studentId:sid,bathroomId:selectedBath,startTime:Date.now(),period:cp?.name||"Free",alertSent:false,redSent:false}]);
    setDailyCount(dc=>({...dc,[key]:(dc[key]||0)+1}));
    setWeeklyCount(wc=>({...wc,[wkey]:(wc[wkey]||0)+1}));
    setPassModal(null);
  };

  const returnPass=(passId)=>{
    const p=passes.find(x=>x.id===passId); if(!p) return;
    setHistory(h=>[{...p,endTime:Date.now(),elapsed:Date.now()-p.startTime},...h]);
    setPasses(ps=>ps.filter(x=>x.id!==passId));
  };

  const isLockedOut=(sid)=>{const lo=lockouts[sid];return lo&&todayKey()<=lo;};
  const dailyUsed=(sid)=>dailyCount[`${sid}_${todayKey()}`]||0;
  const weeklyUsed=(sid)=>weeklyCount[`${sid}_${weekKey()}`]||0;
  const activePass=(sid)=>passes.find(p=>p.studentId===sid);
  const redCount=alerts.filter(a=>a.type==="red").length;

  const periodWindow = periodWindowCheck(periods);
  const sharedProps = { students,setStudents,bathrooms,setBathrooms,periods,passes,history,alerts,dailyCount,weeklyCount,lockouts,setLockouts,restrictions,setRestrictions,conflicts,setConflicts,settings,setSettings,newStudent,setNewStudent,passModal,setPassModal,selectedBath,setSelectedBath,periodFilter,setPeriodFilter,searchQ,setSearchQ,tick,returnPass,issuePass,isLockedOut,dailyUsed,weeklyUsed,activePass,sName,redCount,periodWindow,scheduleKey,setScheduleKey };

  return (
    <div style={{ fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,sans-serif",background:C.bg,minHeight:"100vh",color:C.text,paddingBottom:70 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        ::-webkit-scrollbar{width:4px;height:4px;} ::-webkit-scrollbar-thumb{background:#ddd;border-radius:4px;}
        button:active{opacity:.75;}
        input:focus,select:focus{outline:none;border-color:#0095f6!important;box-shadow:0 0 0 2px #0095f618;}
        select option{background:#fff;}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
        @keyframes slideDown{from{transform:translateY(-14px);opacity:0}to{transform:translateY(0);opacity:1}}
        @keyframes pop{0%{transform:scale(.85);opacity:0}100%{transform:scale(1);opacity:1}}
        @keyframes sheetUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
      `}</style>

      {/* TOP BAR */}
      <div style={{ position:"sticky",top:0,zIndex:100,background:C.white,borderBottom:`1px solid ${C.border}` }}>
        <div style={{ maxWidth:600,margin:"0 auto",padding:"12px 16px",display:"flex",alignItems:"center",justifyContent:"space-between" }}>
          <div>
            <div style={{ fontWeight:900,fontSize:24,letterSpacing:-1,background:GRAD,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",lineHeight:1.1 }}>PassGuard</div>
            <div style={{ fontSize:10,color:C.sub,fontWeight:500,letterSpacing:.4 }}>by Jose Melgarejo · <span style={{ fontWeight:700,color: scheduleKey==="wvw"?"#dd2a7b":C.sub }}>{SCHEDULES[scheduleKey].label}</span></div>
          </div>
          <div style={{ display:"flex",alignItems:"center",gap:10 }}>
            {redCount>0&&<div style={{ ...pill(C.red,"#fff",12),animation:"pulse 1s infinite",padding:"5px 12px",borderRadius:20 }}>🚨 {redCount} RED</div>}
            <div style={{ width:36,height:36,borderRadius:"50%",background:GRAD,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:800,fontSize:14 }}>JM</div>
          </div>
        </div>
        {alerts.slice(0,2).map(a=>(
          <div key={a.id} style={{ background:a.type==="red"?"#fef2f2":"#fffbeb",borderTop:`1px solid ${a.type==="red"?C.red:C.yellow}`,padding:"8px 16px",display:"flex",justifyContent:"space-between",alignItems:"center",animation:"slideDown .3s",maxWidth:600,margin:"0 auto" }}>
            <span style={{ color:a.type==="red"?C.red:C.yellow,fontWeight:700,fontSize:13 }}>{a.msg}</span>
            <span style={{ color:C.sub,fontSize:11,flexShrink:0,marginLeft:8 }}>{a.time}</span>
          </div>
        ))}
      </div>

      {/* CONTENT */}
      <div style={{ maxWidth:600,margin:"0 auto" }}>
        {tab==="dashboard" && <DashTab {...sharedProps} />}
        {tab==="students"  && <StudentsTab {...sharedProps} />}
        {tab==="rules"     && <RulesTab {...sharedProps} />}
        {tab==="history"   && <HistoryTab {...sharedProps} />}
        {tab==="settings"  && <SettingsTab {...sharedProps} LOCKOUT_DAYS={LOCKOUT_DAYS} />}
      </div>

      {/* BOTTOM NAV */}
      <div style={{ position:"fixed",bottom:0,left:0,right:0,background:C.white,borderTop:`1px solid ${C.border}`,display:"flex",zIndex:100,paddingBottom:"env(safe-area-inset-bottom)" }}>
        {NAV.map(n=>{
          const active=tab===n.id;
          return (
            <button key={n.id} onClick={()=>setTab(n.id)} style={{ flex:1,background:"none",border:"none",padding:"10px 0 8px",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:3 }}>
              <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={active?"#dd2a7b":"#8e8e8e"} strokeWidth={active?2.5:2} strokeLinecap="round" strokeLinejoin="round">
                {n.d.split(" M").map((seg,i)=><path key={i} d={i===0?seg:"M"+seg} />)}
              </svg>
              <span style={{ fontSize:10,color:active?"#dd2a7b":"#8e8e8e",fontWeight:active?700:400 }}>{n.label}</span>
            </button>
          );
        })}
      </div>

      {/* ISSUE PASS BOTTOM SHEET */}
      {passModal&&(()=>{
        const s=students.find(x=>x.id===passModal);
        const win=periodWindow;
        return (
          <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,.55)",display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:200 }} onClick={()=>setPassModal(null)}>
            <div style={{ background:C.white,borderRadius:"24px 24px 0 0",width:"100%",maxWidth:600,padding:"20px 20px 44px",animation:"sheetUp .3s cubic-bezier(.32,.72,0,1)" }} onClick={e=>e.stopPropagation()}>
              <div style={{ width:36,height:4,background:"#e0e0e0",borderRadius:4,margin:"0 auto 20px" }} />
              {s&&<>
                <div style={{ display:"flex",alignItems:"center",gap:14,marginBottom:16 }}>
                  <Avatar student={s} size={56} ring />
                  <div>
                    <div style={{ fontWeight:800,fontSize:19 }}>{s.name}</div>
                    <div style={{ color:C.sub,fontSize:13 }}>{periods.find(p=>p.id===s.period)?.name} · Gym Corridor</div>
                  </div>
                </div>
                {win && (
                  <div style={{ background:"#fff7ed",border:`1.5px solid ${C.yellow}`,borderRadius:12,padding:"10px 14px",marginBottom:14,display:"flex",gap:10,alignItems:"center" }}>
                    <span style={{ fontSize:20 }}>{win.reason==="outside"?"🏫":"⏱️"}</span>
                    <div>
                      <div style={{ fontWeight:700,fontSize:13,color:"#92400e" }}>
                        {win.reason==="first"  && `First 10 min of ${win.period}`}
                        {win.reason==="last"   && `Last 10 min of ${win.period}`}
                        {win.reason==="outside"&& (win.nextPeriod ? `Between periods` : `Outside school hours`)}
                      </div>
                      <div style={{ fontSize:12,color:"#a16207",marginTop:1 }}>
                        {win.reason==="outside" && win.nextPeriod
                          ? <>{win.nextPeriod} starts in <b>{win.minutesLeft} min</b></>
                          : win.reason==="outside"
                          ? "Passes only allowed during class time"
                          : <>Passes unlock in <b>{win.minutesLeft} minute{win.minutesLeft!==1?"s":""}</b></>
                        }
                      </div>
                    </div>
                  </div>
                )}
                <button
                  style={{ ...igBtn(win?"ghost":"grad"),width:"100%",fontSize:16,padding:15,borderRadius:14,marginBottom:10,opacity:win?0.45:1,cursor:win?"not-allowed":"pointer" }}
                  onClick={win?undefined:issuePass}
                  disabled={!!win}
                >
                  🚽 {win ? "Passes Restricted Now" : "Issue Bathroom Pass"}
                </button>
                <button style={{ ...igBtn("ghost"),width:"100%",fontSize:15,padding:13,borderRadius:14 }} onClick={()=>setPassModal(null)}>Cancel</button>
              </>}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ══ DASHBOARD ════════════════════════════════════════════════════════════════
function DashTab({ passes,students,bathrooms,periods,alerts,dailyCount,lockouts,tick,returnPass,setPassModal,setSelectedBath,isLockedOut,dailyUsed,weeklyUsed,activePass,settings,searchQ,setSearchQ,periodFilter,setPeriodFilter,periodWindow }) {
  const cp=currentPeriod(periods);
  const totalToday=Object.entries(dailyCount).filter(([k])=>k.endsWith(todayKey())).reduce((s,[,v])=>s+v,0);
  const lockedCount=Object.values(lockouts).filter(lo=>todayKey()<=lo).length;
  const redCount=alerts.filter(a=>a.type==="red").length;

  return (
    <div>
      {/* stat row */}
      <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,padding:"16px 16px 12px" }}>
        {[{val:passes.length,label:"Active",color:C.blue},{val:totalToday,label:"Today",color:C.green},{val:redCount,label:"Alerts",color:C.red},{val:lockedCount,label:"Locked",color:C.yellow}].map(s=>(
          <div key={s.label} style={{ background:C.white,border:`1px solid ${C.border}`,borderRadius:16,padding:"12px 6px",textAlign:"center" }}>
            <div style={{ fontWeight:900,fontSize:26,color:s.color,lineHeight:1 }}>{s.val}</div>
            <div style={{ fontSize:11,color:C.sub,fontWeight:600,marginTop:3 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* active passes — story bubbles */}
      <div style={{ padding:"0 16px 16px" }}>
        <div style={{ fontWeight:800,fontSize:16,marginBottom:12 }}>Active Passes</div>
        {passes.length===0
          ? <div style={{ background:C.white,border:`1px solid ${C.border}`,borderRadius:16,padding:"24px",textAlign:"center",color:C.sub }}>
              <div style={{ fontSize:32,marginBottom:6 }}>🚽</div>
              <div style={{ fontWeight:600 }}>No passes active</div>
            </div>
          : <div style={{ display:"flex",gap:16,overflowX:"auto",paddingBottom:4 }}>
              {passes.map(p=>{
                const s=students.find(x=>x.id===p.studentId); if(!s) return null;
                return <StoryBubble key={p.id} pass={p} student={s} tick={tick} onReturn={returnPass} />;
              })}
            </div>
        }
      </div>

      {/* period window restriction banner */}
      {periodWindow && (
        <div style={{ margin:"0 16px 12px",background:"#fff7ed",border:`1.5px solid ${C.yellow}`,borderRadius:14,padding:"11px 14px",display:"flex",gap:10,alignItems:"center" }}>
          <span style={{ fontSize:22,flexShrink:0 }}>{periodWindow.reason==="outside"?"🏫":"⏱️"}</span>
          <div>
            <div style={{ fontWeight:700,fontSize:13,color:"#92400e" }}>
              {periodWindow.reason==="first" && `Passes restricted — first 10 min of ${periodWindow.period}`}
              {periodWindow.reason==="last"  && `Passes restricted — last 10 min of ${periodWindow.period}`}
              {periodWindow.reason==="outside" && (periodWindow.nextPeriod ? `No passes between periods` : `No passes outside school hours`)}
            </div>
            <div style={{ fontSize:12,color:"#a16207",marginTop:1 }}>
              {periodWindow.reason==="outside" && periodWindow.nextPeriod
                ? <><b>{periodWindow.nextPeriod}</b> starts in <b>{periodWindow.minutesLeft} min</b></>
                : periodWindow.reason==="outside"
                ? "Passes are only allowed during class time"
                : <>Unlocks in <b>{periodWindow.minutesLeft} minute{periodWindow.minutesLeft!==1?"s":""}</b></>
              }
            </div>
          </div>
        </div>
      )}

      {/* search */}
      <div style={{ padding:"0 16px 10px",position:"relative" }}>
        <span style={{ position:"absolute",left:28,top:"50%",transform:"translateY(-50%)",fontSize:16,color:C.sub }}>🔍</span>
        <input style={{ ...igInput,paddingLeft:42 }} placeholder="Search student…" value={searchQ} onChange={e=>setSearchQ(e.target.value)} />
      </div>

      {/* period filter */}
      <div style={{ display:"flex",gap:8,padding:"0 16px 14px",overflowX:"auto" }}>
        {["ALL",...periods.map(p=>p.id)].map(pid=>{
          const label=pid==="ALL"?"All":periods.find(p=>p.id===pid)?.name||pid;
          const active=periodFilter===pid, isCurrent=cp?.id===pid;
          return (
            <button key={pid} onClick={()=>setPeriodFilter(pid)} style={{ flexShrink:0,border:"none",cursor:"pointer",borderRadius:20,padding:"7px 16px",fontSize:13,fontWeight:700,transition:"all .2s",background:active?GRAD:C.white,color:active?"#fff":C.sub,border:active?"none":`1.5px solid ${C.border}`,position:"relative" }}>
              {label}
              {isCurrent&&<span style={{ position:"absolute",top:-2,right:-2,width:8,height:8,borderRadius:"50%",background:C.green,border:`2px solid ${C.bg}` }} />}
            </button>
          );
        })}
      </div>

      {/* student list */}
      {(()=>{
        const q=searchQ.trim().toLowerCase();
        const filtered=students.filter(s=>!q||s.name.toLowerCase().includes(q)).filter(s=>periodFilter==="ALL"||s.period===periodFilter);
        const groups=periodFilter==="ALL"?periods.filter(p=>filtered.some(s=>s.period===p.id)):periods.filter(p=>p.id===periodFilter);
        if(!filtered.length) return <div style={{ padding:"20px",color:C.sub,textAlign:"center" }}>No students found.</div>;
        return groups.map(period=>{
          const group=filtered.filter(s=>s.period===period.id).sort((a,b)=>a.name.localeCompare(b.name));
          if(!group.length) return null;
          const isCurrent=cp?.id===period.id;
          return (
            <div key={period.id}>
              <div style={{ padding:"8px 16px",display:"flex",alignItems:"center",gap:8,background:"#f8f8f8",borderTop:`1px solid ${C.border}`,borderBottom:`1px solid ${C.border}` }}>
                <div style={{ width:3,height:18,borderRadius:2,background:isCurrent?C.green:"#ccc" }} />
                <span style={{ fontWeight:800,fontSize:14,color:isCurrent?C.green:C.text }}>{period.name}</span>
                <span style={{ color:C.sub,fontSize:12 }}>{period.start}–{period.end}</span>
                {isCurrent&&<span style={{ ...pill("#dcfce7",C.green) }}>NOW</span>}
                <span style={{ marginLeft:"auto",color:C.sub,fontSize:12,fontWeight:600 }}>{group.length}</span>
              </div>
              {group.map(s=>{
                const ap=activePass(s.id),lo=isLockedOut(s.id),used=dailyUsed(s.id),wused=weeklyUsed(s.id),full=used>=settings.dailyLimit,wfull=wused>=settings.weeklyLimit,blocked=lo||wfull;
                return (
                  <div key={s.id} style={{ display:"flex",alignItems:"center",gap:12,padding:"11px 16px",background:C.white,borderBottom:`1px solid ${C.border}`,opacity:blocked&&!ap?.id?0.6:1 }}>
                    <Avatar student={s} size={44} ring={!!ap} />
                    <div style={{ flex:1,minWidth:0 }}>
                      <div style={{ fontWeight:700,fontSize:15,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{s.name}</div>
                      <div style={{ display:"flex",gap:5,marginTop:4,flexWrap:"wrap" }}>
                        <span style={pill(full?"#fee2e2":"#f0fdf4",full?C.red:C.green)}>{used}/{settings.dailyLimit}d</span>
                        <span style={pill(wfull?"#fee2e2":"#fefce8",wfull?C.red:C.yellow)}>{wused}/{settings.weeklyLimit}w</span>
                        {lo&&<span style={pill("#fee2e2",C.red)}>🔒 Locked</span>}
                        {ap&&<span style={pill("#fef9c3","#a16207")}>Out</span>}
                      </div>
                    </div>
                    {!ap&&!blocked
                      ? <button style={{ ...igBtn("primary"),padding:"8px 16px",fontSize:13,borderRadius:10,flexShrink:0,opacity:periodWindow?0.4:1,cursor:periodWindow?"not-allowed":"pointer" }} disabled={!!periodWindow} onClick={()=>{setPassModal(s.id);setSelectedBath("GYM");}}>Pass</button>
                      : ap
                        ? <button style={{ background:"transparent",border:`1.5px solid ${C.green}`,color:C.green,borderRadius:10,fontFamily:"inherit",fontWeight:700,fontSize:13,cursor:"pointer",padding:"8px 14px",flexShrink:0 }} onClick={()=>returnPass(ap.id)}>Return ✓</button>
                        : <span style={{ color:C.sub,fontSize:12,fontWeight:600,flexShrink:0 }}>{lo?"Locked":wfull?"Wk limit":"Full"}</span>
                    }
                  </div>
                );
              })}
            </div>
          );
        });
      })()}
    </div>
  );
}

// ── Story Bubble ──────────────────────────────────────────────────────────────
function StoryBubble({ pass, student, tick, onReturn }) {
  const el=Date.now()-pass.startTime, over=el>YELLOW_MS, red=el>=RED_MS;
  const color=red?C.red:over?C.yellow:C.green;
  const pct=Math.min(el/YELLOW_MS,1), r=30, circ=2*Math.PI*r;
  return (
    <div style={{ flexShrink:0,width:84,display:"flex",flexDirection:"column",alignItems:"center",gap:5,animation:"pop .3s" }}>
      <div style={{ position:"relative",width:72,height:72,cursor:"pointer" }} onClick={()=>onReturn(pass.id)} title="Tap to return">
        <svg width={72} height={72} style={{ position:"absolute",top:0,left:0,transform:"rotate(-90deg)" }}>
          <circle cx={36} cy={36} r={r} fill="none" stroke="#efefef" strokeWidth={4.5} />
          <circle cx={36} cy={36} r={r} fill="none" stroke={color} strokeWidth={4.5} strokeDasharray={`${pct*circ} ${circ}`} strokeLinecap="round" style={{ transition:"stroke-dasharray .8s,stroke .5s" }} />
        </svg>
        <div style={{ position:"absolute",inset:5,borderRadius:"50%",background:avatarColor(student.id),display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:800,fontSize:15 }}>
          {initials(student.name)}
        </div>
        {red&&<div style={{ position:"absolute",inset:5,borderRadius:"50%",background:"rgba(239,68,68,.2)",animation:"pulse 1s infinite" }} />}
      </div>
      <div style={{ fontWeight:800,fontSize:13,color,fontVariantNumeric:"tabular-nums" }}>{fmtMs(el)}</div>
      <div style={{ fontSize:11,color:C.sub,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:84,textAlign:"center" }}>{student.name.split(" ")[0]}</div>
      {red&&<div style={{ fontSize:9,color:C.red,fontWeight:800,animation:"pulse 1s infinite",letterSpacing:.5 }}>RED CODE</div>}
    </div>
  );
}

// ══ STUDENTS TAB ═════════════════════════════════════════════════════════════
function StudentsTab({ students,setStudents,periods,lockouts,setLockouts,dailyUsed,weeklyUsed,activePass,settings,newStudent,setNewStudent,searchQ,setSearchQ }) {
  const cp=currentPeriod(periods);
  const q=searchQ.trim().toLowerCase();
  const filtered=students.filter(s=>!q||s.name.toLowerCase().includes(q));
  const groups=periods.filter(p=>filtered.some(s=>s.period===p.id));
  return (
    <div>
      <div style={{ padding:"16px 16px 12px" }}>
        <div style={{ fontWeight:800,fontSize:18,marginBottom:12 }}>Students <span style={{ color:C.sub,fontWeight:500,fontSize:14 }}>({students.length})</span></div>
        <div style={{ position:"relative",marginBottom:12 }}>
          <span style={{ position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",fontSize:15,color:C.sub }}>🔍</span>
          <input style={{ ...igInput,paddingLeft:40 }} placeholder="Search by name…" value={searchQ} onChange={e=>setSearchQ(e.target.value)} />
        </div>
        <div style={{ ...card }}>
          <div style={{ fontWeight:700,fontSize:14,marginBottom:12 }}>Add Student</div>
          <div style={{ display:"flex",gap:8,flexWrap:"wrap",alignItems:"flex-end" }}>
            <div style={{ flex:"1 1 140px" }}>
              <div style={{ fontSize:11,fontWeight:700,color:C.sub,marginBottom:5,letterSpacing:.5 }}>FULL NAME</div>
              <input style={igInput} value={newStudent.name} onChange={e=>setNewStudent(s=>({...s,name:e.target.value}))} placeholder="Student name" onKeyDown={e=>{if(e.key==="Enter"&&newStudent.name.trim()){setStudents(ss=>[...ss,{id:Date.now(),...newStudent}]);setNewStudent({name:"",period:"P1"});}}} />
            </div>
            <div style={{ flex:"0 0 130px" }}>
              <div style={{ fontSize:11,fontWeight:700,color:C.sub,marginBottom:5,letterSpacing:.5 }}>PERIOD</div>
              <select style={igInput} value={newStudent.period} onChange={e=>setNewStudent(s=>({...s,period:e.target.value}))}>
                {periods.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <button style={{ ...igBtn("grad"),flexShrink:0,borderRadius:10,padding:"10px 18px" }} onClick={()=>{if(!newStudent.name.trim())return;setStudents(ss=>[...ss,{id:Date.now(),...newStudent}]);setNewStudent({name:"",period:"P1"});}}>+ Add</button>
          </div>
        </div>
      </div>
      {groups.map(period=>{
        const group=filtered.filter(s=>s.period===period.id).sort((a,b)=>a.name.localeCompare(b.name));
        if(!group.length) return null;
        const isCurrent=cp?.id===period.id;
        return (
          <div key={period.id}>
            <div style={{ padding:"8px 16px",display:"flex",alignItems:"center",gap:8,background:"#f8f8f8",borderTop:`1px solid ${C.border}`,borderBottom:`1px solid ${C.border}` }}>
              <div style={{ width:3,height:18,borderRadius:2,background:isCurrent?C.green:"#ccc" }} />
              <span style={{ fontWeight:800,fontSize:14,color:isCurrent?C.green:C.text }}>{period.name}</span>
              <span style={{ color:C.sub,fontSize:12 }}>{period.start}–{period.end}</span>
              {isCurrent&&<span style={{ ...pill("#dcfce7",C.green) }}>NOW</span>}
              <span style={{ marginLeft:"auto",color:C.sub,fontSize:12,fontWeight:600 }}>{group.length}</span>
            </div>
            {group.map((s,i)=>{
              const lo=lockouts[s.id],locked=lo&&todayKey()<=lo,ap=activePass(s.id);
              return (
                <div key={s.id} style={{ display:"flex",alignItems:"center",gap:12,padding:"10px 16px",background:C.white,borderBottom:`1px solid ${C.border}` }}>
                  <span style={{ color:C.sub,fontSize:12,fontWeight:600,width:22,textAlign:"right",flexShrink:0 }}>{i+1}</span>
                  <Avatar student={s} size={40} ring={!!ap} />
                  <div style={{ flex:1,minWidth:0 }}>
                    <div style={{ fontWeight:700,fontSize:14,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{s.name}</div>
                    <div style={{ display:"flex",gap:4,marginTop:3,flexWrap:"wrap" }}>
                      <span style={pill("#f0f9ff","#0369a1")}>{dailyUsed(s.id)}/{settings.dailyLimit}d</span>
                      <span style={pill("#fefce8","#a16207")}>{weeklyUsed(s.id)}/{settings.weeklyLimit}w</span>
                      {locked&&<span style={pill("#fee2e2",C.red)}>🔒 {lo}</span>}
                      {ap&&<span style={pill("#fef9c3","#a16207")}>Out</span>}
                    </div>
                  </div>
                  <div style={{ display:"flex",gap:6,flexShrink:0 }}>
                    {locked
                      ? <button style={{ ...igBtn("ghost"),fontSize:12,padding:"6px 12px",borderRadius:8 }} onClick={()=>setLockouts(l=>{const n={...l};delete n[s.id];return n;})}>Unlock</button>
                      : <button style={{ ...igBtn("danger"),fontSize:12,padding:"6px 12px",borderRadius:8 }} onClick={()=>setLockouts(l=>({...l,[s.id]:schoolDaysFromNow(LOCKOUT_DAYS)}))}>Lock</button>
                    }
                    <button style={{ ...igBtn("danger"),fontSize:12,padding:"6px 10px",borderRadius:8 }} onClick={()=>setStudents(ss=>ss.filter(x=>x.id!==s.id))}>✕</button>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

// ══ RULES TAB ════════════════════════════════════════════════════════════════
function RulesTab({ students,periods,restrictions,setRestrictions,conflicts,setConflicts,settings,setSettings,weeklyUsed }) {
  const [rSid,setRSid]=useState(students[0]?.id||"");
  const [rPid,setRPid]=useState(periods[0]?.id||"");
  const [cSa,setCSa]=useState(students[0]?.id||"");
  const [cSb,setCSb]=useState(students[1]?.id||"");
  return (
    <div style={{ padding:16 }}>
      <div style={{ fontWeight:800,fontSize:18,marginBottom:16 }}>Rules</div>

      {/* weekly limit card */}
      <div style={{ borderRadius:20,overflow:"hidden",border:`1px solid ${C.border}`,marginBottom:16,background:C.white }}>
        <div style={{ background:GRAD_SOFT,padding:"16px 20px" }}>
          <div style={{ fontWeight:800,fontSize:16,color:"#fff" }}>📅 Weekly Pass Limit</div>
          <div style={{ color:"rgba(255,255,255,.8)",fontSize:13,marginTop:2 }}>Passes allowed per student per school week</div>
        </div>
        <div style={{ padding:"16px 20px" }}>
          <div style={{ display:"flex",alignItems:"center",justifyContent:"center",gap:24,marginBottom:20 }}>
            <button style={{ width:44,height:44,borderRadius:"50%",border:`2px solid ${C.border}`,background:"none",fontSize:24,cursor:"pointer",color:C.text,lineHeight:1 }} onClick={()=>setSettings(s=>({...s,weeklyLimit:Math.max(1,s.weeklyLimit-1)}))}>−</button>
            <div style={{ textAlign:"center" }}>
              <div style={{ fontWeight:900,fontSize:56,lineHeight:1,background:GRAD,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent" }}>{settings.weeklyLimit}</div>
              <div style={{ fontSize:12,color:C.sub,fontWeight:600 }}>passes / week</div>
            </div>
            <button style={{ width:44,height:44,borderRadius:"50%",border:`2px solid ${C.border}`,background:"none",fontSize:24,cursor:"pointer",color:C.text,lineHeight:1 }} onClick={()=>setSettings(s=>({...s,weeklyLimit:Math.min(20,s.weeklyLimit+1)}))}>+</button>
          </div>
          <div style={{ fontSize:11,fontWeight:700,color:C.sub,letterSpacing:.5,marginBottom:10 }}>THIS WEEK</div>
          {students.slice().sort((a,b)=>a.name.localeCompare(b.name)).map(s=>{
            const wu=weeklyUsed(s.id),pct=Math.min(wu/settings.weeklyLimit,1);
            return (
              <div key={s.id} style={{ display:"flex",alignItems:"center",gap:10,marginBottom:8 }}>
                <Avatar student={s} size={28} />
                <div style={{ width:80,fontSize:12,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flexShrink:0 }}>{s.name.split(" ")[0]}</div>
                <div style={{ flex:1,height:7,background:"#f0f0f0",borderRadius:7,overflow:"hidden" }}>
                  <div style={{ height:"100%",width:`${pct*100}%`,background:pct>=1?C.red:pct>=.5?C.yellow:C.green,borderRadius:7,transition:"width .4s" }} />
                </div>
                <div style={{ fontSize:11,fontWeight:700,color:pct>=1?C.red:C.sub,minWidth:28,textAlign:"right",flexShrink:0 }}>{wu}/{settings.weeklyLimit}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* period block */}
      <div style={{ ...card,borderRadius:16,marginBottom:12 }}>
        <div style={{ fontWeight:800,fontSize:15,marginBottom:4 }}>🔒 Block Student During Period</div>
        <div style={{ color:C.sub,fontSize:13,marginBottom:14 }}>Prevent a student from leaving during a specific period.</div>
        <div style={{ display:"flex",gap:8,flexWrap:"wrap",marginBottom:12 }}>
          <select style={{ ...igInput,flex:1,minWidth:120 }} value={rSid} onChange={e=>setRSid(Number(e.target.value))}>
            {students.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select style={{ ...igInput,flex:1,minWidth:100 }} value={rPid} onChange={e=>setRPid(e.target.value)}>
            {periods.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button style={{ ...igBtn("primary"),borderRadius:10,flexShrink:0 }} onClick={()=>{if(restrictions.find(r=>r.studentId===rSid&&r.periodId===rPid))return;setRestrictions(rs=>[...rs,{id:Date.now(),studentId:rSid,periodId:rPid}]);}}>Block</button>
        </div>
        {restrictions.length===0&&<div style={{ color:C.sub,fontSize:13 }}>No blocks set.</div>}
        {restrictions.map(r=>{
          const s=students.find(x=>x.id===r.studentId),p=periods.find(x=>x.id===r.periodId);
          return (
            <div key={r.id} style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 0",borderTop:`1px solid ${C.border}` }}>
              <div style={{ fontSize:14 }}><b>{s?.name}</b> — {p?.name}</div>
              <button style={{ ...igBtn("danger"),fontSize:12,padding:"5px 12px",borderRadius:8 }} onClick={()=>setRestrictions(rs=>rs.filter(x=>x.id!==r.id))}>Remove</button>
            </div>
          );
        })}
      </div>

      {/* conflicts */}
      <div style={{ ...card,borderRadius:16 }}>
        <div style={{ fontWeight:800,fontSize:15,marginBottom:4 }}>⚡ Conflict Pairs</div>
        <div style={{ color:C.sub,fontSize:13,marginBottom:14 }}>These two cannot be out at the same time.</div>
        <div style={{ display:"flex",gap:8,flexWrap:"wrap",marginBottom:12 }}>
          <select style={{ ...igInput,flex:1,minWidth:120 }} value={cSa} onChange={e=>setCSa(Number(e.target.value))}>
            {students.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select style={{ ...igInput,flex:1,minWidth:120 }} value={cSb} onChange={e=>setCSb(Number(e.target.value))}>
            {students.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <button style={{ ...igBtn("danger"),borderRadius:10,flexShrink:0 }} onClick={()=>{if(cSa===cSb)return;if(conflicts.find(c=>(c.a===cSa&&c.b===cSb)||(c.a===cSb&&c.b===cSa)))return;setConflicts(cs=>[...cs,{id:Date.now(),a:cSa,b:cSb}]);}}>Flag</button>
        </div>
        {conflicts.length===0&&<div style={{ color:C.sub,fontSize:13 }}>No conflicts set.</div>}
        {conflicts.map(c=>{
          const sa=students.find(x=>x.id===c.a),sb=students.find(x=>x.id===c.b);
          return (
            <div key={c.id} style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 0",borderTop:`1px solid ${C.border}` }}>
              <div style={{ display:"flex",alignItems:"center",gap:8,fontSize:14,flexWrap:"wrap" }}>
                {sa&&<Avatar student={sa} size={28}/>}<b>{sa?.name}</b>
                <span style={{ color:C.sub }}>↔</span>
                {sb&&<Avatar student={sb} size={28}/>}<b>{sb?.name}</b>
              </div>
              <button style={{ ...igBtn("danger"),fontSize:12,padding:"5px 12px",borderRadius:8,flexShrink:0 }} onClick={()=>setConflicts(cs=>cs.filter(x=>x.id!==c.id))}>Remove</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ══ HISTORY TAB ══════════════════════════════════════════════════════════════
function HistoryTab({ history,students,bathrooms }) {
  if(!history.length) return (
    <div style={{ padding:40,textAlign:"center",color:C.sub }}>
      <div style={{ fontSize:44,marginBottom:12 }}>📋</div>
      <div style={{ fontWeight:700,fontSize:16 }}>No completed passes yet</div>
    </div>
  );
  return (
    <div>
      <div style={{ padding:"16px 16px 8px",fontWeight:800,fontSize:18 }}>History</div>
      {history.map(h=>{
        const s=students.find(x=>x.id===h.studentId);
        const color=h.elapsed>=RED_MS?C.red:h.elapsed>=YELLOW_MS?C.yellow:C.green;
        const label=h.elapsed>=RED_MS?"Red Code":h.elapsed>=YELLOW_MS?"Over limit":"Normal";
        return (
          <div key={h.id} style={{ display:"flex",alignItems:"center",gap:12,padding:"12px 16px",background:C.white,borderBottom:`1px solid ${C.border}` }}>
            {s&&<Avatar student={s} size={44}/>}
            <div style={{ flex:1,minWidth:0 }}>
              <div style={{ fontWeight:700,fontSize:14,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{s?.name||"Unknown"}</div>
              <div style={{ color:C.sub,fontSize:12,marginTop:2 }}>{h.period} · {bathrooms.find(b=>b.id===h.bathroomId)?.name||h.bathroomId}</div>
            </div>
            <div style={{ textAlign:"right",flexShrink:0 }}>
              <div style={{ fontWeight:900,fontSize:18,color,fontVariantNumeric:"tabular-nums" }}>{fmtMs(h.elapsed)}</div>
              <span style={{ ...pill(color+"22",color,10) }}>{label}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ══ SETTINGS TAB ═════════════════════════════════════════════════════════════
function SettingsTab({ settings,setSettings,alerts,LOCKOUT_DAYS,scheduleKey,setScheduleKey }) {
  return (
    <div style={{ padding:16 }}>
      <div style={{ fontWeight:800,fontSize:18,marginBottom:16 }}>Settings</div>

      {/* Schedule switcher */}
      <div style={{ ...card,borderRadius:16,marginBottom:12 }}>
        <div style={{ fontWeight:700,fontSize:15,marginBottom:4 }}>🗓 Schedule</div>
        <div style={{ color:C.sub,fontSize:13,marginBottom:14 }}>Switch between your regular schedule and alternate schedules. WVW is only available on Wednesdays.</div>
        <div style={{ display:"flex",gap:10 }}>
          {Object.entries(SCHEDULES).map(([key,sch])=>{
            const active = scheduleKey===key;
            const isWvw = key==="wvw";
            const today = new Date().getDay(); // 0=Sun,3=Wed
            const wvwLocked = isWvw && today!==3;
            return (
              <div key={key} style={{ flex:1 }}>
                <button
                  disabled={wvwLocked}
                  onClick={()=>{ if(!wvwLocked) setScheduleKey(key); }}
                  style={{ width:"100%",border:"none",borderRadius:14,padding:"14px 10px",cursor:wvwLocked?"not-allowed":"pointer",opacity:wvwLocked?0.45:1,
                    background: active ? GRAD : "#f5f5f5",
                    color: active ? "#fff" : C.text,
                    transition:"all .2s",
                  }}
                >
                  <div style={{ fontWeight:800,fontSize:16 }}>{sch.label}</div>
                  {isWvw && <div style={{ fontSize:11,marginTop:3,opacity:.85 }}>Wednesdays only</div>}
                </button>
                {active && (
                  <div style={{ marginTop:10 }}>
                    {sch.periods.map(p=>(
                      <div key={p.id} style={{ display:"flex",justifyContent:"space-between",padding:"5px 2px",borderBottom:`1px solid ${C.border}`,fontSize:13 }}>
                        <span style={{ fontWeight:600 }}>{p.name}</span>
                        <span style={{ color:C.sub }}>{p.start} – {p.end}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ ...card,borderRadius:16,marginBottom:12 }}>
        <div style={{ fontWeight:700,fontSize:15,marginBottom:14 }}>Pass Limits</div>
        <div style={{ marginBottom:14 }}>
          <div style={{ fontSize:11,fontWeight:700,color:C.sub,letterSpacing:.5,marginBottom:6 }}>DAILY PASSES PER STUDENT</div>
          <input style={{ ...igInput,maxWidth:100 }} type="number" min={1} max={20} value={settings.dailyLimit} onChange={e=>setSettings(s=>({...s,dailyLimit:Number(e.target.value)}))} />
        </div>
        <div>
          <div style={{ fontSize:11,fontWeight:700,color:C.sub,letterSpacing:.5,marginBottom:6 }}>ADMIN / ALERT EMAIL</div>
          <input style={igInput} value={settings.adminEmail} onChange={e=>setSettings(s=>({...s,adminEmail:e.target.value}))} />
        </div>
      </div>
      <div style={{ ...card,borderRadius:16,marginBottom:12 }}>
        <div style={{ fontWeight:700,fontSize:15,marginBottom:12 }}>Timer Rules</div>
        {[{icon:"🟢",text:"Green zone: 0:00 – 5:00 min"},{icon:"⚠️",text:"Alert to teacher at 5:00 min"},{icon:"🚨",text:`Red Code at 10:00 → ${LOCKOUT_DAYS}-day lockout`},{icon:"📅",text:`Weekly limit: ${settings.weeklyLimit} passes/student`},{icon:"⏱️",text:"No passes in first or last 10 min of any period"}].map((r,i,arr)=>(
          <div key={i} style={{ display:"flex",gap:14,alignItems:"center",padding:"9px 0",borderBottom:i<arr.length-1?`1px solid ${C.border}`:"none" }}>
            <span style={{ fontSize:20 }}>{r.icon}</span>
            <span style={{ fontSize:14,color:C.sub }}>{r.text}</span>
          </div>
        ))}
      </div>
      <div style={{ ...card,borderRadius:16,marginBottom:16 }}>
        <div style={{ fontWeight:700,fontSize:15,marginBottom:8,color:C.red }}>Alert Log</div>
        {alerts.length===0&&<div style={{ color:C.sub,fontSize:13 }}>No alerts yet.</div>}
        {alerts.map(a=>(
          <div key={a.id} style={{ padding:"8px 0",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",gap:8,alignItems:"flex-start" }}>
            <span style={{ fontSize:13,color:a.type==="red"?C.red:C.yellow,fontWeight:600 }}>{a.msg}</span>
            <span style={{ fontSize:11,color:C.sub,flexShrink:0 }}>{a.time}</span>
          </div>
        ))}
      </div>
      <div style={{ textAlign:"center",padding:"8px 0 16px",color:C.sub,fontSize:12 }}>
        <div style={{ fontWeight:900,fontSize:18,background:GRAD,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",marginBottom:4 }}>PassGuard</div>
        by Jose Melgarejo · DC Public Schools
      </div>
    </div>
  );
}
