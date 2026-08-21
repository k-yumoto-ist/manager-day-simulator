import { meetings, senders } from './scenario'
import type { CharacterInteraction, Delegate, Meeting, PerspectiveMoment, PerspectiveTone, ScenarioEvent, StakeholderPerspective, WorkTask } from './types'

export interface PerspectiveContext {
  events: ScenarioEvent[]
  interactions: CharacterInteraction[]
  meetingAttention: Record<string, number>
  delegates: Delegate[]
  tasks: WorkTask[]
  overtime: number
  endTime: number
}

type Viewpoint = 'member' | 'leader' | 'client' | 'sales' | 'boss'

interface PerspectiveDefinition {
  characterId: string
  viewpoint: Viewpoint
  meetingId?: string
  taskId?: string
  delegateId?: string
}

interface PerspectiveSignals {
  direct: CharacterInteraction[]
  assigned: CharacterInteraction[]
  relevantEvents: ScenarioEvent[]
  importantThreads: Map<string, ScenarioEvent[]>
  unanswered: ScenarioEvent[]
  fast: number
  careful: number
  calls: number
  questions: number
  reactions: number
  weakReactions: number
  deferred: number
  ignored: number
  effective: number
  meeting?: CharacterInteraction
  meetingAttention: number
  meetingMissed: boolean
  meetingTitle?: string
  meetingAt?: number
  taskProgress?: number
  delegateLoad?: number
  repaired: boolean
  escalated: boolean
}

const definitions: PerspectiveDefinition[] = [
  {characterId:'suzuki',viewpoint:'member',meetingId:'m4'},
  {characterId:'sato',viewpoint:'leader',meetingId:'m1',delegateId:'d1'},
  {characterId:'client',viewpoint:'client',meetingId:'m2'},
  {characterId:'sales',viewpoint:'sales',meetingId:'m5'},
  {characterId:'boss',viewpoint:'boss',meetingId:'m6',taskId:'t4'},
]

const actionLabels: Record<CharacterInteraction['action'],string> = {
  react:'リアクション', short:'短く返信', careful:'丁寧に返信', question:'質問', later:'あとで対応', delegate:'委任', call:'通話を設定', ignore:'対応しない', meeting:'会議の参加判断', 'meeting-recovery':'聞き逃しへの対応',
}

const relationshipLabels: Record<PerspectiveTone,string> = {
  positive:'少し深まった', neutral:'大きな変化なし', negative:'やや距離ができた', mixed:'揺れがあった',
}

const pick = (values:string[], seed:number) => values[Math.abs(seed)%values.length]

