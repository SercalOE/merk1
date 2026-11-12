import { q, usd } from "@/lib/formato";

// Celda de tabla con el monto en Q y su equivalente en $ debajo.
export function CeldaMonto({
  monto,
  tc,
  alerta = false,
  fuerte = false,
}: {
  monto: number;
  tc: number;
  alerta?: boolean;
  fuerte?: boolean;
}) {
  return (
    <td className={`px-4 py-2 text-right tabular-nums ${alerta ? "text-red-700" : ""} ${fuerte ? "font-semibold" : ""}`}>
      <div>{q(monto)}</div>
      <div className={`text-xs font-normal ${alerta ? "text-red-600" : "text-neutral-500"}`}>{usd(monto / tc)}</div>
    </td>
  );
}
