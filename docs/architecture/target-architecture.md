# Target architecture

Where the system is heading. Today's system is in
[`current-architecture.md`](current-architecture.md); the data model is in
[`schema/ERD.md`](schema/ERD.md); the PR-by-PR plan is in
[`schema/IMPLEMENTATION-PLAN.md`](schema/IMPLEMENTATION-PLAN.md).

## Recommended: stay on Vercel (Pro)

```mermaid
flowchart TB
  subgraph Clients
    M["Mobile app<br/>Expo native + web"]
    W["Web app / Playground<br/>personal use"]
    AP["Admin portal<br/>boards, schools, teachers"]
  end

  GW["Auth and tenant gateway<br/>SSO (Google, Microsoft, SAML) · org resolution<br/>sessions · Vercel firewall rate limits"]

  subgraph Services["Vercel Functions (Pro) · one project per region"]
    CMD["Command API<br/>NestJS · per-homebase transactions"]
    QRY["Query API<br/>feeds, progress, pixel world"]
    WRK["Queue consumers<br/>expiry, push, roster sync"]
  end

  subgraph Data
    PG[("Neon Postgres (US)<br/>Postgres in ca-central-1 (Canada)<br/>RLS by org_id, pooled")]
    RD[("Upstash Redis<br/>cache, sessions")]
    Q[["Vercel Queues<br/>+ Cron every minute"]]
    BL[("Vercel Blob<br/>media, exports")]
  end

  M --> GW
  W --> GW
  AP --> GW
  GW --> CMD
  GW --> QRY
  CMD --> PG
  CMD -->|"outbox events"| Q
  QRY --> RD
  QRY --> PG
  Q --> WRK
  WRK --> PG
  WRK --> BL
```

Each region (US `iad1` + Neon; Canada `yul1` + Postgres in AWS `ca-central-1`)
runs its own copy. `organization.region` decides which stack a tenant uses.

### Target write flow

```mermaid
sequenceDiagram
  autonumber
  actor U as Client
  participant API as Command API
  participant DB as Postgres
  participant Q as Queue
  participant W as Consumer
  U->>API: POST /api/v1/logs
  API->>DB: BEGIN, SET LOCAL app.org_id (RLS)
  API->>DB: lock this homebase only
  API->>DB: load this homebase's rows, apply command
  API->>DB: write log, contribution, progress_total, domain_event
  API->>DB: COMMIT
  API-->>U: 201
  DB-->>Q: outbox relay publishes the event
  Q->>W: deliver (at least once)
  W->>W: push / email / reward notifications
```

## Alternative: AWS

```mermaid
flowchart TB
  C["Mobile · Web (Amplify Hosting) · Admin portal"]
  E["CloudFront + AWS WAF + load balancer<br/>Cognito SSO"]
  A["API on ECS Fargate<br/>NestJS, autoscaled"]
  S[["SQS + EventBridge Scheduler<br/>outbox, deadline timers"]]
  K["Workers<br/>expiry, push, rosters"]
  PG[("Aurora PostgreSQL + RDS Proxy<br/>RLS")]
  R[("ElastiCache Valkey")]
  B[("S3")]
  N["SES + Expo push"]
  C --> E --> A
  A --> PG
  A --> R
  A --> S --> K
  K --> PG
  K --> B
  K --> N
```

Same stack in `ca-central-1` and `us-east-1`. Everything, including Postgres,
can stay in Canada, at the cost of more operations work than Vercel.
