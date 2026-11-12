"use server";

import { requerirUsuario, type Usuario } from "@/lib/auth";
import {
  BUCKET_CARGAS,
  datosParaAplicar,
  leerCatalogos,
  leerLineasExistentes,
  nombreArchivoSeguro,
} from "@/lib/carga/datos";
import { leerPlantilla, resumir, type Resumen } from "@/lib/plantilla";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { crearClienteServidor } from "@/lib/supabase/server";

export type ResultadoMes = {
  empresa_codigo: string;
  mes: string;
  creadas: number;
  actualizadas: number;
  eliminadas: number;
};

export type EstadoCarga =
  | { paso: "subir"; error?: string }
  | {
      paso: "resumen";
      cargaId: string;
      archivo: string;
      empresas: Record<string, string>;
      resumen: Resumen;
      firma: string; // lo que vio el usuario; si cambia antes de confirmar, se vuelve a pedir
      error?: string;
    }
  | { paso: "aplicada"; archivo: string; empresas: Record<string, string>; meses: ResultadoMes[] };

const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const MAX_BYTES = 4 * 1024 * 1024; // el límite de la Server Action es 5 MB (next.config.ts)
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function accionCarga(_previo: EstadoCarga, formData: FormData): Promise<EstadoCarga> {
  // La pantalla ya exige sesión, pero la acción es un POST público: se revisa otra vez.
  const usuario = await requerirUsuario();
  const intencion = String(formData.get("intencion") ?? "");

  try {
    if (intencion === "reiniciar") return { paso: "subir" };
    if (intencion === "confirmar") return await confirmar(usuario, formData);
    return await validar(usuario, formData);
  } catch (e) {
    console.error("[cargar]", e);
    return { paso: "subir", error: "Algo falló al procesar la carga. Intenta de nuevo; si sigue, avisa a soporte." };
  }
}

// Paso 1: leer, validar, guardar el Excel en Storage y registrar la carga.
async function validar(usuario: Usuario, formData: FormData): Promise<EstadoCarga> {
  const archivo = formData.get("archivo");
  if (!(archivo instanceof File) || archivo.size === 0) return { paso: "subir", error: "Elige un archivo .xlsx." };
  if (!archivo.name.toLowerCase().endsWith(".xlsx")) {
    return { paso: "subir", error: "El archivo debe ser .xlsx (la plantilla Merk1_Plantilla_Carga)." };
  }
  if (archivo.size > MAX_BYTES) return { paso: "subir", error: "El archivo pesa más de 4 MB." };

  const bytes = new Uint8Array(await archivo.arrayBuffer());
  const { catalogos, validacion, resumen } = await analizar(bytes);

  const admin = crearClienteAdmin();
  const cargaId = crypto.randomUUID();
  const ruta = `plan/${cargaId}/${nombreArchivoSeguro(archivo.name)}`;

  const subida = await admin.storage.from(BUCKET_CARGAS).upload(ruta, bytes, { contentType: XLSX, upsert: false });
  if (subida.error) throw new Error(`Storage: ${subida.error.message}`);

  // "errores" guarda errores y avisos, para dejar rastro de lo que se vio al validar.
  const registro = await admin.from("cargas").insert({
    id: cargaId,
    tipo: "plan",
    archivo: ruta,
    subido_por: usuario.email,
    estado: resumen.errores.length > 0 ? "con_errores" : "validando",
    errores: validacion.problemas,
  });
  if (registro.error) throw new Error(`cargas: ${registro.error.message}`);

  return {
    paso: "resumen",
    cargaId,
    archivo: archivo.name,
    empresas: nombresEmpresas(catalogos.empresas),
    resumen,
    firma: firmar(resumen),
  };
}

