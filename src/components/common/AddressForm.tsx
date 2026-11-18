import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";

export const addressSchema = z.object({
  full_name: z.string().trim().min(2, "Enter the full name").max(100),
  phone: z.string().trim().regex(/^[0-9+\-\s]{7,20}$/, "Enter a valid phone number"),
  line1: z.string().trim().min(3, "Enter the address").max(200),
  line2: z.string().trim().max(200).optional().or(z.literal("")),
  city: z.string().trim().min(2, "Enter the city").max(100),
  state: z.string().trim().min(2, "Enter the state").max(100),
  postal_code: z.string().trim().regex(/^[0-9A-Za-z\- ]{3,12}$/, "Enter a valid PIN / postal code"),
  country: z.string().trim().length(2).default("IN"),
});
export type AddressValues = z.infer<typeof addressSchema>;

export function AddressForm({ defaults, onSubmit, submitLabel = "Save address", busy }: {
  defaults?: Partial<AddressValues>; onSubmit: (v: AddressValues) => void | Promise<void>; submitLabel?: string; busy?: boolean;
}) {
  const { register, handleSubmit, formState: { errors } } = useForm<AddressValues>({
    resolver: zodResolver(addressSchema), defaultValues: { country: "IN", ...defaults },
  });
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 md:grid-cols-2" noValidate>
      <Field label="Full name" error={errors.full_name?.message}><Input {...register("full_name")} autoComplete="name" /></Field>
      <Field label="Phone" error={errors.phone?.message}><Input {...register("phone")} autoComplete="tel" /></Field>
      <Field label="Address line 1" error={errors.line1?.message} className="md:col-span-2"><Input {...register("line1")} autoComplete="address-line1" /></Field>
      <Field label="Address line 2 (optional)" error={errors.line2?.message} className="md:col-span-2"><Input {...register("line2")} autoComplete="address-line2" /></Field>
      <Field label="City" error={errors.city?.message}><Input {...register("city")} autoComplete="address-level2" /></Field>
      <Field label="State" error={errors.state?.message}><Input {...register("state")} autoComplete="address-level1" /></Field>
      <Field label="PIN code" error={errors.postal_code?.message}><Input {...register("postal_code")} autoComplete="postal-code" /></Field>
      <input type="hidden" {...register("country")} />
      <div className="md:col-span-2"><Button loading={busy}>{submitLabel}</Button></div>
    </form>
  );
}
