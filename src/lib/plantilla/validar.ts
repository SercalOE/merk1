import { inversionQ } from "../calculos";
import { REGEX_CODIGO, type NombreHoja } from "./contrato";
import type {
  Catalogos,
  Celda,
  FilaCruda,
  LibroCrudo,
  LineaCarga,
  MesCarga,
  Moneda,
  Problema,
  TipoPlan,
  Validacion,
} from "./tipos";

// Valida las filas leídas contra el contrato y los catálogos de Supabase (docs/SPEC-MVP.md).
// Errores bloquean la carga; avisos no.
export function validarPlantilla(libro: LibroCrudo, catalogos: Catalogos): Validacion {
  // Con hojas o columnas faltantes no se sigue: el resto de mensajes sería ruido.
  if (libro.problemas.some((p) => p.nivel === "error")) {
    return { meses: [], problemas: [...libro.problemas] };
  }

  const v = new Validador(catalogos, [...libro.problemas]);
  const filas = (hoja: NombreHoja) => libro.hojas[hoja]?.filas ?? [];

  for (const f of filas("Mes")) v.mes(f);
  for (const f of filas("Presupuesto")) v.presupuesto(f);
  for (const f of filas("Calendario")) v.calendario(f);
  for (const f of filas("KPIs")) v.kpi(f);
  for (const f of filas("Plan")) v.linea(f);
  v.avisosDePartidas();

  return { meses: [...v.meses.values()], problemas: v.problemas };
}

// Quita tildes, mayúsculas y espacios de más: "trafico" = "Tráfico".
export function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();
}

// Busca en un catálogo sin importar tildes ni mayúsculas y devuelve el nombre oficial.
function buscador<T>(items: T[], nombre: (item: T) => string) {
  const mapa = new Map(items.map((item) => [normalizar(nombre(item)), item]));
  return (texto: string) => mapa.get(normalizar(texto)) ?? null;
}

const TIPOS_PLAN: TipoPlan[] = ["principal", "extra", "arrastre"];
const MONEDAS: Moneda[] = ["GTQ", "USD"];

class Validador {
  readonly meses = new Map<string, MesCarga>(); // clave "ELE|2026-08"
  private readonly codigosVistos = new Map<string, number>(); // "ELE|2026-08|ELE2608-001" → fila
  private readonly empresa;
  private readonly medio;
  private readonly objetivo;
  private readonly actividad;
  private readonly partida;

  constructor(
    catalogos: Catalogos,
    readonly problemas: Problema[],
  ) {
    this.empresa = buscador(catalogos.empresas, (e) => e.codigo);
    this.medio = buscador(catalogos.medios, (m) => m);
    this.objetivo = buscador(catalogos.objetivos, (o) => o.nombre);
    this.actividad = buscador(catalogos.actividades, (a) => a);
    this.partida = buscador(catalogos.partidas, (p) => p);
  }

  // ---------------- Hojas ----------------

  mes(f: FilaCruda) {
    const c = this.contexto("Mes", f);
    const empresa = this.empresaDe(c);
    const mes = this.mesDe(c);
    const tipoCambio = this.numero(c, "tipo_cambio");
    if (tipoCambio !== null && tipoCambio <= 0) this.error(c, "tipo_cambio", "El tipo de cambio debe ser mayor a 0.");
    if (!empresa || !mes || tipoCambio === null || tipoCambio <= 0) return;

    const clave = `${empresa}|${mes}`;
    if (this.meses.has(clave)) {
      this.error(c, "mes", `${empresa} ${mes} está repetido en la hoja Mes.`);
      return;
    }
    this.meses.set(clave, {
      empresa_codigo: empresa,
      mes,
      tipo_cambio: tipoCambio,
      presupuestos: [],
      calendario: [],
      kpis: [],
      lineas: [],
    });
  }

  presupuesto(f: FilaCruda) {
    const c = this.contexto("Presupuesto", f);
    const mes = this.mesCargado(c);
    const partida = this.catalogo(c, "partida", this.partida, "La partida");
    const saldo = this.numero(c, "saldo_anterior", { requerido: false }) ?? 0;
    const presupuesto = this.numero(c, "presupuesto_mes", { requerido: false }) ?? 0;
    const moneda = this.moneda(c);
    if (!mes || !partida || !moneda) return;

    if (mes.presupuestos.some((p) => p.partida === partida)) {
      this.error(c, "partida", `La partida «${partida}» está repetida en ${mes.empresa_codigo} ${mes.mes}.`);
      return;
    }
    mes.presupuestos.push({ fila: f.fila, partida, saldo_anterior: saldo, presupuesto_mes: presupuesto, moneda });
  }

