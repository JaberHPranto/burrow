import { describe, expect, it } from "vitest";
import {
  type Shape,
  arrowHead,
  clampRect,
  fitScale,
  historyReducer,
  initialHistory,
  isTiny,
  nextStepNumber,
  normalizeRect,
  shapeAt,
  timestampedName,
} from "./model";

const rect = (id: string, x: number, y: number, w = 10, h = 10): Shape => ({
  id,
  kind: "rect",
  color: "#f28b82",
  stroke: 2,
  x,
  y,
  w,
  h,
});

describe("history", () => {
  it("adds, undoes and redoes", () => {
    let h = initialHistory();
    h = historyReducer(h, { type: "add", shape: rect("a", 0, 0) });
    h = historyReducer(h, { type: "add", shape: rect("b", 5, 5) });
    expect(h.present.shapes.map((s) => s.id)).toEqual(["a", "b"]);
    h = historyReducer(h, { type: "undo" });
    expect(h.present.shapes.map((s) => s.id)).toEqual(["a"]);
    h = historyReducer(h, { type: "redo" });
    expect(h.present.shapes.map((s) => s.id)).toEqual(["a", "b"]);
  });

  it("clears the redo stack on a new edit and ignores no-ops", () => {
    let h = historyReducer(initialHistory(), { type: "add", shape: rect("a", 0, 0) });
    h = historyReducer(h, { type: "undo" });
    h = historyReducer(h, { type: "add", shape: rect("c", 0, 0) });
    expect(h.future).toEqual([]);
    expect(historyReducer(h, { type: "redo" })).toBe(h);
    const empty = initialHistory();
    expect(historyReducer(empty, { type: "undo" })).toBe(empty);
  });

  it("moves, updates, removes and crops", () => {
    let h = historyReducer(initialHistory(), { type: "add", shape: rect("a", 0, 0) });
    h = historyReducer(h, { type: "move", id: "a", dx: 5, dy: -2 });
    expect(h.present.shapes[0]).toMatchObject({ x: 5, y: -2 });
    h = historyReducer(h, { type: "update", id: "a", patch: { color: "#000" } });
    expect(h.present.shapes[0]?.color).toBe("#000");
    h = historyReducer(h, { type: "crop", rect: { x: 1, y: 1, w: 5, h: 5 } });
    expect(h.present.crop).toEqual({ x: 1, y: 1, w: 5, h: 5 });
    h = historyReducer(h, { type: "remove", id: "a" });
    expect(h.present.shapes).toEqual([]);
    expect(h.past).toHaveLength(5);
  });
});

describe("geometry", () => {
  it("normalizes and clamps rects", () => {
    expect(normalizeRect({ x: 10, y: 10 }, { x: 2, y: 4 })).toEqual({ x: 2, y: 4, w: 8, h: 6 });
    expect(clampRect({ x: -5, y: 90, w: 20, h: 20 }, 100, 100)).toEqual({
      x: 0,
      y: 90,
      w: 15,
      h: 10,
    });
  });

  it("hit-tests the topmost shape, arrows by distance", () => {
    const arrow: Shape = {
      id: "arr",
      kind: "arrow",
      color: "#fff",
      stroke: 4,
      from: { x: 0, y: 0 },
      to: { x: 100, y: 0 },
    };
    const shapes = [rect("under", 0, 0, 50, 50), rect("over", 10, 10, 10, 10), arrow];
    expect(shapeAt(shapes, { x: 15, y: 15 }, 2)?.id).toBe("over");
    expect(shapeAt(shapes, { x: 40, y: 40 }, 2)?.id).toBe("under");
    expect(shapeAt(shapes, { x: 80, y: 3 }, 2)?.id).toBe("arr");
    expect(shapeAt(shapes, { x: 80, y: 30 }, 2)).toBeUndefined();
  });

  it("places arrow barbs behind the tip", () => {
    const [a, b] = arrowHead({ x: 0, y: 0 }, { x: 100, y: 0 }, 20);
    expect(a.x).toBeLessThan(100);
    expect(b.x).toBeLessThan(100);
    expect(Math.sign(a.y)).toBe(-Math.sign(b.y));
  });

  it("numbers steps and spots accidental clicks", () => {
    const step = (n: number): Shape => ({
      id: `s${n}`,
      kind: "step",
      color: "#fff",
      stroke: 2,
      x: 0,
      y: 0,
      n,
      size: 14,
    });
    expect(nextStepNumber([step(1), step(4)])).toBe(5);
    expect(nextStepNumber([])).toBe(1);
    expect(isTiny(rect("t", 0, 0, 2, 30))).toBe(true);
    expect(isTiny(rect("t", 0, 0, 20, 30))).toBe(false);
  });

  it("fits without upscaling", () => {
    expect(fitScale(2000, 1000, 1000, 1000)).toBe(0.5);
    expect(fitScale(200, 100, 1000, 1000)).toBe(1);
  });

  it("names files with a timestamp", () => {
    expect(timestampedName(new Date(2026, 10, 25, 9, 5, 7))).toBe("burrow-20261125-090507.png");
  });
});
