# LaunchPad – Financial Literacy SaaS

## Stack
Vite 5 + React 18 + TypeScript 5 | React Router v6 | Supabase (Auth, DB, Storage, RPC) | shadcn/ui + Tailwind CSS | TanStack Query v5 | React Hook Form + Zod | Google Gemini API | Stripe | Vitest

## Roles
- `student` → `/dashboard` + lesson chat
- `org_admin` → `/admin-dashboard` (blocked from student pages)
- No role → `/complete-profile`

## Routes (`src/App.tsx`)
| Path | Component | Access |
|---|---|---|
| `/` | `ChatContainer` | Auth |
| `/login` | `Login` | Public |
| `/signup` | `SignUp` | Public |
| `/complete-profile` | `CompleteProfile` | Auth (no role) |
| `/dashboard` | `Dashboard` | student |
| `/admin-dashboard` | `AdminDashboard` | org_admin |
| `/profile` | `Profile` | Auth |

## Database (Supabase)
| Table | Key Columns |
|---|---|
| `profiles` | `id`, `first_name`, `last_name`, `role`, `group_name`, `avatar_url` |
| `organizations` | `admin_id`, `name`, `total_seats`, `used_seats` |
| `licenses` | `org_id`, `student_email`, `course_type`, `is_active`, `bundle_id`, `user_id` |
| `purchases` | `org_id`, `bundle_id`, `seats_purchased`, `amount_paid`, `stripe_payment_id` |
| `user_progress` | `user_id`, `lesson_id`, `status`, `score_post`, `score_post_total` |
| `lesson_states` | `user_id`, `lesson_id`, `state` (jsonb), `messages` (jsonb) |

**RPC:**
- `increment_used_seats(org_id_param uuid)` — increments `used_seats` on the org row
- `get_bundle_seat_summary(org_id_param uuid)` → `TABLE(bundle_id uuid, bundle_name text, purchased int, assigned int, available int)` — per-bundle seat breakdown for an org; only returns bundles where `purchased > 0`

**Storage:** `avatars` bucket (must be public — not automated)

## Key Hooks (`src/hooks/`)
- `useLesson2Chatbot` — Lesson 2 engine (duplicate of generic, refactor pending)
- `useGenericLesson` — Lessons 1 and 3–14 engine: `intro → pretest → topics → posttest → complete` (80% passing)
- `useQuestionAnswering` — AI Q&A: local search first → Gemini fallback
- `useProgressTracking` — CRUD for `user_progress`, grade calculation
- `useStudentBundle` — Resolves the active bundle for the current student via `licenses` join

## Lessons (14 total, all available)
IDs: `earning-money`, `living-on-your-own`, `understanding-wants-needs`, `saving-investing`, `influence-of-advertising`, `cost-of-college`, `protecting-insuring`, `art-of-budgeting`, `understanding-banking`, `take-home-pay`, `financial-decisions`, `credit-score`, `consumer-privacy`, `using-credit`

Data files in `src/data/`. Loader: `getLessonData(id)` in `lessonDataLoader.ts`.

## TODO / In Progress
- **Stripe:** ~~"Buy More Seats" button has no handler~~ — DONE: checkout session + webhook fully implemented
- **Student invite:** ~~no email sent~~ — DONE: `send-invite` Edge Function generates signup link + sends email
- **License activation:** ~~not wired~~ — DONE: webhook inserts license rows; student activates on signup
- **Admin search:** ~~not wired~~ — DONE: `searchQuery` state filters `filteredStudents` in `AdminDashboard`
- **Lesson 1 scoring:** ~~hardcoded `1/1` — no real quiz~~ — DONE: migrated to `useGenericLesson` with real pre-test/post-test (`lesson1-earning-money.ts`), 80% passing
- **Gemini model:** uses `gemini-3-flash-preview` with 404 fallback to `gemini-2.0-flash-exp` — needs fix
- **`useLesson2Chatbot`:** should be migrated to `useGenericLesson`

## Coding Standards
- **Naming:** camelCase (functions), PascalCase (components), UPPER_SNAKE_CASE (constants), snake_case (DB columns), kebab-case (non-component files)
- **TypeScript:** no `any`, types in `src/types/`, `interface` for objects, `type` for unions
- **JSDoc:** all functions must have `@param` + `@returns` docstrings
- **Components:** one per file, typed props, no prop drilling >2 levels
- **Supabase:** always handle errors, use `.maybeSingle()` not `.single()`, never expose service role key, use `upsert` with `onConflict` where applicable
- **Stripe:** all calls via Supabase Edge Functions only — never from client
- **Git:** `feature/` or `fix/` branches, imperative commits, never commit `.env`

## Environment Variables
```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_GEMINI_API_KEY=
VITE_STRIPE_PUBLISHABLE_KEY=
```
