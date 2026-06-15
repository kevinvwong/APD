// scripts/book-convert.test.ts
// Unit tests for the pure text -> Markdown converters in ./book-convert.
// Run with: npm test  (node --import tsx --test scripts/*.test.ts)

import test from "node:test";
import assert from "node:assert/strict";
import {
  decodeEntities,
  stripGutenberg,
  htmlToMarkdown,
  plainTextToMarkdown,
} from "./book-convert";

test("decodeEntities handles named and numeric entities", () => {
  assert.equal(decodeEntities("Smith &amp; Jones"), "Smith & Jones");
  assert.equal(decodeEntities("a &mdash; b"), "a — b");
  // numeric (right single quote U+2019)
  assert.equal(decodeEntities("it&#8217;s"), "it’s");
  // unknown named entity is left intact
  assert.equal(decodeEntities("&zzz;"), "&zzz;");
});

test("stripGutenberg removes header/footer and keeps the body", () => {
  const input = [
    "The Project Gutenberg eBook of Something",
    "license boilerplate here",
    "*** START OF THE PROJECT GUTENBERG EBOOK SOMETHING ***",
    "",
    "Real body line one.",
    "Real body line two.",
    "",
    "*** END OF THE PROJECT GUTENBERG EBOOK SOMETHING ***",
    "trailing license footer",
  ].join("\n");
  const out = stripGutenberg(input);
  assert.ok(out.includes("Real body line one."));
  assert.ok(out.includes("Real body line two."));
  assert.ok(!out.includes("license boilerplate"));
  assert.ok(!out.includes("trailing license footer"));
  assert.ok(!out.includes("START OF THE PROJECT GUTENBERG"));
  assert.ok(!out.includes("END OF THE PROJECT GUTENBERG"));
});

test("stripGutenberg tolerates marker without spaces and a leading BOM", () => {
  const input =
    "﻿preamble\n***START OF THIS PROJECT GUTENBERG EBOOK FOO***\nbody\n***END OF THIS PROJECT GUTENBERG EBOOK FOO***\nfooter";
  const out = stripGutenberg(input);
  assert.equal(out, "body");
});

test("stripGutenberg returns whole (trimmed) text when no markers present", () => {
  assert.equal(stripGutenberg("  just a plain body  "), "just a plain body");
});

test("htmlToMarkdown converts h1-h3 to #/##/###", () => {
  const html =
    "<body><h1>Title</h1><h2>Sub</h2><h3>Subsub</h3></body>";
  const out = htmlToMarkdown(html);
  assert.ok(out.includes("# Title"));
  assert.ok(out.includes("## Sub"));
  assert.ok(out.includes("### Subsub"));
});

test("htmlToMarkdown converts <p> to paragraphs and <li> to '- '", () => {
  const html = "<p>First para.</p><p>Second para.</p><ul><li>one</li><li>two</li></ul>";
  const out = htmlToMarkdown(html);
  assert.match(out, /First para\.\n\nSecond para\./);
  assert.ok(out.includes("- one"));
  assert.ok(out.includes("- two"));
});

test("htmlToMarkdown decodes entities and strips scripts + comments", () => {
  const html =
    "<body><script>var x = 1 < 2;</script><!-- hidden comment --><p>Smith &amp; Co &mdash; it&#8217;s fine</p></body>";
  const out = htmlToMarkdown(html);
  assert.ok(out.includes("Smith & Co — it’s fine"));
  assert.ok(!out.includes("var x"));
  assert.ok(!out.includes("hidden comment"));
});

test("plainTextToMarkdown promotes 'CHAPTER I' and short ALL-CAPS lines to headings", () => {
  const raw = [
    "CHAPTER I",
    "",
    "INTRODUCTION",
    "",
    "This is the opening paragraph of the chapter.",
  ].join("\n");
  const out = plainTextToMarkdown(raw);
  assert.ok(out.includes("## CHAPTER I"));
  assert.ok(out.includes("## INTRODUCTION"));
  assert.ok(out.includes("This is the opening paragraph of the chapter."));
});

test("plainTextToMarkdown joins wrapped paragraph lines into one", () => {
  const raw = "This sentence is\nwrapped across\nthree lines.";
  const out = plainTextToMarkdown(raw);
  assert.equal(out, "This sentence is wrapped across three lines.");
});

test("plainTextToMarkdown normalizes CRLF and strips a leading BOM", () => {
  const raw = "﻿CHAPTER II\r\n\r\nA body line.\r\n";
  const out = plainTextToMarkdown(raw);
  assert.ok(out.startsWith("## CHAPTER II"));
  assert.ok(out.includes("A body line."));
  assert.ok(!out.includes("\r"));
  assert.ok(!out.includes("﻿"));
});
