# Security

## Dependency audit policy

CI runs `npm audit --omit=dev --audit-level=high` on every push and PR. The build fails on
any **high** or **critical** advisory in production dependencies. Moderate and low advisories
are surfaced but do not block the build, because at times an advisory has no advisory-free
release to move to.

## Resolved

- **find-my-way DDoS (HTTP/2), high — GHSA-c96f-x56v-gq3h.** Fixed by `npm audit fix` within
  the current Fastify major; `find-my-way` is pinned to `9.7.0` via the lockfile. No Fastify
  major upgrade was required.

## Accepted (no advisory-free release, not applicable to this app)

`react-router-dom` is held at `^6.30.4` (latest `6.x`, a clean minor bump within the current
major). Two moderate advisories affect it, and evaluation of the major upgrade showed it does
not improve the posture:

- **Open redirect via backslash in `<Link>`/`useNavigate`, moderate — GHSA-wrjc-x8rr-h8h6.**
  Fixed only in `> 7.17.0`.
- **Arbitrary constructor injection via `deserializeErrors()` in SSR hydration, moderate —
  GHSA-337j-9hxr-rhxg.** SSR-only.

Upgrade evaluation (per the "try patch/minor, then evaluate major" policy):

- `npm audit fix` (no `--force`) resolves the Fastify/find-my-way high but cannot resolve the
  react-router moderates within the `^6` major.
- The only newer line, `7.12.0`–`8.2.0` (latest published `7.18.1`), is subject to a **high**
  advisory — **RSC Mode CSRF Bypass, GHSA-qwww-vcr4-c8h2** — whose fix is `> 8.2.0`, and **no
  `8.x` is published**. So every currently installable version carries at least one advisory,
  and moving to `7.18.1` would trade two moderates for one high.
- v6 → v7 API impact for this app is otherwise nil: it uses only `BrowserRouter`, `Routes`,
  `Route`, `Link`, `NavLink`, `Outlet`, `useParams`, `useNavigate`, `useSearchParams`, all
  stable across v7, and `react-router-dom` still re-exports the DOM bindings.

Applicability: all three advisories are **not exploitable in this app**. It is a client-only
SPA — no React Router RSC/framework mode (rules out the high), no server-side rendering (rules
out the SSR hydration advisory), and navigations use app-internal interpolated paths rather
than untrusted full URLs (rules out the open redirect).

Decision: stay on `react-router-dom@^6` (the lower-severity, non-applicable moderates) and gate
CI at `high`. Revisit when a react-router release exists that clears both advisory ranges
(i.e. `> 8.2.0`).
