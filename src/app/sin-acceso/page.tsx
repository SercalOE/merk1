import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Sin acceso · Merk1" };

export default function SinAccesoPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm space-y-4 rounded-lg border border-neutral-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Sin acceso</h1>
        <p className="text-sm text-neutral-600">
          Este correo no tiene acceso a Merk1. Si crees que es un error, pide
          acceso al equipo de mercadeo.
        </p>
        <Link
          href="/login"
          className="inline-block text-sm font-medium underline-offset-4 hover:underline"
        >
          Volver a iniciar sesión
        </Link>
      </div>
    </main>
  );
}
