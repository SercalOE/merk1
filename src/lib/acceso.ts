// Segundo candado del login: el correo debe estar en MERK1_ALLOWED_EMAILS
// (separados por coma). Solo se usa en el servidor. Lista vacía = nadie entra.

export function normalizarCorreo(correo: string): string {
  return correo.trim().toLowerCase();
}

export function listaPermitida(
  valor: string = process.env.MERK1_ALLOWED_EMAILS ?? "",
): Set<string> {
  return new Set(
    valor
      .split(/[,;\s]+/)
      .map(normalizarCorreo)
      .filter(Boolean),
  );
}

export function correoPermitido(
  correo: string | null | undefined,
  valor?: string,
): boolean {
  if (!correo) return false;
  return listaPermitida(valor).has(normalizarCorreo(correo));
}
