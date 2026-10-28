# Agent access with MCP

Atelier-1111 provides image and video generation tools for local desktop agents
through MCP. The tools use your active provider, queue, and gallery.

Open Atelier, then connect your agent with the configuration below. Generation
spends credits with your provider. Deletion permanently removes the selected
file and gallery record. Keep approval enabled for these tools in your agent.

## Desktop installation

Install a desktop build that includes MCP. The existing published v0.3.2 does
not include this interface. The app bundles its MCP server and Node runtime.

Windows command:

```text
C:\Users\YOUR_NAME\AppData\Local\Atelier 1111\atelier-1111.exe
```

macOS command for Apple Silicon and Intel:

```text
/Applications/Atelier 1111.app/Contents/MacOS/atelier-1111
```

Use your actual installation path. Pass `--mcp` as the sole argument.
The agent starts a stdio bridge. The bridge connects to the open app and
discovers its port on each call, including after an app restart.

## Claude Desktop and Cursor

Merge this entry into your client's MCP configuration. Replace the command
with the executable path for your OS. Cursor uses `~/.cursor/mcp.json`.
Claude Desktop exposes its configuration through its developer settings.

```json
{
  "mcpServers": {
    "atelier": {
      "command": "C:\\Users\\YOUR_NAME\\AppData\\Local\\Atelier 1111\\atelier-1111.exe",
      "args": ["--mcp"]
    }
  }
}
```

## Claude Code

```sh
claude mcp add --transport stdio atelier -- "/Applications/Atelier 1111.app/Contents/MacOS/atelier-1111" --mcp
```

On Windows, use the Windows executable path in the same command.

## Codex

Merge this table into `~/.codex/config.toml`, using your executable path:

```toml
[mcp_servers.atelier]
command = 'C:\Users\YOUR_NAME\AppData\Local\Atelier 1111\atelier-1111.exe'
args = ["--mcp"]
```

## Hermes

Merge this entry into `~/.hermes/config.yaml`:

```yaml
mcp_servers:
  atelier:
    command: "/Applications/Atelier 1111.app/Contents/MacOS/atelier-1111"
    args: ["--mcp"]
```

## Source installation

Run `npm ci` and `npm start` in the checkout. Configure your agent with an
absolute Node executable path and an absolute path to `mcp/index.js`:

```json
{
  "mcpServers": {
    "atelier": {
      "command": "C:\\Program Files\\nodejs\\node.exe",
      "args": ["C:\\AI\\Atelier-1111\\mcp\\index.js"],
      "env": { "ATELIER_DATA_DIR": "C:\\AI\\Atelier-1111\\data" }
    }
  }
}
```

On first use, the bridge checks for a running desktop backend, then the source
checkout's `data` directory. It authenticates the connection before selecting it.
The session stays attached to that data directory, including after a restart.
Closing the selected app produces an error instead of switching to another
gallery or provider account. `ATELIER_DATA_DIR` selects a specific instance
without fallback. Run the backend and bridge as the same OS user.

## Tools

| Tool | Operation |
| --- | --- |
| `atelier_status` | Read active and configured providers and storage usage |
| `atelier_list_models` | Search image or video models and read published options |
| `atelier_capabilities` | Read observed parameter support for a model |
| `atelier_generate` | Queue an image or video and return its job ID |
| `atelier_get_job` | Read job status, cost, errors, and saved output records |
| `atelier_list_jobs` | Read recent jobs |
| `atelier_list_gallery` | Search saved media by prompt, model, or kind |
| `atelier_get_media` | Get metadata, a local file path, and an optional raster preview |
| `atelier_select_provider` | Select a configured provider for the app and agents |
| `atelier_delete_media` | Permanently delete one gallery item |

Generation accepts the qualified model ID returned by `atelier_list_models`.
It supports saved image IDs and absolute paths to local PNG, JPEG, or WebP
references. A missing gallery reference fails the job before a provider request.
Parameter options depend on the model; inspect its published
options and observed capabilities. A local file reference is sent to the
selected provider as part of the generation request.

Jobs continue after a tool call returns or an agent disconnects, while
Atelier remains open. Poll `atelier_get_job` until `done` or `error`. If a
generation call loses its response, check the job log before submitting again.

Each backend start writes a private connection descriptor with a random token.
The bridge accepts only loopback addresses and sends that token to a restricted
API. Provider keys remain in Atelier. There are no key-management MCP tools.
The bridge writes only MCP messages to stdout.

## Verification

`npm test` runs SDK-client tests over stdio with an isolated backend and fixture
providers. They exercise queueing, storage, references, image previews, videos,
provider selection, errors, deletion, authentication, and stopped-app handling.
They make no provider requests. Native Mac launcher checks remain required.

Verified on Windows on 2026-10-28: all 125 tests pass. The native launcher check
runs the stdio integration suite through the bundled executable's `--mcp`
launcher and the packaged backend, with fixture provider responses.
The suite confirms an existing MCP session discovers a restarted backend.
Disabling token validation makes the authentication test fail.
The visible app was also checked after an MCP provider change. Its settings
and model controls update through the shared backend without a page reload.

The review of `0ceb036` reproduced three defects: missing gallery references
were dropped before generation, stale desktop descriptors masked a running
source backend, and opening another app could redirect an existing session to
its gallery and keys. Missing-reference behavior also existed in the baseline
`c260b1d`. Reference resolution now fails before a provider call.
Connection discovery checks liveness and keeps the chosen data directory.
Tests also cover the queue limit, disconnection, and remote-descriptor rejection
before any network request. Nine deliberate defects were detected in an isolated
copy, then restored. Native Mac MCP checks and live provider calls remain untested.

System: MCP adapter. It owns protocol schemas, connection discovery, and the
stdio launcher. It delegates generation, provider selection, and gallery
changes to the existing backend. No separate queue or database is created.

Client configuration references:
[Claude Code](https://code.claude.com/docs/en/mcp),
[Cursor](https://docs.cursor.com/context/model-context-protocol),
[Codex](https://developers.openai.com/codex/mcp/),
[Hermes](https://hermes-agent.nousresearch.com/docs/user-guide/features/mcp).
