/**
 * Dashboard Service
 * Servizio per la dashboard intelligente "Cosa fare oggi"
 *
 * Fornisce:
 * - Saluto personalizzato con contesto
 * - KPI giornalieri in tempo reale
 * - Compiti urgenti e prioritari
 * - Piano giornaliero basato su ruolo
 * - Suggerimenti intelligenti
 * - Statistiche rapide
 */

import { prisma } from '../config/database';
import { suggestionEngineService } from './suggestion-engine.service';
import { UserRole, Prisma } from '@prisma/client';

// ============================================
// TYPES
// ============================================

export interface GreetingSection {
  message: string;
  subMessage: string;
  userName: string;
  currentTime: Date;
  dayOfWeek: string;
}

export interface KpiItem {
  id: string;
  label: string;
  value: number | string;
  previousValue?: number | string;
  changePercent?: number;
  trend?: 'up' | 'down' | 'stable';
  icon?: string;
  color?: string;
  link?: string;
}

export interface DailyKpiSection {
  items: KpiItem[];
  lastUpdated: Date;
}

export interface UrgentTask {
  id: string;
  type: 'ORDER' | 'TASK' | 'PRODUCTION' | 'PAYMENT' | 'STOCK' | 'SUPPLIER';
  title: string;
  description: string;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  dueDate?: Date;
  link: string;
  metadata?: Record<string, unknown>;
}

export interface UrgentTaskSection {
  items: UrgentTask[];
  total: number;
}

export interface DayPlanItem {
  id: string;
  time?: string;
  title: string;
  description?: string;
  type: 'MEETING' | 'TASK' | 'DEADLINE' | 'PRODUCTION' | 'DELIVERY' | 'OTHER';
  completed: boolean;
  link?: string;
}

export interface DayPlanSection {
  items: DayPlanItem[];
  completedCount: number;
  totalCount: number;
}

export interface QuickStat {
  id: string;
  label: string;
  value: number | string;
  suffix?: string;
  color?: 'success' | 'warning' | 'danger' | 'info';
}

export interface QuickStatsSection {
  items: QuickStat[];
}

export interface TodayDashboard {
  greeting: GreetingSection;
  dailyKpis: DailyKpiSection;
  urgentTasks: UrgentTaskSection;
  dayPlan: DayPlanSection;
  suggestions: {
    items: Awaited<ReturnType<typeof suggestionEngineService.list>>['items'];
    total: number;
    stats: Awaited<ReturnType<typeof suggestionEngineService.getStats>>;
  };
  quickStats: QuickStatsSection;
}

export interface DashboardPreferences {
  layout?: Array<{
    id: string;
    position: number;
    size: 'small' | 'medium' | 'large';
    visible: boolean;
  }>;
  emailDailyDigest: boolean;
  emailWeeklyDigest: boolean;
  emailUrgentAlerts: boolean;
  showSuggestions: boolean;
  suggestionTypes?: string[];
  defaultDateRange: string;
  showKpis: boolean;
  showUrgentTasks: boolean;
  showDayPlan: boolean;
  compactMode: boolean;
}

// ============================================
// SERVICE
// ============================================

