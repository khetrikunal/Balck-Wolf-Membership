import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowRight, Crown, MoveUpRight, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProductGrid } from "@/components/product/ProductCard";
import { QueryBoundary } from "@/components/common/States";
import { fetchBestSellers, fetchProducts, fetchSetting, fetchTestimonials, subscribeNewsletter } from "@/services/catalog";
import { errorMessage } from "@/lib/utils";

function Section({ eyebrow, title, to, children }: { eyebrow: string; title: string; to?: string; children: React.ReactNode }) {
  return (
    <section className="section container">
      <div className="mb-9 flex items-end justify-between md:mb-12">
        <div><p className="eyebrow mb-3">{eyebrow}</p><h2 className="text-5xl leading-none md:text-7xl">{title}</h2></div>
        {to && <Link to={to} className="hidden items-center gap-2 border-b border-primary/50 pb-2 text-[10px] uppercase tracking-[0.18em] text-foreground transition-colors hover:text-primary md:flex">View collection <ArrowRight className="h-3.5 w-3.5" /></Link>}
      </div>
      {children}
    </section>
  );
}

const ProductRail = ({ query, emptyTitle }: { query: ReturnType<typeof useQuery<any>>; emptyTitle: string }) => (
  <QueryBoundary query={query} empty={{ title: emptyTitle, hint: "Check back soon." }}>{(d) => <ProductGrid products={d} />}</QueryBoundary>
);

