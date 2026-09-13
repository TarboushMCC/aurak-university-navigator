import { describe, expect, it } from "vitest";

import { classifyTurn } from "@/domain/instructions/classifyTurn";

describe("classifyTurn", () => {
  it("classifies near-zero angles as straight", () => {
    expect(classifyTurn(0)).toBe("straight");
    expect(classifyTurn(24)).toBe("straight");
    expect(classifyTurn(-24)).toBe("straight");
  });

  it("classifies slight turns", () => {
    expect(classifyTurn(45)).toBe("slight_right");
    expect(classifyTurn(-45)).toBe("slight_left");
  });

  it("classifies normal turns", () => {
    expect(classifyTurn(90)).toBe("right");
    expect(classifyTurn(-90)).toBe("left");
  });

  it("classifies sharp turns", () => {
    expect(classifyTurn(150)).toBe("sharp_right");
    expect(classifyTurn(-150)).toBe("sharp_left");
  });

  it("classifies near-180 as a u-turn", () => {
    expect(classifyTurn(178)).toBe("u_turn");
    expect(classifyTurn(-180)).toBe("u_turn");
  });

  it("is consistent at classification boundaries", () => {
    expect(classifyTurn(25)).toBe("slight_right");
    expect(classifyTurn(60)).toBe("right");
    expect(classifyTurn(135)).toBe("sharp_right");
    expect(classifyTurn(170)).toBe("u_turn");
  });
});
