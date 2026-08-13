import type { Delegate, Meeting, ScenarioEvent, Sender, WorkTask } from './types'

export const senders: Record<string, Sender> = {
  sato: { id:'sato', name:'佐藤 美咲', role:'プロジェクトリーダー', category:'リーダー', avatar:'佐', color:'#536e62' },
  tanaka: { id:'tanaka', name:'田中 健', role:'シニアエンジニア', category:'メンバー', avatar:'田', color:'#7c6b55' },
  suzuki: { id:'suzuki', name:'鈴木 葵', role:'若手メンバー', category:'メンバー', avatar:'鈴', color:'#65758b' },
  ito: { id:'ito', name:'伊藤 亮', role:'チームリーダー', category:'リーダー', avatar:'伊', color:'#796b7f' },
  client: { id:'client', name:'山本様', role:'グローブ商事・顧客', category:'顧客', avatar:'山', color:'#4f6d7a' },
  client2: { id:'client2', name:'高橋様', role:'ネクスト社・顧客', category:'顧客', avatar:'高', color:'#5d7080' },
  sales: { id:'sales', name:'中村 拓海', role:'営業', category:'営業', avatar:'中', color:'#7e684d' },
  boss: { id:'boss', name:'小林部長', role:'あなたの上司', category:'上司', avatar:'小', color:'#6e5b5b' },
  hr: { id:'hr', name:'人事チーム', role:'人事・労務', category:'人事', avatar:'人', color:'#6b6b75' },
  qa: { id:'qa', name:'QAチーム', role:'品質管理', category:'他部署', avatar:'Q', color:'#5d7366' },
  general: { id:'general', name:'チーム雑談', role:'general', category:'FYI', avatar:'#', color:'#767676' },
  finance: { id:'finance', name:'経営企画', role:'他部署', category:'他部署', avatar:'経', color:'#63706b' },
}

