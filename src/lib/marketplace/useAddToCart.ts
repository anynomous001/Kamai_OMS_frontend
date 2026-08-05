'use client';

import { useCallback, useState } from 'react';
import { addToCart as addToCartRequest, fetchWholesalerById, reorderItems } from './client';
import { CartWholesalerConflictError, type OrderItem, type WholesaleCart, type WholesaleProduct, type WholesaleProductVariant } from './types';

interface ReorderResult {
  addedCount: number;
  unavailable: string[];
}

interface UseAddToCartResult {
  addToCart: (product: WholesaleProduct, variant: WholesaleProductVariant | null, quantity: number) => Promise<WholesaleCart | null>;
  reorder: (wholesalerId: string, items: OrderItem[]) => Promise<ReorderResult | null>;
  isAdding: boolean;
  error: string | null;
}

/**
 * The single, shared way every marketplace screen adds a product to the
 * cart. Screens must call this hook, not client.addToCart directly -
 * that's what guarantees the wholesaler-switch confirmation behaves
 * identically everywhere instead of drifting screen to screen.
 *
 * On CartWholesalerConflictError this confirms with the baker via
 * window.confirm before retrying with { force: true }. That matches
 * this app's existing pattern for destructive-but-recoverable
 * confirmations (see the delete-menu-item and regenerate-share-link
 * confirms in page.tsx) rather than introducing a new custom dialog
 * component/pattern into the design system.
 */
export function useAddToCart(): UseAddToCartResult {
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addToCart = useCallback(
    async (
      product: WholesaleProduct,
      variant: WholesaleProductVariant | null,
      quantity: number
    ): Promise<WholesaleCart | null> => {
      setIsAdding(true);
      setError(null);
      try {
        return await addToCartRequest(product, variant, quantity);
      } catch (err) {
        if (err instanceof CartWholesalerConflictError) {
          const [current, incoming] = await Promise.all([
            fetchWholesalerById(err.currentWholesalerId),
            fetchWholesalerById(err.incomingWholesalerId),
          ]);
          const confirmed = window.confirm(
            `Your cart has items from ${current?.businessName ?? 'another wholesaler'}. Adding this item will clear it and start a new cart from ${incoming?.businessName ?? 'this wholesaler'}. Continue?`
          );
          if (!confirmed) return null;

          try {
            return await addToCartRequest(product, variant, quantity, { force: true });
          } catch (retryErr) {
            setError(retryErr instanceof Error ? retryErr.message : 'Could not add item to cart.');
            return null;
          }
        }

        setError(err instanceof Error ? err.message : 'Could not add item to cart.');
        return null;
      } finally {
        setIsAdding(false);
      }
    },
    []
  );

  const reorder = useCallback(
    async (wholesalerId: string, items: OrderItem[]): Promise<ReorderResult | null> => {
      setIsAdding(true);
      setError(null);
      try {
        return await reorderItems(wholesalerId, items);
      } catch (err) {
        if (err instanceof CartWholesalerConflictError) {
          const [current, incoming] = await Promise.all([
            fetchWholesalerById(err.currentWholesalerId),
            fetchWholesalerById(err.incomingWholesalerId),
          ]);
          const confirmed = window.confirm(
            `Your cart has items from ${current?.businessName ?? 'another wholesaler'}. Reordering will clear it and start a new cart from ${incoming?.businessName ?? 'this wholesaler'}. Continue?`
          );
          if (!confirmed) return null;

          try {
            return await reorderItems(wholesalerId, items, { force: true });
          } catch (retryErr) {
            setError(retryErr instanceof Error ? retryErr.message : 'Could not reorder. Please try again.');
            return null;
          }
        }

        setError(err instanceof Error ? err.message : 'Could not reorder. Please try again.');
        return null;
      } finally {
        setIsAdding(false);
      }
    },
    []
  );

  return { addToCart, reorder, isAdding, error };
}
