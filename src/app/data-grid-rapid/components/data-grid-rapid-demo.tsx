"use client";

import type { ColumnDef } from "@tanstack/react-table";

import { cn } from "cn";
import { ArrowDown, ArrowUp, Pause, Play } from "lucide-react";
import * as React from "react";

import type { DataGridFeatures } from "@/lib/data-grid-features";
import type { RowUpdate } from "@/lib/data-grid-types";

import { useValueAsRef } from "@/hooks/use-value-as-ref";
import { useWindowSize } from "@/hooks/use-window-size";
import { DataGrid } from "@/registry/bases/radix/components/data-grid/data-grid";
import { DataGridSortMenu } from "@/registry/bases/radix/components/data-grid/data-grid-sort-menu";
import { DataGridViewMenu } from "@/registry/bases/radix/components/data-grid/data-grid-view-menu";
import { useDataGrid } from "@/registry/bases/radix/hooks/use-data-grid";
import { Button } from "@/registry/bases/radix/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/registry/bases/radix/ui/select";
import { Separator } from "@/registry/bases/radix/ui/separator";

import {
  createMarket,
  createRandom,
  type Market,
  type Quote,
  QUOTE_FIELDS,
  tickMarket,
} from "../lib/rapid";

const ROW_COUNTS = [1_000, 5_000, 20_000] as const;
const TICK_RATES = [10, 30, 60] as const;
const TICK_SHARES = [0.05, 0.2, 0.5] as const;
const MAX_TICKS_PER_FRAME = 4;

const FLOWS = [
  {
    value: "cells",
    label: "updateCells",
    description: "Patches only the changed cells",
  },
  {
    value: "data",
    label: "setData",
    description: "Passes a new data array, like a React state update",
  },
] as const;

type Flow = (typeof FLOWS)[number]["value"];

const priceFormat = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const signedFormat = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  signDisplay: "exceptZero",
});
const volumeFormat = new Intl.NumberFormat("en-US");
const marketCapFormat = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 2,
});

type Trend = "up" | "down";

// The direction of the last move, with a key that changes on every move so the
// flash restarts: a remounted element fades out of its `starting:` style again
const FLASH_COOLDOWN_MS = 250;

function useTrend(value: number) {
  const [state, setState] = React.useState<{
    value: number;
    trend: Trend | null;
    key: number;
    flashedAt: number;
  }>({ value, trend: null, key: 0, flashedAt: 0 });
  if (state.value !== value) {
    const now = performance.now();
    const canFlash = now - state.flashedAt >= FLASH_COOLDOWN_MS;
    setState({
      value,
      trend: value > state.value ? "up" : "down",
      key: canFlash ? state.key + 1 : state.key,
      flashedAt: canFlash ? now : state.flashedAt,
    });
  }
  return state;
}

function PriceCell({ value }: { value: number }) {
  const { trend, key } = useTrend(value);
  const Arrow = trend === "down" ? ArrowDown : ArrowUp;

  return (
    <span className="absolute inset-0 flex items-center justify-end gap-1 px-2 font-medium tabular-nums">
      <Arrow
        aria-hidden="true"
        className={cn(
          "size-3.5",
          trend === "up" && "text-emerald-600 dark:text-emerald-400",
          trend === "down" && "text-red-600 dark:text-red-400",
          !trend && "invisible",
        )}
      />
      <span
        key={key}
        data-trend={trend ?? undefined}
        className="-me-1 rounded-sm px-1 transition-colors duration-700 data-[trend=down]:starting:bg-red-500/30 data-[trend=up]:starting:bg-emerald-500/30"
      >
        {priceFormat.format(value)}
      </span>
    </span>
  );
}

function ChangeCell({ value }: { value: number }) {
  return (
    <span
      className={cn(
        "absolute inset-0 flex items-center justify-end px-2 tabular-nums",
        value > 0 && "text-emerald-600 dark:text-emerald-400",
        value < 0 && "text-red-600 dark:text-red-400",
      )}
    >
      {signedFormat.format(value)}
    </span>
  );
}

