// Formatos de pantalla. Montos en Q con su equivalente en $.

const quetzales = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function q(monto: number): string {
  return `${monto < 0 ? "−" : ""}Q${quetzales.format(Math.abs(monto))}`;
}

export function usd(monto: number): string {
  return `${monto < 0 ? "−" : ""}$${quetzales.format(Math.abs(monto))}`;
}

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

// "2026-08" → "agosto 2026"
export function mesLargo(mes: string): string {
  const [anio, numero] = mes.split("-");
  return `${MESES[Number(numero) - 1] ?? numero} ${anio}`;
}
