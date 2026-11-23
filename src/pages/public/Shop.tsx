import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { PageHeader } from "@/components/common/PageHeader";
import { ProductGrid } from "@/components/product/ProductCard";
import { EmptyState, ErrorState } from "@/components/common/States";
import { Input, Select } from "@/components/ui/input";
import { fetchCategories, fetchProducts } from "@/services/catalog";
import type { Product } from "@/types/db";
import { inStock } from "@/lib/pricing";

type Sort = "new" | "popular" | "price_asc" | "price_desc";
const PRICE_RANGES: Record<string, [number, number]> = { under999: [0, 999], "999-1499": [999, 1499], "1499-1999": [1499, 1999], "2000+": [2000, Infinity] };

function matchesPrice(product: Product, range: string) {
  if (!range) return true;
  const [min, max] = PRICE_RANGES[range] ?? [0, Infinity];
  const prices = [Number(product.regular_price), ...(product.member_price == null ? [] : [Number(product.member_price)])];
  for (const variant of product.product_variants ?? []) {
    if (!variant.is_active) continue;
    const regular = Number(variant.price_override ?? product.regular_price);
    prices.push(regular);
    if (variant.member_price_override != null) prices.push(Number(variant.member_price_override));
  }
  return prices.some((price) => price >= min && price < max);
}

