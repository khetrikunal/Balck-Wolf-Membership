import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { PageHeader } from "@/components/common/PageHeader";
import { ProductGrid } from "@/components/product/ProductCard";
import { QueryBoundary } from "@/components/common/States";
import { Input, Select } from "@/components/ui/input";
import { fetchCategories, fetchProducts } from "@/services/catalog";

export default function Shop({ categorySlug, title }: { categorySlug?: string; title?: string }) {
  const [params, setParams] = useSearchParams();
  const cat = categorySlug ?? params.get("category") ?? undefined;
  const sort = (params.get("sort") as "new" | "price_asc" | "price_desc") ?? "new";
  const [search, setSearch] = useState(params.get("q") ?? "");
  const categories = useQuery({ queryKey: ["categories"], queryFn: fetchCategories });
  const products = useQuery({ queryKey: ["products", { cat, sort, search }], queryFn: () => fetchProducts({ categorySlug: cat, sort, search: search || undefined }) });

  const set = (k: string, v: string) => { const n = new URLSearchParams(params); v ? n.set(k, v) : n.delete(k); setParams(n); };

  return (
    <>
      <PageHeader eyebrow="The Black Wolf edit" title={title ?? "Shop"} subtitle="A considered edit of premium essentials, signature pieces and new-season forms." />
      <div className="container py-8 md:py-12">
        <div className="sticky top-[72px] z-20 -mx-4 mb-8 border-y border-border bg-background/95 px-4 py-4 backdrop-blur-xl md:mb-10 md:py-5">
        <div className="grid gap-3 md:grid-cols-[1fr_220px]">
          <Input placeholder="Search products" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search products" />
          {!categorySlug ? (
            <Select value={cat ?? ""} onChange={(e) => set("category", e.target.value)} aria-label="Category">
              <option value="">All categories</option>
              {categories.data?.map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}
            </Select>
          ) : <div />}
          <Select value={sort} onChange={(e) => set("sort", e.target.value)} aria-label="Sort">
            <option value="new">Newest</option><option value="price_asc">Price: low to high</option><option value="price_desc">Price: high to low</option>
          </Select>
        </div>
        {categories.data && !categorySlug && <div className="mt-4 flex gap-2 overflow-x-auto pb-1" aria-label="Product categories">
          <button onClick={() => set("category", "")} className={`min-h-11 shrink-0 border px-4 text-sm transition-colors ${!cat ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:border-primary hover:text-foreground"}`}>All pieces</button>
          {categories.data.map((c) => <button key={c.id} onClick={() => set("category", c.slug)} aria-pressed={cat === c.slug} className={`min-h-11 shrink-0 border px-4 text-sm transition-colors ${cat === c.slug ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:border-primary hover:text-foreground"}`}>{c.name}</button>)}
        </div>}
        </div>
        {products.isLoading ? <ProductSkeleton /> : <QueryBoundary query={products} empty={{ title: "Nothing here yet", hint: "No products match these filters." }}>{(d) => <ProductGrid products={d} />}</QueryBoundary>}
      </div>
    </>
  );
}

function ProductSkeleton() {
  return <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 md:grid-cols-3 md:gap-y-14 lg:grid-cols-4" role="status" aria-label="Loading products">
    {Array.from({ length: 8 }, (_, i) => <div key={i}>
      <div className="skeleton aspect-[3/4]" />
      <div className="mt-4 space-y-3"><div className="skeleton h-3 w-1/3"/><div className="skeleton h-5 w-4/5"/><div className="skeleton h-4 w-1/2"/></div>
    </div>)}
  </div>;
}
