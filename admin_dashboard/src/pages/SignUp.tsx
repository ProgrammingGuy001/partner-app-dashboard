
import { authAPI } from "@/api/services"
import { SignupForm } from "@/components/signup-form"
import { ThemeToggle } from "@/components/theme-toggle"
import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"

export default function SignupPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | undefined>()

  const handleSignup = async ({
    email,
    password,
  }: {
    email: string
    password: string
  }) => {
    setLoading(true)
    setError(undefined)

    try {
      await authAPI.signup({ email, password })
      toast.success("Account created. Sign in to continue.")
      navigate("/login")
    } catch (err: any) {
      if (err.response?.data?.detail) {
        setError(err.response.data.detail);
      } else if (err.message) {
        setError(err.message);
      } else {
        setError('An error occurred while creating the account');
      }
    } finally {
      setLoading(false)
    }
  }
  return (
    <div className="relative min-h-svh overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(155,124,115,0.18),transparent_30%),linear-gradient(160deg,#f8f3ee_0%,#fbfaf8_55%,#efe6dd_100%)] dark:bg-[radial-gradient(circle_at_top_left,rgba(184,137,127,0.18),transparent_28%),linear-gradient(160deg,#140b0b_0%,#1c0f0f_52%,#241313_100%)]">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.14)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.1)_1px,transparent_1px)] bg-[size:120px_120px] opacity-25 dark:opacity-10" />
      <div className="absolute right-4 top-4 z-10 rounded-full border border-border/60 bg-background/85 p-1 shadow-sm backdrop-blur sm:right-6 sm:top-6">
        <ThemeToggle />
      </div>

      <div className="relative mx-auto flex min-h-svh max-w-6xl items-center justify-center px-4 py-10 sm:px-6 lg:px-8">
        <div className="w-full max-w-lg space-y-8">
          <div className="space-y-5 text-center">
            <a
              href="https://www.modula.in/"
              className="mx-auto inline-flex items-center rounded-full bg-white/90 px-5 py-3 shadow-lg shadow-black/10 dark:bg-white/95"
            >
              <img src="/logo.png" alt="Modula" className="h-8 w-auto object-contain" />
            </a>

          </div>

        <SignupForm 
          onSubmit={handleSignup}
          loading={loading}
          error={error}
        />
        </div>
      </div>
    </div>
  )
}
