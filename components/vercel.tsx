"use client";

import { useState } from "react";
import type { Metadata } from "next";

function generateId(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  const regions = ["lhr1", "iad1", "sfo1", "fra1", "sin1"];
  const region = regions[Math.floor(Math.random() * regions.length)];
  const part1 = Array.from(
    { length: 2 },
    () => chars[Math.floor(Math.random() * chars.length)],
  ).join("");
  const part2 = Array.from(
    { length: 2 },
    () => chars[Math.floor(Math.random() * chars.length)],
  ).join("");
  const numeric = Math.floor(Math.random() * 9e15)
    .toString()
    .padStart(16, "0");
  const hex = Array.from({ length: 8 }, () =>
    Math.floor(Math.random() * 16).toString(16),
  ).join("");

  return `${region}::${part1}${part2}r-${numeric}-${hex}`;
}

export const metadata: Metadata = {
  title: "Deployment Paused",
  description: "This deployment is temporarily paused",
};
export default function DeploymentPaused() {
  const [deploymentId] = useState<string>(() => generateId());

  return (
    <div className="relative min-h-screen w-full bg-black flex items-center justify-center">
      <p
        className="text-white/90 text-xl font-normal"
        style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}
      >
        This deployment is temporarily paused
      </p>

      <span
        className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/50 text-[12px] whitespace-nowrap"
        style={{ fontFamily: "Menlo, Monaco, 'Courier New', monospace" }}
      >
        {deploymentId}
      </span>
    </div>
  );
}
