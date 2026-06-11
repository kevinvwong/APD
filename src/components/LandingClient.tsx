"use client";

import { SignInButton, SignUpButton } from "@clerk/nextjs";

export function LandingClient() {
  return (
    <div className="landing">
      {/* Top bar */}
      <div className="landing-top">
        <div className="landing-top-inner">
          <div className="landing-brand">
            <span className="seal" style={{ width: 36, height: 36 }}>
              APD
            </span>
            <div>
              <div className="landing-kicker">Army Publishing Directorate</div>
              <div className="landing-brand-name">Field Manual Library</div>
            </div>
          </div>
          <div className="landing-top-actions">
            <SignInButton mode="modal">
              <button className="landing-btn-ghost">Sign in</button>
            </SignInButton>
            <SignUpButton mode="modal">
              <button className="landing-btn">Get access</button>
            </SignUpButton>
          </div>
        </div>
      </div>

      {/* Hero */}
      <div className="landing-hero">
        <div className="landing-hero-inner">
          <div className="landing-eyebrow">
            51 active Field Manuals · doctrine search · AI research
          </div>
          <h1 className="landing-title">
            Read every Field Manual.
            <br />
            Ask anything.
            <br />
            Save what matters.
          </h1>
          <p className="landing-lede">
            A complete, searchable library of the U.S. Army&rsquo;s 51 active
            Field Manuals — paired with a doctrine research assistant that cites
            the exact section it&rsquo;s drawing from.
          </p>
          <div className="landing-cta">
            <SignUpButton mode="modal">
              <button className="landing-btn landing-btn-lg">
                Create your free account
              </button>
            </SignUpButton>
            <SignInButton mode="modal">
              <button className="landing-btn-ghost landing-btn-lg">
                Sign in
              </button>
            </SignInButton>
          </div>
          <p className="landing-fineprint">
            Free during preview. Sign in to save your research threads,
            bookmarks, and highlights across devices.
          </p>
        </div>
      </div>

      {/* Features */}
      <div className="landing-features">
        <div className="landing-features-inner">
          <FeatureCard
            icon="◰"
            title="Browse the complete library"
            body="Every active FM — Operations, Intelligence, Sustainment, and 48 more — searchable by number, title, or doctrine series. Read on any device with a clean, fast, parsed reader."
          />
          <FeatureCard
            icon="✦"
            title="Ask the doctrine assistant"
            body="Claude-powered research grounded only in the 51 manuals. Every claim cites a specific section so you can verify and dive deeper. Library-only mode for strict citations, or hybrid mode for broader context."
          />
          <FeatureCard
            icon="★"
            title="Build your personal library"
            body="Save chat threads, bookmark manuals, highlight passages in three colors, and star answers you want to find again. Everything syncs across devices and stays private to your account."
          />
        </div>
      </div>

      {/* How it works */}
      <div className="landing-how">
        <div className="landing-how-inner">
          <div className="landing-section-h">How it works</div>
          <ol className="landing-steps">
            <li>
              <span className="landing-step-num">1</span>
              <div>
                <strong>Sign up free</strong> with Google or email — no credit
                card.
              </div>
            </li>
            <li>
              <span className="landing-step-num">2</span>
              <div>
                <strong>Open any Field Manual</strong> from the catalog, or jump
                straight to the assistant with a research question.
              </div>
            </li>
            <li>
              <span className="landing-step-num">3</span>
              <div>
                <strong>Highlight, bookmark, save threads</strong> — your
                library follows you across devices.
              </div>
            </li>
          </ol>
        </div>
      </div>

      {/* Bottom CTA */}
      <div className="landing-bottom">
        <div className="landing-bottom-inner">
          <div className="landing-bottom-title">
            Ready to dig into doctrine?
          </div>
          <SignUpButton mode="modal">
            <button className="landing-btn landing-btn-lg">
              Create your free account
            </button>
          </SignUpButton>
        </div>
      </div>

      {/* Footer */}
      <div className="landing-foot">
        Field Manuals are public-domain U.S. government publications. This
        product is not affiliated with the U.S. Army.
      </div>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  body,
}: {
  icon: string;
  title: string;
  body: string;
}) {
  return (
    <div className="landing-feature">
      <div className="landing-feature-icon">{icon}</div>
      <div className="landing-feature-title">{title}</div>
      <p className="landing-feature-body">{body}</p>
    </div>
  );
}