function ChangePercentCell({ value }: { value: number }) {
  return (
    <span className="absolute inset-0 flex items-center justify-end px-2">
      <span
        className={cn(
          "rounded-sm px-1.5 py-0.5 text-xs font-medium tabular-nums",
          value > 0 &&
            "bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
          value < 0 &&
            "bg-red-500/10 text-red-700 dark:bg-red-500/15 dark:text-red-400",
          value === 0 && "bg-muted text-muted-foreground",
        )}
      >
        {signedFormat.format(value)}%
      </span>
    </span>
  );
}

// Moves show as a brief change of text color, quieter than the price's flash
function TickCell({
  value,
  format,
  isMuted,
}: {
  value: number;
  format: Intl.NumberFormat;
  isMuted?: boolean;
}) {
  const { trend, key } = useTrend(value);

  return (
    <span
      key={key}
      data-trend={trend ?? undefined}
      className={cn(
        "absolute inset-0 flex items-center justify-end px-2 tabular-nums transition-colors duration-700 data-[trend=down]:starting:text-red-500 data-[trend=up]:starting:text-emerald-500",
        isMuted && "text-muted-foreground",
      )}
    >
      {format.format(value)}
    </span>
  );
}

// On a log scale, since volumes span several orders of magnitude
const MIN_VOLUME_LOG = Math.log10(1_000);
const MAX_VOLUME_LOG = Math.log10(5_000_000);

function VolumeCell({ value }: { value: number }) {
  const share = Math.min(
    1,
    Math.max(0, Math.log10(Math.max(1, value)) - MIN_VOLUME_LOG) /
      (MAX_VOLUME_LOG - MIN_VOLUME_LOG),
  );

  return (
    <span className="absolute inset-0 flex items-center gap-2 px-2 tabular-nums">
      <span aria-hidden="true" className="h-1 flex-1 rounded-full bg-muted">
        <span
          className="block h-full rounded-full bg-muted-foreground/50 transition-[width] duration-300"
          style={{ width: `${(share * 100).toFixed(1)}%` }}
        />
      </span>
      <span className="text-end">{volumeFormat.format(value)}</span>
    </span>
  );
}

function TrendCell({ quote }: { quote: Quote }) {
  const { history, change } = quote;
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const price of history) {
    min = Math.min(min, price);
    max = Math.max(max, price);
  }
  const span = max - min || 1;
  const points = history
    .map(
      (price, index) => `${index},${(((max - price) / span) * 100).toFixed(1)}`,
    )
    .join(" ");

  return (
    <span className="absolute inset-x-2 inset-y-2.5 flex">
      <svg
        aria-hidden="true"
        viewBox={`0 -4 ${Math.max(1, history.length - 1)} 108`}
        preserveAspectRatio="none"
        className={cn(
          "size-full overflow-visible",
          change >= 0
            ? "text-emerald-600 dark:text-emerald-400"
            : "text-red-600 dark:text-red-400",
        )}
      >
        <polyline
          points={points}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </span>
  );
}

function RangeCell({ quote }: { quote: Quote }) {
  const { low, high, price, change } = quote;
  const position = high === low ? 50 : ((price - low) * 100) / (high - low);

  return (
    <span className="absolute inset-0 flex items-center gap-2 px-2 text-xs text-muted-foreground tabular-nums">
      <span className="w-12 text-end">{priceFormat.format(low)}</span>
      <span className="relative h-1 flex-1 rounded-full bg-muted">
        <span
          className={cn(
            "absolute top-1/2 size-2 -translate-1/2 rounded-full ring-2 ring-background transition-[left] duration-300",
            change >= 0 ? "bg-emerald-500" : "bg-red-500",
          )}
          style={{ left: `${position}%` }}
        />
      </span>
      <span className="w-12">{priceFormat.format(high)}</span>
    </span>
  );
}

