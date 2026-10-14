"use client";

import { useSyncExternalStore } from "react";
import type { Command, Database } from "./types.ts";
import { execute } from "./model.ts";
import { createSeed } from "./seed.ts";
import { parseDatabase } from "./validation.ts";

export const STORAGE_KEY = "beside.playground.v1";
type Snapshot = {
  db: Database | null;
  ready: boolean;
  storageError: string | null;
};
const serverSnapshot: Snapshot = { db: null, ready: false, storageError: null };
let snapshot = serverSnapshot;
const listeners = new Set<() => void>();
let protectStoredData = false;
function notify() {
  for (const listener of listeners) listener();
}
function hydrate() {
  if (snapshot.ready || typeof window === "undefined") return;
  let db: Database = createSeed();
  let storageError: string | null = null;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) db = parseDatabase(JSON.parse(stored));
    const serialized = JSON.stringify(db);
    if (stored !== serialized) localStorage.setItem(STORAGE_KEY, serialized);
  } catch {
    protectStoredData = true;
    storageError =
      "Stored data could not be read. A temporary seed is open; the saved data will not be overwritten. Export it for recovery or reset explicitly.";
  }
  snapshot = { db, ready: true, storageError };
}
function subscribe(listener: () => void) {
  hydrate();
  listeners.add(listener);
  const sync = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY || !event.newValue) return;
    try {
      snapshot = {
        db: parseDatabase(JSON.parse(event.newValue)),
        ready: true,
        storageError: null,
      };
      protectStoredData = false;
      notify();
    } catch {
      snapshot = {
        ...snapshot,
        storageError:
          "Another tab saved invalid data. This tab kept its current experiment.",
      };
      notify();
    }
  };
  window.addEventListener("storage", sync);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", sync);
  };
}
export const useDatabase = () =>
  useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => serverSnapshot,
  );
function save(db: Database) {
  let storageError = snapshot.storageError;
  if (!protectStoredData) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
      storageError = null;
    } catch {
      storageError =
        "Browser storage is unavailable or full. Changes work in memory; export your experiment before closing this page.";
    }
  }
  snapshot = { db, ready: true, storageError };
  notify();
}
export function dispatch(command: Command) {
  if (!snapshot.db) throw new Error("The experiment is still loading.");
  const result = execute(snapshot.db, command);
  if (!result.duplicate) save(result.db);
  return result;
}
export function resetDatabase() {
  protectStoredData = false;
  save(createSeed());
}
export function importDatabase(input: unknown) {
  const db = parseDatabase(input);
  protectStoredData = false;
  save(db);
}
export function downloadData(raw = false) {
  let data = JSON.stringify(snapshot.db, null, 2);
  if (raw) {
    try {
      data = localStorage.getItem(STORAGE_KEY) || data;
    } catch {
      /* Memory export remains available when storage is blocked. */
    }
  }
  const url = URL.createObjectURL(
    new Blob([data], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `beside-playground${raw ? "-recovery" : ""}.json`;
  link.click();
  URL.revokeObjectURL(url);
}
