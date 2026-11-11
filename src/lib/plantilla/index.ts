import { leerLibro } from "./leer";
import { validarPlantilla } from "./validar";
import type { Catalogos, Validacion } from "./tipos";

export { resumir, compararLineas } from "./resumen";
export type * from "./resumen";
export type * from "./tipos";

// Lee y valida la plantilla de carga en un solo paso.
export async function leerPlantilla(archivo: ArrayBuffer | Uint8Array, catalogos: Catalogos): Promise<Validacion> {
  return validarPlantilla(await leerLibro(archivo), catalogos);
}
