// Sample data for the screens that aren't wired up yet. One coherent story: a
// small team (Penny, Otto, Ivy, Bruno, Bea and their contractors) shipping a
// product, so Board, Inbox, Releases, Team and Chief all agree with each other.
// Uses the project's real systems from its map when there are any.

import { CONTRACTOR, ROSTER, type Employee } from '../components/Canvas/personas'
import { ticketPrefix } from '../components/Canvas/agentActivity'
import type { ProjectOrigin, CatalogItem, ChiefMessage, Connection, InboxItem, LibraryEmployee, Meeting, MeetingLine, MeetingTemplate, Person, Release, TeamMember, Ticket } from '../types/work'

const [PENNY, OTTO, IVY, BRUNO, BEA] = ROSTER

export const CHIEF: Employee = { type: 'employee', nickname: 'Leo', role: 'Chief of staff', icon: '🦁', color: '#e8853d' }

const person = (e: Employee): Person => ({ name: e.nickname, persona: e })
const contractor = (task: string): Person => ({ name: `Contractor · ${task}`, persona: CONTRACTOR })

const FALLBACK_SYSTEMS = [
  { label: 'Payments', color: '#f0a05a' },
  { label: 'Auth', color: '#b490ee' },
  { label: 'Website', color: '#73daca' },
  { label: 'Design system', color: '#8fb0f5' },
  { label: 'Email', color: '#eccb5a' }
]

export interface SampleWorkspace {
  prefix: string
  tickets: Ticket[]
  inbox: InboxItem[]
  releases: Release[]
  origin: ProjectOrigin
  team: TeamMember[]
  library: LibraryEmployee[]
  connections: Connection[]
  catalog: CatalogItem[]
  chief: ChiefMessage[]
  templates: MeetingTemplate[]
  meetings: Meeting[]
  /** A sprint-planning meeting, played back line by line in the preview. */
  meetingScript: MeetingLine[]
}