export const scenarioEvents: ScenarioEvent[] = [
  {id:'e01',threadId:'release',at:5,sender:'sato',message:'おはようございます。今日のリリース、認証まわりで少し気になるログがあります。念のため見てもらえますか？',importance:5,urgency:3,kind:'risk',mention:true,branchLabel:'リリース懸念'},
  {id:'e02',threadId:'fyi-forecast',at:8,sender:'finance',message:'共有です。今月の着地見込みを更新しました。特に返信は不要です。',importance:1,urgency:1,kind:'noise'},
  {id:'e03',threadId:'member-care',at:15,sender:'suzuki',message:'おはようございます。少し相談したいことがあります！ 今日どこかで10分いただけますか？',importance:5,urgency:2,kind:'sensitive',mention:true,branchLabel:'メンバーからの相談'},
  {id:'e04',threadId:'thanks',at:18,sender:'general',message:'昨日のリリースノート、助かりました！ありがとうございます 🙌',importance:1,urgency:1,kind:'noise'},
  {id:'e05',threadId:'client-q',at:25,sender:'client',message:'先週いただいた資料の数値について一点確認したい箇所があります。担当の方に確認いただけますか。',importance:4,urgency:2,kind:'simple',mention:true,branchLabel:'顧客からの確認'},
  {id:'e06',threadId:'attendance',at:33,sender:'hr',message:'本日17時までに勤怠の未承認3件をご確認ください。',importance:2,urgency:2,kind:'admin'},
  {id:'e07',threadId:'sales-deal',at:42,sender:'sales',message:'午後の提案、技術的な実現性について5分だけ相談できますか？先方はかなり前向きです。',importance:4,urgency:3,kind:'sales',mention:true,branchLabel:'大型案件の営業相談'},
  {id:'e08',threadId:'general-lunch',at:49,sender:'general',message:'今日のランチ、カレー組いますか？🍛',importance:1,urgency:1,kind:'noise'},
  {id:'e09',threadId:'release',at:65,sender:'sato',message:'QAでも同じログを確認したそうです。リリース判断、どうしましょう？',importance:5,urgency:4,kind:'risk',mention:true},
  {id:'e10',threadId:'qa-info',at:76,sender:'qa',message:'認証テストで再現率は低いですがタイムアウトが出ています。共有まで。',importance:5,urgency:4,kind:'risk'},
  {id:'e11',threadId:'resolved-chat',at:83,sender:'ito',message:'昨日の問い合わせは佐藤さんと確認して解決済みです。CCのみです。',importance:1,urgency:1,kind:'noise'},
  {id:'e12',threadId:'client-q',at:92,sender:'client',message:'先ほどの件、その後いかがでしょうか。午前中に社内共有したく。',importance:4,urgency:4,kind:'simple',mention:true},
  {id:'e13',threadId:'conflict',at:103,sender:'tanaka',message:'鈴木さんのレビューの出し方について、正直このままだと厳しいです。一度話した方がいいと思います。',importance:4,urgency:2,kind:'sensitive',branchLabel:'メンバー間の衝突'},
  {id:'e14',threadId:'boss-deck',at:117,sender:'boss',message:'今日の部長会で使いたい。今期の課題を3枚にまとめて16時までにもらえる？',importance:4,urgency:4,kind:'decision',mention:true,branchLabel:'上司から突然の資料依頼'},
  {id:'e15',threadId:'fyi-webinar',at:126,sender:'general',message:'来週の社内勉強会のURLです。興味ある方どうぞ。',importance:1,urgency:1,kind:'noise'},
  {id:'e16',threadId:'member-care',at:139,sender:'suzuki',message:'会議続きですよね。急ぎではないので大丈夫です。',importance:5,urgency:2,kind:'sensitive'},
  {id:'e17',threadId:'client2',at:151,sender:'client2',message:'次回定例の日程、木曜午後で問題ありません。ご調整ありがとうございます。',importance:1,urgency:1,kind:'noise'},
  {id:'e18',threadId:'sales-deal',at:162,sender:'sales',message:'提案まであと40分です。セキュリティ要件の回答だけ判断いただけると助かります。',importance:4,urgency:5,kind:'sales',mention:true},
  {id:'e19',threadId:'release',at:176,sender:'qa',message:'先ほどの懸念、負荷を上げると再現しました。切り戻し可否を決めたいです。',importance:5,urgency:5,kind:'risk',mention:true},
  {id:'e20',threadId:'survey',at:188,sender:'hr',message:'エンゲージメントサーベイの回答期限は金曜です。全員への周知をお願いします。',importance:2,urgency:1,kind:'admin'},
  {id:'e21',threadId:'conflict',at:202,sender:'suzuki',message:'レビューで言われたことは理解しています。私の進め方が悪かったので大丈夫です。',importance:4,urgency:2,kind:'sensitive'},
  {id:'e22',threadId:'fyi-release',at:215,sender:'general',message:'デザインシステム v2.4 が公開されました。共有です。',importance:1,urgency:1,kind:'noise'},
  {id:'e23',threadId:'budget',at:227,sender:'finance',message:'来期予算の一次案を置きました。コメントは明日までで構いません。',importance:2,urgency:1,kind:'simple'},
  {id:'e24',threadId:'client-q',at:239,sender:'client',message:'社内説明が止まっています。どなたから回答をいただけるのかだけでも教えてください。',importance:5,urgency:5,kind:'risk',mention:true},
  {id:'e25',threadId:'absence',at:251,sender:'ito',message:'田中さん、午後から体調が悪そうです。明日の作業分担を見直した方がよさそうです。',importance:3,urgency:2,kind:'sensitive'},
  {id:'e26',threadId:'sales-other',at:263,sender:'sales',message:'小規模案件の見積レビュー、今日中にお願いできますか？急ぎに見えますが提出は明後日です。',importance:2,urgency:1,kind:'sales'},
  {id:'e27',threadId:'member-care',at:276,sender:'suzuki',message:'さっきの相談の件、もう大丈夫です。お時間取らせてすみません。',importance:5,urgency:3,kind:'sensitive'},
  {id:'e28',threadId:'paperwork',at:289,sender:'hr',message:'評価コメントの記入形式が一部変わりました。添付のテンプレートをご利用ください。',importance:3,urgency:2,kind:'admin'},
  {id:'e29',threadId:'release',at:302,sender:'sato',message:'認証エラーが本番で増えています。顧客影響が出始めました。至急、障害対応に切り替えたいです。',importance:5,urgency:5,kind:'risk',mention:true},
  {id:'e30',threadId:'general-snack',at:311,sender:'general',message:'出張のお土産を休憩スペースに置きました！',importance:1,urgency:1,kind:'noise'},
  {id:'e31',threadId:'boss-deck',at:324,sender:'boss',message:'資料、今どのくらい？ 16時の会議で冒頭に使います。',importance:4,urgency:5,kind:'decision',mention:true},
  {id:'e32',threadId:'client-call',at:337,sender:'client',message:'システムに入れないという連絡が複数来ています。今すぐ状況を説明いただけますか。',importance:5,urgency:5,kind:'risk',mention:true},
  {id:'e33',threadId:'candidate',at:348,sender:'hr',message:'面接候補者の所感入力、本日中です。5分程度で完了します。',importance:2,urgency:3,kind:'admin'},
  {id:'e34',threadId:'sales-deal',at:361,sender:'sales',message:'先ほどの提案、先方から追加質問です。今日17時までの回答で受注確度が上がりそうです。',importance:4,urgency:4,kind:'sales'},
  {id:'e35',threadId:'conflict',at:374,sender:'ito',message:'田中さんと鈴木さん、会話がほとんどなくなっています。タスクの受け渡しにも影響が出ています。',importance:4,urgency:4,kind:'sensitive',mention:true},
  {id:'e36',threadId:'fyi-policy',at:386,sender:'finance',message:'来月から経費精算の締日が変わります。FYIです。',importance:1,urgency:1,kind:'noise'},
  {id:'e37',threadId:'member-care',at:399,sender:'tanaka',message:'鈴木さん、最近かなり元気がないです。何か抱えているように見えます。',importance:5,urgency:4,kind:'sensitive',mention:true},
  {id:'e38',threadId:'release',at:411,sender:'qa',message:'暫定対応でエラー率は下がりました。恒久対応の責任者を決めたいです。',importance:4,urgency:3,kind:'risk'},
  {id:'e39',threadId:'boss-note',at:424,sender:'boss',message:'部長会、論点が整理されていて助かった。明日、数字の裏付けを追加しよう。',importance:2,urgency:1,kind:'simple'},
  {id:'e40',threadId:'client-q',at:437,sender:'client',message:'ご回答ありがとうございます。社内でも説明できました。',importance:1,urgency:1,kind:'noise'},
  {id:'e41',threadId:'member-care',at:451,sender:'suzuki',message:'今後の働き方について、改めてご相談したいです。できれば今日少しだけ。',importance:5,urgency:4,kind:'sensitive',mention:true},
  {id:'e42',threadId:'cleanup',at:466,sender:'general',message:'会議室Bに傘の忘れ物があります。',importance:1,urgency:1,kind:'noise'},
  {id:'e43',threadId:'client-report',at:481,sender:'client2',message:'月次レポート受領しました。ありがとうございました。',importance:1,urgency:1,kind:'noise'},
  {id:'e44',threadId:'sales-deal',at:497,sender:'sales',message:'案件の件、先方から前向きな返事が来ました。サポートありがとうございました！',importance:2,urgency:1,kind:'noise'},
  {id:'e45',threadId:'last-admin',at:515,sender:'hr',message:'勤怠承認が残り1件です。本日中にお願いします。',importance:2,urgency:4,kind:'admin',mention:true},
  {id:'e46',threadId:'release-night',at:565,sender:'sato',message:'日中の認証障害の恒久対応案をまとめました。明朝の判断で問題ありませんが、念のため共有です。',importance:3,urgency:1,kind:'simple'},
  {id:'e47',threadId:'client-call',at:618,sender:'client',message:'夜分に失礼します。今日の障害について、明日の業務開始前に説明の場をお願いできますか。',importance:5,urgency:4,kind:'risk',mention:true,branchLabel:'夜間の顧客フォロー'},
  {id:'e48',threadId:'general-night',at:688,sender:'general',message:'明日の朝会資料、更新済みです。確認は明日で大丈夫です。',importance:1,urgency:1,kind:'noise'},
  {id:'e49',threadId:'release-night',at:793,sender:'qa',message:'夜間監視は安定しています。恒久対応のレビューだけ、明朝お願いできますか。',importance:3,urgency:1,kind:'simple'},
  {id:'e50',threadId:'client-call',at:842,sender:'client',message:'@manager 本日のご対応ありがとうございました。明朝の説明について、よろしくお願いします。',importance:2,urgency:1,kind:'simple',mention:true},
]

