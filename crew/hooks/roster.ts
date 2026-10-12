// The Switchboard roster as the crew view sees it: one entry per role, keyed by the
// stable role slug (the agent's filename), with the emoji its description leads with.
// A theme renames an agent's `name:` but never its description, so the emoji is how a
// themed agent is still recognised.

import type { Phase, Verdict } from '../types'

export type Role = {
  slug: string
  label: string
  emoji: string
  /** The costume's accent: its hat band, prop or trim. */
  color: string
}

export const ROLES: readonly Role[] = [
  { slug: 'architect', label: 'Architect', emoji: '🏛️', color: '#3E7CB1' },
  { slug: 'business-analyst', label: 'Business Analyst', emoji: '🔮', color: '#8E5BD8' },
  { slug: 'designer', label: 'Designer', emoji: '🎨', color: '#D9475B' },
  { slug: 'developer-backend', label: 'Backend Developer', emoji: '🔥', color: '#E8702A' },
  { slug: 'developer-frontend', label: 'Frontend Developer', emoji: '🔨', color: '#2F8FD8' },
  { slug: 'reviewer-code', label: 'Code Reviewer', emoji: '⚖️', color: '#B08D57' },
  { slug: 'reviewer-ux', label: 'UX Reviewer', emoji: '🧭', color: '#2BA39A' },
  { slug: 'reviewer-security', label: 'Security Reviewer', emoji: '🛡️', color: '#3D5A99' },
  { slug: 'testing-qa', label: 'QA Engineer', emoji: '🧪', color: '#3FAE5A' },
  { slug: 'testing-pentester', label: 'Infra Pentester', emoji: '⚡', color: '#E5B820' },
  { slug: 'testing-red-team', label: 'Red Team Lead', emoji: '💀', color: '#C8323C' },
  { slug: 'writer-technical', label: 'Technical Writer', emoji: '📜', color: '#A0703F' },
  { slug: 'release-manager', label: 'Release Manager', emoji: '📯', color: '#D4A017' },
  { slug: 'loki', label: 'Loki', emoji: '🎭', color: '#3C9D4E' },
]

/** Agents outside the roster: Claude Code's Explore scout, and everyone else. */
export const EXPLORE: Role = { slug: 'explore', label: 'Explore', emoji: '🔭', color: '#7A7A7A' }
export const OTHER: Role = { slug: 'other', label: 'Agent', emoji: '', color: '#888780' }

/** The roles that hand back a verdict worth showing on their row. */
export const REVIEWERS = new Set(['reviewer-code', 'reviewer-ux', 'reviewer-security'])

const BY_SLUG = new Map(ROLES.map(r => [r.slug, r]))

// Variation selectors and spaces differ between how an emoji is typed and stored.
const bare = (s: string): string => s.replace(/[︎️\s]/g, '')

/** The role whose emoji the description starts with, if any. */
export const roleByDescription = (description: string): Role | undefined => {
  const head = bare(description.slice(0, 8))
  return ROLES.find(r => head.startsWith(bare(r.emoji)))
}

/**
 * The role behind a subagent type: `switchboard:reviewer-code`, a bare
 * `reviewer-code`, or a themed name whose listing description the session saw
 * (`known`, from `agent.offer`).
 */
export const roleOf = (type: string, known: Readonly<Record<string, string>> = {}): Role => {
  const slug = type.replace(/^[^:]*:/, '')
  const direct = BY_SLUG.get(slug)
  if (direct !== undefined) return direct
  const fromKnown = known[type] === undefined ? undefined : BY_SLUG.get(known[type])
  if (fromKnown !== undefined) return fromKnown
  return type === 'Explore' ? EXPLORE : OTHER
}

export const roleBySlug = (slug: string): Role => BY_SLUG.get(slug) ?? OTHER

export const isRosterRole = (role: Role): boolean => BY_SLUG.has(role.slug)

/**
 * A reviewer's verdict from its report: the Code and UX Reviewers write
 * `### Verdict: APPROVED | CHANGES REQUESTED | BLOCKED`; the Security Reviewer
 * closes with an overall verdict of clean or blocked. Undefined when none is found.
 */
export const verdictOf = (answer: string): Verdict | undefined => {
  const formal = /verdict\W{0,6}(APPROVED|CHANGES REQUESTED|BLOCKED)\b/i.exec(answer)
  if (formal !== null) {
    const word = (formal[1] ?? '').toUpperCase()
    return word === 'APPROVED' ? 'approved' : word === 'BLOCKED' ? 'blocked' : 'changes'
  }
  const security = /verdict[^\n]{0,40}?\b(clean|blocked)\b/i.exec(answer)
  if (security !== null) return (security[1] ?? '').toLowerCase() === 'clean' ? 'approved' : 'blocked'
  return undefined
}

export const PHASES: readonly Phase[] = ['plan', 'design', 'delegate', 'review', 'close']

// USD per million tokens: input, output, cache read, cache write (5-minute TTL).
// List prices as of 2026-10-06; cache writes at 1.25x input. The panel labels every
// per-agent figure as an estimate; the session total comes from the engine itself.
const PRICES: [RegExp, [number, number, number, number]][] = [
  [/fable|mythos/, [10, 50, 0.25, 12.5]],
  [/opus-5-5/, [4, 20, 0.2, 5]],
  [/opus/, [5, 25, 0.5, 6.25]],
  [/sonnet-4/, [3, 15, 0.3, 3.75]],
  [/sonnet/, [2, 10, 0.2, 2.5]],
  [/haiku-4/, [1, 5, 0.1, 1.25]],
  [/haiku/, [0.1, 0.5, 0.01, 0.125]],
]

export type Usage = {
  input_tokens: number
  output_tokens: number
  cache_read_input_tokens: number
  cache_creation_input_tokens: number
}

const priceOf = (model: string): [number, number, number, number] =>
  PRICES.find(([re]) => re.test(model.toLowerCase()))?.[1] ?? [4, 20, 0.2, 5]

export const costOf = (model: string, u: Partial<Usage>): number => {
  const [i, o, r, w] = priceOf(model)
  return (
    ((u.input_tokens ?? 0) * i +
      (u.output_tokens ?? 0) * o +
      (u.cache_read_input_tokens ?? 0) * r +
      (u.cache_creation_input_tokens ?? 0) * w) /
    1e6
  )
}

export const tokensOf = (u: Partial<Usage>): number =>
  (u.input_tokens ?? 0) + (u.output_tokens ?? 0) + (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0)

export const windowOf = (model: string): number => (/haiku-4/i.test(model) ? 200_000 : 1_000_000)

/** `claude-opus-5-5` reads `Opus 5.5`; an id it cannot read is shown as given. */
export const modelName = (id: string): string => {
  const m = /(fable|mythos|opus|sonnet|haiku)-(\d+)(?:-(\d{1,2})(?!\d))?/i.exec(id)
  const [, family = '', major = '', minor] = m ?? []
  if (family === '') return id.replace(/^claude-/, '').replace(/\[.*\]$/, '') || '-'
  return `${family.charAt(0).toUpperCase()}${family.slice(1).toLowerCase()} ${major}${minor === undefined ? '' : '.' + minor}`
}
