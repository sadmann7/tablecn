"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader, Plus } from "lucide-react";
import * as React from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/registry/bases/radix/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/registry/bases/radix/ui/sheet";

import type { CreateTaskSchema } from "../lib/validations";

import { createTask } from "../lib/actions";
import { createTaskSchema } from "../lib/validations";
import { TaskForm } from "./task-form";

export function CreateTaskSheet() {
  const [open, setOpen] = React.useState(false);
  const [isPending, startTransition] = React.useTransition();

  const form = useForm<CreateTaskSchema>({
    resolver: zodResolver(createTaskSchema),
  });

  function onSubmit(input: CreateTaskSchema) {
    startTransition(async () => {
      const { error } = await createTask(input);

      if (error) {
        toast.error(error);
        return;
      }

      form.reset();
      setOpen(false);
      toast.success("Task created");
    });
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline">
          <Plus />
          New task
        </Button>
      </SheetTrigger>
      <SheetContent className="flex flex-col gap-6 sm:max-w-md">
        <SheetHeader className="text-left">
          <SheetTitle>Create task</SheetTitle>
          <SheetDescription>
            Fill in the details below to create a new task
          </SheetDescription>
        </SheetHeader>
        <TaskForm className="flex-1 px-4" form={form} onSubmit={onSubmit}>
          <SheetFooter className="px-0">
            <SheetClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </SheetClose>
            <Button disabled={isPending}>
              {isPending && <Loader className="animate-spin" />}
              Create
            </Button>
          </SheetFooter>
        </TaskForm>
      </SheetContent>
    </Sheet>
  );
}
