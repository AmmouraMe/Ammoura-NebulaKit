# Fly Evolved

A colour theme for Ammoura, chosen by a fruit fly.

The circuit is a mushroom body taken out of the male CNS connectome (Janelia +
Google Research, CC BY): 2,045 measured Kenyon cells, a measured feedback loop
and 17,985 measured synapses. It was shown two versions of an Ammoura
storefront with identical words and opposite design - one built from this
repo's own tokens, one built the way generated design usually is - rewarded on
the first and punished on the second. Then it was given mutated candidates,
each rendered headless and measured from its pixels, and kept the ones it
approached. These are the colours it arrived at.

Mode: dark. Taught: 'ammoura-good' rewarded and 'ammoura-bad' punished, with the twins given it opposite ways
Generations: 16 x 20 candidates.

## Applying it

    wrangler d1 execute <your-db> --file themes/fly-evolved/insert.sql

`theme.json` is the same thing in the shape of `ColorThemeDefinition`
(`src/lib/types/pages.ts`), if you would rather insert it through the admin.

## Contrast

Every text-bearing pair clears WCAG AA (4.5:1). Worst pair: **4.54:1**.

| pair                          | ratio   | passes AA |
| ----------------------------- | ------- | --------- |
| `text on background`          | 18.39:1 | yes       |
| `text on surface`             | 17.72:1 | yes       |
| `textSecondary on background` | 13.07:1 | yes       |
| `textSecondary on surface`    | 12.60:1 | yes       |
| `primary on background`       | 4.71:1  | yes       |
| `primary on surface`          | 4.54:1  | yes       |
| `secondary on background`     | 6.24:1  | yes       |
| `secondary on surface`        | 6.01:1  | yes       |
| `accent on background`        | 8.94:1  | yes       |
| `accent on surface`           | 8.61:1  | yes       |
| `success on background`       | 7.57:1  | yes       |
| `success on surface`          | 7.29:1  | yes       |
| `warning on background`       | 8.94:1  | yes       |
| `warning on surface`          | 8.61:1  | yes       |
| `error on background`         | 5.10:1  | yes       |
| `error on surface`            | 4.92:1  | yes       |

For comparison, the shipping `vibrant` theme in `migrations/0024_color_themes.sql`
does not: white on `--color-primary` (#ec4899) is 3.53:1, so every primary
button label fails, `success` (#10b981) is 2.54:1 and `warning` (#f59e0b) is
1.85:1. This theme keeps the hues and moves only lightness.

## Regenerating

From the Kenyon repo:

    python evolve.py --reward ammoura-good --punish ammoura-bad
    python ammoura.py --emit
