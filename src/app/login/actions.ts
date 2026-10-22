"use server";

import { redirect } from "next/navigation";
import { correoPermitido, normalizarCorreo } from "@/lib/acceso";
import { crearClienteServidor } from "@/lib/supabase/server";

export type EstadoLogin = {
  paso: "correo" | "codigo";
  correo: string;
  error?: string;
  aviso?: string;
};

// Errores de Supabase que significan "el usuario no existe" con shouldCreateUser: false.
const SIN_USUARIO = new Set(["otp_disabled", "signup_disabled", "user_not_found"]);
const LIMITE = new Set(["over_email_send_rate_limit", "over_request_rate_limit"]);

export async function accionLogin(
  _previo: EstadoLogin,
  formData: FormData,
): Promise<EstadoLogin> {
  const intencion = String(formData.get("intencion") ?? "");
  const correo = normalizarCorreo(String(formData.get("correo") ?? ""));

  if (intencion === "cambiar") return { paso: "correo", correo };
  if (intencion === "verificar") return verificarCodigo(correo, formData);
  return enviarCodigo(correo);
}

async function enviarCodigo(correo: string): Promise<EstadoLogin> {
  if (!correo.includes("@")) {
    return { paso: "correo", correo, error: "Escribe un correo válido." };
  }
  // Candado 1: el correo debe estar en MERK1_ALLOWED_EMAILS.
  if (!correoPermitido(correo)) redirect("/sin-acceso");

  // Candado 2: el usuario debe existir en Supabase (nunca se crea desde el login).
  const supabase = await crearClienteServidor();
  const { error } = await supabase.auth.signInWithOtp({
    email: correo,
    options: { shouldCreateUser: false },
  });

  if (error) {
    if (error.code && SIN_USUARIO.has(error.code)) redirect("/sin-acceso");
    if ((error.code && LIMITE.has(error.code)) || error.status === 429) {
      return {
        paso: "correo",
        correo,
        error: "Se pidieron demasiados códigos. Espera un minuto e intenta de nuevo.",
      };
    }
    return {
      paso: "correo",
      correo,
      error: "No se pudo enviar el código. Intenta de nuevo.",
    };
  }

  return {
    paso: "codigo",
    correo,
    aviso: `Enviamos un código de 6 dígitos a ${correo}.`,
  };
}

async function verificarCodigo(
  correo: string,
  formData: FormData,
): Promise<EstadoLogin> {
  if (!correoPermitido(correo)) redirect("/sin-acceso");

  const codigo = String(formData.get("codigo") ?? "").replace(/\s/g, "");
  if (!/^\d{6}$/.test(codigo)) {
    return { paso: "codigo", correo, error: "El código tiene 6 dígitos." };
  }

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.auth.verifyOtp({
    email: correo,
    token: codigo,
    type: "email",
  });

  if (error || !data.user) {
    return {
      paso: "codigo",
      correo,
      error: "Código incorrecto o vencido. Revisa el correo o pide uno nuevo.",
    };
  }

  if (!correoPermitido(data.user.email)) {
    await supabase.auth.signOut();
    redirect("/sin-acceso");
  }

  redirect("/");
}
