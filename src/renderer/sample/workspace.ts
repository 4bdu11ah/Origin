// Sample data for the screens that aren't wired up yet. One coherent story: a
// small team (Penny, Otto, Ivy, Bruno, Bea and their contractors) shipping a
// product, so Board, Inbox, Releases, Team and Chief all agree with each other.
// Uses the project's real systems from its map when there are any.

import { CONTRACTOR, ROSTER, type Employee } from '../components/Canvas/personas'
import { ticketPrefix } from '../components/Canvas/agentActivity'
import type { ChiefMessage, Connection, InboxItem, LibraryEmployee, Person, Release, TeamMember, Ticket } from '../types/work'

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
  team: TeamMember[]
  library: LibraryEmployee[]
  connections: Connection[]
  chief: ChiefMessage[]
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
        { who: person(IVY), text: 'Made order search instant', when: 'Tue' },
        { who: person(BRUNO), text: 'Verified with a big account', when: 'Tue' }
      ],
      release: 'r-15',
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

  const releases: Release[] = [
    {
      id: 'r-16',
      name: 'Today, 11:40',
      commit: '8c41f2e',
      when: '2h ago',
      highlights: ['Order search is instant for big accounts', 'Fixed a crash when a coupon expires mid-checkout'],
      tickets: [k(10)],
      checks: { passed: 42, total: 42 },
      status: 'live'
    },
    {
      id: 'r-15',
      name: 'Tue, 16:05',
      commit: '3e9b7a1',
      when: '2 days ago',
      highlights: ['New pricing page with three plans', 'Yearly discount at checkout'],
      tickets: [k(11), k(10)],
      checks: { passed: 40, total: 41 },
      status: 'superseded'
    },
    {
      id: 'r-14',
      name: 'Mon, 10:20',
      commit: 'b72d0c9',
      when: '4 days ago',
      highlights: ['Receipts download as PDF'],
      tickets: [k(8)],
      checks: { passed: 38, total: 38 },
      status: 'superseded'
    },
    {
      id: 'r-13',
      name: 'Fri, 18:30',
      commit: '51aa3fd',
      when: 'last week',
      highlights: ['Tried a faster image loader; rolled back after slow pages'],
      tickets: [],
      checks: { passed: 31, total: 36 },
      status: 'rolled-back'
    }
  ]

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
    { id: 'claude', name: 'Claude Code', kind: 'login', status: 'ok', detail: 'Logged in', usedBy: ['Everyone'] },
    { id: 'codex', name: 'Codex', kind: 'login', status: 'missing', detail: 'Not installed', usedBy: [] },
    { id: 'gh', name: 'GitHub', kind: 'login', status: 'ok', detail: 'Logged in', usedBy: ['Penny', 'Ivy', 'Bruno'] },
    { id: 'vercel', name: 'Vercel', kind: 'login', status: 'expired', detail: 'Logged out 2 days ago', usedBy: ['Otto'] },
    { id: 'figma', name: 'Figma', kind: 'mcp', status: 'ok', detail: 'Connected', usedBy: ['Otto'] },
    { id: 'supabase', name: 'Supabase', kind: 'mcp', status: 'ok', detail: 'Connected', usedBy: ['Ivy'] },
    { id: 'sentry', name: 'Sentry', kind: 'mcp', status: 'expiring', detail: 'Token expires in 3 days', usedBy: ['Bruno'] },
    { id: 'stripe', name: 'Stripe', kind: 'key', status: 'ok', detail: 'Test key · sk_test_…4f2a', usedBy: ['Penny'] },
    { id: 'meta', name: 'Meta Ads', kind: 'key', status: 'ok', detail: 'Token · …9c1e', usedBy: ['Bea'] },
    { id: 'resend', name: 'Resend', kind: 'key', status: 'missing', detail: 'No key yet', usedBy: ['Ivy', 'Bea'] }
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

  return { prefix: P, tickets, inbox, releases, team, library, connections, chief }
}
