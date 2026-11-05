/**
 * The pixel world's palette, lifted from PixelWorldScreen so the home base and activity
 * screens read as part of the same meadow. Use these instead of the generic app colors on
 * any screen that belongs to the shared space (home base, activities, milestones).
 */
export const world = {
  /** Page background: warm parchment. */
  paper: "#f7f3e8",
  /** Raised panels, chips and floating labels. */
  panel: "#f3f0d8",
  /** Soft green-tinted surface for thumbnails and selected rows. */
  meadow: "#e8ecd2",
  meadowBorder: "#d3dab8",
  /** Hairlines and quiet borders. */
  line: "#d8dccb",
  /** Headings and primary text. */
  ink: "#344b3d",
  /** Body text. */
  text: "#435a46",
  /** Secondary text, eyebrows and footnotes. */
  muted: "#6f775f",
  /** Primary action fill and selected state. */
  forest: "#405d46",
  /** Text on forest. */
  onForest: "#f6f1df",
  /** Small accents: status dots, "open now". */
  leaf: "#6b8658",
  /** The world canvas's own backdrop, behind the Skia scene. */
  canvas: "#2b4632",
  /** Pixel-art outline color shared by avatars and sprites. */
  outline: "#3b2a2e",
  /** Errors stay warm, not alarm red. */
  error: "#a6452e",
} as const

/** Shared shapes: small radii and 1px borders, like the world's labels and buttons. */
export const worldShape = {
  radius: 8,
  smallRadius: 5,
  border: 1,
  /** Minimum touch target height for buttons. */
  control: 48,
} as const

/** Eyebrow label style ("YOUR HOME BASE"): tiny, tracked, uppercase. */
export const worldEyebrow = {
  color: world.muted,
  fontSize: 10,
  letterSpacing: 1.7,
  lineHeight: 16,
} as const
