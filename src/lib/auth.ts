import { redirect } from "next/navigation";
import { correoPermitido } from "@/lib/acceso";
import { crearClienteServidor } from "@/lib/supabase/server";

export type Usuario = { id: string; email: string };

// Segunda defensa después del proxy. getUser() consulta al servidor de Auth,
// así que también confirma que el usuario sigue existiendo en Supabase.
export async function requerirUsuario(): Promise<Usuario> {
  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");
  if (!user.email || !correoPermitido(user.email)) redirect("/sin-acceso");

  return { id: user.id, email: user.email };
}
