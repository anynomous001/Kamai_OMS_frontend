# Bakery Marketplace API Reference

For frontend integration of the baker ("maker") side of the marketplace. All endpoints below are live and verified against the wholesale backend.

## Base URL

`https://<wholesale-backend-host>/api/public/*`

All bakery-facing endpoints live under `/api/public/*`, separate from the wholesaler-only `/api/sourcing/*` routes.

## Authentication

Two tiers:

| Endpoint type | Auth |
|---|---|
| Browsing (wholesalers, catalogue, policies) | None — fully public |
| Orders (create, status, list) | Required: `X-API-Key` header |

The API key is a shared secret issued to the baker backend — **not** per-baker or per-user. It authenticates "this is a legitimate call from our baker system," not any individual baker's identity. Baker identity is passed as data in the request body/params (`bakerId`, `buyerName`, `buyerContact`), not derived from auth.

**Missing/invalid key on an authenticated endpoint → `401`.**

There is no baker login/account system in this backend. Baker accounts, sessions, and auth all live in the baker backend; this API trusts whatever baker identity the baker backend hands it.

---

## 1. List Suppliers

`GET /api/public/wholesalers`

No auth required. Returns only `ACTIVE` wholesalers.

**Query params (optional):**
| Param | Type | Notes |
|---|---|---|
| `lat` | number | Baker's latitude. Must be passed together with `lng` to enable distance sort. |
| `lng` | number | Baker's longitude. |

If both are provided, results are sorted nearest-first by real distance (Haversine against each wholesaler's geocoded coordinates). If either is missing, or a wholesaler has no coordinates, results fall back to default order — this never errors.

**Response `200`:**
```json
{
  "items": [
    {
      "id": "string",
      "businessName": "string",
      "businessType": "string",
      "address": "string",
      "latitude": 12.9698,
      "longitude": 77.75,
      "serviceRadiusKm": 15,
      "logoUrl": "string | null",
      "deliveryEnabled": true,
      "pickupEnabled": true,
      "expectedDeliveryTime": "string (free text, e.g. 'Next-day between 6 AM - 10 AM')"
    }
  ]
}
```

**Note:** `latitude`/`longitude` come from geocoding a text address (via Nominatim/OpenStreetMap) — they are approximate, not guaranteed pixel-precise. Some wholesalers may have `null` coordinates if their address hasn't successfully geocoded yet; handle that case (omit from distance sort, don't crash).

**⚠️ Attribution requirement:** Because coordinates are sourced from OpenStreetMap/Nominatim, the UI **must** display `© OpenStreetMap contributors` wherever these coordinates or a derived map/distance are shown. This is a hard requirement of the data source's usage terms, not optional styling.

---

## 2. Get One Supplier's Catalogue

`GET /api/public/wholesalers/:id/catalogue`

No auth required. Browsing is **per-supplier only** — there is no endpoint that returns products across multiple wholesalers at once. `:id` is the wholesaler id from endpoint 1.

**Query params (all optional, combinable):**
| Param | Type | Behavior |
|---|---|---|
| `search` | string | Case-insensitive match on product name |
| `category` | string | Exact filter |
| `sort` | `price` | Sorts ascending by price |
| `inStockOnly` | `true` | Excludes items where status is Out of Stock |

**Response `200`:**
```json
{
  "wholesalerId": "string",
  "items": [
    {
      "id": "string",
      "name": "string",
      "category": "string",
      "brand": "string | null",
      "unit": "string",
      "price": 1850,
      "availabilityState": "AVAILABLE | LIMITED_STOCK | OUT_OF_STOCK",
      "stockStatus": "In Stock | Low Stock | Out of Stock",
      "imageUrl": "string | null",
      "variants": [
        { "id": "string", "label": "string", "price": 1850 }
      ]
    }
  ]
}
```

**Important — stock display rule:** Use `stockStatus` (or map `availabilityState` yourself using the table below) for all UI display. **Never** attempt to show or imply an exact remaining quantity — no such field exists in this response by design; it's a manual status the wholesaler sets, not a derived count.

| `availabilityState` | Display as | Add to Cart |
|---|---|---|
| `AVAILABLE` | In Stock | Enabled |
| `LIMITED_STOCK` | Low Stock | Enabled |
| `OUT_OF_STOCK` | Out of Stock | Disabled |

**Not supported:** Pre-order is out of scope for this version. Only the three states above exist.

**Errors:** `404` if `:id` doesn't exist or the wholesaler isn't `ACTIVE`.

---

## 3. Get One Supplier's Policies

`GET /api/public/wholesalers/:id/policies`

No auth required. `404` if `:id` doesn't exist or isn't `ACTIVE`.

