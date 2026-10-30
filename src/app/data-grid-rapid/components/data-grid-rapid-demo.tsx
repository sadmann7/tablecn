"use client";

import type { ColumnDef } from "@tanstack/react-table";

import { cn } from "cn";
import {
  Activity,
  ArrowDown,
  ArrowUp,
  ChartColumn,
  Diff,
  DollarSign,
  HandCoins,
  Landmark,
  MoveHorizontal,
  Pause,
  Percent,
  Play,
  Tag,
} from "lucide-react";
import * as React from "react";

import type { DataGridFeatures } from "@/lib/data-grid-features";
import type { DataGridColumnMeta, RowUpdate } from "@/lib/data-grid-types";

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

const MAX_TICKS_PER_FRAME = 4;

type Flow = "cells" | "data";

const FLOW_OPTIONS = [
  {
    value: "cells",
    label: <span className="font-mono text-xs">updateCells</span>,
    description: "Patches only the changed cells",
  },
  {
    value: "data",
    label: <span className="font-mono text-xs">setData</span>,
    description: "Passes a new data array, like a React state update",
  },
] satisfies OptionSelectOption<Flow>[];

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

const ROW_COUNT_OPTIONS = [1_000, 5_000, 20_000].map((count) => ({
  value: count,
  label: `${volumeFormat.format(count)} tickers`,
}));
const TICK_RATE_OPTIONS = [10, 30, 60].map((rate) => ({
  value: rate,
  label: `${rate} ticks/s`,
}));
const TICK_SHARE_OPTIONS = [0.05, 0.2, 0.5].map((share) => ({
  value: share,
  label: `${share * 100}% of rows`,
}));

type Trend = "up" | "down";

const FLASH_COOLDOWN_MS = 250;
const FLASH_OPTIONS: KeyframeAnimationOptions = {
  duration: 700,
  easing: "cubic-bezier(0.4, 0, 0.2, 1)",
};
const PRICE_FLASH: Keyframe[] = [
  { backgroundColor: "color-mix(in oklab, var(--flash) 30%, transparent)" },
  {},
];
const TICK_FLASH: Keyframe[] = [{ color: "var(--flash)" }, {}];
const FLASH_COLORS =
  "data-[trend=down]:[--flash:var(--color-red-500)] data-[trend=up]:[--flash:var(--color-emerald-500)]";

interface ValueCellProps {
  value: number;
}

interface QuoteCellProps {
  quote: Quote;
}

const MIN_VOLUME_LOG = Math.log10(1_000);
const MAX_VOLUME_LOG = Math.log10(5_000_000);

interface MarketBreadth {
  advancing: number;
  declining: number;
}

interface OptionSelectOption<TValue extends string | number> {
  value: TValue;
  label: React.ReactNode;
  description?: string;
}

interface FrameStats {
  fps: number;
  p95: number;
  cellsPerSecond: number;
}

export function DataGridRapidDemo() {
  const [rowCount, setRowCount] = React.useState(5_000);

  const rowCountSelect = (
    <OptionSelect
      label="Tickers"
      value={rowCount}
      options={ROW_COUNT_OPTIONS}
      onValueChange={setRowCount}
    />
  );

  return (
    <DataGridRapidContent
      key={rowCount}
      rowCount={rowCount}
      rowCountSelect={rowCountSelect}
    />
  );
}

const marketCapFormat = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 2,
});

interface DataGridRapidContentProps {
  rowCount: number;
  rowCountSelect: React.ReactNode;
}

