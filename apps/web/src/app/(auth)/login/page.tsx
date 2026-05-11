import type { Metadata } from 'next';
import Image from 'next/image';
import { LoginForm } from '@/components/auth/login-form';

export const metadata: Metadata = { title: 'Login' };

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30">
      <div className="w-full max-w-md space-y-8 px-4">
        <div className="flex flex-col items-center gap-2">
          {/* Logo completa preta */}
          <Image
            src="/logo-black.png"
            alt="Chronos.AI"
            width={300}
            height={150}
            className="object-contain"
            priority
          />
          <p className="text-sm text-muted-foreground">
            Entre com sua conta para acessar o painel
          </p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
