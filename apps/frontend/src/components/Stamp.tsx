import React from "react";

type StampColor = "red" | "blue";

export function Stamp({
  children,
  color = "red",
  faded = false,
}: {
  children: React.ReactNode;
  color?: StampColor;
  faded?: boolean;
}) {
  return (
    <span className={`stamp ${color}${faded ? " faded" : ""}`}>
      {children}
    </span>
  );
}
