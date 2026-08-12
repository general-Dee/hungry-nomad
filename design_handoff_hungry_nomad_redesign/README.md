# Handoff: Hungry Nomad — Organic Redesign

## Overview
A visual redesign of the Hungry Nomad (KadunaEats) restaurant ordering app, applied to all six core screens: Home, Menu, Cart, Checkout, Track Order, and Success/Cancel. The redesign moves the app from its current amber/gradient Tailwind look to the **Organic** design system: a warm cream ground, terracotta primary accent, sage secondary accent, Caprasimo display headings over Figtree body text, and heavily rounded (pill/over-rounded) shapes throughout.

## About the Design Files
The bundled file `Hungry Nomad.dc.html` is a **design reference built in HTML/React** — a working prototype showing the intended look, layout, and interaction behavior for every screen, with realistic (but client-side/simulated) state: cart, favorites, filters, checkout, a mock payment sheet, and order tracking. **It is not production code to copy in.** The task is to recreate this design inside the existing `hungry-nomad` Next.js codebase, using its existing stack — Next.js 14 (App Router), Tailwind CSS, React Context (`CartContext`, `FavoritesContext`, `CartDrawerContext`), Supabase, and Paystack — not to port the prototype's HTML/inline-style/local-state approach wholesale. Keep the real data fetching, auth-free checkout flow, Paystack integration, and Supabase queries exactly as they exist today; only the presentation layer (markup, Tailwind classes, design tokens) should change.

## Fidelity
**High-fidelity.** Colors, type, spacing, radii, and component states are final — implement pixel-close using the tokens below, translated into Tailwind config (or CSS variables) rather than hand-picked hex values.

## Screens / Views

### 1. Header / Navigation (all screens)
- Sticky top bar, translucent cream background (`background: color-mix(in srgb, var(--color-bg) 90%, transparent)`) with `backdrop-filter: blur(10px)` and a 1px bottom divider (`--color-divider`).
- Left: wordmark "Hungry" (default ink) + "Nomad" (terracotta `--color-accent`) in Caprasimo, 22px, next to an "Open now" / "Closed now" pill (`.tag.tag-accent-2` style: sage-100 background, sage-800 text, small dot indicator) — computed from real business hours (11:00–21:30 daily).
- Right: Home / Menu / Track order text links (14px, 600 weight; active route in `--color-accent-700`, others in `--color-text`), and a circular cart button (40px, `--color-accent-100` background, terracotta bag icon) with a small terracotta badge showing cart item count when > 0.
- Maps to: `src/components/Header.tsx`, `src/components/OpenStatusBadge.tsx`.

### 2. Home
- **Hero**: two-column layout (1.1fr / 0.9fr). Left: "Kaduna's own" kicker (13px uppercase, accent-700), "Hungry Nomad" Caprasimo H1 (clamp 38–60px), a 46ch subcopy paragraph, and two CTAs — "Explore menu" (`.btn-primary`) and "View specials" (`.btn-secondary`, scrolls to the Signature Dishes section). Right: a washed (desaturated, `.washed` filter), over-rounded (`radius-lg * 2`) hero photo. A soft sage circle (`--color-accent-2-200`, 400px, `border-radius: 50%`) bleeds off the top-right corner behind the content (`z-index: 0`).
- **Category cards** (4, in a `repeat(auto-fit, minmax(220px,1fr))` grid): Fast Food, Regular Dishes, Chinese Cuisine, Ice Cream. Each is a `.card.elev-sm` (26px padding, rounded-lg*1.15, `--shadow-sm`) with a 44px circular icon badge (alternating terracotta-100/sage-100 backgrounds), a Caprasimo title, and a one-line description. Clicking navigates to Menu pre-filtered to that category.
- **Signature Dishes**: sage/surface-tinted full-width band (`--color-surface` background), centered heading + subheading, then a product-card grid (see "Product Card" below) showing the first 3 products.
- Maps to: `src/app/page.tsx`, `src/components/ProductCard.tsx`.