export default function Home() {
  const hero = useQuery({ queryKey: ["setting", "hero"], queryFn: () => fetchSetting<{ headline: string; subheadline: string }>("hero") });
  const featured = useQuery({ queryKey: ["products", "featured"], queryFn: () => fetchProducts({ featured: true, limit: 4 }) });
  const fresh = useQuery({ queryKey: ["products", "new"], queryFn: () => fetchProducts({ newArrival: true, limit: 4 }) });
  const best = useQuery({ queryKey: ["products", "best"], queryFn: () => fetchBestSellers(4) });
  const exclusive = useQuery({ queryKey: ["products", "exclusive"], queryFn: () => fetchProducts({ exclusive: true, limit: 4 }) });
  const testimonials = useQuery({ queryKey: ["testimonials"], queryFn: fetchTestimonials });
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  async function subscribe(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    try { await subscribeNewsletter(email.trim()); toast.success("You're on the list."); setEmail(""); }
    catch (err) { toast.error(errorMessage(err)); } finally { setBusy(false); }
  }

  return (
    <>
      <section className="relative isolate overflow-hidden border-b border-border">
        <div className="absolute inset-0 -z-20 bg-[url('https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=2000&q=85')] bg-cover bg-[center_38%] opacity-40 grayscale md:bg-[center_30%]" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-background via-background/80 to-background/55 md:via-background/70" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-background/75 via-transparent to-background/20" />
        <div className="container grid min-h-[78vh] items-end gap-10 py-16 md:min-h-[calc(100svh-74px)] md:grid-cols-[1.15fr_.85fr] md:items-center md:py-20">
          <div className="max-w-2xl pb-4 md:pb-0">
            <p className="eyebrow mb-7 flex items-center gap-3"><span className="editorial-rule" />Independent by nature · Est. 2024</p>
            <h1 className="max-w-3xl text-[clamp(4.5rem,12vw,10rem)] leading-[.76] tracking-[-0.035em]">{hero.data?.headline ?? "BLACK WOLF"}</h1>
            <p className="mt-8 max-w-md text-sm leading-7 text-foreground/75 md:text-base">{hero.data?.subheadline ?? "Premium streetwear. Made to stand apart."}</p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Button size="lg" className="min-h-12 px-8" asChild><Link to="/shop">Explore the collection <MoveUpRight className="h-4 w-4" /></Link></Button>
              <Button size="lg" variant="outline" className="min-h-12 px-8" asChild><Link to="/about">Our story</Link></Button>
            </div>
            <div className="mt-14 flex items-center gap-4 text-[9px] uppercase tracking-[0.24em] text-muted-foreground">
              <span className="text-primary">01</span><span className="h-px w-12 bg-border"/><span>New season · 2026</span>
            </div>
          </div>
          <div className="hidden self-end justify-self-end pb-12 text-right md:block">
            <p className="font-display text-5xl italic leading-none text-foreground/80">Made for<br/>the uncommon.</p>
            <p className="mt-4 text-[9px] uppercase tracking-[0.25em] text-primary">Black Wolf Atelier</p>
          </div>
        </div>
      </section>

      <Section eyebrow="The edit · 01" title="Selected pieces" to="/shop"><ProductRail query={featured} emptyTitle="No featured products yet" /></Section>
      <section className="border-y border-border bg-secondary/75">
        <div className="container grid gap-10 py-16 md:grid-cols-[.75fr_1.25fr] md:items-end md:py-24">
          <div><p className="eyebrow mb-3">A study in form · 02</p><h2 className="max-w-sm text-5xl leading-[.9] md:text-7xl">The everyday, considered.</h2></div>
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <p className="max-w-md text-sm leading-7 text-muted-foreground">Quiet confidence in every detail. Discover new-season essentials, designed to move with you and made to hold their place in your wardrobe.</p>
            <Link to="/track-pants" className="inline-flex shrink-0 items-center gap-2 border-b border-primary/60 pb-2 text-[10px] uppercase tracking-[0.18em] transition-colors hover:text-primary">Discover track pants <ArrowRight className="h-3.5 w-3.5" /></Link>
          </div>
        </div>
      </section>
      <Section eyebrow="Just arrived · 03" title="New season" to="/shop"><ProductRail query={fresh} emptyTitle="No new arrivals yet" /></Section>
      <Section eyebrow="The signature edit" title="Best sellers" to="/shop"><ProductRail query={best} emptyTitle="No best sellers yet" /></Section>

      <section className="border-y border-border bg-[#151515]">
        <div className="container section grid items-center gap-12 md:grid-cols-2">
          <div>
            <Crown className="mb-5 h-6 w-6 text-primary" strokeWidth={1.2} />
            <p className="eyebrow mb-3">The inner circle</p>
            <h2 className="max-w-xl text-5xl leading-[.92] md:text-7xl">A closer view of Black Wolf.</h2>
            <p className="mt-5 max-w-md text-sm leading-7 text-muted-foreground">Member pricing across the collection, first access to new releases and a digital membership card.</p>
            <Button className="mt-8" size="lg" asChild><Link to="/membership">Discover membership <ArrowRight className="h-4 w-4" /></Link></Button>
          </div>
          <ul className="divide-y divide-border border-y border-border text-sm text-muted-foreground">
            {["Member pricing across the collection", "Early access to limited releases", "A digital card with QR verification", "One-time membership, renewed on your terms"].map((t, i) => (
              <li key={t} className="flex items-center gap-5 py-5"><span className="font-display text-2xl text-primary/70">0{i + 1}</span><span>{t}</span></li>))}
          </ul>
        </div>
      </section>

      <div id="collections"><Section eyebrow="Members only" title="Exclusive collection" to="/shop?category=exclusive-collections"><ProductRail query={exclusive} emptyTitle="Exclusive collection coming soon" /></Section></div>

      <section className="border-y border-border bg-secondary">
        <div className="container section flex flex-col items-start gap-6 md:flex-row md:items-center md:justify-between">
          <div><Palette className="mb-5 h-6 w-6 text-primary" strokeWidth={1.2} /><p className="eyebrow mb-3">Made personal</p><h2 className="text-5xl leading-[.9] md:text-7xl">Your idea.<br/>Our craft.</h2>
            <p className="mt-4 max-w-lg text-sm leading-7 text-muted-foreground">Bring your artwork to life on premium tees and track pants, made with care and attention to detail.</p></div>
          <Button size="lg" variant="outline" asChild><Link to="/custom">Start a custom order <ArrowRight className="h-4 w-4" /></Link></Button>
        </div>
      </section>

      <Section eyebrow="Pack talk" title="What customers say">
        <QueryBoundary query={testimonials} empty={{ title: "No reviews yet", hint: "Be the first to wear it." }}>
          {(d) => (<div className="grid gap-4 md:grid-cols-3">{d.map((t) => (
            <blockquote key={t.id} className="border-t border-primary/40 bg-card/40 p-6 md:p-8"><p className="font-display text-2xl leading-snug md:text-3xl">“{t.quote}”</p><footer className="mt-6 text-[9px] uppercase tracking-[0.2em] text-primary">{t.author}</footer></blockquote>))}</div>)}
        </QueryBoundary>
      </Section>

      <section className="border-t border-border">
        <div className="container section text-center">
          <p className="eyebrow mb-3">Letters from the house</p><h2 className="text-5xl md:text-7xl">Stay in the know.</h2>
          <p className="mt-3 text-sm text-muted-foreground">A considered note on new releases and private offers.</p>
          <form onSubmit={subscribe} className="mx-auto mt-8 flex max-w-lg gap-2">
            <Input type="email" required placeholder="you@email.com" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Email" />
            <Button loading={busy}>Subscribe</Button>
          </form>
        </div>
      </section>
    </>
  );
}
