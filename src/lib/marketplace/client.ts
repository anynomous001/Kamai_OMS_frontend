/**
 * Data-fetching layer for the marketplace feature. Every screen calls
 * these functions, which call this app's own /api/marketplace/* route
 * handlers — never the wholesale API directly from the browser. See
 * src/app/api/marketplace/_lib/proxy.ts for why: three of the six
 * upstream endpoints require a shared X-API-Key that must never reach
 * client JS.
 */

import {
  CartWholesalerConflictError,
  type Wholesaler,
  type WholesaleProduct,
  type WholesaleProductVariant,
  type WholesalerPolicies,
  type WholesaleCart,
  type PlaceOrderResponse,
  type OrderStatusResponse,
  type BakerOrderListItem,
  type FulfilmentMode,
  type OrderItem,
} from './types';

export class MarketplaceApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'MarketplaceApiError';
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api/marketplace${path}`, {
      headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
      ...options,
    });
  } catch {
    throw new MarketplaceApiError('Cannot reach the marketplace service. Check your connection and try again.', 0);
  }

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new MarketplaceApiError(body.message || 'Something went wrong. Please try again.', response.status);
  }

  return body as T;
}

const marketplaceApi = {
  get: <T>(path: string) => request<T>(path, { method: 'GET' }),
  post: <T>(path: string, data?: unknown) => request<T>(path, { method: 'POST', body: data ? JSON.stringify(data) : undefined }),
};

// ---- Suppliers ----

export async function fetchWholesalers(params?: { lat?: number; lng?: number }): Promise<Wholesaler[]> {
  const qs = new URLSearchParams();
  if (params?.lat != null && params?.lng != null) {
    qs.set('lat', String(params.lat));
    qs.set('lng', String(params.lng));
  }
  const data = await marketplaceApi.get<{ items: Wholesaler[] }>(`/wholesalers${qs.toString() ? `?${qs}` : ''}`);
  return data.items;
}

/**
 * No single-wholesaler-by-id endpoint exists in this API - resolves by
 * fetching the full list. Used sparingly (only the cart wholesaler-switch
 * confirmation needs to look up a wholesaler by id outside of a screen
 * that already has the full list loaded).
 */
export async function fetchWholesalerById(id: string): Promise<Wholesaler | undefined> {
  const all = await fetchWholesalers();
  return all.find((w) => w.id === id);
}

// ---- Catalogue ----

export async function fetchCatalogue(
  wholesalerId: string,
  params?: { search?: string; category?: string; sort?: 'price'; inStockOnly?: boolean }
): Promise<WholesaleProduct[]> {
  const qs = new URLSearchParams();
  if (params?.search) qs.set('search', params.search);
  if (params?.category) qs.set('category', params.category);
  if (params?.sort) qs.set('sort', params.sort);
  if (params?.inStockOnly) qs.set('inStockOnly', 'true');
  const data = await marketplaceApi.get<{ wholesalerId: string; items: WholesaleProduct[] }>(
    `/wholesalers/${encodeURIComponent(wholesalerId)}/catalogue${qs.toString() ? `?${qs}` : ''}`
  );
  // wholesalerId isn't repeated on each item in the response - attach it
  // so cart/order code can read item.wholesalerId without extra plumbing.
  return data.items.map((item) => ({ ...item, wholesalerId: data.wholesalerId }));
}

/** No single-product endpoint exists - resolves from the wholesaler's full catalogue. */
export async function fetchProduct(wholesalerId: string, productId: string): Promise<WholesaleProduct | undefined> {
  const items = await fetchCatalogue(wholesalerId);
  return items.find((p) => p.id === productId);
}

// ---- Policies ----

export async function fetchPolicies(wholesalerId: string): Promise<WholesalerPolicies> {
  return marketplaceApi.get<WholesalerPolicies>(`/wholesalers/${encodeURIComponent(wholesalerId)}/policies`);
}

// ---- Variant helpers ----
// Stock status is product-level in this API, not per-variant (see
// WholesaleProduct.stockStatus in types.ts) - read that field directly,
// no helper needed for it.

/** Cheapest variant, used as the default selection and for catalogue-card display. Null if the product has no variants - fall back to product.unit/product.price. */
export function getDefaultVariant(product: WholesaleProduct): WholesaleProductVariant | null {
  if (product.variants.length === 0) return null;
  return product.variants.reduce((cheapest, v) => (v.price < cheapest.price ? v : cheapest), product.variants[0]);
}

export function getDisplayPrice(product: WholesaleProduct, variant?: WholesaleProductVariant | null): number {
  if (variant) return variant.price;
  return getDefaultVariant(product)?.price ?? product.price;
}

export function getDisplayUnitLabel(product: WholesaleProduct, variant?: WholesaleProductVariant | null): string {
  if (variant) return variant.label;
  return getDefaultVariant(product)?.label ?? product.unit;
}

// ---- Cart ----
// Purely a local, client-side concept - there is no server-side cart in
// this API (see WholesaleCart in types.ts). Kept behind the same
// Promise-returning function shape as everything else here (rather than
// exposing a plain mutable object) so every screen's existing
// await-based call sites keep working unchanged; internally it's just
// synchronous local state, no simulated network involved.

let cart: WholesaleCart = { wholesalerId: null, items: [] };

function lineKey(productId: string, variantId: string | null): string {
  return `${productId}:${variantId ?? ''}`;
}

export async function fetchCart(): Promise<WholesaleCart> {
  return cart;
}

export function getCartSubtotal(c: WholesaleCart): number {
  return c.items.reduce((sum, item) => sum + getDisplayPrice(item.product, item.variant) * item.quantity, 0);
}

/**
 * Single source of truth for "how many of this exact product+variant are
 * already in the cart" - Catalogue cards and Product Detail both derive
 * their displayed stepper quantity from this rather than keeping their
 * own counters, so the two screens can never disagree.
 */
export function getCartItemQuantity(c: WholesaleCart | null, productId: string, variantId: string | null): number {
  if (!c) return 0;
  const key = lineKey(productId, variantId);
  return c.items.find((item) => lineKey(item.product.id, item.variant?.id ?? null) === key)?.quantity ?? 0;
}

/**
 * Throws CartWholesalerConflictError if product belongs to a different
 * wholesaler than what's already in the cart and options.force isn't
 * set - the caller must confirm with the baker and retry with
 * { force: true } rather than have the cart wiped silently.
 *
 * Screens should not call this directly - use the useAddToCart hook
 * (./useAddToCart.ts) instead, which handles that confirm/retry flow
 * once, consistently, for every "Add to Cart" action in the app.
 */
export async function addToCart(
  product: WholesaleProduct,
  variant: WholesaleProductVariant | null,
  quantity: number,
  options?: { force?: boolean }
): Promise<WholesaleCart> {
  if (cart.wholesalerId && cart.wholesalerId !== product.wholesalerId) {
    if (!options?.force) {
      throw new CartWholesalerConflictError(cart.wholesalerId, product.wholesalerId);
    }
    cart = { wholesalerId: product.wholesalerId, items: [] };
  }

  const key = lineKey(product.id, variant?.id ?? null);
  const existing = cart.items.find((item) => lineKey(item.product.id, item.variant?.id ?? null) === key);
  const items = existing
    ? cart.items.map((item) =>
        lineKey(item.product.id, item.variant?.id ?? null) === key ? { ...item, quantity: item.quantity + quantity } : item
      )
    : [...cart.items, { product, variant, quantity }];

  cart = { wholesalerId: product.wholesalerId, items };
  return cart;
}

export async function updateCartItemQuantity(productId: string, variantId: string | null, quantity: number): Promise<WholesaleCart> {
  const key = lineKey(productId, variantId);
  const items =
    quantity <= 0
      ? cart.items.filter((item) => lineKey(item.product.id, item.variant?.id ?? null) !== key)
      : cart.items.map((item) => (lineKey(item.product.id, item.variant?.id ?? null) === key ? { ...item, quantity } : item));

  cart = { wholesalerId: items.length > 0 ? cart.wholesalerId : null, items };
  return cart;
}

export async function removeCartItem(productId: string, variantId: string | null): Promise<WholesaleCart> {
  return updateCartItemQuantity(productId, variantId, 0);
}

export async function clearCart(): Promise<WholesaleCart> {
  cart = { wholesalerId: null, items: [] };
  return cart;
}

// ---- Orders ----

export async function placeOrder(payload: {
  wholesalerId: string;
  bakerId: string;
  buyerName: string;
  buyerContact?: string;
  fulfilmentMode: FulfilmentMode;
  notes?: string;
  items: { productId: string; variantId?: string; quantity: number }[];
}): Promise<PlaceOrderResponse> {
  const result = await marketplaceApi.post<PlaceOrderResponse>('/orders', payload);
  await clearCart();
  return result;
}

export async function fetchOrderStatus(orderId: string): Promise<OrderStatusResponse> {
  return marketplaceApi.get<OrderStatusResponse>(`/orders/${encodeURIComponent(orderId)}/status`);
}

export async function fetchBakerOrders(bakerId: string, params?: { status?: string }): Promise<BakerOrderListItem[]> {
  const qs = new URLSearchParams();
  if (params?.status) qs.set('status', params.status);
  const data = await marketplaceApi.get<{ items: BakerOrderListItem[] }>(
    `/bakers/${encodeURIComponent(bakerId)}/orders${qs.toString() ? `?${qs}` : ''}`
  );
  return data.items;
}

/**
 * Rebuilds cart lines from a past order's items against the current
 * catalogue - never the order's own historical unitPrice, since prices
 * may have changed since the order was placed. Items whose product no
 * longer exists, is out of stock, or whose specific variant was since
 * deleted are skipped and reported back rather than silently dropped.
 *
 * Throws CartWholesalerConflictError up front (before adding anything)
 * if the cart already holds items from a different wholesaler - same
 * pattern as addToCart, so callers reuse the same confirm/retry flow
 * (see useAddToCart.ts). Retry with { force: true } to clear the
 * existing cart and proceed.
 */
export async function reorderItems(
  wholesalerId: string,
  items: OrderItem[],
  options?: { force?: boolean }
): Promise<{ addedCount: number; unavailable: string[] }> {
  if (cart.wholesalerId && cart.wholesalerId !== wholesalerId) {
    if (!options?.force) {
      throw new CartWholesalerConflictError(cart.wholesalerId, wholesalerId);
    }
    cart = { wholesalerId: null, items: [] };
  }

  const catalogue = await fetchCatalogue(wholesalerId);
  const unavailable: string[] = [];
  let addedCount = 0;

  for (const item of items) {
    const label = item.variantLabel ? `${item.productName} (${item.variantLabel})` : item.productName;
    const product = catalogue.find((p) => p.id === item.productId);
    if (!product || product.stockStatus === 'Out of Stock') {
      unavailable.push(label);
      continue;
    }
    let variant: WholesaleProductVariant | null = null;
    if (item.variantId) {
      variant = product.variants.find((v) => v.id === item.variantId) ?? null;
      if (!variant) {
        unavailable.push(label);
        continue;
      }
    }
    await addToCart(product, variant, item.quantity, { force: true });
    addedCount += 1;
  }

  return { addedCount, unavailable };
}

// ---- Distance ----
// The API sorts server-side by real distance when lat/lng are passed to
// GET /wholesalers, but doesn't return a distance value in the response
// - this reproduces the same Haversine calculation client-side, purely
// for display, from two real coordinate pairs (never fabricated).

export function haversineDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export { CartWholesalerConflictError } from './types';
