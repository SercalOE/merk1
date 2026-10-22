import type { Metadata } from "next";
import { FormularioLogin } from "./formulario-login";

export const metadata: Metadata = { title: "Entrar · Merk1" };

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm space-y-6 rounded-lg border border-neutral-200 bg-white p-8 shadow-sm">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Merk1</h1>
          <p className="text-sm text-neutral-600">
            Te enviaremos un código de 6 dígitos a tu correo.
          </p>
        </div>
        <FormularioLogin />
      </div>
    </main>
  );
}