export function sampleWorkspace(projectPath: string, mapSystems: { label: string; color: string }[] = []): SampleWorkspace {
  const P = ticketPrefix(projectPath)
  const k = (n: number) => `${P}-${n}`
  const sys = [...mapSystems, ...FALLBACK_SYSTEMS].slice(0, 5)
  const [S0, S1, S2, S3, S4] = sys

  const tickets: Ticket[] = [
    {
      key: k(12),
      title: 'Fix wrong total at checkout',
      status: 'in-progress',
      assignee: person(PENNY),
      system: S0,
      summary: 'Customers with tax were charged it twice. The cart and payment step each added tax.',
      doneWhen: [
        { text: 'Totals match the payment provider', ok: true },
        { text: 'Discount orders round correctly', ok: false },
        { text: 'All checkout tests pass', ok: false }
      ],
      history: [
        { who: person(BRUNO), text: 'Reported from support tickets', when: 'Mon' },
        { who: person(PENNY), text: 'Found tax charged twice', when: '40m' },
        { who: person(PENNY), text: 'Tax now added only once', when: '20m' }
      ],
      updated: '2m ago'
    },
    {
      key: k(19),
      title: 'Add password reset by email',
      status: 'in-progress',
      assignee: person(IVY),
      system: S1,
      summary: 'Locked-out users email support today. Let them reset their own password with a one-time link.',
      doneWhen: [
        { text: 'Reset link works once, expires in 1h', ok: true },
        { text: 'Email actually arrives', ok: false },
        { text: 'Old sessions signed out after reset', ok: true }
      ],
      history: [
        { who: { name: 'You', persona: CONTRACTOR }, text: 'Created from a support request', when: 'Tue' },
        { who: person(IVY), text: 'Built the reset flow', when: '1h' },
        { who: person(IVY), text: 'Needs you: pick email provider', when: '5m' }
      ],
      updated: '5m ago'
    },
    {
      key: k(26),
      title: 'Refresh the landing page hero',
      status: 'in-review',
      assignee: person(OTTO),
      system: S2,
      summary: 'The hero still sells last year’s message. New headline, real product screenshot, sign-up above the fold.',
      doneWhen: [
        { text: 'Looks right on phone and desktop', ok: true },
        { text: 'Sign-up button above the fold', ok: true },
        { text: 'Bea approves the headline', ok: false }
      ],
      history: [
        { who: person(BEA), text: 'Asked for a fresher message', when: 'Wed' },
        { who: person(OTTO), text: 'Rebuilt the top of page', when: '2h' },
        { who: person(OTTO), text: 'Sent for review', when: '30m' }
      ],
      updated: '30m ago'
    },
    {
      key: k(31),
      title: 'Weekly usage email to customers',
      status: 'todo',
      assignee: person(BEA),
      system: S4,
      summary: 'Send each customer a short weekly summary of what they did, to bring quiet users back.',
      doneWhen: [
        { text: 'Email shows real numbers per customer', ok: false },
        { text: 'Customers can turn it off', ok: false }
      ],
      history: [{ who: person(BEA), text: 'Proposed to win back users', when: 'Thu' }],
      updated: 'yesterday'
    },
    {
      key: k(33),
      title: 'Dark mode for the dashboard',
      status: 'todo',
      assignee: null,
      system: S3,
      summary: 'Requested by several customers. Use the design system colours so it stays consistent.',
      doneWhen: [{ text: 'Every dashboard page readable in dark', ok: false }],
      history: [{ who: { name: 'You', persona: CONTRACTOR }, text: 'Added from customer feedback', when: 'Thu' }],
      updated: 'yesterday'
    },
    {
      key: k(35),
      title: 'Limit login attempts',
      status: 'todo',
      assignee: null,
      system: S1,
      summary: 'Anyone can guess passwords without limit. Lock out after a few wrong tries for a few minutes.',
      doneWhen: [{ text: 'Fifth wrong try waits 5 minutes', ok: false }],
      history: [{ who: person(IVY), text: 'Found while building reset', when: '1h' }],
      updated: '1h ago'
    },
    {
      key: k(8),
      title: 'Receipts as PDF',
      status: 'done',
      assignee: person(PENNY),
      system: S0,
      summary: 'Customers can download every receipt as a PDF from their billing page.',
      doneWhen: [
        { text: 'PDF matches the email receipt', ok: true },
        { text: 'Works for refunded orders', ok: true }
      ],
      history: [
        { who: person(PENNY), text: 'Shipped receipts as PDF', when: 'Mon' },
        { who: person(BRUNO), text: 'Verified on real orders', when: 'Mon' }
      ],
      release: 'r-14',
      updated: 'Mon'
    },
    {
      key: k(10),
      title: 'Faster search on orders page',
      status: 'done',
      assignee: person(IVY),
      system: S1,
      summary: 'Searching orders took seconds for big accounts. Now it answers instantly.',
      doneWhen: [{ text: 'Search under half a second at 50k orders', ok: true }],
      history: [
        { who: person(IVY), text: 'Made order search instant', when: 'Today' },
        { who: person(BRUNO), text: 'Verified with a big account', when: 'Today' }
      ],
      release: 'r-16',
      updated: 'Tue'
    },
    {
      key: k(11),
      title: 'New pricing page',
      status: 'done',
      assignee: person(OTTO),
      system: S2,
      summary: 'Three clear plans with a comparison table and yearly discount.',
      doneWhen: [
        { text: 'Prices match billing', ok: true },
        { text: 'Bea signed off copy', ok: true }
      ],
      history: [{ who: person(OTTO), text: 'Launched the new pricing page', when: 'Tue' }],
      release: 'r-15',
      updated: 'Tue'
    }
  ]

  const inbox: InboxItem[] = [
    {
      id: 'i1',
      kind: 'bug',
      title: 'Payment test fails at random',
      summary: 'One checkout test passes or fails without code changes. Likely depends on the time of day.',
      foundBy: person(PENNY),
      foundWhile: k(12),
      system: S0,
      when: '12m ago'
    },
    {
      id: 'i2',
      kind: 'risk',
      title: 'Login has no attempt limit',
      summary: 'Anyone can guess passwords forever. Worth fixing before the next marketing push.',
      foundBy: person(IVY),
      foundWhile: k(19),
      system: S1,
      when: '1h ago'
    },
    {
      id: 'i3',
      kind: 'bug',
      title: 'Pricing page shows old prices',
      summary: 'The French version still lists last year’s plans. English is correct.',
      foundBy: contractor('hero refresh'),
      foundWhile: k(26),
      system: S2,
      when: '2h ago'
    },
    {
      id: 'i4',
      kind: 'idea',
      title: 'Remind users with abandoned carts',
      summary: 'A third of carts are left at the payment step. A gentle reminder email could win some back.',
      foundBy: person(BEA),
      foundWhile: k(31),
      system: S4,
      when: 'yesterday'
    },
    {
      id: 'i5',
      kind: 'question',
      title: 'Keep the old checkout for B2B?',
      summary: 'Two business customers use a custom checkout. Should the new totals apply to them too?',
      foundBy: person(PENNY),
      foundWhile: k(12),
      system: S0,
      when: 'yesterday'
    }
  ]

  const t = (key: string, title: string, who: string) => ({ key, title, who })
  const releases: Release[] = [
    {
      id: 'r-16',
      version: 'v0.16',
      name: 'Today, 11:40',
      commit: '8c41f2e',
      when: '2h ago',
      headline: 'Order search is instant',
      highlights: ['Order search is instant for big accounts', 'No more crash when a coupon expires mid-checkout'],
      tickets: [t(k(10), 'Faster search on orders page', 'Ivy'), t(k(9), 'Coupon expiry crash', 'Penny')],
      checks: { passed: 42, total: 42 },
      status: 'live'
    },
    {
      id: 'r-15',
      version: 'v0.15',
      name: 'Tue, 16:05',
      commit: '3e9b7a1',
      when: '2 days ago',
      headline: 'New pricing, yearly discount',
      highlights: ['New pricing page with three plans', 'Yearly discount at checkout'],
      tickets: [t(k(11), 'New pricing page', 'Otto'), t(k(7), 'Yearly billing', 'Penny'), t(k(6), 'Plan comparison table', 'Otto')],
      checks: { passed: 40, total: 41 },
      status: 'superseded'
    },
    {
      id: 'r-14',
      version: 'v0.14',
      name: 'Mon, 10:20',
      commit: 'b72d0c9',
      when: '4 days ago',
      headline: 'Receipts as PDF',
      highlights: ['Receipts download as PDF'],
      tickets: [t(k(8), 'Receipts as PDF', 'Penny')],
      checks: { passed: 38, total: 38 },
      status: 'superseded'
    },
    {
      id: 'r-13',
      version: 'v0.13',
      name: 'Fri, 18:30',
      commit: '51aa3fd',
      when: 'last week',
      headline: 'Faster images (rolled back)',
      highlights: ['Tried a faster image loader; pages got slower, so it was rolled back'],
      tickets: [t(k(5), 'Faster image loading', 'Ivy')],
      checks: { passed: 31, total: 36 },
      status: 'rolled-back'
    },
    {
      id: 'r-12',
      version: 'v0.12',
      name: 'Nov 3',
      commit: 'e04c6b2',
      when: '11 days ago',
      headline: 'Teams can invite each other',
      highlights: ['Invite teammates by email', 'Roles: owner, member, viewer'],
      tickets: [t(k(4), 'Team invites', 'Ivy'), t(k(3), 'Roles and permissions', 'Ivy'), t('—', 'Invite email design', 'Otto')],
      checks: { passed: 35, total: 35 },
      status: 'superseded'
    },
    {
      id: 'r-11',
      version: 'v0.11',
      name: 'Oct 21',
      commit: '9f2d1a8',
      when: '3 weeks ago',
      headline: 'Customers can pay',
      highlights: ['Card payments with Stripe', 'Email receipts'],
      tickets: [t(k(2), 'Stripe checkout', 'Penny'), t('—', 'Email receipts', 'Penny')],
      checks: { passed: 29, total: 29 },
      status: 'superseded'
    },
    {
      id: 'r-10',
      version: 'v0.10',
      name: 'Oct 2',
      commit: '47be0c3',
      when: '6 weeks ago',
      headline: 'First version anyone can use',
      highlights: ['Sign up, sign in with Google', 'A first dashboard', 'Landing page'],
      tickets: [t(k(1), 'Sign in with Google', 'Ivy'), t('—', 'First dashboard', 'Otto'), t('—', 'Landing page v1', 'Bea')],
      checks: { passed: 18, total: 18 },
      status: 'superseded'
    }
  ]

  const origin: ProjectOrigin = { date: 'Sep 8', commit: '0a1b2c3', note: 'First commit', age: '10 weeks ago' }

  const team: TeamMember[] = [
    {
      employee: PENNY,
      status: 'working',
      ticket: k(12),
      contractors: [
        { task: 'Run checkout tests', status: 'working' },
        { task: 'Check rounding rules', status: 'done' }
      ],
      memory: [
        { date: 'Nov 14', note: 'Payment provider rounds after tax' },
        { date: 'Nov 11', note: 'B2B customers use custom checkout' }
      ],
      connections: ['Stripe', 'GitHub']
    },
    {
      employee: IVY,
      status: 'needs-you',
      ticket: k(19),
      contractors: [{ task: 'Write reset emails', status: 'done' }],
      memory: [
        { date: 'Nov 14', note: 'No email provider set up yet' },
        { date: 'Nov 12', note: 'Sessions stored in the database' }
      ],
      connections: ['Supabase', 'GitHub']
    },
    {
      employee: OTTO,
      status: 'idle',
      ticket: k(26),
      contractors: [{ task: 'Hero refresh', status: 'done' }],
      memory: [{ date: 'Nov 13', note: 'Brand orange is #E8853D' }],
      connections: ['Figma', 'Vercel']
    },
    {
      employee: BRUNO,
      status: 'idle',
      ticket: null,
      contractors: [],
      memory: [{ date: 'Nov 10', note: 'Test big accounts with 50k orders' }],
      connections: ['GitHub', 'Sentry']
    },
    {
      employee: BEA,
      status: 'working',
      ticket: k(31),
      contractors: [{ task: 'Draft weekly email', status: 'working' }],
      memory: [{ date: 'Nov 13', note: 'Quiet users: no login in 14 days' }],
      connections: ['Meta Ads', 'Resend']
    }
  ]

  const library: LibraryEmployee[] = [
    { icon: '🦄', color: '#e58fd0', name: 'Nova', role: 'Facebook ads manager', pitch: 'Runs and tunes ad campaigns daily', author: 'community', installs: '2.1k' },
    { icon: '🐬', color: '#6fc3e8', name: 'Finn', role: 'Creative designer', pitch: 'Makes ad images and social posts', author: 'community', installs: '1.4k' },
    { icon: '🦔', color: '#c9a27a', name: 'Hazel', role: 'Security reviewer', pitch: 'Checks every change for risky code', author: 'origin', installs: '3.8k' },
    { icon: '🐢', color: '#7cc99a', name: 'Moss', role: 'Docs writer', pitch: 'Keeps help pages in sync with the app', author: 'community', installs: '920' },
    { icon: '🦩', color: '#f29bb0', name: 'Rosa', role: 'SEO specialist', pitch: 'Finds and fixes search ranking issues', author: 'community', installs: '1.1k' },
    { icon: '🐿️', color: '#e0a35a', name: 'Pip', role: 'Support triager', pitch: 'Turns support emails into tickets', author: 'origin', installs: '2.6k' }
  ]

  const connections: Connection[] = [
    {
      id: 'claude',
      name: 'Claude Code',
      kind: 'runner',
      status: 'ok',
      detail: 'Logged in',
      plan: 'Uses your Claude Pro or Max plan',
      usedBy: ['Everyone'],
      steps: [
        { text: 'Install Claude Code', command: 'npm install -g @anthropic-ai/claude-code' },
        { text: 'Log in with your Claude account', command: 'claude /login' },
        { text: 'Origin checks it works' }
      ]
    },
    {
      id: 'codex',
      name: 'Codex',
      kind: 'runner',
      status: 'missing',
      detail: 'Not connected',
      plan: 'Uses your ChatGPT Plus or Pro plan',
      usedBy: [],
      steps: [
        { text: 'Install Codex', command: 'npm install -g @openai/codex' },
        { text: 'Log in with your ChatGPT account', command: 'codex login' },
        { text: 'Origin checks it works' }
      ]
    },
    { id: 'gh', name: 'GitHub', kind: 'code', status: 'ok', detail: 'Logged in · 3 repos', usedBy: ['Penny', 'Ivy', 'Bruno'] },
    { id: 'vercel', name: 'Vercel', kind: 'code', status: 'expired', detail: 'Logged out 2 days ago', usedBy: ['Otto'] },
    { id: 'figma', name: 'Figma', kind: 'mcp', status: 'ok', detail: 'Connected', usedBy: ['Otto'] },
    { id: 'supabase', name: 'Supabase', kind: 'mcp', status: 'ok', detail: 'Connected', usedBy: ['Ivy'] },
    { id: 'sentry', name: 'Sentry', kind: 'mcp', status: 'expiring', detail: 'Token expires in 3 days', usedBy: ['Bruno'] },
    { id: 'stripe', name: 'Stripe', kind: 'key', status: 'ok', detail: 'Test key · sk_test_…4f2a', usedBy: ['Penny'] },
    { id: 'meta', name: 'Meta Ads', kind: 'key', status: 'ok', detail: 'Token · …9c1e', usedBy: ['Bea'] },
    { id: 'resend', name: 'Resend', kind: 'key', status: 'missing', detail: 'No key yet', usedBy: ['Ivy', 'Bea'] }
  ]

  const catalog: CatalogItem[] = [
    { name: 'Linear', kind: 'mcp', blurb: 'Sync tickets both ways' },
    { name: 'Slack', kind: 'mcp', blurb: 'Post updates, read threads' },
    { name: 'Notion', kind: 'mcp', blurb: 'Read docs and specs' },
    { name: 'Postgres', kind: 'mcp', blurb: 'Query your database' },
    { name: 'Playwright', kind: 'mcp', blurb: 'Click through your app' },
    { name: 'Netlify', kind: 'code', blurb: 'Deploy sites' },
    { name: 'GitLab', kind: 'code', blurb: 'Code and merge requests' },
    { name: 'OpenAI API', kind: 'key', blurb: 'Images, embeddings' },
    { name: 'Google Analytics', kind: 'key', blurb: 'Traffic and conversions' },
    { name: 'Custom tool', kind: 'mcp', blurb: 'Any MCP server by URL' }
  ]

  const chief: ChiefMessage[] = [
    {
      from: 'chief',
      text: 'Morning. One thing needs you: Ivy is waiting on an email provider for password reset.',
      cards: [{ type: 'person', name: 'Ivy' }, { type: 'ticket', key: k(19) }],
      when: '9:02'
    },
    {
      from: 'chief',
      text: 'Shipped today: order search is instant. Penny is close on the checkout total fix.',
      cards: [{ type: 'release', id: 'r-16' }, { type: 'ticket', key: k(12) }],
      when: '11:45'
    },
    { from: 'you', text: 'What’s blocked?', when: '12:10' },
    {
      from: 'chief',
      text: 'Two things. Password reset needs an email provider, and the Vercel login expired so Otto can’t deploy previews.',
      cards: [{ type: 'ticket', key: k(19) }, { type: 'person', name: 'Otto' }],
      when: '12:10'
    }
  ]

  const templates: MeetingTemplate[] = [
    { kind: 'tickets', title: 'Plan tickets', blurb: 'Turn ideas into tickets', icon: '🎯' },
    { kind: 'sprint', title: 'Sprint planning', blurb: 'Pick what ships this week', icon: '🗓️' },
    { kind: 'release', title: 'Release review', blurb: 'What shipped, what’s next', icon: '🚀' },
    { kind: 'standup', title: 'Standup', blurb: 'A quick round from everyone', icon: '☕' }
  ]

  const meetings: Meeting[] = [
    { id: 'm1', kind: 'sprint', title: 'Sprint planning', when: 'Mon 10:00', attendees: ['Penny', 'Ivy', 'Otto', 'Bea'], status: 'upcoming' },
    { id: 'm2', kind: 'standup', title: 'Standup', when: 'Tomorrow 9:30', attendees: ['Penny', 'Ivy', 'Otto', 'Bruno', 'Bea'], status: 'upcoming' },
    {
      id: 'm3',
      kind: 'release',
      title: 'Release review',
      when: 'Tue',
      attendees: ['Otto', 'Bruno', 'Bea'],
      status: 'done',
      length: '14 min',
      outcomes: { tickets: 3, decisions: ['Ship the pricing page today', 'Roll back the image loader'] }
    },
    {
      id: 'm4',
      kind: 'tickets',
      title: 'Plan tickets',
      when: 'Last Thu',
      attendees: ['Ivy', 'Bea'],
      status: 'done',
      length: '9 min',
      outcomes: { tickets: 4, decisions: ['Password reset before growth push'] }
    }
  ]

  const meetingScript: MeetingLine[] = [
    { who: 'Leo', text: 'Last week we shipped instant search and PDF receipts.' },
    { who: 'You', text: 'This week: checkout fixed and password reset live.' },
    { who: 'Penny', text: 'Checkout is close. One more day for discount rounding.', sprint: k(12) },
    { who: 'Ivy', text: 'Reset is done except email. Pick a provider and it ships.', sprint: k(19) },
    { who: 'You', text: 'Use Resend. And lock login after five wrong tries.', decision: 'Email goes through Resend', sprint: k(35) },
    { who: 'Bea', text: 'Can we remind people who abandon carts? A third drop at payment.', draft: { title: 'Abandoned cart reminder email', system: S4.label, owner: 'Bea' } },
    { who: 'Leo', text: 'Otto is free after the hero. He could take dark mode.', sprint: k(33) },
    { who: 'You', text: 'Do it. And add a weekly summary of this to the chief chat.', decision: 'Otto takes dark mode', draft: { title: 'Weekly sprint summary in chief chat', owner: 'Leo' } }
  ]

  return { prefix: P, tickets, inbox, releases, origin, team, library, connections, catalog, chief, templates, meetings, meetingScript }
}
