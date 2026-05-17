import type { DebateConfig, Debater, ProviderMessage } from "../types";
import type { TranscriptRound } from "../db/round-repo";

export interface BuildArgs {
  debate: DebateConfig;
  speaker: Debater;
  roundNumber: number;
  transcript: TranscriptRound[];
}

function lookupDebater(d: DebateConfig, id: string): Debater {
  const x = d.debaters.find((x) => x.id === id);
  if (!x) throw new Error(`debater not found: ${id}`);
  return x;
}

function teamName(d: DebateConfig, teamId: string | null): string {
  if (!teamId) return "";
  return d.teams.find((t) => t.id === teamId)?.name ?? "";
}

function renderTranscript(d: DebateConfig, transcript: TranscriptRound[]): string {
  if (transcript.length === 0) return "(no speeches yet)";
  const lines: string[] = [];
  for (const r of transcript) {
    for (const s of r.speeches) {
      const sp = lookupDebater(d, s.debaterId);
      const team = d.teamsEnabled ? ` (${teamName(d, sp.teamId)})` : "";
      const errSuffix = s.error ? ` [interrupted: ${s.error}]` : "";
      lines.push(`Round ${r.roundNumber}, ${sp.displayName}${team} — "${sp.stance}":\n  ${s.text}${errSuffix}`);
    }
  }
  return lines.join("\n\n");
}

function renderOwnTeamWhispers(d: DebateConfig, speaker: Debater, transcript: TranscriptRound[]): string {
  if (!d.teamsEnabled || !speaker.teamId) return "";
  const lines: string[] = [];
  for (const r of transcript) {
    for (const w of r.whispers) {
      if (w.teamId === speaker.teamId) {
        const writer = lookupDebater(d, w.debaterId);
        lines.push(`Round ${r.roundNumber} huddle — ${writer.displayName}: "${w.text}"`);
      }
    }
  }
  return lines.join("\n");
}

function renderInterjections(transcript: TranscriptRound[], roundNumber: number): string {
  const round = transcript.find((r) => r.roundNumber === roundNumber);
  if (!round) return "";
  return round.interjections.map((i) => i.text).join("\n");
}

function teammates(d: DebateConfig, speaker: Debater): string {
  if (!d.teamsEnabled || !speaker.teamId) return "";
  return d.debaters
    .filter((x) => x.teamId === speaker.teamId && x.id !== speaker.id)
    .map((x) => x.displayName)
    .join(", ");
}

export function buildSpeechContext(args: BuildArgs): ProviderMessage[] {
  const { debate, speaker, roundNumber, transcript } = args;
  const teamLine = debate.teamsEnabled && speaker.teamId
    ? `You are on team "${teamName(debate, speaker.teamId)}" with: ${teammates(debate, speaker) || "(no other teammates)"}.`
    : "";

  const systemPrompt = [
    `You are ${speaker.displayName}, debating in a structured debate.`,
    `Topic: "${debate.topic}".`,
    `Your assigned position: "${speaker.stance}". You must defend this position.`,
    teamLine,
    `This is round ${roundNumber} of ${debate.roundCount}.`,
    `Speak for at most ${debate.maxTokens} tokens. Be direct and substantive — no preamble, no signoff.`,
  ].filter(Boolean).join("\n");

  const messages: ProviderMessage[] = [{ role: "system", content: systemPrompt }];
  const sections: string[] = [];

  sections.push(`PUBLIC TRANSCRIPT (chronological):\n${renderTranscript(debate, transcript)}`);

  const ownTeam = renderOwnTeamWhispers(debate, speaker, transcript);
  if (ownTeam) sections.push(`TEAM NOTES (private, from your teammates):\n${ownTeam}`);

  const interj = renderInterjections(transcript, roundNumber);
  if (interj) sections.push(`MODERATOR INTERJECTION:\n${interj}`);

  sections.push("Your turn. Speak now.");
  messages.push({ role: "user", content: sections.join("\n\n") });
  return messages;
}

export function buildHuddleContext(args: BuildArgs): ProviderMessage[] {
  const { debate, speaker, roundNumber, transcript } = args;
  const teamLabel = teamName(debate, speaker.teamId);
  const systemPrompt = [
    `You are ${speaker.displayName} on team "${teamLabel}".`,
    `You are in a PRIVATE huddle. Anything you write here is visible only to your teammates: ${teammates(debate, speaker) || "(none)"}.`,
    `The opposing team and the judge will NEVER see this message.`,
    `Topic: "${debate.topic}". Your team position: "${speaker.stance}".`,
    `It is between round ${roundNumber} and ${roundNumber + 1} of ${debate.roundCount}.`,
    `Write ONE short tactical note to your teammates: what to emphasize, what argument to make next, what to avoid. Be specific. Maximum ${Math.floor(debate.maxTokens / 2)} tokens.`,
  ].join("\n");

  const sections: string[] = [];
  sections.push(`PUBLIC TRANSCRIPT (chronological):\n${renderTranscript(debate, transcript)}`);
  const ownTeam = renderOwnTeamWhispers(debate, speaker, transcript);
  if (ownTeam) sections.push(`PREVIOUS TEAM NOTES:\n${ownTeam}`);
  sections.push("Write your one-message huddle note now.");

  return [
    { role: "system", content: systemPrompt },
    { role: "user", content: sections.join("\n\n") },
  ];
}

export function buildJudgeContext(args: { debate: DebateConfig; transcript: TranscriptRound[] }): ProviderMessage[] {
  const { debate, transcript } = args;
  const debaterLines = debate.debaters.map((d) =>
    `- ${d.displayName} (${d.provider}/${d.model}${debate.teamsEnabled ? `, team ${teamName(debate, d.teamId)}` : ""}): "${d.stance}"`
  ).join("\n");

  const systemPrompt = [
    `You are an impartial judge for a structured debate.`,
    `Topic: "${debate.topic}".`,
    `Debaters and stances:\n${debaterLines}`,
    `Read the transcript carefully and pick the single strongest debater (or strongest team if teams were used).`,
    `Output JSON: {"winnerDebater": "<displayName or null>", "winnerTeam": "<team name or null>", "reasoning": "<2-4 sentences>"}.`,
    `Output ONLY the JSON, no markdown.`,
  ].join("\n");

  return [
    { role: "system", content: systemPrompt },
    { role: "user", content: `PUBLIC TRANSCRIPT:\n${renderTranscript(debate, transcript)}` },
  ];
}
