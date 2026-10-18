Here is a complete pseudocode blueprint for the workflow. It is broken into three layers: the **data model** (including your Spaced Repetition logic), the **AI review and human-in-the-loop pipeline**, and the **WYSIWYG interaction loop**.

---

### 1. Data Schema & Spaced Repetition (SRS)

```text
// 1. Spaced Repetition Intervals (in days) indexed by interaction count
CONSTANT SRS_INTERVALS_DAYS = [1, 3, 7, 14, 30, 60, 120]

STRUCTURE StudyCard:
    id: UUID
    topic_category: STRING         // e.g., "Network Security", "Linux PrivEsc"
    title: STRING
    content_html: STRING           // Rich-text note body from WYSIWYG
    interaction_count: INTEGER     // Defaults to 0
    last_interacted_at: TIMESTAMP
    next_review_at: TIMESTAMP
    status: ENUM ("ACTIVE", "ARCHIVED")

FUNCTION calculate_next_review(interaction_count, from_date):
    IF interaction_count >= LENGTH(SRS_INTERVALS_DAYS):
        interval = SRS_INTERVALS_DAYS[LAST_INDEX] * 2  // Scale exponentially if past list
    ELSE:
        interval = SRS_INTERVALS_DAYS[interaction_count]
    
    RETURN from_date + DURATION(days = interval)

```

---

### 2. AI Fact-Check & Section Breakdown Pipeline

The AI processes the raw WYSIWYG dump and returns a structured proposal containing verified facts, flags for inaccuracies, and proposed card segments.

```text
STRUCTURE FactCheckItem:
    original_claim: STRING
    verdict: ENUM ("VERIFIED", "QUESTIONABLE", "INCORRECT")
    correction: STRING
    reason: STRING

STRUCTURE ProposedCard:
    temp_id: UUID
    suggested_title: STRING
    topic_category: STRING
    suggested_content_html: STRING
    fact_checks: LIST OF FactCheckItem

STRUCTURE AIAnalysisResult:
    summary_of_session: STRING
    proposed_cards: LIST OF ProposedCard

FUNCTION analyze_study_session(raw_editor_html):
    system_prompt = """
    You are an expert Cybersecurity Technical Tutor.
    Analyze the user's raw study dump:
    1. Break down the content into distinct, modular topics/cards.
    2. Fact-check technical claims (command flags, RFC standards, protocol ports, vulnerabilities).
    3. Return a clean JSON array of proposed cards with corrections highlighted.
    """
    
    payload = {
        "text": raw_editor_html,
        "format": "JSON_SCHEMA"
    }

    ai_response = CALL_LLM(system_prompt, payload)
    RETURN PARSE_JSON(ai_response) AS AIAnalysisResult

```

---

### 3. Human-in-the-Loop Interaction Loop

This models the UI flow: paste notes $\rightarrow$ AI suggests modifications $\rightarrow$ user accepts, rejects, or edits $\rightarrow$ cards are committed to the spaced repetition schedule.

```text
PROCEDURE MainStudySessionFlow():
    // Step 1: User writes or dumps notes in the rich-text editor
    raw_html = WYSIWYG_Editor.getContent()
    IF IS_EMPTY(raw_html):
        SHOW_NOTIFICATION("Editor is empty. Paste your notes first.")
        RETURN

    SHOW_LOADER("Analyzing notes and verifying technical facts...")
    analysis = analyze_study_session(raw_html)
    HIDE_LOADER()

    // Step 2: Present interactive proposal modal to the user
    OPEN_MODAL("Review & Approve AI Structured Notes")
    
    cards_to_save = []

    FOR EACH proposed_card IN analysis.proposed_cards:
        // Render each card as an editable block
        DISPLAY_CARD_BLOCK(
            title = proposed_card.suggested_title,
            category = proposed_card.topic_category,
            content = proposed_card.suggested_content_html,
            fact_checks = proposed_card.fact_checks
        )

        // User review actions
        user_choice = AWAIT_USER_ACTION(card_id = proposed_card.temp_id)

        SWITCH user_choice.action:
            CASE "APPROVE_AS_IS":
                cards_to_save.APPEND(proposed_card)

            CASE "EDIT_MANUALLY":
                // Opens mini-WYSIWYG with proposed card content prefilled
                updated_content = OPEN_INLINE_EDITOR(proposed_card.suggested_content_html)
                proposed_card.suggested_content_html = updated_content
                cards_to_save.APPEND(proposed_card)

            CASE "APPLY_CORRECTIONS_ONLY":
                // Automatically patch only the verified corrections into the text
                patched_html = APPLY_CORRECTIONS(proposed_card.suggested_content_html, proposed_card.fact_checks)
                proposed_card.suggested_content_html = patched_html
                cards_to_save.APPEND(proposed_card)

            CASE "REJECT_CARD":
                // Discard this section entirely
                CONTINUE

    // Step 3: Persist approved cards with initial SRS metadata
    now = CURRENT_TIMESTAMP()

    FOR EACH card IN cards_to_save:
        new_card = INSTANTIATE StudyCard:
            id = GENERATE_UUID()
            topic_category = card.topic_category
            title = card.suggested_title
            content_html = card.suggested_content_html
            interaction_count = 0
            last_interacted_at = now
            next_review_at = calculate_next_review(interaction_count = 0, from_date = now)
            status = "ACTIVE"

        DATABASE.insert("study_cards", new_card)

    WYSIWYG_Editor.clear()
    SHOW_SUCCESS_BANNER("Added " + LENGTH(cards_to_save) + " new cards to your review queue.")

```

