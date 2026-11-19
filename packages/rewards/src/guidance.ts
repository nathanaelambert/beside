// Equal-value rewards: every catalog item is worth exactly one milestone. Nothing
// here is a price or a rarity. It describes what kind of moment an item suits,
// so pickers can suggest a fit without inventing an economy.

/**
 * - `collection`: small things that read best in groups (a flower bed, a grove).
 *   Suited to repeating milestones, where one lands per session.
 * - `marker`: a first, a start, a kick-off.
 * - `landmark`: one memorable moment, like finishing something big. A meadow
 *   full of the same landmark loses what made it special.
 */
export type RewardRole = "collection" | "marker" | "landmark";

export interface CategoryGuide {
  role: RewardRole;
  /** One line shown in the picker, describing the moment this category suits. */
  fit: string;
}

export const categoryGuides: Record<string, CategoryGuide> = {
  Flowers: {
    role: "collection",
    fit: "Small and repeatable. One per session and a flower bed fills in.",
  },
  Trees: {
    role: "collection",
    fit: "For steady habits. A grove grows one tree at a time.",
  },
  Flagpoles: {
    role: "marker",
    fit: "For firsts and kick-offs. Plant a flag where something started.",
  },
  Furniture: {
    role: "marker",
    fit: "A place to sit together, for something you did side by side.",
  },
  Statues: {
    role: "landmark",
    fit: "Landmarks for one big moment: a finish line, a last chapter.",
  },
};

const fallback: CategoryGuide = {
  role: "marker",
  fit: "A keepsake for this milestone.",
};

export function guideFor(category: string): CategoryGuide {
  return categoryGuides[category] ?? fallback;
}
