import { z } from 'zod';

/**
 * Schema validazione creazione task
 */
export const createTaskSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
  status: z.enum(['TODO', 'IN_PROGRESS', 'REVIEW', 'BLOCKED', 'DONE', 'CANCELLED']).default('TODO'),
  assignedToId: z.string().uuid().optional(),
  createdById: z.string().uuid(),
  orderId: z.string().uuid().optional(),
  workflowId: z.string().uuid().optional(),
  workflowStep: z.number().int().optional(),
  dueDate: z.string().datetime().optional(),
  estimatedHours: z.number().positive().optional(),
  actualHours: z.number().nonnegative().optional(),
  completedDate: z.string().datetime().optional(),
});

export const updateTaskSchema = createTaskSchema.partial().omit({ createdById: true });

/**
 * Schema validazione cambio stato task
 */
export const updateTaskStatusSchema = z.object({
  status: z.enum(['TODO', 'IN_PROGRESS', 'REVIEW', 'BLOCKED', 'DONE', 'CANCELLED']),
  notes: z.string().optional(),
  actualHours: z.number().nonnegative().optional(),
});

/**
 * Schema validazione assegnazione task
 */
export const assignTaskSchema = z.object({
  taskId: z.string().uuid(),
  assignedToId: z.string().uuid(),
  notes: z.string().optional(),
  notifyUser: z.boolean().default(true),
});

/**
 * Schema validazione workflow template
 */
export const createWorkflowTemplateSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  orderType: z.enum(['WEB', 'B2B', 'MANUAL', 'WORDPRESS']),
  stages: z.array(z.object({
    sequence: z.number().int().positive(),
    name: z.string().min(1).max(100),
    description: z.string().optional(),
    taskType: z.enum(['ORDER_PROCESSING', 'PRODUCTION', 'SHIPPING', 'QUALITY_CHECK', 'MAINTENANCE', 'OTHER']),
    estimatedHours: z.number().positive().optional(),
    requiredSkills: z.array(z.string()).optional(),
    autoAssign: z.boolean().default(false),
  })).min(1),
  isActive: z.boolean().default(true),
});

export const updateWorkflowTemplateSchema = createWorkflowTemplateSchema.partial();

/**
 * Schema per query task
 */
export const taskQuerySchema = z.object({
  page: z.string().transform(Number).pipe(z.number().int().positive()).optional(),
  limit: z.string().transform(Number).pipe(z.number().int().positive().max(100)).optional(),
  assignedToId: z.string().uuid().optional(),
  createdById: z.string().uuid().optional(),
  orderId: z.string().uuid().optional(),
  status: z.enum(['TODO', 'IN_PROGRESS', 'REVIEW', 'BLOCKED', 'DONE', 'CANCELLED']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  type: z.enum(['ORDER_PROCESSING', 'PRODUCTION', 'SHIPPING', 'QUALITY_CHECK', 'MAINTENANCE', 'OTHER']).optional(),
  overdue: z.enum(['true', 'false']).transform(val => val === 'true').optional(),
  search: z.string().optional(),
  sortBy: z.enum(['title', 'priority', 'dueDate', 'status', 'createdAt']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

/**
 * Schema per tracking tempi task
 */
export const trackTaskTimeSchema = z.object({
  taskId: z.string().uuid(),
  employeeId: z.string().uuid(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime().optional(),
  notes: z.string().optional(),
}).refine(data => {
  if (data.endTime) {
    return new Date(data.endTime) > new Date(data.startTime);
  }
  return true;
}, {
  message: "End time must be after start time",
  path: ["endTime"],
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type UpdateTaskStatusInput = z.infer<typeof updateTaskStatusSchema>;
export type AssignTaskInput = z.infer<typeof assignTaskSchema>;
export type CreateWorkflowTemplateInput = z.infer<typeof createWorkflowTemplateSchema>;
export type UpdateWorkflowTemplateInput = z.infer<typeof updateWorkflowTemplateSchema>;
export type TaskQuery = z.infer<typeof taskQuerySchema>;
export type TrackTaskTimeInput = z.infer<typeof trackTaskTimeSchema>;
