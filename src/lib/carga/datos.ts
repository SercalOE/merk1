import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Catalogos, LineasExistentes, MesCarga, TipoCosto } from "@/lib/plantilla";

export const BUCKET_CARGAS = "cargas";

// Catálogos vigentes en la base. La plantilla se valida contra estos, no contra su hoja Catálogos.
export async function leerCatalogos(supabase: SupabaseClient): Promise<Catalogos> {
  const [empresas, medios, objetivos, actividades, partidas] = await Promise.all([
    supabase.from("empresas").select("codigo, nombre"),
    supabase.from("medios").select("nombre"),
    supabase.from("objetivos").select("nombre, tipo_costo"),
    supabase.from("actividades").select("nombre"),
    supabase.from("partidas").select("nombre"),
  ]);
  const error = [empresas, medios, objetivos, actividades, partidas].find((r) => r.error)?.error;
  if (error) throw new Error(`No se pudieron leer los catálogos: ${error.message}`);

  return {
    empresas: empresas.data as { codigo: string; nombre: string }[],
    medios: (medios.data as { nombre: string }[]).map((m) => m.nombre),
    objetivos: objetivos.data as { nombre: string; tipo_costo: TipoCosto }[],
    actividades: (actividades.data as { nombre: string }[]).map((a) => a.nombre),
    partidas: (partidas.data as { nombre: string }[]).map((p) => p.nombre),
  };
}

// Códigos que ya hay en plan_lineas para los meses de la carga, por "EMP|AAAA-MM".
// Un mes que no aparece en el mapa es un mes nuevo.
export async function leerLineasExistentes(supabase: SupabaseClient, meses: MesCarga[]): Promise<LineasExistentes> {
  const existentes: LineasExistentes = new Map();
  if (meses.length === 0) return existentes;

  const { data, error } = await supabase
    .from("meses")
    .select("mes, empresas!inner(codigo), plan_lineas(codigo)")
    .in("mes", [...new Set(meses.map((m) => `${m.mes}-01`))]);
  if (error) throw new Error(`No se pudo revisar si los meses ya existen: ${error.message}`);

  const buscados = new Set(meses.map((m) => `${m.empresa_codigo}|${m.mes}`));
  for (const fila of data as unknown as { mes: string; empresas: { codigo: string }; plan_lineas: { codigo: string }[] }[]) {
    const clave = `${fila.empresas.codigo}|${fila.mes.slice(0, 7)}`;
    if (buscados.has(clave)) existentes.set(clave, fila.plan_lineas.map((l) => l.codigo));
  }
  return existentes;
}

// Lo que recibe aplicar_carga_plan: solo los campos que se guardan.
export function datosParaAplicar(meses: MesCarga[]) {
  return {
    meses: meses.map((m) => ({
      empresa_codigo: m.empresa_codigo,
      mes: m.mes,
      tipo_cambio: m.tipo_cambio,
      presupuestos: m.presupuestos.map(({ partida, saldo_anterior, presupuesto_mes, moneda }) => ({
        partida,
        saldo_anterior,
        presupuesto_mes,
        moneda,
      })),
      calendario: m.calendario.map(({ actividad, fecha_inicio, fecha_fin, notas }) => ({
        actividad,
        fecha_inicio,
        fecha_fin,
        notas,
      })),
      kpis: m.kpis.map(({ kpi, anio, valor, tipo }) => ({ kpi, anio, valor, tipo })),
      lineas: m.lineas.map((l) => ({
        codigo: l.codigo,
        plan: l.plan,
        nombre_plan_extra: l.nombre_plan_extra,
        actividad: l.actividad,
        fecha_inicio: l.fecha_inicio,
        fecha_fin: l.fecha_fin,
        fechas_envio: l.fechas_envio,
        medio: l.medio,
        objetivo: l.objetivo,
        partida: l.partida,
        inversion: l.inversion,
        moneda: l.moneda,
        costo_estimado: l.costo_estimado,
        proyectado_manual: l.proyectado_manual,
      })),
    })),
  };
}

// Nombre seguro para Storage: sin tildes, espacios ni caracteres raros.
export function nombreArchivoSeguro(nombre: string): string {
  const base = nombre
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^A-Za-z0-9._-]+/g, "_")
    .slice(-120);
  return base.toLowerCase().endsWith(".xlsx") ? base : `${base}.xlsx`;
}
