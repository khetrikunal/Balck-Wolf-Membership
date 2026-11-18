import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import * as acc from "@/services/account";
import { errorMessage } from "@/lib/utils";

/** True only when the SERVER says the signed-in user has an active, unexpired membership. */
export function useIsMember() {
  const { user } = useAuth();
  const q = useQuery({ queryKey: ["pricing-tier", user?.id], queryFn: acc.fetchPricingTier, enabled: !!user, staleTime: 60_000 });
  return { isMember: !!user && !!q.data, loading: !!user && q.isLoading };
}

export function useCart() {
  const { user } = useAuth();
  return useQuery({ queryKey: ["cart", user?.id], queryFn: acc.fetchCart, enabled: !!user });
}

export function useCartMutations() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["cart"] });
  const add = useMutation({
    mutationFn: (v: { variantId: string; quantity: number }) => acc.addToCart(user!.id, v.variantId, v.quantity),
    onSuccess: () => { invalidate(); toast.success("Added to cart"); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const setQty = useMutation({
    mutationFn: (v: { itemId: string; quantity: number }) => acc.setCartQty(v.itemId, v.quantity),
    onSuccess: invalidate, onError: (e) => toast.error(errorMessage(e)),
  });
  return { add, setQty };
}

export function useWishlistIds() {
  const { user } = useAuth();
  return useQuery({ queryKey: ["wishlist-ids", user?.id], queryFn: acc.fetchWishlistIds, enabled: !!user });
}

export function useToggleWishlist() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { productId: string; on: boolean }) => acc.toggleWishlist(user!.id, v.productId, v.on),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["wishlist-ids"] }); qc.invalidateQueries({ queryKey: ["wishlist"] }); },
    onError: (e) => toast.error(errorMessage(e)),
  });
}
