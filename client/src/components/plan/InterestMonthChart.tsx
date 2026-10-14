/**
 * Interest charged each month, stacked by debt.
 *
 * Same colors as the balance chart. Once a debt is gone, its slice is $0 —
 * the stack shrinks and eventually sits on the axis.
 */

import { useMemo, useRef, useState, type MouseEvent } from "react";
import { clsx } from "clsx";

import { PAD, WIDTH, colorFor, monthKeyLabels, niceMax, xAt, yAt, yTicks } from "./chart";
import { money, moneyCompact, monthLabel, shortMonthYear } from "@/lib/format";
import type { InterestSeries } from "@/lib/planApi";

const HEIGHT = 280;

export interface InterestMonthChartProps {
  series: InterestSeries;
}

export default function InterestMonthChart({ series }: InterestMonthChartProps) {
  const [hidden, setHidden] = useState<Set<number>>(new Set());
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const totals = useMemo(
    () =>
      series.months.map((_, index) =>
        series.series.reduce((sum, line) => (hidden.has(line.id) ? sum : sum + (line.amounts[index] ?? 0)), 0),
      ),
    [series, hidden],
  );

  const max = useMemo(() => niceMax(Math.max(0, ...totals)), [totals]);
  const labels = useMemo(() => monthKeyLabels(series.months), [series.months]);
  const ticks = useMemo(() => yTicks(max, 4), [max]);

  if (series.months.length === 0 || series.series.length === 0) {
    return (
      <p className="text-[0.6875rem] text-ink-faint">
        Interest shows up here once a debt is accruing under the plan.
      </p>
    );
  }

  const inner = WIDTH - PAD.left - PAD.right;
  const slot = series.months.length > 0 ? inner / series.months.length : inner;
  const barWidth = Math.max(4, Math.min(22, slot * 0.62));

  const onMove = (event: MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg || series.months.length === 0) return;
    const rect = svg.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * WIDTH;
    const ratio = Math.min(1, Math.max(0, (x - PAD.left) / inner));
    const index = Math.min(series.months.length - 1, Math.round(ratio * (series.months.length - 1)));
    setHover(index);
  };

  const barX = (index: number) => xAt(index, series.months.length) - barWidth / 2;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5">
        {series.series.map((line, index) => {
          const active = !hidden.has(line.id);
          return (
            <button
              key={line.id}
              type="button"
              onClick={() =>
                setHidden((current) => {
                  const next = new Set(current);
                  if (next.has(line.id)) next.delete(line.id);
                  else next.add(line.id);
                  return next;
                })
              }
              aria-pressed={active}
              className={clsx(
                "flex items-center gap-1.5 rounded-pill border px-2 py-0.5 text-[0.6875rem] font-medium transition-opacity",
                active
                  ? "border-line bg-surface-1 text-ink"
                  : "border-line bg-surface-2 text-ink-faint opacity-50",
              )}
            >
              <span className="h-1.5 w-3 rounded-pill" style={{ background: colorFor(index) }} />
              {line.name}
            </button>
          );
        })}
      </div>

      <div className="relative">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          role="img"
          aria-label="Interest charged each month, stacked by debt"
          className="h-auto w-full"
          onMouseMove={onMove}
          onMouseLeave={() => setHover(null)}
        >
          {ticks.map((tick) => (
            <g key={tick}>
              <line
                x1={PAD.left}
                x2={WIDTH - PAD.right}
                y1={yAt(tick, max, HEIGHT)}
                y2={yAt(tick, max, HEIGHT)}
                stroke="var(--line)"
                strokeWidth="1"
              />
              <text
                x={PAD.left - 6}
                y={yAt(tick, max, HEIGHT) + 3}
                textAnchor="end"
                fill="var(--ink-faint)"
                fontSize="9"
              >
                {moneyCompact(tick)}
              </text>
            </g>
          ))}

          {labels.map((label) => (
            <text
              key={`${label.index}-${label.label}`}
              x={xAt(label.index, series.months.length)}
              y={HEIGHT - 8}
              textAnchor="middle"
              fill="var(--ink-faint)"
              fontSize="9"
            >
              {label.label}
            </text>
          ))}

          {series.months.map((_, monthIndex) => {
            let stacked = 0;
            return series.series.map((line, seriesIndex) => {
              if (hidden.has(line.id)) return null;
              const amount = line.amounts[monthIndex] ?? 0;
              if (amount <= 0) return null;
              const y0 = yAt(stacked, max, HEIGHT);
              stacked += amount;
              const y1 = yAt(stacked, max, HEIGHT);
              return (
                <rect
                  key={`${line.id}-${monthIndex}`}
                  x={barX(monthIndex)}
                  y={y1}
                  width={barWidth}
                  height={Math.max(0.5, y0 - y1)}
                  fill={colorFor(seriesIndex)}
                  opacity={hover === null || hover === monthIndex ? 1 : 0.35}
                />
              );
            });
          })}
        </svg>

        {hover !== null && series.months[hover] && (
          <div
            className="pointer-events-none absolute top-2 z-10 min-w-[9.5rem] rounded-xs border border-line bg-surface-1 px-2 py-1.5 shadow-elev-2"
            style={{
              left: `${Math.min(70, Math.max(6, (xAt(hover, series.months.length) / WIDTH) * 100 - 6))}%`,
            }}
          >
            <p className="text-[0.625rem] font-medium text-ink-muted">
              {monthLabel(`${series.months[hover]}-01`)}
            </p>
            {series.series.map((line, index) =>
              hidden.has(line.id) ? null : (
                <p key={line.id} className="flex items-baseline justify-between gap-3 text-[0.6875rem]">
                  <span className="flex items-center gap-1.5 text-ink">
                    <span
                      className="inline-block h-1.5 w-1.5 rounded-pill"
                      style={{ background: colorFor(index) }}
                    />
                    {line.name}
                  </span>
                  <span className="tabular-nums font-medium text-ink">
                    {money(line.amounts[hover] ?? 0)}
                  </span>
                </p>
              ),
            )}
            <p className="mt-0.5 flex items-baseline justify-between gap-3 border-t border-line-soft pt-0.5 text-[0.6875rem] font-semibold text-ink">
              <span>Total</span>
              <span className="tabular-nums">{money(totals[hover] ?? 0)}</span>
            </p>
          </div>
        )}
      </div>

      {series.months.length > 0 && (
        <p className="text-[0.625rem] text-ink-faint">
          Charged on each due date. After {shortMonthYear(series.months[series.months.length - 1])} the
          stack should sit at $0 if everything is paid off.
        </p>
      )}
    </div>
  );
}
