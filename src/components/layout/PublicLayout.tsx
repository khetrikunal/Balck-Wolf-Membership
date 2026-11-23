import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { ChevronDown, Heart, LockKeyhole, Menu, Search, ShoppingBag, User, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Logo } from "@/components/common/Logo";
import { useAuth } from "@/hooks/useAuth";
import { useCart, useWishlistIds } from "@/hooks/useShop";
import { fetchCategories, fetchProducts, hasProductsOnOffer } from "@/services/catalog";
import { cn, formatINR } from "@/lib/utils";
import { productImage, displayPrice } from "@/lib/pricing";
import { publicImageUrl } from "@/lib/supabase";
import { MiniCart } from "@/components/layout/MiniCart";

const categoriesKey = ["categories"];

export function PublicLayout() {
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("blackwolf.recent-searches") ?? "[]").slice(0, 5); }
    catch { return []; }
  });
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const { user, isStaff } = useAuth();
  const cart = useCart();
  const wishlist = useWishlistIds();
  const categories = useQuery({ queryKey: categoriesKey, queryFn: fetchCategories });
  const offers = useQuery({ queryKey: ["offer-availability"], queryFn: hasProductsOnOffer });
  const searchResults = useQuery({ queryKey: ["search-suggestions", searchText.trim()], queryFn: () => fetchProducts({ search: searchText.trim(), limit: 6 }), enabled: searchOpen && searchText.trim().length >= 2 });
  const count = cart.data?.reduce((n, i) => n + i.quantity, 0) ?? 0;
  const wishlistCount = wishlist.data?.length ?? 0;
  const loc = useLocation();
  const navigate = useNavigate();
  const checkoutMode = loc.pathname === "/checkout";
  const matchingSearchCategories = (categories.data ?? []).filter((category) => searchText.trim().length > 1 && category.name.toLowerCase().includes(searchText.trim().toLowerCase())).slice(0, 4);
  const rememberSearch = (value: string) => {
    const term = value.trim();
    if (!term) return;
    const next = [term, ...recentSearches.filter((item) => item.toLowerCase() !== term.toLowerCase())].slice(0, 5);
    setRecentSearches(next);
    localStorage.setItem("blackwolf.recent-searches", JSON.stringify(next));
  };
  const submitSearch = (value = searchText) => {
    const term = value.trim();
    rememberSearch(term);
    setSearchOpen(false);
    navigate(term ? `/shop?q=${encodeURIComponent(term)}` : "/shop");
  };
  useEffect(() => { setOpen(false); setCartOpen(false); window.scrollTo(0, 0); }, [loc.pathname]);
  useEffect(() => {
    let previous = window.scrollY;
    const onScroll = () => {
      const current = window.scrollY;
      setScrolled(current > 24);
      setHidden(current > 180 && current > previous + 4);
      if (current < previous - 4 || current < 80) setHidden(false);
      previous = current;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const categoryLinks = categories.data?.map((category) => <Link key={category.id} to={`/shop?category=${encodeURIComponent(category.slug)}`} className="block px-4 py-3 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">{category.name}</Link>);

  return (
    <div className="flex min-h-screen flex-col">
      <header className={cn("fixed inset-x-0 top-0 z-40 border-b border-border/70 transition-all duration-500", scrolled ? "bg-background/85 backdrop-blur-xl" : "bg-background/25 backdrop-blur-sm", hidden && !open && "-translate-y-full")}>
        <div className="container relative z-10 grid h-[72px] grid-cols-[auto_1fr_auto] items-center gap-4">
          <button className="flex h-11 w-11 items-center justify-center text-foreground transition-colors hover:text-primary lg:hidden" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} onClick={() => setOpen(!open)}>{open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</button>
          <Link to="/" aria-label="BLACK WOLF home" className="justify-self-start"><Logo /></Link>
          {!checkoutMode && <nav aria-label="Main navigation" className="hidden items-center justify-center gap-3 lg:flex xl:gap-5">
            <NavLink to="/" end className={({ isActive }) => cn("nav-link", isActive && "text-primary")}>Home</NavLink>
            <NavLink to="/shop" className="nav-link">Shop</NavLink>
            <details className="group relative"><summary className="nav-link flex cursor-pointer list-none items-center gap-1">Categories <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" /></summary>
              <div className="absolute left-0 top-full z-50 mt-3 min-w-56 border border-border bg-background/95 p-2 shadow-2xl backdrop-blur-xl">{categoryLinks?.length ? categoryLinks : <Link to="/shop" className="block px-4 py-3 text-sm text-muted-foreground">Browse all products</Link>}</div>
            </details>
            <NavLink to="/shop?new=1" className="nav-link">New arrivals</NavLink>
            <NavLink to="/shop?collection=exclusive" className="nav-link">Collections</NavLink>
            {offers.data && <NavLink to="/shop?sale=1" className="nav-link text-primary">Sale</NavLink>}
            <NavLink to="/membership" className="nav-link">Membership</NavLink>
            <NavLink to="/custom" className="nav-link">Custom</NavLink>
          </nav>}
          {checkoutMode ? <p className="flex items-center gap-2 text-sm text-muted-foreground"><LockKeyhole className="h-4 w-4 text-primary" />Secure checkout</p> : <div className="flex items-center justify-self-end gap-1 sm:gap-2">
            {isStaff && <Link to="/admin" className="hidden text-xs uppercase tracking-widest text-primary xl:block">Admin</Link>}
            <button aria-label="Search products" aria-expanded={searchOpen} onClick={() => setSearchOpen(!searchOpen)} className="flex h-11 w-10 items-center justify-center text-foreground/80 transition-colors hover:text-primary"><Search className="h-[18px] w-[18px]" /></button>
            <button aria-label={isStaff ? "Admin dashboard" : "Account"} onClick={() => navigate(user ? (isStaff ? "/admin" : "/account") : "/login")} className="flex h-11 w-10 items-center justify-center text-foreground/80 transition-colors hover:text-primary"><User className="h-[18px] w-[18px]" /></button>
            <Link to={user ? "/account/wishlist" : "/login"} state={!user ? { from: `${loc.pathname}${loc.search}` } : undefined} aria-label={`Wishlist${wishlistCount ? `, ${wishlistCount} items` : ""}`} className="relative flex h-11 w-10 items-center justify-center text-foreground/80 transition-colors hover:text-primary"><Heart className="h-[18px] w-[18px]" />{wishlistCount > 0 && <span className="absolute right-0 top-0 flex h-4 min-w-4 items-center justify-center bg-primary px-1 text-[10px] font-semibold text-primary-foreground">{wishlistCount}</span>}</Link>
            <button type="button" onClick={() => user ? setCartOpen(true) : navigate("/cart")} aria-label={`Cart${count ? `, ${count} items` : ""}`} aria-expanded={cartOpen} className="relative flex h-11 w-10 items-center justify-center text-foreground/80 transition-colors hover:text-primary"><ShoppingBag className="h-[18px] w-[18px]" />{count > 0 && <span className="absolute right-0 top-0 flex h-4 min-w-4 items-center justify-center bg-primary px-1 text-[10px] font-semibold text-primary-foreground">{count}</span>}</button>
          </div>}
        </div>
        {!checkoutMode && searchOpen && <div className="absolute inset-x-0 top-full z-30 max-h-[75vh] overflow-y-auto border-b border-border bg-background/98 shadow-2xl backdrop-blur-xl">
          <div className="container py-5">
            <form onSubmit={(event) => { event.preventDefault(); submitSearch(); }} className="flex gap-3">
              <input autoFocus value={searchText} onChange={(event) => setSearchText(event.target.value)} onFocus={() => setSearchFocused(true)} onKeyDown={(event) => { if (event.key === "Escape") setSearchOpen(false); }} placeholder="Search pieces, categories, details" aria-label="Search the collection" className="h-12 min-w-0 flex-1 border-b border-border bg-transparent text-lg outline-none placeholder:text-muted-foreground focus:border-primary" />
              <button type="submit" className="min-h-11 px-4 text-sm uppercase tracking-wider text-primary">Search</button>
              <button type="button" onClick={() => setSearchOpen(false)} className="min-h-11 px-3 text-muted-foreground hover:text-foreground" aria-label="Close search"><X className="h-5 w-5" /></button>
            </form>
            {!searchText.trim() && searchFocused && recentSearches.length > 0 && <div className="mt-5"><p className="eyebrow mb-2">Recent searches</p><div className="flex flex-wrap gap-2">{recentSearches.map((term) => <button key={term} onMouseDown={() => { setSearchText(term); submitSearch(term); }} className="min-h-10 border border-border px-3 text-sm text-muted-foreground hover:border-primary hover:text-foreground">{term}</button>)}</div></div>}
            {searchText.trim().length > 1 && <div className="mt-5 grid gap-6 md:grid-cols-[220px_1fr]">
              <div><p className="eyebrow mb-2">Categories</p>{matchingSearchCategories.length ? matchingSearchCategories.map((category) => <Link key={category.id} to={`/shop?category=${encodeURIComponent(category.slug)}`} onClick={() => setSearchOpen(false)} className="block border-b border-border py-3 text-sm hover:text-primary">{category.name}</Link>) : <p className="text-sm text-muted-foreground">No matching categories</p>}</div>
              <div><p className="eyebrow mb-2">Products</p>{searchResults.isLoading ? <p className="py-4 text-sm text-muted-foreground">Searching the collection…</p> : searchResults.data?.length ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{searchResults.data.slice(0, 6).map((product) => {
                const image = productImage(product)[0];
                return <Link key={product.id} to={`/product/${product.slug}`} onClick={() => { rememberSearch(searchText); setSearchOpen(false); }} className="flex min-h-20 items-center gap-3 border border-border p-2 transition-colors hover:border-primary/60">
                  <div className="h-16 w-14 shrink-0 bg-secondary">{image && <img src={publicImageUrl(image.storage_path)} alt={image.alt ?? product.name} className="h-full w-full object-cover" />}</div>
                  <span className="min-w-0"><span className="block truncate text-sm">{product.name}</span><span className="text-sm text-muted-foreground">{formatINR(displayPrice(product, undefined, false).price)}</span></span>
                </Link>;
              })}</div> : <div className="py-2"><p className="text-sm text-muted-foreground">No products found. Try a category or a different term.</p><div className="mt-3 flex flex-wrap gap-2">{categories.data?.slice(0, 4).map((category) => <Link key={category.id} onClick={() => setSearchOpen(false)} to={`/shop?category=${encodeURIComponent(category.slug)}`} className="min-h-10 border border-border px-3 py-2 text-sm hover:border-primary">{category.name}</Link>)}</div></div>}</div>
            </div>}
          </div>
        </div>}
        {!checkoutMode && open && <nav aria-label="Mobile navigation" className="fixed inset-0 z-0 flex flex-col justify-center overflow-y-auto bg-background px-8 pb-12 pt-24 lg:hidden">
          <p className="eyebrow mb-5">Enter the night</p>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1">
            <NavLink to="/" end className="mobile-nav-link">Home</NavLink><NavLink to="/shop" className="mobile-nav-link">Shop all</NavLink>
            <NavLink to="/shop?new=1" className="mobile-nav-link">New arrivals</NavLink><NavLink to="/shop?collection=exclusive" className="mobile-nav-link">Collections</NavLink>
            {offers.data && <NavLink to="/shop?sale=1" className="mobile-nav-link text-primary">Sale</NavLink>}
            <details className="col-span-2 border-b border-border"><summary className="mobile-nav-link cursor-pointer list-none">Categories <ChevronDown className="ml-2 inline h-5 w-5" /></summary><div className="grid grid-cols-2 gap-x-5 pb-3">{categories.data?.map((category) => <NavLink key={category.id} to={`/shop?category=${encodeURIComponent(category.slug)}`} className="min-h-11 py-2 text-sm text-muted-foreground hover:text-primary">{category.name}</NavLink>)}</div></details>
            <NavLink to="/membership" className="mobile-nav-link">Membership</NavLink><NavLink to="/custom" className="mobile-nav-link">Custom clothing</NavLink><NavLink to={user ? "/account" : "/login"} className="mobile-nav-link">{user ? "My account" : "Sign in"}</NavLink>
            {isStaff && <Link to="/admin" className="mobile-nav-link text-primary">Admin</Link>}
          </div>
          <div className="mt-7 flex flex-wrap gap-4 text-sm text-muted-foreground"><Link to="/account/wishlist">Wishlist ({wishlistCount})</Link><Link to="/cart">Bag ({count})</Link><Link to="/about">About</Link><Link to="/contact">Contact</Link></div>
        </nav>}
      </header>
      {!checkoutMode && <MiniCart open={cartOpen} onClose={() => setCartOpen(false)} />}
      <main className="flex-1 pt-[72px]"><Outlet /></main>
      {!checkoutMode && <Footer />}
    </div>
  );
}

function Footer() {
  const col = "space-y-2 text-sm text-muted-foreground [&_a]:transition-colors [&_a:hover]:text-primary";
  const categories = useQuery({ queryKey: categoriesKey, queryFn: fetchCategories });
  return (
    <footer className="relative overflow-hidden border-t border-border bg-secondary">
      <div className="container grid gap-10 py-16 md:grid-cols-4">
        <div className="space-y-4"><Logo /><p className="max-w-xs text-sm leading-7 text-muted-foreground">Considered streetwear. Crafted for the ones who move differently.</p></div>
        <div><h4 className="mb-4 font-display text-2xl">Shop</h4><ul className={col}><li><Link to="/shop">All products</Link></li>{categories.data?.slice(0, 3).map((category) => <li key={category.id}><Link to={`/shop?category=${encodeURIComponent(category.slug)}`}>{category.name}</Link></li>)}<li><Link to="/custom">Custom clothing</Link></li></ul></div>
        <div><h4 className="mb-4 font-display text-2xl">The house</h4><ul className={col}><li><Link to="/membership">Membership</Link></li><li><Link to="/about">About us</Link></li><li><Link to="/contact">Contact</Link></li><li><Link to="/account">My account</Link></li></ul></div>
        <div><h4 className="mb-4 font-display text-2xl">Information</h4><ul className={col}><li><Link to="/privacy-policy">Privacy</Link></li><li><Link to="/terms">Terms & conditions</Link></li><li><Link to="/refund-policy">Refunds</Link></li><li><Link to="/shipping-policy">Shipping</Link></li></ul></div>
      </div>
      <div aria-hidden="true" className="pointer-events-none select-none overflow-hidden px-2 font-display text-[27vw] leading-[.72] tracking-[-.04em] text-foreground/[.035]">BLACK WOLF</div>
      <div className="border-t border-border py-5 text-center text-sm text-muted-foreground">© {new Date().getFullYear()} BLACK WOLF. All rights reserved.</div>
    </footer>
  );
}
