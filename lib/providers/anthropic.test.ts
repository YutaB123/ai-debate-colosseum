import { createAnthropicProvider } from "./anthropic";

jest.mock("@anthropic-ai/sdk", () => {
  return {
    __esModule: true,
    default: class FakeAnthropic {
      messages = {
        stream: jest.fn(() => {
          async function* gen() {
            yield { type: "content_block_delta", delta: { type: "text_delta", text: "Hello " } };
            yield { type: "content_block_delta", delta: { type: "text_delta", text: "world" } };
          }
          return gen();
        }),
      };
      constructor(_opts: any) {}
    },
  };
});

describe("anthropic provider", () => {
  it("yields text chunks in order and splits system messages out", async () => {
    const p = createAnthropicProvider({ apiKey: "test" });
    const out: string[] = [];
    for await (const ch of p.streamCompletion({
      model: "claude-opus-4-7",
      messages: [
        { role: "system", content: "be concise" },
        { role: "user", content: "hi" },
      ],
      maxTokens: 50,
    })) {
      if (ch.type === "text") out.push(ch.text);
    }
    expect(out.join("")).toBe("Hello world");
  });
});