function DataGridRapidContent({
  rowCount,
  rowCountSelect,
}: DataGridRapidContentProps) {
  const [market] = React.useState(() => createMarket(rowCount));
  const [data, setData] = React.useState(() =>
    market.quotes.map((quote) => ({ ...quote })),
  );
  const [isRunning, setIsRunning] = React.useState(true);
  const [flow, setFlow] = React.useState<Flow>("cells");
  const [tickRate, setTickRate] = React.useState(10);
  const [tickShare, setTickShare] = React.useState(0.2);
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
      getQuoteColumn("price", "Price", DollarSign, (value) => (
        <PriceCell value={value} />
      )),
      getQuoteColumn("change", "Change", Diff, (value) => (
        <ChangeCell value={value} />
      )),
      getQuoteColumn(
        "changePercent",
        "Change %",
        Percent,
        (value) => <ChangePercentCell value={value} />,
        125,
      ),
      {
        id: "history",
        accessorKey: "history",
        header: "Trend",
        size: 130,
        enableSorting: false,
        meta: { label: "Trend", icon: Activity },
        cell: ({ row }) => <TrendCell quote={row.original} />,
      },
      getQuoteColumn("bid", "Bid", HandCoins, (value) => (
        <TickCell value={value} format={priceFormat} />
      )),
      getQuoteColumn("ask", "Ask", Tag, (value) => (
        <TickCell value={value} format={priceFormat} />
      )),
      {
        id: "range",
        accessorFn: (quote) =>
          quote.high === quote.low
            ? 0.5
            : (quote.price - quote.low) / (quote.high - quote.low),
        header: "Day range",
        size: 200,
        meta: { label: "Day range", icon: MoveHorizontal },
        cell: ({ row }) => <RangeCell quote={row.original} />,
      },
      getQuoteColumn(
        "volume",
        "Volume",
        ChartColumn,
        (value) => <VolumeCell value={value} />,
        130,
      ),
      getQuoteColumn(
        "marketCap",
        "Mkt Cap",
        Landmark,
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
          <OptionSelect
            label="Update with"
            value={flow}
            options={FLOW_OPTIONS}
            onValueChange={setFlow}
          />
          <OptionSelect
            label="Ticks per second"
            value={tickRate}
            options={TICK_RATE_OPTIONS}
            onValueChange={setTickRate}
          />
          <OptionSelect
            label="Rows per tick"
            value={tickShare}
            options={TICK_SHARE_OPTIONS}
            onValueChange={setTickShare}
          />
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

function getQuoteColumn(
  id: Exclude<(typeof QUOTE_FIELDS)[number], "history">,
  label: string,
  icon: DataGridColumnMeta["icon"],
  renderCell: (value: number) => React.ReactNode,
  size = 110,
): ColumnDef<DataGridFeatures, Quote> {
  return {
    id,
    accessorKey: id,
    header: label,
    size,
    meta: { label, icon },
    cell: ({ getValue }) => renderCell(getValue() as number),
  };
}

function PriceCell({ value }: ValueCellProps) {
  const { trend, ref } = useTrendFlash<HTMLSpanElement>(value, PRICE_FLASH);
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
        ref={ref}
        data-trend={trend ?? undefined}
        className={cn("-me-1 rounded-sm px-1", FLASH_COLORS)}
      >
        {priceFormat.format(value)}
      </span>
    </span>
  );
}

function useTrendFlash<TElement extends HTMLElement>(
  value: number,
  keyframes: Keyframe[],
) {
  const [state, setState] = React.useState<{
    value: number;
    trend: Trend | null;
  }>({ value, trend: null });
  if (state.value !== value) {
    setState({ value, trend: value > state.value ? "up" : "down" });
  }

  const ref = React.useRef<TElement>(null);
  const flashedAtRef = React.useRef(0);

  React.useLayoutEffect(() => {
    const element = ref.current;
    if (!element || !state.trend) return;

    const now = performance.now();
    if (now - flashedAtRef.current < FLASH_COOLDOWN_MS) return;
    flashedAtRef.current = now;
    element.animate(keyframes, FLASH_OPTIONS);
  }, [state, keyframes]);

  return { trend: state.trend, ref };
}

function ChangeCell({ value }: ValueCellProps) {
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

function ChangePercentCell({ value }: ValueCellProps) {
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

function TrendCell({ quote }: QuoteCellProps) {
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

interface TickCellProps extends ValueCellProps {
  format: Intl.NumberFormat;
  isMuted?: boolean;
}

function TickCell({ value, format, isMuted }: TickCellProps) {
  const { trend, ref } = useTrendFlash<HTMLSpanElement>(value, TICK_FLASH);

  return (
    <span
      ref={ref}
      data-trend={trend ?? undefined}
      className={cn(
        "absolute inset-0 flex items-center justify-end px-2 tabular-nums",
        FLASH_COLORS,
        isMuted && "text-muted-foreground",
      )}
    >
      {format.format(value)}
    </span>
  );
}

function RangeCell({ quote }: QuoteCellProps) {
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

function VolumeCell({ value }: ValueCellProps) {
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

interface OptionSelectProps<TValue extends string | number> {
  label: string;
  value: TValue;
  options: readonly OptionSelectOption<TValue>[];
  onValueChange: (value: TValue) => void;
}

function OptionSelect<TValue extends string | number>({
  label,
  value,
  options,
  onValueChange,
}: OptionSelectProps<TValue>) {
  return (
    <Select
      value={String(value)}
      onValueChange={(nextValue) => {
        const option = options.find((item) => String(item.value) === nextValue);
        if (option) onValueChange(option.value);
      }}
    >
      <SelectTrigger aria-label={label}>
        <SelectValue>
          {options.find((option) => option.value === value)?.label}
        </SelectValue>
      </SelectTrigger>
      <SelectContent position="popper" align="start">
        <SelectGroup>
          <SelectLabel>{label}</SelectLabel>
          {options.map((option) => (
            <SelectItem key={option.value} value={String(option.value)}>
              {option.description ? (
                <span className="flex flex-col">
                  {option.label}
                  <span className="text-xs text-muted-foreground!">
                    {option.description}
                  </span>
                </span>
              ) : (
                option.label
              )}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
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
