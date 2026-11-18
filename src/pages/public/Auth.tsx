import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Logo } from "@/components/common/Logo";
import { supabase, isConfigured } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { errorMessage } from "@/lib/utils";

const loginSchema = z.object({ email: z.string().trim().email("Enter a valid email"), password: z.string().min(1, "Enter your password") });
const registerSchema = z.object({
  full_name: z.string().trim().min(2, "Enter your name").max(100),
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(8, "At least 8 characters").max(72),
  confirm: z.string(),
}).refine((v) => v.password === v.confirm, { message: "Passwords do not match", path: ["confirm"] });

function Shell({ title, children, footer }: { title: string; children: React.ReactNode; footer: React.ReactNode }) {
  return (
    <div className="container flex min-h-[80vh] items-center justify-center py-12">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-8">
        <div className="mb-6 flex justify-center"><Logo /></div>
        <h1 className="mb-6 text-center text-4xl">{title}</h1>
        {!isConfigured && <p className="mb-4 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-300">Supabase is not configured. Copy .env.example to .env and add your project URL and anon key.</p>}
        {children}
        <p className="mt-6 text-center text-sm text-muted-foreground">{footer}</p>
      </div>
    </div>
  );
}

export function Login() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const from = (useLocation().state as { from?: string } | null)?.from ?? "/account";
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.infer<typeof loginSchema>>({ resolver: zodResolver(loginSchema) });
  if (user) return <Navigate to={from} replace />;
  return (
    <Shell title="Sign in" footer={<>New here? <Link to="/register" state={{ from }} className="text-silver underline">Create an account</Link></>}>
      <form className="space-y-4" noValidate onSubmit={handleSubmit(async (v) => {
        const { error } = await supabase.auth.signInWithPassword(v);
        if (error) toast.error(error.message); else navigate(from, { replace: true });
      })}>
        <Field label="Email" error={errors.email?.message}><Input type="email" autoComplete="email" {...register("email")} /></Field>
        <Field label="Password" error={errors.password?.message}><Input type="password" autoComplete="current-password" {...register("password")} /></Field>
        <Button className="w-full" loading={isSubmitting}>Sign in</Button>
      </form>
    </Shell>
  );
}

export function Register() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const from = (useLocation().state as { from?: string } | null)?.from ?? "/account";
  const [sent, setSent] = useState(false);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.infer<typeof registerSchema>>({ resolver: zodResolver(registerSchema) });
  if (user) return <Navigate to={from} replace />;
  if (sent) return <Shell title="Check your email" footer={<Link to="/login" className="text-silver underline">Back to sign in</Link>}><p className="text-center text-sm text-muted-foreground">We sent a confirmation link. Click it to activate your account.</p></Shell>;
  return (
    <Shell title="Create account" footer={<>Already registered? <Link to="/login" className="text-silver underline">Sign in</Link></>}>
      <form className="space-y-4" noValidate onSubmit={handleSubmit(async (v) => {
        try {
          const { data, error } = await supabase.auth.signUp({ email: v.email, password: v.password, options: { data: { full_name: v.full_name }, emailRedirectTo: window.location.origin } });
          if (error) throw error;
          if (data.session) navigate(from, { replace: true }); else setSent(true);
        } catch (e) { toast.error(errorMessage(e)); }
      })}>
        <Field label="Full name" error={errors.full_name?.message}><Input autoComplete="name" {...register("full_name")} /></Field>
        <Field label="Email" error={errors.email?.message}><Input type="email" autoComplete="email" {...register("email")} /></Field>
        <Field label="Password" error={errors.password?.message}><Input type="password" autoComplete="new-password" {...register("password")} /></Field>
        <Field label="Confirm password" error={errors.confirm?.message}><Input type="password" autoComplete="new-password" {...register("confirm")} /></Field>
        <Button className="w-full" loading={isSubmitting}>Create account</Button>
      </form>
    </Shell>
  );
}
