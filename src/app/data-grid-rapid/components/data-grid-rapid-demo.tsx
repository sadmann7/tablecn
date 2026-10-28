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
  SECTORS,
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

// A bar behind the number, on a log scale since volumes span several orders of magnitude
const MAX_VOLUME_LOG = Math.log10(5_000_000);

function VolumeCell({ value }: { value: number }) {
  const share = Math.min(1, Math.log10(Math.max(1, value)) / MAX_VOLUME_LOG);

  return (
    <span className="absolute inset-0 flex items-center justify-end px-2 tabular-nums">
      <span
        aria-hidden="true"
        className="absolute inset-y-2 inset-e-1 rounded-sm bg-sky-500/10 transition-[width] duration-300 dark:bg-sky-400/15"
        style={{ width: `calc(${(share * 100).toFixed(1)}% - 0.5rem)` }}
      />
      <span className="relative">{volumeFormat.format(value)}</span>
    </span>
  );
}

function getQuoteColumn(
  id: (typeof QUOTE_FIELDS)[number],
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

function MarketBreadthBar({ advancing, declining }: MarketBreadth) {
  const total = advancing + declining;
  const share = total === 0 ? 50 : (advancing * 100) / total;

  return (
    <div
      role="img"
      aria-label={`${advancing} advancing, ${declining} declining`}
      className="flex items-center gap-2 font-medium tabular-nums"
    >
      <span className="flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400">
        <ArrowUp className="size-3" />
        {volumeFormat.format(advancing)}
      </span>
      <span className="flex h-1.5 w-24 overflow-hidden rounded-full bg-red-500/70">
        <span
          className="h-full bg-emerald-500 transition-[width] duration-500"
          style={{ width: `${share}%` }}
        />
      </span>
      <span className="flex items-center gap-0.5 text-red-600 dark:text-red-400">
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
      {
        id: "name",
        accessorKey: "name",
        header: "Name",
        size: 190,
        meta: { label: "Name", cell: { variant: "short-text" } },
      },
      {
        id: "sector",
        accessorKey: "sector",
        header: "Sector",
        size: 140,
        meta: {
          label: "Sector",
          cell: {
            variant: "select",
            options: SECTORS.map((sector) => ({
              label: sector,
              value: sector,
            })),
          },
        },
      },
      getQuoteColumn("price", "Price", (value) => <PriceCell value={value} />),
      getQuoteColumn("change", "Change", (value) => (
        <ChangeCell value={value} />
      )),
      getQuoteColumn("changePercent", "Change %", (value) => (
        <ChangePercentCell value={value} />
      )),
      getQuoteColumn("bid", "Bid", (value) => (
        <TickCell value={value} format={priceFormat} />
      )),
      getQuoteColumn("ask", "Ask", (value) => (
        <TickCell value={value} format={priceFormat} />
      )),
      getQuoteColumn("high", "High", (value) => (
        <TickCell value={value} format={priceFormat} isMuted />
      )),
      getQuoteColumn("low", "Low", (value) => (
        <TickCell value={value} format={priceFormat} isMuted />
      )),
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
            <MarketBreadthBar {...breadth} />
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
          <Separator orientation="vertical" className="mx-2 h-5 self-center" />
          <DataGridSortMenu table={table} align="end" />
          <DataGridViewMenu table={table} align="end" />
        </div>
      </div>
      <DataGrid {...dataGridProps} table={table} height={height} />
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
