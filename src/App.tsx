import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Bell, BellOff, BookOpen, CalendarDays, Check, ChevronRight, Clock3, Focus, Handshake, LogOut, MessageSquare, MoreHorizontal, Play, ShieldAlert, Sparkles, Target, Timer, Users } from 'lucide-react'
import { actionConfig, delegates as delegateSeed, formatTime, getModeData, modeSettings, senders, type GameModeId } from './scenario'
import type { ActionId, ConversationMessage, DecisionLog, Delegate, Meeting, ScenarioEvent, Skill, WorkTask } from './types'

type Metrics = { customer:number; team:number; business:number; energy:number; focus:number }
type MeetingChoice = 'join' | 'skip' | 'late' | 'leave' | 'proxy'
type InboxFilter = 'all' | 'mentions' | 'unread'

const clamp = (n:number) => Math.max(0, Math.min(100, n))
const formatDuration = (minutes:number) => minutes<60 ? `${minutes}分` : `${Math.floor(minutes/60)}時間${minutes%60 ? `${minutes%60}分` : ''}`
const categorySkill: Record<ScenarioEvent['kind'], Skill> = {
  noise:'調整', simple:'調整', decision:'調整', sensitive:'育成', risk:'技術', sales:'顧客対応', admin:'調整'
}

const replyTemplates: Record<ScenarioEvent['kind'], Record<'short'|'careful'|'question'|'call'|'delegate', string[]>> = {
  noise:{short:['共有ありがとうございます。確認しました。'],careful:['共有ありがとうございます。こちらでも確認しておきます。'],question:['念のため、対応が必要な点はありますか？'],call:['5分ほどお話しして確認させてください。'],delegate:['この件、担当メンバーにも確認をお願いします。']},
  simple:{short:['確認します。少々お待ちください。'],careful:['ご連絡ありがとうございます。状況を確認のうえ、改めてご連絡します。'],question:['念のため、対象の状況をもう少し教えてください。'],call:['短時間で状況を確認したいので、お話しできますか？'],delegate:['この件、担当メンバーに確認をお願いします。']},
  decision:{short:['承知しました。優先して確認します。'],careful:['承知しました。必要な論点を整理して、本日中に共有します。'],question:['期待するアウトプットと優先順位を確認させてください。'],call:['背景を揃えたいので、少しお時間いただけますか？'],delegate:['整理をリーダーにも手伝ってもらいます。']},
  sensitive:{short:['連絡ありがとうございます。今日少し話しましょう。'],careful:['連絡ありがとうございます。気になっているので、今日きちんと時間を取って話しましょう。'],question:['どのあたりで困っていますか？もう少し状況を教えてください。'],call:['今、10分ほど話せますか？'],delegate:['この件はケアも必要なので、リーダーにも状況確認をお願いします。']},
  risk:{short:['確認します。少々お待ちください。'],careful:['ご連絡ありがとうございます。影響範囲を確認し、対応方針をすぐ共有します。'],question:['再現条件と影響範囲をもう少し教えてください。'],call:['すぐ状況をそろえたいので、通話を設定します。'],delegate:['技術確認をリーダーにもお願いして、すぐ判断します。']},
  sales:{short:['確認します。少し待ってください。'],careful:['承知しました。案件への影響を踏まえて、すぐに回答を整理します。'],question:['先方が特に気にしている点をもう少し教えてください。'],call:['提案前に5分だけ認識を合わせましょう。'],delegate:['顧客対応に強いリーダーにも確認をお願いします。']},
  admin:{short:['確認しました。対応します。'],careful:['共有ありがとうございます。期限までに対応できるよう確認します。'],question:['対象と期限を念のため確認させてください。'],call:['手続きの確認を短時間でさせてください。'],delegate:['対応できるメンバーに確認を依頼します。']},
}

const reactionOptions = [
  {emoji:'👍',label:'確認・了解'}, {emoji:'👀',label:'見ています'}, {emoji:'✅',label:'対応済み・OK'}, {emoji:'🙏',label:'ありがとう'}, {emoji:'🎉',label:'称賛・お祝い'},
]

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

function useMobileLayout(){
  const [mobile,setMobile]=useState(()=>window.innerWidth<768)
  useEffect(()=>{const sync=()=>setMobile(window.innerWidth<768);window.addEventListener('resize',sync);return()=>window.removeEventListener('resize',sync)},[])
  return mobile
}

