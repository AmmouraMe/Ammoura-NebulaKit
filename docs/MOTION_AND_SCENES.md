# Motion and Scenes

How a page built in Ammoura moves, and the generative backdrop that goes behind
it. Both are builder features: a tenant reaches all of this from the panel, and
none of it needs a developer.

Related: [RESPONSIVE_DESIGN.md](./RESPONSIVE_DESIGN.md) for the sibling system
this is modelled on, and [COMING_SOON.md](./COMING_SOON.md) for the holding page
that uses both.

## The one rule

**Nothing here ever removes content.**

Every motion rule in `src/lib/styles/motion.css` is nested under
`:root[data-motion-engine='on']`. That attribute is set by an inline script in
`src/app.html`, and only when two things are true: scripting is running, and the
visitor has not asked for reduced motion.

So there are three cases, and all three are correct:

| Visitor        | What happens                                                                                     |
| -------------- | ------------------------------------------------------------------------------------------------ |
| No JavaScript  | The attribute is never set. The stylesheet is inert. The page reads exactly as its markup.       |
| Reduced motion | Same. Content is shown at rest — not hidden, not faded in.                                       |
| Motion allowed | The from-state is in the very first paint, so nothing is painted settled and then snatched back. |

This matters more than it looks. The "from" state of a fade-up is `opacity: 0`,
and an element left in it is an invisible page. Reduced motion means _less
movement_, never _less page_ — on iOS, Reduce Motion is common enough that this
is a real audience, not an edge case.

The engine gate has its own test (`src/lib/utils/motion.test.ts`), which parses
`motion.css` and fails if any unconditional rule escapes it.

## Motion

Three independent effects. A component may carry any combination.

| Effect  | Config key     | What it does                                           |
| ------- | -------------- | ------------------------------------------------------ |
| Reveal  | `motion`       | A one-shot entrance, on scroll or on load              |
| Ambient | `ambient`      | A looping keyframe animation that never ends           |
| Scroll  | `scrollEffect` | Parallax, and a `--scroll-progress` other CSS can read |

Edit them in the builder: select a component → **Advanced** → **Motion**. The
preview tile there runs the real class and the real emitted variables, so it
cannot drift into being a drawing of the motion rather than the motion.

### Reveal presets

`fade`, `fade-up`, `fade-down`, `fade-left`, `fade-right`, `zoom-in`,
`zoom-out`, `blur-in`, `rise`.

Directional names describe where the element comes **from**: `fade-up` starts
below its resting place and rises into it.

Options: trigger (`scroll` or `load`), duration, delay, easing (including a mild
`spring`), travel distance, the fraction that must be showing before a scroll
reveal fires, and whether it replays.

### Stagger

A container with `motion.stagger` adds `index * stagger` ms to each child's own
delay. One number on the parent, and the children arrive in the order they are
read. The children need an entrance of their own for it to show.

### Ambient loops

`float`, `drift`, `pulse`, `breathe`, `sheen`, `spin`, `twinkle`.

Most are written one-way and played back by `animation-direction: alternate` —
half the keyframes, and no jump at the loop point. `spin` is the exception: a
rotation that reverses is a pendulum, so it runs one way and linearly.

`sheen` needs a gradient background on the element to travel across.

### Which effect owns which property

The three can be on one element, so they are kept on properties that compose
instead of overwrite:

| Effect   | Properties                             |
| -------- | -------------------------------------- |
| Reveal   | `opacity`, `transform`, `filter`       |
| Parallax | `translate` (the independent property) |
| Ambient  | whatever its keyframes declare         |

`translate` and `transform` are separate CSS properties and compose cleanly.
Ambient is the one that would genuinely collide — its keyframes usually want
`transform` too — so `motionStyle()` adds the reveal's own duration to the
ambient's delay, holding the loop off until the entrance has landed. An
animation beats a transition, so starting both at once would swallow the reveal.

## Where the code lives

| File                                             | What it is                                                             |
| ------------------------------------------------ | ---------------------------------------------------------------------- |
| `src/lib/utils/motion.ts`                        | Pure functions. Presets, clamping, serialization to `--motion-*` vars. |
| `src/lib/styles/motion.css`                      | The global `.motion` class and the ambient keyframes.                  |
| `src/lib/actions/motion.ts`                      | The only part that touches the DOM: observers and the scroll loop.     |
| `src/lib/components/MotionBox.svelte`            | The wrapper element that carries it.                                   |
| `src/lib/components/builder/MotionEditor.svelte` | The builder panel.                                                     |

`MotionBox` **replaces** the wrapper divs that already existed
(`.component-container` in `PageWithLayout`, `.child-wrapper` in
`FrontendComponentRenderer`) rather than adding another, so motion costs no
extra DOM and needed three edits in two files instead of a wrapper per builtin.

Observers are shared per threshold and scroll tracking is one rAF loop for the
whole page. A hundred revealed components must not be a hundred listeners.

## Scenes

A `scene` is a generative ambient backdrop — the thing a hand-built site has and
a builder normally does not. Add it from the component library (**Layout →
Scene**), then put content inside it to sit over the canvas.

Three variants:

- **stars** — points that twinkle, drift and parallax by depth
- **aurora** — soft coloured blobs moving slowly behind everything
- **grid** — a perspective grid receding to a horizon

The starfield's depth model and wrapping are ported from the version proved on
customperfections.com (`site/src/lib/landing-scene.ts` there). Its constants
survived real phones; the comments in `src/lib/utils/scene.ts` say which.

### Settings

`sceneVariant`, `sceneDensity` (0–100), `sceneSpeed` (0–100),
`scenePointerParallax`, `sceneHeight` (any CSS length), `sceneColors`.

Halfway along each slider is the designed value. Colours default to theme
references only — never a literal hex, because a hardcoded `#ffffff` looks like
sensible starlight until the site is on a light theme.

### What a scene will not do

A backdrop is the component nobody came to look at, so it is the one that costs
least:

- It stops drawing when it scrolls off screen, and when the tab is hidden.
- It caps its own device pixel ratio (2× on mobile, 2.5× elsewhere).
- It never takes a click, drag or text selection from what is over it.
- Under reduced motion it draws **one frame** and stops. A starfield that becomes
  an empty rectangle is not an accommodation, it is a missing component.
- It is **not** `overflow: hidden`. A scene centres its content, so content
  taller than the box overflows in both directions and a clip would cut the top
  off somewhere nobody can scroll to.

### Why it is seeded

The scene uses a seeded PRNG keyed on the component's own id, not
`Math.random`. A tenant placing a headline over a backdrop has to be placing it
over _that_ backdrop — the same one in the builder preview, after a reload, and
on the published page. Two scenes on one page still differ, and a resize
respawns the same sky rather than the next one along.

## Testing

All the maths is pure and tested: `src/lib/utils/motion.test.ts` and
`src/lib/utils/scene.test.ts`. A generative background that can only be checked
by looking at it is a background nobody checks.

`src/lib/components/builtin/Scene.test.ts` stubs the 2D context and pins the
behaviour that matters — that it draws, that reduced motion draws once and
starts no loop, that an off-screen scene stops costing anything.
