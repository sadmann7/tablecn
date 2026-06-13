"use client";

import type { UserPresence } from "@party/types";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

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
  onUserClick?: (userId: string, user: UserPresence) => void;
}

export function DataGridPresenceAvatars({
  users,
  currentUserId,
  onUserClick,
}: DataGridPresenceAvatarsProps) {
  const userList = Object.entries(users);

  return (
    <div className="flex items-center gap-2">
      {userList.length > 0 && (
        <div className="flex items-center">
          {userList.slice(0, 6).map(([userId, user], i) => (
            <Tooltip key={userId}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-background font-semibold text-[10px] text-white transition-transform hover:z-10 hover:scale-110",
                    i > 0 && "-ml-2",
                    userId === currentUserId || !user.activeCell.rowId
                      ? "cursor-default"
                      : "cursor-pointer",
                  )}
                  style={{ backgroundColor: user.color, zIndex: i }}
                  onClick={() => {
                    if (userId !== currentUserId) onUserClick?.(userId, user);
                  }}
                >
                  {getInitials(user.name)}
                  {userId === currentUserId && (
                    <span className="absolute -right-0.5 -bottom-0.5 h-2 w-2 rounded-full border border-background bg-green-500" />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {user.name}
                {userId === currentUserId ? " (you)" : ""}
              </TooltipContent>
            </Tooltip>
          ))}
          {userList.length > 6 && (
            <div className="-ml-2 flex h-7 w-7 items-center justify-center rounded-full border-2 border-background bg-muted font-semibold text-[10px] text-muted-foreground">
              +{userList.length - 6}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