function App() {
  const [phase,setPhase] = useState<'intro'|'rules'|'play'|'result'>('intro')
  const [selectedMode,setSelectedMode] = useState<GameModeId>('standard')
  const [time,setTime] = useState(0)
  const [selected,setSelected] = useState('release')
  const [conversationMessages,setConversationMessages] = useState<ConversationMessage[]>([])
  const [reactions,setReactions] = useState<Record<string,string[]>>({})
  const [reactionFor,setReactionFor] = useState<ScenarioEvent|null>(null)
  const [inboxFilter,setInboxFilter] = useState<InboxFilter>('all')
  const [read,setRead] = useState<Set<string>>(new Set())
  const [resolvedAt,setResolvedAt] = useState<Record<string,number>>({})
  const [snoozed,setSnoozed] = useState<Set<string>>(new Set())
  const [customEvents,setCustomEvents] = useState<ScenarioEvent[]>([])
  const [metrics,setMetrics] = useState<Metrics>({customer:78,team:76,business:64,energy:88,focus:82})
  const [tasks,setTasks] = useState<WorkTask[]>(()=>getModeData('standard').tasks)
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
  const [endConfirm,setEndConfirm] = useState(false)
  const [mobileTab,setMobileTab] = useState<'chat'|'schedule'|'tasks'|'status'>('chat')
  const [mobileDetail,setMobileDetail] = useState(false)
  const [mobileMore,setMobileMore] = useState(false)
  const previousVisible = useRef(0)
  const isMobile=useMobileLayout()

  const modeData = useMemo(()=>getModeData(selectedMode),[selectedMode])
  const activeMeetings = modeData.meetings
  const allEvents = useMemo(() => [...modeData.events,...customEvents].sort((a,b)=>a.at-b.at),[modeData.events,customEvents])
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
  const mentionThreads = threads.filter(t=>t.events.some(e=>e.mention))
  const unreadThreads = threads.filter(t=>t.events.some(e=>!read.has(e.id)))
  const filteredThreads = inboxFilter==='mentions' ? mentionThreads : inboxFilter==='unread' ? unreadThreads : threads
  const selectedEvents = threads.find(t=>t.id===selected)?.events ?? []
  const selectedLast = selectedEvents[selectedEvents.length-1]
  const selectedTimeline = [...selectedEvents.map(event=>({kind:'incoming' as const,event,timestamp:event.at})),...conversationMessages.filter(message=>message.threadId===selected).map(message=>({kind:'activity' as const,message,timestamp:message.timestamp}))].sort((a,b)=>a.timestamp-b.timestamp)
  const unreadCount = visible.filter(e=>!read.has(e.id)).length
  const pendingCount = threads.filter(t=>t.events.some(e=>e.importance>=4) && resolvedAt[t.id]===undefined).length
  const unfinishedTasks = tasks.filter(t=>t.progress<t.required).length

  const activeMeeting = activeMeetings.find(m => {
    const choice=meetingChoices[m.id]
    const start=choice==='late'?m.start+10:m.start
    const end=choice==='leave'?m.start+Math.round((m.end-m.start)/2):(meetingEnds[m.id] ?? m.end)
    return (choice==='join'||choice==='late'||choice==='leave') && time>=start && time<end
  })
  const meetingPrompt = activeMeetings.find(m => !meetingChoices[m.id] && time >= m.start-10 && time <= m.start+12)
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
    const timer=window.setInterval(()=>setTime(t=>t+1),modeData.config.tickMs)
    return ()=>window.clearInterval(timer)
  },[phase,modeData.config.tickMs])

  useEffect(()=>{
    if(phase!=='play' || time<540) return
    const night = time>=780 ? {energy:-.3,focus:-.16} : time>=660 ? {energy:-.16,focus:-.08} : {energy:-.08,focus:-.03}
    adjust(night)
  // Overtime drains continuously, independently of the inbox filter.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[time,phase])

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
  },[time,phase,meetingChoices.m2,meetingEnds.m2,selectedMode])

  const advance = (minutes:number) => setTime(t=>t+minutes)
  const adjust = (patch:Partial<Metrics>) => setMetrics(m=>({customer:clamp(m.customer+(patch.customer??0)),team:clamp(m.team+(patch.team??0)),business:clamp(m.business+(patch.business??0)),energy:clamp(m.energy+(patch.energy??0)),focus:clamp(m.focus+(patch.focus??0))}))
  const overtimeMultiplier = time>=780 ? .5 : time>=660 ? .72 : time>=540 ? .9 : 1
  const overtimeEnergyRate = time>=780 ? 1.9 : time>=660 ? 1.45 : time>=540 ? 1.18 : 1

  const chooseThread=(id:string,events:ScenarioEvent[])=>{
    if(id!==selected){setStats(s=>({...s,switches:s.switches+1}));adjust({focus:-1})}
    setSelected(id); setRead(r=>new Set([...r,...events.map(e=>e.id)]))
  }

  const replyText = (event:ScenarioEvent, action:'short'|'careful'|'question'|'call'|'delegate') => {
    const options = replyTemplates[event.kind][action]
    return options[(event.id.length + time + action.length) % options.length]
  }
  const addConversationMessage=(message:ConversationMessage)=>setConversationMessages(items=>[...items,message])
  const addFollowUp=(event:ScenarioEvent, at:number, text:string)=>setCustomEvents(items=>[...items,{...event,id:`follow-${event.id}-${at}`,at,message:text,mention:false}])

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
    if(action==='react'){setReactionFor(event);return}
    if(action==='delegate'){setDelegateFor(event);return}
    const cfg=actionConfig[action]
    const sentAt=time+cfg.minutes
    advance(cfg.minutes)
    adjust({energy:-cfg.minutes*.09*overtimeEnergyRate,focus:-(action==='call'?5:1.3)*(time>=780?1.35:1)})
    const weak = (event.kind==='sensitive'||event.kind==='risk') && (action==='short'||(time>=660&&action==='question'))
    const solved = action==='careful'||action==='call'||(action==='short'&&!['sensitive','risk'].includes(event.kind))||(action==='ignore'&&event.kind==='noise')
    if(solved) setResolvedAt(r=>({...r,[event.threadId]:time}))
    if(action==='later') {
      setSnoozed(s=>new Set(s).add(event.threadId))
      addConversationMessage({id:`later-${event.id}-${time}`,threadId:event.threadId,senderId:'player',timestamp:time,type:'system',relatedEventId:event.id,privateLabel:'🕒 あとで対応'})
    }
    if(['short','careful','question','call'].includes(action)) {
      const replyAction = action as 'short'|'careful'|'question'|'call'
      const text=replyText(event,replyAction)
      addConversationMessage({id:`reply-${event.id}-${sentAt}-${action}`,threadId:event.threadId,senderId:'player',timestamp:sentAt,text,type:action==='question'?'question':'reply',relatedEventId:event.id})
      if(action==='question') addFollowUp(event,sentAt+8,event.kind==='risk'?'決済部分のエラー処理です。テストが十分ではない気がしています。':'補足します。状況としては、先ほどお伝えした点に加えて確認いただきたいことがあります。')
      if(action==='careful'&&event.kind==='sensitive') addFollowUp(event,sentAt+12,'ありがとうございます。少し安心しました。今日お話しできると助かります。')
    }
    if(weak) adjust(event.kind==='sensitive'?{team:-5}:{customer:-4,business:-2})
    if(action==='careful'&&event.kind==='sensitive') adjust({team:5})
    if(action==='call') adjust(event.kind==='sensitive'?{team:8}:{customer:6})
    if(event.kind==='sales'&&solved) adjust({business:5})
    if(activeMeeting && cfg.minutes>0){
      const loss=cfg.minutes*activeMeeting.focusNeed*1.8
      setMeetingAttention(a=>({...a,[activeMeeting.id]:(a[activeMeeting.id]??100)-loss}))
      if((meetingAttention[activeMeeting.id]??100)-loss<62&&!missedMeeting) setMissedMeeting(activeMeeting)
    }
    setStats(s=>({...s,handled:s.handled+1,responseMinutes:s.responseMinutes+Math.max(0,time-event.at)}))
    setLogs(l=>[...l,{at:sentAt,title:event.branchLabel ?? `${senders[event.sender].name}の連絡`,action:cfg.label,message:['short','careful','question','call'].includes(action)?replyText(event,action as 'short'|'careful'|'question'|'call'):action==='later'?'🕒 あとで対応':undefined,outcome:actionOutcome(event,action),severity:weak?'bad':solved?'good':'warn'}])
  }

  const applyReaction=(event:ScenarioEvent, emoji:string)=>{
    const inappropriate=event.kind==='sensitive' && ['👍','👀','✅'].includes(emoji)
    const celebratory=emoji==='🎉' && event.kind==='noise' && /助か|あり|公開|完了|受領/.test(event.message)
    setReactions(current=>({...current,[event.id]:[...(current[event.id]??[]),emoji]}))
    advance(1)
    adjust(inappropriate?{team:-5,energy:-.1}:celebratory?{team:2,energy:-.1}:{energy:-.1})
    setStats(s=>({...s,handled:s.handled+1,reactions:s.reactions+1,responseMinutes:s.responseMinutes+Math.max(0,time-event.at)}))
    setLogs(l=>[...l,{at:time+1,title:event.branchLabel ?? `${senders[event.sender].name}の連絡`,action:`${emoji} リアクション`,message:emoji,outcome:inappropriate?'相談に対して反応だけでは不十分で、信頼が下がった':celebratory?'成果を低コストで称賛できた':'見たことを低コストで伝えた',severity:inappropriate?'bad':celebratory?'good':'warn'}])
    setReactionFor(null)
  }

  const doDelegate=(person:Delegate)=>{
    if(!delegateFor)return
    const needed=categorySkill[delegateFor.kind]; const fit=person.skills[needed]; const overload=person.load>75
    const sentAt=time+3
    advance(3); setDelegateList(d=>d.map(x=>x.id===person.id?{...x,load:Math.min(100,x.load+12)}:x))
    const delegateText=`@${person.name.split(' ')[0]} この件、確認をお願いできますか？`
    addConversationMessage({id:`delegate-${delegateFor.id}-${sentAt}`,threadId:delegateFor.threadId,senderId:'player',timestamp:sentAt,text:delegateText,type:'delegation',relatedEventId:delegateFor.id})
    addConversationMessage({id:`delegate-system-${delegateFor.id}-${sentAt}`,threadId:delegateFor.threadId,senderId:person.id,timestamp:sentAt+1,type:'system',relatedEventId:delegateFor.id,privateLabel:`${person.name} をメンションしました`})
    setStats(s=>({...s,handled:s.handled+1,delegated:s.delegated+1,responseMinutes:s.responseMinutes+Math.max(0,time-delegateFor.at)}))
    if(fit>=4&&!overload){setResolvedAt(r=>({...r,[delegateFor.threadId]:time}));adjust({team:2,business:delegateFor.kind==='sales'?4:1});addFollowUp(delegateFor,sentAt+10,'確認しました。こちらで対応を進めます。')}
    else {adjust({team:-3});addFollowUp(delegateFor,sentAt+35,'一度確認しましたが、判断が難しく戻します。進め方をご相談させてください。')}
    setLogs(l=>[...l,{at:sentAt,title:delegateFor.branchLabel??'チャット対応',action:`${person.name}へ委任`,message:delegateText,outcome:fit>=4&&!overload?'適性が合い、自律的に解決した':'適性または余力が合わず、差し戻しが発生',severity:fit>=4&&!overload?'good':'bad'}])
    setDelegateFor(null)
  }

  const focusTask=(task:WorkTask,duration:number)=>{
    const nextMeeting=activeMeetings.find(m=>m.start>time && m.start<time+duration && meetingChoices[m.id]!=='skip'&&meetingChoices[m.id]!=='proxy')
    const actual=nextMeeting?Math.max(5,nextMeeting.start-time):duration
    const factor=actual>=60?1.25:actual>=30?1.15:.82
    const cognitive=metrics.focus/100
    const gain=Math.round(Math.max(0,actual-5)*factor*(.65+.35*cognitive)*overtimeMultiplier)
    setTasks(ts=>ts.map(t=>t.id===task.id?{...t,progress:Math.min(t.required,t.progress+gain)}:t))
    advance(actual); adjust({focus:(actual>=30?5:-1)*overtimeMultiplier,energy:-actual*.12*overtimeEnergyRate})
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

  const startGame=()=>{
    const data=getModeData(selectedMode)
    setPhase('play');setTime(0);previousVisible.current=0;setTasks(data.tasks);setCustomEvents([]);setConversationMessages([]);setReactions({});setRead(new Set());setResolvedAt({});setSnoozed(new Set());setMeetingChoices({});setMeetingAttention({});setMeetingEnds({});setProcessed(new Set());setLogs([]);setDelegateList(delegateSeed);setSelected('release');setInboxFilter('all');setReactionFor(null);setDelegateFor(null);setMissedMeeting(null);setEndConfirm(false);setStats({handled:0,reactions:0,delegated:0,responseMinutes:0,focusTotal:0,longestFocus:0,switches:0});setMetrics({customer:78,team:76,business:64,energy:88,focus:82})
  }
  const endGame=()=> time>=540 ? setEndConfirm(true) : setPhase('result')
  const confirmEndGame=()=>{setEndConfirm(false);setPhase('result')}
  const restart=()=>window.location.reload()

  if(phase==='intro') return <StartScreen onStart={startGame} onRules={()=>setPhase('rules')} selectedMode={selectedMode} onSelectMode={setSelectedMode}/>
  if(phase==='rules') return <RulesScreen onBack={()=>setPhase('intro')} onStart={startGame}/>
  if(phase==='result') return <ResultScreen time={time} metrics={metrics} tasks={tasks} stats={stats} unread={unreadCount} logs={logs} delegates={delegateList} mode={modeData.config} onRestart={restart}/>
  if(isMobile) return <MobileGameLayout time={time} metrics={metrics} totalTask={totalTask} activeMeeting={activeMeeting} meetingAttention={meetingAttention} unreadCount={unreadCount} mentionCount={mentionThreads.length} threads={threads} filteredThreads={filteredThreads} selected={selected} selectedLast={selectedLast} selectedTimeline={selectedTimeline} reactions={reactions} snoozed={snoozed} read={read} inboxFilter={inboxFilter} activeMeetings={activeMeetings} meetingChoices={meetingChoices} meetingEnds={meetingEnds} tasks={tasks} toast={toast} meetingPrompt={meetingPrompt} reactionFor={reactionFor} delegateFor={delegateFor} delegates={delegateList} endConfirm={endConfirm} unfinishedTasks={unfinishedTasks} pendingCount={pendingCount} mobileTab={mobileTab} mobileDetail={mobileDetail} mobileMore={mobileMore} onTab={setMobileTab} onOpenThread={(id,events)=>{chooseThread(id,events);setMobileDetail(true);setMobileMore(false)}} onBack={()=>setMobileDetail(false)} onFilter={setInboxFilter} onAction={performAction} onReaction={applyReaction} onCloseReaction={()=>setReactionFor(null)} onDelegate={doDelegate} onCloseDelegate={()=>setDelegateFor(null)} onMeeting={(m,c)=>decideMeeting(m,c)} onFocus={focusTask} onEnd={endGame} onCancelEnd={()=>setEndConfirm(false)} onConfirmEnd={confirmEndGame} onToggleMore={()=>setMobileMore(x=>!x)} />

  return <div className="app-shell">
    <header className="topbar">
      <div className="brand"><span className="brand-mark">M</span><div><strong>Manager's Day</strong><small>木曜日・プロダクト推進部</small></div></div>
      <div className="clock-block"><span className={time>=540?'overtime':''}>{formatTime(time)}</span><small>{time>=540?`残業 ${formatDuration(time-540)}`:'18:00まであと '+(540-time)+'分'}</small></div>
      <div className="top-gauges">
        <Gauge label="顧客信頼" value={metrics.customer} color="#517263"/><Gauge label="チーム" value={metrics.team} color="#6b6482"/><Gauge label="事業成果" value={metrics.business} color="#7b6847"/><Gauge label="自分の余力" value={metrics.energy} color="#58707a"/><Gauge label="タスク" value={totalTask} color="#486456"/>
      </div>
      <button className="icon-btn" onClick={()=>setMuted(m=>!m)} aria-label="通知音を切り替え">{muted?<BellOff size={18}/>:<Bell size={18}/>}</button>
      <button className="end-btn" onClick={endGame}><LogOut size={15}/>{time>=540?'今日は仕事を終える':'退勤する'}</button>
    </header>

    {meetingPrompt&&<MeetingPrompt meeting={meetingPrompt} onChoose={c=>decideMeeting(meetingPrompt,c)}/>}    
    {activeMeeting&&<div className="meeting-live"><span className="pulse-dot"/><strong>会議中</strong><span>{activeMeeting.title}</span><span className="attention">集中度 {Math.max(0,Math.round(meetingAttention[activeMeeting.id]??100))}%</span></div>}
    {toast&&<div className="toast"><Bell size={15}/>{toast}</div>}

    <main className="workspace">
      <section className="inbox-panel panel">
        <div className="panel-title"><div><MessageSquare size={18}/><strong>受信トレイ</strong><span className="count">{unreadCount}</span></div><MoreHorizontal size={18}/></div>
        <div className="filter-row">
          <button className={inboxFilter==='all'?'active':''} onClick={()=>setInboxFilter('all')}>すべて <span>{threads.length}</span></button>
          <button className={inboxFilter==='mentions'?'active':''} onClick={()=>setInboxFilter('mentions')}>メンション <span>{mentionThreads.length}</span></button>
          <button className={inboxFilter==='unread'?'active':''} onClick={()=>setInboxFilter('unread')}>未読 <span>{unreadCount}</span></button>
        </div>
        <div className="thread-list">
          {filteredThreads.length===0&&<div className="empty-inbox">このフィルタに該当する会話はありません<br/><small>他の会話は裏側で通常どおり進行しています</small></div>}
          {filteredThreads.map(t=>{const s=senders[t.last.sender];const unread=t.events.filter(e=>!read.has(e.id)).length;return <button key={t.id} className={`thread ${selected===t.id?'selected':''}`} onClick={()=>chooseThread(t.id,t.events)}>
            <Avatar sender={t.last.sender}/><span className="thread-body"><span className="thread-top"><strong>{s.name}</strong><time>{formatTime(t.last.at)}</time></span><small>{s.role}</small><span className="preview">{t.last.mention&&<b>@</b>}{t.last.message}</span></span>{unread>0&&<span className="unread">{unread}</span>}{snoozed.has(t.id)&&<Clock3 className="snooze" size={12}/>}</button>})}
        </div>
      </section>

      <section className="chat-panel panel">
        {selectedLast?<>
          <div className="chat-head"><Avatar sender={selectedLast.sender}/><div><strong>{senders[selectedLast.sender].name}</strong><small>{senders[selectedLast.sender].role} ・ {senders[selectedLast.sender].category}</small></div><span className="presence">● オンライン</span></div>
          {missedMeeting&&<div className="missed-card"><div><ShieldAlert size={20}/><strong>会議の内容を聞き逃しました</strong></div><p>「では先ほど話した対応について、来週までにお願いします。」何を指しているか分かりません。</p><div><button onClick={()=>resolveMissed('yes')}>承知しました</button><button onClick={()=>resolveMissed('repeat')}>もう一度説明してもらう</button><button onClick={()=>resolveMissed('member')}>後でメンバーに確認</button></div></div>}
          <div className="messages">
            <div className="day-divider"><span>今日</span></div>
            {selectedTimeline.map((item,i)=>{
              if(item.kind==='activity') {
                const message=item.message
                if(message.type==='system') return <div className="system-message" key={message.id}><span>{message.privateLabel}</span><time>{formatTime(message.timestamp)}</time></div>
                return <div className="message message-self" key={message.id}><div><div className="message-meta"><strong>あなた</strong><time>{formatTime(message.timestamp)}</time><span className="sent-label">送信済み</span></div><p>{message.text}</p></div><span className="self-avatar">あ</span></div>
              }
              const e=item.event
              return <div className="message" key={e.id}><Avatar sender={e.sender}/><div><div className="message-meta"><strong>{senders[e.sender].name}</strong><time>{formatTime(e.at)}</time>{e.mention&&<span className="mention">あなた宛</span>}</div><p>{e.message}</p>{reactions[e.id]?.length>0&&<div className="reaction-bar">{[...new Set(reactions[e.id])].map(emoji=><span key={emoji}>{emoji} {reactions[e.id].filter(value=>value===emoji).length}</span>)}</div>}{i<selectedTimeline.length-1&&<span className="thread-follow">スレッドが続いています</span>}</div></div>
            })}
          </div>
          <div className="action-dock">
            <div className="dock-hint"><span>このメッセージにどう対応しますか？</span><small>緊急度は文面から判断してください</small></div>
            <div className="action-grid">{(Object.entries(actionConfig) as [ActionId,typeof actionConfig[ActionId]][]).map(([id,c])=>{const preview=selectedLast&&['short','careful','question','call','delegate'].includes(id)?replyText(selectedLast,id as 'short'|'careful'|'question'|'call'|'delegate'):c.description;return <button key={id} onClick={()=>performAction(id)} title={preview}><span>{c.icon}</span><strong>{c.label}</strong><small>{c.minutes===0?'0分':`${c.minutes}分`}</small><em>{preview}</em></button>})}</div>
          </div>
        </>:<div className="chat-empty"><MessageSquare/><strong>会話を選択してください</strong></div>}
      </section>

      <aside className="right-rail">
        <section className="schedule-card panel">
          <div className="panel-title"><div><CalendarDays size={17}/><strong>今日の予定</strong></div><span>{activeMeetings.length}件</span></div>
          <div className="schedule-list">{activeMeetings.map(m=>{const choice=meetingChoices[m.id];const isNow=time>=m.start&&time<(meetingEnds[m.id]??m.end);return <div className={`meeting-row ${isNow?'now':''}`} key={m.id}>
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

    {endConfirm&&<div className="modal-backdrop"><div className="end-confirm-modal"><span className="eyebrow">END OF DAY</span><h2>本日の業務を終了しますか？</h2><p>未読を残して退勤することも、マネージャーとしての大切な判断です。</p><div className="end-summary"><div><strong>{unfinishedTasks}件</strong><span>未完了重要タスク</span></div><div><strong>{unreadCount}件</strong><span>未読チャット</span></div><div><strong>{pendingCount}件</strong><span>対応待ち</span></div></div><div className="confirm-actions"><button onClick={()=>setEndConfirm(false)}>キャンセル</button><button className="primary" onClick={confirmEndGame}>業務終了</button></div></div></div>}

    {reactionFor&&<div className="modal-backdrop"><div className="reaction-modal"><div className="modal-head"><div><span className="eyebrow">REACTION</span><h2>リアクションを選ぶ</h2></div><button onClick={()=>setReactionFor(null)}>×</button></div><p>{reactionFor.message}</p><div className="reaction-options">{reactionOptions.map(option=><button key={option.emoji} onClick={()=>applyReaction(reactionFor,option.emoji)}><span>{option.emoji}</span><small>{option.label}</small></button>)}</div></div></div>}

    {delegateFor&&<div className="modal-backdrop"><div className="delegate-modal"><div className="modal-head"><div><span className="eyebrow">委任先を選ぶ</span><h2>誰に任せますか？</h2></div><button onClick={()=>setDelegateFor(null)}>×</button></div><div className="delegate-context"><strong>{senders[delegateFor.sender].name}</strong><p>{delegateFor.message}</p><span>求められる力：{categorySkill[delegateFor.kind]}</span></div><div className="delegate-options">{delegateList.map(d=><button key={d.id} onClick={()=>doDelegate(d)}><div><span className="avatar" style={{background:'#607067'}}>{d.name[0]}</span><p><strong>{d.name}</strong><small>{d.role}</small></p><ChevronRight/></div><div className="skill-row">{Object.entries(d.skills).map(([k,v])=><span key={k}>{k} <b>{'●'.repeat(Math.ceil(v/2))}</b></span>)}</div><div className="load-row"><span>現在の負荷</span><div><i style={{width:`${d.load}%`}}/></div><b>{d.load}%</b></div></button>)}</div></div></div>}
  </div>
}

function MobileGameLayout({time,metrics,totalTask,activeMeeting,meetingAttention,unreadCount,mentionCount,threads,filteredThreads,selected,selectedLast,selectedTimeline,reactions,snoozed,read,inboxFilter,activeMeetings,meetingChoices,meetingEnds,tasks,toast,meetingPrompt,reactionFor,delegateFor,delegates,endConfirm,unfinishedTasks,pendingCount,mobileTab,mobileDetail,mobileMore,onTab,onOpenThread,onBack,onFilter,onAction,onReaction,onCloseReaction,onDelegate,onCloseDelegate,onMeeting,onFocus,onEnd,onCancelEnd,onConfirmEnd,onToggleMore}:{time:number;metrics:Metrics;totalTask:number;activeMeeting:Meeting|undefined;meetingAttention:Record<string,number>;unreadCount:number;mentionCount:number;threads:{id:string;events:ScenarioEvent[];last:ScenarioEvent}[];filteredThreads:{id:string;events:ScenarioEvent[];last:ScenarioEvent}[];selected:string;selectedLast:ScenarioEvent|undefined;selectedTimeline:({kind:'incoming';event:ScenarioEvent;timestamp:number}|{kind:'activity';message:ConversationMessage;timestamp:number})[];reactions:Record<string,string[]>;snoozed:Set<string>;read:Set<string>;inboxFilter:InboxFilter;activeMeetings:Meeting[];meetingChoices:Record<string,MeetingChoice>;meetingEnds:Record<string,number>;tasks:WorkTask[];toast:string|null;meetingPrompt:Meeting|undefined;reactionFor:ScenarioEvent|null;delegateFor:ScenarioEvent|null;delegates:Delegate[];endConfirm:boolean;unfinishedTasks:number;pendingCount:number;mobileTab:'chat'|'schedule'|'tasks'|'status';mobileDetail:boolean;mobileMore:boolean;onTab:(tab:'chat'|'schedule'|'tasks'|'status')=>void;onOpenThread:(id:string,events:ScenarioEvent[])=>void;onBack:()=>void;onFilter:(filter:InboxFilter)=>void;onAction:(action:ActionId)=>void;onReaction:(event:ScenarioEvent,emoji:string)=>void;onCloseReaction:()=>void;onDelegate:(delegate:Delegate)=>void;onCloseDelegate:()=>void;onMeeting:(meeting:Meeting,choice:MeetingChoice)=>void;onFocus:(task:WorkTask,duration:number)=>void;onEnd:()=>void;onCancelEnd:()=>void;onConfirmEnd:()=>void;onToggleMore:()=>void}){
  const overtime=Math.max(0,time-540)
  const selectedMessages=selectedTimeline
  return <div className="mobile-game-shell">
    <header className="mobile-header"><div><strong className={overtime?'overtime':''}>{formatTime(time)}</strong><small>{overtime?`残業 ${formatDuration(overtime)}`:activeMeeting?`${activeMeeting.title} 中`:'次の判断を選ぶ'}</small></div><div className="mobile-header-status"><span>@ {mentionCount}</span><span>未読 {unreadCount}</span><button onClick={onEnd} aria-label="業務を終了"><LogOut size={17}/></button></div></header>
    {activeMeeting&&<div className="mobile-meeting-bar"><span className="pulse-dot"/><strong>{activeMeeting.title}</strong><small>集中 {Math.round(meetingAttention[activeMeeting.id]??100)}%</small></div>}
    {toast&&<div className="mobile-toast"><Bell size={15}/><span>{toast}</span>{activeMeeting&&<button onClick={()=>onTab('chat')}>見る</button>}</div>}
    <main className="mobile-main">
      {mobileTab==='chat'&&!mobileDetail&&<section className="mobile-inbox"><div className="mobile-section-title"><div><MessageSquare size={18}/><h1>チャット</h1></div><span>{unreadCount} 未読</span></div><div className="mobile-filter-row"><button className={inboxFilter==='all'?'active':''} onClick={()=>onFilter('all')}>すべて <b>{threads.length}</b></button><button className={inboxFilter==='mentions'?'active':''} onClick={()=>onFilter('mentions')}>メンション <b>{mentionCount}</b></button><button className={inboxFilter==='unread'?'active':''} onClick={()=>onFilter('unread')}>未読 <b>{unreadCount}</b></button></div><div className="mobile-thread-list">{filteredThreads.length?filteredThreads.map(thread=>{const sender=senders[thread.last.sender];const isUnread=thread.events.some(event=>!read.has(event.id));const isMentioned=thread.events.some(event=>event.mention);return <button className={`mobile-thread ${isUnread?'unread':''} ${selected===thread.id?'selected':''}`} key={thread.id} onClick={()=>onOpenThread(thread.id,thread.events)}><Avatar sender={thread.last.sender}/><span className="mobile-thread-content"><span className="mobile-thread-head"><strong>{sender.name}</strong><time>{formatTime(thread.last.at)}</time></span><small>{sender.role}</small><em>{thread.last.mention&&'@ '}{thread.last.message}</em></span><span className="mobile-thread-signals">{isMentioned&&<i>@</i>}{isUnread&&<b/>}{snoozed.has(thread.id)&&<Clock3 size={13}/>}</span></button>}):<div className="mobile-empty">このフィルタに該当する会話はありません</div>}</div></section>}
      {mobileTab==='chat'&&mobileDetail&&selectedLast&&<section className="mobile-chat-detail"><div className="mobile-detail-head"><button onClick={onBack} aria-label="チャット一覧へ戻る"><ArrowLeft/></button><Avatar sender={selectedLast.sender}/><div><strong>{senders[selectedLast.sender].name}</strong><small>{senders[selectedLast.sender].role}</small></div></div><div className="mobile-messages">{selectedMessages.map(item=>item.kind==='incoming'?<div className="mobile-message" key={item.event.id}><Avatar sender={item.event.sender}/><div><span><strong>{senders[item.event.sender].name}</strong><time>{formatTime(item.event.at)}</time></span><p>{item.event.message}</p>{reactions[item.event.id]?.length>0&&<div className="reaction-bar">{[...new Set(reactions[item.event.id])].map(emoji=><b key={emoji}>{emoji} {reactions[item.event.id].filter(value=>value===emoji).length}</b>)}</div>}</div></div>:item.message.type==='system'?<div className="mobile-system" key={item.message.id}>{item.message.privateLabel}</div>:<div className="mobile-message self" key={item.message.id}><div><span><strong>あなた</strong><time>{formatTime(item.message.timestamp)}</time></span><p>{item.message.text}</p></div></div>)}</div><div className="mobile-actions"><div><button onClick={()=>onAction('react')}>👍<small>リアクション</small></button><button onClick={()=>onAction('short')}>短く返信</button><button onClick={()=>onAction('careful')}>丁寧に返信</button><button onClick={onToggleMore}>その他</button></div>{mobileMore&&<div className="mobile-more-actions"><button onClick={()=>onAction('question')}>質問する</button><button onClick={()=>onAction('later')}>あとで対応</button><button onClick={()=>onAction('delegate')}>委任する</button><button onClick={()=>onAction('call')}>通話を設定</button><button onClick={()=>onAction('ignore')}>対応しない</button></div>}</div></section>}
      {mobileTab==='schedule'&&<section className="mobile-schedule"><div className="mobile-section-title"><div><CalendarDays size={18}/><h1>予定</h1></div><span>{activeMeetings.length}件</span></div><div className="mobile-timeline">{activeMeetings.map(meeting=>{const choice=meetingChoices[meeting.id];const current=activeMeeting?.id===meeting.id;const done=time>=(meetingEnds[meeting.id]??meeting.end);return <article className={`${current?'current':''} ${done?'done':''}`} key={meeting.id}><time>{formatTime(meeting.start)}<small>{formatTime(meetingEnds[meeting.id]??meeting.end)}</small></time><div><span style={{background:meeting.color}}/><strong>{meeting.title}</strong><small>{current?'会議中':done?'終了':choice==='proxy'?'代理参加':choice==='skip'?'欠席':choice==='join'?'参加予定':'未決定'}</small>{!choice&&!done&&<p><button onClick={()=>onMeeting(meeting,'join')}>参加</button><button onClick={()=>onMeeting(meeting,'proxy')}>代理</button><button onClick={()=>onMeeting(meeting,'skip')}>欠席</button></p>}</div></article>})}</div></section>}
      {mobileTab==='tasks'&&<section className="mobile-tasks"><div className="mobile-section-title"><div><Focus size={18}/><h1>自分の仕事</h1></div><span>{Math.round(totalTask)}%</span></div>{tasks.map(task=>{const progress=Math.min(100,Math.round(task.progress/task.required*100));return <article className="mobile-task" key={task.id}><div><span style={{color:task.color}}>{task.importance}</span><small>{task.deadline}</small></div><h2>{task.title}</h2><div className="mobile-progress"><i style={{width:`${progress}%`,background:task.color}}/></div><p>{progress}% ・ {Math.round(task.progress)} / {task.required}分</p><div><button onClick={()=>onFocus(task,30)} disabled={progress>=100}>30分集中する</button><button onClick={()=>onFocus(task,60)} disabled={progress>=100}>60分</button></div></article>})}</section>}
      {mobileTab==='status'&&<section className="mobile-status"><div className="mobile-section-title"><div><Users size={18}/><h1>状況</h1></div><span>{overtime?`残業 ${formatDuration(overtime)}`:'勤務中'}</span></div><div className="mobile-gauges"><Gauge label="顧客信頼" value={metrics.customer} color="#517263"/><Gauge label="チーム状態" value={metrics.team} color="#6b6482"/><Gauge label="事業成果" value={metrics.business} color="#7b6847"/><Gauge label="自分の余力" value={metrics.energy} color="#58707a"/><Gauge label="重要タスク進捗" value={totalTask} color="#486456"/><Gauge label="集中力" value={metrics.focus} color="#667f83"/></div><div className="mobile-status-note">未読をゼロにする必要はありません。重要な仕事と、今の余力を見ながら選んでください。</div></section>}
    </main>
    <nav className="mobile-bottom-nav"><button className={mobileTab==='chat'?'active':''} onClick={()=>{onTab('chat');onBack()}}><MessageSquare/><span>チャット</span>{unreadCount>0&&<b>{unreadCount}</b>}</button><button className={mobileTab==='schedule'?'active':''} onClick={()=>{onTab('schedule');onBack()}}><CalendarDays/><span>予定</span></button><button className={mobileTab==='tasks'?'active':''} onClick={()=>{onTab('tasks');onBack()}}><Focus/><span>タスク</span></button><button className={mobileTab==='status'?'active':''} onClick={()=>{onTab('status');onBack()}}><Users/><span>状況</span></button></nav>
    {meetingPrompt&&<div className="mobile-sheet-backdrop"><div className="mobile-sheet"><span className="eyebrow">MEETING START</span><h2>{meetingPrompt.title}</h2><p>{formatTime(meetingPrompt.start)}〜{formatTime(meetingPrompt.end)} ・ 集中度 {meetingPrompt.focusNeed===3?'高':meetingPrompt.focusNeed===2?'中':'低'}</p><div><button className="primary" onClick={()=>onMeeting(meetingPrompt,'join')}>参加</button><button onClick={()=>onMeeting(meetingPrompt,'late')}>途中参加</button><button onClick={()=>onMeeting(meetingPrompt,'proxy')}>代理</button><button onClick={()=>onMeeting(meetingPrompt,'skip')}>欠席</button></div></div></div>}
    {reactionFor&&<div className="mobile-sheet-backdrop"><div className="mobile-sheet"><h2>リアクションを選ぶ</h2><div className="mobile-reactions">{reactionOptions.map(option=><button key={option.emoji} onClick={()=>onReaction(reactionFor,option.emoji)}>{option.emoji}<small>{option.label}</small></button>)}</div><button className="sheet-cancel" onClick={onCloseReaction}>キャンセル</button></div></div>}
    {delegateFor&&<div className="mobile-sheet-backdrop"><div className="mobile-sheet"><h2>誰に委任しますか？</h2><p>{delegateFor.message}</p><div className="mobile-delegates">{delegates.map(delegate=><button key={delegate.id} onClick={()=>onDelegate(delegate)}><strong>{delegate.name}</strong><small>{delegate.role} ・ 負荷 {delegate.load}%</small></button>)}</div><button className="sheet-cancel" onClick={onCloseDelegate}>キャンセル</button></div></div>}
    {endConfirm&&<div className="mobile-sheet-backdrop"><div className="mobile-sheet"><span className="eyebrow">END OF DAY</span><h2>今日は仕事を終えますか？</h2><p>未完了タスク {unfinishedTasks}件 ・ 未読 {unreadCount}件 ・ 対応待ち {pendingCount}件</p><div><button onClick={onCancelEnd}>キャンセル</button><button className="primary" onClick={onConfirmEnd}>業務終了</button></div></div></div>}
  </div>
}

function MeetingPrompt({meeting,onChoose}:{meeting:Meeting;onChoose:(c:MeetingChoice)=>void}){
  return <div className="meeting-prompt"><div><CalendarDays size={20}/><p><small>{formatTime(meeting.start)}から</small><strong>{meeting.title}</strong><span>集中必要度：{['','低','中','高'][meeting.focusNeed]}</span></p></div><div><button className="primary" onClick={()=>onChoose('join')}>参加</button><button onClick={()=>onChoose('late')}>途中参加</button><button onClick={()=>onChoose('leave')}>途中退出</button><button onClick={()=>onChoose('proxy')}>代理</button><button onClick={()=>onChoose('skip')}>欠席</button></div></div>
}

function StartScreen({onStart,onRules,selectedMode,onSelectMode}:{onStart:()=>void;onRules:()=>void;selectedMode:GameModeId;onSelectMode:(mode:GameModeId)=>void}){
  return <div className="start-screen"><div className="start-window"><div className="start-visual"><div className="desk-clock"><Clock3/><strong>09:00</strong><span>THURSDAY</span></div><div className="visual-card vc1"><MessageSquare/><span><b>{modeSettings[selectedMode].eventIds.length}</b> チャット</span></div><div className="visual-card vc2"><CalendarDays/><span>会議 {modeSettings[selectedMode].meetingIds.length}件</span></div><div className="visual-card vc3"><Focus/><span>重要タスク {modeSettings[selectedMode].taskCount}件</span></div></div><div className="start-copy"><span className="eyebrow">MANAGER'S DAY</span><h1>あなたは今日から<br/>チームを率いる<br/><em>マネージャー</em>です。</h1><p>重要な仕事を進めながら、チーム・顧客・事業を守ってください。</p><div className="start-rule"><Check/><span>すべての連絡に返信する必要はありません。</span></div><ModePicker selectedMode={selectedMode} onSelect={onSelectMode}/><button onClick={onStart}><Play fill="currentColor"/>業務開始 <small>{modeSettings[selectedMode].estimatedPlayTime}</small></button><button className="rules-link" onClick={onRules}><BookOpen/>ゲームルールを見る</button></div></div><p className="start-foot">1日の終わりに、あなたのマネジメントスタイルを振り返ります。</p></div>
}

function ModePicker({selectedMode,onSelect}:{selectedMode:GameModeId;onSelect:(mode:GameModeId)=>void}){
  return <div className="mode-picker" aria-label="プレイモードを選択">{(Object.values(modeSettings)).map(mode=><button key={mode.id} className={`mode-card ${selectedMode===mode.id?'selected':''}`} onClick={()=>onSelect(mode.id)}><span>{mode.id==='standard'&&<em>おすすめ</em>}{mode.estimatedPlayTime}</span><strong>{mode.label}</strong><small>{mode.description}</small></button>)}</div>
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

function ResultScreen({time,metrics,tasks,stats,unread,logs,delegates,mode,onRestart}:{time:number;metrics:Metrics;tasks:WorkTask[];stats:{handled:number;reactions:number;delegated:number;responseMinutes:number;focusTotal:number;longestFocus:number;switches:number};unread:number;logs:DecisionLog[];delegates:Delegate[];mode:typeof modeSettings[GameModeId];onRestart:()=>void}){
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
  if(overtime>=180) type='長時間残業型'
  const scores={緊急対応:Math.round((metrics.customer+metrics.business)/20),顧客対応:Math.round(metrics.customer/10),育成:Math.round(metrics.team/10),委任:Math.min(10,3+stats.delegated),戦略思考:Math.round(progress/10),自己管理:Math.max(1,Math.round(metrics.energy/10)-Math.ceil(overtime/120))}
  const bestLogs=[...logs].sort((a,b)=>({bad:3,warn:2,good:1}[b.severity]-{bad:3,warn:2,good:1}[a.severity])).slice(0,5)
  return <div className="result-screen"><header><div className="brand"><span className="brand-mark">M</span><strong>Manager's Day</strong></div><button onClick={onRestart}>もう一度プレイ</button></header><main><section className="result-hero"><span className="eyebrow">TODAY'S REVIEW</span><h1>今日も、おつかれさまでした。</h1><p>すべてを終えることより、何を選んだか。その積み重ねが今日の結果です。</p><div className="mode-result"><span>プレイモード</span><strong>{mode.label}</strong><small>{mode.summary} {mode.evaluationTone}</small></div><div className="checkout"><div className={overtime>=180?'checkout-late':''}><small>最終退勤時刻</small><strong>{formatTime(time)}</strong><span>{overtime?`残業 ${formatDuration(overtime)}`:'定時内に退勤'}</span></div><div><small>重要タスク達成率</small><strong>{Math.round(progress)}<i>%</i></strong><span>{tasks.filter(t=>t.progress>=t.required).length} / {tasks.length} 完了</span></div><div><small>未読チャット</small><strong>{unread}<i>件</i></strong><span>Inbox Zeroは目的ではありません</span></div></div>{overtime>=180&&<p className="night-shift-message">仕事は進みました。しかし、それを実現するために<strong>{formatDuration(overtime)}</strong>の残業をしています。</p>}</section>
    <section className="result-grid"><div className="type-card"><span className="eyebrow">YOUR MANAGEMENT STYLE</span><h2>{type}<small>マネージャー</small></h2><p>{type==='長時間残業型'?`多くの課題を解決しましたが、最終退勤は${formatTime(time)}でした。成果を自分の時間で埋める傾向が強く、任せ方と時間設計には改善余地があります。`:type==='抱え込み型'?'目の前の問題を自分で解決する力は高い一方、抱え込みが重要タスクと余力を圧迫しました。適性を見て早めに任せると、チームの成長と自分の集中時間を両立できます。':type==='委任型'?'人に任せることで自分の時間を生み出しました。委任先の負荷を観察し、任せっぱなしにしない仕組みが次の一歩です。':type==='戦略型'?'通知に流されず、まとまった時間を重要タスクへ配分できました。必要な対話を取りこぼさないバランスも意識しましょう。':'チーム・顧客・自分の仕事のバランスを取りながら一日を運びました。小さな兆候を拾う精度をさらに磨けそうです。'}</p>{overtime>0&&<div className={`overtime-result ${overtime>=180?'late-night':''}`}><strong>最終退勤 {formatTime(time)}</strong><span>{formatDuration(overtime)}の残業。{overtime>=180?'仕事を終えても、時間設計は結果の一部です。':'残業が成果を補っていないか、振り返ってみましょう。'}</span></div>}<div className="score-bars">{Object.entries(scores).map(([k,v])=><div key={k}><span>{k}</span><div><i style={{width:`${v*10}%`}}/></div><b>{['E','D','D','C','C','B','B','A','A','S','S'][v]}</b></div>)}</div></div>
    <div className="metric-card"><h3>1日の指標</h3><Gauge label="顧客信頼" value={metrics.customer} color="#517263"/><Gauge label="チーム状態" value={metrics.team} color="#6b6482"/><Gauge label="事業成果" value={metrics.business} color="#7b6847"/><Gauge label="自分の余力" value={metrics.energy} color="#58707a"/><div className="stat-tiles"><div><strong>{stats.handled}</strong><span>対応件数</span></div><div><strong>{stats.reactions}</strong><span>リアクション</span></div><div><strong>{stats.delegated}</strong><span>委任</span></div><div><strong>{stats.handled?Math.round(stats.responseMinutes/stats.handled):0}<small>分</small></strong><span>平均返信</span></div><div><strong>{stats.focusTotal}<small>分</small></strong><span>集中合計</span></div><div><strong>{stats.longestFocus}<small>分</small></strong><span>最長集中</span></div></div><p className="load-note">委任先の最大負荷：{Math.max(...delegates.map(d=>d.load))}%</p></div></section>
    <section className="review-card"><div><span className="eyebrow">KEY MOMENTS</span><h2>今日の重要な分岐点</h2><p>あなたの判断が、後の出来事にどうつながったか。</p></div><div className="timeline">{bestLogs.length?bestLogs.map((l,i)=><div className={`timeline-item ${l.severity}`} key={i}><time>{formatTime(l.at)}</time><span className="timeline-dot"/><div><h3>{l.title}</h3><p><b>あなた：</b>{l.action}{l.message&&<><br/><span className="review-message">「{l.message}」</span></>}</p><p><b>その後：</b>{l.outcome}</p></div></div>):<p>まだ記録された分岐はありません。</p>}</div></section></main></div>
}

export default App