function collectSignals(definition:PerspectiveDefinition, context:PerspectiveContext): PerspectiveSignals {
  const relevantEvents=context.events.filter(event=>event.sender===definition.characterId)
  const direct=context.interactions.filter(item=>item.characterId===definition.characterId).sort((a,b)=>a.at-b.at)
  const assigned=context.interactions.filter(item=>item.delegateCharacterId===definition.characterId).sort((a,b)=>a.at-b.at)
  const importantThreads=new Map<string,ScenarioEvent[]>()
  relevantEvents.filter(event=>event.importance>=4).forEach(event=>importantThreads.set(event.threadId,[...(importantThreads.get(event.threadId)??[]),event]))
  const handledThreads=new Set(direct.filter(item=>item.threadId&&item.action!=='later'&&item.action!=='ignore'&&(item.action!=='react'||item.effective)).map(item=>item.threadId!))
  const unanswered=[...importantThreads.entries()].filter(([threadId])=>!handledThreads.has(threadId)).map(([,events])=>events[events.length-1])
  const weakReactions=direct.filter(item=>item.action==='react'&&item.eventId&&context.events.find(event=>event.id===item.eventId)?.kind==='sensitive').length
  const negativeActions=direct.filter(item=>item.action==='later'||item.action==='ignore'||(item.action==='react'&&weakReactions>0))
  const positiveActions=direct.filter(item=>item.action==='careful'||item.action==='call'||item.effective)
  const repaired=negativeActions.some(negative=>positiveActions.some(positive=>Boolean(negative.threadId&&positive.threadId===negative.threadId&&positive.at>negative.at)))
  const escalated=[...importantThreads.values()].some(events=>events.length>=3)
  const meeting=[...direct].reverse().find(item=>item.meetingId===definition.meetingId)
  const meetingData=definition.meetingId?meetings.find(item=>item.id===definition.meetingId):undefined
  const meetingMissed=Boolean(meetingData&&context.endTime>=meetingData.end&&!meeting)
  const task=definition.taskId?context.tasks.find(item=>item.id===definition.taskId):undefined
  const delegate=definition.delegateId?context.delegates.find(item=>item.id===definition.delegateId):undefined
  return {
    direct,assigned,relevantEvents,importantThreads,unanswered,
    fast:direct.filter(item=>item.responseDelay!==undefined&&item.responseDelay<=30&&['short','careful','question','call','delegate'].includes(item.action)).length,
    careful:direct.filter(item=>item.action==='careful').length,
    calls:direct.filter(item=>item.action==='call').length,
    questions:direct.filter(item=>item.action==='question').length,
    reactions:direct.filter(item=>item.action==='react').length,
    weakReactions,
    deferred:direct.filter(item=>item.action==='later').length,
    ignored:direct.filter(item=>item.action==='ignore').length,
    effective:direct.filter(item=>item.effective).length,
    meeting,
    meetingAttention:definition.meetingId?(context.meetingAttention[definition.meetingId]??100):100,
    meetingMissed,
    meetingTitle:meetingData?.title,
    meetingAt:meetingData?.start,
    taskProgress:task?Math.round(task.progress/task.required*100):undefined,
    delegateLoad:delegate?.load,
    repaired,escalated,
  }
}

function evaluateMember(signals:PerspectiveSignals, seed:number) {
  const meetingMiss=signals.meetingMissed||signals.meeting?.meetingChoice==='欠席'||signals.meetingAttention<65
  if(signals.repaired) return {tone:'mixed' as const,quote:pick(['最初は少し不安でしたが、あとでちゃんと話してもらえて安心しました。','すぐには話せませんでしたが、最後に向き合ってもらえたのはうれしかったです。'],seed),impression:'あとから向き合ってくれた'}
  if(signals.calls+signals.careful>0&&!meetingMiss) return {tone:'positive' as const,quote:pick(['忙しい中でも時間を取ってもらえて、安心して相談できました。','話を急いで結論にせず、きちんと聞いてもらえたと感じました。'],seed),impression:'相談しても大丈夫だと思えた'}
  if(signals.weakReactions>0) return {tone:'negative' as const,quote:'見てもらえたのは分かりましたが、どうしたらいいかは分からないままでした。',impression:'声をかけ直しづらかった'}
  if(signals.unanswered.length||meetingMiss) return {tone:'negative' as const,quote:pick(['忙しそうだったので、これ以上相談するのはやめようと思いました。','何度か声をかけようと思いましたが、今日は自分で何とかすることにしました。'],seed),impression:'話しかけづらかった'}
  return {tone:'neutral' as const,quote:'短いやり取りでしたが、こちらの状況は見てもらえていると思いました。',impression:'様子を見ながら相談したい'}
}

function evaluateLeader(signals:PerspectiveSignals, seed:number) {
  const overloaded=signals.assigned.length>=3||(signals.delegateLoad??0)>=85
  const useful=signals.assigned.filter(item=>item.effective).length
  if(useful>0&&overloaded) return {tone:'mixed' as const,quote:'判断を任せてもらえたのは良かったです。ただ、今日は依頼が集中して少し余力がなくなりました。',impression:'信頼と負荷の両方を感じた'}
  if(useful>0) return {tone:'positive' as const,quote:pick(['目的を伝えて任せてもらえたので、自分で判断して進められました。','必要なところだけ判断してもらい、あとは任せてもらえたのが助かりました。'],seed),impression:'任せてもらえた'}
  if(signals.escalated&&signals.assigned.length===0) return {tone:'mixed' as const,quote:'判断はしてもらえましたが、もう少し早く任せてもらえれば、問題が大きくなる前に動けたと思います。',impression:'抱え込んでいるように見えた'}
  if(signals.unanswered.length||signals.meetingMissed) return {tone:'negative' as const,quote:'懸念は共有しましたが、判断が見えない時間が長く、現場で動きづらさがありました。',impression:'判断を待つ時間が長かった'}
  return {tone:'neutral' as const,quote:'必要な判断はもらえました。次は、どこまで自分に任せるかも相談したいです。',impression:'もう少し任せてもらえそう'}
}

