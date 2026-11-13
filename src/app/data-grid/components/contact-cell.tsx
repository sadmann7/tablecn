"use client";

import * as React from "react";

import type { DataGridCellProps } from "@/lib/data-grid-types";

import {
  DataGridCell,
  useCellValue,
} from "@/registry/bases/radix/components/data-grid/data-grid-cell";
import { CellEditorPopover } from "@/registry/bases/radix/components/data-grid/data-grid-cell-variants";
import { Button } from "@/registry/bases/radix/ui/button";
import { Input } from "@/registry/bases/radix/ui/input";
import { Label } from "@/registry/bases/radix/ui/label";

import type { Contact, Person } from "../lib/seeds";

export function ContactCell(props: DataGridCellProps<Person>) {
  const { cell, isEditing, readOnly } = props;
  const contact = getContact(useCellValue(cell));
  const containerRef = React.useRef<HTMLDivElement>(null);

  const onSave = React.useCallback(
    (newContact: Contact | null) => {
      cell.setValue(newContact);
      cell.table.stopEditing();
    },
    [cell],
  );

  return (
    <DataGridCell
      {...props}
      ref={containerRef}
      onMouseDown={isEditing ? onEditingCellMouseDown : undefined}
    >
      <CellEditorPopover
        cell={cell}
        open={isEditing}
        readOnly={readOnly}
        containerRef={containerRef}
        className="w-72"
        onKeyDown={onEditorKeyDown}
      >
        <ContactForm contact={contact} onSave={onSave} />
      </CellEditorPopover>
      {contact ? (
        <span data-slot="data-grid-cell-content" dir="auto">
          {contact.name}{" "}
          <span className="text-muted-foreground">{contact.phone}</span>
        </span>
      ) : null}
    </DataGridCell>
  );
}

export function parseContact(text: string): Contact | null | undefined {
  if (!text) return null;
  try {
    return getContact(JSON.parse(text)) ?? undefined;
  } catch {
    return undefined;
  }
}

export function sortContacts(
  rowA: { original: Person },
  rowB: { original: Person },
) {
  return (rowA.original.contact?.name ?? "").localeCompare(
    rowB.original.contact?.name ?? "",
  );
}

interface ContactFormProps {
  contact: Contact | null;
  onSave: (contact: Contact | null) => void;
}

function ContactForm({ contact, onSave }: ContactFormProps) {
  const id = React.useId();
  const [name, setName] = React.useState(contact?.name ?? "");
  const [phone, setPhone] = React.useState(contact?.phone ?? "");

  const onSubmit = React.useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const newContact = { name: name.trim(), phone: phone.trim() };
      onSave(newContact.name || newContact.phone ? newContact : null);
    },
    [name, phone, onSave],
  );

  return (
    <form className="flex flex-col gap-3 p-3" onSubmit={onSubmit}>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-name`}>Name</Label>
        <Input
          id={`${id}-name`}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-phone`}>Phone</Label>
        <Input
          id={`${id}-phone`}
          type="tel"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
        />
      </div>
      <Button type="submit" size="sm" className="self-end">
        Save
      </Button>
    </form>
  );
}

function getContact(value: unknown): Contact | null {
  if (!value || typeof value !== "object") return null;
  const { name, phone } = value as Record<string, unknown>;
  return typeof name === "string" && typeof phone === "string"
    ? { name, phone }
    : null;
}

// Keys bubble from the portaled form to the cell, which ends editing on Tab and Enter.
function onEditorKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
  if (event.key === "Tab" || event.key === "Enter") event.stopPropagation();
}

function onEditingCellMouseDown(event: React.MouseEvent) {
  event.preventDefault();
}
