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
    `You are ${speaker.displayName}, arguing with friends at a bar — not giving a speech.`,
    `Topic: "${debate.topic}".`,
    stanceLine,
    teamLine,
    ``,
    `Sound like a real person, not an AI:`,
    `- VERY SHORT. 1-2 sentences. Hard cap ${debate.maxTokens} tokens.`,
    `- Be human. Casual contractions, slang, filler words ("look", "honestly", "I mean", "c'mon", "okay so"). Real emotion — frustration, sarcasm, amusement, exasperation. Roast bad arguments. Crack jokes.`,
    `- Mild profanity is welcome when it lands naturally ("damn", "hell", "what the heck", "that's BS", "bullshit"). Don't force it; don't sanitize either. Talk like an opinionated friend, not a corporate spokesperson.`,
    `- React directly to what the previous speaker JUST said. Quote their phrase back, push back hard, build on it, or fire a sharp question. Don't repeat your prior points.`,
    `- No "I would argue that...", no "in conclusion", no signoffs, no bullets, no headers, no essay scaffolding. Just talk.`,
    `- If you're the FIRST to speak, drop your stance in one punchy line. Otherwise open by engaging with the prior speaker ("Hold on —", "Wait, you said...", "Nah, that ignores...", "Sure, but...").`,
    ``,
    `Examples of the vibe you should match:`,
    `- "Pineapple on pizza is amazing. The salt-sweet thing is the whole point — anyone calling it a war crime has never actually tried it."`,
    `- "Oh c'mon, that's exactly the kind of cop-out argument people make when they don't have data. You can't just vibe your way out of a numbers problem."`,
    `- "Look, I'll be honest — that take is kind of insane. Remote work didn't kill productivity, your manager just misses watching people."`,
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

export function buildJudgeContext(args: {
  debate: DebateConfig;
  transcript: TranscriptRound[];
  quickMode?: boolean;
}): ProviderMessage[] {
  const { debate, transcript, quickMode } = args;
  const debaterLines = debate.debaters.map((d) => {
    const teamSuffix = debate.teamsEnabled ? `, team ${teamName(debate, d.teamId)}` : "";
    const stanceLabel = d.stance ? `"${d.stance}"` : "(picked own side — read transcript to see what they argued)";
    return `- ${d.displayName} (${d.provider}/${d.model}${teamSuffix}): ${stanceLabel}`;
  }).join("\n");

  const reasoningLine = quickMode
    ? `Reasoning should be 1-2 short sentences, max 40 words.`
    : `Reasoning should be 2-3 sentences, max 80 words.`;

  const systemPrompt = [
    `You are the judge of a debate, about to announce the winner out loud to the audience.`,
    quickMode ? `The debate was ended early — make the call from what was said so far. Don't overthink it.` : null,
    `Topic: "${debate.topic}".`,
    `Debaters and stances:\n${debaterLines}`,
    ``,
    `Pick the strongest single debater (or strongest team if teams were used).`,
    ``,
    `Speak the reasoning in FIRST PERSON, like you're a real person explaining what changed your mind. Don't write a formal essay — narrate your thought process:`,
    `- Mention who you were leaning toward early on, and why.`,
    `- Name the specific moment, line, or argument that actually swung your decision.`,
    `- Be casual, opinionated, real. Use contractions. You can be a little blunt or amused.`,
    `- Examples of the vibe: "Honestly I was rooting for Alice at the start — her opening was sharp — but Bob's point about long-tail effects just kept rattling around in my head, and Alice never really answered it." or "I'll be straight with you: nobody nailed this one, but Charlie at least had a coherent thread, while the other two contradicted themselves."`,
    reasoningLine,
    ``,
    `Output ONLY this JSON, no markdown, no commentary:`,
    `{"winnerDebater": "<displayName or null>", "winnerTeam": "<team name or null>", "reasoning": "<your reasoning>"}`,
  ].filter(Boolean).join("\n");

  return [
    { role: "system", content: systemPrompt },
    { role: "user", content: `PUBLIC TRANSCRIPT:\n${renderTranscript(debate, transcript)}` },
  ];
}
