import type { PixelArt } from "./types.ts";

// One path per color keeps the catalog and repeated placements inexpensive.
export function pixelPaths(artifact: PixelArt) {
  const paths = new Map<string, string[]>();
  artifact.pixels.forEach((row, y) => {
    [...row].forEach((color, x) => {
      if (color === ".") return;
      const path = paths.get(color) ?? [];
      path.push(`M${x} ${y}h1v1h-1z`);
      paths.set(color, path);
    });
  });
  return [...paths].map(([color, parts]) => ({
    fill: artifact.palette[color]!,
    d: parts.join(""),
  }));
}
