// ──────────────────────────────────────────────────────────────
// Spaced-Repetition data model + sample data (from README blueprint)
// ──────────────────────────────────────────────────────────────

export const SRS_INTERVALS_DAYS = [1, 3, 7, 14, 30, 60, 120];

export type CardStatus = "ACTIVE" | "ARCHIVED";
export type Verdict = "VERIFIED" | "QUESTIONABLE" | "INCORRECT";

export interface StudyCard {
  id: string;
  topic_category: string;
  title: string;
  content_html: string;
  interaction_count: number;
  last_interacted_at: string; // ISO
  next_review_at: string; // ISO
  status: CardStatus;
}

export interface FactCheckItem {
  original_claim: string;
  verdict: Verdict;
  correction: string;
  reason: string;
}

export interface ProposedCard {
  temp_id: string;
  suggested_title: string;
  topic_category: string;
  suggested_content_html: string;
  fact_checks: FactCheckItem[];
}

export interface AIAnalysisResult {
  summary_of_session: string;
  proposed_cards: ProposedCard[];
}

const DAY_MS = 86_400_000;

/** calculate_next_review(interaction_count, from_date) */
export function calculateNextReview(interactionCount: number, fromDate: Date): Date {
  const last = SRS_INTERVALS_DAYS.length - 1;
  const interval =
    interactionCount >= SRS_INTERVALS_DAYS.length
      ? SRS_INTERVALS_DAYS[last] * 2
      : SRS_INTERVALS_DAYS[interactionCount];
  return new Date(fromDate.getTime() + interval * DAY_MS);
}

/** Human-friendly relative time, e.g. "in 3 days", "2 days ago", "today". */
export function relativeTime(iso: string, now = new Date()): string {
  const diff = new Date(iso).getTime() - now.getTime();
  const days = Math.round(diff / DAY_MS);
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === -1) return "yesterday";
  if (days > 1) return `in ${days} days`;
  return `${Math.abs(days)} days ago`;
}

export function isDue(card: StudyCard, now = new Date()): boolean {
  return card.status === "ACTIVE" && new Date(card.next_review_at).getTime() <= now.getTime();
}

// ── Sample seed data ───────────────────────────────────────────
const iso = (offsetDays: number) =>
  new Date(Date.now() + offsetDays * DAY_MS).toISOString();

export const SAMPLE_CARDS: StudyCard[] = [
  {
    id: "c1",
    topic_category: "Network Security",
    title: "TCP 3-Way Handshake",
    content_html:
      "<p>Connection establishment uses <strong>SYN → SYN/ACK → ACK</strong>.</p><ul><li>Client sends <code>SYN</code> with an initial sequence number.</li><li>Server replies <code>SYN/ACK</code>.</li><li>Client acknowledges with <code>ACK</code>.</li></ul>",
    interaction_count: 2,
    last_interacted_at: iso(-7),
    next_review_at: iso(-1),
    status: "ACTIVE",
  },
  {
    id: "c2",
    topic_category: "Linux PrivEsc",
    title: "SUID Binary Enumeration",
    content_html:
      "<p>Find SUID binaries to hunt for privilege-escalation vectors:</p><pre>find / -perm -4000 -type f 2>/dev/null</pre><p>Cross-reference results against <strong>GTFOBins</strong>.</p>",
    interaction_count: 0,
    last_interacted_at: iso(-1),
    next_review_at: iso(0),
    status: "ACTIVE",
  },
  {
    id: "c3",
    topic_category: "Web Security",
    title: "SQL Injection — UNION Based",
    content_html:
      "<p>Use <code>UNION SELECT</code> to exfiltrate data when the query result is reflected.</p><ul><li>Match the column count with <code>ORDER BY n</code>.</li><li>Fingerprint the DB via version functions.</li></ul>",
    interaction_count: 1,
    last_interacted_at: iso(-3),
    next_review_at: iso(0),
    status: "ACTIVE",
  },
  {
    id: "c4",
    topic_category: "Cryptography",
    title: "Symmetric vs Asymmetric",
    content_html:
      "<p><strong>Symmetric</strong> (AES) uses one shared key — fast. <strong>Asymmetric</strong> (RSA/ECC) uses a key pair — enables key exchange & signatures.</p>",
    interaction_count: 3,
    last_interacted_at: iso(-5),
    next_review_at: iso(9),
    status: "ACTIVE",
  },
  {
    id: "c5",
    topic_category: "Active Directory",
    title: "Kerberoasting",
    content_html:
      "<p>Request service tickets (TGS) for accounts with an <code>SPN</code>, then crack them offline to recover the service account password.</p>",
    interaction_count: 1,
    last_interacted_at: iso(-2),
    next_review_at: iso(1),
    status: "ACTIVE",
  },
  {
    id: "c6",
    topic_category: "Network Security",
    title: "Common Service Ports",
    content_html:
      "<p>FTP <code>21</code>, SSH <code>22</code>, HTTP <code>80</code>, HTTPS <code>443</code>, SMB <code>445</code>, RDP <code>3389</code>.</p>",
    interaction_count: 4,
    last_interacted_at: iso(-10),
    next_review_at: iso(20),
    status: "ACTIVE",
  },
];

// ── Sample AI analysis result (demo for the Capture page) ──────
export const SAMPLE_ANALYSIS: AIAnalysisResult = {
  summary_of_session:
    "Detected 2 distinct topics covering SSH hardening and Nmap scanning. One claim about the default SSH port needs correction and one flag timing note is questionable.",
  proposed_cards: [
    {
      temp_id: "p1",
      suggested_title: "SSH Hardening Essentials",
      topic_category: "Linux Hardening",
      suggested_content_html:
        "<p>Harden <code>sshd_config</code>:</p><ul><li>Disable root login: <code>PermitRootLogin no</code></li><li>Use key-based auth, disable passwords</li><li>Change the default port to reduce noise</li></ul>",
      fact_checks: [
        {
          original_claim: "SSH runs on port 23 by default.",
          verdict: "INCORRECT",
          correction: "SSH runs on port 22 by default; port 23 is Telnet.",
          reason: "IANA assigns TCP/22 to SSH and TCP/23 to Telnet.",
        },
        {
          original_claim: "Disabling root login improves security.",
          verdict: "VERIFIED",
          correction: "",
          reason: "Forces attackers to compromise a user account first, aiding auditing.",
        },
      ],
    },
    {
      temp_id: "p2",
      suggested_title: "Nmap Scan Timing",
      topic_category: "Network Security",
      suggested_content_html:
        "<p>Control scan speed with timing templates <code>-T0</code>…<code>-T5</code>.</p><ul><li><code>-T4</code> is a good default for fast networks.</li><li><code>-T0</code>/<code>-T1</code> evade IDS at the cost of speed.</li></ul>",
      fact_checks: [
        {
          original_claim: "-T5 is always the best option.",
          verdict: "QUESTIONABLE",
          correction: "-T5 is fastest but may drop packets and trip IDS; prefer -T4 generally.",
          reason: "Aggressive timing sacrifices accuracy and stealth.",
        },
      ],
    },
  ],
};

export const TOPIC_CATEGORIES = [
  "Network Security",
  "Web Security",
  "Linux PrivEsc",
  "Linux Hardening",
  "Active Directory",
  "Cryptography",
  "Cloud Security",
  "Reverse Engineering",
];
