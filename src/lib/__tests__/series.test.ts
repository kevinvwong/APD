import { describe, it, expect } from "vitest";
import {
  deriveSeries,
  seriesLabel,
  parsePublicationDate,
  countChapters,
} from "../series";

describe("deriveSeries", () => {
  it.each([
    ["FM 3-0", "3"],
    ["FM 3-50", "3"],
    ["FM 1-02.2", "1"],
    ["FM 7-100", "7"],
    ["FM 6-02", "6"],
    ["FM 10-1", "10"],
  ])("%s -> %s", (fm, expected) => {
    expect(deriveSeries(fm)).toBe(expected);
  });

  it("returns '?' when there is no FM number", () => {
    expect(deriveSeries("some-stem")).toBe("?");
  });
});

describe("seriesLabel", () => {
  it("maps known series to a topic label", () => {
    expect(seriesLabel("3")).toBe("Operations & Tactics");
    expect(seriesLabel("6")).toBe("Command, Control & Signal");
  });

  it("falls back for unknown series", () => {
    expect(seriesLabel("9")).toBe("FM 9 Series");
  });
});

describe("parsePublicationDate", () => {
  it("parses 'DD Month YYYY'", () => {
    expect(parsePublicationDate("Washington, DC, 2 September 2014")).toBe("2014-09-02");
  });

  it("parses a bare 'MONTH YYYY' heading", () => {
    expect(parsePublicationDate("# FEBRUARY 2019\n\nbody")).toBe("2019-02-01");
  });

  it("only scans the top of the document", () => {
    const tail = "\n".repeat(300) + "January 1999";
    expect(parsePublicationDate(tail)).toBeNull();
  });

  it("returns null when no date is present", () => {
    expect(parsePublicationDate("no date here")).toBeNull();
  });
});

describe("countChapters", () => {
  it("counts distinct chapters from headings", () => {
    const md = [
      "## Chapter 1 Foundations",
      "### Chapter 1 (cross-ref in TOC)",
      "## Chapter 2 Operations",
      "## CHAPTER 3",
    ].join("\n");
    expect(countChapters(md)).toBe(3);
  });

  it("returns 0 when there are no chapter headings", () => {
    expect(countChapters("# Intro\n## Section I")).toBe(0);
  });
});
