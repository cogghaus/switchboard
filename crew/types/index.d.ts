export type Phase = 'plan' | 'design' | 'delegate' | 'review' | 'close'

/** A reviewer's verdict, read from its report. */
export type Verdict = 'approved' | 'changes' | 'blocked'

export type PlannedTask = {
  title: string
  /** A roster role slug (`developer-backend`), or empty when the plan named none. */
  role: string
  after: number[]
}

/** The plan the orchestrator reported through the `progress` tool. */
export type Flow = {
  title: string
  total: number
  done: number
  phase: Phase
  isFinished: boolean
  tasks: PlannedTask[]
}

export type AgentStatus = 'running' | 'done' | 'failed'

export type AgentRun = {
  id: string
  agentId?: string
  /** The subagent type as spawned: `switchboard:reviewer-code`, `Explore`, ... */
  type: string
  /** The role slug it resolved to: a roster role, `explore` or `other`. */
  role: string
  description: string
  model: string
  effort?: string
  status: AgentStatus
  verdict?: Verdict
  startedAt: number
  endedAt?: number
  contextTokens: number
  contextMax: number
  tokens: number
  costUsd: number
  steps: number
  round: number
}

export type Panel = {
  isCompact: boolean
  isDoneCollapsed: boolean
  /** The flow title the panel last opened itself for, so it opens once per flow. */
  autoOpenedFor: string
}

declare module 'claude-code' {
  interface PluginState {
    'switchboard-crew': {
      flow: Flow | null
      agents: AgentRun[]
      panel: Panel
      now: number
      /** True once the person dismissed the band; a new plan or a new agent shows it again. */
      isBandHidden: boolean
      /** Themed agent types seen in the listing, mapped to their role slug. */
      known: Record<string, string>
      /** The session's cost as the engine totals it, in US dollars; -1 where it keeps none. */
      sessionUsd: number
      version: string
    }
  }
}
