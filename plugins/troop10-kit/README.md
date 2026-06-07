# troop10-kit (Claude Code plugin)

Gives Claude Code agents the Troop 10 RWC shared-stack knowledge so they wire
[`@troop10rwc/kit`](https://github.com/troop10rwc/kit) correctly and build
back-office UI on the design contract.

## Install

```
/plugin marketplace add troop10rwc/kit
/plugin install troop10-kit@troop10rwc
```

## Skills

- **`consume-kit`** — registry auth (GitHub Packages `.npmrc`), install, entry
  CSS import order, and Worker auth wiring (`withAuth` / `requireLeader`).
- **`backoffice-style`** — the design contract: the five interaction models,
  `--t10-*` tokens, and the `@troop10rwc/ui` component catalog.

Both are model-invoked (Claude calls them when relevant); you can also invoke them
explicitly as `/troop10-kit:consume-kit` and `/troop10-kit:backoffice-style`.

## Maintenance

`backoffice-style` mirrors [`packages/ui/STYLE.md`](../../packages/ui/STYLE.md)
(the canonical source). When the design system changes, update both. Bump
`version` here and in `.claude-plugin/marketplace.json` when publishing changes.
