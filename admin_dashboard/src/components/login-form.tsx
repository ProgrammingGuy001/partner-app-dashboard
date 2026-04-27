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
import { Input } from "@/components/ui/input"
import {
  AlertCircle,
  ArrowRight,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
} from "lucide-react"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Link } from "react-router-dom"
import * as z from "zod"

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
})

type LoginValues = z.infer<typeof loginSchema>

export function LoginForm({
  className,
  onSubmit,
  loading,
  error,
}: {
  onSubmit: (data: LoginValues) => void
  loading?: boolean
  error?: string
  className?: string
}) {
  const [showPassword, setShowPassword] = useState(false)
  const { register, handleSubmit, formState: { errors } } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  })

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className={cn("flex flex-col gap-6", className)}
      noValidate
    >
      <Card className="gap-0 overflow-hidden rounded-[1.75rem] border-border/70 bg-card/92 py-0 shadow-[0_24px_80px_-42px_rgba(58,26,26,0.4)] backdrop-blur">
        <CardHeader className="space-y-4 border-b border-border/70 px-5 py-6 text-left sm:px-8 sm:py-8">

          <div className="space-y-2">
            <CardTitle className="text-2xl font-semibold tracking-tight sm:text-3xl">Welcome back</CardTitle>
            <CardDescription className="max-w-sm text-[15px] leading-6">
              Sign in to manage jobs, workers, analytics, and site requisites from one place.
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="px-5 py-6 sm:px-8 sm:py-8">
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
                  autoComplete="email"
                  {...register("email")}
                  aria-invalid={!!errors.email}
                />
              </div>
              <FieldError errors={[errors.email]} className="text-xs" />
            </Field>

            <Field className="gap-2.5">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                <FieldLabel htmlFor="password" className="text-sm font-medium text-foreground">
                  Password
                </FieldLabel>
                <span className="text-xs font-medium text-muted-foreground">
                  Contact an admin if access needs to be reset.
                </span>
              </div>

              <div className="relative">
                <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  className="h-12 rounded-xl border-border/70 bg-background/80 pl-11 pr-12"
                  autoComplete="current-password"
                  {...register("password")}
                  aria-invalid={!!errors.password}
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
              <FieldError errors={[errors.password]} className="text-xs" />
            </Field>

            {error && (
              <div className="flex items-start gap-3 rounded-2xl border border-destructive/20 bg-destructive/8 px-4 py-3 text-sm text-destructive">
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <p>{error}</p>
              </div>
            )}

            <Button type="submit" disabled={loading} className="h-12 w-full rounded-xl text-sm font-semibold shadow-lg shadow-primary/15">
              {loading ? "Signing you in..." : "Sign in to dashboard"}
              {!loading && <ArrowRight className="size-4" />}
            </Button>

            <div className="rounded-2xl bg-muted/55 px-4 py-4 text-sm leading-6 text-muted-foreground">
              Don&apos;t have an account yet?{" "}
              <Link to="/register" className="font-semibold text-primary transition-colors hover:text-primary/80">
                Create an admin account
              </Link>
              .
            </div>

            
          </FieldGroup>
        </CardContent>
      </Card>

      <FieldDescription className="px-2 text-center text-xs leading-6 sm:px-6">
        By clicking continue, you agree to our{" "}
        <a href="#">Terms of Service</a> and{" "}
        <a href="#">Privacy Policy</a>.
      </FieldDescription>
    </form>
  )
}
