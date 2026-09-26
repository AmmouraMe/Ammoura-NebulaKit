# The coming-soon gate

Every tenant reaches the stage of having a domain and nothing worth showing on
it. This is the platform's answer: **Settings → Visibility → "Show a coming-soon
page instead of my site"**.

Related: [MOTION_AND_SCENES.md](./MOTION_AND_SCENES.md), which the holding page
is built out of.

## What happens when it is on

Every public page address serves the site's holding page instead, with status
**503**, `Cache-Control: no-store` and `X-Robots-Tag: noindex`.

- **503, not 200.** The site is not live, and saying so is what keeps a search
  engine from indexing a placeholder as the storefront, and what lets an uptime
  check tell "not launched yet" from "launched and broken".
- **No caching.** A holding page cached at an edge outlives the launch that was
  meant to replace it, and the owner cannot flush someone else's CDN.
- **No `Retry-After`.** Nobody knows when the site launches, and a made-up date
  is worse than none.
- **The URL survives.** The holding page is served _in place_, not redirected
  to, so a link someone was given still works: when the gate comes down, their
  reload lands on the page they wanted.

The owner is never gated. Signed in as an admin you always see the real site —
building behind a gate you cannot see past is building blind.

## What stays reachable

The exemption list in `src/lib/server/coming-soon.ts` is **not** a list of
harmless things. It is a list of things that would be actively _broken_ by being
gated, and the difference matters every time someone adds to it.

**The app's own machinery** — `/admin`, `/auth`, `/api`, `/user`, `/account`,
`/_app`. Gating these locks the owner out of the site they are building.

**Assets** — anything whose last path segment ends in a real file extension. The
holding page is built from them, so gating them gates the holding page. The rule
requires the extension to start with a letter, so `/shop/v2.0` is still a page.

**The legal pages** — `/privacy`, `/terms`, and the builtin `/privacy-policy`
and `/terms-of-service` slugs. This is the one that looks wrong and is not.
Setting up any OAuth provider means handing over a privacy policy URL, and the
provider fetches it as an anonymous visitor; Custom Perfections found this when
Facebook refused their app because the URL returned a holding page. Google asks
for the same two, and so does every app store, payment processor and ad platform
anyone will ever apply to.

The deeper reason has nothing to do with Facebook: a privacy policy that cannot
be read without getting past a gate is not a privacy policy. It is the one page
on a site that exists specifically to be read by someone who has not agreed to
anything yet.

Only document `GET`/`HEAD` requests are ever replaced. Answering a `POST` with
HTML would be a lie about what happened.

## The holding page

A **builder page** at `/coming-soon`, seeded from ordinary components — a scene,
a container, a heading, text, a button, with a staggered entrance. Open it in
the builder and rewrite it like any other page.

It is a builder page for two reasons, and the second is the real one:

1. The owner can edit it. The words on their holding page are the first thing
   anyone learns about them, and a placeholder they cannot change is a
   placeholder that says the wrong thing.
2. If the platform's own holding page had to be hand-coded HTML, that would be
   the plainest possible statement that the builder is not finished — which is
   exactly what the dogfooding rule in `plans/frontend-overhaul.md` §2 forbids.

It uses the **minimal** built-in layout, not the site's default. While the gate
is up, every link in the navbar and footer answers 503, so a holding page
wearing them is a page of dead ends. `BuiltinPageDefinition.layoutSlug` is what
attaches it, and the holding page is the only built-in page that sets it.

## Two deliberate biases

**The decision fails open.** Every branch that is not clearly "gate this" serves
the real site, and a settings read that throws leaves the gate _down_. A gate
that errs towards gating takes a live shop offline, which is far worse than one
holding page missed.

**The page is seeded before the gate goes up, never after.** A site whose gate
is up and whose holding page is missing serves a bare 503 to every visitor, and
the owner would have no way to tell from the settings screen that that is what
they had just done.

## Cost

The flag rides on the `site_settings` read that locale resolution already makes
in `src/hooks.server.ts` — one query, two answers. A second query per request
for one boolean would be a tax on every page view of every tenant, forever.

## Where the code lives

| File                                    | What it is                                                               |
| --------------------------------------- | ------------------------------------------------------------------------ |
| `src/lib/server/coming-soon.ts`         | The pure decision: exempt paths, `decideGate`, the response shape.       |
| `src/hooks.server.ts`                   | The gate itself, last in `handle` so it knows whether this is the owner. |
| `src/lib/server/db/site-settings.ts`    | `coming_soon_enabled`, read alongside the locales.                       |
| `src/lib/utils/editor/pageDefaults.ts`  | `getComingSoonPageWidgets()` and the built-in definition.                |
| `src/routes/admin/settings/visibility/` | The toggle.                                                              |

### A note on the implementation

Route resolution happens _before_ `handle` runs, so the URL cannot simply be
rewritten there. The holding page is fetched as an internal sub-request
(`event.fetch`) and rendered through the ordinary page pipeline instead, which is
what keeps it a real builder page — themed, editable, able to use every
component — rather than an HTML string. The sub-request cannot recurse, because
`/coming-soon` is on the exemption list.
