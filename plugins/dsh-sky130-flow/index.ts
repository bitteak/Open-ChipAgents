import { randomBytes } from 'node:crypto'
import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs'
import { isAbsolute, join } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import Schema from '@deepseek-ai/schemastery'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { SubprocessHandle, SubprocessOutcome } from '@deepseek-ai/dsh-subprocess'
import type {} from '@deepseek-ai/dsh-subprocess'

export const name = 'sky130-sha256-flow'
export const inject = ['tools', 'subprocess']

const DESIGN_NAME = 'SHA256'
const PDK_NAME = 'sky130A'
const RUN_TAG = /^[a-z0-9][a-z0-9._-]{0,63}$/
const STAGE_END = {
  synthesis: 'Yosys.Synthesis',
  pnr: 'OpenROAD.DetailedRouting',
  drc: 'Checker.KLayoutDRC',
} as const

type FlowStage = 'simulation' | 'synthesis' | 'pnr' | 'drc' | 'all'
type PhysicalStage = keyof typeof STAGE_END

export interface Config {
  projectRoot?: string
  pdkRoot?: string
  jobs: number
  timeoutMs: number
  terminateGraceMs: number
  maxOutputBytes: number
  renderTailChars: number
}

export const Config: Schema<Config> = Schema.object({
  projectRoot: Schema.string(),
  pdkRoot: Schema.string(),
  jobs: Schema.number().step(1).min(1).max(32).default(8),
  timeoutMs: Schema.number().step(1).min(60_000).default(21_600_000),
  terminateGraceMs: Schema.number().step(1).min(100).max(60_000).default(5_000),
  maxOutputBytes: Schema.number().step(1).min(4_096).default(131_072),
  renderTailChars: Schema.number().step(1).min(1_024).default(12_000),
})

interface ResolvedConfig extends Omit<Config, 'projectRoot' | 'pdkRoot'> {
  projectRoot: string
  pdkRoot: string
}

interface ValidatedPaths {
  projectRoot: string
  pdkRoot: string
  labRoot: string
  designConfig: string
  inEnv: string
  simulationScript: string
  cielRoot: string
}

interface ProcessFacts {
  exitCode: number | null
  signal: NodeJS.Signals | null
  stdout: string
  stderr: string
  stdoutTruncated: boolean
  stderrTruncated: boolean
  elapsedMs: number
}

interface MetricSummary {
  cellCount?: number
  cellAreaUm2?: number
  setupWnsNs?: number
  holdWnsNs?: number
  routeDrcErrors?: number
  magicDrcErrors?: number
  klayoutDrcErrors?: number
  unmappedCells?: number
}

interface ArtifactSummary {
  simulationLog?: string
  runDir?: string
  flowLog?: string
  metricsJson?: string
  netlist?: string
  odb?: string
  def?: string
  gds?: string
  klayoutGds?: string
}

interface FlowResult {
  status: 'passed' | 'failed'
  requestedStage: FlowStage
  design: typeof DESIGN_NAME
  pdk: typeof PDK_NAME
  runTag?: string
  completedStages: string[]
  elapsedMs: number
  exitCode: number | null
  signal: string | null
  metrics: MetricSummary
  artifacts: ArtifactSummary
  logTail: string
  stdoutTruncated: boolean
  stderrTruncated: boolean
}

function requiredDirectory(path: string, label: string): string {
  if (!isAbsolute(path)) throw new Error(`${label} must be an absolute path: ${path}`)
  let canonical: string
  try {
    canonical = realpathSync(path)
  } catch {
    throw new Error(`${label} does not exist: ${path}`)
  }
  if (!statSync(canonical).isDirectory()) throw new Error(`${label} is not a directory: ${canonical}`)
  return canonical
}

function requiredExecutable(path: string, label: string): string {
  if (!existsSync(path)) throw new Error(`${label} does not exist: ${path}`)
  const stat = statSync(path)
  if (!stat.isFile() || (stat.mode & 0o111) === 0) throw new Error(`${label} is not executable: ${path}`)
  return path
}

