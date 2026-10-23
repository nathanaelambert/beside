import { aiRequestSchema, fillTemplate } from "./ai-fill.ts";
import {
  FillError,
  readLimitedJson,
  type FillProvider,
} from "./ai-provider.ts";

// A small process-local guard for this sandbox, shared across demo identities.
// A multi-instance public service needs a durable budget/rate limiter and real auth.
export function createFillHandler(getProvider: () => FillProvider) {
  let active = 0;
  let starts: number[] = [];
  return async (request: Request) => {
    const json = (body: unknown, status = 200) =>
      Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
    if (request.headers.get("origin") !== new URL(request.url).origin)
      return json({ error: "Open AI fill from this app's form." }, 403);
    if (!request.headers.get("content-type")?.startsWith("application/json"))
      return json({ error: "Expected a JSON request." }, 415);
    let acquired = false;
    try {
      let body: unknown;
      try {
        body = await readLimitedJson(new Response(request.body), 6000);
      } catch (error) {
        return json(
          { error: "Send a valid JSON request smaller than 6 KB." },
          error instanceof FillError && error.status === 413 ? 413 : 400,
        );
      }
      const input = aiRequestSchema.safeParse(body);
      if (!input.success)
        return json(
          {
            error:
              "Enter a title and context such as author/edition, year/season, provider/version, or original recipe source.",
          },
          400,
        );
      if (!fillTemplate(input.data.kind, input.data.templateId))
        return json(
          {
            error:
              "AI fill supports books, TV seasons, movies, courses and recipes with the matching activity templates.",
          },
          400,
        );
      const provider = getProvider();
      starts = starts.filter((t) => t > Date.now() - 3_600_000);
      if (active >= 2 || starts.length >= 30)
        return json(
          {
            error:
              "AI fill is at its sandbox limit. Please wait or continue manually.",
          },
          429,
        );
      starts.push(Date.now());
      active++;
      acquired = true;
      const signal = AbortSignal.any([
        request.signal,
        AbortSignal.timeout(60_000),
      ]);
      return json(await provider.suggest(input.data, signal));
    } catch (error) {
      if (error instanceof FillError)
        return json({ error: error.message }, error.status);
      if (
        error instanceof Error &&
        ["TimeoutError", "AbortError"].includes(error.name)
      )
        return json(
          {
            error:
              "AI research stopped or timed out. No fields were changed. Please retry.",
          },
          504,
        );
      return json(
        {
          error:
            "AI research could not be completed. No fields were changed. Please retry or continue manually.",
        },
        502,
      );
    } finally {
      if (acquired) active--;
    }
  };
}
