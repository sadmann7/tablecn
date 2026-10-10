"use client";

import type { UserPresence } from "@party/types";

import { cn } from "cn";
import * as React from "react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/registry/bases/radix/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/registry/bases/radix/ui/tooltip";

const MAX_VISIBLE_USERS = 5;

type ActiveCell = UserPresence["activeCell"];

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0] ?? "")
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

interface DataGridPresenceAvatarsProps {
  users: Record<string, UserPresence>;
  currentUserId: string;
  /** Describes the cell someone is on, such as "Name · row 3", or `null` when they're not on one. */
  getCellLabel: (activeCell: ActiveCell) => string | null;
  onUserClick?: (userId: string, user: UserPresence) => void;
}

export function DataGridPresenceAvatars({
  users,
  currentUserId,
  getCellLabel,
  onUserClick,
}: DataGridPresenceAvatarsProps) {
  const [isListOpen, setIsListOpen] = React.useState(false);

  // You first, then everyone else by name so the order doesn't jump around as people move
  const userList = React.useMemo(
    () =>
      Object.entries(users).sort(([aId, a], [bId, b]) => {
        if (aId === currentUserId) return -1;
        if (bId === currentUserId) return 1;
        return a.name.localeCompare(b.name);
      }),
    [users, currentUserId],
  );

  if (userList.length === 0) return null;

  const visibleUsers = userList.slice(0, MAX_VISIBLE_USERS);
  const hiddenCount = userList.length - visibleUsers.length;

  return (
    <div className="flex items-center">
      {visibleUsers.map(([userId, user], index) => {
        const isCurrentUser = userId === currentUserId;
        const cellLabel = getCellLabel(user.activeCell);
        const canJump = !isCurrentUser && cellLabel !== null;

        return (
          <Tooltip key={userId}>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label={
                  canJump
                    ? `Go to ${user.name}'s cell, ${cellLabel}`
                    : isCurrentUser
                      ? `${user.name} (you)`
                      : user.name
                }
                aria-disabled={!canJump}
                className={cn(
                  "relative flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white ring-2 ring-background transition-transform outline-none hover:z-10 hover:-translate-y-0.5 focus-visible:z-10 focus-visible:ring-ring",
                  index > 0 && "-ms-1.5",
                  canJump ? "cursor-pointer" : "cursor-default",
                )}
                style={{
                  backgroundColor: user.color,
                  zIndex: visibleUsers.length - index,
                }}
                onClick={() => {
                  if (canJump) onUserClick?.(userId, user);
                }}
              >
                {getInitials(user.name)}
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="flex flex-col gap-0.5">
              <span className="font-medium">
                {user.name}
                {isCurrentUser && " (you)"}
              </span>
              <span className="opacity-70">{cellLabel ?? "Not on a cell"}</span>
            </TooltipContent>
          </Tooltip>
        );
      })}
      {hiddenCount > 0 && (
        <Popover open={isListOpen} onOpenChange={setIsListOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={`Show ${hiddenCount} more ${hiddenCount === 1 ? "person" : "people"}`}
              className="relative -ms-1.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground ring-2 ring-background outline-none hover:bg-accent focus-visible:ring-ring"
            >
              +{hiddenCount}
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-64 p-1">
            <ul className="flex max-h-80 flex-col overflow-y-auto">
              {userList.map(([userId, user]) => {
                const isCurrentUser = userId === currentUserId;
                const cellLabel = getCellLabel(user.activeCell);
                const canJump = !isCurrentUser && cellLabel !== null;

                return (
                  <li key={userId}>
                    <button
                      type="button"
                      disabled={!canJump}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-start text-sm outline-none focus-visible:bg-accent enabled:hover:bg-accent"
                      onClick={() => {
                        onUserClick?.(userId, user);
                        setIsListOpen(false);
                      }}
                    >
                      <span
                        aria-hidden="true"
                        className="flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white"
                        style={{ backgroundColor: user.color }}
                      >
                        {getInitials(user.name)}
                      </span>
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate font-medium">
                          {user.name}
                          {isCurrentUser && " (you)"}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">
                          {cellLabel ?? "Not on a cell"}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