  calendario(f: FilaCruda) {
    const c = this.contexto("Calendario", f);
    const mes = this.mesCargado(c);
    const actividad = this.texto(c, "actividad"); // texto libre, no usa catálogo
    const inicio = this.fecha(c, "fecha_inicio");
    const fin = this.fecha(c, "fecha_fin");
    if (inicio && fin && fin < inicio) this.error(c, "fecha_fin", "La fecha fin es anterior a la fecha inicio.");
    if (!mes || !actividad || !inicio || !fin || fin < inicio) return;

    mes.calendario.push({
      fila: f.fila,
      actividad,
      fecha_inicio: inicio,
      fecha_fin: fin,
      notas: this.texto(c, "notas", { requerido: false }),
    });
  }

  kpi(f: FilaCruda) {
    const c = this.contexto("KPIs", f);
    const mes = this.mesCargado(c);
    const kpi = this.texto(c, "kpi");
    const anio = this.numero(c, "anio");
    if (anio !== null && !Number.isInteger(anio)) this.error(c, "anio", "El año debe ser un número entero.");
    const valor = this.numero(c, "valor", { requerido: false });
    const tipoTexto = this.texto(c, "tipo");
    const tipo = tipoTexto ? (normalizar(tipoTexto) as "real" | "meta") : null;
    if (tipo && tipo !== "real" && tipo !== "meta") {
      this.error(c, "tipo", `Tipo «${tipoTexto}» no válido. Debe ser Real o Meta.`);
      return;
    }
    if (!mes || !kpi || anio === null || !Number.isInteger(anio) || !tipo) return;

    if (mes.kpis.some((k) => normalizar(k.kpi) === normalizar(kpi) && k.anio === anio && k.tipo === tipo)) {
      this.error(c, "kpi", `El KPI «${kpi}» ${anio} (${tipo}) está repetido.`);
      return;
    }
    if (tipo === "meta" && valor === null) this.aviso(c, "valor", `La meta ${anio} de «${kpi}» está vacía.`);
    mes.kpis.push({ fila: f.fila, kpi, anio, valor, tipo });
  }

  linea(f: FilaCruda) {
    const c = this.contexto("Plan", f);
    const mes = this.mesCargado(c);

    const codigo = this.texto(c, "codigo");
    if (codigo && !REGEX_CODIGO.test(codigo)) {
      this.error(c, "codigo", `El código «${codigo}» no tiene el formato EMP + AAMM + consecutivo (ej. ELE2608-001).`);
    }

    const planTexto = this.texto(c, "plan", { requerido: false });
    const plan: TipoPlan | null = planTexto ? (TIPOS_PLAN.find((t) => t === normalizar(planTexto)) ?? null) : "principal";
    if (planTexto && !plan) this.error(c, "plan", `Plan «${planTexto}» no válido. Debe ser Principal, Extra o Arrastre.`);

    const actividad = this.catalogo(c, "actividad", this.actividad, "La actividad");
    const medio = this.catalogo(c, "medio", this.medio, "El medio");
    const objetivo = this.catalogo(c, "objetivo", this.objetivo, "El objetivo");
    const partida = this.catalogo(c, "partida", this.partida, "La partida");
    const inicio = this.fecha(c, "fecha_inicio");
    const fin = this.fecha(c, "fecha_fin");
    const inversion = this.numero(c, "inversion");
    const moneda = this.moneda(c);
    const costo = this.numero(c, "costo_estimado", { requerido: false }) ?? 0;
    const proyectadoManual = this.numero(c, "proyectado_manual", { requerido: false });

    if (inicio && fin && fin < inicio) this.error(c, "fecha_fin", "La fecha fin es anterior a la fecha inicio.");
    if (mes && plan !== "arrastre") {
      for (const [columna, fecha] of [["fecha_inicio", inicio], ["fecha_fin", fin]] as const) {
        if (fecha && fecha.slice(0, 7) !== mes.mes) {
          this.error(c, columna, `La fecha ${fecha} está fuera de ${mes.mes}. Solo un plan Arrastre puede salirse del mes.`);
        }
      }
    }
    if (inversion !== null && inversion < 0) this.error(c, "inversion", "La inversión no puede ser negativa.");
    if (objetivo && objetivo.tipo_costo !== "sin_costo" && costo <= 0) {
      this.error(c, "costo_estimado", `El objetivo «${objetivo.nombre}» tiene costo: el costo estimado debe ser mayor a 0.`);
    }
    if (objetivo?.tipo_costo === "sin_costo" && proyectadoManual === null) {
      this.aviso(c, "proyectado_manual", `El objetivo «${objetivo.nombre}» no tiene costo y no trae proyectado manual.`);
    }

    if (mes && codigo && REGEX_CODIGO.test(codigo)) {
      const clave = `${mes.empresa_codigo}|${mes.mes}|${codigo}`;
      const primera = this.codigosVistos.get(clave);
      if (primera !== undefined) {
        this.error(c, "codigo", `El código ${codigo} está repetido en ${mes.empresa_codigo} ${mes.mes} (también en la fila ${primera}).`);
        return;
      }
      this.codigosVistos.set(clave, f.fila);
      if (codigo.slice(0, 3) !== mes.empresa_codigo) {
        this.aviso(c, "codigo", `El código ${codigo} no empieza con la empresa de la fila (${mes.empresa_codigo}).`);
      }
    }

    if (this.hayErrores(f.fila, "Plan")) return;
    if (!mes || !codigo || !plan || !actividad || !medio || !objetivo || !partida) return;
    if (!inicio || !fin || inversion === null || !moneda) return;

    const linea: LineaCarga = {
      fila: f.fila,
      codigo,
      plan,
      nombre_plan_extra: this.texto(c, "nombre_plan_extra", { requerido: false }),
      actividad,
      fecha_inicio: inicio,
      fecha_fin: fin,
      fechas_envio: this.texto(c, "fechas_envio", { requerido: false }),
      medio,
      objetivo: objetivo.nombre,
      tipo_costo: objetivo.tipo_costo,
      partida,
      inversion,
      moneda,
      costo_estimado: costo,
      proyectado_manual: proyectadoManual,
      inversion_q: inversionQ(inversion, moneda, mes.tipo_cambio),
    };
    mes.lineas.push(linea);
  }