class DashboardService {
  /**
   * Recupera la dashboard completa "Cosa fare oggi"
   */
  async getTodayDashboard(userId: string): Promise<TodayDashboard> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        employee: true,
        dashboardPreference: true,
      },
    });

    if (!user) {
      throw new Error('Utente non trovato');
    }

    // Esegui query in parallelo per performance
    const [greeting, dailyKpis, urgentTasks, dayPlan, suggestions, quickStats] = await Promise.all([
      this.getGreeting(user),
      this.getDailyKpis(user.role),
      this.getUrgentTasks(userId, user.role),
      this.getDayPlan(userId),
      this.getSuggestions(user.dashboardPreference),
      this.getQuickStats(user.role),
    ]);

    return {
      greeting,
      dailyKpis,
      urgentTasks,
      dayPlan,
      suggestions,
      quickStats,
    };
  }

  // ============================================
  // GREETING
  // ============================================

  private async getGreeting(user: { firstName: string; lastName: string }): Promise<GreetingSection> {
    const now = new Date();
    const hour = now.getHours();
    const dayOfWeek = now.toLocaleDateString('it-IT', { weekday: 'long' });

    let message: string;
    if (hour < 12) {
      message = 'Buongiorno';
    } else if (hour < 18) {
      message = 'Buon pomeriggio';
    } else {
      message = 'Buonasera';
    }

    // Genera sub-messaggio contestuale
    const subMessage = await this.generateContextualSubMessage();

    return {
      message: `${message}, ${user.firstName}!`,
      subMessage,
      userName: `${user.firstName} ${user.lastName}`,
      currentTime: now,
      dayOfWeek: dayOfWeek.charAt(0).toUpperCase() + dayOfWeek.slice(1),
    };
  }

  private async generateContextualSubMessage(): Promise<string> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Conta ordini di oggi
    const todayOrdersCount = await prisma.order.count({
      where: {
        orderDate: { gte: today, lt: tomorrow },
      },
    });

    // Conta task in scadenza oggi
    const todayTasksCount = await prisma.task.count({
      where: {
        dueDate: { gte: today, lt: tomorrow },
        status: { not: 'COMPLETED' },
      },
    });

    // Conta produzione in corso
    const activeProductionCount = await prisma.productionOrder.count({
      where: { status: 'IN_PROGRESS' },
    });

    // Genera messaggio
    const parts: string[] = [];

    if (todayOrdersCount > 0) {
      parts.push(`${todayOrdersCount} nuovi ordini oggi`);
    }

    if (todayTasksCount > 0) {
      parts.push(`${todayTasksCount} task in scadenza`);
    }

    if (activeProductionCount > 0) {
      parts.push(`${activeProductionCount} produzioni attive`);
    }

    if (parts.length === 0) {
      return 'Ecco la tua panoramica giornaliera.';
    }

    return parts.join(' • ');
  }

  // ============================================
  // DAILY KPIs
  // ============================================

  private async getDailyKpis(role: UserRole): Promise<DailyKpiSection> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const items: KpiItem[] = [];

    // KPI comuni
    // Ordini di oggi
    const [todayOrders, yesterdayOrders] = await Promise.all([
      prisma.order.aggregate({
        where: { orderDate: { gte: today, lt: tomorrow } },
        _count: true,
        _sum: { total: true },
      }),
      prisma.order.aggregate({
        where: { orderDate: { gte: yesterday, lt: today } },
        _count: true,
        _sum: { total: true },
      }),
    ]);

    const todayRevenue = Number(todayOrders._sum.total || 0);
    const yesterdayRevenue = Number(yesterdayOrders._sum.total || 0);
    const revenueChange = yesterdayRevenue > 0
      ? ((todayRevenue - yesterdayRevenue) / yesterdayRevenue * 100)
      : 0;

    items.push({
      id: 'orders_today',
      label: 'Ordini oggi',
      value: todayOrders._count,
      previousValue: yesterdayOrders._count,
      changePercent: yesterdayOrders._count > 0
        ? ((todayOrders._count - yesterdayOrders._count) / yesterdayOrders._count * 100)
        : 0,
      trend: todayOrders._count > yesterdayOrders._count ? 'up' : todayOrders._count < yesterdayOrders._count ? 'down' : 'stable',
      icon: 'pi-shopping-cart',
      color: '#3B82F6',
      link: '/orders?date=today',
    });

    items.push({
      id: 'revenue_today',
      label: 'Fatturato oggi',
      value: `€${todayRevenue.toFixed(2)}`,
      previousValue: `€${yesterdayRevenue.toFixed(2)}`,
      changePercent: revenueChange,
      trend: revenueChange > 0 ? 'up' : revenueChange < 0 ? 'down' : 'stable',
      icon: 'pi-euro',
      color: '#10B981',
      link: '/analytics/sales',
    });

    // KPI basati su ruolo
    if (['ADMIN', 'MANAGER', 'MAGAZZINIERE'].includes(role)) {
      // Stock alerts
      const lowStockCount = await prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(DISTINCT p.id) as count
        FROM products p
        LEFT JOIN inventory_items i ON p.id = i.product_id
        WHERE p.is_active = true
        GROUP BY p.id, p.min_stock
        HAVING COALESCE(SUM(i.quantity - i.reserved_quantity), 0) <= COALESCE(p.min_stock, 0)
          AND COALESCE(p.min_stock, 0) > 0
      `;

      items.push({
        id: 'low_stock',
        label: 'Prodotti sotto scorta',
        value: Number(lowStockCount[0]?.count || 0),
        icon: 'pi-exclamation-triangle',
        color: '#F59E0B',
        link: '/inventory?filter=low_stock',
      });
    }

    if (['ADMIN', 'MANAGER', 'CONTABILE'].includes(role)) {
      // Fatture scadute
      const overdueInvoices = await prisma.invoice.count({
        where: {
          status: { in: ['ISSUED', 'PARTIALLY_PAID', 'OVERDUE'] },
          dueDate: { lt: today },
        },
      });

      items.push({
        id: 'overdue_invoices',
        label: 'Fatture scadute',
        value: overdueInvoices,
        icon: 'pi-clock',
        color: '#EF4444',
        link: '/accounting/invoices?status=overdue',
      });
    }

    if (['ADMIN', 'MANAGER', 'MAGAZZINIERE'].includes(role)) {
      // Ordini da spedire
      const toShipCount = await prisma.order.count({
        where: { status: 'CONFIRMED' },
      });

      items.push({
        id: 'to_ship',
        label: 'Da spedire',
        value: toShipCount,
        icon: 'pi-truck',
        color: '#8B5CF6',
        link: '/orders?status=confirmed',
      });
    }

    if (['ADMIN', 'MANAGER', 'OPERATORE'].includes(role)) {
      // Produzioni attive
      const activeProduction = await prisma.productionOrder.count({
        where: { status: 'IN_PROGRESS' },
      });

      items.push({
        id: 'active_production',
        label: 'Produzioni attive',
        value: activeProduction,
        icon: 'pi-cog',
        color: '#6366F1',
        link: '/manufacturing/production-orders?status=in_progress',
      });
    }

    return {
      items,
      lastUpdated: new Date(),
    };
  }

  // ============================================
  // URGENT TASKS
  // ============================================

  private async getUrgentTasks(userId: string, role: UserRole): Promise<UrgentTaskSection> {
    const items: UrgentTask[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const threeDaysFromNow = new Date(today);
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

    // Task assegnati all'utente
    const userTasks = await prisma.task.findMany({
      where: {
        assignedToId: userId,
        status: { not: 'COMPLETED' },
        OR: [
          { priority: { in: ['HIGH', 'URGENT'] } },
          { dueDate: { lte: threeDaysFromNow } },
        ],
      },
      orderBy: [{ priority: 'asc' }, { dueDate: 'asc' }],
      take: 5,
    });

    for (const task of userTasks) {
      items.push({
        id: `task-${task.id}`,
        type: 'TASK',
        title: task.title,
        description: task.description || '',
        priority: task.priority === 'URGENT' ? 'CRITICAL' : task.priority === 'HIGH' ? 'HIGH' : 'MEDIUM',
        dueDate: task.dueDate || undefined,
        link: `/tasks/${task.id}`,
      });
    }

    // Ordini urgenti (per ruoli appropriati)
    if (['ADMIN', 'MANAGER', 'COMMERCIALE', 'MAGAZZINIERE'].includes(role)) {
      const urgentOrders = await prisma.order.findMany({
        where: {
          status: { in: ['PENDING', 'CONFIRMED'] },
          OR: [
            { priority: { gte: 1 } }, // 1=alta, 2=urgente
            { orderDate: { lte: new Date(Date.now() - 48 * 60 * 60 * 1000) } }, // > 48h
          ],
        },
        include: {
          customer: { select: { businessName: true, firstName: true, lastName: true } },
        },
        orderBy: { orderDate: 'asc' },
        take: 3,
      });

      for (const order of urgentOrders) {
        const customerName = order.customer?.businessName ||
          `${order.customer?.firstName || ''} ${order.customer?.lastName || ''}`.trim() ||
          'Cliente';

        items.push({
          id: `order-${order.id}`,
          type: 'ORDER',
          title: `Ordine ${order.orderNumber}`,
          description: `${customerName} - €${Number(order.total).toFixed(2)}`,
          priority: order.priority >= 2 ? 'CRITICAL' : order.priority >= 1 ? 'HIGH' : 'MEDIUM',
          dueDate: order.orderDate,
          link: `/orders/${order.id}`,
          metadata: { customerId: order.customerId },
        });
      }
    }

    // Pagamenti in scadenza (per contabili)
    if (['ADMIN', 'MANAGER', 'CONTABILE'].includes(role)) {
      const dueSoon = await prisma.invoice.findMany({
        where: {
          status: { in: ['ISSUED', 'PARTIALLY_PAID'] },
          dueDate: { gte: today, lte: threeDaysFromNow },
        },
        include: {
          customer: { select: { businessName: true, firstName: true, lastName: true } },
        },
        orderBy: { dueDate: 'asc' },
        take: 3,
      });

      for (const invoice of dueSoon) {
        const customerName = invoice.customer?.businessName ||
          `${invoice.customer?.firstName || ''} ${invoice.customer?.lastName || ''}`.trim() ||
          'Cliente';

        items.push({
          id: `payment-${invoice.id}`,
          type: 'PAYMENT',
          title: `Fattura ${invoice.invoiceNumber} in scadenza`,
          description: `${customerName} - €${(Number(invoice.total) - Number(invoice.paidAmount)).toFixed(2)}`,
          priority: 'HIGH',
          dueDate: invoice.dueDate,
          link: `/accounting/invoices/${invoice.id}`,
        });
      }
    }

    // Produzioni in ritardo
    if (['ADMIN', 'MANAGER', 'OPERATORE'].includes(role)) {
      const lateProduction = await prisma.productionOrder.findMany({
        where: {
          status: 'IN_PROGRESS',
          plannedEndDate: { lt: today },
        },
        include: {
          product: { select: { name: true, sku: true } },
        },
        take: 3,
      });

      for (const po of lateProduction) {
        items.push({
          id: `production-${po.id}`,
          type: 'PRODUCTION',
          title: `Produzione in ritardo: ${po.product?.sku || po.orderNumber}`,
          description: `${po.quantity} unità di ${po.product?.name || 'Prodotto'}`,
          priority: 'HIGH',
          dueDate: po.plannedEndDate || undefined,
          link: `/manufacturing/production-orders/${po.id}`,
        });
      }
    }

    // Ordina per priorità
    const priorityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2 };
    items.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    return {
      items: items.slice(0, 10), // Max 10 elementi
      total: items.length,
    };
  }

  // ============================================
  // DAY PLAN
  // ============================================

  private async getDayPlan(userId: string): Promise<DayPlanSection> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const items: DayPlanItem[] = [];

    // Eventi calendario di oggi
    const calendarEvents = await prisma.calendarEvent.findMany({
      where: {
        startDate: { gte: today, lt: tomorrow },
      },
      orderBy: { startDate: 'asc' },
    });

    for (const event of calendarEvents) {
      items.push({
        id: `event-${event.id}`,
        time: event.startDate.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }),
        title: event.title,
        description: event.description || undefined,
        type: event.eventType === 'meeting' ? 'MEETING' : 'OTHER',
        completed: false,
        link: `/calendar?eventId=${event.id}`,
      });
    }

    // Task con scadenza oggi
    const todayTasks = await prisma.task.findMany({
      where: {
        assignedToId: userId,
        dueDate: { gte: today, lt: tomorrow },
      },
      orderBy: { dueDate: 'asc' },
    });

    for (const task of todayTasks) {
      items.push({
        id: `task-${task.id}`,
        time: task.dueDate?.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }),
        title: task.title,
        description: task.description || undefined,
        type: 'TASK',
        completed: task.status === 'COMPLETED',
        link: `/tasks/${task.id}`,
      });
    }

    // Ordina per orario
    items.sort((a, b) => {
      if (!a.time) return 1;
      if (!b.time) return -1;
      return a.time.localeCompare(b.time);
    });

    const completedCount = items.filter(i => i.completed).length;

    return {
      items,
      completedCount,
      totalCount: items.length,
    };
  }

  // ============================================
  // SUGGESTIONS
  // ============================================

  private async getSuggestions(preferences?: { showSuggestions: boolean; suggestionTypes?: Prisma.JsonValue } | null) {
    // Se le preferenze disabilitano i suggerimenti
    if (preferences?.showSuggestions === false) {
      return {
        items: [],
        total: 0,
        stats: await suggestionEngineService.getStats(),
      };
    }

    // Recupera suggerimenti
    const result = await suggestionEngineService.list({
      status: 'PENDING',
      limit: 10,
    });

    const stats = await suggestionEngineService.getStats();

    return {
      items: result.items,
      total: result.total,
      stats,
    };
  }

  // ============================================
  // QUICK STATS
  // ============================================

  private async getQuickStats(role: UserRole): Promise<QuickStatsSection> {
    const items: QuickStat[] = [];

    // Statistiche comuni
    // Clienti attivi questo mese
    const thisMonthStart = new Date();
    thisMonthStart.setDate(1);
    thisMonthStart.setHours(0, 0, 0, 0);

    const newCustomersThisMonth = await prisma.customer.count({
      where: {
        createdAt: { gte: thisMonthStart },
      },
    });

    items.push({
      id: 'new_customers',
      label: 'Nuovi clienti (mese)',
      value: newCustomersThisMonth,
      color: 'success',
    });

    // Ordini in attesa
    const pendingOrders = await prisma.order.count({
      where: { status: { in: ['PENDING', 'CONFIRMED'] } },
    });

    items.push({
      id: 'pending_orders',
      label: 'Ordini in attesa',
      value: pendingOrders,
      color: pendingOrders > 10 ? 'warning' : 'info',
    });

    // Valore magazzino
    if (['ADMIN', 'MANAGER', 'MAGAZZINIERE'].includes(role)) {
      const stockValue = await prisma.$queryRaw<[{ value: number }]>`
        SELECT COALESCE(SUM((i.quantity - i.reserved_quantity) * COALESCE(p.cost, 0)), 0) as value
        FROM inventory_items i
        JOIN products p ON i.product_id = p.id
        WHERE p.is_active = true
      `;

      items.push({
        id: 'stock_value',
        label: 'Valore magazzino',
        value: `€${(Number(stockValue[0]?.value) || 0).toFixed(0)}`,
        color: 'info',
      });
    }

    // Suggerimenti attivi
    const activeSuggestions = await prisma.suggestion.count({
      where: { status: 'PENDING' },
    });

    items.push({
      id: 'suggestions',
      label: 'Suggerimenti attivi',
      value: activeSuggestions,
      color: activeSuggestions > 5 ? 'warning' : 'info',
    });

    return { items };
  }

  // ============================================
  // PREFERENCES
  // ============================================

  /**
   * Recupera preferenze dashboard utente
   */
  async getPreferences(userId: string): Promise<DashboardPreferences> {
    const prefs = await prisma.userDashboardPreference.findUnique({
      where: { userId },
    });

    if (!prefs) {
      // Ritorna default
      return {
        emailDailyDigest: true,
        emailWeeklyDigest: true,
        emailUrgentAlerts: true,
        showSuggestions: true,
        defaultDateRange: '7d',
        showKpis: true,
        showUrgentTasks: true,
        showDayPlan: true,
        compactMode: false,
      };
    }

    return {
      layout: prefs.layout as DashboardPreferences['layout'] || undefined,
      emailDailyDigest: prefs.emailDailyDigest,
      emailWeeklyDigest: prefs.emailWeeklyDigest,
      emailUrgentAlerts: prefs.emailUrgentAlerts,
      showSuggestions: prefs.showSuggestions,
      suggestionTypes: prefs.suggestionTypes as string[] || undefined,
      defaultDateRange: prefs.defaultDateRange,
      showKpis: prefs.showKpis,
      showUrgentTasks: prefs.showUrgentTasks,
      showDayPlan: prefs.showDayPlan,
      compactMode: prefs.compactMode,
    };
  }

  /**
   * Aggiorna preferenze dashboard utente
   */
  async updatePreferences(userId: string, data: Partial<DashboardPreferences>): Promise<DashboardPreferences> {
    await prisma.userDashboardPreference.upsert({
      where: { userId },
      update: {
        layout: data.layout as Prisma.JsonObject | undefined,
        emailDailyDigest: data.emailDailyDigest,
        emailWeeklyDigest: data.emailWeeklyDigest,
        emailUrgentAlerts: data.emailUrgentAlerts,
        showSuggestions: data.showSuggestions,
        suggestionTypes: data.suggestionTypes as Prisma.JsonObject | undefined,
        defaultDateRange: data.defaultDateRange,
        showKpis: data.showKpis,
        showUrgentTasks: data.showUrgentTasks,
        showDayPlan: data.showDayPlan,
        compactMode: data.compactMode,
      },
      create: {
        userId,
        layout: data.layout as Prisma.JsonObject | undefined,
        emailDailyDigest: data.emailDailyDigest ?? true,
        emailWeeklyDigest: data.emailWeeklyDigest ?? true,
        emailUrgentAlerts: data.emailUrgentAlerts ?? true,
        showSuggestions: data.showSuggestions ?? true,
        suggestionTypes: data.suggestionTypes as Prisma.JsonObject | undefined,
        defaultDateRange: data.defaultDateRange ?? '7d',
        showKpis: data.showKpis ?? true,
        showUrgentTasks: data.showUrgentTasks ?? true,
        showDayPlan: data.showDayPlan ?? true,
        compactMode: data.compactMode ?? false,
      },
    });

    return this.getPreferences(userId);
  }

  // ============================================
  // AGGREGATED KPIs
  // ============================================

  /**
   * Recupera KPI aggregati per periodo
   */
  async getKpis(params: {
    dateRange: '1d' | '7d' | '30d' | '90d';
    userId?: string;
  }) {
    const { dateRange } = params;

    const days = dateRange === '1d' ? 1 : dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    const previousStartDate = new Date(startDate);
    previousStartDate.setDate(previousStartDate.getDate() - days);

    const [currentPeriod, previousPeriod] = await Promise.all([
      this.getKpisForPeriod(startDate, new Date()),
      this.getKpisForPeriod(previousStartDate, startDate),
    ]);

    return {
      current: currentPeriod,
      previous: previousPeriod,
      changes: {
        orders: this.calculateChange(currentPeriod.orders, previousPeriod.orders),
        revenue: this.calculateChange(currentPeriod.revenue, previousPeriod.revenue),
        avgOrderValue: this.calculateChange(currentPeriod.avgOrderValue, previousPeriod.avgOrderValue),
        newCustomers: this.calculateChange(currentPeriod.newCustomers, previousPeriod.newCustomers),
      },
      dateRange,
      startDate,
      endDate: new Date(),
    };
  }

  private async getKpisForPeriod(startDate: Date, endDate: Date) {
    const [orders, revenue, newCustomers] = await Promise.all([
      prisma.order.count({
        where: { orderDate: { gte: startDate, lt: endDate } },
      }),
      prisma.order.aggregate({
        where: { orderDate: { gte: startDate, lt: endDate } },
        _sum: { total: true },
      }),
      prisma.customer.count({
        where: { createdAt: { gte: startDate, lt: endDate } },
      }),
    ]);

    const revenueTotal = Number(revenue._sum.total || 0);

    return {
      orders,
      revenue: revenueTotal,
      avgOrderValue: orders > 0 ? revenueTotal / orders : 0,
      newCustomers,
    };
  }

  private calculateChange(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  }
}

export const dashboardService = new DashboardService();
