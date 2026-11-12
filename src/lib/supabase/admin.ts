import "server-only";
import { createClient } from "@supabase/supabase-js";

// Cliente con la llave secreta: salta RLS. Solo para escrituras desde el servidor.
// "server-only" hace fallar el build si este archivo llega a un componente de cliente.
export function crearClienteAdmin() {
  const url = process.env.SUPABASE_URL;
  const llave = process.env.SUPABASE_SECRET_KEY;
  if (!url || !llave) throw new Error("Faltan SUPABASE_URL o SUPABASE_SECRET_KEY");

  return createClient(url, llave, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
