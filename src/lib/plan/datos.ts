import "server-only";
import { connection } from "next/server";
import { inversionQ, nombreCampana, proyectado } from "../calculos";
import { crearClienteServidor } from "../supabase/server";
import type { Moneda, TipoCosto, TipoPlan } from "../plantilla/tipos";
import type { KpiEntrada } from "./kpis";
import type { PresupuestoEntrada } from "./resumen";

export type LineaPlan = {
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
  resultado: string; // unidad del resultado: "Clics", "Personas alcanzadas (únicas)"…
  partida: string;
  inversion: number;
  moneda: Moneda;
  costo_estimado: number; // en Q
  inversion_q: number;
  proyectado: number;
  nombre_campana: string;
};

export type CalendarioPlan = { actividad: string; fecha_inicio: string; fecha_fin: string; notas: string | null };

export type PlanMes = {
  empresa: { codigo: string; nombre: string };
  mes: string; // AAAA-MM
  tipo_cambio: number;
  ultima_carga: string | null; // ISO
  presupuestos: PresupuestoEntrada[];
  calendario: CalendarioPlan[];
  kpis: KpiEntrada[];
  lineas: LineaPlan[];
};

export type MesCargado = { mes: string; lineas: number; plan_q: number; plan_usd: number };
export type EmpresaConMeses = { codigo: string; nombre: string; meses: MesCargado[] };

const nombre = (r: unknown) => (r as { nombre: string } | null)?.nombre ?? "";
const porNombre = (a: string, b: string) => a.localeCompare(b, "es");

// Supabase usa Date.now() al revisar la sesión. Con Cache Components eso no se puede hacer al prerenderizar,
// así que cada lectura espera la petición real antes de crear el cliente (igual que Protegido en el layout).
async function clienteParaLeer() {
  await connection();
  return crearClienteServidor();
}

// El plan guardado de una empresa y mes, o null si ese mes no se ha cargado.
export async function leerPlan(empresa: string, mes: string): Promise<PlanMes | null> {
  const supabase = await clienteParaLeer();
  const { data, error } = await supabase
    .from("meses")
    .select(
      `mes, tipo_cambio,
       empresas!inner(codigo, nombre),
       presupuestos(saldo_anterior, presupuesto_mes, moneda, partidas(nombre, orden)),
       calendario(actividad, fecha_inicio, fecha_fin, notas),
       kpis(kpi, anio, valor, tipo),
       plan_lineas(codigo, plan, nombre_plan_extra, fecha_inicio, fecha_fin, fechas_envio, inversion, moneda,
                   costo_estimado, proyectado_manual,
                   actividades(nombre), medios(nombre), objetivos(nombre, tipo_costo, resultado), partidas(nombre),
                   cargas(creado_en))`,
    )
    .eq("empresas.codigo", empresa)
    .eq("mes", `${mes}-01`)
    .order("codigo", { referencedTable: "plan_lineas" })
    .order("fecha_inicio", { referencedTable: "calendario" })
    .maybeSingle();
  if (error) throw new Error(`No se pudo leer el plan: ${error.message}`);
  if (!data) return null;

  const fila = data as unknown as FilaMes;
  const tc = Number(fila.tipo_cambio);

  const lineas = fila.plan_lineas.map((l): LineaPlan => {
    const objetivo = l.objetivos as { nombre: string; tipo_costo: TipoCosto; resultado: string };
    const actividad = nombre(l.actividades);
    const medio = nombre(l.medios);
    const invQ = inversionQ(Number(l.inversion), l.moneda, tc);
    const costo = Number(l.costo_estimado);
    return {
      codigo: l.codigo,
      plan: l.plan,
      nombre_plan_extra: l.nombre_plan_extra,
      actividad,
      fecha_inicio: l.fecha_inicio,
      fecha_fin: l.fecha_fin,
      fechas_envio: l.fechas_envio,
      medio,
      objetivo: objetivo.nombre,
      tipo_costo: objetivo.tipo_costo,
      resultado: objetivo.resultado,
      partida: nombre(l.partidas),
      inversion: Number(l.inversion),
      moneda: l.moneda,
      costo_estimado: costo,
      inversion_q: invQ,
      proyectado: proyectado(invQ, costo, objetivo.tipo_costo, l.proyectado_manual == null ? null : Number(l.proyectado_manual)),
      nombre_campana: nombreCampana(l.codigo, actividad, medio, objetivo.nombre),
    };
  });

  const cargas = fila.plan_lineas
    .map((l) => (l.cargas as { creado_en: string } | null)?.creado_en)
    .filter((f): f is string => Boolean(f))
    .sort();

  return {
    empresa: fila.empresas,
    mes,
    tipo_cambio: tc,
    ultima_carga: cargas.at(-1) ?? null,
    // Partidas en el orden del catálogo (partidas.orden, el del Excel); las que no tienen orden van al final.
    // Los KPIs se ordenan en tablaKpis().
    presupuestos: fila.presupuestos
      .map((p) => {
        const partida = p.partidas as { nombre: string; orden: number | null };
        return {
          partida: partida.nombre,
          orden: partida.orden ?? Number.MAX_SAFE_INTEGER,
          saldo_anterior: Number(p.saldo_anterior),
          presupuesto_mes: Number(p.presupuesto_mes),
          moneda: p.moneda,
        };
      })
      .sort((a, b) => a.orden - b.orden || porNombre(a.partida, b.partida))
      .map((p): PresupuestoEntrada => ({
        partida: p.partida,
        saldo_anterior: p.saldo_anterior,
        presupuesto_mes: p.presupuesto_mes,
        moneda: p.moneda,
      })),
    calendario: fila.calendario,
    kpis: fila.kpis.map((k) => ({ ...k, valor: k.valor == null ? null : Number(k.valor) })),
    lineas,
  };
}

