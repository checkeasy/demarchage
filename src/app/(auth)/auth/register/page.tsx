"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { z } from "zod";
import { toast } from "sonner";
import { Mail, Lock, User, Chrome, Loader2 } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const registerSchema = z
  .object({
    fullName: z
      .string()
      .min(1, "Le nom complet est requis")
      .min(2, "Le nom doit contenir au moins 2 caracteres"),
    email: z
      .string()
      .min(1, "L'email est requis")
      .email("Veuillez entrer un email valide"),
    password: z
      .string()
      .min(1, "Le mot de passe est requis")
      .min(8, "Le mot de passe doit contenir au moins 8 caracteres"),
    confirmPassword: z
      .string()
      .min(1, "Veuillez confirmer votre mot de passe"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Les mots de passe ne correspondent pas",
    path: ["confirmPassword"],
  });

type RegisterFormData = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const supabase = createClient();

  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});

    const result = registerSchema.safeParse(formData);
    if (!result.success) {
      const fieldErrors: Partial<Record<string, string>> = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0] as string;
        if (!fieldErrors[field]) {
          fieldErrors[field] = issue.message;
        }
      }
      setErrors(fieldErrors);
      return;
    }

    setIsLoading(true);

    const { error } = await supabase.auth.signUp({
      email: result.data.email,
      password: result.data.password,
      options: {
        data: {
          full_name: result.data.fullName,
        },
        emailRedirectTo: `${window.location.origin}/auth/confirm`,
      },
    });

    setIsLoading(false);

    if (error) {
      if (error.message.includes("already registered")) {
        toast.error("Cet email est deja utilise. Essayez de vous connecter.");
      } else {
        toast.error(error.message);
      }
      return;
    }

    toast.success("Verifiez votre email pour confirmer votre compte");
    router.push("/auth/login");
  }

  async function handleGoogleSignUp() {
    setIsGoogleLoading(true);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setIsGoogleLoading(false);
      toast.error("Erreur lors de l'inscription avec Google");
    }
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-bold">ColdReach</CardTitle>
        <CardDescription>
          Creez votre compte pour commencer
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Nom complet</Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                id="fullName"
                name="fullName"
                type="text"
                placeholder="Jean Dupont"
                value={formData.fullName}
                onChange={handleChange}
                className="pl-10"
                disabled={isLoading}
                autoComplete="name"
              />
            </div>
            {errors.fullName && (
              <p className="text-sm text-destructive">{errors.fullName}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="vous@exemple.com"
                value={formData.email}
                onChange={handleChange}
                className="pl-10"
                disabled={isLoading}
                autoComplete="email"
              />
            </div>
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Mot de passe</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="Minimum 8 caracteres"
                value={formData.password}
                onChange={handleChange}
                className="pl-10"
                disabled={isLoading}
                autoComplete="new-password"
              />
            </div>
            {errors.password && (
              <p className="text-sm text-destructive">{errors.password}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirmer le mot de passe</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                placeholder="Retapez votre mot de passe"
                value={formData.confirmPassword}
                onChange={handleChange}
                className="pl-10"
                disabled={isLoading}
                autoComplete="new-password"
              />
            </div>
            {errors.confirmPassword && (
              <p className="text-sm text-destructive">{errors.confirmPassword}</p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="animate-spin" />
                Creation en cours...
              </>
            ) : (
              "Creer un compte"
            )}
          </Button>
        </form>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">ou</span>
          </div>
        </div>

        <Button
          variant="outline"
          className="w-full"
          onClick={handleGoogleSignUp}
          disabled={isGoogleLoading}
        >
          {isGoogleLoading ? (
            <>
              <Loader2 className="animate-spin" />
              Redirection...
            </>
          ) : (
            <>
              <Chrome className="size-4" />
              Se connecter avec Google
            </>
          )}
        </Button>
      </CardContent>

      <CardFooter className="justify-center">
        <p className="text-sm text-muted-foreground">
          Vous avez deja un compte ?{" "}
          <Link
            href="/auth/login"
            className="text-primary font-medium hover:underline"
          >
            Se connecter
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
