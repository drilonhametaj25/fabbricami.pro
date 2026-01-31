// Imports
import { z } from 'zod';
import { NotificationType } from '@prisma/client';

// Types/Interfaces

// Constants

// Main logic

/**
 * Notification Schemas
 * Validazione Zod per gestione notifiche
 */

export const createNotificationSchema = z.object({
  body: z.object({
    userId: z.string().uuid(),
    type: z.nativeEnum(NotificationType),
    title: z.string().min(1).max(255),
    message: z.string().min(1),
    link: z.string().optional(),
  }),
});

export const listNotificationsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    includeRead: z.coerce.boolean().default(false),
    type: z.nativeEnum(NotificationType).optional(),
  }),
});

export const notificationIdSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
});

export const markAsReadSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
});

export const markAllAsReadSchema = z.object({
  body: z.object({}).optional(),
});

// Exports
export type CreateNotificationInput = z.infer<typeof createNotificationSchema>['body'];
export type ListNotificationsQuery = z.infer<typeof listNotificationsSchema>['query'];
