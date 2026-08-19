import React from "react";
import { Stamp } from "../components/Stamp";
import { LedgerRow } from "../components/LedgerRow";

const FEATURES = [
  {
    glyph: "🧠",
    name: "AI integrations",
    description:
      "Ready-to-use wrappers for credit scoring and fraud detection — call a model, get a decision, keep going.",
    status: <Stamp color="blue">Core</Stamp>,
  },
  {
    glyph: "🔗",
    name: "Blockchain connectors",
    description:
      "Simple APIs for Stellar Horizon and Soroban contracts — no separate SDK to learn just to read a ledger entry.",
    status: <Stamp color="blue">Core</Stamp>,
  },
  {
    glyph: "⚙️",
    name: "TypeScript SDK",
    description:
      "Strongly typed, easy to extend, and runs the same in Node and the browser.",
    status: (
      <Stamp color="blue" faded>
        Core
      </Stamp>
    ),
  },
  {
    glyph: "🛠️",
    name: "Examples & templates",
    description:
      "Working starting points so you're editing a running app on day one, not staring at a blank folder.",
    status: (
      <Stamp color="red" faded>
        Extra
      </Stamp>
    ),
  },
  {
    glyph: "🎯",
    name: "CLI tools",
    description:
      "A command line for the operations you'll run over and over — scaffold, deploy, verify.",
    status: (
      <Stamp color="red" faded>
        Extra
      </Stamp>
    ),
  },
  {
    glyph: "📊",
    name: "Smart contracts",
    description:
      "Pre-built Soroban contracts for the use cases in this kit, ready to deploy or fork.",
    status: <Stamp color="red">Contracts</Stamp>,
  },
];

const CONTRACTS = [
  "credit-score",
  "fraud-detect",
  "governance",
  "oracle-network",
  "model-attestation",
  "common-utils",
];

export function Landing() {
  return (
    <div className="wrap">
      <header className="hero">
        <div className="eyebrow-row">
          <span>LEDGER No. 001 — TYPESCRIPT SDK</span>
          <span className="line" />
          <span>STELLAR / SOROBAN</span>
        </div>
        <h1 className="title">
          Wire AI into
          <br />
          the <span className="accent">ledger</span>.
        </h1>
        <p className="lede">
          chenaikit is a TypeScript toolkit for building AI-powered
          blockchain applications. Add credit scoring, fraud detection, and
          smart decisioning to your app without hand-rolling the plumbing
          between your model and the chain.
        </p>
        <div className="hero-actions">
          <a className="btn primary" href="#features">
            See what's inside
          </a>
          <a className="btn ghost" href="#contracts">
            Browse contracts
          </a>
        </div>
        <div className="install-row">
          <span className="cmd">npm install @chenaikit/core</span>
          <button
            onClick={() =>
              navigator.clipboard?.writeText("npm install @chenaikit/core")
            }
          >
            COPY
          </button>
        </div>
      </header>

      <section className="section" id="features">
        <div className="section-head">
          <h2>What's inside</h2>
          <span className="tag">{FEATURES.length} line items</span>
        </div>
        {FEATURES.map((f) => (
          <LedgerRow key={f.name} {...f} />
        ))}
      </section>

      <section className="section" id="code">
        <div className="section-head">
          <h2>Score, then decide</h2>
          <span className="tag">example</span>
        </div>
        <div className="two-col" style={{ marginTop: 24 }}>
          <div className="code-card">
            <div className="code-head">
              <span>credit-score.ts</span>
              <span>TS</span>
            </div>
            <pre>
              <span className="c-kw">import</span> {"{ ChenAI }"}{" "}
              <span className="c-kw">from</span>{" "}
              <span className="c-str">"@chenaikit/core"</span>;
              {"\n\n"}
              <span className="c-kw">const</span> ai ={" "}
              <span className="c-kw">new</span>{" "}
              <span className="c-fn">ChenAI</span>(
              {"{ network: "}
              <span className="c-str">"stellar-testnet"</span>
              {" }"});{"\n\n"}
              <span className="c-com">
                {"// pull an account's on-chain history"}
              </span>
              {"\n"}
              <span className="c-kw">const</span> account ={" "}
              <span className="c-kw">await</span> ai.horizon.
              <span className="c-fn">getAccount</span>(pubKey);{"\n\n"}
              <span className="c-com">
                {"// run it through the credit-score model"}
              </span>
              {"\n"}
              <span className="c-kw">const</span> result ={" "}
              <span className="c-kw">await</span> ai.creditScore.
              <span className="c-fn">evaluate</span>(account);{"\n\n"}
              <span className="c-fn">console</span>.log(result.score,
              result.decision);
              {"\n"}
              <span className="c-com">{'// 742  "approved"'}</span>
            </pre>
          </div>
          <div>
            <p className="panel-title">What just happened</p>
            <p style={{ color: "var(--ink-soft)", lineHeight: 1.65, fontSize: 14.5 }}>
              <code style={{ fontFamily: "var(--mono-data)" }}>
                ai.horizon.getAccount()
              </code>{" "}
              reads the account's real transaction history from Stellar.{" "}
              <code style={{ fontFamily: "var(--mono-data)" }}>
                ai.creditScore.evaluate()
              </code>{" "}
              hands that history to the bundled model and returns a score
              plus a plain-language decision — no separate pipeline to stand
              up.
            </p>
            <p style={{ color: "var(--ink-soft)", lineHeight: 1.65, fontSize: 14.5 }}>
              Swap{" "}
              <code style={{ fontFamily: "var(--mono-data)" }}>
                creditScore
              </code>{" "}
              for{" "}
              <code style={{ fontFamily: "var(--mono-data)" }}>
                fraudDetect
              </code>{" "}
              to run the same account through anomaly checks instead.
            </p>
          </div>
        </div>
      </section>

      <section className="section" id="contracts">
        <div className="section-head">
          <h2>Pre-built contracts</h2>
          <span className="tag">soroban</span>
        </div>
        <p style={{ color: "var(--ink-soft)", maxWidth: 560, marginTop: 18 }}>
          Six audited-scope contracts cover the common cases so you're not
          writing Soroban from scratch.
        </p>
        <div className="chip-row">
          {CONTRACTS.map((c) => (
            <span className="chip" key={c}>
              {c}
            </span>
          ))}
        </div>
      </section>

      <footer>
        <div className="foot-left">
          chenaikit — open source, MIT licensed.
          <br />
          Built for developers building on Stellar.
        </div>
        <Stamp color="red">Open Source</Stamp>
      </footer>
    </div>
  );
}
