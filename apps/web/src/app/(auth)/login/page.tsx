import type { Metadata } from 'next';
import { LoginForm } from '@/components/auth/login-form';

export const metadata: Metadata = { title: 'Login' };

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30">
      <div className="w-full max-w-md space-y-8 px-4">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight">AgendaFlow</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Entre com sua conta para acessar o painel
          </p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
