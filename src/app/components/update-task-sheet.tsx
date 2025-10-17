"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader } from "lucide-react";
import * as React from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { Task } from "@/db/schema";

import { updateTask } from "../lib/actions";
import { type UpdateTaskSchema, updateTaskSchema } from "../lib/validations";
import { TaskForm } from "./task-form";

interface UpdateTaskSheetProps
  extends React.ComponentPropsWithRef<typeof Sheet> {
  task: Task | null;
}

export function UpdateTaskSheet({ task, ...props }: UpdateTaskSheetProps) {
  const [isPending, startTransition] = React.useTransition();

  const form = useForm<UpdateTaskSchema>({
    resolver: zodResolver(updateTaskSchema),
    defaultValues: {
      title: task?.title ?? "",
      label: task?.label,
      status: task?.status,
      priority: task?.priority,
    },
  });

  function onSubmit(input: UpdateTaskSchema) {
    startTransition(async () => {
      if (!task) return;

      const { error } = await updateTask({
        id: task.id,
        ...input,
      });

      if (error) {
        toast.error(error);
        return;
      }

      form.reset(input);
      props.onOpenChange?.(false);
      toast.success("Task updated");
    });
  }

  return (
    <Sheet {...props}>
      <SheetContent className="flex flex-col gap-6 sm:max-w-md">
        <SheetHeader className="text-left">
          <SheetTitle>Update task</SheetTitle>
          <SheetDescription>
            Update the task details and save the changes
          </SheetDescription>
        </SheetHeader>
        <TaskForm<UpdateTaskSchema> form={form} onSubmit={onSubmit}>
          <SheetFooter className="gap-2 pt-2 sm:space-x-0">
            <SheetClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </SheetClose>
            <Button disabled={isPending}>
              {isPending && (
                <Loader
                  className="mr-2 size-4 animate-spin"
                  aria-hidden="true"
                />
              )}
              Save
            </Button>
          </SheetFooter>
        </TaskForm>
      </SheetContent>
    </Sheet>
  );
}
