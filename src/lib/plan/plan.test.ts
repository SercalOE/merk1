import { readFileSync } from "node:fs";
import { join } from "node:path";
import ExcelJS from "exceljs";
import { beforeAll, describe, expect, it } from "vitest";
import { nombreCampana, proyectado } from "../calculos";
import { leerPlantilla, type MesCarga } from "../plantilla";
import { catalogosSemilla } from "../plantilla/catalogos-semilla.test-utils";
import { tablaKpis, type KpiEntrada } from "./kpis";
import { porActividad, porPartida } from "./resumen";

const ejemplo = (nombre: string) => readFileSync(join(process.cwd(), "docs/ejemplos", nombre));

let agosto: MesCarga;
beforeAll(async () => {
  [agosto] = (await leerPlantilla(ejemplo("Merk1_Plantilla_Carga_Electroma_Ago2026.xlsx"), catalogosSemilla)).meses;
});

// Lee la hoja Plan del Excel de referencia: código (A), resultado proyectado (Q) y nombre de campaña (S).
async function referenciaAgosto() {
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(ejemplo("Merk1_Plan_Electroma_Ago2026.xlsx") as unknown as ExcelJS.Buffer);
  const hoja = libro.getWorksheet("Plan")!;
  const resultado = (c: ExcelJS.Cell) => (c.value as ExcelJS.CellFormulaValue).result;
  const filas = new Map<string, { proyectado: number; nombre: string }>();
  for (let f = 5; f <= 30; f++) {
    const fila = hoja.getRow(f);
    filas.set(String(fila.getCell("A").value), {
      proyectado: Number(resultado(fila.getCell("Q"))),
      nombre: String(resultado(fila.getCell("S"))),
    });
  }
  return filas;
}

describe("plan de agosto contra el Excel de referencia", () => {
  it("el proyectado de las 26 líneas coincide con la columna «Resultado proyectado»", async () => {
    const referencia = await referenciaAgosto();
    expect(agosto.lineas).toHaveLength(26);
    for (const l of agosto.lineas) {
      const esperado = referencia.get(l.codigo);
      expect(esperado, l.codigo).toBeDefined();
      const calculado = proyectado(l.inversion_q, l.costo_estimado, l.tipo_costo, l.proyectado_manual);
      expect(calculado, l.codigo).toBeCloseTo(esperado!.proyectado, 6);
    }
  });

  it("el nombre de campaña de las 26 líneas coincide con la columna «Nombre de campaña»", async () => {
    const referencia = await referenciaAgosto();
    for (const l of agosto.lineas) {
      expect(nombreCampana(l.codigo, l.actividad, l.medio, l.objetivo), l.codigo).toBe(referencia.get(l.codigo)!.nombre);
    }
  });

  it("resumen por actividad: inversión y % del plan como la hoja Resumen", () => {
    const actividades = porActividad(agosto.lineas);
    const actividad = (nombre: string) => actividades.find((a) => a.actividad === nombre)!;

    expect(actividades.map((a) => a.actividad)).toEqual([
      "Mantenimiento",
      "Apoyo CC",
      "Electro Days",
      "Talento Humano",
      "Festival de la Iluminación",
      "Envío Insysa",
      "Leads B2B",
      "Capacitación",
      "Promo CC",
    ]);
    expect(actividad("Mantenimiento").inversion_q).toBeCloseTo(13045.01, 2);
    expect(actividad("Mantenimiento").porcentaje).toBeCloseTo(0.183723589683809, 10);
    expect(actividad("Festival de la Iluminación").inversion_q).toBeCloseTo(33729.9725, 4);
    expect(actividad("Envío Insysa").porcentaje).toBeCloseTo(0.000639968839827052, 12);
    expect(actividades.reduce((s, a) => s + a.inversion_q, 0)).toBeCloseTo(71003.46, 2);
    expect(actividades.reduce((s, a) => s + a.porcentaje, 0)).toBeCloseTo(1, 10);
  });

  // La plantilla y la base guardan el presupuesto al centavo; el Excel de referencia trae más decimales
  // (YouTube −11,302.292). Por partida cuadra al centavo; el total disponible acumula los redondeos de
  // 24 cifras y da Q76,995.14 contra Q76,995.12 del Excel.
  it("resumen por partida: disponible, planeado y diferencia (al centavo)", () => {
    const partidas = porPartida(agosto.presupuestos, agosto.lineas, agosto.tipo_cambio);
    const partida = (nombre: string) => partidas.find((p) => p.partida === nombre)!;
    const centavo = 0.01;

    expect(partida("YouTube")).toMatchObject({ planeado_q: 5500 });
    expect(Math.abs(partida("YouTube").diferencia_q - -12880.07)).toBeLessThan(centavo);
    expect(Math.abs(partida("Tik Tok").diferencia_q - 8738.29)).toBeLessThan(centavo);
    expect(Math.abs(partidas.reduce((s, p) => s + p.disponible_q, 0) - 76995.14)).toBeLessThan(centavo / 2);
  });
});

describe("tablaKpis", () => {
  it("agosto: años 2024 y 2025, meta 2026 vacía y crecimientos como la hoja Insights", () => {
    const tabla = tablaKpis(agosto.kpis);
    expect(tabla.anios).toEqual([2024, 2025]);
    expect(tabla.anio_meta).toBe(2026);
    expect(tabla.filas.map((f) => f.kpi)).toEqual(["Alcance", "MQLs", "Interacción", "Usuarios web"]);

    const alcance = tabla.filas[0];
    expect(alcance.reales).toEqual({ 2024: 6525789, 2025: 8109181 });
    expect(alcance.meta).toBeNull();
    expect(alcance.crecimiento_real).toBeCloseTo(0.24263610116723, 12);
    expect(alcance.crecimiento_meta).toBeNull();
    expect(tabla.filas[3].crecimiento_real).toBeCloseTo(-0.2531006378455, 12);
  });

  it("con meta: crecimiento de la meta contra el último año real", () => {
    const tabla = tablaKpis([
      { kpi: "MQLs", anio: 2024, valor: 7749, tipo: "real" },
      { kpi: "MQLs", anio: 2025, valor: 13465, tipo: "real" },
      { kpi: "MQLs", anio: 2026, valor: 15000, tipo: "meta" },
    ]);
    expect(tabla.filas[0].meta).toBe(15000);
    expect(tabla.filas[0].crecimiento_meta).toBeCloseTo(15000 / 13465 - 1, 12);
  });

  it("orden fijo Alcance, MQLs, Interacción, Usuarios web aunque lleguen en otro orden; los demás al final", () => {
    const fila = (kpi: string): KpiEntrada => ({ kpi, anio: 2025, valor: 1, tipo: "real" });
    const tabla = tablaKpis(["Usuarios web", "Visitas tienda", "Interacción", "Alcance", "MQLs", "Clientes"].map(fila));
    expect(tabla.filas.map((f) => f.kpi)).toEqual([
      "Alcance",
      "MQLs",
      "Interacción",
      "Usuarios web",
      "Clientes",
      "Visitas tienda",
    ]);
  });

  it("base 0 o sin dato: no hay crecimiento", () => {
    const tabla = tablaKpis([
      { kpi: "Leads", anio: 2024, valor: 0, tipo: "real" },
      { kpi: "Leads", anio: 2025, valor: 50, tipo: "real" },
    ]);
    expect(tabla.filas[0].crecimiento_real).toBeNull();
    expect(tabla.anio_meta).toBeNull();
  });
});
