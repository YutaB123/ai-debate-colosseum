import { getProvider } from "./registry";

describe("provider registry", () => {
  it("returns the stub provider when configured", () => {
    process.env.DEBATE_USE_STUB_PROVIDERS = "true";
    const p = getProvider("openai");
    expect(p.id).toBe("openai");
    delete process.env.DEBATE_USE_STUB_PROVIDERS;
  });

  it("throws for unknown providers", () => {
    expect(() => getProvider("nope" as any)).toThrow(/unknown provider/i);
  });

  it("returns the stub provider for grok when configured", () => {
    process.env.DEBATE_USE_STUB_PROVIDERS = "true";
    const p = getProvider("grok");
    expect(p.id).toBe("grok");
    delete process.env.DEBATE_USE_STUB_PROVIDERS;
  });

  it("throws when XAI_API_KEY is missing for grok", () => {
    const saved = process.env.XAI_API_KEY;
    delete process.env.XAI_API_KEY;
    expect(() => getProvider("grok")).toThrow(/XAI_API_KEY/);
    if (saved !== undefined) process.env.XAI_API_KEY = saved;
  });
});
