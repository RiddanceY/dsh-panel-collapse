// Full static verification for the panel-collapse bundle. Run it from the repo
// root with `node scripts/verify.mjs`. Covers: module parse, factory shape,
// apply() wiring, both locale dictionaries, the rendered tree, the generated CSS
// rule, and — when the bundle is linked into a DSH profile — the install state.
import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import vm from "node:vm";

const pkgDir = new URL("../", import.meta.url);
const read = (name) => readFileSync(new URL(name, pkgDir), "utf8");
const problems = [];
const check = (ok, label, detail) => {
  if (!ok) problems.push(`${label}${detail === undefined ? "" : `: ${detail}`}`);
  console.log(`${ok ? "ok  " : "FAIL"} ${label}${detail === undefined ? "" : ` — ${detail}`}`);
};

// ---- manifest -------------------------------------------------------------
const pkg = JSON.parse(read("package.json"));
check(pkg.name === "dsh-panel-collapse", "package name", pkg.name);
check(pkg.type === "module", "package type", pkg.type);
check(pkg.dsh?.bundle?.patch === "./cordis.patch.yml", "dsh.bundle.patch", pkg.dsh?.bundle?.patch);
check(pkg.dsh?.client?.platform === "web", "dsh.client.platform", pkg.dsh?.client?.platform);
check(pkg.dsh?.client?.immediately === true, "dsh.client.immediately", String(pkg.dsh?.client?.immediately));
check(Array.isArray(pkg.dsh?.client?.inject), "dsh.client.inject is an array", JSON.stringify(pkg.dsh?.client?.inject));
check(!pkg.dsh.client.inject.includes(pkg.name), "dsh.client.inject omits own package");
for (const field of ["index.js", "client.js", "cordis.patch.yml", "icon.svg"]) {
  check(pkg.files.includes(field), `files lists ${field}`);
}
check(pkg.exports?.["./client"] === "./client.js", "exports ./client", pkg.exports?.["./client"]);
check(pkg.exports?.["./icon"] === "./icon.svg", "exports ./icon", pkg.exports?.["./icon"]);

// ---- locale dictionaries --------------------------------------------------
const en = JSON.parse(read("locale/en.json"));
const zh = JSON.parse(read("locale/zh.json"));
for (const [name, dict] of [["en", en], ["zh", zh]]) {
  check(typeof dict.meta?.title === "string" && dict.meta.title.length > 0, `${name} meta.title`, dict.meta?.title);
  check(typeof dict.meta?.description === "string" && dict.meta.description.length > 0, `${name} meta.description`);
}

// ---- patch file -----------------------------------------------------------
const patch = read("cordis.patch.yml");
check(/^- insert:/m.test(patch), "patch has an insert list");
check(patch.includes(`name: '${pkg.name}'`), "patch names the package", pkg.name);
check(patch.includes("- id: panel-collapse"), "patch declares the row id");

// ---- module ---------------------------------------------------------------
let captured = null;
const stubReact = {
  createElement: (type, props, ...children) => ({ type, props: props ?? {}, children }),
  Fragment: Symbol.for("Fragment"),
  // Hooks are inert here: every render is a fresh single call, so the initial
  // state is what the persisted flag yields.
  useState: (init) => [typeof init === "function" ? init() : init, () => {}],
  useCallback: (fn) => fn,
  useMemo: (fn) => fn(),
  useRef: (value) => ({ current: value }),
  useEffect: () => {},
  useLayoutEffect: () => {},
};
const sandbox = {
  window: {
    __ModuleLoader__: { load: (decl) => (captured = decl) },
    localStorage: {
      store: new Map(),
      getItem(k) { return this.store.has(k) ? this.store.get(k) : null; },
      setItem(k, v) { this.store.set(k, String(v)); },
    },
  },
  console,
};
vm.runInNewContext(read("client.js"), sandbox, { filename: "client.js" });
check(captured !== null, "factory captured");
check(captured.id === pkg.name, "module id equals package name", captured.id);

const mod = captured.factory((spec) => {
  if (spec === "react") return stubReact;
  throw new Error(`unexpected require: ${spec}`);
});
check(typeof mod.apply === "function", "exports apply");
check(JSON.stringify(mod.inject) === JSON.stringify(["slots", "locale"]), "exports inject", JSON.stringify(mod.inject));

let dictionary = null;
let slot = null;
let effectDisposed = false;
const ctx = {
  effect(fn, label) {
    const dispose = fn();
    if (typeof dispose === "function") effectDisposed = true;
    console.log(`     effect "${label}" -> ${typeof dispose}`);
  },
  locale: { register(ns, dicts) { dictionary = { ns, dicts }; return () => {}; } },
  slots: {
    inject(key, fn) { console.log(`     slots.inject "${key}"`); fn(); },
    register(options, component) { slot = { options, component }; return () => {}; },
  },
};
mod.apply(ctx);

