// The desktop drawings: the band above the prompt and each row of the crew panel, every
// one a single SVG (the desktop wraps sibling elements onto new lines, so a row that must
// stay on one line is one drawing). Pure functions of plain data, so tests can call them.

import type { AgentRun, Verdict } from '../types'
import { crab, CRAB_CSS } from './crabs'
import { modelName, roleBySlug } from './roster'
import type { Role } from './roster'

export const AMBER = '#EBA82F'
export const DONE = '#5FBF8F'
const FONT = "-apple-system,BlinkMacSystemFont,'SF Pro Text','Segoe UI',sans-serif"

export const xml = (s: string): string =>
  s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c)

// Rough advance of system UI text, in em; good enough to size a text's slot.
const charEm = (ch: string): number =>
  /[\s.,:;'|!il1()[\]]/.test(ch) ? 0.3 : /[A-Zmw@%]/.test(ch) ? 0.72 : /[ -⯿\u{1F000}-\u{1FFFF}]/u.test(ch) ? 1.1 : 0.56

export const textWidth = (s: string, size: number): number => [...s].reduce((w, ch) => w + charEm(ch) * size, 0)

/** Cuts `s` to fit `maxW` pixels, with an ellipsis when it had to cut. */
export const fitText = (s: string, size: number, maxW: number): string => {
  if (textWidth(s, size) <= maxW) return s
  let out = ''
  for (const ch of s) {
    if (textWidth(out + ch + '…', size) > maxW) break
    out += ch
  }
  return out + '…'
}

export const fmtTokens = (n: number): string =>
  n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}k` : `${Math.round(n)}`

export const fmtCost = (usd: number): string => `$${usd < 10 ? usd.toFixed(2) : usd.toFixed(1)}`

export const fmtTime = (ms: number): string => {
  const s = Math.max(0, Math.round(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = String(s % 60).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}

export const VERDICT: Record<Verdict, { text: string; color: string }> = {
  approved: { text: 'APPROVED', color: '#3B9C5F' },
  changes: { text: 'CHANGES REQUESTED', color: '#C98A12' },
  blocked: { text: 'BLOCKED', color: '#D0453F' },
}

// Deterministic noise so the dither does not shimmer between redraws.
const noise = (x: number, y: number): number => {
  const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453
  return s - Math.floor(s)
}

/** What the band shows, from a reported plan or from the agents alone. */
export type BandModel = {
  title: string
  label: string
  /** Accepted (or finished) share, 0 to 1. */
  ratio: number
  /** Accepted plus in flight, 0 to 1: the faint layer ahead of the fill. */
  runRatio: number
  /** Planned task count for the tick marks; 0 for none. */
  ticks: number
  isFinished: boolean
  /** The crabs walking at the band's end: the agents at work now. */
  crew: { role: Role; isRunning: boolean }[]
}

export const BAND_H = 26
const BAR_H = 16
const CELL = 3
const CREW_SLOT = 26

const BAND_CSS = `<style>
.t{fill:#1f1f1f}.m{fill:#8a8a8a}.k{fill:#e4e4e2}.tk{fill:#b4b4b0}
@media (prefers-color-scheme: dark){.t{fill:#ececec}.m{fill:#9a9a9a}.k{fill:#2c2c2c}.tk{fill:#5a5a5a}}
.t0,.t1,.t2,.t3{animation:tw 2.2s ease-in-out infinite}
.t1{animation-duration:2.8s;animation-delay:-.7s}.t2{animation-duration:1.9s;animation-delay:-1.3s}.t3{animation-duration:3.3s;animation-delay:-.4s}
.fin .t0,.fin .t1,.fin .t2,.fin .t3{animation-duration:3.6s}
@keyframes tw{0%,100%{opacity:1}50%{opacity:.35}}
@media (prefers-reduced-motion: reduce){.t0,.t1,.t2,.t3{animation:none}}
</style>`

/** The band: a dot, the title, a dithered bar with a label pill, the percent, and the crew at work. */
export const bandSvg = (b: BandModel, W: number): string => {
  const crewShown = b.crew.slice(0, 5)
  const crewW = Math.max(1, crewShown.length) * CREW_SLOT
  const title = fitText(b.title, 13, Math.max(60, W * 0.35))
  const barX = Math.round(16 + textWidth(title, 13) + 12)
  const barW = Math.max(60, W - barX - 44 - crewW)
  const color = b.isFinished ? DONE : AMBER
  const y0 = (BAND_H - BAR_H) / 2
  const fillW = Math.round(barW * Math.min(1, Math.max(0, b.ratio)))
  const runW = Math.round(barW * Math.min(1, Math.max(b.ratio, b.runRatio)))
  const rows = Math.floor(BAR_H / CELL)
  const dots: string[] = []
  const cols = Math.floor(fillW / CELL)
  for (let c = 0; c < cols; c++) {
    const density = 0.35 + 0.6 * Math.pow(c / Math.max(1, cols), 1.2)
    for (let r = 0; r < rows; r++) {
      if (noise(c, r) < density) dots.push(`<rect class="t${Math.floor(noise(r, c) * 4)}" x="${c * CELL + 1}" y="${r * CELL + 1}" width="2" height="2"/>`)
    }
  }
  const faint: string[] = []
  for (let c = cols; c < Math.floor(runW / CELL); c++) {
    for (let r = 0; r < rows; r++) {
      if (noise(c + 7, r + 3) < 0.2) faint.push(`<rect class="t${Math.floor(noise(r + 5, c) * 4)}" x="${c * CELL + 1}" y="${r * CELL + 1}" width="1.7" height="1.7"/>`)
    }
  }
  const ticks: string[] = []
  for (let i = 1; i < b.ticks; i++) {
    const x = Math.round((barW * i) / b.ticks)
    if (x > fillW + 4) ticks.push(`<rect x="${x}" y="${BAR_H / 2 - 4}" width="1.5" height="8" rx="0.75"/>`)
  }
  const pillW = Math.round(18 + textWidth(b.label, 11))
  const pillX = Math.max(0, Math.min(barW - pillW, fillW - pillW))
  const percent = `${Math.round(Math.min(1, b.ratio) * 100)}%`
  const crewX = W - crewW
  const crabs = (crewShown.length === 0 ? [{ role: roleBySlug('other'), isRunning: false }] : crewShown)
    .map((m, i) => crab(crewX + i * CREW_SLOT, 0, m.role.slug, m.role.color, false, m.isRunning, 0.9))
    .join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${BAND_H}" viewBox="0 0 ${W} ${BAND_H}">${BAND_CSS}${CRAB_CSS}
<defs><clipPath id="c"><rect width="${barW}" height="${BAR_H}" rx="${BAR_H / 2}"/></clipPath></defs>
<circle cx="5" cy="${BAND_H / 2}" r="4" fill="${color}"/>
<text class="t" x="16" y="${BAND_H / 2 + 4.5}" font-family="${FONT}" font-size="13" font-weight="500">${xml(title)}</text>
<g transform="translate(${barX},${y0})"${b.isFinished ? ' class="fin"' : ''}>
<rect class="k" width="${barW}" height="${BAR_H}" rx="${BAR_H / 2}"/>
<g clip-path="url(#c)"><g fill="${color}">${dots.join('')}</g><g fill="${color}" opacity="0.45">${faint.join('')}</g><g class="tk">${ticks.join('')}</g></g>
<rect x="${pillX}" width="${pillW}" height="${BAR_H}" rx="${BAR_H / 2}" fill="${color}"/>
<text x="${pillX + pillW / 2}" y="${BAR_H / 2 + 4}" text-anchor="middle" font-family="${FONT}" font-size="11" font-weight="600" fill="#1f1f1f">${xml(b.label)}</text>
</g>
<text class="m" x="${crewX - 6}" y="${BAND_H / 2 + 4.5}" text-anchor="end" font-family="${FONT}" font-size="12.5" font-variant-numeric="tabular-nums">${percent}</text>
${crabs}
</svg>`
}

// --- the crew panel

const PANE_CSS = `<style>
.t{fill:#1f1f1f}.s{fill:#6b6b68}.m{fill:#9a9a96}.k{fill:#ecebe8}.ln{stroke:#e4e4e1}.tile{fill:#f4f3f0}
@media (prefers-color-scheme: dark){.t{fill:#ececec}.s{fill:#a8a8a4}.m{fill:#7d7d79}.k{fill:#2c2c2b}.ln{stroke:#333331}.tile{fill:#262625}}
.live{animation:p 1.6s ease-in-out infinite}@keyframes p{50%{opacity:.3}}
@media (prefers-reduced-motion: reduce){.live{animation:none}}
</style>`

const svg = (W: number, H: number, body: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${PANE_CSS}${CRAB_CSS}${body}</svg>`

export type Totals = { cost: number; tokens: number; time: number; sessionUsd: number }

export const headerHeight = 76

/** The flow's title and version, then four tiles: the agents' cost, tokens, time, and the session's own total. */
export const headerSvg = (W: number, title: string, version: string, t: Totals): string => {
  const gap = 6
  const tiles: [string, string][] = [
    ['Agents', '≈' + fmtCost(t.cost)],
    ['Tokens', fmtTokens(t.tokens)],
    ['Time', fmtTime(t.time)],
    ['Session', t.sessionUsd >= 0 ? fmtCost(t.sessionUsd) : '-'],
  ]
  const tw = (W - gap * (tiles.length - 1)) / tiles.length
  const ver = version === '' ? '' : `v${version}`
  const tile = ([k, v]: [string, string], i: number) =>
    `<rect class="tile" x="${i * (tw + gap)}" y="28" width="${tw}" height="44" rx="8"/>
<text class="s" x="${i * (tw + gap) + 9}" y="45" font-family="${FONT}" font-size="11">${k}</text>
<text class="t" x="${i * (tw + gap) + 9}" y="63" font-family="${FONT}" font-size="15" font-weight="600" font-variant-numeric="tabular-nums">${xml(v)}</text>`
  return svg(
    W,
    headerHeight,
    `<text class="t" x="0" y="16" font-family="${FONT}" font-size="14" font-weight="600">${xml(fitText(title, 14, W - textWidth(ver, 11) - 12))}</text>
<text class="m" x="${W}" y="16" text-anchor="end" font-family="${FONT}" font-size="11">${xml(ver)}</text>
${tiles.map(tile).join('')}`,
  )
}

const statusMark = (x: number, y: number, status: string, color: string): string => {
  if (status === 'running') return `<circle class="live" cx="${x}" cy="${y}" r="3.5" fill="${color}"/>`
  if (status === 'done') return `<path d="M${x - 5} ${y}l3.5 3.5 6.5-7" fill="none" stroke="#3B9C5F" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`
  if (status === 'failed') return `<path d="M${x - 4} ${y - 4}l8 8M${x + 4} ${y - 4}l-8 8" stroke="#D0453F" stroke-width="1.8" stroke-linecap="round"/>`
  return `<circle cx="${x}" cy="${y}" r="5" fill="none" stroke="#9a9a96" stroke-width="1.4"/><path d="M${x} ${y - 2.5}v2.8l1.8 1.2" fill="none" stroke="#9a9a96" stroke-width="1.4" stroke-linecap="round"/>`
}

export const elapsed = (a: AgentRun, at: number): number => (a.endedAt ?? Math.max(at, a.startedAt)) - a.startedAt

export const ctxOf = (a: AgentRun): number => (a.contextMax > 0 ? Math.min(100, Math.round((a.contextTokens / a.contextMax) * 100)) : 0)

export const roleTag = (role: Role, type: string): string => (role.slug === 'other' ? type : `${role.emoji} ${role.label}`.trim())

export const AGENT_H = 70

/** One agent: its crab, its task, its role, model and verdict, and a bar of its context (full once done). */
export const agentSvg = (W: number, a: AgentRun, at: number): string => {
  const role = roleBySlug(a.role)
  const textW = W - 44 - 22
  const meta = [a.effort === undefined ? modelName(a.model) : `${modelName(a.model)} · ${a.effort}`]
  if (a.round > 1) meta.push(`round ${a.round}`)
  if (a.status === 'failed') meta.push('error')
  const ctx = ctxOf(a)
  const stats = `ctx ${ctx}% · ${fmtTokens(a.contextTokens)}  ≈${fmtCost(a.costUsd)}  ${fmtTime(elapsed(a, at))}`
  const isDone = a.status === 'done'
  const fillW = Math.round(textW * (isDone ? 1 : ctx / 100))
  const tag = roleTag(role, a.type)
  const verdict = a.verdict === undefined ? undefined : VERDICT[a.verdict]
  const chipW = verdict === undefined ? 0 : Math.round(14 + textWidth(verdict.text, 10))
  const chip =
    verdict === undefined
      ? ''
      : `<rect x="44" y="42" width="${chipW}" height="15" rx="7.5" fill="${verdict.color}"/><text x="${44 + chipW / 2}" y="53" text-anchor="middle" font-family="${FONT}" font-size="10" font-weight="700" fill="#ffffff">${verdict.text}</text>`
  return svg(
    W,
    AGENT_H,
    `${crab(0, 14, role.slug, role.color, false, a.status === 'running')}
<text class="t" x="44" y="18" font-family="${FONT}" font-size="13" font-weight="600">${xml(fitText(a.description || a.type, 13, textW))}</text>
<text x="44" y="35" font-family="${FONT}" font-size="11"><tspan fill="${role.color}" font-weight="600">${xml(fitText(tag, 11, textW * 0.55))}</tspan><tspan class="s">  ${xml(meta.join('  ·  '))}</tspan></text>
${chip}
<text class="s" x="${44 + textW}" y="53" text-anchor="end" font-family="${FONT}" font-size="11" font-variant-numeric="tabular-nums">${stats}</text>
<rect class="k" x="44" y="60" width="${textW}" height="4" rx="2"/><rect x="44" y="60" width="${fillW}" height="4" rx="2" fill="${isDone ? role.color : '#9a9a96'}"/>
${statusMark(W - 8, 16, a.status, role.color)}
<line class="ln" x1="0" y1="69.5" x2="${W}" y2="69.5"/>`,
  )
}

export const PLANNED_H = 48

/** A planned task not yet started: its crab dimmed, its number, title and role. */
export const plannedSvg = (W: number, n: number, title: string, roleSlug: string, after: number[]): string => {
  const role = roleBySlug(roleSlug)
  const textW = W - 44 - 22
  const meta = after.length > 0 ? `after ${after.join(', ')}` : ''
  return svg(
    W,
    PLANNED_H,
    `${crab(0, 6, role.slug, role.color, true)}
<text class="s" x="44" y="18" font-family="${FONT}" font-size="13" font-weight="600">${xml(fitText(`${n}. ${title}`, 13, textW))}</text>
<text x="44" y="35" font-family="${FONT}" font-size="11"><tspan fill="${role.color}">${xml(role.slug === 'other' ? 'unassigned' : `${role.emoji} ${role.label}`)}</tspan><tspan class="m">  ${xml(meta)}</tspan></text>
${statusMark(W - 8, 16, 'planned', role.color)}
<line class="ln" x1="0" y1="47.5" x2="${W}" y2="47.5"/>`,
  )
}

/** The panel folded to one line: every crab in a row, then the totals. */
export const compactSvg = (W: number, crew: { role: Role; isRunning: boolean; isPlanned: boolean }[], t: Totals): string => {
  const fit = Math.max(1, Math.floor((W - 150) / 36))
  const shown = crew.slice(0, fit)
  const more = crew.length - shown.length
  const body = shown
    .map((m, i) => crab(i * 36, 0, m.role.slug, m.role.color, m.isPlanned, m.isRunning) + (m.isRunning ? `<circle class="live" cx="${i * 36 + 32}" cy="4" r="3" fill="${m.role.color}"/>` : ''))
    .join('')
  const x = shown.length * 36 + 4
  return svg(
    W,
    32,
    `${body}${more > 0 ? `<text class="s" x="${x}" y="21" font-family="${FONT}" font-size="12">+${more}</text>` : ''}
<text class="s" x="${W}" y="21" text-anchor="end" font-family="${FONT}" font-size="12" font-variant-numeric="tabular-nums">≈${fmtCost(t.cost)} · ${fmtTokens(t.tokens)} · ${fmtTime(t.time)}</text>`,
  )
}