  // Aviso por partida cuando lo planeado supera lo disponible (saldo anterior + presupuesto del mes).
  avisosDePartidas() {
    for (const mes of this.meses.values()) {
      const planeado = new Map<string, number>();
      for (const l of mes.lineas) planeado.set(l.partida, (planeado.get(l.partida) ?? 0) + l.inversion_q);

      for (const [partida, totalQ] of planeado) {
        if (totalQ <= 0) continue;
        const p = mes.presupuestos.find((x) => x.partida === partida);
        const disponibleQ = p ? inversionQ(p.saldo_anterior + p.presupuesto_mes, p.moneda, mes.tipo_cambio) : 0;
        if (totalQ > disponibleQ + 0.005) {
          this.problemas.push({
            nivel: "aviso",
            hoja: "Presupuesto",
            fila: p?.fila,
            columna: "partida",
            mensaje: p
              ? `${mes.empresa_codigo} ${mes.mes} · «${partida}»: planeado Q${dinero(totalQ)} supera el disponible Q${dinero(disponibleQ)}.`
              : `${mes.empresa_codigo} ${mes.mes} · «${partida}»: planeado Q${dinero(totalQ)} sin fila en Presupuesto.`,
          });
        }
      }
    }
  }

  // ---------------- Lectores de celda ----------------

  private contexto(hoja: NombreHoja, f: FilaCruda) {
    return { hoja, fila: f.fila, valores: f.valores };
  }

  private texto(c: Contexto, columna: string, { requerido = true } = {}): string | null {
    const valor = c.valores[columna];
    if (valor === null || valor === undefined) {
      if (requerido) this.error(c, columna, `Falta «${columna}».`);
      return null;
    }
    if (valor instanceof Date) return fechaISO(valor);
    return String(valor).trim();
  }

  private numero(c: Contexto, columna: string, { requerido = true } = {}): number | null {
    const valor = c.valores[columna];
    if (valor === null || valor === undefined) {
      if (requerido) this.error(c, columna, `Falta «${columna}».`);
      return null;
    }
    if (typeof valor === "number" && Number.isFinite(valor)) return valor;
    if (typeof valor === "string") {
      const limpio = valor.replace(/[Q$,\s]/g, "");
      const n = Number(limpio);
      if (limpio !== "" && Number.isFinite(n)) return n;
    }
    this.error(c, columna, `«${columna}» debe ser un número (se leyó «${String(valor)}»).`);
    return null;
  }

