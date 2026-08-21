export type Category = '顧客' | 'メンバー' | 'リーダー' | '営業' | '上司' | '人事' | '他部署' | 'FYI'
export type Skill = '技術' | '顧客対応' | '育成' | '調整'
export type ActionId = 'react' | 'short' | 'careful' | 'question' | 'later' | 'delegate' | 'call' | 'ignore'

export interface Sender {
  id: string
  name: string
  role: string
  category: Category
  avatar: string
  color: string
}

export interface ScenarioEvent {
  id: string
  threadId: string
  at: number
  sender: string
  message: string
  preview?: string
  importance: number
  urgency: number
  kind: 'noise' | 'simple' | 'decision' | 'sensitive' | 'risk' | 'sales' | 'admin'
  mention?: boolean
  escalationFor?: string
  impact?: Partial<Record<'customer' | 'team' | 'business' | 'energy', number>>
  branchLabel?: string
}

export interface Meeting {
  id: string
  title: string
  start: number
  end: number
  focusNeed: 1 | 2 | 3
  owner: string
  color: string
  optional?: boolean
  extendChance?: boolean
}

export interface WorkTask {
  id: string
  title: string
  required: number
  progress: number
  importance: '最重要' | '重要'
  deadline: string
  color: string
}

export interface Delegate {
  id: string
  name: string
  role: string
  skills: Record<Skill, number>
  load: number
}

export interface DecisionLog {
  at: number
  title: string
  action: string
  outcome: string
  severity: 'good' | 'warn' | 'bad'
  message?: string
}

export interface ConversationMessage {
  id: string
  threadId: string
  senderId: 'player' | string
  timestamp: number
  text?: string
  type: 'reply' | 'question' | 'delegation' | 'follow-up' | 'system'
  relatedEventId: string
  privateLabel?: string
}

export type CharacterInteractionAction = ActionId | 'meeting' | 'meeting-recovery'

export interface CharacterInteraction {
  id: string
  characterId: string
  at: number
  action: CharacterInteractionAction
  eventId?: string
  threadId?: string
  eventAt?: number
  eventMessage?: string
  responseDelay?: number
  message?: string
  reaction?: string
  consequence?: string
  effective?: boolean
  delegateCharacterId?: string
  delegateName?: string
  meetingId?: string
  meetingTitle?: string
  meetingChoice?: string
  duringMeetingId?: string
}

export type PerspectiveTone = 'positive' | 'neutral' | 'negative' | 'mixed'

export interface PerspectiveMoment {
  id: string
  at: number
  eventMessage?: string
  playerAction: string
  interpretation: string
  tone: PerspectiveTone
}

export interface StakeholderPerspective {
  characterId: string
  tone: PerspectiveTone
  quote: string
  impression: string
  relationship: string
  moments: PerspectiveMoment[]
}