function getQuoteColumn(
  id: Exclude<(typeof QUOTE_FIELDS)[number], "history">,
  label: string,
  renderCell: (value: number) => React.ReactNode,
  size = 110,
): ColumnDef<DataGridFeatures, Quote> {
  return {
    id,
    accessorKey: id,
    header: label,
    size,
    meta: { label },
    cell: ({ getValue }) => renderCell(getValue() as number),
  };
}

interface MarketBreadth {
  advancing: number;
  declining: number;
}

// Counts are read from the feed's own state, so this costs one pass a second
function useMarketBreadth(market: Market) {
  const getBreadth = React.useCallback(() => {
    let advancing = 0;
    let declining = 0;
    for (const quote of market.quotes) {
      if (quote.change > 0) advancing++;
      else if (quote.change < 0) declining++;
    }
    return { advancing, declining };
  }, [market]);
  const [breadth, setBreadth] = React.useState<MarketBreadth>(getBreadth);

  React.useEffect(() => {
    const intervalId = window.setInterval(() => setBreadth(getBreadth()), 1000);
    return () => window.clearInterval(intervalId);
  }, [getBreadth]);

  return breadth;
}

function MarketBreadthPills({ advancing, declining }: MarketBreadth) {
  return (
    <div
      role="img"
      aria-label={`${advancing} advancing, ${declining} declining`}
      className="flex items-center gap-1 font-medium tabular-nums"
    >
      <span className="flex items-center gap-0.5 rounded-sm bg-emerald-500/10 px-1.5 py-0.5 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
        <ArrowUp className="size-3" />
        {volumeFormat.format(advancing)}
      </span>
      <span className="flex items-center gap-0.5 rounded-sm bg-red-500/10 px-1.5 py-0.5 text-red-700 dark:bg-red-500/15 dark:text-red-400">
        <ArrowDown className="size-3" />
        {volumeFormat.format(declining)}
      </span>
    </div>
  );
}

interface StatProps {
  label?: string;
  value: React.ReactNode;
  unit: string;
}

function Stat({ label, value, unit }: StatProps) {
  return (
    <span>
      {label ? `${label} ` : null}
      <span className="font-medium text-foreground">{value}</span> {unit}
    </span>
  );
}

interface FrameStats {
  fps: number;
  p95: number;
  cellsPerSecond: number;
}

function useFrameStats(updatedCellsRef: React.RefObject<number>) {
  const [stats, setStats] = React.useState<FrameStats>({
    fps: 0,
    p95: 0,
    cellsPerSecond: 0,
  });

  React.useEffect(() => {
    let frameId = 0;
    let last = 0;
    let windowStart = performance.now();
    const deltas: number[] = [];
    const onFrame = (now: number) => {
      frameId = requestAnimationFrame(onFrame);
      if (last) deltas.push(now - last);
      last = now;
      if (now - windowStart < 1000) return;
      const elapsed = now - windowStart;
      deltas.sort((a, b) => a - b);
      setStats({
        fps: Math.round((deltas.length * 1000) / elapsed),
        p95: Math.round(deltas[Math.floor(deltas.length * 0.95)] ?? 0),
        cellsPerSecond: Math.round((updatedCellsRef.current * 1000) / elapsed),
      });
      deltas.length = 0;
      updatedCellsRef.current = 0;
      windowStart = now;
    };
    frameId = requestAnimationFrame(onFrame);
    return () => cancelAnimationFrame(frameId);
  }, [updatedCellsRef]);

  return stats;
}

interface DataGridRapidContentProps {
  rowCount: number;
  rowCountSelect: React.ReactNode;
}

