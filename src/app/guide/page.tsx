// src/app/guide/page.tsx — In-app user guide (public). Renders docs/USER_GUIDE.md.
import fs from "fs";
import path from "path";
import Link from "next/link";
import { GuideDoc } from "@/components/GuideDoc";

export const metadata = {
  title: "User Guide — Army Doctrine Assistant",
  description:
    "How to browse the Field Manual library, read manuals, and use the Ask assistant.",
};

function loadGuide(): string {
  try {
    return fs.readFileSync(
      path.join(process.cwd(), "docs", "USER_GUIDE.md"),
      "utf-8",
    );
  } catch {
    return "";
  }
}

export default function GuidePage() {
  const md = loadGuide();
  return (
    <div className="app">
      <div className="masthead">
        <Link href="/" className="seal" style={{ textDecoration: "none" }}>
          APD
        </Link>
        <div style={{ flex: 1 }}>
          <div className="mast-kicker">Army Publishing Directorate</div>
          <div className="mast-title">User Guide</div>
        </div>
        <Link
          href="/"
          className="chip"
          style={{ background: "transparent", textDecoration: "none" }}
        >
          ‹ Home
        </Link>
      </div>

      <div className="guide-scroll scroll">
        {md ? (
          <GuideDoc markdown={md} />
        ) : (
          <div className="guide-doc">
            <p>
              The guide couldn&rsquo;t be loaded here. Read it on{" "}
              <a
                href="https://github.com/kevinvwong/APD/blob/master/docs/USER_GUIDE.md"
                target="_blank"
                rel="noreferrer"
              >
                GitHub
              </a>
              .
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