check(dictionary?.ns === "panel-collapse", "locale namespace", dictionary?.ns);
check(!!dictionary?.dicts?.zh, "locale zh dictionary present");
check(!!dictionary?.dicts?.en, "locale en dictionary present");
const keySets = ["zh", "en"].map((l) => Object.keys(dictionary.dicts[l]).sort());
check(JSON.stringify(keySets[0]) === JSON.stringify(keySets[1]), "zh/en keys match", keySets[0].join(","));
check(effectDisposed, "locale effect returns a disposer");
check(slot?.options?.name === "sidebar.footer.action", "slot name", slot?.options?.name);
check(slot?.options?.id === "panel-collapse", "slot id", slot?.options?.id);
check(typeof slot?.options?.order === "number", "slot order", String(slot?.options?.order));
check(slot?.options?.locale === "panel-collapse", "slot locale", slot?.options?.locale);

// ---- rendered tree --------------------------------------------------------
const flatten = (node, acc = []) => {
  if (node === null || node === undefined || node === false) return acc;
  if (Array.isArray(node)) { node.forEach((child) => flatten(child, acc)); return acc; }
  if (typeof node !== "object") return acc;
  acc.push(node);
  (node.children ?? []).forEach((child) => flatten(child, acc));
  return acc;
};
const wide = flatten(slot.component({ wide: true, t: (k) => `T:${k}` }));
const wideButton = wide.find((n) => n.type === "button");
check(wideButton !== undefined, "renders a button");
check(wideButton?.props?.type === "button", "button type is button", wideButton?.props?.type);
check(wideButton?.props?.["aria-label"] === "T:action.collapse", "wide aria-label", wideButton?.props?.["aria-label"]);
check(wideButton?.props?.["aria-expanded"] === true, "wide aria-expanded", String(wideButton?.props?.["aria-expanded"]));
check(typeof wideButton?.props?.className === "string", "button carries a class", wideButton?.props?.className);
check(!wideButton?.props?.className?.includes("dshpc-rail"), "wide button is not in rail mode");
check(wide.filter((n) => n.type === "style").length === 1, "expanded state emits no hide stylesheet");

const rail = flatten(slot.component({ wide: false, t: (k) => `T:${k}` }));
const railButton = rail.find((n) => n.type === "button");
check(railButton?.props?.className?.includes("dshpc-rail"), "rail mode class", railButton?.props?.className);

// Collapsed state: flipping the persisted flag must hide the panel group.
sandbox.window.localStorage.store.set("dsh.panel-collapse.collapsed", "1");
const collapsed = flatten(slot.component({ wide: true, t: (k) => `T:${k}` }));
const collapsedButton = collapsed.find((n) => n.type === "button");
check(collapsedButton?.props?.["aria-label"] === "T:action.expand", "collapsed aria-label", collapsedButton?.props?.["aria-label"]);
check(collapsedButton?.props?.["aria-expanded"] === false, "collapsed aria-expanded", String(collapsedButton?.props?.["aria-expanded"]));
const css = collapsed.filter((n) => n.type === "style").map((n) => n.children.join("")).join("\n");
check(css.includes("display:none"), "collapsed state emits a hide rule");
check(css.includes("sidebar.panellist"), "hide rule keys off the panellist outlet");
check(css.includes("全局面板") && css.includes("Global panels"), "hide rule covers both sidebar locales");
check(
  !/require\(["']@deepseek-ai\//.test(read("client.js")),
  "client.js requires no host client package",
);

// ---- installed copy (optional) --------------------------------------------
// Only meaningful on a machine that has the bundle linked into a DSH profile.
const profileDir = process.env.DSH_PROFILE_DIR
  ?? `${process.env.USERPROFILE}\\.dsh\\profiles\\desktop`;
const installed = `${profileDir}\\node_modules\\${pkg.name}`;
if (existsSync(installed)) {
  const hash = (file) => createHash("sha256").update(readFileSync(file)).digest("hex");
  const same = hash(new URL("client.js", pkgDir)) === hash(`${installed}\\client.js`);
  check(same, "installed client.js matches the source", same ? "live link" : "STALE COPY — reinstall needed");
  const manifest = JSON.parse(readFileSync(`${profileDir}\\package.json`, "utf8"));
  check(
    JSON.stringify(manifest.dependencies?.[pkg.name] ?? "").includes("link:"),
    "profile dependency is a link",
    manifest.dependencies?.[pkg.name],
  );
  check(manifest.dsh?.profile?.bundles?.includes(pkg.name), "bundle is active in the profile layer stack");
} else {
  console.log(`skip installed-copy checks (not linked into ${profileDir})`);
}

console.log("");
if (problems.length > 0) {
  console.log(`VERIFY FAILED (${problems.length})`);
  problems.forEach((p) => console.log(`  - ${p}`));
  process.exitCode = 1;
} else {
  console.log("VERIFY OK — static checks only; the running UI is not visually verified.");
}
