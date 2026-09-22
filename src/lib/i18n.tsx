import { Languages } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type AppLocale = "en" | "zh-CN";

const STORAGE_KEY = "commonroute.locale";

const ZH: Record<string, string> = {
  "Map & nearby groups": "地图与邻近分组",
  "Map & group nearby": "地图与邻近分组",
  "Group nearby": "按邻近分组",
  "Clear groups": "清除分组",
  "On the map": "地图上",
  Everything: "全部",
  Attractions: "景点",
  "Places to eat": "用餐地点",
  Ungrouped: "未分组",
  "Set its location": "设置位置",
  "Driving times between these": "这些地点之间的驾车时间",
  "Driving route unavailable": "无法取得驾车路线",
  "Where it is": "位置",
  Latitude: "纬度",
  Longitude: "经度",
  "Time zone (IANA)": "时区（IANA）",
  "Save location": "保存位置",
  "Opening hours": "营业时间",
  "Open for your visit": "你到访时开放",
  "Closed on this date": "当天休息",
  "Visit runs past closing": "游览时间超过闭馆时间",
  "Last admission missed": "已过最后入场时间",
  "Hours need checking": "营业时间需要确认",
  "Hours unknown": "营业时间不明",
  "Closures and special dates": "休息日与特殊日期",
  "Mark closed": "标记为休息",
  "Getting there and back": "往返交通",
  "Getting there": "前往",
  "Getting back": "返回",
  "Add a leg": "添加一段行程",
  "Day check": "当日检查",
  Checked: "已检查",
  "Open questions": "仍有待确认",
  "Something cannot work as planned": "有安排无法成立",
  "Blocks the day": "阻碍当天安排",
  "Needs checking": "需要确认",
  "You can drive to this place": "可以开车抵达",
  "Park, then take onward transport": "停车后换乘",
  "Cars restricted — conditions apply": "车辆受限——有条件限制",
  "Private cars are not allowed": "禁止私家车进入",
  "Car access unknown": "车辆通行情况不明",

  "Every update to the plan your group has already seen": "小组已看过的行程的所有更新",
  "Got it": "知道了",
  "See every change →": "查看全部变动 →",
  "The plan changed since you last looked.": "自你上次查看后，行程有变动。",
  "I've seen this": "我已看过",
  "Not seen yet": "尚未查看",
  Seen: "已查看",
  Coming: "参加",
  "Sitting this one out": "这次不参加",
  "Comfort, meals and travel time": "舒适度、用餐与路上时间",
  "Open the plan →": "打开行程 →",
  "Sign in": "登录",
  "Your account": "你的账户",
  "My trips": "我的旅行",
  "Group updates": "群组动态",
  Trip: "旅行",
  Discover: "探索",
  Itinerary: "行程",
  Group: "群组",
  "Back to start": "返回首页",
  "Plan together. Find your common route.": "一起规划，找到大家共同的路线。",
  "Plan a trip that works for everyone.": "规划一趟适合每个人的旅行。",
  "Bring every idea and practical need into one shared plan.":
    "把每个人的想法和实际需求汇集成一份共享计划。",
  Destination: "目的地",
  Dates: "日期",
  START: "开始",
  END: "结束",
  "Group size": "同行人数",
  person: "人",
  people: "人",
  "Start a trip": "创建旅行",
  "Have an invite?": "收到邀请？",
  "Join a trip": "加入旅行",
  "About CommonRoute": "关于 CommonRoute",
  "Explore Japan in Demo mode": "体验日本演示之旅",
  "Demo trip — sample group and sample places": "演示旅行 — 示例群组和地点",
  "Demo journey": "演示旅程",
  "Next step": "下一步",
  "Turn everyone’s choices into one plan": "把每个人的选择变成一份计划",
  "Everyone has shared their preferences and votes. See the group picture before building the itinerary.":
    "大家都已分享偏好并完成投票。生成行程前，先查看群组的整体选择。",
  "Review group choices": "查看群组选择",
  "Planning progress": "规划进度",
  "One quick review, then your group itinerary is ready.": "快速确认一次，群组行程就准备好了。",
  Done: "完成",
  "Plan another trip": "规划另一趟旅行",
  "Invite your group": "邀请同行者",
  "Collect preferences": "收集偏好",
  "Vote on places": "为地点投票",
  "Review together": "一起确认",
  "Consensus & considerations": "共识与注意事项",
  "Next activity": "下一个活动",
  "Happening now": "正在进行",
  Navigate: "导航",
  Skip: "跳过",
  "Re-plan": "重新规划",
  "Today's timeline": "今天的时间表",
  "Full itinerary": "完整行程",
  "Re-plan my day": "重新规划今天",
  "Shared notes": "共享备注",
  "Add a note for everyone": "添加给大家的备注",
  Add: "添加",
  "Page not found": "找不到页面",
  "The page you're looking for doesn't exist or has been moved.": "你要找的页面不存在或已被移动。",
  "Go home": "返回首页",
  "This page didn't load": "页面未能加载",
  "Something went wrong on our end. You can try refreshing or head back home.":
    "页面出现问题。请重试或返回首页。",
  "Try again": "重试",
  "Offline — showing your latest saved itinerary.": "离线状态 — 正在显示最近保存的行程。",
  "Connect to the internet to refresh live information.": "连接网络后即可刷新最新信息。",
  "Saving for your group…": "正在为群组保存…",
  "Shared with your group": "已与群组共享",
  "Offline — changes save when you reconnect": "离线状态 — 重新连接后会保存更改",
  "Couldn't reach your group's trip — retrying": "暂时无法连接群组旅行 — 正在重试",
  "About CommonRoute — Collaborative trip planning for everyone":
    "关于 CommonRoute — 适合每个人的协作旅行规划",
  "For families and friends": "适合家人和朋友",
  "CommonRoute brings everyone's ideas, preferences and practical needs into one shared plan that the whole group can enjoy.":
    "CommonRoute 把每个人的想法、偏好和实际需求汇集到一份大家都能享受的共享计划中。",
  "Start planning — it's free": "免费开始规划",
  "See how it works": "了解使用方式",
  "Different ages, different needs, one trip": "不同年龄，不同需求，同一趟旅行",
  "Grandpa can walk, but not for hours without a rest.": "长辈可以步行，但不能连续几小时不休息。",
  "The 12-year-old fades by mid-afternoon.": "孩子到了下午容易疲惫。",
  "Everyone has a place they'd hate to miss.": "每个人都有一个不想错过的地方。",
  "Group chats, spreadsheets and screenshots don't solve that. CommonRoute does — clearly, and without anyone feeling like the difficult one.":
    "群聊、表格和截图无法解决这些问题。CommonRoute 能清楚地兼顾大家，而不会让任何人觉得自己在添麻烦。",
  "From scattered wishes to one workable plan": "把零散愿望变成一份可行计划",
  "Start the trip": "创建旅行",
  "Destination, dates, group size. That's it — no account, no setup call.":
    "填写目的地、日期和人数即可，无需账户或筹备会议。",
  "Invite and gather": "邀请并收集需求",
  "One link. Everyone answers five short questions about pace, walking and rest.":
    "分享一个链接，每个人回答五个关于节奏、步行和休息的简短问题。",
  "Get one clear plan": "获得一份清晰计划",
  "Places grouped by area, meals and rests built in, and a plain-language reason for every choice.":
    "地点按区域编排，并安排用餐和休息；每个选择都有清楚说明。",
  "Re-plan on the day": "当天灵活重排",
  "Rain, tiredness, running late — say what changed and get one revised plan in seconds.":
    "下雨、疲累或迟到时，只需说明变化，几秒内即可获得调整后的计划。",
  "Why families stick with it": "大家为什么持续使用",
  "Care comes before votes": "实际需求优先于票数",
  "Walking limits, rest needs and opening hours outrank a popular vote — so nobody is quietly left behind.":
    "步行限制、休息需求和开放时间比热门投票更重要，因此不会有人被忽略。",
  "One plan, not ten options": "一份计划，而不是十个选项",
  "CommonRoute recommends a single realistic itinerary first, then lets you move, replace or remove anything.":
    "CommonRoute 会先推荐一份现实可行的行程，你可以再移动、替换或删除内容。",
  "Share one living link": "共享一个实时更新的链接",
  "The plan everyone opens is always the current one. No screenshots, no version confusion.":
    "大家打开的始终是最新计划，不必发送截图，也不会混淆版本。",
  "Works without signal": "没有网络也能使用",
  "Today's stops, times, addresses and notes stay readable offline while you're out.":
    "旅途中即使离线，也能查看今天的地点、时间、地址和备注。",
  "Questions families ask": "常见问题",
  "Does everyone need an account?": "每个人都需要账户吗？",
  "No. Family members open your invite link, add their name and preferences, and start voting.":
    "不需要。同行者打开邀请链接，填写姓名和偏好后即可开始投票。",
  "Can grandparents use it?": "长辈也能使用吗？",
  "Yes — large buttons, plain wording, and only five short questions to answer.":
    "可以。按钮清晰、文字简单，而且只需回答五个简短问题。",
  "What if plans change mid-trip?": "旅途中计划有变怎么办？",
  "Tell CommonRoute what changed and it rebuilds the rest of the day while keeping what still works.":
    "告诉 CommonRoute 发生了什么变化，它会保留仍然适用的安排并重排当天剩余行程。",
  "Can I plan more than one trip?": "可以规划多趟旅行吗？",
  "Yes. Every trip lives in My trips, and you can switch between them anytime.":
    "可以。所有旅行都保存在“我的旅行”中，你可以随时切换。",
  "Your next family trip starts with one destination": "下一趟群组旅行，从一个目的地开始",
  "Add where you're going and the dates. CommonRoute takes it from there.":
    "填写目的地和日期，接下来交给 CommonRoute。",
  "Last updated: 20 September 2026.": "最后更新：2026年9月20日。",
  "Sign in to CommonRoute": "登录 CommonRoute",
  "We'll email you a link that signs you straight in. No password, no code to type.":
    "我们会通过邮件发送一键登录链接，无需密码，也无需输入验证码。",
  "Check your email": "请查看邮件",
  "Use a different email": "使用其他邮箱",
  "Your email": "你的邮箱",
  "Email me a sign-in link": "发送登录链接",
  "Sending…": "正在发送…",
  "Signing in keeps your trips on your account, so they're there on your phone and your laptop. You can still join a trip with an invite code without signing in.":
    "登录后，旅行会保存到你的账户，并可在手机和电脑上查看。无需登录也能通过邀请码加入旅行。",
  "← Back to CommonRoute": "← 返回 CommonRoute",
  "Loading…": "正在加载…",
  "Sign in with an email link to keep your trips on every device.":
    "使用邮件链接登录，即可在所有设备上查看旅行。",
  "You're not signed in. Trips you create stay on this device until you sign in.":
    "你尚未登录。登录前，创建的旅行只会保存在此设备上。",
  "Sign in with an email link": "使用邮件链接登录",
  "The name your group sees": "群组看到的姓名",
  "Trips on your account": "账户中的旅行",
  "No shared trips yet. Create one or join with an invite code and it will be saved here.":
    "还没有共享旅行。创建旅行或用邀请码加入后，它会保存在这里。",
  "Refresh from my account": "从账户刷新",
  "Demo mode stays on this device only and is never saved to your account.":
    "演示模式只保存在此设备上，不会存入账户。",
  "Sign-in email": "登录邮箱",
  "New email address": "新邮箱地址",
  "Send confirmation link": "发送确认链接",
  "Sign out": "退出登录",
  "Sign out on all my devices": "在所有设备上退出",
  "Close your account": "关闭账户",
  "Yes, close my account": "是，关闭我的账户",
  "Keep my account": "保留我的账户",
  "Close my account": "关闭我的账户",
  "Travel is better together": "一起旅行更精彩",
  "Share via WhatsApp": "通过 WhatsApp 分享",
  "Email invite": "邮件邀请",
  "Who's on board": "已有谁加入",
  "Share my preferences": "填写我的偏好",
  "Join a group trip": "加入群组旅行",
  "Your organiser’s invite link connects you to the right trip.":
    "组织者的邀请链接会带你加入正确的旅行。",
  "Open your CommonRoute invite": "打开 CommonRoute 邀请",
  "Create your own trip instead": "改为创建自己的旅行",
  "Your name": "你的姓名",
  "Relationship to the organiser": "与组织者的关系",
  "Age group": "年龄段",
  Child: "儿童",
  Teen: "青少年",
  Adult: "成人",
  Senior: "长者",
  "Join trip": "加入旅行",
  "Skip preferences for now": "暂时跳过偏好",
  "Help us plan for your group": "帮助我们为群组规划",
  "What interests you?": "你对什么感兴趣？",
  "What's your preferred pace?": "你喜欢怎样的旅行节奏？",
  "How much walking feels comfortable?": "你能舒适地步行多久？",
  "Must-dos and things to avoid": "必做项目与希望避开的事项",
  "Must-dos (optional)": "必做项目（可选）",
  "Prefer to avoid (optional)": "希望避开（可选）",
  "Anything important we should plan around?": "还有哪些重要需求需要纳入规划？",
  "For example accessibility, dietary needs, rest needs or fixed timings.":
    "例如无障碍、饮食、休息需求或固定时间。",
  Back: "返回",
  Next: "下一步",
  "Skip optional questions": "跳过可选问题",
  "Save my preferences": "保存我的偏好",
  "Discover & vote": "探索与投票",
  "Search places": "搜索地点",
  "Place search source": "地点搜索来源",
  "Free map search": "免费地图搜索",
  "Google Maps": "Google 地图",
  View: "查看",
  Added: "已添加",
  "Add to shortlist": "加入候选清单",
  "View on Google Maps": "在 Google 地图中查看",
  "Show more places": "显示更多地点",
  "See group summary": "查看群组汇总",
  "Finish voting": "完成投票",
  "Review suggestions": "审核建议",
  "Must go": "一定要去",
  "Would like": "想去",
  "Don't mind": "都可以",
  "Where the group stands": "群组意见汇总",
  "Strong favourites": "共同喜爱",
  "Mixed preferences": "偏好不一",
  "Thoughtful planning": "周全规划",
  "Strong group favourites": "群组共同喜爱",
  "Build our itinerary": "生成我们的行程",
  "Suggested: keep": "建议：保留",
  "Shorten the route": "缩短路线",
  "Replace with a gentler option": "换成更轻松的选择",
  "Your itinerary": "你的行程",
  "Nothing generated yet": "尚未生成行程",
  "Review and build our itinerary": "确认并生成行程",
  "Here's the plan we recommend": "这是我们推荐的计划",
  "Strong group fit": "非常适合群组",
  "Final / ready": "最终版 / 已就绪",
  "Move to next day": "移至下一天",
  Remove: "删除",
  "Share this plan with the group": "与群组共享此计划",
  "We've sorted this": "已处理此项",
  "Everything checks out — this plan is ready to publish.": "所有检查均已通过，可以发布此计划。",
  "Move back to draft": "退回草稿",
  "Publish to the group": "发布给群组",
  "An organiser will publish the plan once it is ready.": "计划准备好后将由组织者发布。",
  "Use this itinerary": "使用此行程",
  "Try another plan": "尝试其他计划",
  "Print or save as PDF": "打印或保存为 PDF",
  "Everyone gets a win": "每个人都有期待",
  "Save for offline": "保存供离线使用",
  "Two groups on this day": "当天分成两组",
  "Keep everyone together instead": "改为大家一起行动",
  "Split this day into two groups": "当天分成两个小组",
  "Who goes somewhere else?": "哪些人去另一个地方？",
  "Group name": "小组名称",
  "What they'll do": "他们的活动",
  "Where you meet again": "重新集合地点",
  "Meeting time": "集合时间",
  "Save this split": "保存分组",
  Cancel: "取消",
  "Life happens. Let's re-plan.": "计划有变，重新安排吧。",
  "Which day are we adjusting?": "要调整哪一天？",
  "What changed?": "发生了什么变化？",
  "Or tell us what you need": "或告诉我们你的需求",
  "Keeps hard constraints": "保留硬性限制",
  "Protects must-dos": "保留必做项目",
  "Fewer movements": "减少移动",
  "Use revised plan": "使用调整后的计划",
  "Try another option": "尝试其他方案",
  "Start over": "重新开始",
  "Organisers only": "仅限组织者",
  "Back to suggesting places": "返回地点建议",
  "How this works": "运作方式",
  "Approve all": "全部批准",
  "Keep as backups": "全部保留为备选",
  Clear: "清除",
  "Nothing is waiting for a decision right now.": "目前没有待决定的建议。",
  "Keep as backup": "保留为备选",
  Hold: "暂缓",
  Approve: "批准",
  Decline: "不采纳",
  "Roles and decisions": "角色与决策",
  "How this group decides": "群组如何做决定",
  "Decision style": "决策方式",
  "Currency for costs": "费用币种",
  Owner: "所有者",
  Organiser: "组织者",
  "Budget sponsor": "费用赞助者",
  Contributor: "参与者",
  Viewer: "查看者",
  Preference: "偏好",
  "Comfort need": "舒适需求",
  "Hard limit": "硬性限制",
  "Your travel group": "你的旅行群组",
  "What the plan respects": "计划照顾到的需求",
  "Update preferences": "更新偏好",
  "Invite more people": "邀请更多人",
  "Money decisions": "费用决策",
  "What's changed": "最新变化",
  Complete: "已完成",
  "Preferences complete": "偏好已完成",
  "Preferences not started": "尚未填写偏好",
  "Create a new trip": "创建新旅行",
  "Why this matters": "为什么这很重要",
  "How to fix this": "如何调整",
  "Adjust the plan": "调整计划",
  "Place not found": "找不到地点",
  "This place is no longer on the shortlist.": "此地点已不在候选清单中。",
  "What works": "适合之处",
  "What to watch": "注意事项",
  "How the group voted": "群组投票结果",
  "← Back to the plan": "← 返回行程",
  "There is no plan to print yet.": "目前没有可打印的计划。",
  "Who's travelling": "同行人员",
  "What’s changed": "最新变化",
  Updates: "动态",
  "Mark all as read": "全部标为已读",
  "No new updates": "暂无新动态",
  "Where would you like to go?": "你想去哪里？",
  "Start date": "开始日期",
  "End date": "结束日期",
  "CommonRoute — Plan together. Find your common route.":
    "CommonRoute — 一起规划，找到大家共同的路线。",
  "Whitewashed Santorini overlooking the Aegean Sea": "俯瞰爱琴海的圣托里尼白色小镇",
  "Tokyo skyline at dusk": "黄昏时的东京天际线",
  "Back to group": "返回群组",
  Food: "美食",
  Culture: "文化",
  Shopping: "购物",
  Nature: "自然",
  "Theme parks": "主题乐园",
  Museums: "博物馆",
  Relaxing: "休闲",
  Technology: "科技",
  Photography: "摄影",
  Temples: "寺庙",
  Animals: "动物",
  Sightseeing: "观光",
  Anime: "动漫",
  relaxed: "轻松",
  balanced: "均衡",
  packed: "充实",
  low: "少量",
  moderate: "适中",
  high: "较多",
  "Search is unavailable right now. Try the other map source.":
    "目前无法搜索，请尝试另一个地图来源。",
  "From Google Maps": "来自 Google 地图",
  "From map search": "来自地图搜索",
  Suggested: "已建议",
  "On hold": "暂缓",
  "Provisionally approved": "暂定批准",
  "Waiting on sponsor": "等待赞助者确认",
  Approved: "已批准",
  Backup: "备选",
  "Not included": "未采纳",
  Booked: "已预订",
  Cancelled: "已取消",
  Free: "免费",
  "Paid by each person": "个人支付",
  "Shared expense": "共同费用",
  "Major commitment": "重大支出",
  "Already booked": "已预订",
  "Organiser decides": "组织者决定",
  "Group majority": "多数决定",
  "Sponsor approval": "赞助者批准",
  "Full agreement": "全员同意",
  Strong: "很适合",
  Workable: "可行",
  Difficult: "较困难",
  Comfortable: "轻松",
  Moderate: "适中",
  Demanding: "较累",
  Hide: "收起",
  Unlock: "解锁",
  "Lock in": "锁定",
  Published: "已发布",
  "Nothing stands out yet — the group hasn't voted much.": "目前还没有明显优势 — 群组投票还不多。",
  "No concerns recorded for this place.": "此地点暂无注意事项。",
  "Opening your group's trip…": "正在打开群组旅行…",
  "One moment while we load the latest plan.": "请稍候，正在加载最新计划。",
  "We couldn't find that trip": "找不到该旅行",
  "Loading your details…": "正在加载你的资料…",
  "Loading your trip…": "正在加载旅行…",
  Save: "保存",
  "Saving…": "正在保存…",
  Saved: "已保存",
  CommonRoute: "CommonRoute",
  "404": "404",

  /* v2.2 — Today, bookings, getting ready, helped travellers */
  Today: "今天",
  "The day at a glance": "今天的安排一览",
  "Later today": "今天稍后",
  "Open the map": "打开地图",
  "Show on the map": "在地图上查看",
  "Copy the address": "复制地址",
  "Address copied": "地址已复制",
  "Call the stay": "致电住宿",
  "Find our stay": "找到我们的住宿",
  "Larger, simpler view": "大字简洁模式",
  "Standard view": "标准模式",
  "Previous day": "前一天",
  "Next day": "后一天",
  "Nothing is planned for this day. It is a free day — enjoy it.":
    "这一天没有安排，是自由活动日，好好享受。",
  "That is everything for today. Rest well.": "今天的安排到此结束，好好休息。",
  "Today appears once your group's plan has been shared with everyone. Until then, the plan can still change.":
    "计划正式分享给全体成员后，这里才会显示“今天”。在此之前计划仍可能调整。",
  "Calling opens your phone's dialler. This is not a monitored help line.":
    "拨号会打开手机的电话应用，这不是有人值守的求助热线。",

  "Bookings and stay": "预订与住宿",
  "What is already arranged for your group": "群组已经安排好的事项",
  "Add a booking": "添加预订",
  "New booking": "新的预订",
  "Save booking": "保存预订",
  "Booked and confirmed": "已预订并确认",
  "Planned, not booked yet": "已计划，尚未预订",
  "Not booked yet": "尚未预订",
  "Mark as cancelled": "标记为已取消",
  "Share the reference": "分享预订编号",
  "Stop sharing the reference": "停止分享预订编号",
  "Reference kept with whoever booked it": "预订编号仅预订人可见",
  'No bookings yet. Add your stay first — it powers the "Find our stay" card on Today.':
    "还没有预订。先添加住宿，“找到我们的住宿”卡片就会出现在“今天”页面。",

  "Getting ready": "出发准备",
  "Jobs to share out and things to bring": "需要分工的事项与要带的东西",
  Jobs: "分工事项",
  Packing: "行李清单",
  "Shared things": "共用物品",
  "Personal things": "个人物品",
  "I'll bring one": "我来带一个",
  "Mark as packed": "标记为已收好",
  Packed: "已收好",
  "Mark as done": "标记为完成",
  "Not done after all": "重新标为未完成",
  "I'll do it": "我来做",
  "I can't": "我做不了",
  "Not needed": "不需要了",
  "Nobody yet": "还没有人",
  "Waiting to be accepted": "等待接受",
  Accepted: "已接受",
  "Past its date": "已过期",
  "No jobs yet.": "还没有分工事项。",
  "Taking on a job never gives anyone the power to approve spending.":
    "承担分工事项不会因此获得批准支出的权力。",

  "People who need a hand": "需要他人协助的成员",
  "Add someone I look after": "添加我照顾的成员",
  "Add them": "添加",
  "Stop the help": "停止代填",
  "Give them a vote": "给予投票权",
  "No vote for them": "取消投票权",
  "Yes, they can help me": "同意由对方协助我",
  "Answers for themselves": "自己填写",
  "Help offered — not accepted yet": "已提出协助 — 对方尚未同意",

  /* E1 — Export */
  Export: "导出",
  "Export plan": "导出计划",
  "Take your plan into a spreadsheet or calendar": "将计划导出为表格或日历",
  Format: "格式",
  "Spreadsheet (CSV)": "电子表格（CSV）",
  "Calendar (ICS)": "日历（ICS）",
  "CSV purpose": "CSV 用途",
  "Readable itinerary": "易读行程",
  "Google My Maps import": "Google My Maps 导入",
  "One row per stop with separate latitude and longitude columns for Google My Maps.":
    "每行一个停靠点，含独立的纬度和经度列，用于 Google My Maps。",
  "One row per item, sorted by day and time, with map links and notes.":
    "每行一个项目，按日期和时间排序，含地图链接和备注。",
  "What to include": "包含内容",
  Scope: "范围",
  "Full trip": "整个行程",
  "My activities only": "仅我的活动",
  "A managed traveller": "某位被照顾的同行者",
  "Bookings and transport": "预订与交通",
  Traveller: "同行者",
  "Choose a traveller": "选择同行者",
  Activities: "活动",
  Meals: "用餐",
  Rests: "休息",
  Travel: "交通",
  "Date range": "日期范围",
  From: "开始",
  To: "结束",
  "Map output": "地图输出",
  Include: "包含",
  "Coordinates and links": "坐标和链接",
  "Coordinates only": "仅坐标",
  "Map links only": "仅地图链接",
  "Map provider": "地图提供商",
  "Google and Apple": "Google 与 Apple",
  "Calendar options": "日历选项",
  "Reminder alarm": "提醒闹钟",
  "None": "无",
  "15 minutes before": "提前 15 分钟",
  "30 minutes before": "提前 30 分钟",
  "1 hour before": "提前 1 小时",
  "Include rest and transfer blocks": "包含休息和换乘时段",
  "Include parking and transfer access points (where available)":
    "包含停车与换乘接驳点（如有数据）",
  "Preview export": "预览导出",
  Generating: "正在生成",
  Preview: "预览",
  "Download": "下载",
  " rows included": " 行已包含",
  omitted: "已省略",
  Revision: "版本",
  "Google My Maps requires latitude and longitude coordinates. Choose Coordinates only if you are importing there.":
    "Google My Maps 需要纬度和经度坐标。若导入 My Maps，请选择仅坐标。",
  "Export your group's plan as a spreadsheet or calendar file.":
    "将群组计划导出为电子表格或日历文件。",
};

