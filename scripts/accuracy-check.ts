import { execFileSync, spawn } from 'node:child_process'

type AccuracyMismatch = {
  label: string
  font: string
  fontSize: number
  width: number
  actual: number
  predicted: number
  diff: number
  text: string
  diagnosticLines?: string[]
}

type AccuracyReport = {
  status: 'ready' | 'error'
  requestId?: string
  total?: number
  matchCount?: number
  mismatchCount?: number
  mismatches?: AccuracyMismatch[]
  message?: string
}

const port = Number.parseInt(process.env['ACCURACY_CHECK_PORT'] ?? '3210', 10)
const baseUrl = `http://localhost:${port}/accuracy`

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function canReachServer(): Promise<boolean> {
  try {
    const response = await fetch(baseUrl)
    return response.ok
  } catch {
    return false
  }
}

async function waitForServer(): Promise<void> {
  for (let i = 0; i < 200; i++) {
    if (await canReachServer()) return
    await sleep(100)
  }
  throw new Error(`Timed out waiting for local Bun server on ${baseUrl}`)
}

function navigateChrome(url: string): void {
  execFileSync('osascript', [
    '-e',
    'tell application "Google Chrome" to activate',
    '-e',
    'tell application "Google Chrome" to if (count of windows) = 0 then make new window',
    '-e',
    `tell application "Google Chrome" to set URL of active tab of front window to ${JSON.stringify(url)}`,
  ], { encoding: 'utf8' })
}

function readChromeReportText(): string {
  try {
    return execFileSync('osascript', [
      '-e',
      'tell application "Google Chrome" to execute active tab of front window javascript "(() => { const el = document.getElementById(\'accuracy-report\'); return el && el.dataset.ready === \'1\' && el.textContent ? el.textContent : \'\'; })()"',
    ], { encoding: 'utf8' }).trim()
  } catch {
    return ''
  }
}

async function loadChromeReport(url: string, expectedRequestId: string): Promise<AccuracyReport> {
  navigateChrome(url)

  for (let i = 0; i < 1200; i++) {
    await sleep(100)
    const reportJson = readChromeReportText()
    if (reportJson === '' || reportJson === 'null') continue

    const report = JSON.parse(reportJson) as AccuracyReport
    if (report.requestId === expectedRequestId) {
      return report
    }
  }

  throw new Error('Timed out waiting for accuracy report from Chrome')
}

function formatDiff(diff: number): string {
  return `${diff > 0 ? '+' : ''}${Math.round(diff)}px`
}

function printReport(report: AccuracyReport): void {
  if (report.status === 'error') {
    console.log(`error: ${report.message ?? 'unknown error'}`)
    return
  }

  const total = report.total ?? 0
  const matchCount = report.matchCount ?? 0
  const mismatchCount = report.mismatchCount ?? 0
  const pct = total > 0 ? ((matchCount / total) * 100).toFixed(2) : '0.00'
  console.log(`${matchCount}/${total} match (${pct}%) | ${mismatchCount} mismatches`)

  for (const [index, mismatch] of (report.mismatches ?? []).entries()) {
    console.log(
      `${index + 1}. ${mismatch.label} | ${mismatch.fontSize}px ${mismatch.font} | w=${mismatch.width} | actual/predicted ${Math.round(mismatch.actual)}/${Math.round(mismatch.predicted)} | diff ${formatDiff(mismatch.diff)}`,
    )
    if (mismatch.diagnosticLines && mismatch.diagnosticLines.length > 0) {
      for (const line of mismatch.diagnosticLines) {
        console.log(`   ${line}`)
      }
    }
  }
}

let serverProcess: ReturnType<typeof spawn> | null = null

try {
  if (!(await canReachServer())) {
    serverProcess = spawn('/bin/zsh', ['-lc', `bun --port=${port} --no-hmr pages/*.html`], {
      cwd: process.cwd(),
      stdio: 'ignore',
    })
    await waitForServer()
  }

  const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const url = `${baseUrl}?report=1&requestId=${requestId}`
  const report = await loadChromeReport(url, requestId)
  printReport(report)
} finally {
  if (serverProcess !== null) {
    serverProcess.kill('SIGTERM')
  }
}
