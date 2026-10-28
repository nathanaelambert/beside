# CI and Vercel deployments

[`ci-and-deploy.yml`](workflows/ci-and-deploy.yml) checks pull requests and pushes
to `main`. It runs type checks, playground lint, all model/client/API tests, and
real PostgreSQL integration tests against an isolated PostgreSQL 17 service.
Pull requests also build the API and playground without production credentials.

After checks pass on `main`, separate jobs deploy `beside-api` and
`beside-playground`. Each job pulls the existing Vercel project's settings,
builds once on the runner, and deploys the artifact with `--prebuilt`. The API
job runs database migrations using the production environment pulled from
Vercel. Readiness, authentication, OpenAPI and Swagger assets are checked after
deployment. Main runs are queued to preserve deployment order. Pull requests,
including forks, never run the deployment jobs or receive deployment tokens.

The Vercel projects do not need a native Git repository connection. The
repository remains owned by `nathanaelambert`. The showcase website's existing
deployment setup is not changed by this workflow.

## Repository configuration

Under **Settings → Secrets and variables → Actions**, configure:

| Kind     | Name                           | Value                                                                              |
| -------- | ------------------------------ | ---------------------------------------------------------------------------------- |
| Secret   | `VERCEL_TOKEN`                 | Vercel token with deployment access to both projects under `mosaab-emams-projects` |
| Variable | `VERCEL_ORG_ID`                | `team_cfmfVTW3QoSHrmq8KkT7uW5v`                                                    |
| Variable | `VERCEL_API_PROJECT_ID`        | `prj_fnnuQluUtQGZ5dGj4spOFFOgHweZ`                                                 |
| Variable | `VERCEL_PLAYGROUND_PROJECT_ID` | `prj_FeJYSHclzSmwfdOxwhxnyccgs3pq`                                                 |

Create a dedicated deployment token at https://vercel.com/account/settings/tokens
and scope it to the `mosaab-emams-projects` team. Store it as the repository’s
`VERCEL_TOKEN` Actions secret. The local Vercel CLI login used during setup can
deploy projects, but Vercel rejects token creation for that app, so the token
must be supplied through the Vercel account’s token settings. Production database and AI-provider
credentials stay in their respective Vercel projects; CI tests use no production
database. The workflow does not create paid infrastructure or modify GitHub's
repository-wide Actions permissions.

To redeploy the current `main` without another commit, open **Actions → CI and
deploy → Run workflow** and select `main`. A failure before deployment leaves
the existing live deployment in place. A failed post-deployment smoke check
marks the workflow failed; it does not automatically roll back the project.

GitHub settings: https://github.com/nathanaelambert/beside/settings/secrets/actions

## Maintaining the workflow

- The pnpm action reads the version from the root `packageManager` field.
- Node is pinned to major 24, matching the applications' runtime.
- GitHub actions are pinned to release commit SHAs, and the Vercel CLI is pinned
  to `65.4.0`, matching the deployment setup used here.
- Keep each matrix entry's project ID variable and public URL
  aligned when renaming or moving projects.
- Follow-up database changes must add appropriate migrations to the API's
  migrator before deployment. The current disposable first-pass schema has one
  initial, idempotent migration.
