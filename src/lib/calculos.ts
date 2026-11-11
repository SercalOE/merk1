import type { Moneda } from "./plantilla/tipos";

// inversion_q = inversión × tipo de cambio si la moneda es USD (CLAUDE.md · Fórmulas).
export function inversionQ(inversion: number, moneda: Moneda, tipoCambio: number): number {
  return moneda === "USD" ? inversion * tipoCambio : inversion;
}
