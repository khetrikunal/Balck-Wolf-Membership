import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { QueryBoundary } from "@/components/common/States";
import { AddressForm, type AddressValues } from "@/components/common/AddressForm";
import { useAuth } from "@/hooks/useAuth";
import * as acc from "@/services/account";
import { runPayment } from "@/lib/payFlow";
import { errorMessage, formatDate, formatINR } from "@/lib/utils";
import type { CustomRequest } from "@/types/db";

const SIZES = ["XS", "S", "M", "L", "XL", "XXL"];
const TYPES = ["T-shirt", "Track pants"];

const schema = z.object({
  clothing_type: z.string().min(1), size: z.string().min(1, "Select a size"), color: z.string().trim().min(2, "Enter a colour").max(40),
  quantity: z.coerce.number().int().min(1).max(500), instructions: z.string().trim().max(2000).optional().or(z.literal("")),
});

export function NewCustomRequest() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [files, setFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState<string>();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { clothing_type: TYPES[0], quantity: 1 } });

  function pick(list: FileList | null) {
    const arr = Array.from(list ?? []);
    const bad = arr.find((f) => !acc.ALLOWED_MIME.includes(f.type) || f.size > acc.MAX_UPLOAD_BYTES);
    if (bad) { setFileError(`${bad.name}: use JPG, PNG or WebP under 10 MB`); return; }
    if (arr.length > 5) { setFileError("Up to 5 images"); return; }
    setFileError(undefined); setFiles(arr);
  }

  return (<><h1 className="mb-6 text-5xl">New custom request</h1>
    <Card className="max-w-2xl"><CardContent className="pt-5">
      <form noValidate className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit(async (v) => {
        if (files.length === 0) { setFileError("Upload at least one design image"); return; }
        try { await acc.submitCustomRequest(user!.id, { ...v, instructions: v.instructions ?? "", files }); toast.success("Request submitted"); qc.invalidateQueries({ queryKey: ["custom"] }); navigate("/account/custom"); }
        catch (e) { toast.error(errorMessage(e)); }
      })}>
        <Field label="Clothing type"><Select {...register("clothing_type")}>{TYPES.map((t) => <option key={t}>{t}</option>)}</Select></Field>
        <Field label="Size" error={errors.size?.message}><Select {...register("size")} defaultValue=""><option value="" disabled>Select</option>{SIZES.map((s) => <option key={s}>{s}</option>)}</Select></Field>
        <Field label="Colour" error={errors.color?.message}><Input {...register("color")} placeholder="e.g. Black" /></Field>
        <Field label="Quantity" error={errors.quantity?.message}><Input type="number" min={1} {...register("quantity")} /></Field>
        <Field label="Design images (JPG, PNG, WebP · max 10 MB each)" error={fileError} className="md:col-span-2"><Input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(e) => pick(e.target.files)} /></Field>
        <Field label="Instructions" error={errors.instructions?.message} className="md:col-span-2"><Textarea {...register("instructions")} placeholder="Placement, print size, text changes…" /></Field>
        <div className="md:col-span-2"><Button loading={isSubmitting}>Submit request</Button></div>
      </form></CardContent></Card></>);
}

function Quote({ req }: { req: CustomRequest }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [paying, setPaying] = useState(false);
  const quote = [...(req.custom_design_quotes ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  const accept = useMutation({ mutationFn: () => acc.acceptQuote(quote.id), onSuccess: () => { toast.success("Quotation accepted"); qc.invalidateQueries({ queryKey: ["custom"] }); }, onError: (e) => toast.error(errorMessage(e)) });
  if (!quote) return null;

  async function pay(addr: AddressValues) {
    try {
      const start = await acc.startCustomOrder({ quote_id: quote.id, address: { ...addr, line2: addr.line2 || null } });
      const res = await runPayment(start, { name: addr.full_name, email: user?.email ?? undefined, contact: addr.phone }, "Custom order");
      toast.success(res.status === "pending" ? "Payment received — confirming" : "Payment confirmed");
      qc.invalidateQueries(); setPaying(false);
    } catch (e) { toast.error(errorMessage(e)); }
  }

  return (
    <div className="mt-4 rounded-md border border-border p-4 text-sm">
      <p className="flex items-center justify-between"><span>Quotation: <strong>{formatINR(quote.amount)}</strong></span><Badge status={quote.status} /></p>
      {quote.notes && <p className="mt-1 text-muted-foreground">{quote.notes}</p>}
      {req.status === "quotation_sent" && <div className="mt-3 flex gap-2"><Button size="sm" loading={accept.isPending} onClick={() => accept.mutate()}>Accept quotation</Button></div>}
      {req.status === "accepted" && !paying && <Button size="sm" className="mt-3" onClick={() => setPaying(true)}>Pay {formatINR(quote.amount)}</Button>}
      {paying && <div className="mt-4"><p className="mb-3 font-semibold">Delivery address</p><AddressForm submitLabel={`Pay ${formatINR(quote.amount)}`} onSubmit={pay} /></div>}
    </div>
  );
}

export function CustomRequests() {
  const { user } = useAuth();
  const q = useQuery({ queryKey: ["custom", user?.id], queryFn: acc.fetchMyCustomRequests });
  return (<><div className="mb-6 flex items-center justify-between"><h1 className="text-5xl">Custom design requests</h1><Button asChild><Link to="/account/custom/new">New request</Link></Button></div>
    <QueryBoundary query={q} empty={{ title: "No custom requests", hint: "Upload your artwork to get a quotation.", action: <Button asChild><Link to="/account/custom/new">Start a request</Link></Button> }}>
      {(list) => (<div className="space-y-4">{list.map((r) => (
        <Card key={r.id}><CardHeader><CardTitle className="flex items-center justify-between">{r.clothing_type} · {r.size} · {r.color} × {r.quantity}<Badge status={r.status} /></CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground"><p>Submitted {formatDate(r.created_at)} · {r.custom_design_files?.length ?? 0} file(s)</p>
            {r.instructions && <p className="mt-1">{r.instructions}</p>}
            {r.admin_notes && <p className="mt-2 text-foreground">Note from us: {r.admin_notes}</p>}
            <Quote req={r} /></CardContent></Card>))}</div>)}
    </QueryBoundary></>);
}
