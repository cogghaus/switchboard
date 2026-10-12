// switchboard-crew: the Switchboard roster at work, as costumed crabs.
//
// A band above the prompt follows the plan the orchestrator reports (or, without one,
// the agents at work), and the crew panel (/crew) lists every subagent of the session:
// its role's crab, model, context, estimated cost, time and, for a reviewer, its verdict.
// It only observes: every hook passes the engine's input on unchanged.

import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { AgentRun, Panel } from '../types'
import {
  AGENT_H,
  agentSvg,
  BAND_H,
  bandSvg,
  compactSvg,
  ctxOf,
  DONE,
  AMBER,
  elapsed,
  fmtCost,
  fmtTime,
  fmtTokens,
  headerHeight,
  headerSvg,
  PLANNED_H,
  plannedSvg,
  roleTag,
  VERDICT,
} from './draw'
import { bandOf, isNewFlow, merge, norm, plannedOf, totals } from './logic'
import type { ProgressInput } from './logic'
import { costOf, modelName, REVIEWERS, roleByDescription, roleBySlug, roleOf, tokensOf, verdictOf, windowOf } from './roster'

const PLUGIN = 'switchboard-crew'
const flow = atom({ plugin: 'switchboard-crew', key: 'flow' } as const, null)
const agents = atom({ plugin: 'switchboard-crew', key: 'agents' } as const, [])
const panel = atom({ plugin: 'switchboard-crew', key: 'panel' } as const, { isCompact: false, isDoneCollapsed: false, autoOpenedFor: '' })
const now = atom({ plugin: 'switchboard-crew', key: 'now' } as const, 0)
const isBandHidden = atom({ plugin: 'switchboard-crew', key: 'isBandHidden' } as const, false)
const known = atom({ plugin: 'switchboard-crew', key: 'known' } as const, {})
const sessionUsd = atom({ plugin: 'switchboard-crew', key: 'sessionUsd' } as const, -1)
const version = atom({ plugin: 'switchboard-crew', key: 'version' } as const, '')

const PROGRESS = `mcp__${PLUGIN}__progress`
const PANE = 'switchboard-crew'
const KEPT_RUNS = 200

// Opens the crew pane, or closes it when it is up. Says what happened, including why an
// opened pane waits undrawn (a narrow terminal, or a surface that places no panes).
async function togglePane($: EngineInterface): Promise<string> {
  const isOpen = (await $.ui.panes()).some(p => p.id === PANE)
  if (isOpen) {
    await $.ui.close({ id: PANE })
    return 'Crew panel closed.'
  }
  const at = await $.clock.now()
  await update($, now, () => at)
  const opened = await $.ui.open({ id: PANE, title: 'Crew' })
  return opened.isPlaced ? 'Crew panel opened.' : `Crew panel is open but not drawn here: ${opened.reason}`
}

// Opens the panel once per plan, the first time that plan names its tasks.
async function autoOpen($: EngineInterface, title: string): Promise<void> {
  const p = await read($, panel)
  if (p.autoOpenedFor === title) return
  await update($, panel, prev => ({ ...prev, autoOpenedFor: title }))
  if (!(await $.ui.panes()).some(pane => pane.id === PANE)) void $.ui.open({ id: PANE, title: 'Crew' })
}

