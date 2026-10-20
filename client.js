window.__ModuleLoader__.load({
  id: "dsh-panel-collapse",
  factory(require) {
    const React = require("react");
    const h = React.createElement;

    const NS = "panel-collapse";
    const STORAGE_KEY = "dsh.panel-collapse.collapsed";

    const zh = {
      "action.collapse": "收起全局面板",
      "action.expand": "展开全局面板",
    };

    const en = {
      "action.collapse": "Collapse global panels",
      "action.expand": "Expand global panels",
    };

    // The sidebar renders the global panel rows as a single bare <nav> and wraps
    // them in no slot, so the row group can only be addressed structurally. Every
    // row hosts a `sidebar.panellist` outlet, which gives a locale-independent
    // handle on exactly that nav; the host's own accessible names are kept as a
    // fallback for the one release where the outlet marks are absent.
    const PANEL_GROUP_SELECTORS = [
      'nav:has([data-slot="sidebar.panellist"])',
      'nav[aria-label="全局面板"]',
      'nav[aria-label="Global panels"]',
    ];
    const hideRule = `${PANEL_GROUP_SELECTORS.join(",")}{display:none !important}`;

    // Copied from the sidebar's own footer icon button (28x28, secondary label
    // colour, --dsw-radius-sm, theme-token hover/focus) so the new control sits in
    // the row without looking foreign. Nothing is imported from the host packages;
    // only the public theme tokens are reused.
    const CSS = [
      ".dshpc-btn{box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;flex:none;width:28px;height:28px;margin:0;padding:0;border:none;border-radius:var(--dsw-radius-sm);background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;cursor:pointer}",
      ".dshpc-btn:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}",
      ".dshpc-btn:focus-visible{outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:-2px}",
      ".dshpc-btn.dshpc-rail{border-radius:var(--dsw-radius-md);width:36px;height:36px;color:var(--dsw-alias-label-primary)}",
      ".dshpc-icon{display:block;pointer-events:none}",
    ].join("");

    function readCollapsed() {
      try {
        return window.localStorage.getItem(STORAGE_KEY) === "1";
      } catch (error) {
        return false;
      }
    }

    function writeCollapsed(value) {
      try {
        window.localStorage.setItem(STORAGE_KEY, value ? "1" : "0");
      } catch (error) {
        // Storage can be unavailable; the toggle still works for this session.
      }
    }

    function CollapseGlyph({ size, collapsed }) {
      const body = collapsed
        ? [
            h("path", { key: "a", d: "M4 4.25 8 8.25l4-4" }),
            h("path", { key: "b", d: "M4 9.25 8 13.25l4-4" }),
          ]
        : [
            h("path", { key: "a", d: "M4 11.75 8 7.75l4 4" }),
            h("path", { key: "b", d: "M4 6.75 8 2.75l4 4" }),
          ];
      return h(
        "svg",
        {
          className: "dshpc-icon",
          width: size,
          height: size,
          viewBox: "0 0 16 16",
          fill: "none",
          stroke: "currentColor",
          strokeWidth: 1.5,
          strokeLinecap: "round",
          strokeLinejoin: "round",
          "aria-hidden": "true",
          focusable: "false",
        },
        body,
      );
    }

    function PanelCollapseButton(props) {
      const t = typeof props.t === "function" ? props.t : (key) => key;
      const wide = props.wide !== false;
      const [collapsed, setCollapsed] = React.useState(readCollapsed);

      const toggle = React.useCallback(() => {
        setCollapsed((current) => {
          const next = !current;
          writeCollapsed(next);
          return next;
        });
      }, []);

      const label = collapsed ? t("action.expand") : t("action.collapse");

      return h(
        React.Fragment,
        null,
        h("style", { key: "dshpc" }, CSS),
        collapsed ? h("style", { key: "dshpc-hide" }, hideRule) : null,
        h(
          "button",
          {
            type: "button",
            className: wide ? "dshpc-btn" : "dshpc-btn dshpc-rail",
            "aria-label": label,
            "aria-expanded": !collapsed,
            title: label,
            onClick: toggle,
          },
          h(CollapseGlyph, { size: wide ? 16 : 18, collapsed }),
        ),
      );
    }

    const inject = ["slots", "locale"];

    function apply(ctx) {
      ctx.effect(() => ctx.locale.register(NS, { zh, en }), "panel-collapse: dictionaries");
      ctx.slots.inject("sidebar.footer.action", () =>
        ctx.slots.register(
          { name: "sidebar.footer.action", id: "panel-collapse", order: 40, locale: NS },
          PanelCollapseButton,
        ),
      );
    }

    return { inject, apply };
  },
});
