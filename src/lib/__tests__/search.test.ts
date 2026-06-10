import { describe, it, expect } from "vitest";
import { headlineToHtml } from "../search";

const START = "⟦⟦";
const STOP = "⟧⟧";

describe("headlineToHtml", () => {
  it("replaces sentinels with <mark> tags", () => {
    const { html, hasMatch } = headlineToHtml(`see ${START}personnel${STOP} recovery`);
    expect(hasMatch).toBe(true);
    expect(html).toBe("see <mark>personnel</mark> recovery");
  });

  it("escapes HTML metacharacters in the surrounding raw-markdown text", () => {
    const { html } = headlineToHtml(`a < b && c > d "x" 'y'`);
    expect(html).toBe("a &lt; b &amp;&amp; c &gt; d &quot;x&quot; &#39;y&#39;");
    expect(html).not.toContain("<b");
  });

  it("does not let injected HTML through even around a highlight", () => {
    const { html } = headlineToHtml(`${START}<script>alert(1)</script>${STOP}`);
    expect(html).toBe("<mark>&lt;script&gt;alert(1)&lt;/script&gt;</mark>");
  });

  it("reports hasMatch=false when there is nothing to highlight", () => {
    const { html, hasMatch } = headlineToHtml("just the opening words of a manual");
    expect(hasMatch).toBe(false);
    expect(html).not.toContain("<mark>");
  });
});
