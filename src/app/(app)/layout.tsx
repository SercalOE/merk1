import { connection } from "next/server";
import { Suspense } from "react";
import { requerirUsuario } from "@/lib/auth";

// Todo lo que está dentro de (app) requiere sesión y correo permitido.
// La revisión va dentro de Suspense porque lee cookies (Cache Components).
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-neutral-500">Cargando…</p>}>
      <Protegido>{children}</Protegido>
    </Suspense>
  );
}

async function Protegido({ children }: { children: React.ReactNode }) {
  // Supabase usa Date.now() al revisar la sesión: se marca como dinámico antes.
  await connection();
  await requerirUsuario();
  return <>{children}</>;
}
