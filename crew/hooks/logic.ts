// The crew's bookkeeping, apart from the engine: merging a reported plan, tracking each
// subagent's run, matching runs to planned tasks, and deciding what the band shows. Pure,
// so the tests call it directly.

import type { AgentRun, Flow, PlannedTask } from '../types'
import type { BandModel, Totals } from './draw'
import { costOf, isRosterRole, PHASES, roleOf, tokensOf, verdictOf, windowOf, REVIEWERS } from './roster'
import type { Usage } from './roster'

// The `progress` tool is model-callable, so its input is untrusted: every count, list and
// text it carries is bounded here, whatever the schema let through.
export const MAX_TASKS = 50
export const MAX_COUNT = 99
export const MAX_TEXT = 120
export const KEPT_RUNS = 200

export type ProgressInput = {
  title?: unknown
  total?: unknown
  done?: unknown
  phase?: unknown
  finished?: unknown
  tasks?: unknown
}

const text = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() !== '' ? v.trim().slice(0, MAX_TEXT) : undefined)

const count = (v: unknown): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(MAX_COUNT, Math.max(0, Math.round(v))) : undefined

export const blank = (at = 0): Flow => ({ title: 'Switchboard crew', total: 0, done: 0, phase: 'plan', isFinished: false, tasks: [], startedAt: at })

/** A new title, or a titled report after the last plan finished, starts a new plan. */
export const isNewFlow = (prev: Flow | null, input: ProgressInput): boolean => {
  const title = text(input.title)
  if (prev === null) return true
  if (title !== undefined && title !== prev.title) return true
  return prev.isFinished && title !== undefined
}

const cleanTasks = (tasks: unknown, known: Readonly<Record<string, string>>): PlannedTask[] | undefined => {
  if (!Array.isArray(tasks)) return undefined
  return tasks
    .slice(0, MAX_TASKS)
    .filter((t): t is Record<string, unknown> => typeof t === 'object' && t !== null && text((t as Record<string, unknown>).title) !== undefined)
    .map(t => {
      const role = typeof t.role === 'string' ? roleOf(t.role.trim(), known) : undefined
      const after = Array.isArray(t.after) ? t.after.filter((n): n is number => Number.isInteger(n) && n > 0 && n <= MAX_TASKS) : []
      return { title: text(t.title) ?? '', role: role !== undefined && isRosterRole(role) ? role.slug : '', after }
    })
}

/**
 * A report applied to the plan so far: fields left out keep their value; a new plan starts
 * clean. A report after a finish that names no new title changes nothing.
 */
export const merge = (prev: Flow | null, input: ProgressInput, at = 0, known: Readonly<Record<string, string>> = {}): Flow => {
  const isNew = isNewFlow(prev, input)
  if (!isNew && prev !== null && prev.isFinished) return prev
  const base = isNew || prev === null ? blank(at) : prev
  const tasks = cleanTasks(input.tasks, known) ?? base.tasks
  const total = count(input.total) ?? (Array.isArray(input.tasks) ? tasks.length : base.total)
  const done = Math.min(total > 0 ? total : MAX_COUNT, count(input.done) ?? base.done)
  const phase = PHASES.find(p => p === input.phase) ?? base.phase
  const isFinished = input.finished === true
  return {
    title: text(input.title) ?? base.title,
    total,
    done,
    phase: isFinished ? 'close' : phase,
    isFinished,
    tasks,
    startedAt: base.startedAt,
  }
}

export const norm = (s: string): string => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()

export type Planned = PlannedTask & { n: number }

/**
 * The plan's tasks no run has taken yet: a run of this plan (started since it began, and
 * not failed) takes the task whose title matches its description.
 */
export const plannedOf = (f: Flow | null, list: readonly AgentRun[]): Planned[] => {
  if (f === null || f.isFinished) return []
  const started = new Set(list.filter(a => a.startedAt >= f.startedAt && a.status !== 'failed').map(a => norm(a.description)))
  return f.tasks.map((t, i) => ({ ...t, n: i + 1 })).filter(t => !started.has(norm(t.title)))
}

// --- run tracking

export type Spawn = { agentId: string; type: string; role: string; description: string; model: string; at: number }

/** A started subagent joins the list; a second run of the same task counts as a new round. */
export const recordSpawn = (list: readonly AgentRun[], s: Spawn): AgentRun[] => {
  const round = 1 + list.filter(a => s.description !== '' && norm(a.description) === norm(s.description)).length
  const run: AgentRun = {
    id: s.agentId,
    agentId: s.agentId,
    type: s.type,
    role: s.role,
    description: s.description,
    model: s.model,
    status: 'running',
    startedAt: s.at,
    contextTokens: 0,
    contextMax: windowOf(s.model),
    tokens: 0,
    costUsd: 0,
    steps: 0,
    round,
  }
  return [...list.filter(a => a.id !== run.id), run].slice(-KEPT_RUNS)
}

export type StepUsage = Partial<Usage> & { model?: string }