**Response `200`:**
```json
{
  "wholesalerId": "string",
  "deliveryEnabled": true,
  "deliveryRadiusKm": 15,
  "deliveryCharge": 50,
  "minOrderAmount": 500,
  "freeDeliveryThreshold": 2000,
  "expectedDeliveryTime": "string (free text)",
  "pickupEnabled": true,
  "pickupLocation": "string | null",
  "advancePercentage": 30,
  "paymentPolicyConfigured": true
}
```

**Important for Checkout screen:** There is **no free-text payment-terms field** (e.g. no "Net 15" style string). The only payment info available is `advancePercentage` (e.g. 30 = 30% advance required) and `paymentPolicyConfigured` (boolean — whether the wholesaler has set up payment terms at all). Design checkout copy around this, e.g. *"Advance payment: 30% required"* rather than assuming a terms description exists. If `paymentPolicyConfigured` is `false`, don't show a percentage — show that terms haven't been set yet.

`deliveryRadiusKm` is a simple radius, not a named delivery zone/polygon — if a baker is outside it, that's a frontend-side distance check against the supplier's coordinates, this API doesn't reject/validate that for you.

---

## 4. Place an Order

`POST /api/public/orders`

**Requires `X-API-Key` header.**

**Request body:**
```json
{
  "wholesalerId": "string",
  "bakerId": "string",
  "buyerName": "string",
  "buyerContact": "string (optional)",
  "fulfilmentMode": "PICKUP | DELIVERY",
  "notes": "string (optional)",
  "items": [
    { "productId": "string", "variantId": "string (optional)", "quantity": 3 }
  ]
}
```

**Response `201`:**
```json
{
  "id": "string",
  "status": "string",
  "totalAmount": 5550,
  "createdAt": "ISO 8601 timestamp"
}
```

**Important:** Pricing (`totalAmount`) and advance-payment requirements are always computed server-side from the current catalogue and policy data at the moment of order creation — **never** send a price/total in the request; it will be ignored/overridden. Build your cart UI using prices from endpoint 2, but treat this response's `totalAmount` as the source of truth for what to actually display/confirm to the baker.

**Errors:**
- `401` — missing/invalid API key
- `404` — wholesaler doesn't exist or isn't `ACTIVE`
- `400` — a `productId`/`variantId` doesn't belong to the specified wholesaler (e.g. cart built from stale data)

---

## 5. Get Order Status

`GET /api/public/orders/:id/status`

**Requires `X-API-Key` header.**

**Response `200`:**
```json
{
  "id": "string",
  "status": "string",
  "fulfilmentMode": "PICKUP | DELIVERY",
  "advanceStatus": "string",
  "totalAmount": 5550,
  "readyTime": "string | null",
  "updatedAt": "ISO 8601 timestamp"
}
```

**Note:** the full set of possible `status` values hasn't been fully enumerated in our testing — confirmed values seen so far include at least `RECEIVED` and `CANCELLED`. **Confirm the complete status enum with backend before building status-based UI branching** (e.g. a status stepper/timeline on the Order Detail screen) so every possible value has a defined visual state.

---

## 6. List a Baker's Orders

`GET /api/public/bakers/:bakerId/orders`

**Requires `X-API-Key` header.** Returns order history for one baker, most recent first.

**Query params (optional):**
| Param | Type | Notes |
|---|---|---|
| `status` | string | Filters to a single status value (same enum as endpoint 5) |

**Response `200`:**
```json
{
  "items": [
    {
      "id": "string",
      "wholesalerId": "string",
      "wholesalerBusinessName": "string",
      "status": "string",
      "fulfilmentMode": "PICKUP | DELIVERY",
      "totalAmount": 5550,
      "itemCount": 4,
      "createdAt": "ISO 8601 timestamp"
    }
  ]
}
```

A baker with no orders returns `200` with `{ "items": [] }` — not a `404`. Use `wholesalerBusinessName` directly for display; no need to call endpoint 1 again to resolve the name.

---

## Cross-cutting notes for frontend

- **No unified/cross-supplier search.** Every browsing action (search, category, sort) is scoped to one supplier at a time via endpoint 2. There is no "search all suppliers' products" endpoint in this version.
- **No exact stock counts, anywhere.** Only the three-state status system above. Don't build UI that implies a specific number of units left.
- **No "Verified Supplier" concept exists.** Don't build or reserve UI space for a verification badge — it isn't real data yet.
- **Baker auth is entirely out of this API's scope.** This backend has no concept of baker login; it only accepts baker identity as data, authenticated at the transport level via the shared API key. Handle baker login/session/identity entirely within the baker backend/frontend.
- **OSM attribution is required** wherever supplier location/distance is shown (see endpoint 1).

## Open items to confirm before full integration

1. **Full `status` enum** for orders (endpoints 5 and 6) — only partially confirmed via testing so far.
2. **`LIMITED_STOCK` → "Low Stock"** mapping in `stockStatus` — confirmed logically consistent with the other two states but worth a direct confirmation alongside the full enum check above.