function evaluateClient(signals:PerspectiveSignals, seed:number) {
  const meetingProblem=signals.meetingMissed||signals.meeting?.meetingChoice==='欠席'||signals.meetingAttention<65
  if(signals.escalated&&(signals.effective>0||signals.calls>0)) return {tone:'mixed' as const,quote:'途中は回答が見えず不安でしたが、最後は状況を説明してもらえて落ち着きました。',impression:'最後は任せられた'}
  if(meetingProblem) return {tone:'negative' as const,quote:'会議中、こちらの話が十分に届いているか少し不安になる場面がありました。',impression:'説明の行き違いが心配だった'}
  if(signals.fast>0&&(signals.effective>0||signals.careful+signals.calls>0)) return {tone:'positive' as const,quote:pick(['必要なタイミングで回答があり、安心して社内説明を進められました。','状況と次の動きを早めに伝えてもらえたので、任せられると感じました。'],seed),impression:'安心して任せられた'}
  if(signals.unanswered.length) return {tone:'negative' as const,quote:'社内で説明を待っている間、誰が対応しているのか分からず不安でした。',impression:'回答の見通しが持てなかった'}
  return {tone:'neutral' as const,quote:'回答は受け取れました。次回は、確認中であることだけでも早めに分かると助かります。',impression:'必要な対応は得られた'}
}

function evaluateSales(signals:PerspectiveSignals, seed:number) {
  if(signals.meetingMissed&&signals.effective>0) return {tone:'mixed' as const,quote:'チャットでは助けてもらえましたが、相談の場では直接話せず、判断の背景までは共有できませんでした。',impression:'支援はあったが認識差が残った'}
  if(signals.meetingMissed) return {tone:'negative' as const,quote:'相談の場で直接話せず、提案の判断を持たないままお客様対応に入りました。',impression:'相談の見通しが持てなかった'}
  if(signals.fast>0&&signals.effective>0) return {tone:'positive' as const,quote:pick(['提案前に判断をもらえたので、自信を持ってお客様と話せました。','必要な論点をすぐ返してもらえて、案件を前に進められました。'],seed),impression:'相談のタイミングを頼れる'}
  if(signals.meeting?.meetingChoice==='代理を立てる'&&signals.effective>0) return {tone:'positive' as const,quote:'代理の方にも意図が伝わっていて、相談を止めずに進められました。',impression:'任せ方が明確だった'}
  if(signals.escalated&&(signals.effective>0||signals.fast>0)) return {tone:'mixed' as const,quote:'提案直前は焦りましたが、最後に判断をもらえて何とか前へ進められました。',impression:'最後は支えてもらえた'}
  if(signals.unanswered.length) return {tone:'negative' as const,quote:'お客様を待たせている間、どこまで提案してよいか判断できませんでした。',impression:'相談の見通しが持てなかった'}
  return {tone:'neutral' as const,quote:'相談には応じてもらえました。もう少し早い段階で認識を合わせられると助かります。',impression:'必要な協力は得られた'}
}

