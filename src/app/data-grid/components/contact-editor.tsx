"use client";

import * as React from "react";

import type { CellEditorProps } from "@/lib/data-grid-types";

import { insertTextAtSelection } from "@/lib/data-grid-utils";
import { Button } from "@/registry/bases/radix/ui/button";
import { Input } from "@/registry/bases/radix/ui/input";
import { Label } from "@/registry/bases/radix/ui/label";

import type { Contact, Person } from "../lib/seeds";

export function ContactEditor({
  value,
  pendingChar,
  onValueChange,
  onCommit,
}: CellEditorProps) {
  const id = React.useId();
  const nameInputRef = React.useRef<HTMLInputElement>(null);
  const contact = getContact(value);
  const name = contact?.name ?? "";
  const phone = contact?.phone ?? "";

  React.useEffect(() => {
    if (!pendingChar) return;
    const frame = requestAnimationFrame(() => {
      const input = nameInputRef.current;
      if (input) insertTextAtSelection(input, pendingChar);
    });
    return () => cancelAnimationFrame(frame);
  }, [pendingChar]);

  const onSubmit = React.useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      onCommit();
    },
    [onCommit],
  );

  const onNameChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      onValueChange(getDraftContact(event.target.value, phone));
    },
    [phone, onValueChange],
  );

  const onPhoneChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      onValueChange(getDraftContact(name, event.target.value));
    },
    [name, onValueChange],
  );

  return (
    <form className="flex flex-col gap-3 p-3" onSubmit={onSubmit}>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-name`}>Name</Label>
        <Input
          ref={nameInputRef}
          id={`${id}-name`}
          value={name}
          onChange={onNameChange}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-phone`}>Phone</Label>
        <Input
          id={`${id}-phone`}
          type="tel"
          value={phone}
          onChange={onPhoneChange}
        />
      </div>
      <Button type="submit" size="sm" className="self-end">
        Save
      </Button>
    </form>
  );
}

interface ContactSummaryProps {
  contact: Contact | null | undefined;
}

export function ContactSummary({ contact }: ContactSummaryProps) {
  if (!contact) return null;

  return (
    <span data-slot="data-grid-cell-content" dir="auto">
      {contact.name}{" "}
      <span className="text-muted-foreground">{contact.phone}</span>
    </span>
  );
}

export function formatContact(value: unknown): string {
  const contact = getContact(value);
  if (!contact) return "";
  return contact.phone ? `${contact.name}, ${contact.phone}` : contact.name;
}

export function parseContact(text: string): Contact | null | undefined {
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("{")) {
    try {
      return getContact(JSON.parse(trimmed)) ?? undefined;
    } catch {
      return undefined;
    }
  }
  const separatorIndex = trimmed.lastIndexOf(", ");
  if (separatorIndex === -1) return { name: trimmed, phone: "" };
  return {
    name: trimmed.slice(0, separatorIndex).trim(),
    phone: trimmed.slice(separatorIndex + 2).trim(),
  };
}

export function sortContacts(
  rowA: { original: Person },
  rowB: { original: Person },
) {
  return (rowA.original.contact?.name ?? "").localeCompare(
    rowB.original.contact?.name ?? "",
  );
}

function getDraftContact(name: string, phone: string): Contact | null {
  return name || phone ? { name, phone } : null;
}

function getContact(value: unknown): Contact | null {
  if (!value || typeof value !== "object") return null;
  const { name, phone } = value as Record<string, unknown>;
  return typeof name === "string" && typeof phone === "string"
    ? { name, phone }
    : null;
}
