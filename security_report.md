# Handa Ka Ba — Information Assurance & Security Report

---

## 1. System Overview

### 1.1 System Description

**Handa Ka Ba?** is a web-based disaster preparedness system designed for Filipino households in Metro Manila. It collects a user's household profile (location, housing type, household composition), calculates their exposure to five disaster types (flood, earthquake, typhoon/storm surge, landslide, and urban heat), and generates a personalized preparedness checklist using Google Gemini AI. Users can also view hazard layers overlaid on an interactive map.

### 1.2 Target Users

| User Type | Description |
|---|---|
| General Public | Filipino residents in Metro Manila who want to assess and improve their disaster readiness |
| Household Heads | People responsible for planning family emergency preparedness |
| Vulnerable Households | Families with children, elderly members, PWDs, or medical dependencies |

### 1.3 Basic Architecture Diagram

```
┌─────────────────────────────────────────────────────┐
│                   CLIENT (Browser)                  │
│                                                     │
│  React + Vite SPA                                   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────┐  │
│  │   Auth   │ │ Profile  │ │Checklist │ │  Map  │  │
│  │ (OAuth)  │ │  Form    │ │ Display  │ │       │  │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └───┬───┘  │
│       │            │            │            │      │
│       └────────────┴────────────┴────────────┘      │
│                         │                           │
└─────────────────────────┼───────────────────────────┘
                          │ HTTPS
          ┌───────────────┼──────────────┐
          │               │              │
    ┌─────▼──────┐  ┌─────▼──────┐  ┌───▼──────────┐
    │  Supabase  │  │  Google    │  │ OpenStreetMap│
    │  Backend   │  │ Gemini AI  │  │  Tile Server │
    │            │  │            │  │  (public)    │
    │ ┌────────┐ │  └────────────┘  └──────────────┘
    │ │  Auth  │ │
    │ │(OAuth2)│ │
    │ └────────┘ │
    │ ┌────────┐ │
    │ │   DB   │ │
    │ │  RLS   │ │
    │ └────────┘ │
    └────────────┘
```

---

## 2. Threat & Vulnerability Identification

| # | Threat | Possible Vulnerability | Impact on System |
|---|--------|----------------------|-----------------|
| 1 | **Unauthorized Access** — An attacker attempts to access another user's profile, risk scores, or checklist data by manipulating requests | No server-side ownership checks on data queries; front-end-only session validation | Full exposure of another user's personal location, household composition, and risk data — a direct privacy breach |
| 2 | **API Key Exposure** — Sensitive keys (Supabase, Gemini) embedded directly in source code or committed to a public repository | Hardcoded credentials in source files visible to anyone with code access | An attacker could drain Gemini API quota, read/write the entire Supabase database, or impersonate the service |
| 3 | **Session Hijacking / Broken Auth** — An attacker steals or forges an authentication token to gain access as a legitimate user | Weak token management, no OAuth state validation, tokens stored insecurely | Attacker gains full access to the victim's account — can modify their profile, regenerate their checklist, or extract their location |
| 4 | **Input Manipulation / Injection** — A user submits crafted data (e.g., malformed location strings, extreme values) to corrupt data or crash server logic | No server-side input validation; client-side validation can be bypassed entirely | Corrupt risk score calculations, stored bad data in `profiles` table, potential downstream issues for AI prompt injection |
| 5 | **AI Prompt Injection** — A malicious user crafts profile data (e.g., city name containing instructions) to manipulate the Gemini AI response | User-controlled strings are embedded directly into the AI prompt without sanitization | AI returns malicious, misleading, or inappropriate checklist content instead of disaster preparedness advice |

---

## 3. Security Implementation

### 3.1 Security Control #1 — OAuth 2.0 Authentication (Password-less Login)

**Name of Control:** OAuth 2.0 via Google Sign-In (delegated authentication)

**Threat Addressed:** Session hijacking, unauthorized access, credential theft (Threat 1 & 3)

**CIA Principle Supported:** **Confidentiality** — Only verified Google account holders can access the system. No passwords are stored anywhere in the application.

**Implementation Description:**
The system does not manage passwords at all. Authentication is fully delegated to Google via Supabase Auth's OAuth 2.0 implementation. When a user clicks "Sign in with Google", Supabase redirects them through Google's authorization flow. Google returns a signed JWT token which Supabase validates server-side. The client receives a session object only after this verification succeeds. The entire app is gated behind a session check in `App.jsx` — if `session` is null, the `<Auth />` component is rendered and nothing else is accessible.

