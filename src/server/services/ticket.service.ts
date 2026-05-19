import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { emailService } from './email.service';
import type { TicketStatus, TicketPriority, TicketType } from '@prisma/client';

export interface CreateTicketInput {
  tenantId: string;
  createdById: string;
  type: TicketType;
  priority?: TicketPriority;
  title: string;
  description: string;
}

export interface UpdateTicketInput {
  status?: TicketStatus;
  priority?: TicketPriority;
  adminNotes?: string | null;
}

export interface TicketFilter {
  tenantId?: string;
  status?: TicketStatus;
  type?: TicketType;
  priority?: TicketPriority;
  createdById?: string;
  limit?: number;
  offset?: number;
}

class TicketService {
  async create(input: CreateTicketInput) {
    const ticket = await prisma.ticket.create({
      data: {
        tenantId: input.tenantId,
        createdById: input.createdById,
        type: input.type,
        priority: input.priority || 'NORMAL',
        title: input.title,
        description: input.description,
      },
    });

    // Notify super admin (best-effort)
    const recipient = process.env.SUPPORT_NOTIFICATION_EMAIL;
    if (recipient) {
      emailService
        .sendOrderStatusUpdate({
          customerEmail: recipient,
          customerName: 'Super Admin',
          orderNumber: `TICKET-${ticket.id.slice(0, 8)}`,
          oldStatus: '-',
          newStatus: 'OPEN',
          statusLabel: `Nuovo ticket [${ticket.type}]: ${ticket.title}`,
          note: ticket.description.slice(0, 500),
        })
        .catch((err) => logger.warn(`Could not notify support email: ${err.message}`));
    }

    return ticket;
  }

  async list(filter: TicketFilter) {
    const where: any = {};
    if (filter.tenantId) where.tenantId = filter.tenantId;
    if (filter.status) where.status = filter.status;
    if (filter.type) where.type = filter.type;
    if (filter.priority) where.priority = filter.priority;
    if (filter.createdById) where.createdById = filter.createdById;

    const [items, total] = await Promise.all([
      prisma.ticket.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: filter.limit ?? 50,
        skip: filter.offset ?? 0,
      }),
      prisma.ticket.count({ where }),
    ]);

    return { items, total };
  }

  async getById(id: string, tenantId?: string) {
    const where: any = { id };
    if (tenantId) where.tenantId = tenantId;
    return prisma.ticket.findFirst({ where });
  }

  async update(id: string, input: UpdateTicketInput) {
    const data: any = { ...input };
    if (input.status === 'RESOLVED' || input.status === 'CLOSED') {
      data.resolvedAt = new Date();
    }
    return prisma.ticket.update({ where: { id }, data });
  }

  async notifyCustomerOnStatusChange(ticketId: string) {
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
    });
    if (!ticket) return;

    const user = await prisma.user.findUnique({ where: { id: ticket.createdById } });
    if (!user?.email) return;

    const statusLabels: Record<string, string> = {
      OPEN: 'In attesa',
      IN_REVIEW: 'In revisione',
      IN_PROGRESS: 'In lavorazione',
      RESOLVED: 'Risolto',
      CLOSED: 'Chiuso',
      REJECTED: 'Rifiutato',
    };

    emailService
      .sendOrderStatusUpdate({
        customerEmail: user.email,
        customerName: user.firstName || 'Cliente',
        orderNumber: `TICKET-${ticket.id.slice(0, 8)}`,
        oldStatus: '-',
        newStatus: ticket.status,
        statusLabel: statusLabels[ticket.status] || ticket.status,
        note: ticket.adminNotes || undefined,
      })
      .catch((err) => logger.warn(`Could not notify ticket user: ${err.message}`));
  }
}

export const ticketService = new TicketService();
