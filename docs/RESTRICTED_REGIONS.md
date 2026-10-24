# Restricted regions

Ammoura takes no accounts and no orders from places under comprehensive US
sanctions (OFAC), or from Syria, which Stripe still prohibits. Stripe refuses
all of these places.

## The list

The list is in `src/lib/data/restrictedRegions.ts`. That file is the only place
to change it.

- **Whole countries:** Cuba (`CU`), Iran (`IR`), North Korea (`KP`) and Syria
  (`SY`).
- **Parts of Ukraine:** Crimea (`UA-43`), Sevastopol (`UA-40`), Donetsk
  (`UA-14`) and Luhansk (`UA-09`).

Syria is on the list because of Stripe, not OFAC. OFAC ended its Syria
embargo in 2025, and the US dropped Syria as a state sponsor of terrorism on
2026-08-24; only named people (Assad and his associates, Captagon traffickers,
ISIS and al-Qa'ida affiliates) stay sanctioned. Everyday civilian goods can be
shipped there without an export license. Stripe's
[restricted-businesses page](https://stripe.com/legal/restricted-businesses)
still prohibits Syria (checked 2026-10-14), so a payment from there breaks
Stripe's terms. Remove `SY` when Stripe drops it.

Russia and Belarus are not on the list, because they are not under a full
embargo. Stripe does not support them, so a payment from there fails at
Stripe.

Check the list against OFAC's sanctions programs before launch, and again when
OFAC changes them. The file records the date it was last checked.

## Where it is enforced

1. **Where the request comes from.** `hooks.server.ts` reads Cloudflare's
   country and subdivision for the request (`platform.cf`, with the
   `cf-ipcountry` header as the fallback). It refuses these calls with
   **451** from a restricted place:
   - signup (`POST /api/account/signup`);
   - OAuth sign-in and its callback;
   - checkout (`POST /api/checkout/session`);
   - manual orders (`POST /api/orders`).

   Browsing stays open. The routes are in
   `src/lib/server/restricted-regions.ts`.

2. **The addresses on the order.** A VPN gets past the first check, so checkout
   and manual orders also refuse a shipping or billing address in a restricted
   place. For Ukraine the address's state field is read for the region's code
   or name, in Latin and Cyrillic spellings.
3. **The country picker.** `CountrySelect` does not offer the restricted
   countries. This is for the customer only: the server checks either way.

A refusal returns `{ success: false, error }`. The signup and checkout pages
show that message.

## Limits

- An account made before the block, or through a VPN with an address outside
  the list, is not found by this. Screening customers by name against OFAC's
  SDN list is a separate job and is not built.
- In dev there is no `platform.cf`, so the request check does nothing unless a
  `cf-ipcountry` header is sent.
