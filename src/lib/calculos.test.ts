import { describe, expect, it } from "vitest";
import { inversionQ } from "./calculos";

describe("inversionQ", () => {
  it("GTQ queda igual", () => {
    expect(inversionQ(3600, "GTQ", 7.85)).toBe(3600);
  });

  it("USD se multiplica por el tipo de cambio", () => {
    expect(inversionQ(100, "USD", 7.85)).toBeCloseTo(785, 10);
  });
});
