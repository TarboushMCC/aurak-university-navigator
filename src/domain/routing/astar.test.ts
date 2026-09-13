import { describe, expect, it } from "vitest";

import { findShortestPath } from "@/domain/routing/astar";

import type { GraphEdge, GraphNode } from "@/domain/schema";

function node(id: string, x: number, y: number): GraphNode {
  return { id, kind: "junction", levelId: "ground", x, y, floor: 0, indoor: false };
}
function edge(id: string, from: string, to: string, lengthM?: number): GraphEdge {
  return { id, from, to, bidirectional: true, kind: "walkway", lengthM, accessible: null };
}

describe("findShortestPath", () => {
  it("finds the direct path when only one exists", () => {
    const nodes = [node("a", 0, 0), node("b", 10, 0), node("c", 20, 0)];
    const edges = [edge("e1", "a", "b"), edge("e2", "b", "c")];
    const result = findShortestPath(nodes, edges, "a", "c");
    expect(result?.nodeIds).toEqual(["a", "b", "c"]);
    expect(result?.distanceM).toBeCloseTo(20);
  });

  it("picks the shorter of two routes", () => {
    // a -- b -- c (long way, 2+2=4) vs a -- d -- c (short way, 1+1=2)
    const nodes = [node("a", 0, 0), node("b", 100, 100), node("c", 4, 0), node("d", 2, 1)];
    const edges = [
      edge("ab", "a", "b", 2),
      edge("bc", "b", "c", 2),
      edge("ad", "a", "d", 1),
      edge("dc", "d", "c", 1),
    ];
    const result = findShortestPath(nodes, edges, "a", "c");
    expect(result?.nodeIds).toEqual(["a", "d", "c"]);
    expect(result?.distanceM).toBe(2);
  });

  it("returns null when the graph is disconnected", () => {
    const nodes = [node("a", 0, 0), node("b", 10, 0)];
    const edges: GraphEdge[] = [];
    expect(findShortestPath(nodes, edges, "a", "b")).toBeNull();
  });

  it("respects a one-directional edge", () => {
    const nodes = [node("a", 0, 0), node("b", 10, 0)];
    const edges = [{ ...edge("ab", "a", "b", 10), bidirectional: false }];
    expect(findShortestPath(nodes, edges, "a", "b")?.nodeIds).toEqual(["a", "b"]);
    expect(findShortestPath(nodes, edges, "b", "a")).toBeNull();
  });

  it("returns a zero-length path when start equals end", () => {
    const nodes = [node("a", 0, 0)];
    const result = findShortestPath(nodes, [], "a", "a");
    expect(result).toEqual({ nodeIds: ["a"], distanceM: 0 });
  });

  it("returns null for an unknown node id", () => {
    const nodes = [node("a", 0, 0)];
    expect(findShortestPath(nodes, [], "a", "missing")).toBeNull();
  });
});
