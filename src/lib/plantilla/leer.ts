import ExcelJS from "exceljs";
import { CONTRATO, HOJAS } from "./contrato";
import type { Celda, FilaCruda, LibroCrudo, Problema } from "./tipos";

// Abre el .xlsx y devuelve las filas de cada hoja del contrato, sin interpretar.
// Solo revisa la estructura: hojas y columnas faltantes.
export async function leerLibro(archivo: ArrayBuffer | Uint8Array): Promise<LibroCrudo> {
  const libro = new ExcelJS.Workbook();
  try {
    await libro.xlsx.load(archivo as unknown as ExcelJS.Buffer);
  } catch {
    return {
      hojas: {},
      problemas: [{ nivel: "error", hoja: "Archivo", mensaje: "No se pudo abrir el archivo. Debe ser un .xlsx." }],
    };
  }

  const problemas: Problema[] = [];
  const hojas: LibroCrudo["hojas"] = {};

  for (const nombre of HOJAS) {
    const hoja = libro.getWorksheet(nombre);
    if (!hoja) {
      problemas.push({ nivel: "error", hoja: nombre, mensaje: `Falta la hoja «${nombre}».` });
      continue;
    }

    // Encabezado → número de columna. El orden de las columnas no importa.
    const columnas = new Map<string, number>();
    hoja.getRow(1).eachCell((celda, numero) => {
      const valor = valorCelda(celda.value);
      if (typeof valor === "string") columnas.set(valor, numero);
    });

    const esperadas: readonly string[] = CONTRATO[nombre];
    const faltantes = esperadas.filter((c) => !columnas.has(c));
    for (const columna of faltantes) {
      problemas.push({ nivel: "error", hoja: nombre, fila: 1, columna, mensaje: `Falta la columna «${columna}».` });
    }
    if (faltantes.length > 0) continue;

    const filas: FilaCruda[] = [];
    hoja.eachRow((fila, numero) => {
      if (numero === 1) return;
      const valores: Record<string, Celda> = {};
      for (const columna of esperadas) {
        valores[columna] = valorCelda(fila.getCell(columnas.get(columna)!).value);
      }
      if (esFilaVaciaONota(valores)) return;
      filas.push({ fila: numero, valores });
    });
    hojas[nombre] = { nombre, filas };
  }

  return { hojas, problemas };
}

// Convierte el valor de exceljs a algo simple. Las fórmulas se leen por su resultado.
function valorCelda(valor: ExcelJS.CellValue): Celda {
  if (valor === null || valor === undefined) return null;
  if (valor instanceof Date) return valor;
  if (typeof valor === "string") {
    const limpio = valor.trim();
    return limpio === "" ? null : limpio;
  }
  if (typeof valor === "number" || typeof valor === "boolean") return valor;
  if (typeof valor === "object") {
    if ("formula" in valor || "sharedFormula" in valor) {
      return valorCelda((valor as ExcelJS.CellFormulaValue).result as ExcelJS.CellValue);
    }
    if ("richText" in valor) return valorCelda(valor.richText.map((parte) => parte.text).join(""));
    if ("text" in valor && typeof valor.text === "string") return valorCelda(valor.text);
  }
  return null; // errores de fórmula (#N/A, #REF!) y otros casos raros
}

// Fila vacía, o nota escrita en una sola celda (ej. la aclaración al final de la hoja KPIs).
function esFilaVaciaONota(valores: Record<string, Celda>): boolean {
  const llenas = Object.values(valores).filter((v) => v !== null);
  if (llenas.length === 0) return true;
  return llenas.length === 1 && typeof llenas[0] === "string" && /\s/.test(llenas[0]);
}
