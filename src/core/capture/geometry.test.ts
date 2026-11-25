import { describe, expect, it } from "vitest";
import {
  actionBarPosition,
  boxFromPoints,
  containFit,
  imageViewBox,
  monitorRegions,
  viewBoxToImage,
} from "./geometry";

describe("containFit", () => {
  it("maps a HiDPI screenshot onto the viewport", () => {
    // 2× display: 3840×2160 image shown on a 1920×1080 fullscreen window
    expect(containFit(3840, 2160, 1920, 1080)).toEqual({ scale: 0.5, offsetX: 0, offsetY: 0 });
  });

  it("letterboxes when aspect ratios differ (e.g. two monitors)", () => {
    const fit = containFit(3840, 1080, 1920, 1080);
    expect(fit.scale).toBe(0.5);
    expect(fit.offsetY).toBe(270);
  });
});

describe("selection mapping", () => {
  it("normalises drags in any direction", () => {
    expect(boxFromPoints({ x: 50, y: 40 }, { x: 10, y: 100 })).toEqual({
      x: 10,
      y: 40,
      w: 40,
      h: 60,
    });
  });

  it("converts view pixels to image pixels and clamps", () => {
    const fit = { scale: 0.5, offsetX: 0, offsetY: 100 };
    expect(viewBoxToImage({ x: 10, y: 110, w: 100, h: 50 }, fit, 1000, 800)).toEqual({
      x: 20,
      y: 20,
      w: 200,
      h: 100,
    });
    // dragging into the letterbox is clamped to the image
    expect(viewBoxToImage({ x: -20, y: 50, w: 60, h: 100 }, fit, 1000, 800)).toEqual({
      x: 0,
      y: 0,
      w: 80,
      h: 100,
    });
  });

  it("gives the whole image as a view box", () => {
    expect(imageViewBox(1000, 500, { scale: 0.5, offsetX: 10, offsetY: 20 })).toEqual({
      x: 10,
      y: 20,
      w: 500,
      h: 250,
    });
  });
});

describe("actionBarPosition", () => {
  const view = { w: 1000, h: 800 };
  it("prefers below, right-aligned", () => {
    expect(actionBarPosition({ x: 100, y: 100, w: 400, h: 200 }, 300, 44, view.w, view.h)).toEqual({
      x: 200,
      y: 310,
    });
  });

  it("goes above when there's no room below", () => {
    expect(actionBarPosition({ x: 100, y: 500, w: 400, h: 290 }, 300, 44, view.w, view.h).y).toBe(
      446,
    );
  });

  it("goes inside for a full-screen selection and stays on screen", () => {
    const p = actionBarPosition({ x: 0, y: 0, w: 1000, h: 800 }, 300, 44, view.w, view.h);
    expect(p).toEqual({ x: 690, y: 746 });
  });
});

describe("monitorRegions", () => {
  it("splits side-by-side monitors", () => {
    const monitors = [
      { x: 0, y: 0, w: 1920, h: 1080 },
      { x: 1920, y: 0, w: 2560, h: 1440 },
    ];
    expect(monitorRegions(monitors, 4480, 1440)).toEqual([
      { x: 0, y: 0, w: 1920, h: 1080 },
      { x: 1920, y: 0, w: 2560, h: 1440 },
    ]);
  });

  it("handles negative origins and a capture at a different scale", () => {
    const monitors = [
      { x: -1920, y: 0, w: 1920, h: 1080 },
      { x: 0, y: 0, w: 1920, h: 1080 },
    ];
    // compositor captured at half the reported size
    expect(monitorRegions(monitors, 1920, 540)).toEqual([
      { x: 0, y: 0, w: 960, h: 540 },
      { x: 960, y: 0, w: 960, h: 540 },
    ]);
  });

  it("falls back to the whole image for one monitor or a mismatched layout", () => {
    expect(monitorRegions([{ x: 0, y: 0, w: 1920, h: 1080 }], 1920, 1080)).toEqual([
      { x: 0, y: 0, w: 1920, h: 1080 },
    ]);
    expect(
      monitorRegions(
        [
          { x: 0, y: 0, w: 100, h: 100 },
          { x: 100, y: 0, w: 100, h: 100 },
        ],
        500,
        500,
      ),
    ).toEqual([{ x: 0, y: 0, w: 500, h: 500 }]);
  });
});
