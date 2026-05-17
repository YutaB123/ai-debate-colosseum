import { createGeminiProvider } from "./gemini";

jest.mock("@google/generative-ai", () => {
  return {
    GoogleGenerativeAI: class {
      constructor(_key: string) {}
      getGenerativeModel() {
        return {
          generateContentStream: async () => ({
            stream: (async function* () {
              yield { text: () => "Hello " };
              yield { text: () => "world" };
            })(),
          }),
        };
      }
    },
  };
});

describe("gemini provider", () => {
  it("yields text chunks in order", async () => {
    const p = createGeminiProvider({ apiKey: "test" });
    const out: string[] = [];
    for await (const ch of p.streamCompletion({
      model: "gemini-1.5-pro",
      messages: [{ role: "user", content: "hi" }],
      maxTokens: 50,
    })) {
      if (ch.type === "text") out.push(ch.text);
    }
    expect(out.join("")).toBe("Hello world");
  });
});