export const meetings: Meeting[] = [
  {id:'m1',title:'チーム朝会',start:30,end:60,focusNeed:1,owner:'あなた',color:'#6d8277'},
  {id:'m2',title:'グローブ商事 定例',start:60,end:120,focusNeed:3,owner:'顧客',color:'#866456',extendChance:true},
  {id:'m3',title:'社内進捗共有',start:120,end:150,focusNeed:1,owner:'PMO',color:'#6b7480',optional:true},
  {id:'m4',title:'鈴木さん 1on1',start:240,end:270,focusNeed:3,owner:'あなた',color:'#72627d'},
  {id:'m5',title:'大型案件 営業相談',start:300,end:360,focusNeed:2,owner:'営業',color:'#7e704f',optional:true},
  {id:'m6',title:'部長会',start:420,end:480,focusNeed:2,owner:'小林部長',color:'#665b5b'},
]

export const initialTasks: WorkTask[] = [
  {id:'t1',title:'来期方針を考える',required:90,progress:0,importance:'最重要',deadline:'明日 10:00',color:'#45695a'},
  {id:'t2',title:'評価コメントを書く',required:60,progress:0,importance:'重要',deadline:'本日中',color:'#71644d'},
  {id:'t3',title:'顧客提案資料',required:120,progress:0,importance:'最重要',deadline:'明日 12:00',color:'#4d6474'},
  {id:'t4',title:'組織課題を整理する',required:60,progress:0,importance:'重要',deadline:'16:00 部長会',color:'#695a72'},
]

export type GameModeId = 'quick' | 'standard' | 'fullday'

