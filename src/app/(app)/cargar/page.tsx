import Link from "next/link";
import { FormularioCarga } from "./formulario-carga";

export default function CargarPage() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6">
      <header className="mb-6 flex items-center justify-between gap-4">
        <div>
          <Link href="/" className="text-sm text-neutral-500 hover:text-neutral-900">
            ← Merk1
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">Cargar plan</h1>
        </div>
      </header>
      <p className="mb-6 max-w-2xl text-sm text-neutral-600">
        Sube la plantilla <span className="font-mono text-neutral-900">Merk1_Plantilla_Carga_*.xlsx</span>. Merk1 la
        valida y te muestra un resumen antes de guardar. Si el mes ya existe, se actualizan sus líneas (conservan su
        identificador), se eliminan las que ya no vienen y se reemplazan presupuesto, calendario y KPIs.
      </p>
      <FormularioCarga />
    </main>
  );
}
