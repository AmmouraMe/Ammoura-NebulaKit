# CLAUDE.md

Ammoura — multi-tenant eCommerce platform (codenamed Hermes during
development). SvelteKit 2 + TypeScript on Cloudflare Workers, D1 and R2.

Read [`AGENTS.md`](./AGENTS.md) for commands, code standards, and file
structure, and [`.github/copilot-instructions.md`](./.github/copilot-instructions.md)
for architecture patterns, TDD practice, security rules, and quality gates.
This file carries only what must be true on every task.

## Contribution Workflow

Every repository in the **AmmouraMe** organization follows the same four steps —
`Ammoura-Svelte`, `nabu`, `teaser`, and anything added later. Humans and AI
agents work the same way.

1. **Start from an issue, and claim it.** Work is tracked in GitHub Issues.
   Before writing code, take the issue: assign yourself, or comment that you
   are picking it up. This is what stops two people — or two agents — landing
   on the same work.
2. **Work on a branch.** Never commit to `main`. Cut `feature/<short-name>` for
   new work or `fix/<short-name>` for a bug. Include the issue number when it
   helps: `feature/68-code-editor`.
3. **Open a draft PR early.** As soon as there is a first commit, open the pull
   request **as a draft**. Do not wait until the work is done. An early draft
   shows what is in flight, gives CI somewhere to run, and lets reviewers
   comment before the design hardens. Link the issue in the body (`Closes #68`)
   so it closes on merge.
4. **Finish, then mark ready for review.** When the feature or fix is complete
   and the quality gates are green, update the PR description to say what
   actually landed, then take it out of draft and mark it **Ready for review**.

In short: the issue says _what_, the branch holds _how_, the draft PR shows
_progress_, and "ready for review" means _done_.

## Hard rules

- **Never use native browser dialogs.** `prompt()` → `promptStore.show()`,
  `alert()` → `toastStore`, `confirm()` → `confirmStore.show()` (all from
  `$lib/stores/*`). Examples in `.github/copilot-instructions.md`.
- **The dev server is usually already running on port 4236.** Do not start
  another one; use the running instance.
- **Migrations are immutable once merged to `main`, and a number is used
  once.** Add a new numbered migration instead of editing an existing one or
  reusing its number. `npm run check:migrations` enforces both and runs as part
  of `npm run gate`.
- **Every query is tenant-scoped.** Reads and writes go through `locals.siteId`;
  a tenant must never reach another tenant's data.
- Run `npm run lint`, `npm run format` and `npm test` before marking a PR ready.
