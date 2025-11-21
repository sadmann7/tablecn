"use client";

import type { Table } from "@tanstack/react-table";
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
    <Dialog open={pasteDialog.open} onOpenChange={onPasteDialogOpenChange}>
      <DialogContent data-grid-popover="">
        <DialogHeader>
          <DialogTitle>Do you want to expand this table?</DialogTitle>
          <DialogDescription>
            To fit your pasted data into the table, we need to add{" "}
            <strong>{pasteDialog.rowsNeeded}</strong> more record
            {pasteDialog.rowsNeeded !== 1 ? "s" : ""}.
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
            <span>
              <strong>Expand the table</strong> so that all of the pasted cells
              will fit.
            </span>
          </label>
          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="radio"
              name="expand-option"
              value="no-expand"
              className="size-4"
            />
            <span>
              <strong>Don't expand the table.</strong> Values outside of the
              table will not be pasted.
            </span>
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onPasteDialogOpenChange}>
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