---

### 4. Review Engine Query

When opening the app to review:

```text
FUNCTION get_due_cards():
    now = CURRENT_TIMESTAMP()
    RETURN DATABASE.query(
        "SELECT * FROM study_cards WHERE next_review_at <= :now AND status = 'ACTIVE' ORDER BY next_review_at ASC",
        params = {"now": now}
    )

PROCEDURE mark_card_reviewed(card_id, success):
    card = DATABASE.get("study_cards", card_id)
    
    IF success IS TRUE:
        card.interaction_count = card.interaction_count + 1
    ELSE:
        // Reset streak on failure, review again tomorrow
        card.interaction_count = 0

    card.last_interacted_at = CURRENT_TIMESTAMP()
    card.next_review_at = calculate_next_review(card.interaction_count, card.last_interacted_at)
    
    DATABASE.update("study_cards", card)

```

---

## Project Status — UI Implementation

The front-end for the blueprint above is implemented as a static **Astro + Tailwind CSS v4** app with a shadcn-inspired design system.

### Color scheme

A warm **"cake"** palette in light mode and a **soft dark** theme with a **light dark-blue accent** in dark mode, defined as HSL design tokens in `src/styles/global.css`.

| Role        | Light (cake)              | Dark (soft + light blue)   |
| ----------- | ------------------------- | -------------------------- |
| background  | warm cream `35 45% 96%`   | soft navy-slate `222 30% 12%` |
| card        | frosting cream `36 55% 98%` | raised slate `222 28% 16%` |
| primary     | caramel `18 68% 62%`      | light dark-blue `207 80% 68%` |
| accent      | strawberry-cream `345 60% 90%` | deep blue `205 55% 30%` |
| plus        | secondary, muted, success, warning, destructive, border, ring |

Theme is toggled via a header button (sun/moon), persisted to `localStorage`, and applied before paint by an inline script in `Layout.astro` (no flash of wrong theme). Dark mode is class-based (`.dark` on `<html>`).

### Completion checklist

- [x] **1. Tailwind v4 configured for Astro** — `@tailwindcss/vite` plugin wired in `astro.config.mjs`.
- [x] **2. Cake / dark-blue design tokens** — shadcn-style HSL variables + `@theme inline` mapping in `src/styles/global.css`.
- [x] **3. Reusable UI primitives** — `Button`, `Card`, `Badge`, `Modal`, `Icon`, `StatCard`, `CardTile` in `src/components/`.
- [x] **4. App shell** — `Layout.astro` + `Header.astro` with nav, theme toggle, mobile menu, no-flash dark-mode script.
- [x] **5. Dashboard** (`/`) — due/upcoming queue, stat cards, review callout. Mirrors `get_due_cards()`.
- [x] **6. Capture** (`/capture`) — WYSIWYG editor + AI analysis loader + review-and-approve proposal modal with fact-check verdicts and per-card approve / apply-corrections / edit / reject actions. Mirrors `MainStudySessionFlow()`.
- [x] **7. Review session** (`/review`) — 3D flip cards, success/fail grading, SRS interval preview, progress + completion summary. Mirrors `mark_card_reviewed()`.
- [x] **8. Wiring + sample data + build** — all pages linked; `src/lib/srs.ts` holds the SRS logic (`calculateNextReview`, `isDue`, intervals) and sample seed data. `npm run build` passes (3 pages); `astro check` reports 0 errors / 0 warnings.
- [x] **9. README status recorded** — this section.

