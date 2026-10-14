import type { ReactNode } from "react";
import type { Database, User } from "../lib/types";
import {
  ArrowUpRight,
  BookOpen,
  CookingPot,
  Footprints,
  GraduationCap,
  Heart,
  Layers,
  Tv,
} from "lucide-react";

export function CategoryIcon({
  category,
  size = 18,
}: {
  category: string;
  size?: number;
}) {
  const Icon =
    (
      {
        reading: BookOpen,
        watching: Tv,
        movement: Footprints,
        cooking: CookingPot,
        learning: GraduationCap,
        habits: Heart,
        custom: Layers,
      } as Record<string, typeof BookOpen>
    )[category] ?? Layers;
  return <Icon size={size} aria-hidden="true" />;
}
export function Badge({
  children,
  color = "neutral",
}: {
  children: ReactNode;
  color?: string;
}) {
  return <span className={`badge ${color}`}>{children}</span>;
}
export function Avatar({
  user,
  small = false,
}: {
  user: User;
  small?: boolean;
}) {
  return (
    <span
      className={`avatar ${user.color} ${small ? "small" : ""}`}
      aria-hidden="true"
    >
      {user.name.slice(0, 1)}
    </span>
  );
}
export function Person({ db, id }: { db: Database; id: string }) {
  const user = db.users.find((u) => u.id === id);
  return user ? (
    <span className="person">
      <Avatar user={user} small />
      {user.name}
    </span>
  ) : (
    <span>{id}</span>
  );
}
export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="empty">
      <ArrowUpRight size={20} aria-hidden="true" />
      <p>{children}</p>
    </div>
  );
}
export function JsonRecord({
  value,
  label = "Inspect record",
}: {
  value: unknown;
  label?: string;
}) {
  return (
    <details className="json-details">
      <summary>{label}</summary>
      <pre>{JSON.stringify(value, null, 2)}</pre>
    </details>
  );
}
export function shortId(id: string) {
  return id.includes("_")
    ? `${id.split("_")[0]}_${id.split("_")[1]?.slice(0, 8)}`
    : id;
}
export function when(value: string) {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
