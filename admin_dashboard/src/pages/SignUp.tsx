

import { authAPI } from "@/api/services"
import { SignupForm } from "@/components/signup-form"
import { useState } from "react"
import { useNavigate } from "react-router-dom"

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
      navigate("/login")
    } catch (err: any) {
      if (err.response && err.response.data && err.response.data.detail) {
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
    <div className="bg-muted flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        
        <a href="https://www.modula.in/">
                <div className="h-16 px-4 flex items-center justify-center">
  <img
    src="/logo.png"
    alt="Logo"
    className="max-h-4/6 max-w-3/4 object-contain"
  />
</div>
        </a>
        <SignupForm 
        onSubmit={handleSignup}
        loading={loading}
        error={error}
        />
      </div>
    </div>
  )
}
