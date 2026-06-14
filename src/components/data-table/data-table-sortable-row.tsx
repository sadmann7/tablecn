import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { flexRender, type Row } from "@tanstack/react-table";
import { useMemo } from "react";
import { getColumnPinningStyle } from "@/lib/data-table";
import { TableCell, TableRow } from "../ui/table";
import { RowDragHandleContext } from "./data-table-drag-handle";

export function SortableRow<TData>({ row }: { row: Row<TData> }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: row.id,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : undefined,
    position: "relative",
    zIndex: isDragging ? 1 : undefined,
  };

  const dragCtx = useMemo(
    () => ({ attributes, listeners, isDragging, enabled: true }),
    [attributes, listeners, isDragging],
  );

  return (
    <RowDragHandleContext.Provider value={dragCtx}>
      <TableRow
        ref={setNodeRef}
        data-state={row.getIsSelected() && "selected"}
        data-dragging={isDragging || undefined}
        style={style}
        className="data-dragging:bg-muted/40"
      >
        {row.getVisibleCells().map((cell) => (
          <TableCell
            key={cell.id}
            style={{ ...getColumnPinningStyle({ column: cell.column }) }}
          >
            {flexRender(cell.column.columnDef.cell, cell.getContext())}
          </TableCell>
        ))}
      </TableRow>
    </RowDragHandleContext.Provider>
  );
}