### 3. Menu
- Centered H1 "Our Menu" + subcopy, a 420px-max search input with a leading search icon and `.input` styling (pill radius, `--color-surface` fill), a "Favorites Only" toggle pill (fills terracotta-600 when active), main category pill row (`all/fast_food/regular/chinese/icecream/beverages` — active pill is solid terracotta, inactive is `--color-surface`), and a conditional subcategory pill row (smaller, 12px, shown only for Fast Food / Chinese / Regular Dishes when that category is active).
- Product grid (`repeat(auto-fit, minmax(260px,1fr))`, 24px gap) using the same Product Card as Home. Caps at 9 cards initially with a "Load more dishes" button revealing 9 more at a time (perf: avoids mounting every product's image at once — implement as pagination or a simple `slice`+"Load more", not virtualization, at this catalog size).
- Empty state: centered "No dishes match your search." + helper line.
- Maps to: `src/app/menu/page.tsx`, `src/app/menu/MenuContent.tsx`.

**Product Card** (reused on Home + Menu):
- `--color-surface` (or page background on the tinted Home band) card, `border-radius: calc(radius-lg * 1.15)`, `--shadow-sm`.
- 190–200px image area (top), a terracotta price pill top-right (`₦{price}`, Caprasimo 13px, pill, `--shadow-sm`), and a circular favorite-heart toggle top-left (translucent cream circle; heart fills terracotta-600 when favorited, otherwise outline in neutral-500).
- Body: 19px Caprasimo name, 13px 72%-opacity description (line-clamp), then either a full-width "Add to cart" `.btn-primary` (qty 0) or a quantity stepper (circular −/+ buttons, terracotta + button, bold count) once in cart. Stepper caps at 10 per item.

### 4. Cart Drawer (overlay, all screens)
- Opens from the header cart button. Right-side sliding panel (max 420px wide), backdrop dims the page (`color-mix(--color-neutral-900 55%)`), header "Your Cart" + circular close (X) button.
- Empty state: bag icon in a terracotta-100 circle, "Your cart is empty" + "Browse menu" CTA.
- Filled state: scrollable line-item list (56px thumbnail, name, terracotta price, inline stepper + Remove link, line total), then a footer with Subtotal / conditional Takeaway pack fee / bold Estimated total, a "Checkout" `.btn-primary.btn-block`, and a "View full cart" text link.
- Maps to: `src/components/CartDrawer.tsx`.

### 5. Cart (full page)
- Same line-item styling as the drawer but roomier (84px thumbnails, `.card.elev-sm` per row), a "Clear cart" text link below the list, and a sticky summary card (Subtotal / Takeaway fee / "Delivery: calculated at checkout" / bold Estimated total / Checkout button).
- Empty state mirrors the drawer's, centered, larger (88px icon circle).
- Maps to: `src/app/cart/page.tsx`.

### 6. Checkout
- Back-chevron circular button + "Checkout" H1.
- **Closed-hours banner**: when outside 11:00–21:30, a terracotta-100 banner reading "We're currently closed" + hours + "your cart is saved" note appears above the form, and the pay button is disabled and relabeled "We're closed right now" (60% opacity).
- Delivery Information card (`.card.elev-sm`): map-pin icon + heading, an inline error banner (terracotta-100) on validation failure, Full name, Email + Phone (2-col), Address (textarea), and an LGA `<select>` (`.input` styling) populated from delivery zones (Kaduna North/South ₦800, Chikun ₦1200, Igabi ₦1500, Sabon Gari ₦1000).
- Sticky Order Summary card: per-line items, Subtotal, Delivery fee, conditional Takeaway pack fee, bold Total, "Proceed to payment" `.btn-primary.btn-block`, small disclaimer text.
- **Price-confirmation dialog** (`.dialog-backdrop`/`.dialog`): if the server-computed total differs from what was displayed (simulated in the prototype; real backend already implements this via `order.total_amount` in `checkout/page.tsx`), show a warning-triangle dialog with "Was ₦X" (struck through) / "Now ₦Y" and Cancel / "Confirm and pay ₦Y" actions before opening payment.
- **Mock payment sheet** in the prototype stands in for the real Paystack inline popup — implement as the existing Paystack integration, just restyled to match the dialog token (`.dialog`) if a custom UI wraps it, otherwise leave Paystack's own UI untouched.
- Maps to: `src/app/checkout/page.tsx`.

### 7. Track Order
- Centered, max 640px. H1 "Track Your Order" + subcopy, a card with Order ID + Phone Number fields and a "Track Order" button, an inline error message on no match.
- "Recent Orders" card (shown only when the visitor has prior orders on this device): each row shows Order # + status label and a "Reorder" button.
- Tracked order result card: Order # + formatted date + bold total, a 3-step progress row (Order Placed → Payment Confirmed → Delivered; completed/current steps solid terracotta, upcoming steps neutral-200), a line-item list, and a "Reorder these items" button.
- Maps to: `src/app/track/page.tsx`.

### 8. Success
- Centered, max 520px. Sage-100 circle with a terracotta-free sage checkmark icon, "Payment Successful!" H1, Order ID, thank-you copy, "Back to Home" (`.btn-primary`) + "Order More" (`.btn-secondary`) buttons, and a "Track this order" text link.
- Maps to: `src/app/success/page.tsx`.

### 9. Cancel
- Same layout shape as Success but with a terracotta-100 circle + alert-triangle icon, "Payment Cancelled" H1, explanatory copy, "Back to Cart" (`.btn-primary`) + "Continue Shopping" (`.btn-secondary`).
- Maps to: `src/app/cancel/page.tsx`.

### 10. Mobile Sticky Cart Bar
- Fixed to the bottom on viewports ≤768px, shown whenever the cart has items and the current screen isn't Cart/Checkout/Success/Cancel. Solid terracotta pill bar: "{count} item(s) · ₦{subtotal}" on the left, "View Cart →" on the right; tapping navigates to Cart.
- Maps to: `src/components/StickyCartBar.tsx`.

## Interactions & Behavior
- **Add to cart / quantity stepper**: tapping "Add to cart" sets quantity to 1 and swaps the button for a stepper; +/− adjust quantity (capped at 10, matching `maxItemQuantity` in `CartContext`); decrementing to 0 removes the item and reverts to the "Add to cart" button.
- **Favorites**: heart toggle is optimistic/local; "Favorites Only" filters the Menu grid to favorited items.
- **Category/subcategory filters + search**: combine (AND) — category, subcategory (where applicable), free-text search (name + description), and favorites-only all narrow the same product list. Changing any filter resets pagination ("Load more") back to the first page.
- **Cart drawer**: opens via the header cart icon on any screen; closes on backdrop click, the X button, or after navigating to Checkout/Cart via its own links.
- **Checkout validation**: all four fields (name, email, phone, address) required; inline error banner on failure; disabled + relabeled submit button when outside business hours.
- **Price confirmation**: if the authoritative server total differs from the total shown while the form was filled out, block payment behind a confirm dialog (existing app behavior in `checkout/page.tsx` via `priceConfirmation` state — keep this logic, just restyle the dialog).
- **Payment outcomes**: successful payment clears the cart, records the order (for the Track screen's "Recent Orders"), and routes to Success; closing/cancelling the Paystack popup routes to Cancel without clearing the cart.
- **Order tracking**: manual lookup by Order ID + phone; "Recent Orders" auto-populates from orders placed on this device; "Reorder" adds all of an order's items back into the cart and navigates to Cart.
- **Responsive**: sticky mobile cart bar appears ≤768px; product grids and the checkout two-column layout collapse to single-column on narrow viewports (use Tailwind's existing breakpoints, matching current app behavior).

## State Management
Keep the existing Context architecture — this redesign changes presentation, not data flow:
- `CartContext`: cart items, quantities, `maxItemQuantity`, totals.
- `FavoritesContext`: favorited product IDs.
- `CartDrawerContext`: drawer open/closed.
- Checkout page local state: form fields, selected delivery zone, loading/error, Paystack readiness, price-confirmation state.
- Track page local state: lookup form, tracked order result, recent orders (local storage, existing `recentOrders.ts` lib).
- Business hours: existing `businessHours.ts` (`isWithinBusinessHours`, `BUSINESS_HOURS_LABEL`) — reuse for both the header badge and the checkout closed-hours gating.

## Design Tokens (Organic system)
```css
--color-bg: #f5ead8;        /* page background, cream */
--color-surface: #ebddc5;   /* card/section fill */
--color-text: #201e1d;
--color-accent: #c67139;    /* terracotta — primary */
--color-accent-2: #7a8a5e;  /* sage — secondary */
--color-divider: color-mix(in srgb, #201e1d 16%, transparent);

/* Terracotta ramp */
100 #fff2eb  200 #ffe1d0  300 #ffc6a5  400 #f6a06b  500 #d67f48
600 #b2622d  700 #8c491a  800 #643312  900 #402310

/* Sage ramp */
100 #f0fae1  200 #e1eecc  300 #ccdbb2  400 #aebf92  500 #8fa073
600 #728157  700 #56633f  800 #3d472b  900 #272e1b

/* Neutral ramp */
100 #f9f4ed  200 #eee7db  300 #dcd3c4  400 #c0b6a5  500 #a19786
600 #82796a  700 #645c50  800 #474238  900 #2e2b25

--font-heading: "Caprasimo", system-ui, sans-serif;   /* headings, buttons, price pills */
--font-body: "Figtree", system-ui, sans-serif;        /* body text */

--radius-sm: 8px;  --radius-md: 16px;  --radius-lg: 28px;
/* Cards/dialogs go further: border-radius: calc(radius-lg * 1.15) */
/* Buttons/inputs/tags: border-radius: 999px (pill) */

--shadow-sm: 0 1px 2px rgba(46,43,37,.14);
--shadow-md: 0 3px 10px rgba(46,43,37,.16);
--shadow-lg: 0 12px 32px rgba(46,43,37,.22);
```
Full component-level CSS (buttons, inputs, cards, tags, dialog, nav) is in the bundled `organic-styles.css` — translate these classes into Tailwind utilities/`@apply` or a small components layer in `globals.css` (replacing the current amber/glassmorphism classes: `.btn-primary`, `.btn-secondary`, `.card-glass`, `.input-field`).

Icons: simple 2.75px-stroke line icons (heart, search, bag/cart, map-pin, check-circle, alert-triangle, chevron-left, x, plus/minus) — swap Heroicons for a matching stroke weight or restyle Heroicons' `stroke-width` to 2.75 for consistency with the Organic system's icon spec.

## Assets
No real photography is used — every product/hero image is a placeholder (drag-and-drop "image-slot" in the prototype). The real app's Supabase-hosted product images (`product.image_url`) should be used as-is, just re-cropped/wrapped in the `.washed` treatment described above where used decoratively (hero) — product card thumbnails stay unwashed/full-color per the source app's existing behavior.

## Files
- `Hungry Nomad.dc.html` — the full interactive design reference (all 7 screens + drawer/dialogs/sticky bar) with working mock state — open in a browser to click through every flow.
- `organic-styles.css` — the Organic design system's token sheet and component CSS, referenced throughout this document.
