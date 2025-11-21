"use client";

import type { Table, TableMeta } from "@tanstack/react-table";
import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface DataGridPasteDialogProps<TData> {
  table: Table<TData>;
}

export function DataGridPasteDialog<TData>({
  table,
}: DataGridPasteDialogProps<TData>) {
  const meta = table.options.meta;
  const pasteDialog = meta?.pasteDialog;
  const onPasteDialogOpenChange = meta?.onPasteDialogOpenChange;
  const onPasteWithExpansion = meta?.onPasteWithExpansion;
  const onPasteWithoutExpansion = meta?.onPasteWithoutExpansion;

  if (!pasteDialog) return null;

  return (
    <PasteDialog
      pasteDialog={pasteDialog}
      onPasteDialogOpenChange={onPasteDialogOpenChange}
      onPasteWithExpansion={onPasteWithExpansion}
      onPasteWithoutExpansion={onPasteWithoutExpansion}
    />
  );
}

interface PasteDialogProps
  extends Pick<
      TableMeta<unknown>,
      | "onPasteDialogOpenChange"
      | "onPasteWithExpansion"
      | "onPasteWithoutExpansion"
    >,
    Required<Pick<TableMeta<unknown>, "pasteDialog">> {}

const PasteDialog = React.memo(PasteDialogImpl, (prev, next) => {
  if (prev.pasteDialog.open !== next.pasteDialog.open) return false;
  if (!next.pasteDialog.open) return true;
  if (prev.pasteDialog.rowsNeeded !== next.pasteDialog.rowsNeeded) return false;

  return true;
}) as typeof PasteDialogImpl;

function PasteDialogImpl({
  pasteDialog,
  onPasteDialogOpenChange,
  onPasteWithExpansion,
  onPasteWithoutExpansion,
}: PasteDialogProps) {
  return (
    <Dialog open={pasteDialog.open} onOpenChange={onPasteDialogOpenChange}>
      <DialogContent data-grid-popover="">
        <DialogHeader>
          <DialogTitle>Add more rows?</DialogTitle>
          <DialogDescription>
            Your clipboard contains more data than available rows. We need{" "}
            <strong>{pasteDialog.rowsNeeded}</strong> additional row
            {pasteDialog.rowsNeeded !== 1 ? "s" : ""} to paste everything.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 py-4">
          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="radio"
              name="expand-option"
              value="expand"
              defaultChecked
              className="size-4"
            />
            <span className="text-sm">
              <strong className="font-medium">Create new rows</strong> and paste
              all data
            </span>
          </label>
          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="radio"
              name="expand-option"
              value="no-expand"
              className="size-4"
            />
            <span className="text-sm">
              <strong className="font-medium">Keep current rows</strong> and paste
              only what fits
            </span>
          </label>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onPasteDialogOpenChange?.(false)}
          >
            Cancel
          </Button>
          <Button
            onClick={() => {
              const expandOption = document.querySelector<HTMLInputElement>(
                'input[name="expand-option"]:checked',
              );
              if (expandOption?.value === "expand") {
                onPasteWithExpansion?.();
              } else {
                onPasteWithoutExpansion?.();
              }
            }}
          >
            Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
