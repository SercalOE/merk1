import { describe, expect, it } from "vitest";
import { correoPermitido, listaPermitida } from "./acceso";

describe("listaPermitida", () => {
  it("separa por coma e ignora espacios y mayúsculas", () => {
    const lista = listaPermitida(" Ana@OE.com.gt , luis@oe.com.gt,,");
    expect([...lista]).toEqual(["ana@oe.com.gt", "luis@oe.com.gt"]);
  });

  it("lista vacía no deja entrar a nadie", () => {
    expect(listaPermitida("").size).toBe(0);
    expect(correoPermitido("ana@oe.com.gt", "")).toBe(false);
  });
});

describe("correoPermitido", () => {
  const lista = "ana@oe.com.gt,luis@oe.com.gt";

  it("acepta un correo de la lista sin importar mayúsculas", () => {
    expect(correoPermitido("  ANA@oe.com.gt ", lista)).toBe(true);
  });

  it("rechaza un correo fuera de la lista", () => {
    expect(correoPermitido("otra@oe.com.gt", lista)).toBe(false);
  });

  it("rechaza correos parecidos", () => {
    expect(correoPermitido("ana@oe.com.gt.mx", lista)).toBe(false);
    expect(correoPermitido("xana@oe.com.gt", lista)).toBe(false);
  });

  it("rechaza correo vacío o nulo", () => {
    expect(correoPermitido("", lista)).toBe(false);
    expect(correoPermitido(null, lista)).toBe(false);
    expect(correoPermitido(undefined, lista)).toBe(false);
  });
});
