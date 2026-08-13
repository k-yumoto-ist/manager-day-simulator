import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Bell, BellOff, BookOpen, CalendarDays, Check, ChevronRight, Clock3, Focus, Handshake, LogOut, MessageSquare, MoreHorizontal, Play, ShieldAlert, Sparkles, Target, Timer, Users } from 'lucide-react'
import { actionConfig, delegates as delegateSeed, formatTime, initialTasks, meetings, scenarioEvents, senders } from './scenario'
import type { ActionId, DecisionLog, Delegate, Meeting, ScenarioEvent, Skill, WorkTask } from './types'

type Metrics = { customer:number; team:number; business:number; energy:number; focus:number }
type MeetingChoice = 'join' | 'skip' | 'late' | 'leave' | 'proxy'

const clamp = (n:number) => Math.max(0, Math.min(100, n))
const categorySkill: Record<ScenarioEvent['kind'], Skill> = {
  noise:'調整', simple:'調整', decision:'調整', sensitive:'育成', risk:'技術', sales:'顧客対応', admin:'調整'
}

function Gauge({label,value,color}:{label:string;value:number;color:string}) {
  return <div className="gauge">
    <div className="gauge-head"><span>{label}</span><strong>{Math.round(value)}</strong></div>
    <div className="gauge-track"><span style={{width:`${clamp(value)}%`,background:color}} /></div>
  </div>
}

function Avatar({sender,size='normal'}:{sender:ScenarioEvent['sender'];size?:'normal'|'large'}) {
  const s = senders[sender]
  return <span className={`avatar ${size}`} style={{background:s.color}}>{s.avatar}</span>
}

