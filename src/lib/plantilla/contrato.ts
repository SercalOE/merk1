// Contrato de la plantilla de carga (docs/SPEC-MVP.md).
// No cambiar nombres de hojas ni de columnas sin actualizar la SPEC y la plantilla.
// Las hojas Léeme y Catálogos, y las columnas "(ayuda)", no se leen.

export const CONTRATO = {
  Mes: ["empresa_codigo", "mes", "tipo_cambio"],
  Presupuesto: ["empresa_codigo", "mes", "partida", "saldo_anterior", "presupuesto_mes", "moneda"],
  Calendario: ["empresa_codigo", "mes", "actividad", "fecha_inicio", "fecha_fin", "notas"],
  KPIs: ["empresa_codigo", "mes", "kpi", "anio", "valor", "tipo"],
  Plan: [
    "codigo",
    "empresa_codigo",
    "mes",
    "plan",
    "nombre_plan_extra",
    "actividad",
    "fecha_inicio",
    "fecha_fin",
    "fechas_envio",
    "medio",
    "objetivo",
    "partida",
    "inversion",
    "moneda",
    "costo_estimado",
    "proyectado_manual",
  ],
} as const;

export type NombreHoja = keyof typeof CONTRATO;
export const HOJAS = Object.keys(CONTRATO) as NombreHoja[];

export const REGEX_CODIGO = /^[A-Z]{3}[0-9]{4}-[0-9]{3}$/;
