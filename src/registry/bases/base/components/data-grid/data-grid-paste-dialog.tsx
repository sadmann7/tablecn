"use client";

import {
  type ReactTable,
  type RowData,
  Subscribe,
} from "@tanstack/react-table";
import { cn } from "cn";
import * as React from "react";

import type { DataGridFeatures } from "@/lib/data-grid-features";
import type { PasteDialogState } from "@/lib/data-grid-types";

import { Button } from "@/registry/bases/base/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/registry/bases/base/ui/dialog";

interface DataGridPasteDialogProps<TData extends RowData> {
  table: ReactTable<DataGridFeatures, TData, unknown>;
}

export function DataGridPasteDialog<TData extends RowData>({
  table,
}: DataGridPasteDialogProps<TData>) {
  return (
    <Subscribe source={table.atoms.pasteDialog}>
      {(pasteDialog) =>
        pasteDialog.open ? (
          <PasteDialog table={table} pasteDialog={pasteDialog} />
        ) : null
      }
    </Subscribe>
  );
}

interface PasteDialogProps<
  TData extends RowData,
> extends DataGridPasteDialogProps<TData> {
  pasteDialog: PasteDialogState;
}

const PasteDialog = React.memo(PasteDialogImpl, (prev, next) => {
  if (prev.table !== next.table) return false;
  if (prev.pasteDialog.open !== next.pasteDialog.open) return false;
  if (!next.pasteDialog.open) return true;
  if (prev.pasteDialog.rowsNeeded !== next.pasteDialog.rowsNeeded) return false;

  return true;
}) as typeof PasteDialogImpl;

function PasteDialogImpl<TData extends RowData>({
  table,
  pasteDialog,
}: PasteDialogProps<TData>) {
  const expandRadioRef = React.useRef<HTMLInputElement | null>(null);

  const onOpenChange = React.useCallback(
    (open: boolean) => {
      if (!open) table.resetPasteDialog(true);
    },
    [table],
  );

  const onCancel = React.useCallback(() => {
    table.resetPasteDialog(true);
  }, [table]);

  const onContinue = React.useCallback(() => {
    void table.pasteCells({
      expandRows: expandRadioRef.current?.checked ?? false,
    });
  }, [table]);

  return (
    <Dialog open={pasteDialog.open} onOpenChange={onOpenChange}>
      <DialogContent data-grid-popover="">
        <DialogHeader>
          <DialogTitle>Do you want to add more rows?</DialogTitle>
          <DialogDescription>
            We need <strong>{pasteDialog.rowsNeeded}</strong> additional row
            {pasteDialog.rowsNeeded !== 1 ? "s" : ""} to paste everything from
            your clipboard.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 py-1">
          <label className="flex cursor-pointer items-start gap-3">
            <RadioItem
              ref={expandRadioRef}
              name="expand-option"
              value="expand"
              defaultChecked
            />
            <div className="flex flex-col gap-1">
              <span className="text-sm leading-none font-medium">
                Create new rows
              </span>
              <span className="text-sm text-muted-foreground">
                Add {pasteDialog.rowsNeeded} new row
                {pasteDialog.rowsNeeded !== 1 ? "s" : ""} to the table and paste
                all data
              </span>
            </div>
          </label>
          <label className="flex cursor-pointer items-start gap-3">
            <RadioItem name="expand-option" value="no-expand" />
            <div className="flex flex-col gap-1">
              <span className="text-sm leading-none font-medium">
                Keep current rows
              </span>
              <span className="text-sm text-muted-foreground">
                Paste only what fits in the existing rows
              </span>
            </div>
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={onContinue}>Continue</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RadioItem({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type="radio"
      className={cn(
        "relative size-4 shrink-0 appearance-none rounded-full border border-input bg-background shadow-xs transition-[color,box-shadow] outline-none",
        "text-primary focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "checked:before:absolute checked:before:inset-s-1/2 checked:before:top-1/2 checked:before:size-2 checked:before:-translate-x-1/2 checked:before:-translate-y-1/2 checked:before:rounded-full checked:before:bg-primary checked:before:content-['']",
        "dark:bg-input/30",
        className,
      )}
      {...props}
    />
  );
}