function DataGridRapidContent({
  rowCount,
  rowCountSelect,
}: DataGridRapidContentProps) {
  // The simulated feed's own state, which ticks mutate in place
  const [market] = React.useState(() => createMarket(rowCount));
  const [data, setData] = React.useState(() =>
    market.quotes.map((quote) => ({ ...quote })),
  );
  const [isRunning, setIsRunning] = React.useState(true);
  const [flow, setFlow] = React.useState<Flow>("cells");
  const [tickRate, setTickRate] = React.useState<number>(10);
  const [tickShare, setTickShare] = React.useState<number>(0.2);
  const updatedCellsRef = React.useRef(0);
  const stats = useFrameStats(updatedCellsRef);
  const breadth = useMarketBreadth(market);
  const windowSize = useWindowSize({ defaultHeight: 760 });

  const columns = React.useMemo<ColumnDef<DataGridFeatures, Quote>[]>(
    () => [
      {
        id: "symbol",
        accessorKey: "symbol",
        header: "Symbol",
        size: 120,
        meta: { label: "Symbol", cell: { variant: "short-text" } },
      },
      getQuoteColumn("price", "Price", (value) => <PriceCell value={value} />),
      getQuoteColumn("change", "Change", (value) => (
        <ChangeCell value={value} />
      )),
      getQuoteColumn("changePercent", "Change %", (value) => (
        <ChangePercentCell value={value} />
      )),
      {
        id: "history",
        accessorKey: "history",
        header: "Trend",
        size: 130,
        enableSorting: false,
        meta: { label: "Trend" },
        cell: ({ row }) => <TrendCell quote={row.original} />,
      },
      getQuoteColumn("bid", "Bid", (value) => (
        <TickCell value={value} format={priceFormat} />
      )),
      getQuoteColumn("ask", "Ask", (value) => (
        <TickCell value={value} format={priceFormat} />
      )),
      {
        id: "range",
        // Where the price sits in the day's range, so sorting puts quotes near
        // their high first
        accessorFn: (quote) =>
          quote.high === quote.low
            ? 0.5
            : (quote.price - quote.low) / (quote.high - quote.low),
        header: "Day range",
        size: 200,
        meta: { label: "Day range" },
        cell: ({ row }) => <RangeCell quote={row.original} />,
      },
      getQuoteColumn(
        "volume",
        "Volume",
        (value) => <VolumeCell value={value} />,
        130,
      ),
      getQuoteColumn(
        "marketCap",
        "Mkt Cap",
        (value) => <TickCell value={value} format={marketCapFormat} isMuted />,
        120,
      ),
    ],
    [],
  );

  const { table, ...dataGridProps } = useDataGrid({
    data,
    columns,
    getRowId: (row) => row.symbol,
    readOnly: true,
  });
  // A data change hands back a new `table`, which mustn't restart the feed
  const tableRef = useValueAsRef(table);

  React.useEffect(() => {
    if (!isRunning) return;
    const random = createRandom(Date.now());
    let frameId = 0;
    let last = performance.now();
    let dueTicks = 0;
    const onFrame = (now: number) => {
      frameId = requestAnimationFrame(onFrame);
      dueTicks = Math.min(
        dueTicks + ((now - last) * tickRate) / 1000,
        MAX_TICKS_PER_FRAME,
      );
      last = now;
      if (dueTicks < 1) return;

      const moved = new Set<number>();
      for (; dueTicks >= 1; dueTicks--) {
        const tickMoved = tickMarket(market, tickShare, random);
        updatedCellsRef.current += tickMoved.length * QUOTE_FIELDS.length;
        for (const index of tickMoved) moved.add(index);
      }
      const { quotes } = market;

      if (flow === "cells") {
        const updates: RowUpdate[] = [];
        for (const index of moved) {
          const quote = quotes[index];
          if (!quote) continue;
          const values: RowUpdate["values"] = {};
          for (const field of QUOTE_FIELDS) values[field] = quote[field];
          updates.push({ rowId: quote.symbol, values });
        }
        tableRef.current.updateCells(updates, { batch: true });
        return;
      }

      setData((previous) => {
        const next = previous.slice();
        for (const index of moved) {
          const quote = quotes[index];
          if (quote) next[index] = { ...quote };
        }
        return next;
      });
    };
    frameId = requestAnimationFrame(onFrame);
    return () => cancelAnimationFrame(frameId);
  }, [isRunning, flow, tickRate, tickShare, market, tableRef]);

  const height = Math.max(400, windowSize.height - 150);

  return (
    <div className="container flex flex-col gap-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            aria-label={isRunning ? "Pause the feed" : "Resume the feed"}
            onClick={() => setIsRunning((running) => !running)}
          >
            {isRunning ? <Pause /> : <Play />}
            {isRunning ? "Pause" : "Resume"}
          </Button>
          {rowCountSelect}
          <Select
            value={flow}
            onValueChange={(value) => setFlow(value as Flow)}
          >
            <SelectTrigger aria-label="Update with">
              <SelectValue>
                <span className="font-mono text-xs">
                  {FLOWS.find((option) => option.value === flow)?.label}
                </span>
              </SelectValue>
            </SelectTrigger>
            <SelectContent position="popper" align="start">
              <SelectGroup>
                <SelectLabel>Update with</SelectLabel>
                {FLOWS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <span className="flex flex-col">
                      <span className="font-mono text-xs">{option.label}</span>
                      <span className="text-xs text-muted-foreground">
                        {option.description}
                      </span>
                    </span>
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <Select
            value={String(tickRate)}
            onValueChange={(value) => setTickRate(Number(value))}
          >
            <SelectTrigger aria-label="Ticks per second">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper" align="start">
              <SelectGroup>
                <SelectLabel>Ticks per second</SelectLabel>
                {TICK_RATES.map((rate) => (
                  <SelectItem key={rate} value={String(rate)}>
                    {rate} ticks/s
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <Select
            value={String(tickShare)}
            onValueChange={(value) => setTickShare(Number(value))}
          >
            <SelectTrigger aria-label="Rows per tick">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper" align="start">
              <SelectGroup>
                <SelectLabel>Rows per tick</SelectLabel>
                {TICK_SHARES.map((share) => (
                  <SelectItem key={share} value={String(share)}>
                    {share * 100}% of rows
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <MarketBreadthPills {...breadth} />
            <output
              aria-label="Frame stats"
              className="flex gap-3 tabular-nums"
            >
              <Stat value={stats.fps} unit="fps" />
              <Stat label="p95" value={stats.p95} unit="ms" />
              <Stat
                value={volumeFormat.format(stats.cellsPerSecond)}
                unit="cells/s"
              />
            </output>
          </div>
          <Separator
            orientation="vertical"
            className="mx-2 data-vertical:h-5 data-vertical:self-center"
          />
          <DataGridSortMenu table={table} align="end" />
          <DataGridViewMenu table={table} align="end" />
        </div>
      </div>
      <DataGrid
        {...dataGridProps}
        table={table}
        height={height}
        stretchColumns
      />
    </div>
  );
}

export function DataGridRapidDemo() {
  const [rowCount, setRowCount] = React.useState<number>(5_000);

  const rowCountSelect = (
    <Select
      value={String(rowCount)}
      onValueChange={(value) => setRowCount(Number(value))}
    >
      <SelectTrigger aria-label="Tickers">
        <SelectValue />
      </SelectTrigger>
      <SelectContent position="popper" align="start">
        <SelectGroup>
          <SelectLabel>Tickers</SelectLabel>
          {ROW_COUNTS.map((count) => (
            <SelectItem key={count} value={String(count)}>
              {volumeFormat.format(count)} tickers
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );

  return (
    <DataGridRapidContent
      key={rowCount}
      rowCount={rowCount}
      rowCountSelect={rowCountSelect}
    />
  );
}
