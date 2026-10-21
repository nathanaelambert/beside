"use client";

import { useState } from "react";
import { Download, Eraser } from "lucide-react";
import type { Database, RewardItem } from "../lib/types";
import { pixelPaths } from "../lib/pixel-art";
import { Badge, Empty, JsonRecord } from "./ui";

function PixelSprite({ item }: { item: RewardItem }) {
  const { pixels } = item.artifact;
  return (
    <svg
      className="reward-sprite"
      viewBox={`0 0 ${pixels[0]!.length} ${pixels.length}`}
      shapeRendering="crispEdges"
      aria-hidden="true"
    >
      {pixelPaths(item.artifact).map(({ fill, d }, index) => (
        <path key={index} fill={fill} d={d} />
      ))}
    </svg>
  );
}

function downloadArtifact(item: RewardItem) {
  // Serialize the rendered, palette-only SVG; imported artifacts cannot contain markup.
  const { pixels } = item.artifact;
  const paths = pixelPaths(item.artifact)
    .map(({ fill, d }) => `<path fill="${fill}" d="${d}"/>`)
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${pixels[0]!.length}" height="${pixels.length}" viewBox="0 0 ${pixels[0]!.length} ${pixels.length}" shape-rendering="crispEdges">${paths}</svg>`;
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${item.id.replace(/[^a-zA-Z0-9_-]/g, "_")}.svg`;
  link.click();
  URL.revokeObjectURL(url);
}

export function RewardItems({ db }: { db: Database }) {
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string>();
  const [erasing, setErasing] = useState(false);
  const [placements, setPlacements] = useState<Record<number, string>>({});
  const [status, setStatus] = useState("");
  const categories = [...new Set(db.rewardItems.map((item) => item.category))];
  const selected = db.rewardItems.find((item) => item.id === selectedId);
  const filtered = db.rewardItems.filter(
    (item) =>
      (!category || item.category === category) &&
      `${item.name} ${item.category}`
        .toLowerCase()
        .includes(search.trim().toLowerCase()),
  );
  return (
    <div className="rewards-page">
      <div className="section-heading">
        <div>
          <h2>Reward items</h2>
          <p>
            A little something to grow a world. Browse the catalog, then try
            placing an item.
          </p>
        </div>
        <Badge color="moss">
          {db.rewardItems.length} items · {categories.length} categories
        </Badge>
      </div>
      <p className="reward-scope">
        These are reusable items for future milestone and activity rewards.
        Earning rewards and saved worlds are still to come.
      </p>
      <div className="reward-layout">
        <section className="reward-catalog" aria-label="Reward catalog">
          <label className="reward-search">
            <span>Find an item</span>
            <input
              type="search"
              placeholder="Try tree, tulip, flag…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <div
            className="reward-categories"
            role="group"
            aria-label="Reward categories"
          >
            {["", ...categories].map((value) => (
              <button
                key={value}
                aria-pressed={category === value}
                onClick={() => setCategory(value)}
              >
                {value || "All"}
                <span>
                  {
                    db.rewardItems.filter(
                      (item) => !value || item.category === value,
                    ).length
                  }
                </span>
              </button>
            ))}
          </div>
          <p className="sr-only" role="status">
            {filtered.length} matching items
          </p>
          <div className="reward-grid">
            {filtered.map((item) => (
              <button
                className="reward-option"
                key={item.id}
                aria-pressed={selectedId === item.id && !erasing}
                onClick={() => {
                  setSelectedId(item.id);
                  setErasing(false);
                  setStatus(
                    `${item.name} selected. Choose a plot to place it.`,
                  );
                }}
              >
                <span className="reward-art">
                  <PixelSprite item={item} />
                </span>
                <strong>{item.name}</strong>
                <span>{item.category}</span>
              </button>
            ))}
          </div>
          {!filtered.length && (
            <Empty>
              {db.rewardItems.length
                ? "No items match. Try another name or category."
                : "The catalog is empty. Reset the seed or import an experiment with reward items."}
            </Empty>
          )}
        </section>
        <section
          className="reward-preview"
          aria-labelledby="reward-preview-title"
        >
          <div className="reward-preview-heading">
            <h3 id="reward-preview-title">A patch of possibility</h3>
            <Badge>Placement preview</Badge>
          </div>
          <p>
            {erasing
              ? "Choose a filled plot to remove its item."
              : selected
                ? `${selected.name} selected. Choose any plot to place or replace an item.`
                : "Select an item, then choose a plot. You can place the same item more than once."}
          </p>
          <div
            className="reward-world"
            role="group"
            aria-label="World placement preview"
          >
            {Array.from({ length: 12 }, (_, index) => {
              const item = db.rewardItems.find(
                (item) => item.id === placements[index],
              );
              const position = `row ${Math.floor(index / 4) + 1}, column ${(index % 4) + 1}`;
              return (
                <button
                  key={index}
                  className="reward-plot"
                  aria-label={
                    erasing
                      ? `Remove ${item?.name ?? "item"} at ${position}`
                      : `Place ${selected?.name ?? "item"} at ${position}${item ? `, currently ${item.name}` : ", empty"}`
                  }
                  disabled={erasing ? !item : !selected}
                  onClick={() => {
                    const next = { ...placements };
                    if (erasing) delete next[index];
                    else if (selected) next[index] = selected.id;
                    setPlacements(next);
                    if (!Object.keys(next).length) setErasing(false);
                    setStatus(
                      erasing
                        ? `Removed ${item?.name} from ${position}.`
                        : `Placed ${selected?.name} at ${position}.`,
                    );
                  }}
                >
                  {item ? (
                    <PixelSprite item={item} />
                  ) : (
                    <span aria-hidden="true">+</span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="reward-tools">
            <button
              className="button"
              aria-pressed={erasing}
              disabled={!Object.keys(placements).length}
              onClick={() => setErasing(!erasing)}
            >
              <Eraser size={15} />
              Remove items
            </button>
            <button
              className="text-button"
              disabled={!Object.keys(placements).length}
              onClick={() => {
                setPlacements({});
                setErasing(false);
                setStatus("Preview cleared.");
              }}
            >
              Clear preview
            </button>
          </div>
          <p className="muted">
            Just a sketch. Placements reset when you leave this screen and are
            not included in exports.
          </p>
          <p className="reward-status" role="status">
            {status || "Your catalog is shared across all demo identities."}
          </p>
          {selected && (
            <div className="reward-detail">
              <h3>{selected.name}</h3>
              <p>
                {selected.category} · {selected.artifact.pixels[0]!.length} ×{" "}
                {selected.artifact.pixels.length} pixels · transparent
                background
              </p>
              <button
                className="text-button"
                onClick={() => downloadArtifact(selected)}
              >
                <Download size={15} />
                Download pixel art (SVG)
              </button>
              <JsonRecord value={selected} label="Inspect reward item record" />
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
