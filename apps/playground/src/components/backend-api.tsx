"use client";

import { useMemo, useState } from "react";
import { ArrowUpRight, RefreshCw } from "lucide-react";
import {
  BesideClient,
  type ApiHomebase,
  type ApiState,
  type Session,
} from "@beside/api-client";
import { Empty, JsonRecord } from "./ui";

const apiUrl =
  process.env.NEXT_PUBLIC_BESIDE_API_URL ?? "http://localhost:3001";

export function BackendApi() {
  const client = useMemo(() => new BesideClient(apiUrl), []);
  const [session, setSession] = useState<Session | null>(null);
  const [state, setState] = useState<ApiState | null>(null);
  const [bases, setBases] = useState<ApiHomebase[]>([]);
  const [register, setRegister] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ error: boolean; text: string } | null>(
    null,
  );
  async function reload() {
    const [next, homebases] = await Promise.all([
      client.state(),
      client.homebases(),
    ]);
    setState(next);
    setBases(homebases);
  }
  async function run(action: () => Promise<unknown>, message?: string) {
    setBusy(true);
    setNotice(null);
    try {
      await action();
      if (message) setNotice({ error: false, text: message });
    } catch (error) {
      setNotice({
        error: true,
        text:
          error instanceof Error
            ? error.message
            : "The API could not be reached.",
      });
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="backend-api">
      <div className="section-heading">
        <div>
          <h2>Backend API</h2>
          <p>
            A shared, persistent workspace for mobile and web. The other
            playground sections use this browser’s local experiment.
          </p>
        </div>
      </div>
      <div className="api-links">
        <a
          className="button"
          href={`${apiUrl}/docs`}
          target="_blank"
          rel="noreferrer"
        >
          Open API explorer <ArrowUpRight size={16} />
        </a>
        <a
          className="button secondary"
          href={`${apiUrl}/openapi.json`}
          target="_blank"
          rel="noreferrer"
        >
          OpenAPI JSON <ArrowUpRight size={16} />
        </a>
        <a href={`${apiUrl}/health/ready`} target="_blank" rel="noreferrer">
          Database status
        </a>
      </div>
      <p className="field-help">
        API: <code>{apiUrl}</code> · Schema v0.1, following the current
        playground model.
      </p>
      {notice && (
        <p
          className={`notice ${notice.error ? "error" : "success"}`}
          role={notice.error ? "alert" : "status"}
        >
          {notice.text}
        </p>
      )}
      {!session ? (
        <form
          className="creation-panel"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            void run(async () => {
              const credentials = {
                email: String(data.get("email")),
                password: String(data.get("password")),
              };
              const next = register
                ? await client.register({
                    ...credentials,
                    name: String(data.get("name")),
                  })
                : await client.login(credentials);
              setSession(next);
              await reload();
            });
          }}
        >
          <h3>{register ? "Create an API account" : "Sign in to the API"}</h3>
          <p>
            Use your own account here. The demo perspective selector does not
            change your API identity. Your session stays in memory until you
            reload.
          </p>
          <fieldset disabled={busy}>
            <div className="form-grid two">
              {register && (
                <label>
                  Name
                  <input
                    name="name"
                    autoComplete="name"
                    maxLength={200}
                    required
                  />
                </label>
              )}
              <label>
                Email
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  maxLength={254}
                  required
                />
              </label>
              <label>
                Password
                <input
                  name="password"
                  type="password"
                  autoComplete={register ? "new-password" : "current-password"}
                  minLength={12}
                  maxLength={128}
                  required
                />
              </label>
            </div>
            <p className="field-help">
              Use at least 12 characters. Email verification and password
              recovery are not available in this first pass.
            </p>
            <div className="form-bottom">
              <button className="button" type="submit">
                {busy ? "Connecting…" : register ? "Create account" : "Sign in"}
              </button>
              <button
                className="button secondary"
                type="button"
                onClick={() => setRegister(!register)}
              >
                {register ? "Use an existing account" : "Create an account"}
              </button>
            </div>
          </fieldset>
        </form>
      ) : (
        <>
          <div className="api-session">
            <p>
              Signed in as <strong>{session.user.name}</strong> (
              {session.user.email})
            </p>
            <div className="api-links">
              <button
                className="button secondary small"
                disabled={busy}
                onClick={() => void run(reload, "Workspace refreshed.")}
              >
                <RefreshCw size={15} /> Refresh
              </button>
              <button
                className="button secondary small"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    await client.logout();
                    setRegister(false);
                    setSession(null);
                    setState(null);
                    setBases([]);
                  })
                }
              >
                Sign out
              </button>
            </div>
          </div>
          <section className="creation-panel" aria-labelledby="api-homebases">
            <h3 id="api-homebases">Home bases</h3>
            <p>
              Create a shared space, then give its invitation code to a friend
              with an API account.
            </p>
            <div className="form-grid two">
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = event.currentTarget;
                  const name = String(new FormData(form).get("name"));
                  void run(async () => {
                    await client.createHomebase(name);
                    await reload();
                    form.reset();
                  }, "Shared home base created.");
                }}
              >
                <fieldset disabled={busy}>
                  <label>
                    New shared space
                    <input
                      name="name"
                      maxLength={200}
                      required
                      placeholder="Our reading corner"
                    />
                  </label>
                  <button className="button small" type="submit">
                    Create home base
                  </button>
                </fieldset>
              </form>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = event.currentTarget;
                  const code = String(new FormData(form).get("code"));
                  void run(async () => {
                    await client.joinHomebase(code.trim());
                    await reload();
                    form.reset();
                  }, "Home base joined.");
                }}
              >
                <fieldset disabled={busy}>
                  <label>
                    Invitation code
                    <input
                      name="code"
                      minLength={20}
                      maxLength={100}
                      required
                      autoComplete="off"
                    />
                  </label>
                  <button className="button small" type="submit">
                    Join home base
                  </button>
                </fieldset>
              </form>
            </div>
            <ul className="api-homebase-list">
              {bases.map((base) => (
                <li key={base.id}>
                  <strong>{base.name}</strong>
                  <span>
                    {base.personalOwnerId
                      ? "Personal"
                      : `${base.memberIds.length} members`}
                  </span>
                  {base.inviteCode && (
                    <details>
                      <summary>Show invitation code</summary>
                      <code>{base.inviteCode}</code>
                      <p className="field-help">
                        Anyone with this code can join this space.
                      </p>
                    </details>
                  )}
                </li>
              ))}
            </ul>
          </section>
          {state && (
            <>
              <form
                className="creation-panel"
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = event.currentTarget;
                  const data = new FormData(form);
                  void run(async () => {
                    await client.createActivity({
                      templateId: String(data.get("template")),
                      name: String(data.get("name")),
                      target: Number(data.get("target")),
                      connectionId: String(data.get("homebase")) || null,
                    });
                    await reload();
                    form.reset();
                  }, "Activity created. Milestone zero was logged for its participants.");
                }}
              >
                <h3>Create an activity</h3>
                <fieldset disabled={busy}>
                  <div className="form-grid two">
                    <label>
                      Name
                      <input
                        name="name"
                        required
                        maxLength={200}
                        placeholder="Read a little together"
                      />
                    </label>
                    <label>
                      Template
                      <select name="template">
                        {state.activityTemplates.map((template) => (
                          <option key={template.id} value={template.id}>
                            {template.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Home base
                      <select name="homebase">
                        <option value="">My personal home base</option>
                        {bases
                          .filter((base) => !base.personalOwnerId)
                          .map((base) => (
                            <option key={base.id} value={base.id}>
                              {base.name}
                            </option>
                          ))}
                      </select>
                    </label>
                    <label>
                      Personal target
                      <input
                        name="target"
                        type="number"
                        min="0.01"
                        step="any"
                        defaultValue="3"
                        required
                      />
                    </label>
                  </div>
                  <button className="button" type="submit">
                    Create activity
                  </button>
                </fieldset>
              </form>
              <section aria-labelledby="api-activities">
                <h3 id="api-activities">Your activities</h3>
                {!state.activities.length && (
                  <Empty>
                    Create an activity to start recording milestones in
                    PostgreSQL.
                  </Empty>
                )}
                {state.activities.map((activity) => (
                  <details className="creation-panel" key={activity.id}>
                    <summary>
                      <strong>{activity.name}</strong> · {activity.unit}
                    </summary>
                    <form
                      onSubmit={(event) => {
                        event.preventDefault();
                        const form = event.currentTarget;
                        const data = new FormData(form);
                        void run(async () => {
                          await client.createMilestone({
                            activityId: activity.id,
                            parentId: null,
                            name: String(data.get("name")),
                            quantity: 1,
                            policy: "open",
                            startAt: null,
                            endAt: null,
                            itemId: String(data.get("item")) || null,
                          });
                          await reload();
                          form.reset();
                        }, "Milestone planned.");
                      }}
                    >
                      <fieldset disabled={busy}>
                        <div className="form-grid two">
                          <label>
                            New milestone
                            <input
                              name="name"
                              maxLength={200}
                              required
                              placeholder="First session"
                            />
                          </label>
                          <label>
                            Shared reward
                            <select name="item">
                              <option value="">No reward</option>
                              {state.rewardItems.map((item) => (
                                <option key={item.id} value={item.id}>
                                  {item.name}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                        <button className="button small" type="submit">
                          Plan milestone
                        </button>
                      </fieldset>
                    </form>
                    <ul className="api-milestone-list">
                      {state.milestones
                        .filter(
                          (milestone) =>
                            milestone.activityId === activity.id &&
                            milestone.kind !== "join",
                        )
                        .map((milestone) => {
                          const complete = state.logs.some(
                            (log) =>
                              log.milestoneId === milestone.id &&
                              log.authorUserId === session.user.id &&
                              log.isSuccess,
                          );
                          return (
                            <li key={milestone.id}>
                              <span>{milestone.name}</span>
                              <button
                                className="button small secondary"
                                disabled={busy || complete}
                                onClick={() => {
                                  const externalKey = crypto.randomUUID();
                                  void run(async () => {
                                    await client.recordLog({
                                      milestoneId: milestone.id,
                                      isSuccess: true,
                                      title: `Completed ${milestone.name}`,
                                      durationMinutes: 0,
                                      occurredAt: new Date().toISOString(),
                                      origin: "manual",
                                      externalKey,
                                    });
                                    await reload();
                                  }, "Milestone completed. Progress and rewards updated.");
                                }}
                              >
                                {complete ? "Completed" : "Record success"}
                              </button>
                            </li>
                          );
                        })}
                    </ul>
                  </details>
                ))}
              </section>
              <JsonRecord value={state} label="Inspect the API response" />
            </>
          )}
        </>
      )}
    </div>
  );
}
