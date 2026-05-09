'use client'

import * as React from 'react'
import {
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type Modifier,
  type SensorDescriptor,
  type SensorOptions,
} from '@dnd-kit/core'
import { restrictToParentElement, restrictToVerticalAxis } from '@dnd-kit/modifiers'
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import type { Row } from '@tanstack/react-table'
import { useMounted } from './use-mounted'

const DEFAULT_DRAG_MODIFIERS: Modifier[] = [restrictToVerticalAxis, restrictToParentElement]

interface UseDataTableRowDndOptions<TData> {
  rows: Row<TData>[]
  /** External enable flag (e.g. controlled by a server mutation pending state). */
  enabled?: boolean
  /** Called with the new visible-row order after a drop. */
  onRowReorder?: (orderedRowIds: string[]) => void
  /** Override default modifiers (vertical-axis + parent-bounded). */
  modifiers?: Modifier[]
}

interface UseDataTableRowDndResult {
  /** True only after mount AND when `enabled` is true. SSR-safe. */
  active: boolean
  /** Stable, ordered list of TanStack `row.id`s for the current page. */
  rowIds: string[]
  sensors: SensorDescriptor<SensorOptions>[]
  modifiers: Modifier[]
  collisionDetection: CollisionDetection
  handleDragEnd: (event: DragEndEvent) => void
}

/**
 * Encapsulates the dnd-kit wiring for sortable table rows:
 * sensors, modifiers, collision detection, drag-end → reorder mapping,
 * and SSR-safe activation (deferred to first effect).
 */
export function useDataTableRowDnd<TData>({
  rows,
  enabled = false,
  onRowReorder,
  modifiers = DEFAULT_DRAG_MODIFIERS,
}: UseDataTableRowDndOptions<TData>): UseDataTableRowDndResult {
  const mounted = useMounted()

  const rowIds = React.useMemo(() => rows.map((row) => row.id), [rows])

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleDragEnd = React.useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return

      const oldIndex = rowIds.indexOf(String(active.id))
      const newIndex = rowIds.indexOf(String(over.id))
      if (oldIndex === -1 || newIndex === -1) return

      onRowReorder?.(arrayMove(rowIds, oldIndex, newIndex))
    },
    [rowIds, onRowReorder],
  )

  return {
    active: enabled && mounted,
    rowIds,
    sensors,
    modifiers,
    collisionDetection: closestCenter,
    handleDragEnd,
  }
}
