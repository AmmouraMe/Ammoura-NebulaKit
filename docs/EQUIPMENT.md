# Equipment: the machines a shop makes products with

A store owner who prints, presses or engraves in-house tells Ammoura which
machines they have. Ammoura knows what each one can do, and checks every
product linked to a machine against it.

## What an owner does

1. **Admin → Settings → Equipment → Add from catalog.** Search the make or
   model ("Epson", "Cricut", "button"), pick it. Its capabilities fill in.
2. **Size-based machines ask which sizes you own.** A button maker with
   interchangeable dies lists every die the model takes; tick the ones on the
   shelf. A mug press lists its mug sizes. A one-size machine ticks itself.
3. **Products → link the products the machine makes.** For a size-based
   machine each product is linked at a size: the 1¼" die makes the 1¼" pins.
   Products whose names point at an owned size ("1.25 inch pin", "2¼" Button",
   "15oz mug") are offered as one-click suggestions.
4. **Capabilities** corrects a machine whose real platen, roll width or
   resolution differs from the catalog, adds a die the catalog does not list,
   or describes a machine that is not in the catalog at all ("Not listed?"
   starts from the kind's typical figures).

The product editor shows the same links from the other side: the shop's
machines, best fit first, each with the reason it cannot make this product.

## The catalog

`src/lib/data/equipmentCatalog.ts` — about 90 models across 17 kinds: DTG,
DTF, sublimation, UV flatbed, eco-solvent print-and-cut, photo, white-toner,
label, vinyl cutters, laser engravers, embroidery machines, heat / mug / hat
presses, button makers, screen-printing presses and 3D printers.

Figures are the manufacturers' published nominal maximums in inches. They are
a starting point, not a promise: a machine's capabilities are **copied** onto
the site's own row when it is added, so editing the catalog never changes a
shop's machine and an owner's correction never touches the catalog.

To add a model, append an `m(...)` entry. The catalog test checks ids are
unique and every entry has a measure (area, media width, build volume or
sizes); the sanitizer test checks every entry survives the API untouched.

Button artwork sizes (`artworkWidthIn`) are the common industry cut sizes for
the printed circle that wraps the shell. They vary slightly by maker — the
template that came with the die is the authority.

## The checks

`src/lib/utils/equipmentFit.ts`, pure and shared by both admin screens.

| Check                                                             | Level   | Example                                    |
| ----------------------------------------------------------------- | ------- | ------------------------------------------ |
| Print area larger than the machine's area (rotation allowed)      | error   | 12" × 16" tee front on a 9" × 9" EasyPress |
| Print area wider than a roll-fed machine's media (length is free) | error   | 40" all-over on a 13" DTF                  |
| Product family the machine does not make                          | error   | a mug press linked to a hoodie             |
| Size not one the machine owns                                     | error   | a 3" pin on a press with only the 1¼" die  |
| No size chosen on a size-based machine                            | warning |                                            |
| Print area asks for more dpi than the machine prints              | warning |                                            |
| No white ink on a DTG, or any sublimation, for garments           | warning | light / white polyester only               |

The product's **family** (garment, mug, paper, sticker, button, hat, hard
good, 3D) comes from its template's `product_type`, or is guessed from its name
when it has no template. An unknown family skips the material check rather
than guessing wrong. DTF film and heat-transfer vinyl count as making
garments, because that is where the press puts them.

**Workflow gaps**: a machine can declare `needs` — DTF, sublimation and
white-toner printers need a heat press (a mug or hat press also counts). The
equipment page shows a banner when an active machine's need is not met.

## Data

Migration `0110_equipment_capabilities.sql`:

- `equipment.kind`, `make`, `model`, `catalog_model_id`, `capabilities` (JSON
  `EquipmentCapabilities`, `src/lib/types/equipmentCapabilities.ts`). A
  pre-existing machine has all of them NULL and works as before.
- `product_equipment.size_id` — the size a product is made at.

Capabilities are untrusted on the way in: `sanitizeCapabilities`
(`src/lib/server/equipment/`) keeps only known fields with sane values. The
product–equipment API checks that both the product and the machine belong to
the site before linking, and that a size is one the machine owns.

## Customer fields

Unchanged: a machine can still define fields customers fill in at checkout
(Manage Fields). The capabilities above are about what the shop can make; the
fields are about what the customer must tell it.

## Not done yet

- The design studio does not yet size its canvas from a linked machine — a
  button product with a 1¼" die could get a 1.625" round canvas with the
  wrap zone shown. The size's `artworkWidthIn` is there for it.
- Orders do not yet say which machine makes each item. A per-machine print
  queue in the order view is the natural next step.
