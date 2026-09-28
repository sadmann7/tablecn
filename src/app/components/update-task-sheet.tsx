"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader } from "lucide-react";
import * as React from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import type { Task } from "@/db/schema";

import { Button } from "@/registry/bases/radix/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/registry/bases/radix/ui/sheet";

import { updateTask } from "../lib/actions";
import { type UpdateTaskSchema, updateTaskSchema } from "../lib/validations";
import { TaskForm } from "./task-form";

interface UpdateTaskFormProps {
  task: Task;
  onClose: () => void;
}

function UpdateTaskForm({ task, onClose }: UpdateTaskFormProps) {
  const [isPending, startTransition] = React.useTransition();

  const form = useForm<UpdateTaskSchema>({
    resolver: zodResolver(updateTaskSchema),
    defaultValues: {
      title: task.title ?? "",
      label: task.label,
      status: task.status,
      priority: task.priority,
      estimatedHours: task.estimatedHours,
    },
  });

  function onSubmit(input: UpdateTaskSchema) {
    startTransition(async () => {
      const { error } = await updateTask({
        id: task.id,
        ...input,
      });

      if (error) {
        toast.error(error);
        return;
      }

      form.reset(input);
      onClose();
      toast.success("Task updated");
    });
  }

  return (
    <TaskForm<UpdateTaskSchema>
      className="flex-1 px-4"
      form={form}
      onSubmit={onSubmit}
    >
      <SheetFooter className="px-0">
        <Button disabled={isPending}>
          {isPending && <Loader className="size-4 animate-spin" />}
          Save
        </Button>
        <SheetClose asChild>
          <Button type="button" variant="outline">
            Cancel
          </Button>
        </SheetClose>
      </SheetFooter>
    </TaskForm>
  );
}

interface UpdateTaskSheetProps extends React.ComponentPropsWithRef<
  typeof Sheet
> {
  task: Task | null;
}

export function UpdateTaskSheet({
  task,
  onOpenChange,
  ...props
}: UpdateTaskSheetProps) {
  return (
    <Sheet onOpenChange={onOpenChange} {...props}>
      <SheetContent className="flex flex-col gap-6 sm:max-w-md">
        <SheetHeader className="text-left">
          <SheetTitle>Update task</SheetTitle>
          <SheetDescription>
            Update the task details and save the changes
          </SheetDescription>
        </SheetHeader>
        {task ? (
          <UpdateTaskForm
            key={task.id}
            task={task}
            onClose={() => onOpenChange?.(false)}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