### Project structure

```text
src/
├── components/
│   ├── ui/            Button, Card, Badge, Modal, Icon  (primitives)
│   ├── Header.astro   app header: nav + theme toggle
│   ├── StatCard.astro dashboard stat tile
│   └── CardTile.astro study-card preview tile
├── layouts/
│   └── Layout.astro   html shell, fonts, no-flash theme script
├── lib/
│   └── srs.ts         SRS types + logic + sample data
├── pages/
│   ├── index.astro    Dashboard / review queue
│   ├── capture.astro  WYSIWYG capture + AI proposal modal
│   └── review.astro   flip-card review session
└── styles/
    └── global.css     design tokens + component classes
```

> **Note:** The Dashboard (`/`) and Review (`/review`) pages are server-rendered and read
> your real cards from the Supabase `study_cards` table via `src/lib/cards.ts`
> (`getActiveCards()` / `getDueCards()`). With no DB configured they show empty states.
> `src/lib/srs.ts` still ships a canned `SAMPLE_ANALYSIS` used only as the Capture-page
> fallback when no AI provider key is set.

### Run it

```bash
npm install
npm run dev      # local dev server
npm run build    # static production build → dist/
```

---

## Backend Setup — Supabase + encrypted API keys

The app now has a real backend for storing your **Gemini / OpenAI** keys securely and
running the AI analysis against them. Static pages stay prerendered; a small set of
server API routes (`src/pages/api/**`) run on the Node adapter.

### 1. Install & build

```bash
npm install
npm run build && npm run preview   # preview runs the Node server (API routes work)
# or: npm run dev
```

### 2. Create the database

In your Supabase project, open **SQL Editor → New query**, paste the contents of
[`supabase/schema.sql`](supabase/schema.sql), and run it. This creates:

- `api_credentials` — encrypted provider keys (ciphertext + salt + iv + auth_tag + last-4 hint)
- `study_cards` — the spaced-repetition cards
- Row Level Security is **on with no public policies**, so the anon key can't read these
  tables; the server reaches them with the service-role key.

### 3. Configure environment variables

Copy the example and fill it in (never commit `.env`):

```bash
cp .env.example .env
```

| Variable | Where to find it | Notes |
| --- | --- | --- |
| `PUBLIC_SUPABASE_URL` | Supabase → Connect panel (Astro) | project URL |
| `PUBLIC_SUPABASE_PUBLISHABLE_KEY` | same panel | publishable (public) key; access governed by your RLS policies |
| `CREDENTIALS_MASTER_KEY` | generate (below) | the one secret kept outside the DB |

Generate a master key:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

> Back this key up. It's what makes the stored (encrypted) provider keys decryptable —
> lose it and you'll have to re-enter your API keys.

### 4. Add your provider key

Run the app, open **Settings** (`/settings`), paste your Gemini or OpenAI key, hit
**Test** to verify it, then **Save**. From then on, **Capture → Analyze with AI** calls
your chosen provider. With no key configured it falls back to the built-in demo analysis.

### How the encryption works (the secure part)

A **salt alone can't decrypt anything** — so the scheme is:

- The **master key** lives only in `CREDENTIALS_MASTER_KEY` (server env), never in the DB.
- Each saved key gets a fresh random **salt** and **IV**. A per-record 256-bit key is
  derived via `scrypt(masterKey, salt)`, then the key is encrypted with **AES-256-GCM**.
- Stored in the row: `ciphertext`, `salt`, `iv`, `auth_tag`, and a `key_hint` (last 4 chars).
  Salt/IV/auth-tag are **not secret** — storing them beside the ciphertext is standard.
- GCM's auth tag means tampering is detected on decrypt. The browser only ever sees the
  last-4 hint, never the full key.

See [`src/lib/crypto.ts`](src/lib/crypto.ts) for the implementation.

### Backend file map

```text
supabase/schema.sql              DB migration (run in Supabase SQL editor)
src/lib/crypto.ts                AES-256-GCM encrypt/decrypt + scrypt key derivation
src/lib/supabase.ts              server-only service-role client
src/lib/credentials.ts           save/get/list/delete encrypted keys
src/lib/providers.ts             Gemini + OpenAI REST calls (test + analyze)
src/pages/api/credentials.ts     GET status · POST save · DELETE
src/pages/api/credentials/test.ts  POST test a key
src/pages/api/analyze.ts         POST notes → provider analysis (demo fallback)
src/pages/settings.astro         UI to manage keys
```