export default function Shop({ categorySlug, title }: { categorySlug?: string; title?: string }) {
  const [params, setParams] = useSearchParams();
  const category = categorySlug ?? params.get("category") ?? "";
  const sortValue = params.get("sort");
  const sort: Sort = sortValue === "popular" || sortValue === "price_asc" || sortValue === "price_desc" ? sortValue : "new";
  const searchParam = params.get("q") ?? "";
  const [search, setSearch] = useState(searchParam);
  const [debouncedSearch, setDebouncedSearch] = useState(searchParam);
  const [searchFocused, setSearchFocused] = useState(false);
  const size = params.get("size") ?? "";
  const color = params.get("color") ?? "";
  const price = params.get("price") ?? "";
  const availability = params.get("availability") ?? "";
  const newArrival = params.get("new") === "1";
  const collection = params.get("collection") ?? "";
  const sale = params.get("sale") === "1";
  const [filtersOpen, setFiltersOpen] = useState(false);
  const categories = useQuery({ queryKey: ["categories"], queryFn: fetchCategories });

  useEffect(() => { setSearch(searchParam); setDebouncedSearch(searchParam); }, [searchParam]);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const products = useQuery({
    queryKey: ["products", { category, sort, q: debouncedSearch, newArrival, collection }],
    queryFn: () => fetchProducts({ categorySlug: category || undefined, sort, search: debouncedSearch || undefined, newArrival, exclusive: collection === "exclusive", featured: collection === "featured" }),
  });

  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    value ? next.set(key, value) : next.delete(key);
    setParams(next, { replace: key === "q" });
  };
  const updateSearch = (value: string) => {
    setSearch(value);
    set("q", value);
  };
  const clearFilters = () => {
    setSearch(""); setDebouncedSearch("");
    setParams(categorySlug ? new URLSearchParams() : new URLSearchParams(), { replace: true });
  };

  const sizeOptions = useMemo(() => [...new Set((products.data ?? []).flatMap((p) => (p.product_variants ?? []).filter((v) => v.is_active).map((v) => v.size)))].sort(), [products.data]);
  const colorOptions = useMemo(() => [...new Set((products.data ?? []).flatMap((p) => (p.product_variants ?? []).filter((v) => v.is_active).map((v) => v.color)))].sort(), [products.data]);
  const visibleProducts = useMemo(() => (products.data ?? []).filter((product) => {
    const matchingVariants = (product.product_variants ?? []).filter((v) => v.is_active && (!size || v.size === size) && (!color || v.color === color));
    if ((size || color) && matchingVariants.length === 0) return false;
    if (availability === "in_stock" && !inStock(product)) return false;
    if (availability === "out_of_stock" && inStock(product)) return false;
    if (sale && !((product.member_price != null && Number(product.member_price) < Number(product.regular_price)) || (product.product_variants ?? []).some((v) => v.is_active && ((v.member_price_override != null && Number(v.member_price_override) < Number(v.price_override ?? product.regular_price)) || Number(v.price_override ?? product.regular_price) < Number(product.regular_price))))) return false;
    return matchesPrice(product, price);
  }), [products.data, size, color, price, availability, sale]);
  const matchingCategories = (categories.data ?? []).filter((item) => search.trim().length > 1 && item.name.toLowerCase().includes(search.trim().toLowerCase())).slice(0, 4);
  const activeFilters = [size, color, price, availability, newArrival ? "new arrival" : "", collection ? "collection" : "", sale ? "sale" : ""].filter(Boolean);

  const filters = <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
    <label className="space-y-1.5"><span className="text-xs uppercase tracking-wider text-muted-foreground">Size</span><Select value={size} onChange={(e) => set("size", e.target.value)} aria-label="Filter by size"><option value="">All sizes</option>{sizeOptions.map((value) => <option key={value}>{value}</option>)}</Select></label>
    <label className="space-y-1.5"><span className="text-xs uppercase tracking-wider text-muted-foreground">Color</span><Select value={color} onChange={(e) => set("color", e.target.value)} aria-label="Filter by color"><option value="">All colors</option>{colorOptions.map((value) => <option key={value}>{value}</option>)}</Select></label>
    <label className="space-y-1.5"><span className="text-xs uppercase tracking-wider text-muted-foreground">Price range</span><Select value={price} onChange={(e) => set("price", e.target.value)} aria-label="Filter by price"><option value="">Any price</option><option value="under999">Under ₹999</option><option value="999-1499">₹999–₹1,499</option><option value="1499-1999">₹1,499–₹1,999</option><option value="2000+">₹2,000+</option></Select></label>
    <label className="space-y-1.5"><span className="text-xs uppercase tracking-wider text-muted-foreground">Availability</span><Select value={availability} onChange={(e) => set("availability", e.target.value)} aria-label="Filter by availability"><option value="">All availability</option><option value="in_stock">In stock</option><option value="out_of_stock">Out of stock</option></Select></label>
    <button type="button" onClick={clearFilters} className="min-h-11 text-left text-sm text-primary underline underline-offset-4">Clear all filters</button>
  </div>;

  return <>
    <PageHeader eyebrow="The Black Wolf edit" title={title ?? (newArrival ? "New arrivals" : sale ? "Sale edit" : collection ? "Collections" : "Shop all pieces")} subtitle="Explore premium essentials, signature pieces and new-season forms." />
    <div className="container py-8 md:py-12">
      <div className="mb-6 grid gap-3 md:grid-cols-[1fr_240px]">
        <div className="relative">
          <Input placeholder="Search products, categories, descriptions" value={search} onChange={(e) => updateSearch(e.target.value)} onFocus={() => setSearchFocused(true)} onBlur={() => window.setTimeout(() => setSearchFocused(false), 150)} aria-label="Search products" />
          {searchFocused && search.trim().length > 1 && <div className="absolute inset-x-0 top-full z-30 mt-1 border border-border bg-background p-3 shadow-xl">
            {matchingCategories.length > 0 && <div className="mb-3"><p className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">Matching categories</p>{matchingCategories.map((item) => <button key={item.id} onMouseDown={() => { set("category", item.slug); updateSearch(""); }} className="mr-2 min-h-10 border border-border px-3 text-sm hover:border-primary">{item.name}</button>)}</div>}
            {products.data?.slice(0, 5).map((product) => <Link key={product.id} to={`/product/${product.slug}`} className="block border-t border-border py-2 text-sm hover:text-primary">{product.name}<span className="ml-2 text-muted-foreground">{product.categories?.name}</span></Link>)}
          </div>}
        </div>
        <Select value={sort} onChange={(e) => set("sort", e.target.value)} aria-label="Sort products"><option value="new">Newest</option><option value="popular">Popular · featured</option><option value="price_asc">Price: low to high</option><option value="price_desc">Price: high to low</option></Select>
      </div>

      {categories.data && <div className="mb-6 flex gap-2 overflow-x-auto pb-2" aria-label="Product categories">
        <button onClick={() => set("category", "")} aria-pressed={!category} className={`min-h-11 shrink-0 border px-4 text-sm transition-colors ${!category ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:border-primary hover:text-foreground"}`}>All pieces</button>
        {categories.data.map((item) => <button key={item.id} onClick={() => set("category", item.slug)} aria-pressed={category === item.slug} className={`min-h-11 shrink-0 border px-4 text-sm transition-colors ${category === item.slug ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:border-primary hover:text-foreground"}`}>{item.name}</button>)}
      </div>}

      <button type="button" onClick={() => setFiltersOpen(true)} className="mb-5 flex min-h-12 w-full items-center justify-between border-y border-border py-2 text-sm uppercase tracking-wider lg:hidden">Filter pieces {activeFilters.length > 0 && <span className="ml-2 text-primary">({activeFilters.length} active)</span>}<span aria-hidden="true">＋</span></button>
      {filtersOpen && <div className="fixed inset-0 z-50 flex items-end bg-black/70 lg:hidden" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setFiltersOpen(false); }}><section role="dialog" aria-modal="true" aria-labelledby="shop-filter-title" className="max-h-[85vh] w-full overflow-y-auto border-t border-border bg-background p-5 shadow-2xl animate-in slide-in-from-bottom duration-300"><div className="mb-5 flex items-center justify-between"><h2 id="shop-filter-title" className="font-display text-4xl">Filter pieces</h2><button onClick={() => setFiltersOpen(false)} className="min-h-11 min-w-11 text-2xl" aria-label="Close filters">×</button></div>{filters}<div className="mt-5 grid grid-cols-2 gap-3"><button onClick={clearFilters} className="min-h-12 border border-border text-sm uppercase tracking-wider">Clear</button><button onClick={() => setFiltersOpen(false)} className="min-h-12 bg-primary text-sm uppercase tracking-wider text-primary-foreground">Apply filters</button></div></section></div>}
      <div className="grid gap-8 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="hidden h-fit border-r border-border pr-6 lg:block"><p className="mb-4 font-display text-3xl">Refine</p>{filters}</aside>
        <section aria-live="polite">
          <div className="mb-5 flex min-h-11 items-center justify-between border-b border-border pb-3"><p className="text-sm text-muted-foreground">{products.isLoading ? "Finding pieces…" : `${visibleProducts.length} ${visibleProducts.length === 1 ? "piece" : "pieces"}`}</p>{activeFilters.length > 0 && <button onClick={clearFilters} className="text-sm text-primary underline underline-offset-4">Clear all</button>}</div>
          {products.isLoading ? <ProductSkeleton /> : products.error ? <ErrorState error={products.error} retry={() => void products.refetch()} /> : visibleProducts.length === 0 ? <EmptyState title="No products found" hint="Try another search or clear a filter to explore more pieces." action={<button onClick={clearFilters} className="min-h-11 px-4 text-sm uppercase tracking-wider text-primary underline">Clear search and filters</button>} /> : <ProductGrid products={visibleProducts} />}
        </section>
      </div>
    </div>
  </>;
}

function ProductSkeleton() {
  return <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 md:grid-cols-3 md:gap-y-14 xl:grid-cols-4" role="status" aria-label="Loading products">
    {Array.from({ length: 8 }, (_, i) => <div key={i}><div className="skeleton aspect-[3/4]"/><div className="mt-4 space-y-3"><div className="skeleton h-3 w-1/3"/><div className="skeleton h-5 w-4/5"/><div className="skeleton h-4 w-1/2"/></div></div>)}
  </div>;
}
