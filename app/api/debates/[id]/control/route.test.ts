/**
 * @jest-environment node
 */
import { POST } from "./route";
import { registerEngine, unregisterEngine } from "../../../../../lib/engine/state";

const debate: any = { id: "d1", debaters: [{ id: "x" }] };

beforeEach(() => unregisterEngine("d1"));

describe("POST /api/debates/[id]/control", () => {
  it("404s if no engine is running", async () => {
    const res = await POST(new Request("http://x", { method: "POST", body: JSON.stringify({ action: "pause" }) }), { params: { id: "d1" } });
    expect(res.status).toBe(404);
  });

  it("sets paused = true on pause", async () => {
    const signals: any = { paused: false, skipCurrent: false, pendingInterjection: null };
    registerEngine({ debate, signals, observers: new Set() });
    await POST(new Request("http://x", { method: "POST", body: JSON.stringify({ action: "pause" }) }), { params: { id: "d1" } });
    expect(signals.paused).toBe(true);
  });

  it("stores a pending interjection", async () => {
    const signals: any = { paused: false, skipCurrent: false, pendingInterjection: null };
    registerEngine({ debate, signals, observers: new Set() });
    await POST(new Request("http://x", { method: "POST", body: JSON.stringify({ action: "interject", text: "focus please" }) }), { params: { id: "d1" } });
    expect(signals.pendingInterjection).toBe("focus please");
  });
});
