import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '@/api/services';
import { LoginForm } from '@/components/login-form';
import { toast } from 'sonner';

const Login: React.FC = () => {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (data: { email: string; password: string }) => {
    setError('');
    setLoading(true);

    try {
      await authAPI.login(data);
      // Cookie is set by backend
      toast.success('Logged in successfully');
      navigate('/dashboard');
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
        toast.error(err.message);
      } else {
        setError('Login failed');
        toast.error('Login failed');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-zinc-50 flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
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
        <LoginForm
          onSubmit={handleLogin}
          loading={loading}
          error={error}
        />
      </div>
    </div>
  )
};

export default Login;