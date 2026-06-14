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
const child = spawn(executable, args, {
  cwd: process.cwd(),
  windowsHide: true
})

let stderr = ''
child.stderr.on('data', (chunk) => {
  stderr += chunk
})

setTimeout(() => {
  const running = child.exitCode === null
  console.log(`running=${running} stderrLength=${stderr.length}`)
  if (stderr) console.error(stderr)

  if (running) {
    spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], {
      windowsHide: true
    })
  }
  fs.rmSync(userDataDir, { recursive: true, force: true })

  process.exit(running && stderr.length === 0 ? 0 : 1)
}, 8000)
