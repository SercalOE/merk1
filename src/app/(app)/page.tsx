import Link from "next/link";
import { mesLargo, q, usd } from "@/lib/formato";
import { leerMesesCargados } from "@/lib/plan/datos";

export default async function InicioPage() {
  const empresas = await leerMesesCargados();

  return (
    <main className="flex flex-1 flex-col">
      <header className="flex items-center justify-end px-6 py-4">
        <form action="/auth/salir" method="post">
          <button
            type="submit"
            className="text-sm text-neutral-600 underline-offset-4 hover:text-neutral-900 hover:underline"
          >
            Cerrar sesión
          </button>
        </form>
      </header>
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-10 px-4 py-10 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-5xl font-semibold tracking-tight">Merk1</h1>
          <Link
            href="/cargar"
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700"
          >
            Cargar plan
          </Link>
        </div>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Planes cargados</h2>
          {empresas.length === 0 ? (
            <p className="rounded-lg border border-dashed border-neutral-300 px-5 py-8 text-center text-sm text-neutral-600">
              Todavía no hay planes. Sube la plantilla del mes en «Cargar plan».
            </p>
          ) : (
            empresas.map((e) => (
              <div key={e.codigo} className="rounded-lg border border-neutral-200 bg-white">
                <h3 className="border-b border-neutral-200 px-5 py-3 text-sm font-semibold">
                  {e.nombre} <span className="font-normal text-neutral-500">· {e.codigo}</span>
                </h3>
                <ul className="divide-y divide-neutral-100">
                  {e.meses.map((m) => (
                    <li key={m.mes}>
                      <Link
                        href={`/plan/${e.codigo}/${m.mes}`}
                        className="flex flex-wrap items-baseline justify-between gap-2 px-5 py-3 text-sm hover:bg-neutral-50"
                      >
                        <span className="font-medium capitalize">{mesLargo(m.mes)}</span>
                        <span className="text-neutral-600">
                          {m.lineas} líneas · <span className="text-neutral-900">{q(m.plan_q)}</span> ({usd(m.plan_usd)})
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </section>
      </div>
    </main>
  );
}