const PATTERNS: Array<[RegExp, (...parts: string[]) => string]> = [
  [/^(\d+) travellers$/, (n) => `${n} 位同行者`],
  [/^(\d+) joined$/, (n) => `${n} 人已加入`],
  [/^(\d+) voted$/, (n) => `${n} 人已投票`],
  [/^(\d+) of (\d+) shared$/, (a, b) => `${a}/${b} 人已分享`],
  [/^Day (\d+) — (.+)$/, (n, area) => `第 ${n} 天 — ${area}`],
  [/^Day (\d+) · revised plan$/, (n) => `第 ${n} 天 · 调整后的计划`],
  [/^Leave in (\d+) min$/, (n) => `${n} 分钟后出发`],
  [/^(\d+) min$/, (n) => `${n} 分钟`],
  [/^(\d+) places reviewed$/, (n) => `已查看 ${n} 个地点`],
  [/^(\d+) waiting for a decision$/, (n) => `${n} 项等待决定`],
  [
    /^(\d+) of (\d+) people have something they asked for$/,
    (a, b) => `${a}/${b} 人的心愿已纳入计划`,
  ],
  [/^Step (\d+)$/, (n) => `第 ${n} 步`],
  [/^Saved (.+)$/, (date) => `保存于 ${date}`],
  [/^Search places in (.+)$/, (place) => `搜索 ${place} 的地点`],
  [/^Voting as (.+)$/, (name) => `以 ${name} 身份投票`],
  [/^Demo: view as$/, () => "演示：查看身份"],
  [/^Demo: answering as$/, () => "演示：回答身份"],
  [/^(\d+) days · (\d+) activities · balanced pace$/, (d, a) => `${d} 天 · ${a} 项活动 · 节奏均衡`],
  [/^(\d+) (person|people)$/, (n) => `${n} 人`],
  [/^(\d+) (stop|stops)$/, (n) => `${n} 个地点`],
  [/^(\d+) of 5 · answering as (.+)$/, (n, name) => `第 ${n}/5 步 · 由 ${name} 回答`],
  [/^(.+) is already on your shortlist\.$/, (name) => `${name} 已在候选清单中。`],
  [/^(.+) added to the shortlist\.$/, (name) => `${name} 已加入候选清单。`],
  [/^Published by (.+)$/, (name) => `由 ${name} 发布`],
  [
    /^About (\d+) minutes on foot \(estimated\), (\d+) transfers?, (\d+) outdoor stops?\.$/,
    (walk, transfers, outdoor) =>
      `预计步行约 ${walk} 分钟，换乘 ${transfers} 次，户外活动 ${outdoor} 项。`,
  ],
];

