# zashboard Codex Rules

## Workspace

Use this repository as-is. Do not reorganize the source tree into `work` and `outputs` unless explicitly requested.

## Finish Upload

At the end of a Codex work session for this project, default to running:

```powershell
D:\CodexWorkspace\projects\zashboard\scripts\codex-finish-upload.ps1
```

This script stages recommended project files, excludes local Codex/workspace files, runs checks, commits changes when needed, and pushes to `ios-style-dashboard-updates`.

Do not run the finish upload script if the user explicitly asks not to upload, only wants analysis, or the current task is intentionally incomplete.

## Excluded Local Files

Do not stage or commit these unless the user explicitly asks:

```text
.agents/
skills-lock.json
WORKSPACE-NOTE.md
```

## Mobile Bottom Dock

The mobile bottom tab bar must remain an independent floating capsule dock. Do not reintroduce a full-width bottom bar, white safe-area mask, body-level teleport, slide wrapper, or page-root bottom padding that visually props up the dock.

For the Proxies page, keep the scroll surface extending behind the dock so cards can pass underneath it. The page root may reserve top padding on mobile, but must not reserve mobile bottom padding for the dock; use scroll-padding-bottom only for scroll/focus behavior.

Before packaging any change that touches layout, routes, Proxies page scrolling, daisyUI dock styles, safe-area handling, or custom backgrounds, verify the dock with a mobile browser screenshot and DOM/CSS metrics. Required evidence: dock shell is fixed and transparent, dock is a 52px floating pill, page-root padding-bottom is 0px on mobile, the scroll surface overlaps the dock, content can pass under the dock, and hit-testing outside the capsule lands on page content rather than a full-width base background mask.
