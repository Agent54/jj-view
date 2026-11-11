# JJ View Standalone

JJ View is also available as a self-contained `jj-view` binary that serves the same source control UI in a browser, with no VS Code required. It is the same program the Antigravity hub runs as a sidecar.

## Running

```bash
jj-view --repo /path/to/repo
```

The daemon prints a URL of the form `http://127.0.0.1:8080/?token=…` and opens it in your default browser.

Every request to the daemon must carry that session token (as the `?token=` query parameter, a `Bearer` header, or the cookie set when the page first loads). Anyone with the URL can read and modify the repository, so treat it like a password.

### Options

| Flag | Default | Description |
|---|---|---|
| `--repo <path>` | `.` | Jujutsu repository to serve. |
| `--host <addr>` | `127.0.0.1` | Address to bind. Binding to a non-loopback address exposes the daemon to your network; the session token is the only gate. |
| `--port <n>` | `8080` | Port to listen on. `0` picks a free port. |
| `--user-data-dir <path>` | _(unset)_ | Directory for settings, UI state and credentials. When unset, settings are read from the platform config file: `$XDG_CONFIG_HOME/jj-view/config.json` or `~/.config/jj-view/config.json` on Linux/macOS, `%APPDATA%\jj-view\config.json` on Windows. |
| `--user-config <file>` | `<user-data-dir>/config.json`, else the platform config file above | Settings JSON file. Keys are the extension's settings, with or without the `jj-view.` prefix (e.g. `"binaryPath"` or `"jj-view.binaryPath"`). |
| `--no-open` | `false` | Do not open a browser on start. |
| `--allowed-origins <list>` | _(empty)_ | Comma-separated extra browser origin hosts to accept, e.g. `ui.example.com,*.proxy.example.com`. A leading `*.` matches subdomains only. Loopback, the bound host and the request `Host` are always accepted, so this is only needed when the UI is reached through a reverse proxy that rewrites `Host`. |
| `--version` | | Print the version and exit. |

## Antigravity

To use JJ View inside Antigravity, register the binary once:

```bash
jj-view install-antigravity-plugin
```

This installs JJ View as an Antigravity plugin with its own Source Control icon, enables it in your Antigravity config, and restarts any copies of the daemon that are already running so the hub picks up the new binary. To open the pane inside a conversation, click **`+`** → **Plugins** → **jj view** in the conversation header (or reload the JJ View tab if it is already open). Run it again whenever you update the binary.

| Flag | Default | Description |
|---|---|---|
| `--config-dir <path>` | `~/.gemini/config` | Antigravity config directory to install into. |
| `--binary-path <path>` | _(the `jj-view` you ran)_ | Binary to register. |
| `--no-restart` | `false` | Leave running daemons alone. |

When the hub launches the daemon it configures it through environment variables (`ANTIGRAVITY_SIDECAR_WEB_PORT`, `ANTIGRAVITY_SIDECAR_UI_TOKEN`, `ANTIGRAVITY_CSRF_TOKEN`) rather than flags; you do not need to set these yourself. In that mode the browser is never opened automatically and the hub, not the daemon, controls which origins may connect.

### AI commit descriptions

The sparkle buttons use the existing Antigravity agent integration. JJ View does
not configure a separate AI provider, model, or API key. A normal standalone
browser session has no agent conversation attached.

To enable it, run `jj-view install-antigravity-plugin` (from this checkout:
`./dist/bin/jj-view install-antigravity-plugin` after `pnpm build:all`). Open JJ View
from **+ → Plugins → jj view** inside an Antigravity conversation. Antigravity's
`agentapi` must be available to the daemon on its `PATH` or at
`~/.gemini/antigravity/bin/agentapi`; registering the plugin does not install that
runtime. The conversation supplies the AI setup already in use.

Hover any mutable commit and click **Generate description with AI**, or use the
sparkle in the Source Control input for the working copy. Each request includes
the repository, exact change and commit IDs, existing description, and that
revision's diff. The agent is asked to verify the target is unchanged and mutable,
then run `jj describe -r <changeId>` without switching the working copy. Immutable
commits have no sparkle action.

`agentapi` sends an asynchronous conversation request, so **Description requested**
does not mean generation is finished. The log updates when the agent applies the
description; check the conversation if it does not. Injected bridges that return
description text directly remain supported: the SCM input receives a draft and
the graph action applies it to the chosen revision. Stale returned text is rejected.
Missing setup, rejected requests, and empty responses are shown as errors instead
of silently leaving the button unchanged. Development mode proxies these requests
through Vite to the existing daemon.

## Code forges

GitHub, GitLab and Gerrit integrations work the same as in the extension, and all forge requests are made by the daemon rather than the browser page.

GitHub and GitLab personal access tokens are kept in the daemon's credential store: `<user-data-dir>/credentials.json` when `--user-data-dir` is set, otherwise `credentials.json` next to the platform config file described above. The page only ever holds the name of the stored token; the daemon attaches the value to outgoing requests and never returns it to the page.

Gerrit requests use the credentials git itself would use for the host, in this order: `git-remote-sso` (Google hosts), the git cookie file (`http.cookiefile`, `$GIT_COOKIES_PATH`, or `~/.gitcookies`), then `git credential fill`. The credential never reaches the page. If `git fetch` against the Gerrit host works from your shell, JJ View is authenticated too.

Outbound daemon requests are limited to HTTPS, plus plain HTTP for loopback hosts.

### Review comments

Commits with review comments show a comment badge in the log. Clicking it opens a **Comments** tab listing every thread for that change grouped by file; a file heading opens its diff. Threads are also rendered inline in single-file and multi-file diffs, anchored to the line the forge reported. From either place you can reply, reply-and-resolve, or toggle a thread's resolved state. Starting a new thread is not yet supported in the web UI.

## Requirements

- **Jujutsu (jj)** on your `PATH`, or a `binaryPath` entry in the settings file. See the [installation guide](https://docs.jj-vcs.dev/latest/install-and-setup).
