import { getSupabaseAdmin, isSupabaseConfigured } from "./supabase";
import type { StudyCard } from "./srs";

/**
 * Data-access layer for `study_cards`.
 *
 * Server-only (uses the service-role client). Import exclusively from
 * server-rendered pages (`export const prerender = false`) or API routes.
 * When Supabase isn't configured yet, these return empty arrays so the UI
 * degrades gracefully to its empty states instead of throwing.
 */

const TABLE = "study_cards";

const SELECT =
  "id, topic_category, title, content_html, interaction_count, last_interacted_at, next_review_at, status";

/** Map a raw DB row to the StudyCard shape the UI expects. */
function toCard(row: any): StudyCard {
  return {
    id: String(row.id),
    topic_category: row.topic_category ?? "General",
    title: row.title ?? "Untitled",
    content_html: row.content_html ?? "",
    interaction_count: row.interaction_count ?? 0,
    last_interacted_at: row.last_interacted_at,
    next_review_at: row.next_review_at,
    status: row.status === "ARCHIVED" ? "ARCHIVED" : "ACTIVE",
  };
}

/** All ACTIVE cards, ordered by their next review date. */
export async function getActiveCards(): Promise<StudyCard[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from(TABLE)
    .select(SELECT)
    .eq("status", "ACTIVE")
    .order("next_review_at", { ascending: true });

  if (error) throw new Error(`Failed to load cards: ${error.message}`);
  return (data ?? []).map(toCard);
}

/**
 * Cards due for review now (next_review_at <= now), ordered by due date.
 * Mirrors the blueprint's get_due_cards().
 */
export async function getDueCards(now = new Date()): Promise<StudyCard[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from(TABLE)
    .select(SELECT)
    .eq("status", "ACTIVE")
    .lte("next_review_at", now.toISOString())
    .order("next_review_at", { ascending: true });

  if (error) throw new Error(`Failed to load due cards: ${error.message}`);
  return (data ?? []).map(toCard);
}
