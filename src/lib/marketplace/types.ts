/**
 * Data contracts for the baker-side marketplace/wholesale-procurement
 * feature, matching bakery-api-reference.md exactly. Every screen reads
 * through client.ts, which calls src/app/api/marketplace/* route
 * handlers (never the wholesale API directly from the browser — see
 * those routes for why: the order endpoints need a shared API key that
 * must stay server-side).
 *
 * Deliberately NOT modeled here because the real API doesn't provide
 * them (see bakery-api-reference.md's "Cross-cutting notes"): a
 * "Verified Supplier" flag, wholesaler ratings, a free-text payment-terms
 * string, wholesaler phone numbers, per-product descriptions, exact
 * stock counts, and per-variant pricing tiers (MRP/min order qty).
 */

export interface Wholesaler {
  id: string;
  businessName: string;
  businessType: string;
  address: string;
  /** Geocoded from `address` via Nominatim/OSM — approximate, and null if geocoding hasn't succeeded yet. */
  latitude: number | null;
  longitude: number | null;
  serviceRadiusKm: number;
  logoUrl: string | null;
  deliveryEnabled: boolean;
  pickupEnabled: boolean;
  /** Free text, e.g. "Next-day between 6 AM - 10 AM" - not a structured field. */
  expectedDeliveryTime: string;
}

export type StockStatus = 'In Stock' | 'Low Stock' | 'Out of Stock';
export type AvailabilityState = 'AVAILABLE' | 'LIMITED_STOCK' | 'OUT_OF_STOCK';

/** A purchasable pack size/SKU, e.g. "25kg Bag" vs "10kg Bag" of the same product. Some products have none - see getDefaultVariant. */
export interface WholesaleProductVariant {
  id: string;
  label: string;
  price: number;
}

export interface WholesaleProduct {
  id: string;
  wholesalerId: string;
  name: string;
  /** Free text set by the wholesaler, not a fixed taxonomy - filter chips are derived per-catalogue, not from a shared enum. */
  category: string;
  brand: string | null;
  unit: string;
  price: number;
  availabilityState: AvailabilityState;
  /** Authoritative for display - always prefer this over deriving from availabilityState yourself. */
  stockStatus: StockStatus;
  imageUrl: string | null;
  variants: WholesaleProductVariant[];
}

export interface WholesalerPolicies {
  wholesalerId: string;
  deliveryEnabled: boolean;
  deliveryRadiusKm: number;
  deliveryCharge: number;
  minOrderAmount: number;
  freeDeliveryThreshold: number;
  expectedDeliveryTime: string;
  pickupEnabled: boolean;
  pickupLocation: string | null;
  /** e.g. 30 meaning 30% advance required. Meaningless if paymentPolicyConfigured is false. */
  advancePercentage: number;
  /** False = wholesaler hasn't set up payment terms yet - show that fact, not "0%". */
  paymentPolicyConfigured: boolean;
}

export interface WholesaleCartItem {
  product: WholesaleProduct;
  /** Null when the product has no real variants (see getDefaultVariant) - cart/checkout fall back to product.unit/product.price and omit variantId from the order payload for that line. */
  variant: WholesaleProductVariant | null;
  quantity: number;
}

/**
 * Purely a client-side concept - there is no server-side cart in this
 * API. Subtotal is always derivable from items; delivery fee/total
 * require a wholesaler's policies (fetched separately), so they're not
 * stored here - compute them where policies are already in scope
 * (Cart and Checkout screens).
 */
export interface WholesaleCart {
  wholesalerId: string | null;
  items: WholesaleCartItem[];
}

export type FulfilmentMode = 'PICKUP' | 'DELIVERY';

export interface PlaceOrderResponse {
  id: string;
  /** Full enum unconfirmed - only RECEIVED/CANCELLED verified so far. Treat as opaque, don't branch UI on assumed values beyond those two. */
  status: string;
  /** Server-computed from current catalogue/policy data - always the source of truth for what to display, never the client's own cart math. */
  totalAmount: number;
  createdAt: string;
}

/**
 * productName/variantLabel are resolved live at query time (current
 * catalogue state), not a snapshot from when the order was placed - if
 * a wholesaler renames a product, past orders show the current name.
 * variantLabel (and variantId) is null when the original variant has
 * since been deleted - render gracefully, don't assume it's present.
 */
export interface OrderItem {
  productId: string;
  productName: string;
  variantId: string | null;
  variantLabel: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface OrderStatusResponse {
  id: string;
  status: string;
  fulfilmentMode: FulfilmentMode;
  advanceStatus: string;
  totalAmount: number;
  readyTime: string | null;
  updatedAt: string;
  items: OrderItem[];
}

export interface BakerOrderListItem {
  id: string;
  wholesalerId: string;
  wholesalerBusinessName: string;
  status: string;
  fulfilmentMode: FulfilmentMode;
  totalAmount: number;
  itemCount: number;
  createdAt: string;
  items: OrderItem[];
}

/**
 * Thrown by addToCart when adding a product from a different wholesaler
 * than what's already in the cart, without { force: true } - carts are
 * single-wholesaler, so this would silently wipe the existing cart
 * otherwise. Screens must catch this, confirm with the baker that
 * switching wholesalers clears their current cart, and only then retry
 * the call with { force: true }.
 */
export class CartWholesalerConflictError extends Error {
  currentWholesalerId: string;
  incomingWholesalerId: string;

  constructor(currentWholesalerId: string, incomingWholesalerId: string) {
    super('Adding this product would replace items from a different wholesaler already in your cart.');
    this.name = 'CartWholesalerConflictError';
    this.currentWholesalerId = currentWholesalerId;
    this.incomingWholesalerId = incomingWholesalerId;
  }
}
