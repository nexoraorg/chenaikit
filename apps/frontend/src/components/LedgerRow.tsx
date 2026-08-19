import React from "react";

export function LedgerRow({
  glyph,
  name,
  description,
  status,
}: {
  glyph: string;
  name: string;
  description: string;
  status: React.ReactNode;
}) {
  return (
    <div className="ledger-row">
      <div className="glyph">{glyph}</div>
      <div>
        <p className="feat-name">{name}</p>
        <p className="feat-desc">{description}</p>
      </div>
      <div className="status">{status}</div>
    </div>
  );
}
