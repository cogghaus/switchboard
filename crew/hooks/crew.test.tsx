import { describe, expect, mock, test } from 'claude-code/testing'

import type { AgentRun } from '../types'
import { COSTUMES, crab } from './crabs'
import { agentSvg, bandSvg, xml } from './draw'
import { bandOf, MAX_TASKS, MAX_TEXT, merge, plannedOf, recordComplete, recordSpawn, recordStep, waveOf } from './logic'
import { costOf, modelName, roleByDescription, roleBySlug, roleOf, ROLES, verdictOf } from './roster'

const run = (over: Partial<AgentRun>): AgentRun => ({
  id: 'a1',
  agentId: 'a1',
  type: 'switchboard:developer-backend',
  role: 'developer-backend',
  description: 'Build the API',
  model: 'claude-sonnet-5-5',
  status: 'running',
  startedAt: 1000,
  contextTokens: 0,
  contextMax: 1_000_000,
  tokens: 0,
  costUsd: 0,
  steps: 0,
  round: 1,
  ...over,
})

describe('roster', () => {
  test('every role has its own costume', () => {
    for (const r of ROLES) expect(Object.hasOwn(COSTUMES, r.slug)).toBe(true)
    expect(ROLES.length).toBe(14)
  })

  test('a plugin-prefixed, bare or themed type resolves to its role', () => {
    expect(roleOf('switchboard:reviewer-code').slug).toBe('reviewer-code')
    expect(roleOf('loki').slug).toBe('loki')
    expect(roleOf('switchboard:pip-boy', { 'switchboard:pip-boy': 'developer-frontend' }).slug).toBe('developer-frontend')
    expect(roleOf('Explore').slug).toBe('explore')
    expect(roleOf('general-purpose').slug).toBe('other')
  })

  test('a listing description is matched by its leading emoji, with or without the variation selector', () => {
    expect(roleByDescription('⚖️ Use this agent for code review')?.slug).toBe('reviewer-code')
    expect(roleByDescription('⚖ Use this agent for code review')?.slug).toBe('reviewer-code')
    expect(roleByDescription('🛡️ Use this agent when')?.slug).toBe('reviewer-security')
    expect(roleByDescription('Plain description')).toBe(undefined)
  })

  test('reviewer verdicts are read from the house formats', () => {
    expect(verdictOf('findings...\n### Verdict: APPROVED')).toBe('approved')
    expect(verdictOf('### Verdict: CHANGES REQUESTED\n')).toBe('changes')
    expect(verdictOf('**Verdict:** BLOCKED')).toBe('blocked')
    expect(verdictOf('Overall verdict: clean.')).toBe('approved')
    expect(verdictOf('Overall verdict: blocked pending the listed critical fixes')).toBe('blocked')
    expect(verdictOf('no verdict line here')).toBe(undefined)
  })

  test('cost estimates follow the model family and model names read well', () => {
    expect(costOf('claude-opus-5-5', { input_tokens: 1_000_000 })).toBe(4)
    expect(costOf('claude-opus-4-8', { output_tokens: 1_000_000 })).toBe(25)
    expect(costOf('claude-haiku-5-5', { input_tokens: 1_000_000 })).toBe(0.1)
    expect(modelName('claude-sonnet-5-5')).toBe('Sonnet 5.5')
    expect(modelName('claude-fable-5-1')).toBe('Fable 5.1')
  })
})

