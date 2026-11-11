import type { NombreHoja } from "./contrato";

export type Moneda = "GTQ" | "USD";
export type TipoCosto = "por_mil" | "por_unidad" | "sin_costo";
export type TipoPlan = "principal" | "extra" | "arrastre";

// ---------- Lo que sale del Excel sin interpretar ----------
export type Celda = string | number | boolean | Date | null;
export type FilaCruda = { fila: number; valores: Record<string, Celda> };
export type HojaCruda = { nombre: NombreHoja; filas: FilaCruda[] };
export type LibroCrudo = {
  hojas: Partial<Record<NombreHoja, HojaCruda>>;
  problemas: Problema[];
};

// ---------- Errores (bloquean) y avisos (no bloquean) ----------
export type Problema = {
  nivel: "error" | "aviso";
  hoja: NombreHoja | "Archivo";
  fila?: number;
  columna?: string;
  mensaje: string;
};

// ---------- Catálogos (vienen de Supabase) ----------
export type Catalogos = {
  empresas: { codigo: string; nombre: string }[];
  medios: string[];
  objetivos: { nombre: string; tipo_costo: TipoCosto }[];
  actividades: string[];
  partidas: string[];
};

// ---------- Datos ya validados, con nombres oficiales del catálogo ----------
export type PresupuestoCarga = {
  fila: number;
  partida: string;
  saldo_anterior: number;
  presupuesto_mes: number;
  moneda: Moneda;
};

export type CalendarioCarga = {
  fila: number;
  actividad: string;
  fecha_inicio: string; // AAAA-MM-DD
  fecha_fin: string;
  notas: string | null;
};

export type KpiCarga = {
  fila: number;
  kpi: string;
  anio: number;
  valor: number | null;
  tipo: "real" | "meta";
};

export type LineaCarga = {
  fila: number;
  codigo: string;
  plan: TipoPlan;
  nombre_plan_extra: string | null;
  actividad: string;
  fecha_inicio: string;
  fecha_fin: string;
  fechas_envio: string | null;
  medio: string;
  objetivo: string;
  tipo_costo: TipoCosto;
  partida: string;
  inversion: number;
  moneda: Moneda;
  costo_estimado: number;
  proyectado_manual: number | null;
  inversion_q: number;
};

export type MesCarga = {
  empresa_codigo: string;
  mes: string; // AAAA-MM
  tipo_cambio: number;
  presupuestos: PresupuestoCarga[];
  calendario: CalendarioCarga[];
  kpis: KpiCarga[];
  lineas: LineaCarga[];
};

export type Validacion = {
  meses: MesCarga[];
  problemas: Problema[];
};
