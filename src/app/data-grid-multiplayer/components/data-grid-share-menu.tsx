"use client";

import { Link2, LogOut, Plus, Share2 } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/registry/bases/radix/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/registry/bases/radix/ui/dropdown-menu";

import { createRoomId, getRoomPath, PUBLIC_ROOM_ID } from "../lib/rooms";

interface DataGridShareMenuProps {
  roomId: string;
}

export function DataGridShareMenu({ roomId }: DataGridShareMenuProps) {
  const router = useRouter();
  const isPublic = roomId === PUBLIC_ROOM_ID;

  const onCopyLink = React.useCallback(() => {
    const url = `${window.location.origin}${getRoomPath(roomId)}`;
    navigator.clipboard
      .writeText(url)
      .then(() => toast.success("Room link copied"))
      .catch(() => toast.error("Couldn't copy the room link"));
  }, [roomId]);

  const onRoomCreate = React.useCallback(() => {
    router.push(getRoomPath(createRoomId()));
  }, [router]);

  const onPublicRoomJoin = React.useCallback(() => {
    router.push(getRoomPath(PUBLIC_ROOM_ID));
  }, [router]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">
          <Share2 className="text-muted-foreground" />
          Share
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem onSelect={onCopyLink}>
          <Link2 />
          Copy room link
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onRoomCreate}>
          <Plus />
          New private room
        </DropdownMenuItem>
        {!isPublic && (
          <DropdownMenuItem onSelect={onPublicRoomJoin}>
            <LogOut />
            Back to public room
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
