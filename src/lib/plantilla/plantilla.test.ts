import { readFileSync } from "node:fs";
import { join } from "node:path";
import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { catalogosSemilla } from "./catalogos-semilla.test-utils";
import { compararLineas, leerPlantilla, resumir } from "./index";

const ejemplo = (nombre: string) => readFileSync(join(process.cwd(), "docs/ejemplos", nombre));
const AGOSTO = "Merk1_Plantilla_Carga_Electroma_Ago2026.xlsx";
const SEPTIEMBRE = "Merk1_Plantilla_Carga_Electroma_Sep2026.xlsx";

// Abre la plantilla de agosto, aplica cambios y la devuelve como un .xlsx nuevo en memoria.
async function agostoModificado(cambios: (libro: ExcelJS.Workbook) => void) {
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(ejemplo(AGOSTO) as unknown as ExcelJS.Buffer);
  cambios(libro);
  return new Uint8Array(await libro.xlsx.writeBuffer());
}

const utc = (a: number, m: number, d: number) => new Date(Date.UTC(a, m - 1, d));

describe("plantilla de agosto (piloto Electroma)", () => {
  it("carga sin errores: 26 líneas y plan de Q71,003.46", async () => {
    const validacion = await leerPlantilla(ejemplo(AGOSTO), catalogosSemilla);
    const resumen = resumir(validacion);

    expect(resumen.errores).toEqual([]);
    expect(resumen.meses).toHaveLength(1);
    const [mes] = resumen.meses;
    expect(mes.empresa_codigo).toBe("ELE");
    expect(mes.mes).toBe("2026-08");
    expect(mes.tipo_cambio).toBe(7.85);
    expect(mes.lineas).toBe(26);
    expect(mes.plan_q).toBeCloseTo(71003.46, 2);
    expect(resumen.total_lineas).toBe(26);
  });

  it("lee presupuesto, calendario y KPIs", async () => {
    const [mes] = (await leerPlantilla(ejemplo(AGOSTO), catalogosSemilla)).meses;
    expect(mes.presupuestos).toHaveLength(12);
    expect(mes.calendario).toHaveLength(9);
    expect(mes.kpis).toHaveLength(12); // la nota al final de la hoja no cuenta como fila
    expect(mes.calendario[0]).toMatchObject({ actividad: "Sale Electro Days", fecha_inicio: "2026-08-09", fecha_fin: "2026-08-09" });
    expect(mes.kpis[0]).toMatchObject({ kpi: "Alcance", anio: 2024, valor: 6525789, tipo: "real" });
  });

  it("normaliza cada línea con los nombres oficiales del catálogo", async () => {
    const [mes] = (await leerPlantilla(ejemplo(AGOSTO), catalogosSemilla)).meses;
    const linea = (codigo: string) => mes.lineas.find((l) => l.codigo === codigo)!;

    expect(linea("ELE2608-003")).toMatchObject({
      plan: "principal",
      actividad: "Mantenimiento",
      medio: "Google Ads",
      objetivo: "Search · Clics",
      tipo_costo: "por_unidad",
      partida: "Google",
      fecha_inicio: "2026-08-01",
      fecha_fin: "2026-08-31",
      inversion: 3600,
      moneda: "GTQ",
      costo_estimado: 0.65,
      inversion_q: 3600,
    });
    expect(linea("ELE2608-011")).toMatchObject({ objetivo: "Mailing", tipo_costo: "sin_costo", proyectado_manual: 4500 });
  });

  it("calcula disponible contra planeado por partida y avisa lo que se pasa", async () => {
    const resumen = resumir(await leerPlantilla(ejemplo(AGOSTO), catalogosSemilla));
    const partida = (nombre: string) => resumen.meses[0].partidas.find((p) => p.partida === nombre)!;

    expect(partida("Meta FB e IG").planeado_q).toBeCloseTo(30745.01, 2);
    expect(partida("Meta FB e IG").disponible_q).toBeCloseTo(37100.86, 2);
    expect(partida("Google").diferencia_q).toBeCloseTo(-137.32, 2);
    expect(partida("Sin costo")).toMatchObject({ disponible_q: 0, planeado_q: 0 });

    const sobreDisponible = resumen.avisos.filter((a) => a.hoja === "Presupuesto").map((a) => a.mensaje.match(/«(.+?)»/)![1]);
    expect(sobreDisponible.sort()).toEqual(["Claro SMS", "Extras", "Google", "Programatic", "Whatsapp Isoft", "YouTube"]);

    const metasVacias = resumen.avisos.filter((a) => a.hoja === "KPIs");
    expect(metasVacias).toHaveLength(4);
    expect(resumen.avisos).toHaveLength(10);
  });
});

describe("plantilla de septiembre", () => {
  it("acepta códigos nacidos en agosto y la línea arrastre", async () => {
    const validacion = await leerPlantilla(ejemplo(SEPTIEMBRE), catalogosSemilla);
    const resumen = resumir(validacion);

    expect(resumen.errores).toEqual([]);
    expect(resumen.meses[0].lineas).toBe(26);
    expect(resumen.meses[0].plan_q).toBeCloseTo(66148.33, 2);

    const codigos = validacion.meses[0].lineas.map((l) => l.codigo);
    expect(codigos).toEqual(expect.arrayContaining(["ELE2608-003", "ELE2608-006", "ELE2608-023"]));
    expect(validacion.meses[0].lineas.find((l) => l.codigo === "ELE2608-002")?.plan).toBe("arrastre");
  });
});

