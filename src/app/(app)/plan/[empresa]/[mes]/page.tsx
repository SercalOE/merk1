import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CeldaMonto } from "@/components/monto";
import { inversionQ } from "@/lib/calculos";
import { fechaHora, mesLargo, numero, porcentaje, q, rangoFechas, usd } from "@/lib/formato";
import { leerPlan, type PlanMes } from "@/lib/plan/datos";
import { tablaKpis } from "@/lib/plan/kpis";
import { porActividad, porPartida } from "@/lib/plan/resumen";
import { TablaPlan } from "./tabla-plan";

const EMPRESA = /^[A-Z]{3}$/;
const MES = /^\d{4}-(0[1-9]|1[0-2])$/;

export default async function PlanPage({ params }: PageProps<"/plan/[empresa]/[mes]">) {
  const { empresa, mes } = await params;
  const codigo = empresa.toUpperCase();
  if (!EMPRESA.test(codigo) || !MES.test(mes)) notFound();

  const plan = await leerPlan(codigo, mes);
  if (!plan) notFound();

  const tc = plan.tipo_cambio;
  const totalQ = plan.lineas.reduce((suma, l) => suma + l.inversion_q, 0);

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 space-y-10 px-4 py-6 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href="/" className="text-sm text-neutral-500 hover:text-neutral-900">
            ← Merk1
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">
            {plan.empresa.nombre} · {mesLargo(plan.mes)}
          </h1>
          <p className="text-sm text-neutral-600">
            {plan.lineas.length} líneas · Plan <span className="font-medium text-neutral-900">{q(totalQ)}</span> (
            {usd(totalQ / tc)}) · TC {tc}
            {plan.ultima_carga && <> · Cargado el {fechaHora(plan.ultima_carga)}</>}
          </p>
        </div>
        <Link
          href="/cargar"
          className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
        >
          Cargar plan
        </Link>
      </header>

      <Insights plan={plan} />
      <Resumen plan={plan} />

      <Seccion titulo="Plan">
        <Suspense fallback={<p className="text-sm text-neutral-500">Cargando tabla…</p>}>
          <TablaPlan lineas={plan.lineas} tc={tc} />
        </Suspense>
      </Seccion>
    </main>
  );
}

// ---------- Insights ----------
function Insights({ plan }: { plan: PlanMes }) {
  const tc = plan.tipo_cambio;
  const filas = plan.presupuestos.map((p) => ({
    partida: p.partida,
    saldo: inversionQ(p.saldo_anterior, p.moneda, tc),
    mes: inversionQ(p.presupuesto_mes, p.moneda, tc),
  }));
  const total = (f: (x: (typeof filas)[number]) => number) => filas.reduce((s, x) => s + f(x), 0);
  const kpis = tablaKpis(plan.kpis);

  return (
    <Seccion titulo="Insights">
      <p className="text-sm text-neutral-700">
        Tipo de cambio: <span className="font-medium text-neutral-900">Q{tc}</span> por $1
      </p>

      <Tarjeta titulo="Presupuesto por partida">
        <Tabla encabezados={["Partida", "Saldo anterior", "Presupuesto del mes", "Disponible"]}>
          {filas.map((f) => (
            <tr key={f.partida}>
              <td className="px-4 py-2">{f.partida}</td>
              <CeldaMonto monto={f.saldo} tc={tc} alerta={f.saldo < 0} />
              <CeldaMonto monto={f.mes} tc={tc} />
              <CeldaMonto monto={f.saldo + f.mes} tc={tc} alerta={f.saldo + f.mes < 0} />
            </tr>
          ))}
          <FilaTotal>
            <CeldaMonto monto={total((x) => x.saldo)} tc={tc} fuerte />
            <CeldaMonto monto={total((x) => x.mes)} tc={tc} fuerte />
            <CeldaMonto monto={total((x) => x.saldo + x.mes)} tc={tc} fuerte />
          </FilaTotal>
        </Tabla>
      </Tarjeta>

      <div className="grid gap-6 lg:grid-cols-2">
        <Tarjeta titulo="Calendario de actividades">
          {plan.calendario.length === 0 ? (
            <Vacio>Sin actividades en el calendario.</Vacio>
          ) : (
            <Tabla encabezados={["Actividad", "Fechas", "Notas"]} derecha={[]}>
              {plan.calendario.map((c, i) => (
                <tr key={i}>
                  <td className="px-4 py-2">{c.actividad}</td>
                  <td className="whitespace-nowrap px-4 py-2">{rangoFechas(c.fecha_inicio, c.fecha_fin)}</td>
                  <td className="px-4 py-2 text-neutral-600">{c.notas}</td>
                </tr>
              ))}
            </Tabla>
          )}
        </Tarjeta>

        <Tarjeta titulo="KPIs">
          {kpis.filas.length === 0 ? (
            <Vacio>Sin KPIs.</Vacio>
          ) : (
            <Tabla
              encabezados={[
                "KPI",
                ...kpis.anios.map(String),
                kpis.anio_meta ? `Meta ${kpis.anio_meta}` : "Meta",
                kpis.anios.length >= 2 ? `Crec. ${kpis.anios.at(-1)} vs ${kpis.anios.at(-2)}` : "Crec.",
                "Crec. meta",
              ]}
            >
              {kpis.filas.map((k) => (
                <tr key={k.kpi}>
                  <td className="px-4 py-2">{k.kpi}</td>
                  {kpis.anios.map((a) => (
                    <td key={a} className="px-4 py-2 text-right tabular-nums">
                      {k.reales[a] == null ? "—" : numero(k.reales[a])}
                    </td>
                  ))}
                  <td className="px-4 py-2 text-right tabular-nums">
                    {k.meta == null ? <span className="text-amber-700">Sin meta</span> : numero(k.meta)}
                  </td>
                  <CeldaCrecimiento valor={k.crecimiento_real} />
                  <CeldaCrecimiento valor={k.crecimiento_meta} />
                </tr>
              ))}
            </Tabla>
          )}
        </Tarjeta>
      </div>
    </Seccion>
  );
}