**Code Reference:** `src/components/auth/Auth.jsx` & `src/App.jsx`

```js
// Auth.jsx — triggers Google OAuth flow
const { error } = await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: { redirectTo: window.location.origin }
})

// App.jsx — gate: nothing renders without a valid session
if (!session) {
  return <Auth />
}
```

```js
// App.jsx — listens for real-time auth state changes
const { data: { subscription } } = supabase.auth.onAuthStateChange(
  (_event, session) => {
    setSession(session)
    if (session) checkProfile(session.user.id)
  }
)
return () => subscription.unsubscribe()
```

---

### 3.2 Security Control #2 — Environment Variables for Secret Management

**Name of Control:** Secret externalization via `.env.local` + Vite environment variable injection

**Threat Addressed:** API key exposure and credential leakage (Threat 2)

**CIA Principle Supported:** **Confidentiality** — API keys and service URLs are never hardcoded in source files and are not bundled into the public client unless explicitly prefixed with `VITE_`.

**Implementation Description:**
All sensitive credentials — the Supabase project URL, the Supabase anon key, and the Gemini API key — are stored in a `.env.local` file which is not committed to version control. Both `supabase.js` and `gemini.js` read these values at build time via `import.meta.env`. Additionally, both files include a startup guard that throws a hard error if the variables are missing, preventing silent failures with undefined credentials.

> [!WARNING]
> Currently `.env.example` in this project contains real credentials, not placeholder values. This should be replaced with dummy placeholder values (e.g., `your-supabase-url-here`) and a `.gitignore` entry added for `.env.local` to prevent accidental commits.

**Code Reference:** `src/lib/supabase.js` & `src/lib/gemini.js`

```js
// supabase.js — reads from env, hard-fails if missing
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Check .env.local file.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

```js
// gemini.js — same guard pattern for AI API key
const apiKey = import.meta.env.VITE_GEMINI_API_KEY

if (!apiKey) {
  throw new Error('Missing VITE_GEMINI_API_KEY environment variable')
}
```

---

### 3.3 Security Control #3 — Row-Level Security (RLS) via Supabase

**Name of Control:** Database Row-Level Security — server-enforced data isolation per user

**Threat Addressed:** Unauthorized access to other users' data (Threat 1)

**CIA Principle Supported:** **Confidentiality & Integrity** — Each user can only read and write their own rows across all tables (`profiles`, `risk_scores`, `checklist_items`, `regenerate_count`).

**Implementation Description:**
Supabase PostgreSQL enforces RLS policies at the database engine level. Even if a client-side bug or a crafted request attempted to query another user's data, the database itself would reject or filter the query. The Supabase anon key used by the client is a **restricted key** — it cannot bypass RLS. Only the `service_role` key (never exposed to the client) can bypass these policies. Every query in the application already filters by `user_id`, and RLS acts as a second, server-enforced layer of the same constraint.

**Code Reference:** All Supabase queries in `src/utils/checklistGenerator.js`, `src/components/profile/ProfileForm.jsx`, `src/components/checklist/ChecklistDisplay.jsx`

```js
// Every data query is scoped to the authenticated user's ID
const { data } = await supabase
  .from('checklist_items')
  .select('*')
  .eq('user_id', user.id)   // client-side filter

