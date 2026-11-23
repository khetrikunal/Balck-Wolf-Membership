import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQueries, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowRight, Crown, MoveUpRight, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProductGrid } from "@/components/product/ProductCard";
import { Logo } from "@/components/common/Logo";
import { QueryBoundary } from "@/components/common/States";
import { fetchBestSellers, fetchCategories, fetchProducts, fetchSetting, fetchTestimonials, subscribeNewsletter } from "@/services/catalog";
import { errorMessage } from "@/lib/utils";
import { productImage } from "@/lib/pricing";
import { publicImageUrl } from "@/lib/supabase";

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
  const categories = useQuery({ queryKey: ["categories"], queryFn: fetchCategories });
  const categorySamples = useQueries({ queries: (categories.data ?? []).map((category) => ({ queryKey: ["category-sample", category.id], queryFn: () => fetchProducts({ categorySlug: category.slug, limit: 1 }), staleTime: 60_000 })) });
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const [videoEnabled, setVideoEnabled] = useState(false);

  useEffect(() => {
    const viewport = window.matchMedia("(min-width: 768px)");
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setVideoEnabled(viewport.matches && !motion.matches);
    update();
    viewport.addEventListener("change", update);
    motion.addEventListener("change", update);
    return () => { viewport.removeEventListener("change", update); motion.removeEventListener("change", update); };
  }, []);

  async function subscribe(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    try { await subscribeNewsletter(email.trim()); toast.success("You're on the list."); setEmail(""); }
    catch (err) { toast.error(errorMessage(err)); } finally { setBusy(false); }
  }

  return (
    <>
      <section className="relative isolate min-h-[calc(100svh-72px)] overflow-hidden border-b border-border">
        {(!videoEnabled || videoFailed) && <img src="/download.jpg" alt="" fetchPriority="high" className="absolute inset-0 -z-20 h-full w-full object-cover object-center opacity-40 grayscale contrast-125" />}
        {videoEnabled && !videoFailed && <video className="absolute inset-0 -z-20 h-full w-full object-cover object-center opacity-50 grayscale contrast-125" autoPlay muted loop playsInline preload="metadata" poster="/download.jpg" aria-hidden="true" tabIndex={-1} onError={() => setVideoFailed(true)}>
          <source src="/Landing%20Page.mp4" type="video/mp4" />
        </video>}
        <div className="red-glow absolute inset-0 -z-10" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-background via-background/70 to-background/45 md:via-background/65" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-background/80 via-transparent to-background/25" />
        <div className="container grid min-h-[calc(100svh-72px)] items-end gap-10 py-14 md:grid-cols-[1.15fr_.85fr] md:items-center md:py-20">
          <div className="max-w-2xl pb-4 md:pb-0">
            <Logo className="mb-5 h-16 w-36 md:mb-7 md:h-20 md:w-44" />
            <p className="eyebrow mb-5 flex items-center gap-3"><span className="editorial-rule" />Independent by nature</p>
            <h1 className="max-w-3xl text-[clamp(5rem,15vw,13rem)] leading-[.78] tracking-[-0.025em]">{hero.data?.headline ?? "BLACK WOLF"}</h1>
            <p className="mt-7 max-w-xl text-base font-medium uppercase leading-7 tracking-[0.12em] text-foreground md:text-lg">Wear your power. Own your identity.</p>
            <p className="font-accent mt-1 max-w-md text-xl text-foreground/75 md:text-2xl">Made for the uncommon.</p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Button size="lg" className="min-h-12 px-8" asChild><Link to="/shop">Explore collection <MoveUpRight className="h-4 w-4" /></Link></Button>
              <Button size="lg" variant="outline" className="min-h-12 px-8" asChild><Link to="/about">Our story</Link></Button>
            </div>
            <div className="mt-10 flex items-center gap-4 text-sm uppercase tracking-[0.2em] text-muted-foreground">
              <span className="text-primary">01</span><span className="h-px w-12 bg-border"/><span>New season · 2026</span>
            </div>
          </div>
          <div className="hidden self-end justify-self-end pb-12 text-right md:block">
            <p className="font-accent text-5xl leading-none text-foreground/90">Made for<br/>the uncommon.</p>
            <p className="mt-4 text-sm uppercase tracking-[0.2em] text-primary">Black Wolf Atelier</p>
          </div>
        </div>
      </section>

      <div className="overflow-hidden border-b border-border bg-ink-2 py-4" aria-label="Strength, confidence, individuality">
        <div className="marquee-track flex w-max items-center gap-8 whitespace-nowrap font-display text-3xl uppercase tracking-[0.05em] text-transparent [-webkit-text-stroke:1px_rgba(243,239,232,.55)] md:text-4xl" aria-hidden="true">
          {Array.from({ length: 4 }, (_, i) => <span key={i}>Strength <i className="not-italic text-primary">·</i> Confidence <i className="not-italic text-primary">·</i> Individuality <i className="not-italic text-primary">·</i></span>)}
        </div>
      </div>

      {!!categories.data?.length && <section className="section container">
        <div className="mb-8"><p className="eyebrow mb-3">Explore the edit</p><h2 className="text-5xl leading-none md:text-7xl">Shop by category</h2></div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          {categories.data.map((category, index) => {
            const product = categorySamples[index]?.data?.[0];
            const image = product ? productImage(product)[0] : undefined;
            return <Link key={category.id} to={`/shop?category=${encodeURIComponent(category.slug)}`} className="group relative isolate flex aspect-[4/5] min-h-40 items-end overflow-hidden border border-border bg-secondary p-4 transition-colors hover:border-primary/60 md:p-5">
              {image && <img src={publicImageUrl(image.storage_path)} alt={image.alt ?? `${category.name} product`} loading="lazy" className="absolute inset-0 -z-20 h-full w-full object-cover opacity-60 transition-transform duration-500 group-hover:scale-105" />}
              <div className="absolute inset-0 -z-10 bg-gradient-to-t from-background via-background/15 to-transparent" />
              <span><span className="block text-xs uppercase tracking-[0.18em] text-primary">0{index + 1}</span><span className="mt-1 block font-display text-3xl leading-none md:text-4xl">{category.name}</span><span className="mt-2 block text-sm text-foreground/75">Explore →</span></span>
            </Link>;
          })}
        </div>
      </section>}

      <section className="section container">
        <div className="grid gap-8 md:grid-cols-[.78fr_1.22fr] md:items-end">
          <div className="space-y-5">
            <Logo className="h-16 w-36" />
            <p className="eyebrow">Identity · attitude · intent</p>
            <h2 className="text-5xl leading-[.92] md:text-7xl">Strength in every detail.</h2>
          </div>
          <p className="max-w-2xl pb-1 text-base leading-8 text-muted-foreground md:justify-self-end md:text-lg">BLACK WOLF represents strength, confidence and individuality. Created for those who stand apart, our clothing combines bold identity with timeless style.</p>
        </div>
      </section>

      <section className="border-y border-border bg-secondary/70 py-16 md:py-24">
        <div className="container">
          <div className="mb-9 flex items-end justify-between md:mb-12">
            <div><p className="eyebrow mb-3">A visual study · BLACK WOLF</p><h2 className="text-5xl leading-none md:text-7xl">Pieces with presence.</h2></div>
            <Link to="/shop" className="hidden items-center gap-2 border-b border-primary/50 pb-2 text-[10px] uppercase tracking-[0.18em] transition-colors hover:text-primary md:flex">View the collection <ArrowRight className="h-3.5 w-3.5" /></Link>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-5">
            {[
              { src: "/M-Armor%20Drop%20Shoulder%20T-Shirts_Sizes_%20S,%20M,%20L,%20XL,%20XXL_Buy%20Now_%20+92%20326%200069694.jpg", alt: "Black graphic drop shoulder T-shirt detail", label: "Graphic form", ratio: "aspect-[4/5]" },
              { src: "/download.jpg", alt: "Dark contemporary clothing store interior", label: "The atmosphere", ratio: "aspect-[4/5] md:mt-12" },
              { src: "/Jujutsu%20Kaisen%20Manga%20Gojo%20Satoru%20Graphic%20T-shirt%20Vintage%20Washed%20T%20Shirt%20Men%20Women%20Clothing%20Oversized.jpg", alt: "Washed black oversized graphic T-shirt, front and back", label: "Washed cotton", ratio: "aspect-[4/5]" },
              { src: "/download%20(1).jpg", alt: "Curated streetwear rail in a clothing store", label: "Everyday icons", ratio: "aspect-[4/5] md:mt-12" },
            ].map((item) => <Link to="/shop" key={item.src} className={`group relative ${item.ratio} overflow-hidden border border-border`}>
              <img src={item.src} alt={item.alt} loading="lazy" className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.035] group-hover:grayscale" />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-4 pb-4 pt-12 md:px-5 md:pb-5"><p className="text-[9px] uppercase tracking-[0.2em] text-primary">BLACK WOLF · EDIT</p><p className="mt-1 font-display text-xl md:text-2xl">{item.label}</p></div>
            </Link>)}
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

      <section className="border-y border-border bg-bone text-background">
        <div className="container section flex flex-col items-start gap-6 md:flex-row md:items-center md:justify-between">
          <div><Palette className="mb-5 h-7 w-7 text-primary" strokeWidth={1.2} /><p className="mb-3 text-sm font-medium uppercase tracking-[0.22em] text-primary">Made personal</p><h2 className="text-5xl leading-[.9] md:text-7xl">Your idea.<br/>Our craft.</h2>
            <p className="mt-4 max-w-lg text-base leading-7 text-background/75">Bring your artwork to life on premium tees and track pants, made with care and attention to detail.</p></div>
          <Button size="lg" asChild><Link to="/custom">Start a custom order <ArrowRight className="h-4 w-4" /></Link></Button>
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
