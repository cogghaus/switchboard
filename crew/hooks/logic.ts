// The crew's bookkeeping, apart from the engine: merging a reported plan, matching runs to
// planned tasks, and deciding what the band shows. Pure, so the tests call it directly.

import type { AgentRun, Flow, PlannedTask } from '../types'
import type { BandModel, Totals } from './draw'
import { isRosterRole, PHASES, roleBySlug } from './roster'

export type ProgressInput = {
  title?: string
  total?: number
  done?: number
  phase?: string
  finished?: boolean
  tasks?: { title?: string; role?: string; after?: number[] }[]
}

export const blank = (): Flow => ({ title: 'Switchboard crew', total: 0, done: 0, phase: 'plan', isFinished: false, tasks: [] })

/** A new title, or a report after the last plan finished, starts a new plan. */
export const isNewFlow = (prev: Flow | null, input: ProgressInput): boolean =>
  prev === null || prev.isFinished || (input.title !== undefined && input.title.trim() !== prev.title)

const cleanTasks = (tasks: ProgressInput['tasks']): PlannedTask[] | undefined =>
  tasks
    ?.filter(t => (t.title ?? '').trim() !== '')
    .map(t => {
      const slug = (t.role ?? '').replace(/^[^:]*:/, '').trim().toLowerCase()
      return {
        title: (t.title ?? '').trim(),
        role: isRosterRole(roleBySlug(slug)) ? slug : '',
        after: (t.after ?? []).filter(n => Number.isInteger(n) && n > 0),
      }
    })

/** A report applied to the plan so far: fields left out keep their value; a new plan starts clean. */
export const merge = (prev: Flow | null, input: ProgressInput): Flow => {
  const base = prev === null || isNewFlow(prev, input) ? blank() : prev
  const tasks = cleanTasks(input.tasks) ?? base.tasks
  const total = Math.max(0, Math.round(input.total ?? (input.tasks === undefined ? base.total : tasks.length)))
  const done = Math.min(total > 0 ? total : Infinity, Math.max(0, Math.round(input.done ?? base.done)))
  const phase = PHASES.find(p => p === input.phase) ?? base.phase
  const title = input.title?.trim()
  return {
    title: title === undefined || title === '' ? base.title : title,
    total,
    done,
    phase: input.finished === true ? 'close' : phase,
    isFinished: input.finished === true,
    tasks,
  }
}

export const norm = (s: string): string => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()

export type Planned = PlannedTask & { n: number }

/** The plan's tasks no run has taken yet: a run takes a task when its description matches the title. */
export const plannedOf = (f: Flow | null, list: readonly AgentRun[]): Planned[] => {
  if (f === null || f.isFinished) return []
  const started = new Set(list.map(a => norm(a.description)))
  return f.tasks.map((t, i) => ({ ...t, n: i + 1 })).filter(t => !started.has(norm(t.title)))
}

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
    const inFlight = Math.max(0, running.length)
    const ratio = f.isFinished ? 1 : f.total > 0 ? f.done / f.total : 0
    const runRatio = f.total > 0 ? Math.min(f.total, f.done + inFlight) / f.total : ratio
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