export function validatePaths(config: Pick<Config, 'projectRoot' | 'pdkRoot'>): ValidatedPaths {
  if (config.projectRoot === undefined) throw new Error('projectRoot is not configured')
  if (config.pdkRoot === undefined) throw new Error('pdkRoot is not configured')
  const projectRoot = requiredDirectory(config.projectRoot, 'projectRoot')
  const pdkRoot = requiredDirectory(config.pdkRoot, 'pdkRoot')
  const labRoot = requiredDirectory(join(projectRoot, 'chip-agent-lab'), 'chip-agent-lab')
  const designConfig = join(labRoot, 'designs', 'sha256', 'config.yaml')
  const inEnv = requiredExecutable(join(labRoot, 'bin', 'in-env'), 'LibreLane environment launcher')
  const simulationScript = requiredExecutable(join(labRoot, 'bin', 'sim-sha256.sh'), 'simulation script')
  if (!existsSync(designConfig)) throw new Error(`SHA-256 LibreLane config does not exist: ${designConfig}`)

  const cielRoot = join(labRoot, '.cache', 'pdks')
  const cielLink = join(cielRoot, 'ciel')
  let linkedPdk: string
  try {
    linkedPdk = realpathSync(cielLink)
  } catch {
    throw new Error(`PDK compatibility link is missing: ${cielLink} -> ${pdkRoot}`)
  }
  if (linkedPdk !== pdkRoot) {
    throw new Error(`PDK compatibility link points to ${linkedPdk}, expected ${pdkRoot}`)
  }

  return { projectRoot, pdkRoot, labRoot, designConfig, inEnv, simulationScript, cielRoot }
}

export function resolveConfig(config: Config): ResolvedConfig {
  const projectRoot = config.projectRoot
    ?? process.env.OPEN_CHIPAGENTS_ROOT
    ?? process.cwd()
  const pdkRoot = config.pdkRoot
    ?? process.env.OPEN_CHIPAGENTS_PDK_ROOT
    ?? join(projectRoot, 'chip-agent-lab', '.cache', 'pdks', 'ciel')
  return { ...config, projectRoot, pdkRoot }
}

export function validateRunTag(tag: string): string {
  if (!RUN_TAG.test(tag)) {
    throw new Error('run_tag must match [a-z0-9][a-z0-9._-]{0,63}')
  }
  return tag
}

export function createRunTag(stage: PhysicalStage): string {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'z').toLowerCase()
  return `sha256-${stage}-${stamp}-${randomBytes(3).toString('hex')}`
}

export function buildFlowArgv(paths: ValidatedPaths, stage: PhysicalStage, runTag: string, jobs: number): string[] {
  return [
    paths.inEnv,
    'librelane',
    '--pdk-root', paths.cielRoot,
    '--pdk', PDK_NAME,
    '--run-tag', runTag,
    '--to', STAGE_END[stage],
    '--jobs', String(jobs),
    '--condensed',
    '--hide-progress-bar',
    paths.designConfig,
  ]
}

function optionalExisting(path: string): string | undefined {
  return existsSync(path) ? path : undefined
}