/**
 * One model request of a subagent. A step with no usage (an interrupt, an API error)
 * changes nothing; a step of a run shown finished (a teammate's next turn, a subagent
 * continued by message) puts it back to work.
 */
export const recordStep = (list: readonly AgentRun[], agentId: string, usage: StepUsage | null | undefined, model: string, effort: unknown): AgentRun[] => {
  if (usage == null) return [...list]
  const m = usage.model !== undefined && usage.model !== '' ? usage.model : model
  return list.map(a =>
    a.agentId !== agentId
      ? a
      : {
          ...a,
          model: m,
          effort: typeof effort === 'string' ? effort : a.effort,
          status: 'running',
          endedAt: undefined,
          verdict: a.status === 'running' ? a.verdict : undefined,
          contextTokens: tokensOf(usage),
          contextMax: windowOf(m),
          tokens: a.tokens + tokensOf(usage),
          costUsd: a.costUsd + costOf(m, usage),
          steps: a.steps + 1,
        },
  )
}

export type Completion = { reason: string; answer: string; usage?: StepUsage | null; at: number }

/** A subagent's turn ended: done, stopped by the person, or failed; a reviewer's verdict is read from its report. */
export const recordComplete = (list: readonly AgentRun[], agentId: string, c: Completion): AgentRun[] =>
  list.map(a => {
    if (a.agentId !== agentId) return a
    // A run whose steps went unseen still gets the turn's own sum.
    const fallback = a.steps === 0 && c.usage != null ? c.usage : undefined
    const verdict = REVIEWERS.has(a.role) && c.reason === 'answer' ? verdictOf(c.answer) : undefined
    const model = fallback?.model !== undefined && fallback.model !== '' ? fallback.model : a.model
    return {
      ...a,
      status: c.reason === 'answer' ? 'done' : c.reason === 'aborted' ? 'stopped' : 'failed',
      endedAt: c.at,
      ...(verdict === undefined ? {} : { verdict }),
      ...(fallback === undefined ? {} : { model, tokens: tokensOf(fallback), costUsd: costOf(model, fallback) }),
    }
  })

export const totals = (list: readonly AgentRun[], at: number, sessionUsd: number): Totals => {
  if (list.length === 0) return { cost: 0, tokens: 0, time: 0, sessionUsd }
  const start = Math.min(...list.map(a => a.startedAt))
  const end = Math.max(...list.map(a => a.endedAt ?? Math.max(at, a.startedAt)))
  return {
    cost: list.reduce((s, a) => s + a.costUsd, 0),
    tokens: list.reduce((s, a) => s + a.tokens, 0),
    time: end - start,
    sessionUsd,
  }
}

/**
 * The agents of the wave now under way: those running, and those that finished after
 * the earliest of them started. Empty when nothing runs.
 */
export const waveOf = (list: readonly AgentRun[]): AgentRun[] => {
  const running = list.filter(a => a.status === 'running')
  if (running.length === 0) return []
  const from = Math.min(...running.map(a => a.startedAt))
  return list.filter(a => a.status === 'running' || (a.endedAt ?? 0) >= from)
}

const phaseLabel: Record<string, string> = { plan: 'Plan', design: 'Design', review: 'Review' }

/**
 * What the band shows, or undefined to show nothing. A reported plan drives it while it
 * stands (and once finished, until dismissed); without one it follows the wave of agents
 * at work and goes when the last of them is done.
 */
export const bandOf = (f: Flow | null, list: readonly AgentRun[], role: (a: AgentRun) => BandModel['crew'][number]['role']): BandModel | undefined => {
  const running = list.filter(a => a.status === 'running')
  const crew = running.map(a => ({ role: role(a), isRunning: true }))
  if (f !== null) {
    const ofPlan = running.filter(a => a.startedAt >= f.startedAt).length
    const ratio = f.isFinished ? 1 : f.total > 0 ? f.done / f.total : 0
    const runRatio = f.total > 0 ? Math.min(f.total, f.done + ofPlan) / f.total : ratio
    const label = f.isFinished
      ? 'Done'
      : phaseLabel[f.phase] !== undefined && f.total === 0
        ? (phaseLabel[f.phase] ?? '')
        : `${f.phase === 'review' ? 'Review' : 'Tasks'} ${f.total > 0 ? `${f.done}/${f.total}` : `${running.length} working`}`
    return { title: f.title, label, ratio, runRatio, ticks: f.total, isFinished: f.isFinished, crew }
  }
  const wave = waveOf(list)
  if (wave.length === 0) return undefined
  const done = wave.filter(a => a.status !== 'running').length
  return {
    title: 'Switchboard crew',
    label: `${running.length} working · ${done}/${wave.length} done`,
    ratio: done / wave.length,
    runRatio: 1,
    ticks: wave.length,
    isFinished: false,
    crew,
  }
}

/** The role behind a spawned type, for `recordSpawn`. */
export const spawnRole = (type: string, known: Readonly<Record<string, string>>): string => roleOf(type, known).slug
