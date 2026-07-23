"use client";

/**
 * KanbanShell — UI genérica de board com DnD.
 * Adaptadores de domínio (Contatos / Cases) ficam fora deste módulo.
 */

import { useCallback, useMemo, useState, type ReactNode } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { KanbanBoard } from "@/components/dashboard-ui/kanban/kanban-board";
import { KanbanColumnShell } from "@/components/dashboard-ui/kanban/kanban-column";
import { KanbanCardShell } from "@/components/dashboard-ui/kanban/kanban-card";
import { KanbanEmptyColumn } from "@/components/dashboard-ui/kanban/kanban-empty-column";
import { cn } from "@/lib/utils";

export type KanbanColumnDef = {
  id: string;
  title: string;
  accentClassName?: string;
};

export type KanbanShellItem = {
  id: string;
};

export function KanbanShell<T extends KanbanShellItem>({
  columns,
  itemsByColumn,
  columnIds,
  onMove,
  renderCard,
  renderOverlay,
  className,
}: {
  columns: KanbanColumnDef[];
  itemsByColumn: Record<string, T[]>;
  /** Allowed drop ids (column ids). Used to resolve drop target. */
  columnIds: string[];
  onMove: (itemId: string, toColumnId: string) => void | Promise<void>;
  renderCard: (item: T, ctx: { isDragging: boolean }) => ReactNode;
  renderOverlay?: (item: T) => ReactNode;
  className?: string;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const allItems = useMemo(
    () => columns.flatMap((c) => itemsByColumn[c.id] ?? []),
    [columns, itemsByColumn]
  );
  const activeItem = activeId ? allItems.find((i) => i.id === activeId) : null;
  const columnIdSet = useMemo(() => new Set(columnIds), [columnIds]);

  /**
   * Prioriza droppables de coluna (inclui colunas vazias).
   * closestCorners sozinho tende a ignorar colunas sem cards.
   */
  const collisionDetection: CollisionDetection = useCallback(
    (args) => {
      const pointerHits = pointerWithin(args);
      const overColumn = pointerHits.find((c) => columnIdSet.has(String(c.id)));
      if (overColumn) {
        return [overColumn];
      }

      const corners = closestCorners(args);
      const cornerColumn = corners.find((c) => columnIdSet.has(String(c.id)));
      if (cornerColumn) {
        return [cornerColumn];
      }

      return corners;
    },
    [columnIdSet]
  );

  function resolveColumnId(overId: string): string | null {
    if (columnIdSet.has(overId)) return overId;
    for (const col of columns) {
      const hit = (itemsByColumn[col.id] ?? []).find((i) => i.id === overId);
      if (hit) return col.id;
    }
    return null;
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);
    if (!over || active.id === over.id) return;
    const toColumn = resolveColumnId(String(over.id));
    if (!toColumn) return;
    await onMove(String(active.id), toColumn);
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <KanbanBoard className={className}>
        {columns.map((col) => (
          <KanbanDropColumn
            key={col.id}
            column={col}
            items={itemsByColumn[col.id] ?? []}
            renderCard={renderCard}
          />
        ))}
      </KanbanBoard>
      <DragOverlay>
        {activeItem
          ? (renderOverlay?.(activeItem) ?? (
              <div className="opacity-90">{renderCard(activeItem, { isDragging: true })}</div>
            ))
          : null}
      </DragOverlay>
    </DndContext>
  );
}

function KanbanDropColumn<T extends KanbanShellItem>({
  column,
  items,
  renderCard,
}: {
  column: KanbanColumnDef;
  items: T[];
  renderCard: (item: T, ctx: { isDragging: boolean }) => ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  const itemIds = items.map((i) => i.id);

  return (
    <KanbanColumnShell
      title={column.title}
      count={items.length}
      accentClassName={column.accentClassName}
      bodyRef={setNodeRef}
      bodyClassName={cn(
        "min-h-[200px] sm:min-h-[240px]",
        isOver && "bg-primary/5 ring-1 ring-inset ring-primary/20"
      )}
    >
      <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
        {items.length === 0 ? (
          <KanbanEmptyColumn className="pointer-events-none" />
        ) : (
          items.map((item) => (
            <KanbanSortableCard key={item.id} id={item.id} renderCard={renderCard} item={item} />
          ))
        )}
      </SortableContext>
    </KanbanColumnShell>
  );
}

function KanbanSortableCard<T extends KanbanShellItem>({
  id,
  item,
  renderCard,
}: {
  id: string;
  item: T;
  renderCard: (item: T, ctx: { isDragging: boolean }) => ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={cn(isDragging && "opacity-40")}
      {...attributes}
      {...listeners}
    >
      {renderCard(item, { isDragging })}
    </div>
  );
}

export { KanbanCardShell, KanbanEmptyColumn, KanbanBoard, KanbanColumnShell };
