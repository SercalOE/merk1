import type { Moneda, TipoCosto } from "./plantilla/tipos";

// inversion_q = inversión × tipo de cambio si la moneda es USD (CLAUDE.md · Fórmulas).
export function inversionQ(inversion: number, moneda: Moneda, tipoCambio: number): number {
  return moneda === "USD" ? inversion * tipoCambio : inversion;
}

// proyectado = inversión_q ÷ costo_estimado × (1000 si es por mil). Si es sin costo: proyectado_manual.
// Un costo estimado de 0 también usa el manual (igual que el Excel y v_control): no se divide entre 0.
export function proyectado(
  inversionQ: number,
  costoEstimado: number,
  tipoCosto: TipoCosto,
  proyectadoManual: number | null,
): number {
  if (tipoCosto === "sin_costo" || costoEstimado === 0) return proyectadoManual ?? 0;
  return (inversionQ / costoEstimado) * (tipoCosto === "por_mil" ? 1000 : 1);
}

// Nombre de la campaña en la plataforma: CÓDIGO | Actividad | Medio | Objetivo.
export function nombreCampana(codigo: string, actividad: string, medio: string, objetivo: string): string {
  return `${codigo} | ${actividad} | ${medio} | ${objetivo}`;
}
