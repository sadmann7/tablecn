import { z } from "zod";
import { employees } from "@/db/schema";

const documentSchema = z.object({
  id: z.string(),
  name: z.string(),
  size: z.number(),
  type: z.string(),
  url: z.string().optional(),
});

export const employeeSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  email: z.string().nullable(),
  department: z.enum(employees.department.enumValues),
  role: z.enum(employees.role.enumValues),
  status: z.enum(employees.status.enumValues),
  salary: z.number(),
  startDate: z.coerce.date().nullable(),
  isVerified: z.boolean(),
  skills: z.array(z.string()).nullable(),
  documents: z.array(documentSchema).nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date().nullable(),
});

export const insertEmployeeSchema = z.object({
  name: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  department: z.enum(employees.department.enumValues).optional(),
  role: z.enum(employees.role.enumValues).optional(),
  status: z.enum(employees.status.enumValues).optional(),
  salary: z.number().optional(),
  startDate: z.coerce.date().nullable().optional(),
  isVerified: z.boolean().optional(),
  skills: z.array(z.string()).nullable().optional(),
  documents: z.array(documentSchema).nullable().optional(),
});

export const insertEmployeesSchema = z.object({
  employees: z.array(insertEmployeeSchema).min(1),
});

export const updateEmployeeSchema = z.object({
  name: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  department: z.enum(employees.department.enumValues).optional(),
  role: z.enum(employees.role.enumValues).optional(),
  status: z.enum(employees.status.enumValues).optional(),
  salary: z.number().optional(),
  startDate: z.coerce.date().nullable().optional(),
  isVerified: z.boolean().optional(),
  skills: z.array(z.string()).nullable().optional(),
  documents: z.array(documentSchema).nullable().optional(),
});

export const updateEmployeesSchema = z.object({
  updates: z
    .array(
      z.object({
        id: z.string(),
        changes: updateEmployeeSchema,
      }),
    )
    .min(1),
});

export const deleteEmployeesSchema = z.object({
  ids: z.array(z.string()).min(1),
});

export type EmployeeSchema = z.infer<typeof employeeSchema>;
