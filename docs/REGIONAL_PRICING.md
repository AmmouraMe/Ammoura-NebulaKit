# Regional pricing

A site owner can lower prices for shoppers in countries where money buys more.
The owner turns it on under **Admin → Regional Pricing**
(`/admin/settings/pricing`). It is off by default.

## The index

`src/lib/data/priceLevelIndex.ts` holds a price level ratio for each country.
This ratio is what the same basket of goods costs there compared with the US,
at market exchange rates. 1.0 is US prices, and 0.23 (India) means things cost
about a quarter as much.

The ratio is the World Bank's PPP conversion factor (`PA.NUS.PPP`) divided by
the official exchange rate (`PA.NUS.FCRF`), from the latest year that has both.
The World Bank archived its own ready-made ratio series, so we compute it.

The file is generated. To refresh it, run the script and review the diff before
you commit:

```sh
node scripts/update-price-index.mjs
```

## The math

All the math is in `src/lib/utils/regionalPricing.ts`. Each value below is a
setting the owner chooses.

- **Strength** (0–100%) is how much of the gap to US prices is passed on. At
  50%, a country at 40% of US prices gets 30% off: half of the 60% gap.
- **Largest discount** (0–90%) is the floor. No price goes below
  `1 − maxDiscount` of the base price.
- **Overrides** let the owner set the discount for one country by hand. An
  override wins over the index but is still held to the floor.
- **Scope** is either digital products only (the default) or everything. A
  printed product costs the owner the same to make wherever the buyer lives.
- **Rounding:** multipliers are rounded to 5% steps so that prices stay steady.

Prices only go down. Full price applies in these cases:

- the US;
- a country priced above the US;
- a country with no data;
- a request whose country is unknown.

## Where prices change

The shopper's country comes from Cloudflare (`platform.cf.country`, with the
`cf-ipcountry` header as the fallback). The hook stores it as
`locals.country`, together with the site's settings, which it reads from the
same settings rows it already loads. This adds no extra query.

**Storefront.** Prices are lowered where the server hands products to the
storefront:

- the home page load;
- the product page load;
- `GET /api/products?pricing=shopper` and `GET /api/products/[id]?pricing=shopper`,
  which the builder's product widgets call.

The cart keeps the lowered price. The base price travels as `regularPrice`, and
cards and the product page show it struck through. A notice under the navbar
says what the discount is, unless the owner turned it off.

**Admin.** Admin screens call the product API without `pricing=shopper`, so
they always see base prices. A lowered price can therefore never be saved as
the new base price.

**Checkout.** Checkout (`POST /api/checkout/session`) does not trust the cart.
It compares three countries: the one the connection comes from, the billing
country and the shipping country. It charges the least generous of their
three multipliers. A VPN alone, or a borrowed address alone, does not get a
discount. `repriceCheckout` applies the multiplier to each product the scope
covers.

The Stripe session metadata records `regionalPricing: "IN ×0.6"`, so the owner
can see why an order cost less than the list price.

## Limits

- **Disagreeing countries:** a shopper whose connection and addresses disagree
  sees the regional price in the cart but is charged the base price. Stripe's
  page shows the real amount before they pay.
- **Card country:** the card's issuing country is not checked.
- **Shipping:** shipping prices and free-shipping thresholds are not changed.
- **Manual orders:** `POST /api/orders` (manual orders) takes its totals from
  the request, as it did before. It does not apply regional pricing.
- **Dev:** there is no `platform.cf` in dev. Send a `cf-ipcountry` header to
  try a country.
