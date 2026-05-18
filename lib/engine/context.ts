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
      const stanceLabel = sp.stance ? ` — "${sp.stance}"` : " (picks own side)";
      const errSuffix = s.error ? ` [interrupted: ${s.error}]` : "";
      lines.push(`Round ${r.roundNumber}, ${sp.displayName}${team}${stanceLabel}:\n  ${s.text}${errSuffix}`);
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

  const stanceLine = speaker.stance
    ? `Your assigned position: "${speaker.stance}". You must defend this position.`
    : `You may pick any defensible position on this topic. State your position clearly in your first turn and defend it consistently for the rest of the debate — do not switch sides mid-debate.`;

  const systemPrompt = [
    `You are ${speaker.displayName}, in a live spoken back-and-forth debate.`,
    `Topic: "${debate.topic}".`,
    stanceLine,
    teamLine,
    ``,
    `Speak the way a real person speaks in a real-time argument:`,
    `- VERY SHORT. 1-2 sentences. Hard cap ${debate.maxTokens} tokens.`,
    `- React directly to what the previous speaker JUST said. Quote a phrase of theirs, push back, build on it, or ask a sharp question. Don't repeat your prior points.`,
    `- First person, contractions, casual phrasing. Example tone: "I think pineapple belongs on pizza because the sweetness cuts the salt." Then the next speaker: "Yeah but it makes the crust soggy — that ruins the texture."`,
    `- No preamble, no signoff, no bullet points, no headers, no formal essay structure.`,
    `- If you're the FIRST to speak, open with your one-line stance. If you're responding, open by engaging with the prior speaker (e.g., "But you said...", "Sure, but...", "That ignores...").`,
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
  const stanceLine = speaker.stance
    ? `Topic: "${debate.topic}". Your team position: "${speaker.stance}".`
    : `Topic: "${debate.topic}". Your team picks its own side — coordinate which position you'll all defend.`;

  const systemPrompt = [
    `You are ${speaker.displayName} on team "${teamLabel}".`,
    `You are in a PRIVATE huddle. Anything you write here is visible only to your teammates: ${teammates(debate, speaker) || "(none)"}.`,
    `The opposing team and the judge will NEVER see this message.`,
    stanceLine,
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
  const debaterLines = debate.debaters.map((d) => {
    const teamSuffix = debate.teamsEnabled ? `, team ${teamName(debate, d.teamId)}` : "";
    const stanceLabel = d.stance ? `"${d.stance}"` : "(picked own side — read transcript to see what they argued)";
    return `- ${d.displayName} (${d.provider}/${d.model}${teamSuffix}): ${stanceLabel}`;
  }).join("\n");

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
