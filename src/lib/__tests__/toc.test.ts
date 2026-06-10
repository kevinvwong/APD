import { describe, it, expect } from "vitest";
import GithubSlugger from "github-slugger";
import { extractToc } from "../toc";

describe("extractToc", () => {
  it("extracts H1–H3 with depth, text, and slug", () => {
    const md = [
      "## Chapter 1 Operations",
      "some text",
      "### Section I Fundamentals",
      "# Annex A",
    ].join("\n");
    expect(extractToc(md)).toEqual([
      { depth: 2, text: "Chapter 1 Operations", slug: "chapter-1-operations" },
      { depth: 3, text: "Section I Fundamentals", slug: "section-i-fundamentals" },
      { depth: 1, text: "Annex A", slug: "annex-a" },
    ]);
  });

  it("filters front-matter boilerplate (FM number, dates, distribution, HQ)", () => {
    const md = [
      "# FM 3-13.4",
      "# SEPTEMBER 2014",
      "# DISTRIBUTION RESTRICTION: Approved for public release",
      "# HEADQUARTERS, DEPARTMENT OF THE ARMY",
      "## Real Chapter",
    ].join("\n");
    expect(extractToc(md).map((e) => e.text)).toEqual(["Real Chapter"]);
  });

  it("numbers duplicate headings the same way rehype-slug does", () => {
    const md = ["## Section I", "## Section I", "## Section I"].join("\n");
    const slugs = extractToc(md).map((e) => e.slug);
    // Mirror github-slugger's stateful numbering for the same input sequence.
    const ref = new GithubSlugger();
    expect(slugs).toEqual(["Section I", "Section I", "Section I"].map((t) => ref.slug(t)));
    expect(slugs).toEqual(["section-i", "section-i-1", "section-i-2"]);
  });

  it("strips inline markdown from heading text", () => {
    expect(extractToc("## **Bold** and `code`")[0]).toEqual({
      depth: 2,
      text: "Bold and code",
      slug: "bold-and-code",
    });
  });

  it("ignores headings inside fenced code blocks", () => {
    const md = ["## Real", "```", "# not a heading", "```", "## Also Real"].join("\n");
    expect(extractToc(md).map((e) => e.text)).toEqual(["Real", "Also Real"]);
  });

  it("ignores H4+ and non-heading lines", () => {
    expect(extractToc("#### Too Deep\nplain line\n##### Deeper")).toEqual([]);
  });

  it("drops headings with no sluggable text (e.g. a lone arrow)", () => {
    expect(extractToc("## →\n## Real")).toEqual([
      { depth: 2, text: "Real", slug: "real" },
    ]);
  });
});
