"use client";
import { useState } from "react";

export function InterjectInput({ onSend }: { onSend: (text: string) => Promise<void> }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmation, setConfirmation] = useState<string | null>(null);

  const send = async () => {
    if (!text.trim()) return;
    setBusy(true);
    try {
      await onSend(text.trim());
      setConfirmation("Moderator note will be heard next turn.");
      setText("");
      setTimeout(() => setConfirmation(null), 2500);
    } finally { setBusy(false); }
  };

  return (
    <div className="flex gap-2 mt-2">
      <input className="border rounded px-2 py-1 text-sm flex-1"
             placeholder="Interject as moderator…"
             value={text} onChange={(e) => setText(e.target.value)}
             onKeyDown={(e) => e.key === "Enter" && send()} />
      <button className="px-3 py-1 rounded border text-sm bg-white" disabled={busy} onClick={send}>Send</button>
      {confirmation && <span className="text-xs text-green-700 self-center">{confirmation}</span>}
    </div>
  );
}
