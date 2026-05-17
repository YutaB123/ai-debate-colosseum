import { openDb } from "./connection";

describe("db connection", () => {
  it("creates all tables in a fresh in-memory db", () => {
    const db = openDb(":memory:");
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all()
      .map((r: any) => r.name);
    expect(tables).toEqual(
      expect.arrayContaining([
        "debates", "debaters", "teams", "rounds",
        "speeches", "whispers", "interjections", "votes", "verdicts",
      ])
    );
  });
});