export function translateText(value: string, forceLocale?: AppLocale) {
  const locale =
    forceLocale ||
    (typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : "en");
  if (locale !== "zh-CN") return value;
  const leading = value.match(/^\s*/)?.[0] ?? "";
  const trailing = value.match(/\s*$/)?.[0] ?? "";
  const clean = value.trim();
  if (!clean) return value;
  const exact = ZH[clean];
  if (exact) return `${leading}${exact}${trailing}`;
  for (const [pattern, result] of PATTERNS) {
    const match = clean.match(pattern);
    if (match) return `${leading}${result(...match.slice(1))}${trailing}`;
  }
  return value;
}

type LocaleContextValue = {
  locale: AppLocale;
  setLocale: (locale: AppLocale) => void;
  t: (english: string) => string;
};

const LocaleContext = createContext<LocaleContextValue>({
  locale: "en",
  setLocale: () => undefined,
  t: (english) => english,
});

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<AppLocale>("en");

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "zh-CN") setLocaleState("zh-CN");
  }, []);

  const setLocale = useCallback((next: AppLocale) => {
    window.localStorage.setItem(STORAGE_KEY, next);
    setLocaleState(next);
    window.location.reload();
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    if (locale !== "zh-CN") return;

    const originals = new WeakMap<Text, string>();
    const attributes = ["placeholder", "aria-label", "title"] as const;
    const attributeOriginals = new WeakMap<Element, Map<string, string>>();
    const process = (root: Node) => {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      const nodes: Text[] = [];
      if (root.nodeType === Node.TEXT_NODE) nodes.push(root as Text);
      while (walker.nextNode()) nodes.push(walker.currentNode as Text);
      for (const node of nodes) {
        const parent = node.parentElement;
        if (!parent || ["SCRIPT", "STYLE", "TEXTAREA"].includes(parent.tagName)) continue;
        const source = originals.get(node) ?? node.data;
        originals.set(node, source);
        const translated = translateText(source, locale);
        if (node.data !== translated) node.data = translated;
      }
      const elements = root instanceof Element ? [root, ...root.querySelectorAll("*")] : [];
      for (const element of elements) {
        let stored = attributeOriginals.get(element);
        if (!stored) {
          stored = new Map();
          attributeOriginals.set(element, stored);
        }
        for (const attribute of attributes) {
          const current = element.getAttribute(attribute);
          if (!current) continue;
          const source = stored.get(attribute) ?? current;
          stored.set(attribute, source);
          const translated = translateText(source, locale);
          if (current !== translated) element.setAttribute(attribute, translated);
        }
      }
    };
    process(document.documentElement);
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "characterData") process(mutation.target);
        for (const node of mutation.addedNodes) process(node);
      }
    });
    observer.observe(document.documentElement, {
      childList: true,
      characterData: true,
      subtree: true,
    });
    return () => observer.disconnect();
  }, [locale]);

  const t = useCallback(
    (english: string) => (locale === "zh-CN" ? translateText(english, locale).trim() : english),
    [locale],
  );
  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  return useContext(LocaleContext);
}

export function LanguageToggle({ className = "" }: { className?: string }) {
  const { locale, setLocale } = useLocale();
  return (
    <div
      className={`inline-flex min-h-11 items-center rounded-xl border border-border bg-card p-0.5 shadow-sm ${className}`}
      aria-label="Language"
    >
      <Languages className="mx-1.5 size-4 shrink-0 text-secondary" aria-hidden />
      <button
        type="button"
        className={`min-h-11 min-w-11 rounded-lg px-2 text-xs font-extrabold ${locale === "en" ? "bg-secondary text-secondary-foreground" : "text-muted-foreground"}`}
        aria-pressed={locale === "en"}
        onClick={() => setLocale("en")}
      >
        EN
      </button>
      <button
        type="button"
        className={`min-h-11 min-w-11 rounded-lg px-2 text-xs font-extrabold ${locale === "zh-CN" ? "bg-secondary text-secondary-foreground" : "text-muted-foreground"}`}
        aria-pressed={locale === "zh-CN"}
        onClick={() => setLocale("zh-CN")}
      >
        简中
      </button>
    </div>
  );
}