describe('review findings', () => {
  test('the closing verdict wins over one quoted or stated earlier', () => {
    expect(verdictOf('Round 1 verdict: CHANGES REQUESTED\n...\n### Verdict: APPROVED')).toBe('approved')
    expect(verdictOf('AC: explicit verdict (APPROVED / CHANGES REQUESTED / BLOCKED)\n### Verdict: BLOCKED')).toBe('blocked')
    expect(verdictOf('Overall verdict: not clean; blocked pending fixes')).toBe('blocked')
    expect(verdictOf('Overall verdict: unclean')).toBe('blocked')
  })

  test('untrusted progress input is bounded: counts, lists, texts and non-finite numbers', () => {
    const huge = merge(null, { title: 'x'.repeat(500), total: 1e9, tasks: Array.from({ length: 500 }, (_, i) => ({ title: `t${i}` })) })
    expect(huge.total).toBe(99)
    expect(huge.tasks.length).toBe(MAX_TASKS)
    expect(huge.title.length).toBe(MAX_TEXT)
    const inf = merge(null, { title: 'y', total: JSON.parse('1e400'), done: Number.NaN, tasks: 'nope' })
    expect(inf.total).toBe(0)
    expect(inf.done).toBe(0)
    expect(inf.tasks).toEqual([])
    const svg = bandSvg({ title: 'y', label: 'z', ratio: 0, runRatio: 0, ticks: Number.POSITIVE_INFINITY, isFinished: false, crew: [] }, 400)
    expect(svg.length > 0).toBe(true)
  })

  test('a report after a finish that names no new plan changes nothing', () => {
    const done = merge(merge(null, { title: 'A', tasks: [{ title: 'a' }] }), { finished: true })
    expect(merge(done, { done: 0, phase: 'plan' })).toEqual(done)
    expect(merge(done, { title: '' })).toEqual(done)
    expect(merge(done, { title: 'B' }).title).toBe('B')
  })

  test('a themed role name in the plan resolves through the listing map', () => {
    const f = merge(null, { title: 'T', tasks: [{ title: 'a', role: 'switchboard:pip-boy' }] }, 0, { 'switchboard:pip-boy': 'developer-frontend' })
    expect(f.tasks[0]?.role).toBe('developer-frontend')
  })

  test('a step without usage changes nothing; a step of a finished run puts it back to work', () => {
    const list = recordComplete(recordSpawn([], { agentId: 'r', type: 'switchboard:reviewer-code', role: 'reviewer-code', description: 'Review', model: 'claude-opus-5-5', at: 1 }), 'r', { reason: 'answer', answer: '### Verdict: APPROVED', at: 5 })
    expect(list[0]?.verdict).toBe('approved')
    expect(recordStep(list, 'r', null, 'claude-opus-5-5', undefined)).toEqual(list)
    const again = recordStep(list, 'r', { input_tokens: 10 }, 'claude-opus-5-5', 'high')
    expect(again[0]?.status).toBe('running')
    expect(again[0]?.endedAt).toBe(undefined)
    expect(again[0]?.verdict).toBe(undefined)
  })

  test('an interrupted run reads stopped; a failed run leaves its task planned; earlier runs never take a new plan\'s task', () => {
    const one = recordSpawn([], { agentId: 'a', type: 't', role: 'other', description: 'Build it', model: 'm', at: 1 })
    expect(recordComplete(one, 'a', { reason: 'aborted', answer: '', at: 2 })[0]?.status).toBe('stopped')
    const failed = recordComplete(one, 'a', { reason: 'error', answer: '', at: 2 })
    expect(failed[0]?.status).toBe('failed')
    const plan = merge(null, { title: 'P', tasks: [{ title: 'Build it' }] }, 0)
    expect(plannedOf(plan, failed).length).toBe(1)
    const later = merge(null, { title: 'P2', tasks: [{ title: 'Build it' }] }, 10)
    expect(plannedOf(later, recordComplete(one, 'a', { reason: 'answer', answer: '', at: 2 })).length).toBe(1)
  })
})

describe('plan', () => {
  test('a report merges into the plan; fields left out keep their value', () => {
    const f1 = merge(null, { title: 'Ship auth', phase: 'delegate', tasks: [{ title: 'Build API', role: 'switchboard:developer-backend' }, { title: 'Review', role: 'nonsense', after: [1, -2] }] })
    expect(f1.total).toBe(2)
    expect(f1.tasks[0]?.role).toBe('developer-backend')
    expect(f1.tasks[1]?.role).toBe('')
    expect(f1.tasks[1]?.after).toEqual([1])
    const f2 = merge(f1, { done: 1 })
    expect(f2.title).toBe('Ship auth')
    expect(f2.done).toBe(1)
    expect(merge(f2, { done: 9 }).done).toBe(2)
    expect(merge(f2, { finished: true }).phase).toBe('close')
  })

  test('a new title starts a clean plan', () => {
    const f1 = merge(null, { title: 'One', tasks: [{ title: 'a' }], done: 1 })
    const f2 = merge(f1, { title: 'Two' })
    expect(f2.done).toBe(0)
    expect(f2.tasks).toEqual([])
  })

  test('a run takes the planned task whose title matches its description', () => {
    const f = merge(null, { title: 'X', tasks: [{ title: 'Build the API' }, { title: 'Write docs' }] })
    expect(plannedOf(f, [run({})]).map(p => p.title)).toEqual(['Write docs'])
  })
})

describe('band', () => {
  test('without a plan the band follows the wave of agents at work and goes when they are done', () => {
    const list = [run({ id: 'a', agentId: 'a', startedAt: 10 }), run({ id: 'b', agentId: 'b', status: 'done', startedAt: 12, endedAt: 20 }), run({ id: 'c', agentId: 'c', status: 'done', startedAt: 1, endedAt: 5 })]
    expect(waveOf(list).map(a => a.id)).toEqual(['a', 'b'])
    const band = bandOf(null, list, a => roleBySlug(a.role))
    expect(band?.label).toBe('1 working · 1/2 done')
    expect(band?.crew.length).toBe(1)
    expect(bandOf(null, [run({ status: 'done', endedAt: 5 })], a => roleBySlug(a.role))).toBe(undefined)
  })

  test('a plan drives the band, and a finished one reads Done', () => {
    const f = merge(null, { title: 'Ship', tasks: [{ title: 'a' }, { title: 'b' }], done: 1 })
    expect(bandOf(f, [], a => roleBySlug(a.role))?.label).toBe('Tasks 1/2')
    expect(bandOf(merge(f, { finished: true }), [], a => roleBySlug(a.role))?.label).toBe('Done')
  })
})

