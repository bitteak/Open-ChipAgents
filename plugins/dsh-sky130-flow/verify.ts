import { Context } from '@deepseek-ai/cordis'
import { CallId } from '@deepseek-ai/dsh-llm'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import LocalSubprocessRuntime from '@deepseek-ai/dsh-subprocess-local'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import * as Sky130Flow from './index.ts'

const stage = process.argv[2] ?? 'simulation'
if (!['simulation', 'synthesis', 'pnr', 'drc', 'all'].includes(stage)) {
  throw new Error(`unsupported verification stage: ${stage}`)
}

const ctx = new Context()
const systemPromptFiber = await ctx.plugin(SystemPrompt)
const toolFiber = await ctx.plugin(ToolRuntime)
const subprocessFiber = await ctx.plugin(LocalSubprocessRuntime)
const pdkRoot = process.env.OPEN_CHIPAGENTS_PDK_ROOT
const pluginFiber = await ctx.plugin(Sky130Flow, {
  projectRoot: process.env.OPEN_CHIPAGENTS_ROOT ?? process.cwd(),
  ...(pdkRoot === undefined ? {} : { pdkRoot }),
  jobs: 8,
  timeoutMs: 21_600_000,
  terminateGraceMs: 5_000,
  maxOutputBytes: 131_072,
  renderTailChars: 12_000,
})

try {
  const result = await ctx.tools.execute({
    signal: new AbortController().signal,
    callId: CallId(`sky130-verify-${stage}`),
    name: 'sky130_sha256_flow',
    arguments: { stage },
  })
  console.log(JSON.stringify(result.value ?? { error: result.content }, null, 2))
  const value = result.value as { status?: string } | undefined
  if (result.isError || value?.status !== 'passed') process.exitCode = 1
} finally {
  await pluginFiber.dispose()
  await subprocessFiber.dispose()
  await toolFiber.dispose()
  await systemPromptFiber.dispose()
}
