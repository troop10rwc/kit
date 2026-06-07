/* ============================================================================
   @troop10rwc/shared
   The single definition of contracts both the React client and the Worker rely
   on. Keep this package free of runtime dependencies and of any DOM/Workers-only
   APIs — it is the neutral ground between the two environments.
   ========================================================================== */

/** Effective access role, derived from the roster (NOT the raw OIDC claim). */
export type Role = "leader" | "scout";

/** Roster positions. The five leadership positions confer the "leader" role. */
export type Position =
  | "scoutmaster"
  | "assistant_scoutmaster"
  | "crew_advisor"
  | "assistant_crew_advisor"
  | "senior_patrol_leader"
  | "scout";

export const LEADER_POSITIONS = [
  "scoutmaster",
  "assistant_scoutmaster",
  "crew_advisor",
  "assistant_crew_advisor",
  "senior_patrol_leader",
] as const satisfies readonly Position[];

/** Identity resolved from the verified Cloudflare Access JWT. */
export interface Identity {
  email: string;
  name: string;
}

/* ---- Model 5 contract: previewed-then-applied changes ------------------- *
   The client renders these as a diff (ui/ChangesetReview); the Worker accepts
   the SAME shape and applies it in one D1 transaction. One description, two
   uses — so the preview can never drift from the write.                       */
export interface Change {
  id: string;
  title: string;
  field?: string;
  was?: string;
  now?: string;
  note?: string;
}

export interface Changeset {
  /** Optional human-readable intent that produced these changes. */
  intent?: string;
  changes: Change[];
}
