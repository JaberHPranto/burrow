import { optimize } from "svgo/dist/svgo.browser.js";

export interface OptimizeResult {
  data: string;
  before: number;
  after: number;
}

/** Run SVGO's default preset, keeping viewBox so icons stay scalable. */
export function optimizeSvg(svg: string): OptimizeResult {
  const { data } = optimize(svg, {
    multipass: true,
    plugins: [
      {
        name: "preset-default",
        params: { overrides: { removeViewBox: false } },
      },
    ],
  });
  return { data, before: new Blob([svg]).size, after: new Blob([data]).size };
}
