// Static smoke test: load the browser module factory with a stub loader and a
// minimal React shim, then assert the module's shape and slot registration.
// This is NOT a rendering verification of the running plugin.
import { readFileSync } from "node:fs";
import vm from "node:vm";

const src = readFileSync(new URL("../client.js", import.meta.url), "utf8");

let captured = null;
const stubReact = {
  createElement: (type, props, ...children) => ({ type, props, children }),
  Fragment: Symbol("Fragment"),
  useState: (init) => [typeof init === "function" ? init() : init, () => {}],
  useCallback: (fn) => fn,
  useMemo: (fn) => fn(),
  useRef: (v) => ({ current: v }),
  useEffect: () => {},
  useLayoutEffect: () => {},
};
const sandbox = {
  window: {
    __ModuleLoader__: {
      load: (decl) => {
        captured = decl;
      },
    },
    localStorage: {
      store: new Map(),
      getItem(k) {
        return this.store.has(k) ? this.store.get(k) : null;
      },
      setItem(k, v) {
        this.store.set(k, String(v));
      },
    },
  },
  document: { querySelector: () => null, createElement: () => ({ dataset: {} }), head: { appendChild() {} } },
  console,
};
vm.runInNewContext(src, sandbox, { filename: "client.js" });

if (!captured) throw new Error("factory was not captured");
if (captured.id !== "dsh-panel-collapse") throw new Error(`bad module id: ${captured.id}`);

const mod = captured.factory((spec) => {
  if (spec === "react") return stubReact;
  throw new Error(`unexpected require: ${spec}`);
});

console.log("module id      :", captured.id);
console.log("exports keys   :", Object.keys(mod).join(", "));
console.log("inject         :", JSON.stringify(mod.inject));

let registered = null;
let dictionary = null;
const ctx = {
  effect(fn, label) {
    const dispose = fn();
    console.log("effect         :", label, "| returns", typeof dispose);
  },
  locale: {
    register(ns, dicts) {
      dictionary = { ns, dicts };
      return () => {};
    },
  },
  slots: {
    inject(slot, fn) {
      console.log("slots.inject   :", slot);
      fn();
    },
    register(options, component) {
      registered = { options, component };
      return () => {};
    },
  },
};

mod.apply(ctx);

console.log("locale ns      :", dictionary.ns);
console.log("locale langs   :", Object.keys(dictionary.dicts).join(", "));
console.log("zh keys        :", Object.keys(dictionary.dicts.zh).join(", "));
console.log("en keys        :", Object.keys(dictionary.dicts.en).join(", "));
console.log("zh/en key diff :", JSON.stringify(Object.keys(dictionary.dicts.zh).filter((k) => !(k in dictionary.dicts.en))));
console.log("slot name      :", registered.options.name);
console.log("slot id        :", registered.options.id);
console.log("slot order     :", registered.options.order);
console.log("slot locale    :", registered.options.locale);

const rendered = registered.component({ wide: true, t: (k) => `T:${k}` });
const flat = [];
const walk = (node) => {
  if (node === null || node === undefined) return;
  if (Array.isArray(node)) return node.forEach(walk);
  if (typeof node !== "object") return;
  flat.push(node);
  if (node.children) node.children.forEach(walk);
};
walk(rendered);
const button = flat.find((n) => n.type === "button");
console.log("button props   :", JSON.stringify({ label: button.props["aria-label"], expanded: button.props["aria-expanded"], cls: button.props.className }));
console.log("styles in tree :", flat.filter((n) => n.type === "style").length);
console.log("SMOKE OK");