function CeldaCrecimiento({ valor }: { valor: number | null }) {
  if (valor == null) return <td className="px-4 py-2 text-right text-neutral-400">—</td>;
  return (
    <td className={`px-4 py-2 text-right tabular-nums ${valor < 0 ? "text-red-700" : ""}`}>
      {valor > 0 ? "+" : ""}
      {porcentaje(valor)}
    </td>
  );
}

// ---------- Resumen ----------
function Resumen({ plan }: { plan: PlanMes }) {
  const tc = plan.tipo_cambio;
  const actividades = porActividad(plan.lineas);
  const partidas = porPartida(plan.presupuestos, plan.lineas, tc);
  const suma = <T,>(xs: T[], f: (x: T) => number) => xs.reduce((s, x) => s + f(x), 0);

  return (
    <Seccion titulo="Resumen">
      <div className="grid gap-6 lg:grid-cols-[2fr_3fr]">
        <Tarjeta titulo="Por actividad">
          <Tabla encabezados={["Actividad", "Inversión", "% del plan"]}>
            {actividades.map((a) => (
              <tr key={a.actividad}>
                <td className="px-4 py-2">{a.actividad}</td>
                <CeldaMonto monto={a.inversion_q} tc={tc} />
                <td className="px-4 py-2 text-right tabular-nums">{porcentaje(a.porcentaje)}</td>
              </tr>
            ))}
            <FilaTotal>
              <CeldaMonto monto={suma(actividades, (a) => a.inversion_q)} tc={tc} fuerte />
              <td className="px-4 py-2 text-right tabular-nums">{actividades.length > 0 ? "100.0%" : "—"}</td>
            </FilaTotal>
          </Tabla>
        </Tarjeta>

        <Tarjeta titulo="Por partida">
          <Tabla encabezados={["Partida", "Disponible", "Planeado", "Diferencia"]}>
            {partidas.map((p) => (
              <tr key={p.partida}>
                <td className="px-4 py-2">{p.partida}</td>
                <CeldaMonto monto={p.disponible_q} tc={tc} alerta={p.disponible_q < 0} />
                <CeldaMonto monto={p.planeado_q} tc={tc} />
                <CeldaMonto monto={p.diferencia_q} tc={tc} alerta={p.diferencia_q < -0.005} />
              </tr>
            ))}
            <FilaTotal>
              <CeldaMonto monto={suma(partidas, (p) => p.disponible_q)} tc={tc} fuerte />
              <CeldaMonto monto={suma(partidas, (p) => p.planeado_q)} tc={tc} fuerte />
              <CeldaMonto
                monto={suma(partidas, (p) => p.diferencia_q)}
                tc={tc}
                fuerte
                alerta={suma(partidas, (p) => p.diferencia_q) < -0.005}
              />
            </FilaTotal>
          </Tabla>
          <p className="border-t border-neutral-100 px-4 py-2 text-xs text-neutral-500">
            Diferencia = disponible − planeado. En rojo, las partidas donde el plan se pasa de lo disponible.
          </p>
        </Tarjeta>
      </div>
    </Seccion>
  );
}

// ---------- Piezas ----------
function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="border-b border-neutral-200 pb-2 text-lg font-semibold">{titulo}</h2>
      {children}
    </section>
  );
}

function Tarjeta({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white">
      <h3 className="border-b border-neutral-200 px-4 py-3 text-sm font-semibold">{titulo}</h3>
      {children}
    </div>
  );
}

// La primera columna va a la izquierda y el resto a la derecha, salvo que se indique otra cosa.
function Tabla({
  encabezados,
  derecha,
  children,
}: {
  encabezados: string[];
  derecha?: number[];
  children: React.ReactNode;
}) {
  const alDerecha = (i: number) => (derecha ? derecha.includes(i) : i > 0);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-xs uppercase tracking-wide text-neutral-500">
          <tr>
            {encabezados.map((e, i) => (
              <th key={e} className={`px-4 py-2 font-medium ${alDerecha(i) ? "text-right" : ""}`}>
                {e}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">{children}</tbody>
      </table>
    </div>
  );
}

function FilaTotal({ children }: { children: React.ReactNode }) {
  return (
    <tr className="border-t border-neutral-200 font-semibold">
      <td className="px-4 py-2">Total</td>
      {children}
    </tr>
  );
}

function Vacio({ children }: { children: React.ReactNode }) {
  return <p className="px-4 py-6 text-sm text-neutral-500">{children}</p>;
}
