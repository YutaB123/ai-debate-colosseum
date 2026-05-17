import { randomUUID } from "node:crypto";
import type { DB } from "./connection";

export interface TranscriptRound {
  roundId: string;
  roundNumber: number;
  speeches: { debaterId: string; text: string; tokenCount: number; error: string | null }[];
  whispers: { debaterId: string; teamId: string; text: string }[];
  votes: { debaterId: string }[];
  interjections: { text: string }[];
}

export interface FullTranscript {
  rounds: TranscriptRound[];
  verdict: { winnerDebaterId: string | null; winnerTeamId: string | null; reasoning: string; userOverride: string | null } | null;
}

export function createRound(db: DB, debateId: string, roundNumber: number): string {
  const id = randomUUID();
  db.prepare(
    `INSERT INTO rounds (id, debate_id, round_number, status) VALUES (?, ?, ?, 'pending')`
  ).run(id, debateId, roundNumber);
  return id;
}

export function setRoundStatus(db: DB, roundId: string, status: "pending" | "speaking" | "huddle" | "completed") {
  db.prepare(`UPDATE rounds SET status = ? WHERE id = ?`).run(status, roundId);
}

export function beginSpeech(db: DB, roundId: string, debaterId: string): string {
  const id = randomUUID();
  db.prepare(
    `INSERT INTO speeches (id, round_id, debater_id, text, token_count, started_at, ended_at, error)
     VALUES (?, ?, ?, '', 0, ?, NULL, NULL)`
  ).run(id, roundId, debaterId, Date.now());
  return id;
}

export function finalizeSpeech(db: DB, speechId: string, text: string, tokenCount: number, error?: string) {
  db.prepare(
    `UPDATE speeches SET text = ?, token_count = ?, ended_at = ?, error = ? WHERE id = ?`
  ).run(text, tokenCount, Date.now(), error ?? null, speechId);
}

export function recordWhisper(db: DB, roundId: string, debaterId: string, teamId: string, text: string) {
  db.prepare(
    `INSERT INTO whispers (id, round_id, debater_id, team_id, text, created_at) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(randomUUID(), roundId, debaterId, teamId, text, Date.now());
}

export function recordInterjection(db: DB, roundId: string, text: string) {
  db.prepare(
    `INSERT INTO interjections (id, round_id, text, created_at) VALUES (?, ?, ?, ?)`
  ).run(randomUUID(), roundId, text, Date.now());
}

export function recordVote(db: DB, roundId: string, debaterId: string) {
  // Replace any prior vote in this round.
  db.prepare(`DELETE FROM votes WHERE round_id = ?`).run(roundId);
  db.prepare(
    `INSERT INTO votes (id, round_id, debater_id, created_at) VALUES (?, ?, ?, ?)`
  ).run(randomUUID(), roundId, debaterId, Date.now());
}

export function recordVerdict(
  db: DB,
  debateId: string,
  v: { winnerDebaterId: string | null; winnerTeamId: string | null; reasoning: string }
) {
  db.prepare(
    `INSERT INTO verdicts (id, debate_id, winner_debater, winner_team, reasoning, user_override, override_note, created_at)
     VALUES (?, ?, ?, ?, ?, NULL, NULL, ?)`
  ).run(randomUUID(), debateId, v.winnerDebaterId, v.winnerTeamId, v.reasoning, Date.now());
}

export function setVerdictOverride(db: DB, debateId: string, override: string, note: string | null) {
  db.prepare(`UPDATE verdicts SET user_override = ?, override_note = ? WHERE debate_id = ?`).run(override, note, debateId);
}

export function getFullTranscript(db: DB, debateId: string): FullTranscript {
  const rounds = db.prepare(`SELECT id, round_number FROM rounds WHERE debate_id = ? ORDER BY round_number`).all(debateId) as any[];
  const out: TranscriptRound[] = rounds.map((r) => {
    const speeches = db.prepare(
      `SELECT debater_id as debaterId, text, token_count as tokenCount, error
       FROM speeches WHERE round_id = ? ORDER BY started_at`
    ).all(r.id) as any[];
    const whispers = db.prepare(
      `SELECT debater_id as debaterId, team_id as teamId, text FROM whispers WHERE round_id = ? ORDER BY created_at`
    ).all(r.id) as any[];
    const votes = db.prepare(`SELECT debater_id as debaterId FROM votes WHERE round_id = ?`).all(r.id) as any[];
    const interjections = db.prepare(`SELECT text FROM interjections WHERE round_id = ? ORDER BY created_at`).all(r.id) as any[];
    return { roundId: r.id, roundNumber: r.round_number, speeches, whispers, votes, interjections };
  });
  const v = db.prepare(`SELECT * FROM verdicts WHERE debate_id = ?`).get(debateId) as any;
  const verdict = v ? {
    winnerDebaterId: v.winner_debater,
    winnerTeamId: v.winner_team,
    reasoning: v.reasoning,
    userOverride: v.user_override,
  } : null;
  return { rounds: out, verdict };
}
