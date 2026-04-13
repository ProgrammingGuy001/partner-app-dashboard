import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "./ui/input"
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  ShieldCheck,
} from "lucide-react"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Link } from "react-router-dom"
import { z } from "zod"

const signupSchema = z
  .object({
    email: z.string().min(1, "Email is required").email("Enter a valid email address"),
    password: z
      .string()
      .min(1, "Password is required")
      .min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })

type SignupValues = z.infer<typeof signupSchema>

export function SignupForm({
  className,
  onSubmit,
  loading,
  error,
}: {
  onSubmit: (data: { email: string; password: string }) => void
  loading?: boolean
  error?: string
  className?: string
}) {
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
  })

  const onFormSubmit = ({ email, password }: SignupValues) => {
    onSubmit({ email, password })
  }

  return (
    <div className={cn("flex flex-col gap-6", className)}>
      <Card className="gap-0 overflow-hidden rounded-[1.75rem] border-border/70 bg-card/92 py-0 shadow-[0_24px_80px_-42px_rgba(58,26,26,0.4)] backdrop-blur">
        <CardHeader className="space-y-4 border-b border-border/70 px-8 py-8 text-left">
          
          <div className="space-y-2">
            <CardTitle className="text-3xl font-semibold tracking-tight">Create your account</CardTitle>
            <CardDescription className="max-w-sm text-[15px] leading-6">
              Set up a clean admin login for day-to-day operations, reporting, and worker coordination.
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="px-8 py-8">
          <form onSubmit={handleSubmit(onFormSubmit)} noValidate>
            <FieldGroup className="gap-5">
              <Field className="gap-2.5">
                <FieldLabel htmlFor="email" className="text-sm font-medium text-foreground">
                  Work Email
                </FieldLabel>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@modula.in"
                    className="h-12 rounded-xl border-border/70 bg-background/80 pl-11"
                    aria-invalid={!!errors.email}
                    aria-describedby={errors.email ? "email-error" : undefined}
                    autoComplete="email"
                    {...register("email")}
                  />
                </div>
                <FieldError errors={[errors.email]} id="email-error" className="text-xs" />
              </Field>

              <Field className="gap-2.5">
                <FieldLabel htmlFor="password" className="text-sm font-medium text-foreground">
                  Password
                </FieldLabel>
                <div className="relative">
                  <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    className="h-12 rounded-xl border-border/70 bg-background/80 pl-11 pr-12"
                    placeholder="Create a strong password"
                    aria-invalid={!!errors.password}
                    aria-describedby={errors.password ? "password-error" : undefined}
                    autoComplete="new-password"
                    {...register("password")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="absolute right-3 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                <FieldError errors={[errors.password]} id="password-error" className="text-xs" />
              </Field>

              <Field className="gap-2.5">
                <FieldLabel htmlFor="confirm-password" className="text-sm font-medium text-foreground">
                  Confirm Password
                </FieldLabel>
                <div className="relative">
                  <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="confirm-password"
                    type={showConfirmPassword ? "text" : "password"}
                    className="h-12 rounded-xl border-border/70 bg-background/80 pl-11 pr-12"
                    placeholder="Repeat the password"
                    aria-invalid={!!errors.confirmPassword}
                    aria-describedby={errors.confirmPassword ? "confirm-password-error" : undefined}
                    autoComplete="new-password"
                    {...register("confirmPassword")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((value) => !value)}
                    className="absolute right-3 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    aria-label={showConfirmPassword ? "Hide confirmed password" : "Show confirmed password"}
                  >
                    {showConfirmPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                <FieldError errors={[errors.confirmPassword]} id="confirm-password-error" className="text-xs" />
              </Field>

              <div className="rounded-2xl border border-primary/10 bg-primary/5 px-4 py-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
                  <CheckCircle2 className="size-4 text-primary" />
                  Password guidance
                </div>
                <p className="text-sm leading-6 text-muted-foreground">
                  Use at least 8 characters and prefer a phrase or mixed-character password that is easy for you to remember but hard to guess.
                </p>
              </div>

              {error && (
                <div role="alert" className="flex items-start gap-3 rounded-2xl border border-destructive/20 bg-destructive/8 px-4 py-3 text-sm text-destructive">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  <p>{error}</p>
                </div>
              )}

              <Button type="submit" disabled={loading} className="h-12 w-full rounded-xl text-sm font-semibold shadow-lg shadow-primary/15">
                {loading ? "Creating account..." : "Create admin account"}
                {!loading && <ArrowRight className="size-4" />}
              </Button>

              <div className="rounded-2xl bg-muted/55 px-4 py-4 text-sm leading-6 text-muted-foreground">
                Already have an account?{" "}
                <Link to="/login" className="font-semibold text-primary transition-colors hover:text-primary/80">
                  Sign in instead
                </Link>
                .
              </div>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
      <FieldDescription className="px-2 text-center text-xs leading-6 sm:px-6">
        By clicking continue, you agree to our <a href="#">Terms of Service</a>{" "}
        and <a href="#">Privacy Policy</a>.
      </FieldDescription>
    </div>
  )
}
