export interface PixelArt {
  // A dot is transparent; every other character refers to a palette color.
  format: "pixel-art";
  palette: Record<string, string>;
  pixels: string[];
}
export interface RewardItem {
  id: string;
  name: string;
  // Independent of activity categories; new catalog groups need no new model.
  category: string;
  artifact: PixelArt;
}
