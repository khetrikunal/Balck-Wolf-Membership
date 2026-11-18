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
      <div className="container py-10 md:py-14">
        <div className="mb-10 grid gap-3 border-b border-border pb-8 md:grid-cols-[1fr_220px_220px]">
          <Input placeholder="Search products" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search" />
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
        <QueryBoundary query={products} empty={{ title: "Nothing here yet", hint: "No products match these filters." }}>{(d) => <ProductGrid products={d} />}</QueryBoundary>
      </div>
    </>
  );
}
