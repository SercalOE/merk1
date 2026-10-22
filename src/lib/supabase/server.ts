import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { configSupabase } from "./config";

// Cliente para Server Components, Server Actions y Route Handlers.
export async function crearClienteServidor() {
  const { url, llave } = configSupabase();
  const cookieStore = await cookies();

  return createServerClient(url, llave, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Un Server Component no puede escribir cookies; el proxy refresca la sesión.
        }
      },
    },
  });
}
