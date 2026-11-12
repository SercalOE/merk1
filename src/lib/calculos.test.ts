import { describe, expect, it } from "vitest";
import { inversionQ, nombreCampana, proyectado } from "./calculos";

describe("inversionQ", () => {
  it("GTQ queda igual", () => {
    expect(inversionQ(3600, "GTQ", 7.85)).toBe(3600);
  });

  it("USD se multiplica por el tipo de cambio", () => {
    expect(inversionQ(100, "USD", 7.85)).toBeCloseTo(785, 10);
  });
});

// Valores de agosto 2026 (Electroma), columna "Resultado proyectado" de Merk1_Plan_Electroma_Ago2026.xlsx.
describe("proyectado", () => {
  it("por mil: ELE2608-001 Alcance, Q2,000 a Q2.85 por mil", () => {
    expect(proyectado(2000, 2.85, "por_mil", null)).toBeCloseTo(701754.385964912, 6);
  });

  it("por mil: ELE2608-014 Alcance geolocalizado, Q11,000 a Q3.90 por mil", () => {
    expect(proyectado(11000, 3.9, "por_mil", null)).toBeCloseTo(2820512.82051282, 6);
  });

  it("por unidad: ELE2608-003 Search · Clics, Q3,600 a Q0.65 por clic", () => {
    expect(proyectado(3600, 0.65, "por_unidad", null)).toBeCloseTo(5538.46153846154, 8);
  });

  it("por unidad: ELE2608-023 Lead Forms, Q1,150 a Q50 por lead", () => {
    expect(proyectado(1150, 50, "por_unidad", null)).toBe(23);
  });

  it("sin costo: ELE2608-011 Mailing usa el proyectado manual (4,500)", () => {
    expect(proyectado(0, 0, "sin_costo", 4500)).toBe(4500);
  });

  it("sin costo y sin proyectado manual da 0", () => {
    expect(proyectado(0, 0, "sin_costo", null)).toBe(0);
  });

  it("costo estimado 0 en objetivo con costo usa el manual en vez de dividir entre 0", () => {
    expect(proyectado(1000, 0, "por_unidad", 120)).toBe(120);
  });

  it("USD: se proyecta sobre la inversión ya convertida a Q", () => {
    const q = inversionQ(100, "USD", 7.85); // $100 → Q785
    expect(proyectado(q, 3.14, "por_mil", null)).toBeCloseTo(250000, 6);
  });
});

describe("nombreCampana", () => {
  it("arma CÓDIGO | Actividad | Medio | Objetivo", () => {
    expect(nombreCampana("ELE2608-003", "Mantenimiento", "Google Ads", "Search · Clics")).toBe(
      "ELE2608-003 | Mantenimiento | Google Ads | Search · Clics",
    );
  });
});