export interface GameModeConfig {
  id: GameModeId
  label: string
  shortLabel: string
  estimatedPlayTime: string
  description: string
  summary: string
  tickMs: number
  eventIds: string[]
  meetingIds: string[]
  taskCount: number
  taskEffort: number
  escalationTempo: 'fast' | 'standard' | 'deep'
  evaluationTone: string
}

export const modeSettings: Record<GameModeId, GameModeConfig> = {
  quick: {
    id:'quick', label:'クイック', shortLabel:'QUICK', estimatedPlayTime:'約5分', description:'短時間で忙しさを体験', summary:'短時間で判断の難しさを体験しました。', tickMs:850,
    eventIds:['e01','e03','e04','e05','e07','e09','e10','e12','e13','e16','e18','e19','e21','e24','e29','e32'], meetingIds:['m1','m2'], taskCount:2, taskEffort:.52, escalationTempo:'fast', evaluationTone:'短時間でも、すべてを救えない優先順位の難しさが残るモードです。',
  },
  standard: {
    id:'standard', label:'スタンダード', shortLabel:'STANDARD', estimatedPlayTime:'約10〜15分', description:'おすすめの基本モード', summary:'1日の優先順位管理をバランスよく体験しました。', tickMs:1150,
    eventIds:['e01','e02','e03','e04','e05','e06','e07','e08','e09','e10','e12','e13','e14','e16','e18','e19','e21','e23','e24','e25','e27','e29','e31','e32','e34','e35','e37','e38','e40','e41','e44','e45'], meetingIds:['m1','m2','m4','m5'], taskCount:3, taskEffort:.78, escalationTempo:'standard', evaluationTone:'判断とその後の影響を、最もバランスよく味わえる基本モードです。',
  },
  fullday: {
    id:'fullday', label:'フルデイ', shortLabel:'FULL DAY', estimatedPlayTime:'約20〜25分', description:'じっくり1日を体験', summary:'複雑な割り込みと残業判断まで含めて体験しました。', tickMs:1800,
    eventIds:scenarioEvents.map(event=>event.id), meetingIds:['m1','m2','m3','m4','m5','m6'], taskCount:4, taskEffort:1, escalationTempo:'deep', evaluationTone:'会議ラッシュ、深いイベント連鎖、残業判断まで含む最も濃いモードです。',
  },
}

const quickTimeline = [5,12,18,24,32,42,50,61,72,86,98,110,125,140,158,176]

export const getModeData = (mode:GameModeId) => {
  const config=modeSettings[mode]
  const byId=new Map(scenarioEvents.map(event=>[event.id,event]))
  const events=config.eventIds.map((id,index)=>{
    const event=byId.get(id)!
    return mode==='quick' ? {...event,at:quickTimeline[index] ?? event.at} : {...event}
  })
  const selectedMeetings=meetings.filter(meeting=>config.meetingIds.includes(meeting.id)).map((meeting,index)=> mode==='quick' ? {...meeting,start:[28,70][index] ?? meeting.start,end:[55,125][index] ?? meeting.end} : {...meeting})
  const tasks=initialTasks.slice(0,config.taskCount).map(task=>({...task,required:Math.round(task.required*config.taskEffort),progress:0}))
  return {config,events,meetings:selectedMeetings,tasks}
}

export const delegates: Delegate[] = [
  {id:'d1',name:'佐藤 美咲',role:'プロジェクトリーダー',skills:{技術:5,顧客対応:3,育成:2,調整:4},load:48},
  {id:'d2',name:'伊藤 亮',role:'チームリーダー',skills:{技術:3,顧客対応:5,育成:5,調整:4},load:42},
  {id:'d3',name:'田中 健',role:'シニアエンジニア',skills:{技術:5,顧客対応:2,育成:3,調整:2},load:68},
]

export const actionConfig = {
  react:{label:'リアクション',icon:'👍',minutes:1,description:'見たことだけを伝える'},
  short:{label:'短く返信',icon:'↩',minutes:4,description:'要点だけを返す'},
  careful:{label:'丁寧に返信',icon:'✎',minutes:9,description:'背景も含めて対応する'},
  question:{label:'質問を返す',icon:'?',minutes:3,description:'情報を増やす（返信も増える）'},
  later:{label:'あとで対応',icon:'◷',minutes:1,description:'自分用に留める'},
  delegate:{label:'委任する',icon:'⇢',minutes:3,description:'適任者に任せる'},
  call:{label:'通話を設定',icon:'☎',minutes:20,description:'会話で一気に解決する'},
  ignore:{label:'対応しない',icon:'—',minutes:0,description:'重要でなければ正解'},
} as const

export const formatTime = (minutes:number) => {
  const total = 9 * 60 + minutes
  return `${String(Math.floor(total / 60)).padStart(2,'0')}:${String(total % 60).padStart(2,'0')}`
}