async function readVersion($: EngineInterface): Promise<string> {
  try {
    const raw = await $.fs.read(`${$.plugin.root}/.claude-plugin/plugin.json`)
    const parsed: unknown = JSON.parse(typeof raw === 'string' ? raw : '{}')
    const v = typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>).version : undefined
    return typeof v === 'string' ? v : ''
  } catch {
    return ''
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const started = await next(e)
    await $.tool.register({
      name: 'progress',
      description:
        'Report the orchestrator-loop plan to the Switchboard crew band and panel. Call it once the plan is set ' +
        '(title, tasks with their roster role, phase "delegate"), each time a task is accepted after review (done), ' +
        'when switching phase or re-planning (tasks), and once at the end with finished: true. Fields left out keep their value.',
      inputSchema: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Short name of the overall goal, a few words.' },
          total: { type: 'integer', minimum: 0, description: 'Number of planned delegated tasks; defaults to the length of tasks.' },
          done: { type: 'integer', minimum: 0, description: 'Number of tasks accepted after review.' },
          phase: { type: 'string', enum: ['plan', 'design', 'delegate', 'review', 'close'] },
          finished: { type: 'boolean', description: 'True once the work is reported and the loop is closed.' },
          tasks: {
            type: 'array',
            description:
              'The delegated tasks in order, numbered from 1. Each title must equal the Agent tool description the task is delegated with, so runs match their task.',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string', description: 'A few words; reused verbatim as the Agent description.' },
                role: { type: 'string', description: 'The roster role slug, e.g. developer-backend, reviewer-code, loki.' },
                after: { type: 'array', items: { type: 'integer' }, description: 'Numbers of the tasks this one waits for.' },
              },
              required: ['title'],
            },
          },
        },
      },
    })
    await $.command.register({
      name: 'crew',
      description: 'Show or hide the Switchboard crew panel: every subagent with its role, model, context, cost, time and verdict',
    })
    const v = await readVersion($)
    await update($, version, () => v)
    const usage = await $.session.usage().catch(() => undefined)
    if (usage?.cost !== undefined) {
      const usd = usage.cost.usd
      await update($, sessionUsd, () => usd)
    }
    // Ticks the running agents' clocks once a second; quiet when nothing runs.
    $.clock.every(1000, () => {
      void (async () => {
        const list = await read($, agents)
        if (!list.some(a => a.status === 'running')) return
        const at = await $.clock.now()
        await update($, now, () => at)
      })()
    })
    return started
  })

  on('command.run', { command: 'crew' }, async $ => {
    return { text: await togglePane($) }
  })

  // A themed roster renames its agents but keeps each description's leading emoji.
  on('agent.offer', async ($, e, next) => {
    const offered = await next(e)
    const role = roleByDescription(e.description)
    if (role !== undefined && roleOf(e.agent).slug !== role.slug) {
      const map = await read($, known)
      if (map[e.agent] !== role.slug) await update($, known, prev => ({ ...prev, [e.agent]: role.slug }))
    }
    return offered
  })

  on('tool.call', { tool: 'mcp__switchboard-crew__progress' }, async ($, e) => {
    const input = e as unknown as ProgressInput
    const prev = await read($, flow)
    if (isNewFlow(prev, input) && input.title !== undefined) {
      // A new plan starts with a clean list; agents still running stay.
      await update($, agents, list => list.filter(a => a.status === 'running'))
    }
    const next = await update($, flow, p => merge(p, input))
    await update($, isBandHidden, () => false)
    if (next !== null && (input.tasks?.length ?? 0) > 0) await autoOpen($, next.title)
    const f = next ?? merge(null, input)
    return { result: `ok: ${f.isFinished ? 'done' : `${f.done}/${f.total} accepted, phase ${f.phase}`}` }
  })

  on('agent.spawn', async ($, e, next) => {
    const started = await next(e)
    if (started.deny !== undefined) return started
    const at = await $.clock.now()
    const role = roleOf(e.subagentType, await read($, known))
    await update($, agents, list => {
      const round = 1 + list.filter(a => e.description !== '' && norm(a.description) === norm(e.description)).length
      const run: AgentRun = {
        id: started.agentId ?? e.tool_use_id,
        agentId: started.agentId,
        type: e.subagentType,
        role: role.slug,
        description: e.description,
        model: started.model,
        status: 'running',
        startedAt: at,
        contextTokens: 0,
        contextMax: windowOf(started.model),
        tokens: 0,
        costUsd: 0,
        steps: 0,
        round,
      }
      return [...list.filter(a => a.id !== run.id), run].slice(-KEPT_RUNS)
    })
    await update($, now, () => at)
    await update($, isBandHidden, () => false)
    return started
  })

  // Each model request of a subagent: live context, tokens and estimated cost.
  on('turn.step', async function* ($, e, next) {
    const result = yield* next(e)
    const agentId = e.agentId
    const usage = result.usage
    if (agentId === undefined || usage === undefined) return result
    const model = usage.model || e.model
    await update($, agents, list =>
      list.map(a =>
        a.agentId !== agentId
          ? a
          : {
              ...a,
              model,
              effort: typeof e.effort === 'string' ? e.effort : a.effort,
              contextTokens: tokensOf(usage),
              contextMax: windowOf(model),
              tokens: a.tokens + tokensOf(usage),
              costUsd: a.costUsd + costOf(model, usage),
              steps: a.steps + 1,
            },
      ),
    )
    return result
  })

  on('turn.complete', async ($, e, next) => {
    const agentId = e.agentId
    if (agentId !== undefined) {
      const at = await $.clock.now()
      await update($, agents, list =>
        list.map(a => {
          if (a.agentId !== agentId) return a
          // A run whose steps went unseen still gets the turn's own sum.
          const fallback = a.steps === 0 && e.usage !== undefined ? e.usage : undefined
          const verdict = REVIEWERS.has(a.role) ? verdictOf(e.answer) : undefined
          return {
            ...a,
            status: e.reason === 'answer' ? 'done' : 'failed',
            endedAt: at,
            ...(verdict === undefined ? {} : { verdict }),
            ...(fallback === undefined
              ? {}
              : { model: fallback.model || a.model, tokens: tokensOf(fallback), costUsd: costOf(fallback.model || a.model, fallback) }),
          }
        }),
      )
      await update($, now, () => at)
    }
    return next(e)
  })

  on('session.measure', async ($, e, next) => {
    if (e.cost !== undefined) {
      const usd = e.cost.usd
      await update($, sessionUsd, () => usd)
    }
    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const ui = $.ui.resolve(e)
    const { Box, Text, Button } = ui
    const list = await read($, agents)
    const f = await read($, flow)
    const p: Panel = await read($, panel)
    const v = await read($, version)
    const at = Math.max(await read($, now), ...list.map(a => a.startedAt), 0)
    const running = list.filter(a => a.status === 'running').reverse()
    const finished = list.filter(a => a.status !== 'running').reverse()
    const planned = plannedOf(f, list)
    const t = totals(list, at, await read($, sessionUsd))
    const title = f !== null && !f.isFinished ? f.title : 'Switchboard crew'
    const isEmpty = list.length === 0 && planned.length === 0

    const toggleCompact = (
      <Button key="compact" label={p.isCompact ? 'Expand' : 'Collapse'} plain onPress={() => update($, panel, prev => ({ ...prev, isCompact: !prev.isCompact }))} />
    )
    const toggleDone = (
      <Button
        key="done"
        label={`${p.isDoneCollapsed ? '▸' : '▾'} Finished · ${finished.length}`}
        plain
        onPress={() => update($, panel, prev => ({ ...prev, isDoneCollapsed: !prev.isDoneCollapsed }))}
      />
    )
    const summary = `≈${fmtCost(t.cost)} by agents, ${fmtTokens(t.tokens)} tokens, ${fmtTime(t.time)}`

    if (e.surface === 'desktop' && 'Svg' in ui) {
      const { Svg } = ui
      const W = Math.max(240, Math.min(900, (e.props.bodyColumns || 40) * 8 - 8))
      if (p.isCompact) {
        const crew = [
          ...running.map(a => ({ role: roleBySlug(a.role), isRunning: true, isPlanned: false })),
          ...finished.map(a => ({ role: roleBySlug(a.role), isRunning: false, isPlanned: false })),
          ...planned.map(pl => ({ role: roleBySlug(pl.role), isRunning: false, isPlanned: true })),
        ]
        return (
          <Box flexDirection="column" gap={1}>
            <Svg source={compactSvg(W, crew, t)} alt={`${list.length} agents, ${summary}`} width={W} height={32} />
            {toggleCompact}
          </Box>
        )
      }
      return (
        <Box flexDirection="column">
          <Svg source={headerSvg(W, title, v, t)} alt={`${title}: ${summary}`} width={W} height={headerHeight} />
          {toggleCompact}
          {isEmpty && <Text dimColor>No subagents yet.</Text>}
          {running.length > 0 && <Text dimColor>{`Working · ${running.length}`}</Text>}
          {running.map(a => (
            <Svg key={a.id} source={agentSvg(W, a, at)} alt={`${a.description}: ${roleTag(roleBySlug(a.role), a.type)}, ${modelName(a.model)}, working`} width={W} height={AGENT_H} />
          ))}
          {finished.length > 0 && toggleDone}
          {!p.isDoneCollapsed &&
            finished.map(a => (
              <Svg
                key={a.id}
                source={agentSvg(W, a, at)}
                alt={`${a.description}: ${roleTag(roleBySlug(a.role), a.type)}, ${a.status}${a.verdict === undefined ? '' : `, ${VERDICT[a.verdict].text}`}`}
                width={W}
                height={AGENT_H}
              />
            ))}
          {planned.length > 0 && <Text dimColor>{`Planned · ${planned.length}`}</Text>}
          {planned.map(pl => (
            <Svg key={`plan-${pl.n}`} source={plannedSvg(W, pl.n, pl.title, pl.role, pl.after)} alt={`${pl.n}. ${pl.title}: planned`} width={W} height={PLANNED_H} />
          ))}
        </Box>
      )
    }

    // Terminal: the same content in text rows.
    const cols = Math.max(24, e.props.bodyColumns || 40)
    const barW = Math.max(6, Math.min(20, cols - 34))
    const bar = (pct: number) => '█'.repeat(Math.round((barW * pct) / 100)) + '░'.repeat(Math.max(0, barW - Math.round((barW * pct) / 100)))
    const row = (a: AgentRun) => {
      const role = roleBySlug(a.role)
      const ctx = ctxOf(a)
      const model = a.effort === undefined ? modelName(a.model) : `${modelName(a.model)} · ${a.effort}`
      const verdict = a.verdict === undefined ? undefined : VERDICT[a.verdict]
      return (
        <Box key={a.id} flexDirection="column" marginBottom={1}>
          <Box flexDirection="row" gap={1}>
            <Text color={role.color}>{a.status === 'running' ? '●' : a.status === 'done' ? '✓' : '✗'}</Text>
            <Text bold wrap="truncate-end">
              {a.description || a.type}
            </Text>
          </Box>
          <Text wrap="truncate-end">
            {'  '}
            <Text color={role.color}>{roleTag(role, a.type)}</Text>
            <Text dimColor>{` · ${model}${a.round > 1 ? ` · round ${a.round}` : ''}`}</Text>
            {verdict !== undefined && <Text color={verdict.color} bold>{` · ${verdict.text}`}</Text>}
          </Text>
          <Text wrap="truncate-end">
            {'  '}
            <Text color={a.status === 'done' ? role.color : undefined} dimColor={a.status !== 'done'}>
              {bar(a.status === 'done' ? 100 : ctx)}
            </Text>
            <Text dimColor>{` ctx ${ctx}% · ${fmtTokens(a.contextTokens)} ≈${fmtCost(a.costUsd)} ${fmtTime(elapsed(a, at))}`}</Text>
          </Text>
        </Box>
      )
    }
    return (
      <Box flexDirection="column">
        <Box flexDirection="row" justifyContent="space-between">
          <Text bold wrap="truncate-end">
            {`${title}${v === '' ? '' : `  v${v}`}`}
          </Text>
          {toggleCompact}
        </Box>
        <Text dimColor>{`${summary}${t.sessionUsd >= 0 ? ` · session ${fmtCost(t.sessionUsd)}` : ''}`}</Text>
        {p.isCompact ? (
          <Text wrap="truncate-end">
            {[...running, ...finished].map(a => (
              <Text key={a.id} color={roleBySlug(a.role).color}>
                {`${roleBySlug(a.role).emoji || '●'} `}
              </Text>
            ))}
          </Text>
        ) : (
          <Box flexDirection="column" marginTop={1}>
            {isEmpty && <Text dimColor>No subagents yet.</Text>}
            {running.length > 0 && <Text dimColor>{`Working · ${running.length}`}</Text>}
            {running.map(row)}
            {finished.length > 0 && toggleDone}
            {!p.isDoneCollapsed && finished.map(row)}
            {planned.length > 0 && <Text dimColor>{`Planned · ${planned.length}`}</Text>}
            {planned.map(pl => {
              const role = roleBySlug(pl.role)
              return (
                <Text key={`plan-${pl.n}`} dimColor wrap="truncate-end">
                  {`◷ ${pl.n}. ${pl.title} · ${role.slug === 'other' ? 'unassigned' : `${role.emoji} ${role.label}`}${pl.after.length > 0 ? ` · after ${pl.after.join(', ')}` : ''}`}
                </Text>
              )
            })}
          </Box>
        )}
      </Box>
    )
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || (await read($, isBandHidden))) return next(e)
    const f = await read($, flow)
    const list = await read($, agents)
    const band = bandOf(f, list, a => roleBySlug(a.role))
    if (band === undefined) return next(e)

    const ui = $.ui.resolve(e)
    const { Box, Text, Button } = ui
    const crewSize = list.length + plannedOf(f, list).length
    const crewButton = <Button key="crew-open" label={`×${crewSize}`} plain onPress={() => void togglePane($)} />
    const dismiss = (
      <Button
        key="crew-dismiss"
        label="✕"
        plain
        role="dismiss"
        onPress={async () => {
          await update($, isBandHidden, () => true)
          if (f?.isFinished === true) await update($, flow, () => null)
        }}
      />
    )
    const percent = `${Math.round(band.ratio * 100)}%`

    if ('Svg' in ui) {
      const { Svg } = ui
      const width = Math.max(200, Math.min(1600, (e.props.bodyColumns || 100) * 8 - 96))
      return (
        <Box flexDirection="row" alignItems="center" gap={1}>
          <Svg source={bandSvg(band, width)} alt={`${band.title}: ${band.label}, ${percent}`} width={width} height={BAND_H} />
          {crewButton}
          {dismiss}
        </Box>
      )
    }

    const cols = e.props.bodyColumns
    const titleW = Math.max(8, Math.min(30, band.title.length + 2, Math.floor(cols / 3)))
    const barW = Math.max(6, Math.min(40, cols - titleW - 40))
    const filled = Math.round(barW * band.ratio)
    const color = band.isFinished ? DONE : AMBER
    return (
      <Box flexDirection="row" gap={2}>
        <Box width={titleW} flexShrink={0}>
          <Text color={color}>● </Text>
          <Text wrap="truncate-end">{band.title}</Text>
        </Box>
        <Text color={color}>{'█'.repeat(filled) + '░'.repeat(Math.max(0, barW - filled))}</Text>
        <Text bold>{band.label}</Text>
        <Text dimColor>{percent}</Text>
        <Text>{band.crew.map(m => m.role.emoji || '●').join('')}</Text>
        {crewButton}
        {dismiss}
      </Box>
    )
  })
}
