import { describe, it, expect } from "vitest";
import { parseFmNumber, parseTitleFromContent } from "../fm";

describe("parseFmNumber", () => {
  // Covers every filename convention present in fm-md/.
  const cases: [string, string][] = [
    ["ARN43326-FM_3-0-000-WEB-1.md", "FM 3-0"],
    ["NOCASE-FM_3-07-000-WEB-0.md", "FM 3-07"],
    ["FM 3-13 FINAL WEB.md", "FM 3-13"],
    ["fm3_50.md", "FM 3-50"],
    ["fm7_100x1.md", "FM 7-100"],
    ["ARN44621-FM_1-02.2-001-WEB-3.md", "FM 1-02.2"],
    ["ARN46659-FM_1-02.1-000-WEB-1.md", "FM 1-02.1"],
    ["ARN35838-FM_3-01.44-000-WEB-1.md", "FM 3-01.44"],
    ["ARN19185_FM 6-02_FINAL_WEB.md", "FM 6-02"],
  ];

  it.each(cases)("%s -> %s", (filename, expected) => {
    expect(parseFmNumber(filename)).toBe(expected);
  });

  it("strips the .md extension and tolerates a full path", () => {
    expect(parseFmNumber("/some/dir/ARN43326-FM_3-0-000-WEB-1.md")).toBe("FM 3-0");
  });

  it("falls back to the stem when no FM pattern is found", () => {
    expect(parseFmNumber("random-document.md")).toBe("random-document");
  });
});

describe("parseTitleFromContent", () => {
  it("returns the first non-empty line after an '# FM X-Y' heading", () => {
    const md = ["# FM 3-0", "", "**Operations**", "", "body text"].join("\n");
    expect(parseTitleFromContent(md, "fallback")).toBe("Operations");
  });

  it("grabs the first real H1 title when there is no FM heading first", () => {
    const md = ["# Army Support to Military Deception", "", "intro"].join("\n");
    expect(parseTitleFromContent(md, "fallback")).toBe("Army Support to Military Deception");
  });

  it("returns the fallback when nothing suitable is found", () => {
    expect(parseTitleFromContent("plain text with no headings", "FM 9-99")).toBe("FM 9-99");
  });
});
