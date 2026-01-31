import { z } from 'zod';

/**
 * Schema validazione creazione dipendente
 */
export const createEmployeeSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email(),
  phone: z.string().max(20).optional(),
  taxCode: z.string().max(20).optional(),
  hireDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Invalid date format',
  }),
  terminationDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Invalid date format',
  }).optional(),
  position: z.string().max(100),
  department: z.string().max(100).optional(),
  hourlyCost: z.number().positive(),
  weeklyHours: z.number().positive().default(40),
  isActive: z.boolean().default(true),
  userId: z.string().uuid().optional(), // Collegamento a User per login
  notes: z.string().optional(),
  password: z.string().min(6).optional(), // Password per creare utente associato
});

export const updateEmployeeSchema = createEmployeeSchema.partial();

/**
 * Schema validazione timbratura
 */
export const createTimeEntrySchema = z.object({
  employeeId: z.string().uuid(),
  type: z.enum(['CLOCK_IN', 'CLOCK_OUT', 'BREAK_START', 'BREAK_END']),
  timestamp: z.string().datetime(),
  taskId: z.string().uuid().optional(),
  notes: z.string().optional(),
  location: z.string().max(100).optional(),
  ipAddress: z.string().ip().optional(),
});

/**
 * Schema validazione ore lavorate per task
 */
export const createTaskTimeSchema = z.object({
  employeeId: z.string().uuid(),
  taskId: z.string().uuid(),
  date: z.string().datetime(),
  hoursWorked: z.number().positive(),
  notes: z.string().optional(),
});

export const updateTaskTimeSchema = createTaskTimeSchema.partial().omit({ employeeId: true, taskId: true });

/**
 * Schema validazione ferie/permessi
 */
export const createLeaveRequestSchema = z.object({
  employeeId: z.string().uuid(),
  type: z.enum(['VACATION', 'SICK_LEAVE', 'PERSONAL', 'MATERNITY', 'PATERNITY', 'OTHER']),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).default('PENDING'),
  reason: z.string().optional(),
  notes: z.string().optional(),
  approvedBy: z.string().uuid().optional(),
  approvedAt: z.string().datetime().optional(),
}).refine(data => new Date(data.endDate) >= new Date(data.startDate), {
  message: "End date must be after start date",
  path: ["endDate"],
});

export const updateLeaveRequestSchema = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED']),
  notes: z.string().optional(),
  approvedBy: z.string().uuid().optional(),
});

/**
 * Schema per query dipendenti
 */
export const employeeQuerySchema = z.object({
  page: z.string().transform(Number).pipe(z.number().int().positive()).optional(),
  limit: z.string().transform(Number).pipe(z.number().int().positive().max(100)).optional(),
  isActive: z.enum(['true', 'false']).transform(val => val === 'true').optional(),
  department: z.string().optional(),
  position: z.string().optional(),
  search: z.string().optional(),
  sortBy: z.enum(['user.firstName', 'user.lastName', 'position', 'hireDate', 'employeeCode']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

/**
 * Schema per report produttività
 */
export const productivityReportSchema = z.object({
  employeeId: z.string().uuid().optional(),
  dateFrom: z.string().datetime(),
  dateTo: z.string().datetime(),
  groupBy: z.enum(['day', 'week', 'month']).optional(),
});

/**
 * Schema per calcolo ore lavorate
 */
export const workedHoursSchema = z.object({
  employeeId: z.string().uuid(),
  dateFrom: z.string().datetime(),
  dateTo: z.string().datetime(),
});

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;
export type CreateTimeEntryInput = z.infer<typeof createTimeEntrySchema>;
export type CreateTaskTimeInput = z.infer<typeof createTaskTimeSchema>;
export type UpdateTaskTimeInput = z.infer<typeof updateTaskTimeSchema>;
export type CreateLeaveRequestInput = z.infer<typeof createLeaveRequestSchema>;
export type UpdateLeaveRequestInput = z.infer<typeof updateLeaveRequestSchema>;
export type EmployeeQuery = z.infer<typeof employeeQuerySchema>;
export type ProductivityReportInput = z.infer<typeof productivityReportSchema>;
export type WorkedHoursInput = z.infer<typeof workedHoursSchema>;
