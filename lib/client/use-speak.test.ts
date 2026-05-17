/**
 * @jest-environment jsdom
 */
import { extractSentences } from "./use-speak";

describe("extractSentences", () => {
  it("returns no sentences for an unfinished string", () => {
    const { sentences, rest } = extractSentences("Hello there");
    expect(sentences).toEqual([]);
    expect(rest).toBe("Hello there");
  });

  it("splits on . ! ? followed by space", () => {
    const { sentences, rest } = extractSentences("One. Two! Three? leftover");
    expect(sentences).toEqual(["One.", "Two!", "Three?"]);
    expect(rest).toBe("leftover");
  });

  it("keeps a trailing fragment as rest", () => {
    const { sentences, rest } = extractSentences("One. Two");
    expect(sentences).toEqual(["One."]);
    expect(rest).toBe("Two");
  });
});
