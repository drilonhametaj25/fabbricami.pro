// Imports
import { z } from 'zod';

// Types/Interfaces

// Constants

// Main logic

/**
 * Calendar Schemas
 * Validazione Zod per gestione eventi calendario
 */

export const createEventSchema = z.object({
  body: z.object({
    title: z.string().min(1).max(255),
    description: z.string().optional(),
    eventType: z.string().min(1).max(50),
    startDate: z.coerce.date(),
    endDate: z.coerce.date().optional(),
    allDay: z.boolean().default(false),
    location: z.string().max(255).optional(),
    relatedId: z.string().uuid().optional(),
    reminderMinutes: z.number().int().min(0).optional(),
  }),
});

export const updateEventSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    title: z.string().min(1).max(255).optional(),
    description: z.string().optional(),
    eventType: z.string().min(1).max(50).optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    allDay: z.boolean().optional(),
    location: z.string().max(255).optional(),
    reminderMinutes: z.number().int().min(0).optional(),
  }),
});

export const listEventsSchema = z.object({
  query: z.object({
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    eventType: z.string().optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(500).default(100),
  }),
});

export const eventIdSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
});

export const monthEventsSchema = z.object({
  query: z.object({
    year: z.coerce.number().int().min(2000).max(2100),
    month: z.coerce.number().int().min(0).max(11), // 0-11 per JavaScript Date
  }),
});

// Exports
export type CreateEventInput = z.infer<typeof createEventSchema>['body'];
export type UpdateEventInput = z.infer<typeof updateEventSchema>['body'];
export type ListEventsQuery = z.infer<typeof listEventsSchema>['query'];
export type MonthEventsQuery = z.infer<typeof monthEventsSchema>['query'];
