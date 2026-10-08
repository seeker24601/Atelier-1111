import { cpSync, mkdirSync, rmSync, chmodSync, copyFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const backend = join(root, 'src-tauri', 'backend')
rmSync(backend, { recursive: true, force: true })
mkdirSync(join(backend, 'runtime'), { recursive: true })
for (const path of ['server', 'dist', 'package.json', 'package-lock.json']) {
  cpSync(join(root, path), join(backend, path), { recursive: true })
}
mkdirSync(join(backend, 'scripts'), { recursive: true })
copyFileSync(join(root, 'scripts/desktop-entry.mjs'), join(backend, 'scripts/desktop-entry.mjs'))
const node = join(backend, 'runtime', process.platform === 'win32' ? 'node.exe' : 'node')
copyFileSync(process.execPath, node)
if (process.platform !== 'win32') chmodSync(node, 0o755)
const license = await fetch(`https://raw.githubusercontent.com/nodejs/node/${process.version}/LICENSE`)
if (!license.ok) throw new Error(`Could not obtain the bundled Node license: ${license.status}`)
writeFileSync(join(backend, 'runtime', 'LICENSE'), await license.text())
copyFileSync(join(root, 'LICENSE'), join(backend, 'LICENSE'))
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const install = spawnSync(npm, ['ci', '--omit=dev', '--ignore-scripts'], {
  cwd: backend, stdio: 'inherit', shell: process.platform === 'win32',
})
if (install.status !== 0) process.exit(install.status ?? 1)
