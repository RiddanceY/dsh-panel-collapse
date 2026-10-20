# dsh-panel-collapse

A tiny [DeepSeek Harness](https://github.com/deepseek-ai) plugin that adds one button to the
sidebar footer, next to the settings control, which collapses or expands the **global panel
list** (Plugins, Scheduled tasks, Context insight, Memory, … and any other plugin that
registers a sidebar panel).

Collapsing frees the vertical space the panel rows occupy, so the workspace and session list
gets more room. The state is remembered per browser profile and survives restarts.

![icon](icon.svg)

## Install

> **Not on npm yet.** `npm view dsh-panel-collapse` returns 404, so the registry command below
> fails until the first `npm publish`. Use the source install for now.

### From source (works today)

```bash
git clone https://github.com/RiddanceY/dsh-panel-collapse.git
dsh plugin --profile <your-profile> add "link:/absolute/path/to/dsh-panel-collapse"
```

`link:` makes the profile point at the clone instead of copying it, so `git pull` is enough to
update and there is nothing to reinstall.

### From npm (after the first publish)

```bash
dsh plugin --profile <your-profile> add dsh-panel-collapse
```

Either way, restart the app afterwards — DeepSeek Harness only loads a new client module
generation on startup, so the button will not appear until you relaunch.

To remove it:

```bash
dsh plugin --profile <your-profile> remove dsh-panel-collapse
```

`--profile` must come immediately after `plugin`; `dsh plugin add x --profile y` is rejected
with `required option '--profile' not specified`.

## Usage

The button sits in the sidebar footer, to the right of the existing icon buttons.

- **Expanded** (default) — shows a "collapse" chevron pair; clicking hides the panel list.
- **Collapsed** — shows an "expand" chevron pair; clicking brings the list back.
- In the collapsed (rail) sidebar the button grows to 36×36 to match the host's rail buttons.
- The current state is stored in `localStorage` under `dsh.panel-collapse.collapsed`.

## How it works

The plugin is a client-side bundle only — `index.js` is an empty host half, all the work
happens in `client.js`, which the app loads lazily via `window.__ModuleLoader__`.

1. `apply(ctx)` registers the `panel-collapse` locale namespace (`zh`, `en`) as a context
   effect, so the dictionary is disposed when the plugin unloads.
2. It registers one entry in the `sidebar.footer.action` list slot with `id: "panel-collapse"`
   and `order: 40`, which puts it after the built-in Cordis panel button.
3. The component keeps a boolean in `React.useState`, mirrored into `localStorage`, and
   renders a `<style>` element while collapsed:

   ```css
   nav:has([data-slot="sidebar.panellist"]),
   nav[aria-label="全局面板"],
   nav[aria-label="Global panels"] { display: none !important; }
   ```

   The first selector is the locale-independent one: every panel row hosts a
   `sidebar.panellist` outlet, so the `nav` that contains them is exactly the panel group.
   The other two are a fallback that keys off the host's own accessible names.

No host code is imported, patched or monkey-patched. The button reuses only the public
`--dsw-alias-*` / `--dsw-radius-*` / `--dsw-focus-ring-*` theme tokens, so it follows the
light and dark themes and the sidebar's wide/collapsed states.

## Compatibility

| | |
|---|---|
| DeepSeek Harness | `>=0.2.0-rc.2` |
| Client slots used | `sidebar.footer.action` (list) |
| Runtime dependencies | none (React is taken from the app's module table) |

## Development

The package is plain ESM with no build step. `client.js` is the shipped artifact.

```bash
node --check client.js
node scripts/smoke.mjs    # loads the module with a stub loader + React shim
node scripts/verify.mjs   # full static verification (manifest, locale, slot, render tree)
```

`scripts/verify.mjs` also checks the install state when the package is linked into a profile
(`node_modules/<name>` + `dsh.profile.bundles`); it skips those checks otherwise. Set
`DSH_PROFILE_DIR` to point it at a non-default profile.

These scripts are static checks. They do not prove the button looks right on screen — that
still needs a human looking at the running app.

### Local iteration

```bash
dsh plugin --profile <your-profile> add "link:/absolute/path/to/dsh-panel-collapse"
```

`link:` makes the profile point at this directory instead of copying it, so edits to
`client.js` take effect on the next app restart without reinstalling.

## Known limitations

- The panel group is hidden with CSS, so the host still believes the panels are mounted. That
  is intentional — it keeps the toggle independent of host internals and reversible without a
  reload — but it means the collapse is purely visual.
- The `:has()` selector requires a reasonably modern Chromium, which the desktop app is built
  on. The two `aria-label` fallbacks do not depend on it.
- Collapsing hides *all* rows of the panel list, including rows added by other plugins. That
  is the point of the feature; there is no per-row filtering.

## License

[MIT](LICENSE)
