import { describe, expect, test } from 'claude-code/testing'

import type { AgentRun } from '../types'
import { COSTUMES, crab } from './crabs'
import { agentSvg, bandSvg, xml } from './draw'
import { bandOf, merge, plannedOf, waveOf } from './logic'
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

describe('hooks', () => {
  for (const surface of ['terminal', 'desktop'] as const) {
    test(`the progress tool draws the band and the crew panel on the ${surface}`, async $ => {
      await $.tool.call({
        tool: 'mcp__switchboard-crew__progress',
        input: { title: 'Ship auth', phase: 'delegate', tasks: [{ title: 'Build API', role: 'developer-backend' }, { title: 'Review it', role: 'reviewer-code', after: [1] }] },
      })
      const band = await $.ui.mount({ plugin: 'switchboard-crew', surface, component: 'AbovePrompt', props: { bodyColumns: 120, hasSurvey: false } })
      expect(await band.find({ key: 'crew-open' })).toBeDefined()
      await band.unmount()
      const pane = await $.ui.mount({ plugin: 'switchboard-crew', surface, component: 'Pane', requestId: 'switchboard-crew', props: { bodyColumns: 60 } })
      expect(await pane.find({ key: 'compact' })).toBeDefined()
      await pane.press({ key: 'compact' })
      expect((await pane.find({ key: 'compact' }))?.text).toBe('Expand')
      await pane.unmount()
    })
  }
})
