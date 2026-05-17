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
});
