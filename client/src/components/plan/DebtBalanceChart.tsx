/**
 * Debt balances over the life of the plan.
 *
 * One line per debt. The Y scale is a control (default $25k) so a large loan
 * does not squash the cards, and month ticks stay dense on the X axis.
 */

import { useMemo, useRef, useState, type MouseEvent } from "react";
import { clsx } from "clsx";

import {
  BALANCE_MAX_PRESETS,
  DEFAULT_BALANCE_MAX,
  PAD,
  WIDTH,
  colorFor,
  monthLabels,
  xAt,
  yAt,
  yTicks,
} from "./chart";
import { mediumDate, money, moneyCompact } from "@/lib/format";
import type { DebtSeries, ProjectedDebt } from "@/lib/planApi";

const HEIGHT = 420;

export interface DebtBalanceChartProps {
  series: DebtSeries;
  debts: ProjectedDebt[];
}

function toPolyline(balances: number[], max: number): string {
  return balances
    .map((balance, index) => `${xAt(index, balances.length).toFixed(1)},${yAt(balance, max, HEIGHT).toFixed(1)}`)
    .join(" ");
}

export default function DebtBalanceChart({ series, debts }: DebtBalanceChartProps) {
  const [hidden, setHidden] = useState<Set<number>>(new Set());
  const [hover, setHover] = useState<number | null>(null);
  const [yMax, setYMax] = useState(DEFAULT_BALANCE_MAX);
  const svgRef = useRef<SVGSVGElement>(null);

  const payoffById = useMemo(
    () => new Map(debts.map((debt) => [debt.id, debt.paidOffDate])),
    [debts],
  );

  const max = Math.max(1000, yMax);
  const labels = useMemo(() => monthLabels(series.dates), [series.dates]);
  const ticks = useMemo(() => yTicks(max), [max]);

  const clipped = series.series.some(
    (line) => !hidden.has(line.id) && line.balances.some((balance) => balance > max),
  );

  if (series.dates.length === 0 || series.series.length === 0) {
    return (
      <p className="text-[0.6875rem] text-ink-faint">
        Add a debt to see how its balance moves under this plan.
      </p>
    );
  }

  const onMove = (event: MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg || series.dates.length === 0) return;
    const rect = svg.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * WIDTH;
    const inner = WIDTH - PAD.left - PAD.right;
    const ratio = Math.min(1, Math.max(0, (x - PAD.left) / inner));
    const index = Math.round(ratio * (series.dates.length - 1));
    setHover(index);
  };

  const hoverX = hover === null ? null : xAt(hover, series.dates.length);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {series.series.map((line, index) => {
            const active = !hidden.has(line.id);
            const paidOff = payoffById.get(line.id);
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
                {paidOff && <span className="text-ink-faint">{mediumDate(paidOff)}</span>}
              </button>
            );
          })}
        </div>

        <label className="flex items-center gap-1.5 text-[0.6875rem] text-ink-muted">
          Scale
          <input
            type="number"
            min={1000}
            step={1000}
            value={yMax}
            onChange={(event) => setYMax(Math.max(1000, Number(event.target.value) || DEFAULT_BALANCE_MAX))}
            onWheel={(event) => event.currentTarget.blur()}
            className="w-[5.5rem] rounded-xs border border-line bg-surface-1 px-1.5 py-0.5 text-right text-[0.6875rem] tabular-nums text-ink outline-none focus:border-focus"
            aria-label="Y-axis maximum in dollars"
          />
          <span className="flex gap-0.5">
            {BALANCE_MAX_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setYMax(preset)}
                className={clsx(
                  "rounded-xs border px-1.5 py-0.5 text-[0.625rem] tabular-nums",
                  yMax === preset
                    ? "border-ink bg-ink text-surface-1"
                    : "border-line bg-surface-1 text-ink-muted hover:bg-surface-2",
                )}
              >
                {moneyCompact(preset)}
              </button>
            ))}
          </span>
        </label>
      </div>

      {clipped && (
        <p className="text-[0.625rem] text-warning-strong">
          Something sits above {money(max, { cents: false })}. Raise the scale to see the top of the line.
        </p>
      )}

      <div className="relative">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          role="img"
          aria-label="Debt balances over time under this plan"
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
              x={xAt(label.index, series.dates.length)}
              y={HEIGHT - 8}
              textAnchor="middle"
              fill="var(--ink-faint)"
              fontSize="9"
            >
              {label.label}
            </text>
          ))}

          {series.series.map((line, index) =>
            hidden.has(line.id) ? null : (
              <polyline
                key={line.id}
                fill="none"
                stroke={colorFor(index)}
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
                points={toPolyline(line.balances, max)}
              />
            ),
          )}

          {hoverX !== null && (
            <line
              x1={hoverX}
              x2={hoverX}
              y1={PAD.top}
              y2={HEIGHT - PAD.bottom}
              stroke="var(--ink-faint)"
              strokeDasharray="3 3"
              strokeWidth="1"
            />
          )}

          {hover !== null &&
            series.series.map((line, index) =>
              hidden.has(line.id) ? null : (
                <circle
                  key={`dot-${line.id}`}
                  cx={xAt(hover, series.dates.length)}
                  cy={yAt(line.balances[hover] ?? 0, max, HEIGHT)}
                  r="3.5"
                  fill="var(--surface-1)"
                  stroke={colorFor(index)}
                  strokeWidth="2"
                />
              ),
            )}
        </svg>

        {hover !== null && series.dates[hover] && (
          <div
            className="pointer-events-none absolute top-2 z-10 min-w-[9.5rem] rounded-xs border border-line bg-surface-1 px-2 py-1.5 shadow-elev-2"
            style={{
              left: `${Math.min(70, Math.max(6, ((hoverX ?? PAD.left) / WIDTH) * 100 - 6))}%`,
            }}
          >
            <p className="text-[0.625rem] font-medium text-ink-muted">{mediumDate(series.dates[hover])}</p>
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
                    {money(line.balances[hover] ?? 0, { cents: false })}
                  </span>
                </p>
              ),
            )}
          </div>
        )}
      </div>
    </div>
  );
}
