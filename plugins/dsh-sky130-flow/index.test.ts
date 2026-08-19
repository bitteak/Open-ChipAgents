import { describe, expect, it } from 'vitest'
import { buildFlowArgv, readMetrics, resolveConfig, validateRunTag } from './index.ts'

describe('dsh-sky130-flow helpers', () => {
  it('rejects path-shaped and uppercase run tags', () => {
    expect(() => validateRunTag('../escape')).toThrow(/run_tag/)
    expect(() => validateRunTag('UPPER')).toThrow(/run_tag/)
    expect(validateRunTag('sha256-drc-001')).toBe('sha256-drc-001')
  })

  it('builds a fixed argv without a shell', () => {
    const argv = buildFlowArgv({
      projectRoot: '/project',
      pdkRoot: '/pdk',
      labRoot: '/project/chip-agent-lab',
      designConfig: '/project/chip-agent-lab/designs/sha256/config.yaml',
      inEnv: '/project/chip-agent-lab/bin/in-env',
      simulationScript: '/project/chip-agent-lab/bin/sim-sha256.sh',
      cielRoot: '/project/chip-agent-lab/.cache/pdks',
    }, 'drc', 'sha256-drc-001', 8)
    expect(argv).toContain('Checker.KLayoutDRC')
    expect(argv).toContain('sky130A')
    expect(argv).not.toContain('-c')
  })

  it('returns an empty summary when metrics are not present', () => {
    expect(readMetrics('/definitely/missing/metrics.json')).toEqual({})
  })

  it('derives the portable PDK root from the project root', () => {
    const config = resolveConfig({
      projectRoot: '/project',
      jobs: 8,
      timeoutMs: 21_600_000,
      terminateGraceMs: 5_000,
      maxOutputBytes: 131_072,
      renderTailChars: 12_000,
    })
    expect(config.pdkRoot).toBe('/project/chip-agent-lab/.cache/pdks/ciel')
  })
})