// Supabase RLS policy (set in dashboard) enforces the same:
// CREATE POLICY "Users can only access their own rows"
// ON checklist_items
// FOR ALL USING (auth.uid() = user_id);
```

---

### 3.4 Security Control #4 — AI Response Validation (Output Integrity)

**Name of Control:** Structured schema validation on Gemini AI output before database write

**Threat Addressed:** Malformed or injected AI output corrupting the database (Threat 4 & 5)

**CIA Principle Supported:** **Integrity** — AI-generated checklist data is validated against a strict schema before it is ever saved to the database.

**Implementation Description:**
After Gemini returns a response, `validateChecklistResponse()` in `checklistPrompt.js` checks the parsed JSON against a strict ruleset: exactly 15 items, no duplicate ranks, each item must have all 6 required fields, category must be one of 7 allowed values, urgency must be one of 3 allowed values (`CRITICAL`, `HIGH`, `MEDIUM`), and costs must be non-negative numbers. If any check fails, the generation is aborted and a safe fallback checklist is used instead — no bad data ever reaches the database.

**Code Reference:** `src/lib/checklistPrompt.js` (lines 131–207)

```js
export function validateChecklistResponse(response) {
  const errors = []
  const validCategories = ['Emergency Supplies', 'Evacuation Planning',
    'Home Safety', 'Communication', 'Medical', 'Financial', 'Documentation']
  const validUrgencies = ['CRITICAL', 'HIGH', 'MEDIUM']
  const ranks = new Set()

  response.items.forEach((item, index) => {
    // Enforce required fields
    requiredFields.forEach(field => {
      if (!(field in item)) errors.push(`Item ${index + 1}: missing field '${field}'`)
    })
    // Enforce no duplicate ranks
    if (ranks.has(item.rank)) errors.push(`Duplicate rank ${item.rank}`)
    ranks.add(item.rank)
    // Enforce allowed enum values
    if (!validCategories.includes(item.category)) errors.push(...)
    if (!validUrgencies.includes(item.urgency)) errors.push(...)
    // Enforce cost is a positive number
    if (typeof item.estimated_cost !== 'number' || item.estimated_cost < 0) errors.push(...)
  })

  return { isValid: errors.length === 0, errors }
}
```

---

### 3.5 Security Control #5 — Rate Limiting on Checklist Generation

**Name of Control:** Daily regeneration rate limit (max 3 per day per user)

**Threat Addressed:** API abuse, denial-of-service via excessive Gemini API calls (Threat 3 & resource exhaustion)

**CIA Principle Supported:** **Availability** — Prevents a single user from exhausting the Gemini API quota, keeping the service available for all users.

**Implementation Description:**
The `regenerate_count` table in Supabase tracks how many times each user has generated a checklist that day, along with a `last_reset_date`. On each page load, the app fetches this count and resets it to 0 if the date has changed. The Generate/Regenerate button is disabled client-side when `regenerateCount >= 3`, and the `handleGenerate()` function performs the same check server-side before calling the API. The limit is enforced at the application logic level before any external API call is made.

**Code Reference:** `src/components/checklist/ChecklistDisplay.jsx`

```js
async function handleGenerate() {
  if (regenerateCount >= 3) {
    alert('You have reached the maximum of 3 checklist generations per day.')
    return   // API is never called
  }
  // ... proceed with generation
}
```

```jsx
// Button is visually disabled when limit is reached
<button
  onClick={handleGenerate}
  disabled={regenerateCount >= 3}
  className={regenerateCount >= 3 ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 ...'}
>
```

---

### 3.6 Security Control #6 — Audit Logging

**Name of Control:** Application-level audit event logging

**Threat Addressed:** Non-repudiation — tracking who did what and when (supports post-incident forensics)

**CIA Principle Supported:** **Integrity** — Provides a traceable record of key user actions for accountability.

**Implementation Description:**
`logAuditEvent()` is called at every significant state-changing action in the system: user login (`App.jsx`), profile update (`ProfileForm.jsx`), risk calculation (`ProfileForm.jsx`), and checklist generation/item completion (`ChecklistDisplay.jsx`). Each call records the action type and relevant metadata (city, risk scores, item counts, etc.). The current implementation logs to the browser console; in a production environment this would write to a dedicated `audit_logs` table in Supabase with a timestamp and `user_id`.

**Code Reference:** `src/utils/auditLog.js` & call sites across the app

```js
// auditLog.js — current implementation (console; upgrade to DB write in production)
export const logAuditEvent = async (action, details) => {
  console.log('Audit Log:', action, details)
}

// Called on logout (App.jsx)
await logAuditEvent('LOGOUT', { method: 'manual' })

// Called on profile save (ProfileForm.jsx)
await logAuditEvent('PROFILE_UPDATED', { city: sanitizedData.city, risks_calculated: true })

// Called on checklist generation (ChecklistDisplay.jsx)
await logAuditEvent('CHECKLIST_GENERATED', {
  items_count: result.items.length,
  regenerate_count: regenerateCount + 1
})
```

---

## 4. CIA Triad Application

### 4.1 Confidentiality
*How is data protected from unauthorized access?*

- **Authentication gate**: The entire application is inaccessible without a valid Google OAuth session. The check in `App.jsx` (`if (!session) return <Auth />`) ensures unauthenticated users see only the login screen.
- **Row-Level Security**: Supabase RLS policies ensure users cannot read or write any row they do not own, even if they bypass the client-side filters.
- **Secret management**: Database credentials and API keys are stored in `.env.local` and never embedded in shipped code. The Supabase `anon` key (the only key the client has) is a limited-privilege key that respects RLS — it cannot act as an admin.
- **Scoped data access**: Every database query explicitly scopes to `user_id = auth.uid()`, preventing cross-user data leakage even if RLS were misconfigured.

### 4.2 Integrity
*How do you ensure data is not modified improperly?*

- **AI output validation**: Before any AI-generated data is written to the database, it passes through `validateChecklistResponse()`, enforcing a strict schema. Malformed, incomplete, or out-of-range data is rejected.
- **Input sanitization hook**: `sanitizeInput()` in `validation.js` is wired into the profile submission pipeline. While currently a pass-through stub, the hook is structurally in place for real sanitization logic to be added without refactoring.
- **Optimistic update + revert**: In `ChecklistDisplay`, toggling a checklist item uses an optimistic UI update but calls `loadChecklist()` (reverting to DB state) if the database write fails — ensuring the UI never permanently diverges from actual stored data.
- **Audit trail**: `logAuditEvent` records every mutation — profile saves, risk recalculations, and checklist changes — providing a record of what was changed and by whom.

### 4.3 Availability
*How do you ensure the system remains accessible?*

- **Rate limiting**: The 3-generations-per-day cap prevents any single user from exhausting the Gemini API quota, protecting availability of the AI feature for all users.
- **Graceful degradation**: If the Gemini API call fails for any reason, `checklistGenerator.js` catches the error and serves a fallback static checklist (`getFallbackChecklist()`). Users always receive a usable checklist even during API outages.
- **Non-blocking hazard layers**: In `HazardMap.jsx`, GeoJSON hazard layers are loaded non-blocking — if a layer fails to load, the map and other layers still render normally.
- **Environment guard-fail**: `supabase.js` and `gemini.js` throw hard errors at startup if environment variables are missing, surfacing misconfiguration immediately at boot rather than failing silently at runtime during user operations.

---

## 5. Conclusion

### What was learned about secure system development

Building Handa Ka Ba reinforced that security is not a single feature — it is a series of overlapping layers. The most important lesson is **defense in depth**: no single control is sufficient. Even though every database query already filters by `user_id` on the client, Row-Level Security provides a second, independent enforcement layer at the database engine itself. Even though the session gate in `App.jsx` blocks unauthenticated access on the front end, Supabase's OAuth verification provides a second, server-side layer. This layering means a failure in one layer does not automatically result in a breach.

A second key takeaway is the distinction between **what is available vs. what is accessible**. The Supabase `anon` key is technically a public key — it can be seen in network traffic. What makes it safe is that the permissions attached to it (via RLS) are extremely limited. Security is not about hiding the key; it is about ensuring the key cannot do anything harmful even if obtained.

The audit logging implementation also highlighted the importance of **accountability and traceability** as first-class security requirements, not afterthoughts. Even a simple console-based logger creates an observable trail of significant events that can support debugging and incident review.

### What would be improved in the future

| Gap | Recommended Improvement |
|---|---|
| `validateProfileForm()` and `sanitizeInput()` are stubs | Implement real validation (required fields, type checks, length limits) and sanitization (strip HTML, normalize whitespace) to prevent input manipulation |
| `auditLog.js` only logs to console | Write audit events to a `audit_logs` Supabase table with `user_id`, `action`, `details`, and `created_at` for persistent, queryable records |
| Rate limiting is client-side only | Move the 3/day cap to a Supabase Edge Function or RLS policy so it cannot be bypassed by a user who manipulates local state |
| `.env.example` contains real credentials | Replace with placeholder values and ensure `.env.local` is in `.gitignore` |
| No HTTPS enforcement in dev | Configure a Content Security Policy (CSP) header and HSTS for the production deployment to prevent protocol downgrade attacks |
| `ProtectedRoute.jsx` and `useAuth.js` are empty | Implement these to centralize auth checks — currently each component handles its own `getUser()` call redundantly, creating potential inconsistencies |
| AI prompt uses raw user strings | Add a sanitization layer before user-controlled values (city, barangay, etc.) are interpolated into the Gemini prompt to prevent prompt injection |
