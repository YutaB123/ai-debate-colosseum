import type { DB } from "./connection";
import { randomUUID } from "node:crypto";
import type { DebateConfig, DebateStatus, ProviderId } from "../types";

export interface CreateDebateInput {
  topic: string;
  judgeModel: string;
  roundCount: number;
  maxTokens: number;
  teamsEnabled: boolean;
  teams: { name: string; color: string }[];
  debaters: {
    provider: ProviderId;
    model: string;
    displayName: string;
    stance: string;
    teamIndex: number | null;
    speakOrder: number;
    voiceUri: string;
  }[];
}

export function createDebate(db: DB, input: CreateDebateInput): string {
  const id = randomUUID();
  const now = Date.now();

  const insertDebate = db.prepare(
    `INSERT INTO debates (id, topic, judge_model, round_count, max_tokens, teams_enabled, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insertTeam = db.prepare(
    `INSERT INTO teams (id, debate_id, name, color) VALUES (?, ?, ?, ?)`
  );
  const insertDebater = db.prepare(
    `INSERT INTO debaters (id, debate_id, provider, model, display_name, stance,
                           team_id, speak_order, voice_uri, disabled)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`
  );

  const tx = db.transaction(() => {
    insertDebate.run(id, input.topic, input.judgeModel, input.roundCount, input.maxTokens,
                     input.teamsEnabled ? 1 : 0, "setup", now);
    const teamIds = input.teams.map((t) => {
      const tid = randomUUID();
      insertTeam.run(tid, id, t.name, t.color);
      return tid;
    });
    for (const d of input.debaters) {
      insertDebater.run(
        randomUUID(), id, d.provider, d.model, d.displayName, d.stance,
        d.teamIndex !== null ? teamIds[d.teamIndex] : null,
        d.speakOrder, d.voiceUri,
      );
    }
  });
  tx();
  return id;
}

export function getDebate(db: DB, id: string): DebateConfig | null {
  const row = db.prepare(`SELECT * FROM debates WHERE id = ?`).get(id) as any;
  if (!row) return null;
  const teams = db.prepare(`SELECT * FROM teams WHERE debate_id = ?`).all(id) as any[];
  const debaters = db.prepare(`SELECT * FROM debaters WHERE debate_id = ? ORDER BY speak_order`).all(id) as any[];
  return {
    id: row.id,
    topic: row.topic,
    judgeModel: row.judge_model,
    roundCount: row.round_count,
    maxTokens: row.max_tokens,
    teamsEnabled: !!row.teams_enabled,
    teams: teams.map((t) => ({ id: t.id, debateId: t.debate_id, name: t.name, color: t.color })),
    debaters: debaters.map((d) => ({
      id: d.id, debateId: d.debate_id, provider: d.provider as ProviderId,
      model: d.model, displayName: d.display_name, stance: d.stance,
      teamId: d.team_id, speakOrder: d.speak_order, voiceUri: d.voice_uri,
      disabled: !!d.disabled,
    })),
  };
}

export function setDebateStatus(db: DB, id: string, status: DebateStatus) {
  db.prepare(`UPDATE debates SET status = ?, completed_at = ? WHERE id = ?`)
    .run(status, status === "completed" ? Date.now() : null, id);
}

export function listDebates(db: DB): { id: string; topic: string; status: string; createdAt: number }[] {
  return db.prepare(`SELECT id, topic, status, created_at as createdAt FROM debates ORDER BY created_at DESC`).all() as any[];
}
