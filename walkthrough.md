# Create and delete Git tags

Right-click a revision in the log and choose **Create Tag...**, enter a name,
and press Enter. The graph refreshes to show the new tag. The command is also
available in the command palette, where it targets the working copy.

The shared command works in the standalone web app and VS Code. It creates
local lightweight tags using `jj tag set`, rejects invalid names, and does not
move existing tags or push tags to remotes.

Right-click a tag badge and choose **Delete Tag** to remove that local tag.
The command palette offers a tag picker, matching the bookmark deletion flow.
Other tags and bookmarks, including bookmarks with the same name, are preserved.

Validation: 47 focused command, payload, and context-menu tests passed, as did
both tag browser tests, type checks, lint, and the production web/server build.
The command tests use real colocated and non-colocated repositories and verify
the underlying Git ref in the colocated case. Browser verification covers the
selected revision, name prompt, refreshed badge, dark/light themes, and deletion
from the tag context menu alongside a same-named bookmark.

A broader browser run passed 99 tests and failed two existing commit-shortcut
tests: they send Control on macOS, while the input handler uses Command.

The browser test regenerates these local artifacts under `test-artifacts/`:

![Tag creation flow](test-artifacts/create-tag.gif)

![Tag shown in the dark theme](test-artifacts/create-tag.png)

![Tag shown in the light theme](test-artifacts/create-tag-light.png)

![Tag context menu with Delete Tag](test-artifacts/delete-tag-menu.png)

## Commit graph interactions

Hover controls have an opaque background and a visible border. New Child,
Edit Commit, and Squash now explain their effects in tooltips on hover or focus.
Abandon is available from the commit context menu, with no hover button or option
to re-enable it there. It runs `jj abandon`, removing the revision and rebasing
its descendants onto its parents, dropping the abandoned revision's changes.

Graph dots share the commit row's selection, multi-selection, context-menu,
and drag behavior. Clickable rows and action buttons use pointer cursors.

Verified with 38 focused unit tests and three browser tests covering the
toolbar, dark/light themes, and dot interactions in aligned and compact layouts.
Type checks, lint, and the production build passed.

![Commit action tooltips](test-artifacts/commit-actions.gif)

![Outlined controls in the dark theme](test-artifacts/commit-actions-pierre-dark-soft.png)

![Outlined controls in the light theme](test-artifacts/commit-actions-pierre-light.png)