// Paso 2: volver a leer el archivo guardado (no se confía en lo que mande el navegador) y aplicarlo.
async function confirmar(usuario: Usuario, formData: FormData): Promise<EstadoCarga> {
  const cargaId = String(formData.get("carga_id") ?? "");
  if (!UUID.test(cargaId)) return { paso: "subir", error: "Carga no válida. Sube el archivo de nuevo." };

  const admin = crearClienteAdmin();
  const { data: carga, error } = await admin
    .from("cargas")
    .select("id, tipo, archivo, subido_por, estado")
    .eq("id", cargaId)
    .maybeSingle();
  if (error) throw new Error(`cargas: ${error.message}`);
  if (!carga || carga.tipo !== "plan") return { paso: "subir", error: "No se encontró la carga. Sube el archivo de nuevo." };
  if (carga.subido_por !== usuario.email) return { paso: "subir", error: "Solo quien subió el archivo puede confirmarlo." };
  if (carga.estado === "aplicada") return { paso: "subir", error: "Esta carga ya se aplicó." };
  if (carga.estado !== "validando") return { paso: "subir", error: "Esta carga tiene errores. Corrige el Excel y súbelo de nuevo." };

  const descarga = await admin.storage.from(BUCKET_CARGAS).download(carga.archivo);
  if (descarga.error) throw new Error(`Storage: ${descarga.error.message}`);

  const bytes = new Uint8Array(await descarga.data.arrayBuffer());
  const { catalogos, validacion, resumen } = await analizar(bytes);
  const archivo = carga.archivo.split("/").pop() ?? carga.archivo;
  const empresas = nombresEmpresas(catalogos.empresas);
  const firma = firmar(resumen);
  const enResumen = (mensaje: string): EstadoCarga => ({
    paso: "resumen",
    cargaId,
    archivo,
    empresas,
    resumen,
    firma,
    error: mensaje,
  });

  // Los catálogos pueden haber cambiado desde que se validó.
  if (resumen.errores.length > 0) {
    await admin.from("cargas").update({ estado: "con_errores", errores: validacion.problemas }).eq("id", cargaId);
    return enResumen("Al volver a validar aparecieron errores. Corrige el Excel y súbelo de nuevo.");
  }
  // El plan en la base cambió entre validar y confirmar (ej. otra carga del mismo mes).
  if (formData.get("firma") !== firma) {
    return enResumen("El plan guardado cambió desde que validaste. Revisa el resumen actualizado y confirma de nuevo.");
  }
  if (resumen.meses.some((m) => m.cambios?.mes_existe) && formData.get("reemplazar") !== "si") {
    return enResumen("Marca la casilla para confirmar que reemplazas el plan del mes que ya existe.");
  }

  const aplicada = await admin.rpc("aplicar_carga_plan", {
    p_carga_id: cargaId,
    p_datos: datosParaAplicar(validacion.meses),
  });
  if (aplicada.error) {
    console.error("[cargar] aplicar_carga_plan", aplicada.error);
    return enResumen(`No se guardó nada: ${aplicada.error.message}`);
  }

  return { paso: "aplicada", archivo, empresas, meses: (aplicada.data as { meses: ResultadoMes[] }).meses };
}

// Lee catálogos y líneas existentes con la sesión del usuario (RLS de lectura) y valida.
async function analizar(bytes: Uint8Array) {
  const supabase = await crearClienteServidor();
  const catalogos = await leerCatalogos(supabase);
  const validacion = await leerPlantilla(bytes, catalogos);
  const existentes = await leerLineasExistentes(supabase, validacion.meses);
  return { catalogos, validacion, resumen: resumir(validacion, existentes) };
}

function nombresEmpresas(empresas: { codigo: string; nombre: string }[]) {
  return Object.fromEntries(empresas.map((e) => [e.codigo, e.nombre]));
}

// Huella de lo que va a pasar con las líneas de cada mes.
function firmar(resumen: Resumen): string {
  return resumen.meses
    .map((m) => {
      const c = m.cambios;
      return `${m.empresa_codigo}|${m.mes}|${c?.mes_existe}|${c?.crear.join(",")}|${c?.eliminar.join(",")}`;
    })
    .join(";");
}
