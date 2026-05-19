import { createGrokProvider } from "./grok";

jest.mock("openai", () => {
  return {
    __esModule: true,
    default: class FakeOpenAI {
      chat = {
        completions: {
          create: jest.fn(async function* () {
            yield { choices: [{ delta: { content: "Hello " } }] };
            yield { choices: [{ delta: { content: "from Grok" } }] };
          }),
        },
      };
      constructor(_opts: any) {}
    },
  };
});

describe("grok provider", () => {
  it("yields text chunks in order", async () => {
    const p = createGrokProvider({ apiKey: "test" });
    const out: string[] = [];
    for await (const ch of p.streamCompletion({
      model: "grok-4",
      messages: [{ role: "user", content: "hi" }],
      maxTokens: 50,
    })) {
      if (ch.type === "text") out.push(ch.text);
    }
    expect(out.join("")).toBe("Hello from Grok");
  });

  it("reports id as grok", () => {
    const p = createGrokProvider({ apiKey: "test" });
    expect(p.id).toBe("grok");
  });
});
