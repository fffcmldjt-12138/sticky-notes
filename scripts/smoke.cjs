const { spawn, spawnSync } = require('node:child_process')
const path = require('node:path')

const executable = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve('node_modules/electron/dist/electron.exe')
const args = process.argv[2] ? [] : ['.']
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

  process.exit(running && stderr.length === 0 ? 0 : 1)
}, 8000)
