// Formatos de pantalla. Montos en Q con su equivalente en $.

const quetzales = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function q(monto: number): string {
  return `${monto < 0 ? "−" : ""}Q${quetzales.format(Math.abs(monto))}`;
}

export function usd(monto: number): string {
  return `${monto < 0 ? "−" : ""}$${quetzales.format(Math.abs(monto))}`;
}

// 701754.38 → "701,754"; con decimales: numero(0.65, 2) → "0.65"
export function numero(valor: number, decimales = 0): string {
  const texto = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  }).format(Math.abs(valor));
  return `${valor < 0 ? "−" : ""}${texto}`;
}

// 0.1837 → "18.4%"
export function porcentaje(valor: number, decimales = 1): string {
  return `${numero(valor * 100, decimales)}%`;
}

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

// "2026-08" → "agosto 2026"
export function mesLargo(mes: string): string {
  const [anio, numero] = mes.split("-");
  return `${MESES[Number(numero) - 1] ?? numero} ${anio}`;
}

// "2026-08-09" → "9 ago"
export function fechaCorta(fecha: string): string {
  const [, mes, dia] = fecha.split("-").map(Number);
  return `${dia} ${MESES[mes - 1]?.slice(0, 3) ?? mes}`;
}

// Rango de fechas: "9 ago" si es un solo día, "9–15 ago" en el mismo mes, "28 ago – 3 sep" si cruza.
export function rangoFechas(inicio: string, fin: string): string {
  if (inicio === fin) return fechaCorta(inicio);
  if (inicio.slice(0, 7) === fin.slice(0, 7)) return `${Number(inicio.slice(8))}–${fechaCorta(fin)}`;
  return `${fechaCorta(inicio)} – ${fechaCorta(fin)}`;
}

// Fecha y hora de Guatemala: "12 nov 2026, 10:33"
export function fechaHora(iso: string): string {
  return new Intl.DateTimeFormat("es-GT", {
    timeZone: "America/Guatemala",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

export const TIPO_COSTO: Record<string, string> = {
  por_mil: "Por mil",
  por_unidad: "Por unidad",
  sin_costo: "Sin costo",
};
