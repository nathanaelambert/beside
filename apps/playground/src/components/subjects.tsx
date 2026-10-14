"use client";
import { useState } from "react";
import { Plus, Search, Shapes } from "lucide-react";
import { visibleActivities, visibleSubjects } from "../lib/model";
import { categories } from "../lib/templates";
import type { Database } from "../lib/types";
import type { ViewProps } from "./playground";
import { Badge, CategoryIcon, Empty, JsonRecord, Person } from "./ui";
import { AiFillInput } from "./ai-fill";

export function Subjects({ db, userId, run }: ViewProps) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [templateId, setTemplateId] = useState("book");
  const [title, setTitle] = useState("");
  const [metadata, setMetadata] = useState<Record<string, string>>({});
  const [draftVersion, setDraftVersion] = useState(0);
  const template =
    db.subjectTemplates.find((t) => t.id === templateId) ??
    db.subjectTemplates[0]!;
  const subjects = visibleSubjects(db, userId).filter(
    (s) =>
      s.title.toLowerCase().includes(search.toLowerCase()) &&
      (category === "all" ||
        db.subjectTemplates.find((t) => t.id === s.templateId)?.category ===
          category),
  );
  return (
    <>
      <div className="section-heading">
        <div>
          <h2>Things worth doing something with</h2>
          <p>
            A book is a subject. Reading it together is an activity. Keep the
            two separate.
          </p>
        </div>
        <Badge color="moss">Subject library</Badge>
      </div>
      <div className="library-grid">
        <section>
          <div className="filter-row">
            <label className="search-field">
              <Search size={16} />
              <input
                aria-label="Search subjects"
                placeholder="Find a subject…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              aria-label="Subject category"
            >
              <option value="all">All types</option>
              {categories.map((c) => (
                <option value={c.id} key={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div className="subject-grid">
            {subjects.map((s) => {
              const t = db.subjectTemplates.find((t) => t.id === s.templateId)!;
              const activities = db.activitySubjects
                .filter((l) => l.subjectId === s.id)
                .flatMap((l) =>
                  visibleActivities(db, userId).filter(
                    (a) => a.id === l.activityId,
                  ),
                );
              return (
                <article className="subject-card" key={s.id}>
                  <div className={`subject-art ${t.category}`}>
                    <CategoryIcon category={t.category} size={32} />
                    <span>{t.name}</span>
                  </div>
                  <div className="subject-body">
                    <Badge color="moss">{t.name}</Badge>
                    <h3>{s.title}</h3>
                    <dl>
                      {Object.entries(s.metadata)
                        .filter(([, v]) => v)
                        .map(([k, v]) => (
                          <div key={k}>
                            <dt>{k}</dt>
                            <dd>{v}</dd>
                          </div>
                        ))}
                    </dl>
                    <div className="subject-owner">
                      <span>Owned by</span>
                      <Person db={db} id={s.ownerUserId} />
                    </div>
                    <small className="muted">
                      {activities.length
                        ? `Linked to ${activities.length} visible activit${activities.length === 1 ? "y" : "ies"}`
                        : "Ready to link to an activity"}
                    </small>
                    <JsonRecord value={s} />
                  </div>
                </article>
              );
            })}
          </div>
          {!subjects.length && (
            <Empty>
              No subjects match. Create one here, or try a different filter.
            </Empty>
          )}
        </section>
        <aside>
          <form
            className="creation-panel subject-form"
            onSubmit={(e) => {
              e.preventDefault();
              const result = run(
                {
                  type: "createSubject",
                  actorId: userId,
                  templateId: template.id,
                  title,
                  metadata,
                },
                "Subject created and owned by you. Link it to an activity to share its description.",
              );
              if (result) {
                setTitle("");
                setMetadata({});
                setDraftVersion((version) => version + 1);
              }
            }}
          >
            <div className="form-title">
              <span className="form-icon moss">
                <Shapes size={21} />
              </span>
              <div>
                <h3>Add a subject</h3>
                <p>Describe the thing, not the commitment.</p>
              </div>
            </div>
            <label>
              Subject template
              <select
                value={template.id}
                onChange={(e) => {
                  setTemplateId(e.target.value);
                  setMetadata({});
                }}
              >
                {db.subjectTemplates.map((t) => (
                  <option value={t.id} key={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            <AiFillInput
              key={`${template.id}:${draftVersion}`}
              kind="subject"
              templateId={template.id}
              values={{ Title: title, ...metadata }}
              label="Title"
              value={title}
              onChange={setTitle}
              placeholder={`Name your ${template.name.toLowerCase()}`}
              onApply={(values) => {
                setTitle(values.Title ?? title);
                setMetadata(
                  Object.fromEntries(
                    template.fields.map((field) => [
                      field,
                      values[field] ?? "",
                    ]),
                  ),
                );
              }}
            />
            {template.fields.map((field) => (
              <label key={field}>
                {field}
                <input
                  value={metadata[field] ?? ""}
                  onChange={(e) =>
                    setMetadata({ ...metadata, [field]: e.target.value })
                  }
                  maxLength={2000}
                  placeholder="Optional descriptive detail"
                />
              </label>
            ))}
            <div className="rule-note">
              <p>
                You own this subject. Linking it shares the description with
                participants, while each activity keeps its own progress and
                history.
              </p>
            </div>
            <button className="button primary full">
              <Plus size={16} />
              Create subject
            </button>
          </form>
        </aside>
      </div>
    </>
  );
}
export function Templates({ db }: { db: Database }) {
  const [category, setCategory] = useState("all");
  return (
    <>
      <div className="section-heading">
        <div>
          <h2>A starting point, not a fixed vocabulary</h2>
          <p>
            Descriptive templates for subjects. Participation templates for
            activities.
          </p>
        </div>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          aria-label="Template category"
        >
          <option value="all">Every category</option>
          {categories.map((c) => (
            <option value={c.id} key={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </div>
      {categories
        .filter((c) => category === "all" || category === c.id)
        .map((c) => (
          <section className="template-section" key={c.id}>
            <div className="template-category">
              <CategoryIcon category={c.id} size={23} />
              <h3>{c.label}</h3>
            </div>
            <div className="template-columns">
              <div>
                <p className="eyebrow moss-text">SUBJECT TEMPLATES</p>
                {db.subjectTemplates
                  .filter((t) => t.category === c.id)
                  .map((t) => (
                    <article className="template-row" key={t.id}>
                      <h4>{t.name}</h4>
                      <p>{t.fields.join(" · ")}</p>
                      <Badge color="moss">Default unit: {t.unit}</Badge>
                    </article>
                  ))}
              </div>
              <div>
                <p className="eyebrow ochre-text">ACTIVITY TEMPLATES</p>
                {db.activityTemplates
                  .filter((t) => t.category === c.id)
                  .map((t) => (
                    <article className="template-row" key={t.id}>
                      <h4>{t.name}</h4>
                      <p>{t.description}</p>
                      <div className="badge-row">
                        <Badge color="ochre">
                          {t.progressMode === "position"
                            ? "Furthest position"
                            : t.progressMode === "sessions"
                              ? "One credit per log"
                              : "Sum quantities"}
                        </Badge>
                        <Badge>
                          {t.target} {t.unit}
                        </Badge>
                      </div>
                    </article>
                  ))}
              </div>
            </div>
          </section>
        ))}
      <div className="assumption-note">
        <strong>Working assumption</strong>
        <p>
          Categories are matching tags in this draft, and Custom provides an
          open project template. A template editor, arbitrary field definitions,
          schedules, and reward rules can be explored in a later experiment.
        </p>
      </div>
    </>
  );
}
