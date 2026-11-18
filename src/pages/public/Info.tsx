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
import { fetchSetting, sendContact } from "@/services/catalog";
import { errorMessage } from "@/lib/utils";

export function About() {
  return (
    <>
      <PageHeader eyebrow="Our story" title="About Black Wolf" />
      <div className="container prose-policy max-w-3xl py-12">
        <p className="text-lg text-foreground">BLACK WOLF is a premium streetwear label for people who move in their own direction.</p>
        <p className="mt-4">We design T-shirts and track pants, print custom artwork on request, and run a members club that rewards our community with exclusive pricing and early access.</p>
        <h2>What we stand for</h2>
        <ul><li>Quality fabrics and honest pricing</li><li>Designs you can personalise</li><li>A community that gets rewarded for sticking around</li></ul>
        <Button className="mt-8" asChild><Link to="/shop">Explore the collection</Link></Button>
      </div>
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
