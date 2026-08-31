import React from "react";
import { motion } from "../design/tokens";

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
    <span
      className={`stamp ${color}${faded ? " faded" : ""}`}
      style={{ transition: `opacity ${motion.duration.fast} ${motion.easing.out}` }}
    >
      {children}
    </span>
  );
}
