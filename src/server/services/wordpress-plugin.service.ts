import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const prisma = new PrismaClient();

export interface PluginCredential {
  id: string;
  username: string;
  label: string | null;
  isActive: boolean;
  lastUsed: Date | null;
  createdAt: Date;
}

export interface CreateCredentialInput {
  username: string;
  password: string;
  label?: string;
}

export interface SyncLogEntry {
  id: string;
  direction: string;
  entity: string;
  entityId: string;
  action: string;
  status: string;
  request?: any;
  response?: any;
  error?: string | null;
  duration?: number | null;
  createdAt: Date;
}

export interface SyncLogFilter {
  direction?: string;
  entity?: string;
  status?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

class WordPressPluginService {
  /**
   * Genera una password sicura per le credenziali
   */
  generateSecurePassword(length: number = 32): string {
    return crypto.randomBytes(length).toString('base64').slice(0, length);
  }

  /**
   * Crea nuove credenziali per il plugin WordPress
   */
  async createCredentials(input: CreateCredentialInput): Promise<{ credential: PluginCredential; plainPassword: string }> {
    const { username, password, label } = input;

    // Verifica che username non esista già
    const existing = await prisma.wordPressPluginAuth.findUnique({
      where: { username },
    });

    if (existing) {
      throw new Error('Username già esistente');
    }

    // Hash della password
    const hashedPassword = await bcrypt.hash(password, 12);

    const credential = await prisma.wordPressPluginAuth.create({
      data: {
        username,
        password: hashedPassword,
        label: label || null,
        isActive: true,
      },
    });

    return {
      credential: {
        id: credential.id,
        username: credential.username,
        label: credential.label,
        isActive: credential.isActive,
        lastUsed: credential.lastUsed,
        createdAt: credential.createdAt,
      },
      plainPassword: password, // Restituiamo la password in chiaro solo alla creazione
    };
  }

  /**
   * Genera e crea credenziali automatiche
   */
  async generateCredentials(label?: string): Promise<{ credential: PluginCredential; username: string; password: string }> {
    const username = `wp_plugin_${crypto.randomBytes(4).toString('hex')}`;
    const password = this.generateSecurePassword(32);

    const result = await this.createCredentials({
      username,
      password,
      label,
    });

    return {
      credential: result.credential,
      username,
      password,
    };
  }

  /**
   * Valida le credenziali Basic Auth
   */
  async validateCredentials(username: string, password: string): Promise<boolean> {
    const credential = await prisma.wordPressPluginAuth.findUnique({
      where: { username },
    });

    if (!credential || !credential.isActive) {
      return false;
    }

    const isValid = await bcrypt.compare(password, credential.password);

    if (isValid) {
      // Aggiorna lastUsed
      await prisma.wordPressPluginAuth.update({
        where: { id: credential.id },
        data: { lastUsed: new Date() },
      });
    }

    return isValid;
  }

  /**
   * Lista tutte le credenziali (senza password)
   */
  async listCredentials(): Promise<PluginCredential[]> {
    const credentials = await prisma.wordPressPluginAuth.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return credentials.map(c => ({
      id: c.id,
      username: c.username,
      label: c.label,
      isActive: c.isActive,
      lastUsed: c.lastUsed,
      createdAt: c.createdAt,
    }));
  }

  /**
   * Revoca credenziali (disattiva)
   */
  async revokeCredentials(id: string): Promise<void> {
    await prisma.wordPressPluginAuth.update({
      where: { id },
      data: { isActive: false },
    });
  }

  /**
   * Riattiva credenziali
   */
  async activateCredentials(id: string): Promise<void> {
    await prisma.wordPressPluginAuth.update({
      where: { id },
      data: { isActive: true },
    });
  }

  /**
   * Elimina credenziali definitivamente
   */
  async deleteCredentials(id: string): Promise<void> {
    await prisma.wordPressPluginAuth.delete({
      where: { id },
    });
  }

  /**
   * Aggiorna password credenziali
   */
  async updatePassword(id: string, newPassword: string): Promise<void> {
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await prisma.wordPressPluginAuth.update({
      where: { id },
      data: { password: hashedPassword },
    });
  }

