import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isConfigured = Boolean(url && anon);

// Never put the service-role key in the frontend. Only the anon key is used here; RLS protects all data.
export const supabase = createClient(url ?? "http://localhost:54321", anon ?? "missing-anon-key", {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

export const publicImageUrl = (path: string | null | undefined, bucket = "product-images") =>
  path ? supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl : "";

/** Call an Edge Function with the user's JWT and surface our structured error messages. */
export async function invokeFn<T>(name: string, body: unknown): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body: body as Record<string, unknown> });
  if (error) {
    let message = error.message;
    try {
      const ctx = (error as { context?: Response }).context;
      if (ctx) { const j = await ctx.json(); message = j.message ?? j.error ?? message; }
    } catch { /* keep default */ }
    throw new Error(message);
  }
  return data as T;
}
