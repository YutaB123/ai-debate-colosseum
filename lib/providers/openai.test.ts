import { createOpenAIProvider } from "./openai";

// Mock the OpenAI SDK
jest.mock("openai", () => {
  return {
    __esModule: true,
    default: class FakeOpenAI {
      chat = {
        completions: {
          create: jest.fn(async function* () {
            yield { choices: [{ delta: { content: "Hello " } }] };
            yield { choices: [{ delta: { content: "world" } }] };
          }),
        },
      };
      constructor(_opts: any) {}
    },
  };
});

describe("openai provider", () => {
  it("yields text chunks in order", async () => {
    const p = createOpenAIProvider({ apiKey: "test" });
    const out: string[] = [];
    for await (const ch of p.streamCompletion({
      model: "gpt-4o",
      messages: [{ role: "user", content: "hi" }],
      maxTokens: 50,
    })) {
      if (ch.type === "text") out.push(ch.text);
    }
    expect(out.join("")).toBe("Hello world");
  });
});
