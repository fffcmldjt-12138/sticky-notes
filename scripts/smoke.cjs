const { spawn, spawnSync } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const executable = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve('node_modules/electron/dist/electron.exe')
const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sticky-notes-smoke-'))
const userDataArg = `--user-data-dir=${userDataDir}`
const args = process.argv[2] ? [userDataArg] : ['.', userDataArg]
const gracefulExit = process.env.SMOKE_GRACEFUL_EXIT === '1'
const child = spawn(executable, args, {
  cwd: process.cwd(),
  windowsHide: true,
  env: {
    ...process.env,
    STICKY_NOTES_SMOKE_QUIT: gracefulExit ? '1' : '0'
  }
})

let stderr = ''
child.stderr.on('data', (chunk) => {
  stderr += chunk
})

function cleanup() {
  fs.rmSync(userDataDir, { recursive: true, force: true })
}

if (gracefulExit) {
  const timeout = setTimeout(() => {
    if (child.exitCode === null) {
      spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], {
        windowsHide: true
      })
    }
    cleanup()
    console.error('gracefulExit=false reason=timeout')
    process.exit(1)
  }, 12000)

  child.on('close', (code) => {
    clearTimeout(timeout)
    console.log(`gracefulExit=${code === 0} exitCode=${code} stderrLength=${stderr.length}`)
    if (stderr) console.error(stderr)
    cleanup()
    process.exit(code === 0 && stderr.length === 0 ? 0 : 1)
  })
} else setTimeout(() => {
  const running = child.exitCode === null
  console.log(`running=${running} stderrLength=${stderr.length}`)
  if (stderr) console.error(stderr)

  if (running) {
    spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], {
      windowsHide: true
    })
  }
  cleanup()

  process.exit(running && stderr.length === 0 ? 0 : 1)
}, 8000)