function App() {
  const [phase,setPhase] = useState<'intro'|'rules'|'play'|'result'>('intro')
  const [time,setTime] = useState(0)
  const [selected,setSelected] = useState('release')
  const [read,setRead] = useState<Set<string>>(new Set())
  const [resolvedAt,setResolvedAt] = useState<Record<string,number>>({})
  const [snoozed,setSnoozed] = useState<Set<string>>(new Set())
  const [customEvents,setCustomEvents] = useState<ScenarioEvent[]>([])
  const [metrics,setMetrics] = useState<Metrics>({customer:78,team:76,business:64,energy:88,focus:82})
  const [tasks,setTasks] = useState<WorkTask[]>(initialTasks)
  const [delegateList,setDelegateList] = useState<Delegate[]>(delegateSeed)
  const [delegateFor,setDelegateFor] = useState<ScenarioEvent|null>(null)
  const [meetingChoices,setMeetingChoices] = useState<Record<string,MeetingChoice>>({})
  const [meetingAttention,setMeetingAttention] = useState<Record<string,number>>({})
  const [meetingEnds,setMeetingEnds] = useState<Record<string,number>>({})
  const [missedMeeting,setMissedMeeting] = useState<Meeting|null>(null)
  const [processed,setProcessed] = useState<Set<string>>(new Set())
  const [logs,setLogs] = useState<DecisionLog[]>([])
  const [stats,setStats] = useState({handled:0,reactions:0,delegated:0,responseMinutes:0,focusTotal:0,longestFocus:0,switches:0})
  const [muted,setMuted] = useState(false)
  const [toast,setToast] = useState<string|null>(null)
  const previousVisible = useRef(0)

  const allEvents = useMemo(() => [...scenarioEvents,...customEvents].sort((a,b)=>a.at-b.at),[customEvents])
  const isSuppressed = (event:ScenarioEvent) => {
    const solved = resolvedAt[event.threadId]
    const firstAt = allEvents.find(e=>e.threadId===event.threadId)?.at ?? event.at
    return Boolean(solved !== undefined && solved < event.at && event.at !== firstAt)
  }
  const visible = allEvents.filter(e => e.at <= time && !isSuppressed(e))

  const threads = useMemo(() => {
    const map = new Map<string,ScenarioEvent[]>()
    visible.forEach(e => map.set(e.threadId,[...(map.get(e.threadId) ?? []),e]))
    return [...map.entries()].map(([id,events])=>({id,events,last:events[events.length-1]})).sort((a,b)=>b.last.at-a.last.at)
  },[visible])
  const selectedEvents = threads.find(t=>t.id===selected)?.events ?? []
  const selectedLast = selectedEvents[selectedEvents.length-1]
  const unreadCount = visible.filter(e=>!read.has(e.id)).length

  const activeMeeting = meetings.find(m => {
    const choice=meetingChoices[m.id]
    const start=choice==='late'?m.start+10:m.start
    const end=choice==='leave'?m.start+Math.round((m.end-m.start)/2):(meetingEnds[m.id] ?? m.end)
    return (choice==='join'||choice==='late'||choice==='leave') && time>=start && time<end
  })
  const meetingPrompt = meetings.find(m => !meetingChoices[m.id] && time >= m.start-10 && time <= m.start+12)
  const totalTask = tasks.reduce((sum,t)=>sum+t.progress,0) / tasks.reduce((sum,t)=>sum+t.required,0) * 100

  const beep = () => {
    if (muted) return
    try {
      const AudioContextClass = window.AudioContext || (window as unknown as {webkitAudioContext:typeof AudioContext}).webkitAudioContext
      const ctx = new AudioContextClass(); const osc=ctx.createOscillator(); const gain=ctx.createGain()
      osc.frequency.value=560; gain.gain.setValueAtTime(.035,ctx.currentTime); gain.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+.12)
      osc.connect(gain); gain.connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime+.12)
    } catch { /* browsers may block sound before interaction */ }
  }

  useEffect(()=>{
    if(phase!=='play') return
    const timer=window.setInterval(()=>setTime(t=>Math.min(720,t+1)),2000)
    return ()=>window.clearInterval(timer)
  },[phase])

  useEffect(()=>{
    if(phase!=='play') return
    if(visible.length>previousVisible.current){ beep(); const newest=visible[visible.length-1]; setToast(`${senders[newest.sender].name} から新着メッセージ`); window.setTimeout(()=>setToast(null),2400) }
    previousVisible.current=visible.length
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[visible.length,phase])

  useEffect(()=>{
    if(phase!=='play') return
    const arriving=visible.filter(e=>!processed.has(e.id))
    if(!arriving.length) return
    const next=new Set(processed)
    arriving.forEach(e=>{
      next.add(e.id)
      const chainIndex=allEvents.filter(x=>x.threadId===e.threadId && x.at<=e.at).length
      if(chainIndex>=2 && e.importance>=4){
        const amount=chainIndex>=3?8:4
        setMetrics(m=>({
          ...m,
          customer:clamp(m.customer-(e.kind==='risk'?amount:0)),
          team:clamp(m.team-(e.kind==='sensitive'?amount:0)),
          business:clamp(m.business-(e.kind==='sales'||e.kind==='risk'?amount/2:0)),
        }))
        if(chainIndex>=3) setLogs(l=>[...l,{at:e.at,title:e.branchLabel ?? senders[e.sender].name,action:'対応を見送った',outcome:e.kind==='risk'?'問題が重大化し、追加対応が発生':e.kind==='sensitive'?'相談のトーンが変わり、信頼が低下':'機会損失のリスクが上昇',severity:'bad'}])
      }
    })
    setProcessed(next)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[visible.length,phase])

  useEffect(()=>{
    if(phase!=='play') return
    if(time>=118 && meetingChoices.m2==='join' && !meetingEnds.m2){
      setMeetingEnds(x=>({...x,m2:135})); setToast('「あと一点だけ…」顧客定例が15分延長しました')
      setLogs(l=>[...l,{at:118,title:'顧客定例',action:'会議延長',outcome:'次の予定と集中時間が15分圧迫された',severity:'warn'}])
    }
  },[time,phase,meetingChoices.m2,meetingEnds.m2])

  const advance = (minutes:number) => setTime(t=>Math.min(720,t+minutes))
  const adjust = (patch:Partial<Metrics>) => setMetrics(m=>({customer:clamp(m.customer+(patch.customer??0)),team:clamp(m.team+(patch.team??0)),business:clamp(m.business+(patch.business??0)),energy:clamp(m.energy+(patch.energy??0)),focus:clamp(m.focus+(patch.focus??0))}))

  const chooseThread=(id:string,events:ScenarioEvent[])=>{
    if(id!==selected){setStats(s=>({...s,switches:s.switches+1}));adjust({focus:-1})}
    setSelected(id); setRead(r=>new Set([...r,...events.map(e=>e.id)]))
  }

  const actionOutcome=(event:ScenarioEvent,action:ActionId)=>{
    if(action==='ignore') return event.kind==='noise'?'対応不要を見極め、時間を守った':'対応しなかったため、状況が続いている'
    if(action==='react') return event.kind==='noise'||event.kind==='simple'?'低コストで適切に意思表示した':'反応だけでは相手の懸念を受け止めきれなかった'
    if(action==='delegate') return '適任者を選んで対応を委ねた'
    if(action==='later') return 'あとで見る項目に残した（悪化タイマーは止まらない）'
    if(action==='question') return '追加情報を求めた。相手から返信が来る'
    if(action==='call') return '会話の時間を取り、背景まで含めて解決した'
    return action==='careful'?'背景を踏まえて丁寧に対応した':'要点を絞って素早く返信した'
  }

  const performAction=(action:ActionId,event=selectedLast)=>{
    if(!event) return
    if(action==='delegate'){setDelegateFor(event);return}
    const cfg=actionConfig[action]
    advance(cfg.minutes)
    adjust({energy:-cfg.minutes*.09,focus:-(action==='call'?5:1.3)})
    const weak = (event.kind==='sensitive'||event.kind==='risk') && (action==='react'||action==='short')
    const solved = action==='careful'||action==='call'||(action==='short'&&!['sensitive','risk'].includes(event.kind))||(action==='react'&&event.kind==='noise')||(action==='ignore'&&event.kind==='noise')
    if(solved) setResolvedAt(r=>({...r,[event.threadId]:time}))
    if(action==='later') setSnoozed(s=>new Set(s).add(event.threadId))
    if(action==='question') setCustomEvents(es=>[...es,{...event,id:`q-${event.id}-${time}`,at:time+18,message:'補足します。状況としては、先ほどお伝えした点に加えてもう一点確認いただきたいです。',mention:true}])
    if(weak) adjust(event.kind==='sensitive'?{team:-5}:{customer:-4,business:-2})
    if(action==='careful'&&event.kind==='sensitive') adjust({team:5})
    if(action==='call') adjust(event.kind==='sensitive'?{team:8}:{customer:6})
    if(event.kind==='sales'&&solved) adjust({business:5})
    if(activeMeeting && cfg.minutes>0){
      const loss=cfg.minutes*activeMeeting.focusNeed*1.8
      setMeetingAttention(a=>({...a,[activeMeeting.id]:(a[activeMeeting.id]??100)-loss}))
      if((meetingAttention[activeMeeting.id]??100)-loss<62&&!missedMeeting) setMissedMeeting(activeMeeting)
    }
    setStats(s=>({...s,handled:s.handled+1,reactions:s.reactions+(action==='react'?1:0),responseMinutes:s.responseMinutes+Math.max(0,time-event.at)}))
    setLogs(l=>[...l,{at:time,title:event.branchLabel ?? `${senders[event.sender].name}の連絡`,action:cfg.label,outcome:actionOutcome(event,action),severity:weak?'bad':solved?'good':'warn'}])
  }

  const doDelegate=(person:Delegate)=>{
    if(!delegateFor)return
    const needed=categorySkill[delegateFor.kind]; const fit=person.skills[needed]; const overload=person.load>75
    advance(3); setDelegateList(d=>d.map(x=>x.id===person.id?{...x,load:Math.min(100,x.load+12)}:x))
    setStats(s=>({...s,handled:s.handled+1,delegated:s.delegated+1,responseMinutes:s.responseMinutes+Math.max(0,time-delegateFor.at)}))
    if(fit>=4&&!overload){setResolvedAt(r=>({...r,[delegateFor.threadId]:time}));adjust({team:2,business:delegateFor.kind==='sales'?4:1})}
    else {adjust({team:-3});setCustomEvents(es=>[...es,{...delegateFor,id:`return-${delegateFor.id}-${time}`,at:time+35,message:`一度確認しましたが、判断が難しく戻します。進め方をご相談させてください。`,mention:true}])}
    setLogs(l=>[...l,{at:time,title:delegateFor.branchLabel??'チャット対応',action:`${person.name}へ委任`,outcome:fit>=4&&!overload?'適性が合い、自律的に解決した':'適性または余力が合わず、差し戻しが発生',severity:fit>=4&&!overload?'good':'bad'}])
    setDelegateFor(null)
  }

  const focusTask=(task:WorkTask,duration:number)=>{
    const nextMeeting=meetings.find(m=>m.start>time && m.start<time+duration && meetingChoices[m.id]!=='skip'&&meetingChoices[m.id]!=='proxy')
    const actual=nextMeeting?Math.max(5,nextMeeting.start-time):duration
    const factor=actual>=60?1.25:actual>=30?1.15:.82
    const cognitive=metrics.focus/100
    const gain=Math.round(Math.max(0,actual-5)*factor*(.65+.35*cognitive))
    setTasks(ts=>ts.map(t=>t.id===task.id?{...t,progress:Math.min(t.required,t.progress+gain)}:t))
    advance(actual); adjust({focus:actual>=30?5:-1,energy:-actual*.12})
    setStats(s=>({...s,focusTotal:s.focusTotal+actual,longestFocus:Math.max(s.longestFocus,actual)}))
    setLogs(l=>[...l,{at:time,title:task.title,action:`${actual}分の集中時間`,outcome:`準備ロス5分を除き、${gain}分相当進んだ${nextMeeting?'（会議で中断）':''}`,severity:actual>=30?'good':'warn'}])
  }

  const decideMeeting=(m:Meeting,choice:MeetingChoice)=>{
    setMeetingChoices(c=>({...c,[m.id]:choice})); setMeetingAttention(a=>({...a,[m.id]:100}))
    if(choice==='skip'&&m.focusNeed>=2) adjust({customer:m.owner==='顧客'?-6:0,business:-2})
    if(choice==='proxy') {adjust({team:2,energy:2});setDelegateList(d=>d.map((x,i)=>i===1?{...x,load:x.load+8}:x))}
    if(choice==='late') advance(10)
    setLogs(l=>[...l,{at:time,title:m.title,action:{join:'参加',skip:'欠席',late:'途中参加',leave:'途中退出',proxy:'代理を立てる'}[choice],outcome:choice==='proxy'?'伊藤さんに目的と期待役割を伝えて任せた':choice==='skip'?'会議時間を空けた。重要な情報は別途必要':choice==='join'?'予定通り参加した':'参加時間を限定した',severity:choice==='proxy'&&m.optional?'good':choice==='skip'&&m.focusNeed>=2?'warn':'good'}])
  }

  const resolveMissed=(choice:'yes'|'repeat'|'member')=>{
    if(!missedMeeting)return
    if(choice==='yes'){adjust({customer:missedMeeting.owner==='顧客'?-8:0,business:-4});setLogs(l=>[...l,{at:time,title:`${missedMeeting.title}で聞き逃し`,action:'そのまま承知',outcome:'宿題の認識が曖昧なまま残った',severity:'bad'}])}
    if(choice==='repeat'){advance(8);adjust({customer:missedMeeting.owner==='顧客'?-2:0});setLogs(l=>[...l,{at:time,title:`${missedMeeting.title}で聞き逃し`,action:'もう一度説明を依頼',outcome:'時間は使ったが認識を修復した',severity:'warn'}])}
    if(choice==='member'){advance(3);adjust({team:-1});setLogs(l=>[...l,{at:time,title:`${missedMeeting.title}で聞き逃し`,action:'後でメンバーに確認',outcome:'会議後に確認タスクが増えた',severity:'warn'}])}
    setMissedMeeting(null)
  }

  const startGame=()=>{setPhase('play');setTime(0);previousVisible.current=0}
  const endGame=()=>setPhase('result')
  const restart=()=>window.location.reload()

  if(phase==='intro') return <StartScreen onStart={startGame} onRules={()=>setPhase('rules')}/>
  if(phase==='rules') return <RulesScreen onBack={()=>setPhase('intro')} onStart={startGame}/>
  if(phase==='result') return <ResultScreen time={time} metrics={metrics} tasks={tasks} stats={stats} unread={unreadCount} logs={logs} delegates={delegateList} onRestart={restart}/>

  return <div className="app-shell">
    <header className="topbar">
      <div className="brand"><span className="brand-mark">M</span><div><strong>Manager's Day</strong><small>木曜日・プロダクト推進部</small></div></div>
      <div className="clock-block"><span className={time>=540?'overtime':''}>{formatTime(time)}</span><small>{time>=540?`残業 ${time-540}分`:'18:00まであと '+(540-time)+'分'}</small></div>
      <div className="top-gauges">
        <Gauge label="顧客信頼" value={metrics.customer} color="#517263"/><Gauge label="チーム" value={metrics.team} color="#6b6482"/><Gauge label="事業成果" value={metrics.business} color="#7b6847"/><Gauge label="自分の余力" value={metrics.energy} color="#58707a"/><Gauge label="タスク" value={totalTask} color="#486456"/>
      </div>
      <button className="icon-btn" onClick={()=>setMuted(m=>!m)} aria-label="通知音を切り替え">{muted?<BellOff size={18}/>:<Bell size={18}/>}</button>
      <button className="end-btn" onClick={endGame}><LogOut size={15}/> 退勤する</button>
    </header>

    {meetingPrompt&&<MeetingPrompt meeting={meetingPrompt} onChoose={c=>decideMeeting(meetingPrompt,c)}/>}    
    {activeMeeting&&<div className="meeting-live"><span className="pulse-dot"/><strong>会議中</strong><span>{activeMeeting.title}</span><span className="attention">集中度 {Math.max(0,Math.round(meetingAttention[activeMeeting.id]??100))}%</span></div>}
    {toast&&<div className="toast"><Bell size={15}/>{toast}</div>}

    <main className="workspace">
      <section className="inbox-panel panel">
        <div className="panel-title"><div><MessageSquare size={18}/><strong>受信トレイ</strong><span className="count">{unreadCount}</span></div><MoreHorizontal size={18}/></div>
        <div className="filter-row"><button className="active">すべて</button><button>メンション</button><button>未読</button></div>
        <div className="thread-list">
          {threads.length===0&&<div className="empty-inbox">まだメッセージはありません<br/><small>業務開始直後です</small></div>}
          {threads.map(t=>{const s=senders[t.last.sender];const unread=t.events.filter(e=>!read.has(e.id)).length;return <button key={t.id} className={`thread ${selected===t.id?'selected':''}`} onClick={()=>chooseThread(t.id,t.events)}>
            <Avatar sender={t.last.sender}/><span className="thread-body"><span className="thread-top"><strong>{s.name}</strong><time>{formatTime(t.last.at)}</time></span><small>{s.role}</small><span className="preview">{t.last.mention&&<b>@</b>}{t.last.message}</span></span>{unread>0&&<span className="unread">{unread}</span>}{snoozed.has(t.id)&&<Clock3 className="snooze" size={12}/>}</button>})}
        </div>
      </section>

      <section className="chat-panel panel">
        {selectedLast?<>
          <div className="chat-head"><Avatar sender={selectedLast.sender}/><div><strong>{senders[selectedLast.sender].name}</strong><small>{senders[selectedLast.sender].role} ・ {senders[selectedLast.sender].category}</small></div><span className="presence">● オンライン</span></div>
          {missedMeeting&&<div className="missed-card"><div><ShieldAlert size={20}/><strong>会議の内容を聞き逃しました</strong></div><p>「では先ほど話した対応について、来週までにお願いします。」何を指しているか分かりません。</p><div><button onClick={()=>resolveMissed('yes')}>承知しました</button><button onClick={()=>resolveMissed('repeat')}>もう一度説明してもらう</button><button onClick={()=>resolveMissed('member')}>後でメンバーに確認</button></div></div>}
          <div className="messages">
            <div className="day-divider"><span>今日</span></div>
            {selectedEvents.map((e,i)=><div className="message" key={e.id}><Avatar sender={e.sender}/><div><div className="message-meta"><strong>{senders[e.sender].name}</strong><time>{formatTime(e.at)}</time>{e.mention&&<span className="mention">あなた宛</span>}</div><p>{e.message}</p>{i<selectedEvents.length-1&&<span className="thread-follow">スレッドが続いています</span>}</div></div>)}
          </div>
          <div className="action-dock">
            <div className="dock-hint"><span>このメッセージにどう対応しますか？</span><small>緊急度は文面から判断してください</small></div>
            <div className="action-grid">{(Object.entries(actionConfig) as [ActionId,typeof actionConfig[ActionId]][]).map(([id,c])=><button key={id} onClick={()=>performAction(id)} title={c.description}><span>{c.icon}</span><strong>{c.label}</strong><small>{c.minutes===0?'0分':`${c.minutes}分`}</small></button>)}</div>
          </div>
        </>:<div className="chat-empty"><MessageSquare/><strong>会話を選択してください</strong></div>}
      </section>

      <aside className="right-rail">
        <section className="schedule-card panel">
          <div className="panel-title"><div><CalendarDays size={17}/><strong>今日の予定</strong></div><span>{meetings.length}件</span></div>
          <div className="schedule-list">{meetings.map(m=>{const choice=meetingChoices[m.id];const isNow=time>=m.start&&time<(meetingEnds[m.id]??m.end);return <div className={`meeting-row ${isNow?'now':''}`} key={m.id}>
            <span className="meeting-line" style={{background:m.color}}/><time>{formatTime(m.start)}<small>{formatTime(meetingEnds[m.id]??m.end)}</small></time><div><strong>{m.title}</strong><small>{m.owner} ・ 集中 {['','低','中','高'][m.focusNeed]}</small></div>{choice?<span className={`choice ${choice}`}>{({join:'参加',skip:'欠席',late:'途中',leave:'退出',proxy:'代理'} as const)[choice]}</span>:time<m.start&&m.start-time<=60?<button className="mini-plan" onClick={()=>decideMeeting(m,m.optional?'proxy':'join')}>{m.optional?'代理':'参加'}</button>:null}
          </div>})}</div>
        </section>

        <section className="tasks-card panel">
          <div className="panel-title"><div><Focus size={17}/><strong>自分の重要タスク</strong></div><span>{Math.round(totalTask)}%</span></div>
          <div className="task-list">{tasks.map(t=>{const pct=t.progress/t.required*100;return <div className="task" key={t.id}><div className="task-top"><span className="priority" style={{color:t.color}}>{t.importance}</span><small>{t.deadline}</small></div><strong>{t.title}</strong><div className="task-progress"><span style={{width:`${pct}%`,background:t.color}}/></div><div className="task-bottom"><span>{Math.round(t.progress)} / {t.required}分</span><div><button onClick={()=>focusTask(t,15)} disabled={pct>=100}>15</button><button onClick={()=>focusTask(t,30)} disabled={pct>=100}>30</button><button onClick={()=>focusTask(t,60)} disabled={pct>=100}>60分</button></div></div></div>})}</div>
          <div className="focus-tip"><Sparkles size={14}/><span>30分以上の連続作業で集中ボーナス。最初の5分は準備に使われます。</span></div>
        </section>

        <section className="team-card panel">
          <div className="panel-title"><div><Users size={17}/><strong>チームの様子</strong></div><span>兆候</span></div>
          <div className="member-vibes"><div><span className="avatar mini" style={{background:'#65758b'}}>鈴</span><p><strong>鈴木 葵</strong><small>{metrics.team<55?'返信が短く、会話が減っている':metrics.team<70?'少し元気がないように見える':'いつも通り。相談したい様子'}</small></p></div><div><span className="avatar mini" style={{background:'#7c6b55'}}>田</span><p><strong>田中 健</strong><small>{delegateList[2].load>80?'負荷がかなり高そう':'レビュー対応が多い'}</small></p></div></div>
        </section>
      </aside>
    </main>

    {delegateFor&&<div className="modal-backdrop"><div className="delegate-modal"><div className="modal-head"><div><span className="eyebrow">委任先を選ぶ</span><h2>誰に任せますか？</h2></div><button onClick={()=>setDelegateFor(null)}>×</button></div><div className="delegate-context"><strong>{senders[delegateFor.sender].name}</strong><p>{delegateFor.message}</p><span>求められる力：{categorySkill[delegateFor.kind]}</span></div><div className="delegate-options">{delegateList.map(d=><button key={d.id} onClick={()=>doDelegate(d)}><div><span className="avatar" style={{background:'#607067'}}>{d.name[0]}</span><p><strong>{d.name}</strong><small>{d.role}</small></p><ChevronRight/></div><div className="skill-row">{Object.entries(d.skills).map(([k,v])=><span key={k}>{k} <b>{'●'.repeat(Math.ceil(v/2))}</b></span>)}</div><div className="load-row"><span>現在の負荷</span><div><i style={{width:`${d.load}%`}}/></div><b>{d.load}%</b></div></button>)}</div></div></div>}
  </div>
}

function MeetingPrompt({meeting,onChoose}:{meeting:Meeting;onChoose:(c:MeetingChoice)=>void}){
  return <div className="meeting-prompt"><div><CalendarDays size={20}/><p><small>{formatTime(meeting.start)}から</small><strong>{meeting.title}</strong><span>集中必要度：{['','低','中','高'][meeting.focusNeed]}</span></p></div><div><button className="primary" onClick={()=>onChoose('join')}>参加</button><button onClick={()=>onChoose('late')}>途中参加</button><button onClick={()=>onChoose('leave')}>途中退出</button><button onClick={()=>onChoose('proxy')}>代理</button><button onClick={()=>onChoose('skip')}>欠席</button></div></div>
}

function StartScreen({onStart,onRules}:{onStart:()=>void;onRules:()=>void}){
  return <div className="start-screen"><div className="start-window"><div className="start-visual"><div className="desk-clock"><Clock3/><strong>09:00</strong><span>THURSDAY</span></div><div className="visual-card vc1"><MessageSquare/><span><b>12</b> 未読メッセージ</span></div><div className="visual-card vc2"><CalendarDays/><span>会議 6件</span></div><div className="visual-card vc3"><Focus/><span>重要タスク 4件</span></div></div><div className="start-copy"><span className="eyebrow">MANAGER'S DAY</span><h1>あなたは今日から<br/>チームを率いる<br/><em>マネージャー</em>です。</h1><p>18:00までに重要な仕事を進めながら、<br/>チーム・顧客・事業を守ってください。</p><div className="start-rule"><Check/><span>すべての連絡に返信する必要はありません。</span></div><button onClick={onStart}><Play fill="currentColor"/>業務開始 <small>約15〜25分</small></button><button className="rules-link" onClick={onRules}><BookOpen/>ゲームルールを見る</button></div></div><p className="start-foot">1日の終わりに、あなたのマネジメントスタイルを振り返ります。</p></div>
}

function RulesScreen({onBack,onStart}:{onBack:()=>void;onStart:()=>void}){
  const actionRows = [
    ['リアクション','0〜1分','FYIや成果共有には有効。相談やリスクへの反応だけでは不十分です。'],
    ['短く返信 / 質問','3〜4分','要点を返す、または判断に必要な情報を増やします。'],
    ['丁寧に返信','9分','背景まで受け止める対応。顧客・メンバーの重要な懸念に有効です。'],
    ['委任 / 通話','3分 / 20分','適任者に任せるか、会話で一気に解決します。委任先の負荷も見ましょう。'],
  ]
  return <div className="rules-screen"><header className="rules-header"><div className="brand"><span className="brand-mark">M</span><div><strong>Manager's Day</strong><small>ゲームルール</small></div></div><button onClick={onBack}><ArrowLeft/>トップへ戻る</button></header><main className="rules-main"><section className="rules-hero"><span className="eyebrow">HOW TO PLAY</span><h1>未読をゼロにするゲームではありません。</h1><p>限られた時間と注意力を、どこへ配分するか。重要な仕事を前に進めながら、チーム・顧客・事業を守り、できるだけ定時に退勤しましょう。</p><button onClick={onStart}><Play fill="currentColor"/>このまま業務開始</button></section><section className="rules-goal"><div><Target/><h2>勝ち筋</h2><p>重要な問題を見極め、自分のタスクも進め、健全な状態で1日を終えること。</p></div><div><Timer/><h2>時間</h2><p>1日は9:00〜18:00。行動や会議で時間が進み、18:00以降は残業です。</p></div><div><Handshake/><h2>マネジメント</h2><p>自分で抱え込まず、適性と負荷を見て人へ任せることも仕事です。</p></div></section><section className="rules-grid"><article><span className="rule-number">01</span><h2>チャットを読む</h2><p>顧客、メンバー、リーダー、営業、上司などから連絡が届きます。見た目の緊急さではなく、文章・相手・流れから重要度を判断してください。</p><p className="rule-note">FYI、感謝、CCだけの連絡は、反応しないことが最適な場合もあります。</p></article><article><span className="rule-number">02</span><h2>対応を選ぶ</h2><div className="action-rule-list">{actionRows.map(([name,time,description])=><div key={name}><strong>{name}</strong><span>{time}</span><p>{description}</p></div>)}</div></article><article><span className="rule-number">03</span><h2>会議を選ぶ</h2><p>会議開始前に参加・欠席・途中参加・途中退出・代理を選べます。会議中も通知は届きますが、内職をすると会議への集中度が下がります。</p><p className="rule-note">集中が必要な顧客定例や1on1では、聞き逃しが信頼低下や追加作業につながります。</p></article><article><span className="rule-number">04</span><h2>集中時間を守る</h2><p>重要タスクは右側のタスク欄から15・30・60分で進めます。最初の5分は準備に使われ、30分以上の連続作業にはボーナスがあります。</p><p className="rule-note">チャット、通話、会議などで中断すると集中状態は失われます。</p></article><article><span className="rule-number">05</span><h2>放置の代償を読む</h2><p>重要な連絡には見えない悪化タイマーがあります。技術懸念は障害へ、顧客問い合わせはクレームへ、相談は信頼低下や退職兆候へ進むことがあります。</p></article><article><span className="rule-number">06</span><h2>結果を振り返る</h2><p>退勤すると、5つの指標、集中時間、対応傾向、あなたのマネジメントタイプ、そして判断が生んだ分岐点を確認できます。</p></article></section><section className="rules-status"><div><h2>常に見る5つの指標</h2><p>一つだけを最大化しても、良い1日にはなりません。</p></div><div className="status-chips"><span>顧客信頼</span><span>チーム状態</span><span>事業成果</span><span>自分の余力</span><span>自分タスク進捗</span></div></section><section className="rules-cta"><div><span className="eyebrow">READY?</span><h2>今日は、何をあえて後回しにしますか？</h2></div><button onClick={onStart}><Play fill="currentColor"/>業務開始</button></section></main></div>
}

function ResultScreen({time,metrics,tasks,stats,unread,logs,delegates,onRestart}:{time:number;metrics:Metrics;tasks:WorkTask[];stats:{handled:number;reactions:number;delegated:number;responseMinutes:number;focusTotal:number;longestFocus:number;switches:number};unread:number;logs:DecisionLog[];delegates:Delegate[];onRestart:()=>void}){
  const progress=tasks.reduce((s,t)=>s+t.progress,0)/tasks.reduce((s,t)=>s+t.required,0)*100
  const overtime=Math.max(0,time-540)
  let type='バランス型'
  if(stats.delegated<2&&stats.handled>12)type='抱え込み型'
  else if(stats.delegated>=5)type='委任型'
  else if(stats.focusTotal>=120&&progress>=65)type='戦略型'
  else if(stats.reactions>stats.handled*.45)type='即レス型'
  else if(metrics.team>88)type='メンバー重視型'
  else if(metrics.customer>90)type='顧客最優先型'
  else if(overtime>90)type='火消し型'
  const scores={緊急対応:Math.round((metrics.customer+metrics.business)/20),顧客対応:Math.round(metrics.customer/10),育成:Math.round(metrics.team/10),委任:Math.min(10,3+stats.delegated),戦略思考:Math.round(progress/10),自己管理:Math.round(metrics.energy/10)}
  const bestLogs=[...logs].sort((a,b)=>({bad:3,warn:2,good:1}[b.severity]-{bad:3,warn:2,good:1}[a.severity])).slice(0,5)
  return <div className="result-screen"><header><div className="brand"><span className="brand-mark">M</span><strong>Manager's Day</strong></div><button onClick={onRestart}>もう一度プレイ</button></header><main><section className="result-hero"><span className="eyebrow">TODAY'S REVIEW</span><h1>今日も、おつかれさまでした。</h1><p>すべてを終えることより、何を選んだか。その積み重ねが今日の結果です。</p><div className="checkout"><div><small>退勤時刻</small><strong>{formatTime(time)}</strong><span>{overtime?`残業 ${overtime}分`:'定時内に退勤'}</span></div><div><small>重要タスク達成率</small><strong>{Math.round(progress)}<i>%</i></strong><span>{tasks.filter(t=>t.progress>=t.required).length} / 4 完了</span></div><div><small>未読チャット</small><strong>{unread}<i>件</i></strong><span>Inbox Zeroは目的ではありません</span></div></div></section>
    <section className="result-grid"><div className="type-card"><span className="eyebrow">YOUR MANAGEMENT STYLE</span><h2>{type}<small>マネージャー</small></h2><p>{type==='抱え込み型'?'目の前の問題を自分で解決する力は高い一方、抱え込みが重要タスクと余力を圧迫しました。適性を見て早めに任せると、チームの成長と自分の集中時間を両立できます。':type==='委任型'?'人に任せることで自分の時間を生み出しました。委任先の負荷を観察し、任せっぱなしにしない仕組みが次の一歩です。':type==='戦略型'?'通知に流されず、まとまった時間を重要タスクへ配分できました。必要な対話を取りこぼさないバランスも意識しましょう。':'チーム・顧客・自分の仕事のバランスを取りながら一日を運びました。小さな兆候を拾う精度をさらに磨けそうです。'}</p><div className="score-bars">{Object.entries(scores).map(([k,v])=><div key={k}><span>{k}</span><div><i style={{width:`${v*10}%`}}/></div><b>{['E','D','D','C','C','B','B','A','A','S','S'][v]}</b></div>)}</div></div>
    <div className="metric-card"><h3>1日の指標</h3><Gauge label="顧客信頼" value={metrics.customer} color="#517263"/><Gauge label="チーム状態" value={metrics.team} color="#6b6482"/><Gauge label="事業成果" value={metrics.business} color="#7b6847"/><Gauge label="自分の余力" value={metrics.energy} color="#58707a"/><div className="stat-tiles"><div><strong>{stats.handled}</strong><span>対応件数</span></div><div><strong>{stats.reactions}</strong><span>リアクション</span></div><div><strong>{stats.delegated}</strong><span>委任</span></div><div><strong>{stats.handled?Math.round(stats.responseMinutes/stats.handled):0}<small>分</small></strong><span>平均返信</span></div><div><strong>{stats.focusTotal}<small>分</small></strong><span>集中合計</span></div><div><strong>{stats.longestFocus}<small>分</small></strong><span>最長集中</span></div></div><p className="load-note">委任先の最大負荷：{Math.max(...delegates.map(d=>d.load))}%</p></div></section>
    <section className="review-card"><div><span className="eyebrow">KEY MOMENTS</span><h2>今日の重要な分岐点</h2><p>あなたの判断が、後の出来事にどうつながったか。</p></div><div className="timeline">{bestLogs.length?bestLogs.map((l,i)=><div className={`timeline-item ${l.severity}`} key={i}><time>{formatTime(l.at)}</time><span className="timeline-dot"/><div><h3>{l.title}</h3><p><b>あなた：</b>{l.action}</p><p><b>その後：</b>{l.outcome}</p></div></div>):<p>まだ記録された分岐はありません。</p>}</div></section></main></div>
}

export default App
