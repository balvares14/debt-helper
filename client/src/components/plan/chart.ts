/**
 * Shared geometry and colors for the plan charts so the balance lines and
 * the interest bars read as the same instrument.
 */

import { monthKeyOf, shortMonth, shortMonthYear } from "@/lib/format";

export const PALETTE = [
  "#4fa855",
  "#dc2626",
  "#0284c7",
  "#d97706",
  "#3d8644",
  "#7c3aed",
  "#db2777",
  "#0d9488",
  "#ea580c",
  "#65a30d",
];

export const WIDTH = 760;
export const PAD = { top: 12, right: 10, bottom: 32, left: 44 };

export const DEFAULT_BALANCE_MAX = 25000;
export const BALANCE_MAX_PRESETS = [5000, 10000, 25000, 50000, 100000];

export function colorFor(index: number): string {
  return PALETTE[index % PALETTE.length];
}

export function xAt(index: number, count: number, width = WIDTH, pad = PAD): number {
  const inner = width - pad.left - pad.right;
  if (count <= 1) return pad.left + inner / 2;
  return pad.left + (index / (count - 1)) * inner;
}

export function yAt(value: number, max: number, height: number, pad = PAD): number {
  const inner = height - pad.top - pad.bottom;
  const clamped = Math.min(Math.max(value, 0), max);
  return pad.top + inner - (clamped / max) * inner;
}

export function niceMax(value: number): number {
  if (value <= 0) return 100;
  const padded = value * 1.12;
  const magnitude = 10 ** Math.floor(Math.log10(padded));
  const normalized = padded / magnitude;
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return step * magnitude;
}

export function yTicks(max: number, count = 5): number[] {
  return Array.from({ length: count + 1 }, (_, i) => (max * i) / count);
}

/** One short label per month, with the year on January and the first tick. */
export function monthLabels(
  dates: string[],
  width = WIDTH,
  pad = PAD,
): Array<{ index: number; label: string }> {
  if (dates.length === 0) return [];

  const labels: Array<{ index: number; label: string }> = [];
  let lastMonth = "";

  dates.forEach((date, index) => {
    const key = monthKeyOf(date);
    if (key === lastMonth) return;
    lastMonth = key;

    const monthNum = Number(key.slice(5, 7));
    const withYear = labels.length === 0 || monthNum === 1;
    labels.push({
      index,
      label: withYear ? shortMonthYear(key) : shortMonth(key),
    });
  });

  const last = dates.length - 1;
  if (labels[labels.length - 1]?.index !== last) {
    const key = monthKeyOf(dates[last]);
    labels.push({
      index: last,
      label: Number(key.slice(5, 7)) === 1 || labels.length === 0
        ? shortMonthYear(key)
        : shortMonth(key),
    });
  }

  // Keep as many months as will fit. ~28px is enough for "Sep".
  return labels.filter((label, i, all) => {
    if (i === 0 || i === all.length - 1) return true;
    const x = xAt(label.index, dates.length, width, pad);
    const prev = xAt(all[i - 1].index, dates.length, width, pad);
    const next = xAt(all[i + 1].index, dates.length, width, pad);
    return x - prev > 26 && next - x > 26;
  });
}

export function monthKeyLabels(
  months: string[],
  width = WIDTH,
  pad = PAD,
): Array<{ index: number; label: string }> {
  return monthLabels(
    months.map((key) => `${key}-01`),
    width,
    pad,
  );
}
