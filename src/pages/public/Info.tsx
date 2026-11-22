import { useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { PageHeader } from "@/components/common/PageHeader";
import { Logo } from "@/components/common/Logo";
import { fetchSetting, sendContact } from "@/services/catalog";
import { errorMessage } from "@/lib/utils";

export function About() {
  return (
    <>
      <PageHeader eyebrow="Our story" title="About Black Wolf" subtitle="An independent point of view, made wearable." />
      <section className="container grid gap-10 py-16 md:grid-cols-[.75fr_1.25fr] md:items-center md:py-24">
        <div className="flex min-h-72 items-center justify-center border border-border bg-black p-8 md:min-h-[420px]"><Logo className="h-32 w-64 md:h-40 md:w-80" /></div>
        <div className="max-w-2xl">
          <p className="eyebrow mb-4">Strength · confidence · individuality</p>
          <h2 className="text-5xl leading-[.92] md:text-7xl">For those who stand apart.</h2>
          <p className="mt-6 text-base leading-8 text-muted-foreground">BLACK WOLF represents strength, confidence and individuality. Created for those who stand apart, our clothing combines bold identity with timeless style.</p>
          <p className="mt-4 text-sm leading-7 text-muted-foreground">We design T-shirts and track pants, print custom artwork on request, and run a members club that rewards our community with exclusive pricing and early access.</p>
          <Button className="mt-8" size="lg" asChild><Link to="/shop">Explore the collection</Link></Button>
        </div>
      </section>
      <section className="border-y border-border bg-secondary"><div className="container grid gap-8 py-14 sm:grid-cols-2 md:grid-cols-4 md:py-20">
        {[
          { src: "/download.jpg", alt: "Dark contemporary clothing store interior", label: "A considered edit" },
          { src: "/M-Armor%20Drop%20Shoulder%20T-Shirts_Sizes_%20S,%20M,%20L,%20XL,%20XXL_Buy%20Now_%20+92%20326%200069694.jpg", alt: "Black graphic drop shoulder T-shirt detail", label: "Graphic expression" },
          { src: "/Jujutsu%20Kaisen%20Manga%20Gojo%20Satoru%20Graphic%20T-shirt%20Vintage%20Washed%20T%20Shirt%20Men%20Women%20Clothing%20Oversized.jpg", alt: "Washed black oversized graphic T-shirt, front and back", label: "Everyday form" },
          { src: "/download%20(1).jpg", alt: "Streetwear collection arranged on a retail rail", label: "Made to be worn" },
        ].map((item) => <figure key={item.src} className="group overflow-hidden">
          <div className="aspect-[4/5] overflow-hidden border border-border"><img src={item.src} alt={item.alt} loading="lazy" className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.035]" /></div>
          <figcaption className="mt-3 text-[9px] uppercase tracking-[0.2em] text-primary">{item.label}</figcaption>
        </figure>)}
      </div></section>
    </>
  );
}

const contactSchema = z.object({ name: z.string().trim().min(2, "Enter your name").max(100), email: z.string().trim().email("Enter a valid email"), message: z.string().trim().min(10, "Tell us a bit more").max(2000) });

export function Contact() {
  const settings = useQuery({ queryKey: ["setting", "contact"], queryFn: () => fetchSetting<{ email?: string; phone?: string; address?: string }>("contact") });
  const [done, setDone] = useState(false);
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<z.infer<typeof contactSchema>>({ resolver: zodResolver(contactSchema) });
  return (
    <>
      <PageHeader eyebrow="Get in touch" title="Contact" />
      <div className="container grid gap-10 py-12 md:grid-cols-[1fr_320px]">
        {done ? <p className="text-lg">Thanks — we'll get back to you soon.</p> : (
          <form noValidate className="space-y-4" onSubmit={handleSubmit(async (v) => { try { await sendContact(v); setDone(true); reset(); } catch (e) { toast.error(errorMessage(e)); } })}>
            <Field label="Name" error={errors.name?.message}><Input {...register("name")} /></Field>
            <Field label="Email" error={errors.email?.message}><Input type="email" {...register("email")} /></Field>
            <Field label="Message" error={errors.message?.message}><Textarea {...register("message")} /></Field>
            <Button loading={isSubmitting}>Send message</Button>
          </form>)}
        <aside className="space-y-2 text-sm text-muted-foreground">
          {settings.data?.email && <p>Email: <a className="text-foreground" href={`mailto:${settings.data.email}`}>{settings.data.email}</a></p>}
          {settings.data?.phone && <p>Phone: {settings.data.phone}</p>}
          {settings.data?.address && <p>{settings.data.address}</p>}
        </aside>
      </div>
    </>
  );
}