function numberMetric(metrics: Record<string, unknown>, key: string): number | undefined {
  const value = metrics[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

export function readMetrics(metricsPath: string): MetricSummary {
  if (!existsSync(metricsPath)) return {}
  const parsed = JSON.parse(readFileSync(metricsPath, 'utf8')) as Record<string, unknown>
  const summary: MetricSummary = {}
  const mapping: Array<[keyof MetricSummary, string]> = [
    ['cellCount', 'design__instance__count'],
    ['cellAreaUm2', 'design__instance__area'],
    ['setupWnsNs', 'timing__setup__wns'],
    ['holdWnsNs', 'timing__hold__wns'],
    ['routeDrcErrors', 'route__drc_errors'],
    ['magicDrcErrors', 'magic__drc_error__count'],
    ['klayoutDrcErrors', 'klayout__drc_error__count'],
    ['unmappedCells', 'design__instance_unmapped__count'],
  ]
  for (const [field, metric] of mapping) {
    const value = numberMetric(parsed, metric)
    if (value !== undefined) summary[field] = value
  }
  return summary
}

export function collectArtifacts(paths: ValidatedPaths, runTag?: string): ArtifactSummary {
  const simulationLog = optionalExisting(join(paths.labRoot, 'runs', 'sha256-rtl-sim', 'simulation.log'))
  const artifacts: ArtifactSummary = {}
  if (simulationLog !== undefined) artifacts.simulationLog = simulationLog
  if (runTag === undefined) return artifacts
  const runDir = join(paths.labRoot, 'designs', 'sha256', 'runs', runTag)
  const final = join(runDir, 'final')
  const candidates: Array<[keyof ArtifactSummary, string]> = [
    ['runDir', runDir],
    ['flowLog', join(runDir, 'flow.log')],
    ['metricsJson', join(final, 'metrics.json')],
    ['netlist', join(final, 'nl', 'SHA256.nl.v')],
    ['odb', join(final, 'odb', 'SHA256.odb')],
    ['def', join(final, 'def', 'SHA256.def')],
    ['gds', join(final, 'gds', 'SHA256.gds')],
    ['klayoutGds', join(final, 'klayout_gds', 'SHA256.klayout.gds')],
  ]
  for (const [field, candidate] of candidates) {
    const present = optionalExisting(candidate)
    if (present !== undefined) artifacts[field] = present
  }
  return artifacts
}

function processLogTail(facts: ProcessFacts, maxChars: number): string {
  const merged = [facts.stdout.trim(), facts.stderr.trim()].filter(Boolean).join('\n--- stderr ---\n')
  return merged.length <= maxChars ? merged : merged.slice(-maxChars)
}

function logicalStages(stage: FlowStage, passed: boolean, metrics: MetricSummary, artifacts: ArtifactSummary): string[] {
  if (stage === 'simulation') return passed ? ['simulation'] : []
  const completed: string[] = []
  if (metrics.cellCount !== undefined && metrics.unmappedCells === 0) completed.push('synthesis')
  if (artifacts.odb !== undefined && artifacts.def !== undefined) completed.push('pnr')
  if (
    metrics.routeDrcErrors === 0
    && metrics.magicDrcErrors === 0
    && metrics.klayoutDrcErrors === 0
  ) completed.push('drc')
  return completed
}

function stagePassed(stage: FlowStage, facts: ProcessFacts, metrics: MetricSummary, artifacts: ArtifactSummary): boolean {
  if (facts.exitCode !== 0 || facts.signal !== null) return false
  if (stage === 'simulation') return facts.stdout.includes('SHA-256 RTL simulation: PASS')
  if (metrics.cellCount === undefined || metrics.unmappedCells !== 0) return false
  if (stage === 'synthesis') return true
  if (artifacts.odb === undefined || artifacts.def === undefined) return false
  if (stage === 'pnr') return true
  return metrics.routeDrcErrors === 0 && metrics.magicDrcErrors === 0 && metrics.klayoutDrcErrors === 0
}

function renderResult(value: FlowResult): string {
  const lines = [
    `SKY130A SHA-256 ${value.requestedStage}: ${value.status.toUpperCase()}`,
    `elapsed_ms: ${String(value.elapsedMs)}`,
    `completed_stages: ${value.completedStages.join(', ') || 'none'}`,
  ]
  if (value.runTag !== undefined) lines.push(`run_tag: ${value.runTag}`)
  for (const [key, metric] of Object.entries(value.metrics)) lines.push(`${key}: ${String(metric)}`)
  for (const [key, path] of Object.entries(value.artifacts)) lines.push(`${key}: ${path}`)
  if (value.status === 'failed' && value.logTail !== '') lines.push(`\nlog_tail:\n${value.logTail}`)
  return lines.join('\n')
}

function abortError(signal: AbortSignal): Error {
  const reason = signal.reason
  const error = reason instanceof Error ? reason : new Error('tool call aborted')
  error.name = 'AbortError'
  return error
}

function makeTool(ctx: Context, config: ResolvedConfig, active: { handle: SubprocessHandle | undefined }) {
  async function runProcess(argv: string[], signal: AbortSignal, cwd: string): Promise<ProcessFacts> {
    const started = Date.now()
    const handle = ctx.subprocess.spawn({
      argv,
      cwd,
      stdio: {
        stdin: 'ignore',
        stdout: { maxBytes: config.maxOutputBytes },
        stderr: { maxBytes: config.maxOutputBytes },
      },
      graceMs: config.terminateGraceMs,
      signal,
    })
    active.handle = handle
    let outcome: SubprocessOutcome
    try {
      outcome = await handle.done
      await handle.waitForExit()
    } finally {
      if (active.handle === handle) active.handle = undefined
    }
    const stdout = handle.collected.stdout?.readFrom(0)
    const stderr = handle.collected.stderr?.readFrom(0)
    if (signal.aborted) throw abortError(signal)
    return {
      exitCode: outcome.exitCode,
      signal: outcome.signal,
      stdout: stdout?.text ?? '',
      stderr: stderr?.text ?? '',
      stdoutTruncated: stdout?.lossy ?? false,
      stderrTruncated: stderr?.lossy ?? false,
      elapsedMs: Date.now() - started,
    }
  }

  return defineTool({
    name: 'sky130_sha256_flow',
    description: '运行固定的 SHA-256/SKY130A 实验：Icarus RTL 仿真、Yosys 综合、OpenROAD PnR、Magic/KLayout DRC。只能选择阶段，不能执行任意命令。',
    parameters: {
      stage: {
        type: 'string',
        enum: ['simulation', 'synthesis', 'pnr', 'drc', 'all'],
        required: true,
        description: 'all 依次运行仿真，并执行 LibreLane 到 DRC；其他值运行到指定阶段。',
      },
      run_tag: {
        type: 'string',
        description: '可选物理实现 run tag；仅允许小写字母、数字、点、下划线、连字符，最长 64。省略则自动生成。',
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          status: { type: 'string', enum: ['passed', 'failed'], required: true },
          requestedStage: { type: 'string', enum: ['simulation', 'synthesis', 'pnr', 'drc', 'all'], required: true },
          design: { type: 'string', const: DESIGN_NAME, required: true },
          pdk: { type: 'string', const: PDK_NAME, required: true },
          runTag: { type: 'string' },
          completedStages: { type: 'array', items: { type: 'string' }, required: true },
          elapsedMs: { type: 'number', required: true },
          exitCode: { oneOf: [{ type: 'integer' }, { type: 'null' }], required: true },
          signal: { oneOf: [{ type: 'string' }, { type: 'null' }], required: true },
          metrics: {
            type: 'object',
            additionalProperties: false,
            required: true,
            properties: {
              cellCount: { type: 'number' },
              cellAreaUm2: { type: 'number' },
              setupWnsNs: { type: 'number' },
              holdWnsNs: { type: 'number' },
              routeDrcErrors: { type: 'number' },
              magicDrcErrors: { type: 'number' },
              klayoutDrcErrors: { type: 'number' },
              unmappedCells: { type: 'number' },
            },
          },
          artifacts: {
            type: 'object',
            additionalProperties: false,
            required: true,
            properties: {
              simulationLog: { type: 'string' },
              runDir: { type: 'string' },
              flowLog: { type: 'string' },
              metricsJson: { type: 'string' },
              netlist: { type: 'string' },
              odb: { type: 'string' },
              def: { type: 'string' },
              gds: { type: 'string' },
              klayoutGds: { type: 'string' },
            },
          },
          logTail: { type: 'string', required: true },
          stdoutTruncated: { type: 'boolean', required: true },
          stderrTruncated: { type: 'boolean', required: true },
        },
      },
      render: (_args, value) => [{ type: 'text', text: renderResult(value as FlowResult) }],
    },
    timeoutMs: config.timeoutMs,
    presentCall(args) {
      return { card: 'generic', title: `SKY130A SHA-256 · ${args.stage}`, kind: 'execute' }
    },
    presentResult(args) {
      return { card: 'generic', title: `SKY130A SHA-256 · ${args.stage}` }
    },
    async execute(args, exec): Promise<FlowResult> {
      const started = Date.now()
      const paths = validatePaths(config)
      const requestedStage = args.stage as FlowStage
      const physicalStage: PhysicalStage | undefined = requestedStage === 'all' ? 'drc'
        : requestedStage === 'simulation' ? undefined
          : requestedStage
      const runTag = physicalStage === undefined
        ? undefined
        : validateRunTag(args.run_tag ?? createRunTag(physicalStage))

      if (runTag !== undefined) {
        const runDir = join(paths.labRoot, 'designs', 'sha256', 'runs', runTag)
        if (existsSync(runDir)) throw new Error(`run tag already exists; choose another: ${runTag}`)
      }

      let simulationFacts: ProcessFacts | undefined
      if (requestedStage === 'simulation' || requestedStage === 'all') {
        simulationFacts = await runProcess([paths.inEnv, paths.simulationScript], exec.signal, paths.projectRoot)
        const simulationPassed = stagePassed('simulation', simulationFacts, {}, collectArtifacts(paths))
        if (!simulationPassed || requestedStage === 'simulation') {
          const artifacts = collectArtifacts(paths)
          return {
            status: simulationPassed ? 'passed' : 'failed',
            requestedStage,
            design: DESIGN_NAME,
            pdk: PDK_NAME,
            completedStages: simulationPassed ? ['simulation'] : [],
            elapsedMs: Date.now() - started,
            exitCode: simulationFacts.exitCode,
            signal: simulationFacts.signal,
            metrics: {},
            artifacts,
            logTail: simulationPassed ? '' : processLogTail(simulationFacts, config.renderTailChars),
            stdoutTruncated: simulationFacts.stdoutTruncated,
            stderrTruncated: simulationFacts.stderrTruncated,
          }
        }
      }

      if (physicalStage === undefined || runTag === undefined) throw new Error('internal stage resolution failed')
      const flowFacts = await runProcess(buildFlowArgv(paths, physicalStage, runTag, config.jobs), exec.signal, paths.projectRoot)
      const artifacts = collectArtifacts(paths, runTag)
      const metrics = readMetrics(join(paths.labRoot, 'designs', 'sha256', 'runs', runTag, 'final', 'metrics.json'))
      const passed = stagePassed(physicalStage, flowFacts, metrics, artifacts)
      const completedStages = logicalStages(physicalStage, passed, metrics, artifacts)
      if (requestedStage === 'all' && simulationFacts !== undefined && stagePassed('simulation', simulationFacts, {}, collectArtifacts(paths))) {
        completedStages.unshift('simulation')
      }

      return {
        status: passed ? 'passed' : 'failed',
        requestedStage,
        design: DESIGN_NAME,
        pdk: PDK_NAME,
        runTag,
        completedStages,
        elapsedMs: Date.now() - started,
        exitCode: flowFacts.exitCode,
        signal: flowFacts.signal,
        metrics,
        artifacts,
        logTail: passed ? '' : processLogTail(flowFacts, config.renderTailChars),
        stdoutTruncated: flowFacts.stdoutTruncated,
        stderrTruncated: flowFacts.stderrTruncated,
      }
    },
  })
}

export function apply(ctx: Context, config: Config): void {
  const resolved = resolveConfig(config)
  const active: { handle: SubprocessHandle | undefined } = { handle: undefined }
  const tool = makeTool(ctx, resolved, active)
  ctx.effect(() => {
    const unregister = ctx.tools.register(tool)
    return async () => {
      unregister()
      const handle = active.handle
      if (handle === undefined) return
      handle.terminate()
      await handle.done.catch(() => undefined)
      await handle.waitForExit()
    }
  })
}