function evaluateBoss(signals:PerspectiveSignals, context:PerspectiveContext, seed:number) {
  const completed=(signals.taskProgress??0)>=100
  const severeOvertime=context.overtime>=180
  if(completed&&severeOvertime) return {tone:'mixed' as const,quote:`必要な資料は揃いました。ただ、${Math.floor(context.overtime/60)}時間以上の残業で成立している点は気になります。`,impression:'成果は出すが時間設計が心配'}
  if(completed&&signals.effective>0) return {tone:'positive' as const,quote:pick(['依頼した成果が時間内にまとまり、会議で判断を進められました。','論点が整理されていて、次の判断に使える資料になっていました。'],seed),impression:'重要な仕事を任せられた'}
  if(!completed&&signals.careful+signals.calls>0) return {tone:'mixed' as const,quote:'状況の共有は丁寧でしたが、お願いしていた資料が仕上がらなかったのは困りました。',impression:'対話はできるが成果が気になった'}
  if(!completed&&signals.unanswered.length) return {tone:'negative' as const,quote:'依頼した仕事がどこまで進んでいるのか、会議前まで見通しを持てませんでした。',impression:'進捗が見えなかった'}
  if(severeOvertime) return {tone:'negative' as const,quote:'多くを処理していましたが、毎回この働き方では続かないと感じます。',impression:'抱え込みが心配だった'}
  return {tone:'neutral' as const,quote:'一日の優先順位は見えました。依頼した成果との配分は、次回もう少し早く相談したいです。',impression:'判断の意図を確認したい'}
}

function momentFromInteraction(item:CharacterInteraction): PerspectiveMoment {
  const tone:PerspectiveTone=item.effective?'positive':item.action==='ignore'||item.action==='later'?'negative':item.action==='react'?'neutral':'mixed'
  const playerAction=item.reaction?`${item.reaction} リアクション`:item.meetingChoice?item.meetingChoice:item.message?`${actionLabels[item.action]}：「${item.message}」`:actionLabels[item.action]
  const interpretation=item.consequence??(item.effective?'必要な対応が返ってきたと感じた':'次の動きが見えるまで待つことになった')
  return {id:item.id,at:item.at,eventMessage:item.eventMessage,playerAction,interpretation,tone}
}

function buildMoments(signals:PerspectiveSignals): PerspectiveMoment[] {
  const moments=[...signals.direct,...signals.assigned].map(momentFromInteraction)
  if(signals.meetingMissed&&signals.meetingAt!==undefined) moments.push({id:`missed-meeting-${signals.meetingAt}`,at:signals.meetingAt,eventMessage:signals.meetingTitle,playerAction:'参加判断なし',interpretation:'相手には欠席の理由や代替手段が伝わらなかった',tone:'negative'})
  signals.unanswered.forEach(event=>moments.push({id:`unanswered-${event.id}`,at:event.at,eventMessage:event.message,playerAction:'返信・反応なし',interpretation:'相手には事情が見えず、待つか自分で進めるしかなかった',tone:'negative'}))
  return moments.sort((a,b)=>a.at-b.at).filter((moment,index,items)=>index===0||moment.playerAction!==items[index-1].playerAction||moment.tone!==items[index-1].tone).slice(-5)
}

export function generateStakeholderPerspectives(context:PerspectiveContext): StakeholderPerspective[] {
  return definitions
    .filter(definition=>context.events.some(event=>event.sender===definition.characterId)||context.interactions.some(item=>item.characterId===definition.characterId||item.delegateCharacterId===definition.characterId))
    .map((definition,index)=>{
      const signals=collectSignals(definition,context)
      const seed=context.interactions.length*7+signals.relevantEvents.length*3+index
      const evaluation=definition.viewpoint==='member'?evaluateMember(signals,seed):definition.viewpoint==='leader'?evaluateLeader(signals,seed):definition.viewpoint==='client'?evaluateClient(signals,seed):definition.viewpoint==='sales'?evaluateSales(signals,seed):evaluateBoss(signals,context,seed)
      return {characterId:definition.characterId,tone:evaluation.tone,quote:evaluation.quote,impression:evaluation.impression,relationship:relationshipLabels[evaluation.tone],moments:buildMoments(signals)}
    })
    .sort((a,b)=>{
      const aWeight=context.interactions.filter(item=>item.characterId===a.characterId||item.delegateCharacterId===a.characterId).length+context.events.filter(event=>event.sender===a.characterId&&event.importance>=4).length
      const bWeight=context.interactions.filter(item=>item.characterId===b.characterId||item.delegateCharacterId===b.characterId).length+context.events.filter(event=>event.sender===b.characterId&&event.importance>=4).length
      return bWeight-aWeight
    })
    .slice(0,5)
}

export const perspectiveCharacter = (characterId:string) => senders[characterId]
