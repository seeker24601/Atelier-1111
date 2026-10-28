import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const command = process.platform === 'darwin'
  ? join(root, 'src-tauri/target/release/bundle/macos/Atelier 1111.app/Contents/MacOS/atelier-1111')
  : join(root, 'src-tauri/target/release/atelier-1111.exe')
const result = spawnSync(process.execPath, ['--test', 'mcp/integration.test.js'], {
  cwd: root, stdio: 'inherit', env: { ...process.env, ATELIER_MCP_COMMAND: command },
})
process.exit(result.status ?? 1)