export function CustomClothing() {
  return (
    <>
      <PageHeader eyebrow="Made for you" title="Custom clothing" subtitle="Bring your own artwork or choose from our designs." />
      <div className="container grid gap-6 py-12 md:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-8">
          <h2 className="text-3xl">Upload your design</h2>
          <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
            <li>Choose clothing type, size and colour</li><li>Upload your artwork (JPG, PNG or WebP, up to 10 MB)</li>
            <li>We review and send you a quotation</li><li>Accept the quote and pay securely</li><li>We produce and ship your order</li></ol>
          <Button className="mt-6" asChild><Link to="/account/custom/new">Start a request</Link></Button>
        </div>
        <div className="rounded-lg border border-border bg-card p-8">
          <h2 className="text-3xl">Black Wolf designs</h2>
          <p className="mt-4 text-sm text-muted-foreground">Prefer a ready design? Browse customizable products — admin-created designs and pricing are attached to them.</p>
          <Button variant="outline" className="mt-6" asChild><Link to="/shop">Browse products</Link></Button>
        </div>
      </div>
    </>
  );
}

const policy = (title: string, body: { h: string; p: string }[]) => function Policy() {
  return (<>
    <PageHeader eyebrow="Legal" title={title} />
    <div className="container prose-policy max-w-3xl py-12">
      <p className="mb-6 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-300">Template text — have it reviewed by a qualified professional and edit it to match your business before launch.</p>
      {body.map((s) => (<section key={s.h}><h2>{s.h}</h2><p>{s.p}</p></section>))}
    </div></>);
};

export const PrivacyPolicy = policy("Privacy Policy", [
  { h: "Information we collect", p: "We collect your name, email, phone, delivery addresses, order and payment references, and any designs you upload. Card details are handled by Razorpay and never stored by us." },
  { h: "How we use it", p: "To process orders and memberships, provide support, prevent fraud and, if you subscribe, send updates. Uploaded designs are stored privately and are visible only to you and our staff." },
  { h: "Your rights", p: "You can access, correct or request deletion of your data by contacting us." },
]);
export const Terms = policy("Terms & Conditions", [
  { h: "Orders", p: "An order is confirmed once payment is verified. We may cancel and refund an order if an item cannot be fulfilled." },
  { h: "Membership", p: "Membership is a paid, one-time purchase for the stated duration and does not auto-renew. Member pricing applies only while the membership is active. Memberships may be suspended for misuse." },
  { h: "Custom orders", p: "Custom designs begin production after you accept the quotation and pay. You confirm you own the rights to any artwork you upload." },
]);
export const RefundPolicy = policy("Refund Policy", [
  { h: "Products", p: "Unused products in original condition may be returned within the window stated here. Refunds go back to the original payment method." },
  { h: "Custom orders", p: "Custom items are made to order and are not returnable unless faulty." },
  { h: "Memberships", p: "Memberships are non-refundable once activated unless required by law." },
]);
export const ShippingPolicy = policy("Shipping Policy", [
  { h: "Processing and delivery", p: "Orders are processed after payment verification. Delivery times depend on your location and the courier." },
  { h: "Tracking", p: "When your order ships, courier name and tracking details appear in your account under the order." },
  { h: "Charges", p: "Shipping charges and any free-shipping threshold are shown at checkout." },
]);
