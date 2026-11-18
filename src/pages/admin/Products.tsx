import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Archive, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { QueryBoundary } from "@/components/common/States";
import { AdminTitle, Modal, Table, useAction } from "@/components/admin/ui";
import * as api from "@/services/admin";
import { publicImageUrl } from "@/lib/supabase";
import { errorMessage, formatINR } from "@/lib/utils";
import type { Product } from "@/types/db";

const schema = z.object({
  name: z.string().trim().min(2, "Enter a name").max(120), description: z.string().trim().max(4000).optional().or(z.literal("")),
  category_id: z.string().optional().or(z.literal("")),
  regular_price: z.coerce.number().min(0, "Invalid price"),
  member_price: z.union([z.literal(""), z.coerce.number().min(0)]).optional(),
  is_featured: z.boolean(), is_new_arrival: z.boolean(), is_exclusive: z.boolean(), is_customizable: z.boolean(),
  status: z.enum(["draft", "active", "archived"]),
}).refine((v) => v.member_price === "" || v.member_price === undefined || Number(v.member_price) <= v.regular_price, { message: "Member price cannot exceed regular price", path: ["member_price"] });
type FormValues = z.infer<typeof schema>;

function VariantsEditor({ product }: { product: Product }) {
  const [v, setV] = useState({ size: "", color: "", stock: "0", price_override: "", member_price_override: "" });
  const add = useAction(async () => {
    if (!v.size.trim() || !v.color.trim()) throw new Error("Size and colour are required");
    await api.saveVariant({ product_id: product.id, size: v.size.trim(), color: v.color.trim(), stock: Math.max(0, parseInt(v.stock || "0", 10)),
      price_override: v.price_override === "" ? null : Number(v.price_override), member_price_override: v.member_price_override === "" ? null : Number(v.member_price_override) });
  }, { invalidate: [["admin", "products"]], success: "Variant added", onDone: () => setV({ size: "", color: "", stock: "0", price_override: "", member_price_override: "" }) });
  const del = useAction((id: string) => api.deleteVariant(id), { invalidate: [["admin", "products"]], success: "Variant removed" });
  const live = (product.product_variants ?? []).filter((x) => x.is_active);
  return (
    <div>
      <h3 className="mb-2 text-2xl">Variants & stock</h3>
      {live.length > 0 && <Table head={["Size", "Colour", "Stock", "Price override", "Member override", ""]}>{live.map((x) => (
        <tr key={x.id}><td>{x.size}</td><td>{x.color}</td><td>{x.stock}</td><td>{x.price_override != null ? formatINR(x.price_override) : "—"}</td><td>{x.member_price_override != null ? formatINR(x.member_price_override) : "—"}</td>
          <td><button aria-label="Remove variant" onClick={() => del.mutate(x.id)}><Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" /></button></td></tr>))}</Table>}
      <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-5">
        <Input placeholder="Size" value={v.size} onChange={(e) => setV({ ...v, size: e.target.value })} aria-label="Size" />
        <Input placeholder="Colour" value={v.color} onChange={(e) => setV({ ...v, color: e.target.value })} aria-label="Colour" />
        <Input type="number" min={0} placeholder="Stock" value={v.stock} onChange={(e) => setV({ ...v, stock: e.target.value })} aria-label="Stock" />
        <Input type="number" min={0} placeholder="Price override" value={v.price_override} onChange={(e) => setV({ ...v, price_override: e.target.value })} aria-label="Price override" />
        <Input type="number" min={0} placeholder="Member override" value={v.member_price_override} onChange={(e) => setV({ ...v, member_price_override: e.target.value })} aria-label="Member price override" />
      </div>
      <Button type="button" size="sm" variant="outline" className="mt-2" loading={add.isPending} onClick={() => add.mutate(undefined as never)}><Plus className="h-4 w-4" /> Add variant</Button>
    </div>
  );
}

function ImagesEditor({ product }: { product: Product }) {
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();
  const imgs = [...(product.product_images ?? [])].sort((a, b) => a.sort_order - b.sort_order);
  const del = useAction((i: { id: string; storage_path: string }) => api.deleteProductImage(i.id, i.storage_path), { invalidate: [["admin", "products"]], success: "Image removed" });
  async function upload(files: FileList | null) {
    if (!files?.length) return; setBusy(true);
    try { let n = imgs.length; for (const f of Array.from(files)) await api.uploadProductImage(product.id, f, n++); toast.success("Uploaded"); qc.invalidateQueries({ queryKey: ["admin", "products"] }); }
    catch (e) { toast.error(errorMessage(e)); } finally { setBusy(false); }
  }
  return (
    <div>
      <h3 className="mb-2 text-2xl">Images</h3>
      <div className="flex flex-wrap gap-3">{imgs.map((i) => (
        <div key={i.id} className="relative h-24 w-20 overflow-hidden rounded border border-border"><img src={publicImageUrl(i.storage_path)} alt="" className="h-full w-full object-cover" />
          <button aria-label="Delete image" className="absolute right-1 top-1 rounded bg-black/70 p-1" onClick={() => del.mutate(i)}><Trash2 className="h-3 w-3" /></button></div>))}</div>
      <Input type="file" multiple accept="image/jpeg,image/png,image/webp" className="mt-3" disabled={busy} onChange={(e) => upload(e.target.files)} aria-label="Upload images" />
    </div>
  );
}

function ProductEditor({ product, onClose }: { product?: Product; onClose: () => void }) {
  const cats = useQuery({ queryKey: ["admin", "categories"], queryFn: api.adminCategories });
  const qc = useQueryClient();
  const [savedId, setSavedId] = useState<string | undefined>(product?.id);
  const live = useQuery({ queryKey: ["admin", "products"], queryFn: api.adminProducts });
  const current = live.data?.find((p) => p.id === savedId) ?? product;
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: product ? { name: product.name, description: product.description ?? "", category_id: product.category_id ?? "", regular_price: product.regular_price, member_price: product.member_price ?? "", is_featured: product.is_featured, is_new_arrival: product.is_new_arrival, is_exclusive: product.is_exclusive, is_customizable: product.is_customizable, status: product.status }
      : { name: "", description: "", category_id: "", regular_price: 0, member_price: "", is_featured: false, is_new_arrival: false, is_exclusive: false, is_customizable: false, status: "draft" },
  });
  const check = (label: string, name: "is_featured" | "is_new_arrival" | "is_exclusive" | "is_customizable") => (
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-white" {...register(name)} />{label}</label>);

  return (
    <Modal title={savedId ? "Edit product" : "New product"} onClose={onClose} wide>
      <form noValidate className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit(async (v) => {
        try {
          const id = await api.saveProduct({ id: savedId, name: v.name, description: v.description ?? "", category_id: v.category_id || null, regular_price: v.regular_price,
            member_price: v.member_price === "" || v.member_price === undefined ? null : Number(v.member_price), is_featured: v.is_featured, is_new_arrival: v.is_new_arrival, is_exclusive: v.is_exclusive, is_customizable: v.is_customizable, status: v.status });
          setSavedId(id); toast.success(savedId ? "Product saved" : "Product created — add variants and images below"); qc.invalidateQueries({ queryKey: ["admin", "products"] });
        } catch (e) { toast.error(errorMessage(e)); }
      })}>
        <Field label="Name" error={errors.name?.message} className="md:col-span-2"><Input {...register("name")} /></Field>
        <Field label="Description" error={errors.description?.message} className="md:col-span-2"><Textarea {...register("description")} /></Field>
        <Field label="Category"><Select {...register("category_id")}><option value="">— none —</option>{cats.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
        <Field label="Visibility"><Select {...register("status")}><option value="draft">Draft (hidden)</option><option value="active">Active (visible)</option><option value="archived">Archived</option></Select></Field>
        <Field label="Regular price (₹)" error={errors.regular_price?.message}><Input type="number" step="0.01" {...register("regular_price")} /></Field>
        <Field label="Member price (₹)" error={errors.member_price?.message}><Input type="number" step="0.01" {...register("member_price")} /></Field>
        <div className="grid grid-cols-2 gap-2 md:col-span-2">{check("Featured", "is_featured")}{check("New arrival", "is_new_arrival")}{check("Exclusive (members)", "is_exclusive")}{check("Customization enabled", "is_customizable")}</div>
        <div className="md:col-span-2"><Button loading={isSubmitting}>{savedId ? "Save product" : "Create product"}</Button></div>
      </form>
      {savedId && current && <div className="mt-8 space-y-8 border-t border-border pt-6"><ImagesEditor product={current} /><VariantsEditor product={current} /></div>}
    </Modal>
  );
}

export default function Products() {
  const q = useQuery({ queryKey: ["admin", "products"], queryFn: api.adminProducts });
  const [editing, setEditing] = useState<Product | "new" | null>(null);
  const archive = useAction((p: Product) => api.setProductStatus(p.id, p.status === "archived" ? "active" : "archived"), { invalidate: [["admin", "products"]], success: "Updated" });
  return (<><AdminTitle title="Products"><Button onClick={() => setEditing("new")}><Plus className="h-4 w-4" /> New product</Button></AdminTitle>
    <QueryBoundary query={q} empty={{ title: "No products yet", hint: "Create your first product to populate the storefront.", action: <Button onClick={() => setEditing("new")}>New product</Button> }}>
      {(list) => (<Table head={["", "Product", "Category", "Price", "Member", "Stock", "Status", ""]}>{list.map((p) => {
        const stock = (p.product_variants ?? []).filter((v) => v.is_active).reduce((n, v) => n + v.stock, 0);
        const img = [...(p.product_images ?? [])].sort((a, b) => a.sort_order - b.sort_order)[0];
        return (<tr key={p.id}><td className="w-14">{img && <img src={publicImageUrl(img.storage_path)} alt="" className="h-12 w-10 rounded object-cover" />}</td>
          <td className="font-semibold">{p.name}</td><td>{p.categories?.name ?? "—"}</td><td>{formatINR(p.regular_price)}</td><td>{p.member_price != null ? formatINR(p.member_price) : "—"}</td><td>{stock}</td><td><Badge status={p.status} /></td>
          <td className="whitespace-nowrap text-right"><Button size="icon" variant="ghost" aria-label="Edit" onClick={() => setEditing(p)}><Pencil className="h-4 w-4" /></Button>
            <Button size="icon" variant="ghost" aria-label={p.status === "archived" ? "Restore" : "Archive"} onClick={() => archive.mutate(p)}><Archive className="h-4 w-4" /></Button></td></tr>);
      })}</Table>)}
    </QueryBoundary>
    {editing && <ProductEditor product={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} />}</>);
}