// Meses cargados por empresa, del más reciente al más antiguo, con su número de líneas y total.
export async function leerMesesCargados(): Promise<EmpresaConMeses[]> {
  const supabase = await clienteParaLeer();
  const { data, error } = await supabase
    .from("meses")
    .select("mes, tipo_cambio, empresas!inner(codigo, nombre), plan_lineas(inversion, moneda)")
    .order("mes", { ascending: false });
  if (error) throw new Error(`No se pudieron leer los meses cargados: ${error.message}`);

  const empresas = new Map<string, EmpresaConMeses>();
  for (const m of data as unknown as FilaMesCargado[]) {
    const tc = Number(m.tipo_cambio);
    const planQ = m.plan_lineas.reduce((suma, l) => suma + inversionQ(Number(l.inversion), l.moneda, tc), 0);
    const empresa = empresas.get(m.empresas.codigo) ?? { ...m.empresas, meses: [] };
    empresa.meses.push({ mes: m.mes.slice(0, 7), lineas: m.plan_lineas.length, plan_q: planQ, plan_usd: planQ / tc });
    empresas.set(empresa.codigo, empresa);
  }
  return [...empresas.values()].sort((a, b) => porNombre(a.nombre, b.nombre));
}

// ---------- Forma de las filas que devuelve Supabase ----------
type FilaMes = {
  mes: string;
  tipo_cambio: number | string;
  empresas: { codigo: string; nombre: string };
  presupuestos: { saldo_anterior: number; presupuesto_mes: number; moneda: Moneda; partidas: unknown }[];
  calendario: CalendarioPlan[];
  kpis: { kpi: string; anio: number; valor: number | null; tipo: "real" | "meta" }[];
  plan_lineas: {
    codigo: string;
    plan: TipoPlan;
    nombre_plan_extra: string | null;
    fecha_inicio: string;
    fecha_fin: string;
    fechas_envio: string | null;
    inversion: number;
    moneda: Moneda;
    costo_estimado: number;
    proyectado_manual: number | null;
    actividades: unknown;
    medios: unknown;
    objetivos: unknown;
    partidas: unknown;
    cargas: unknown;
  }[];
};

type FilaMesCargado = {
  mes: string;
  tipo_cambio: number | string;
  empresas: { codigo: string; nombre: string };
  plan_lineas: { inversion: number; moneda: Moneda }[];
};
