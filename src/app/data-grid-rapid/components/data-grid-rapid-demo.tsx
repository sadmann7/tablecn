"use client";

import type { ColumnDef } from "@tanstack/react-table";

import { cn } from "cn";
import { Pause, Play } from "lucide-react";
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
  SelectTrigger,
  SelectValue,
} from "@/registry/bases/radix/ui/select";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/registry/bases/radix/ui/toggle-group";

import {
  createMarket,
  createRandom,
  type Quote,
  QUOTE_FIELDS,
  SECTORS,
  tickMarket,
} from "../lib/rapid";

const ROW_COUNTS = [1_000, 5_000, 20_000] as const;
const TICK_RATES = [10, 30, 60] as const;
const TICK_SHARES = [0.05, 0.2, 0.5] as const;

// How a tick reaches the grid: `updateCells` patches just the changed cells, while
// `data` replaces the changed rows in a new array, like a plain React state update
type Flow = "cells" | "data";

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

interface QuoteCellProps {
  value: number;
  format: Intl.NumberFormat;
  suffix?: string;
  isSigned?: boolean;
}

// Flashes green or red when the value moves: the span remounts on every change, so
// its starting style fades out again
function QuoteCell({ value, format, suffix, isSigned }: QuoteCellProps) {
  const [flash, setFlash] = React.useState<{
    value: number;
    trend: "up" | "down" | null;
    key: number;
  }>({ value, trend: null, key: 0 });
  if (flash.value !== value) {
    setFlash({
      value,
      trend: value > flash.value ? "up" : "down",
      key: flash.key + 1,
    });
  }

  return (
    <span
      key={flash.key}
      data-trend={flash.trend ?? undefined}
      className={cn(
        "absolute inset-0 flex items-center justify-end px-2 tabular-nums transition-colors duration-700 data-[trend=down]:starting:bg-red-500/25 data-[trend=up]:starting:bg-emerald-500/25",
        isSigned && value > 0 && "text-emerald-600 dark:text-emerald-400",
        isSigned && value < 0 && "text-red-600 dark:text-red-400",
      )}
    >
      {format.format(value)}
      {suffix}
    </span>
  );
}

function getQuoteColumn(
  id: (typeof QUOTE_FIELDS)[number],
  label: string,
  format: Intl.NumberFormat,
  options: { suffix?: string; isSigned?: boolean; size?: number } = {},
): ColumnDef<DataGridFeatures, Quote> {
  return {
    id,
    accessorKey: id,
    header: label,
    size: options.size ?? 110,
    meta: { label },
    cell: ({ getValue }) => (
      <QuoteCell
        value={getValue() as number}
        format={format}
        suffix={options.suffix}
        isSigned={options.isSigned}
      />
    ),
  };
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
      getQuoteColumn("price", "Price", priceFormat),
      getQuoteColumn("change", "Change", signedFormat, { isSigned: true }),
      getQuoteColumn("changePercent", "Change %", signedFormat, {
        suffix: "%",
        isSigned: true,
      }),
      getQuoteColumn("bid", "Bid", priceFormat),
      getQuoteColumn("ask", "Ask", priceFormat),
      getQuoteColumn("high", "High", priceFormat),
      getQuoteColumn("low", "Low", priceFormat),
      getQuoteColumn("volume", "Volume", volumeFormat, { size: 130 }),
      getQuoteColumn("marketCap", "Mkt Cap", marketCapFormat, { size: 120 }),
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
    const intervalId = window.setInterval(() => {
      const moved = tickMarket(market, tickShare, random);
      const { quotes } = market;
      updatedCellsRef.current += moved.length * QUOTE_FIELDS.length;

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
    }, 1000 / tickRate);
    return () => window.clearInterval(intervalId);
  }, [isRunning, flow, tickRate, tickShare, market, tableRef]);

  const height = Math.max(400, windowSize.height - 150);

  return (
    <div className="container flex flex-col gap-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {rowCountSelect}
          <Button
            variant="outline"
            aria-label={isRunning ? "Pause the feed" : "Resume the feed"}
            onClick={() => setIsRunning((running) => !running)}
          >
            {isRunning ? <Pause /> : <Play />}
            {isRunning ? "Pause" : "Resume"}
          </Button>
          <ToggleGroup
            type="single"
            variant="outline"
            spacing={0}
            aria-label="How ticks reach the grid"
            value={flow}
            onValueChange={(value) => {
              if (value) setFlow(value as Flow);
            }}
          >
            <ToggleGroupItem value="cells" title="table.updateCells">
              Cells
            </ToggleGroupItem>
            <ToggleGroupItem value="data" title="A new data array">
              Data
            </ToggleGroupItem>
          </ToggleGroup>
          <Select
            value={String(tickRate)}
            onValueChange={(value) => setTickRate(Number(value))}
          >
            <SelectTrigger aria-label="Ticks per second">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
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
            <SelectContent>
              <SelectGroup>
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
          <output
            aria-label="Frame stats"
            className="font-mono text-xs text-muted-foreground tabular-nums"
          >
            {stats.fps} fps · p95 {stats.p95}ms ·{" "}
            {volumeFormat.format(stats.cellsPerSecond)} cells/s
          </output>
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
      <SelectContent>
        <SelectGroup>
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