  // Fecha real de Excel, o texto AAAA-MM-DD / DD/MM/AAAA. Devuelve AAAA-MM-DD.
  private fecha(c: Contexto, columna: string): string | null {
    const valor = c.valores[columna];
    if (valor === null || valor === undefined) {
      this.error(c, columna, `Falta «${columna}».`);
      return null;
    }
    let resultado: string | null = null;
    if (valor instanceof Date) resultado = fechaISO(valor);
    else if (typeof valor === "number") resultado = fechaISO(new Date(Date.UTC(1899, 11, 30) + Math.round(valor) * 86_400_000));
    else if (typeof valor === "string") {
      const iso = valor.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
      const latina = valor.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (iso) resultado = fechaValida(+iso[1], +iso[2], +iso[3]);
      else if (latina) resultado = fechaValida(+latina[3], +latina[2], +latina[1]);
    }
    if (!resultado) this.error(c, columna, `«${columna}» no es una fecha válida (se leyó «${String(valor)}»).`);
    return resultado;
  }

  // El mes viene como texto AAAA-MM, pero Excel a veces lo convierte en fecha.
  private mesDe(c: Contexto): string | null {
    const valor = c.valores["mes"];
    if (valor === null || valor === undefined) {
      this.error(c, "mes", "Falta «mes».");
      return null;
    }
    if (valor instanceof Date) return fechaISO(valor).slice(0, 7);
    const m = String(valor).trim().match(/^(\d{4})-(\d{1,2})(-\d{1,2})?$/);
    if (m && +m[2] >= 1 && +m[2] <= 12) return `${m[1]}-${m[2].padStart(2, "0")}`;
    this.error(c, "mes", `El mes «${String(valor)}» debe tener formato AAAA-MM.`);
    return null;
  }

  private empresaDe(c: Contexto): string | null {
    const texto = this.texto(c, "empresa_codigo");
    if (!texto) return null;
    const empresa = this.empresa(texto);
    if (!empresa) this.error(c, "empresa_codigo", `La empresa «${texto}» no está en el catálogo.`);
    return empresa?.codigo ?? null;
  }

  // Empresa + mes de la fila, que deben existir en la hoja Mes.
  private mesCargado(c: Contexto): MesCarga | null {
    const empresa = this.empresaDe(c);
    const mes = this.mesDe(c);
    if (!empresa || !mes) return null;
    const cargado = this.meses.get(`${empresa}|${mes}`);
    if (!cargado) this.error(c, "mes", `${empresa} ${mes} no tiene fila en la hoja Mes (tipo de cambio).`);
    return cargado ?? null;
  }

  private catalogo<T>(
    c: Contexto,
    columna: string,
    buscar: (texto: string) => T | null,
    etiqueta: string,
  ): T | null {
    const texto = this.texto(c, columna);
    if (!texto) return null;
    const item = buscar(texto);
    if (!item) this.error(c, columna, `${etiqueta} «${texto}» no está en el catálogo.`);
    return item;
  }

  private moneda(c: Contexto): Moneda | null {
    const texto = this.texto(c, "moneda");
    if (!texto) return null;
    const moneda = MONEDAS.find((m) => m === texto.toUpperCase());
    if (!moneda) this.error(c, "moneda", `Moneda «${texto}» no válida. Debe ser GTQ o USD.`);
    return moneda ?? null;
  }

  private hayErrores(fila: number, hoja: NombreHoja) {
    return this.problemas.some((p) => p.nivel === "error" && p.hoja === hoja && p.fila === fila);
  }

  private error(c: Contexto, columna: string, mensaje: string) {
    this.problemas.push({ nivel: "error", hoja: c.hoja, fila: c.fila, columna, mensaje });
  }

  private aviso(c: Contexto, columna: string, mensaje: string) {
    this.problemas.push({ nivel: "aviso", hoja: c.hoja, fila: c.fila, columna, mensaje });
  }
}

type Contexto = { hoja: NombreHoja; fila: number; valores: Record<string, Celda> };

// exceljs entrega las fechas en UTC: se leen con getters UTC para no correr un día.
function fechaISO(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}

function fechaValida(anio: number, mes: number, dia: number): string | null {
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  if (fecha.getUTCFullYear() !== anio || fecha.getUTCMonth() !== mes - 1 || fecha.getUTCDate() !== dia) return null;
  return fechaISO(fecha);
}

function dinero(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
