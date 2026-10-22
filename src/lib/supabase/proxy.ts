import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { correoPermitido } from "@/lib/acceso";
import { configSupabase } from "./config";

const RUTAS_PUBLICAS = ["/login", "/sin-acceso"];

// Refresca la sesión en cada request y aplica los dos candados:
// sin sesión → /login; con sesión pero correo fuera de la lista → cierra sesión y /sin-acceso.
export async function actualizarSesion(request: NextRequest) {
  const { url, llave } = configSupabase();
  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, llave, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
        Object.entries(headers ?? {}).forEach(([nombre, valor]) =>
          response.headers.set(nombre, valor),
        );
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  const ruta = request.nextUrl.pathname;
  const esPublica = RUTAS_PUBLICAS.some(
    (r) => ruta === r || ruta.startsWith(`${r}/`),
  );

  // La redirección conserva las cookies que Supabase haya escrito.
  const redirigir = (destino: string) => {
    const destinoUrl = request.nextUrl.clone();
    destinoUrl.pathname = destino;
    destinoUrl.search = "";
    const redireccion = NextResponse.redirect(destinoUrl);
    response.cookies.getAll().forEach((c) => redireccion.cookies.set(c));
    return redireccion;
  };

  if (!claims) {
    return esPublica ? response : redirigir("/login");
  }

  if (!correoPermitido(claims.email as string | undefined)) {
    await supabase.auth.signOut();
    return ruta === "/sin-acceso" ? response : redirigir("/sin-acceso");
  }

  if (ruta === "/login") {
    return redirigir("/");
  }

  return response;
}