  // ==========================================
  // SYNC LOGGING
  // ==========================================

  /**
   * Registra un'operazione di sync
   */
  async logSyncOperation(
    direction: 'TO_WP' | 'FROM_WP',
    entity: 'PRODUCT' | 'ORDER' | 'CUSTOMER' | 'INVENTORY',
    entityId: string,
    action: string,
    status: 'SUCCESS' | 'FAILED' | 'PENDING',
    options?: {
      request?: any;
      response?: any;
      error?: string;
      duration?: number;
    }
  ): Promise<SyncLogEntry> {
    const log = await prisma.wordPressSyncLog.create({
      data: {
        direction,
        entity,
        entityId,
        action,
        status,
        request: options?.request || null,
        response: options?.response || null,
        error: options?.error || null,
        duration: options?.duration || null,
      },
    });

    return log;
  }

  /**
   * Ottieni log di sync con filtri
   */
  async getSyncLogs(filter: SyncLogFilter = {}): Promise<{ logs: SyncLogEntry[]; total: number }> {
    const where: any = {};

    if (filter.direction) {
      where.direction = filter.direction;
    }

    if (filter.entity) {
      where.entity = filter.entity;
    }

    if (filter.status) {
      where.status = filter.status;
    }

    if (filter.startDate || filter.endDate) {
      where.createdAt = {};
      if (filter.startDate) {
        where.createdAt.gte = filter.startDate;
      }
      if (filter.endDate) {
        where.createdAt.lte = filter.endDate;
      }
    }

    const [logs, total] = await Promise.all([
      prisma.wordPressSyncLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: filter.limit || 50,
        skip: filter.offset || 0,
      }),
      prisma.wordPressSyncLog.count({ where }),
    ]);

    return { logs, total };
  }

  /**
   * Ottieni statistiche sync
   */
  async getSyncStats(days: number = 7): Promise<{
    total: number;
    success: number;
    failed: number;
    byEntity: Record<string, { success: number; failed: number }>;
    byDirection: Record<string, { success: number; failed: number }>;
  }> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const logs = await prisma.wordPressSyncLog.findMany({
      where: {
        createdAt: { gte: startDate },
      },
      select: {
        entity: true,
        direction: true,
        status: true,
      },
    });

    const stats = {
      total: logs.length,
      success: 0,
      failed: 0,
      byEntity: {} as Record<string, { success: number; failed: number }>,
      byDirection: {} as Record<string, { success: number; failed: number }>,
    };

    for (const log of logs) {
      // Totali
      if (log.status === 'SUCCESS') {
        stats.success++;
      } else if (log.status === 'FAILED') {
        stats.failed++;
      }

      // Per entity
      if (!stats.byEntity[log.entity]) {
        stats.byEntity[log.entity] = { success: 0, failed: 0 };
      }
      if (log.status === 'SUCCESS') {
        stats.byEntity[log.entity].success++;
      } else if (log.status === 'FAILED') {
        stats.byEntity[log.entity].failed++;
      }

      // Per direction
      if (!stats.byDirection[log.direction]) {
        stats.byDirection[log.direction] = { success: 0, failed: 0 };
      }
      if (log.status === 'SUCCESS') {
        stats.byDirection[log.direction].success++;
      } else if (log.status === 'FAILED') {
        stats.byDirection[log.direction].failed++;
      }
    }

    return stats;
  }

  /**
   * Pulisci log vecchi
   */
  async cleanOldLogs(daysToKeep: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await prisma.wordPressSyncLog.deleteMany({
      where: {
        createdAt: { lt: cutoffDate },
      },
    });

    return result.count;
  }

  /**
   * Ottieni ultimo sync per entità
   */
  async getLastSyncForEntity(entity: string, entityId: string): Promise<SyncLogEntry | null> {
    const log = await prisma.wordPressSyncLog.findFirst({
      where: {
        entity,
        entityId,
        status: 'SUCCESS',
      },
      orderBy: { createdAt: 'desc' },
    });

    return log;
  }
}

export default new WordPressPluginService();