describe("plantilla con errores a propósito", () => {
  it("detecta medio fuera de catálogo, fecha fin antes de inicio y código repetido", async () => {
    const archivo = await agostoModificado((libro) => {
      const plan = libro.getWorksheet("Plan")!;
      plan.getCell("J5").value = "Instagram"; // ELE2608-004
      plan.getCell("H8").value = utc(2026, 8, 5); // ELE2608-007 inicia el 9
      plan.getCell("A10").value = "ELE2608-008"; // ya está en la fila 9
    });

    const resumen = resumir(await leerPlantilla(archivo, catalogosSemilla));
    const errores = resumen.errores.map(({ hoja, fila, columna }) => ({ hoja, fila, columna }));

    expect(errores).toEqual([
      { hoja: "Plan", fila: 5, columna: "medio" },
      { hoja: "Plan", fila: 8, columna: "fecha_fin" },
      { hoja: "Plan", fila: 10, columna: "codigo" },
    ]);
    expect(resumen.errores[0].mensaje).toContain("Instagram");
    expect(resumen.errores[1].mensaje).toContain("anterior a la fecha inicio");
    expect(resumen.errores[2].mensaje).toContain("también en la fila 9");
    expect(resumen.meses[0].lineas).toBe(23); // las 3 filas con error no entran
  });

  it("detecta fechas fuera del mes, inversión negativa y costo 0 en objetivo con costo", async () => {
    const archivo = await agostoModificado((libro) => {
      const plan = libro.getWorksheet("Plan")!;
      plan.getCell("H2").value = utc(2026, 9, 3); // ELE2608-001 termina en septiembre
      plan.getCell("M3").value = -100; // ELE2608-002
      plan.getCell("O4").value = 0; // ELE2608-003 Search · Clics
      plan.getCell("A6").value = "ELE26-6"; // formato inválido
    });

    const errores = resumir(await leerPlantilla(archivo, catalogosSemilla)).errores;
    expect(errores.map((e) => `${e.fila}:${e.columna}`)).toEqual(["2:fecha_fin", "3:inversion", "4:costo_estimado", "6:codigo"]);
  });

  it("falta una hoja", async () => {
    const archivo = await agostoModificado((libro) => libro.removeWorksheet(libro.getWorksheet("KPIs")!.id));
    const resumen = resumir(await leerPlantilla(archivo, catalogosSemilla));
    expect(resumen.errores).toEqual([{ nivel: "error", hoja: "KPIs", mensaje: "Falta la hoja «KPIs»." }]);
    expect(resumen.meses).toEqual([]);
  });

  it("falta una columna", async () => {
    const archivo = await agostoModificado((libro) => {
      libro.getWorksheet("Plan")!.getCell("O1").value = "costo";
    });
    const errores = resumir(await leerPlantilla(archivo, catalogosSemilla)).errores;
    expect(errores).toEqual([
      { nivel: "error", hoja: "Plan", fila: 1, columna: "costo_estimado", mensaje: "Falta la columna «costo_estimado»." },
    ]);
  });

  it("archivo que no es Excel", async () => {
    const resumen = resumir(await leerPlantilla(new TextEncoder().encode("hola"), catalogosSemilla));
    expect(resumen.errores[0].hoja).toBe("Archivo");
  });
});

describe("nombres de catálogo y prefijo del código", () => {
  it("acepta nombres sin tilde ni mayúsculas y guarda el nombre oficial", async () => {
    const archivo = await agostoModificado((libro) => {
      const plan = libro.getWorksheet("Plan")!;
      plan.getCell("K8").value = "trafico"; // Tráfico
      plan.getCell("J2").value = "  META "; // Meta
      plan.getCell("F15").value = "festival de la iluminacion"; // Festival de la Iluminación
      plan.getCell("D2").value = "PRINCIPAL";
    });

    const validacion = await leerPlantilla(archivo, catalogosSemilla);
    expect(resumir(validacion).errores).toEqual([]);
    const linea = (codigo: string) => validacion.meses[0].lineas.find((l) => l.codigo === codigo)!;
    expect(linea("ELE2608-007").objetivo).toBe("Tráfico");
    expect(linea("ELE2608-001")).toMatchObject({ medio: "Meta", plan: "principal" });
    expect(linea("ELE2608-014").actividad).toBe("Festival de la Iluminación");
  });

  it("avisa (sin bloquear) cuando el código no empieza con la empresa de la fila", async () => {
    const archivo = await agostoModificado((libro) => {
      libro.getWorksheet("Plan")!.getCell("A3").value = "CGT2608-002";
    });
    const resumen = resumir(await leerPlantilla(archivo, catalogosSemilla));
    expect(resumen.errores).toEqual([]);
    expect(resumen.meses[0].lineas).toBe(26);
    expect(resumen.avisos).toContainEqual(
      expect.objectContaining({ hoja: "Plan", fila: 3, columna: "codigo", nivel: "aviso" }),
    );
  });
});

describe("cambios en plan_lineas al recargar un mes", () => {
  it("mes nuevo: todas se crean", () => {
    expect(compararLineas(["ELE2608-001", "ELE2608-002"], undefined)).toEqual({
      mes_existe: false,
      crear: ["ELE2608-001", "ELE2608-002"],
      actualizar: [],
      eliminar: [],
    });
  });

  it("mes existente: separa las que se crean, se actualizan y se eliminan", async () => {
    const validacion = await leerPlantilla(ejemplo(AGOSTO), catalogosSemilla);
    const actuales = Array.from({ length: 25 }, (_, i) => `ELE2608-${String(i + 1).padStart(3, "0")}`);
    const resumen = resumir(validacion, new Map([["ELE|2026-08", [...actuales, "ELE2608-099"]]]));

    expect(resumen.meses[0].cambios).toEqual({
      mes_existe: true,
      crear: ["ELE2608-026"],
      actualizar: actuales,
      eliminar: ["ELE2608-099"],
    });
  });
});