describe('drawing', () => {
  test('text from the model is escaped in every drawing', () => {
    expect(xml(`<a href="x">'&'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;')
    const svg = agentSvg(400, run({ description: '<script>alert(1)</script>' }), 2000)
    expect(svg.includes('<script>')).toBe(false)
  })

  test('every costume draws, walking or still', () => {
    for (const r of ROLES) {
      expect(crab(0, 0, r.slug, r.color, false, true).includes(`c-${r.slug} run`)).toBe(true)
    }
  })

  test('the band draws its crew at work', () => {
    const svg = bandSvg({ title: 'Ship', label: 'Tasks 1/2', ratio: 0.5, runRatio: 1, ticks: 2, isFinished: false, crew: [{ role: roleBySlug('loki'), isRunning: true }] }, 600)
    expect(svg.includes('c-loki run')).toBe(true)
  })
})

describe('tracking hooks', () => {
  for (const surface of ['terminal', 'desktop'] as const) {
    test(`a spawned reviewer is tracked to its verdict, and a dismiss holds until the next plan, on the ${surface}`, async ($, on) => {
      mock.clock(on, { now: 1000 })
      on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
        const { Text } = $.ui.resolve(e)
        return <Text>beneath</Text>
      })
      on('agent.spawn', ($, e) => (e.description === 'ghost' ? { model: 'claude-opus-5-5' } : { model: 'claude-opus-5-5', agentId: 'r1' }))
      on('turn.complete', () => ({ text: '' }))
      // A fresh drawing for each look: events raised from outside the drawing redraw it lazily.
      const crewButton = async () => {
        const band = await $.ui.mount({ plugin: 'switchboard-crew', surface, component: 'AbovePrompt', props: { bodyColumns: 120, hasSurvey: false } })
        const found = await band.find({ key: 'crew-open' })
        await band.unmount()
        return found
      }
      await $.agent.spawn({ prompt: 'review', description: 'Review it', subagentType: 'switchboard:reviewer-code' })
      await $.agent.spawn({ prompt: 'none', description: 'ghost', subagentType: 'switchboard:loki' })
      expect((await crewButton())?.text).toBe('×1')
      await $.turn.complete({ agentId: 'r1', reason: 'answer', answer: 'quoted verdict: BLOCKED\n### Verdict: APPROVED', durationMs: 5, isAborted: false, turnId: 't1' })
      expect(await crewButton()).toBe(undefined)
      const pane = await $.ui.mount({ plugin: 'switchboard-crew', surface, component: 'Pane', requestId: 'switchboard-crew', props: { bodyColumns: 80 } })
      expect(JSON.stringify(await pane.drawn())).toMatch(/APPROVED/)
      await pane.unmount()
      await $.tool.call({ tool: 'mcp__switchboard-crew__progress', title: 'Plan A', tasks: [{ title: 'x' }] })
      expect(await crewButton()).toBeDefined()
      const band = await $.ui.mount({ plugin: 'switchboard-crew', surface, component: 'AbovePrompt', props: { bodyColumns: 120, hasSurvey: false } })
      await band.press({ key: 'crew-dismiss' })
      await band.unmount()
      expect(await crewButton()).toBe(undefined)
      await $.tool.call({ tool: 'mcp__switchboard-crew__progress', done: 1 })
      expect(await crewButton()).toBe(undefined)
      await $.tool.call({ tool: 'mcp__switchboard-crew__progress', title: 'Plan B', tasks: [{ title: 'y' }] })
      expect(await crewButton()).toBeDefined()
    })
  }
})

describe('hooks', () => {
  for (const surface of ['terminal', 'desktop'] as const) {
    test(`the progress tool draws the band and the crew panel on the ${surface}`, async ($, on) => {
      mock.clock(on, { now: 1000 })
      // Stands for the engine and the plugins beneath: the band must stack above what they draw.
      on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
        const { Text } = $.ui.resolve(e)
        return <Text key="beneath">another band</Text>
      })
      await $.tool.call({
        tool: 'mcp__switchboard-crew__progress',
        title: 'Ship auth',
        phase: 'delegate',
        tasks: [{ title: 'Build API', role: 'developer-backend' }, { title: 'Review it', role: 'reviewer-code', after: [1] }],
      })
      const band = await $.ui.mount({ plugin: 'switchboard-crew', surface, component: 'AbovePrompt', props: { bodyColumns: 120, hasSurvey: false } })
      expect(await band.find({ key: 'crew-open' })).toBeDefined()
      expect(await band.find({ type: 'Text', text: /another band/ })).toBeDefined()
      await band.unmount()
      const pane = await $.ui.mount({ plugin: 'switchboard-crew', surface, component: 'Pane', requestId: 'switchboard-crew', props: { bodyColumns: 60 } })
      expect(await pane.find({ key: 'compact' })).toBeDefined()
      await pane.press({ key: 'compact' })
      expect((await pane.find({ key: 'compact' }))?.text).toBe('Expand')
      await pane.unmount()
    })
  }
})
