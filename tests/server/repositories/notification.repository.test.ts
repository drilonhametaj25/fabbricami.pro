import { mockDeep, mockReset } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';

const prismaMock = mockDeep<PrismaClient>();
jest.mock('@server/config/database', () => ({
  prisma: prismaMock,
}));

import notificationRepository from '@server/repositories/notification.repository';

describe('NotificationRepository.createForRoles (anti-flood dedup)', () => {
  beforeEach(() => {
    mockReset(prismaMock);
  });

  const data = {
    type: 'LOW_STOCK' as any,
    title: 'Scorta Minima Raggiunta',
    message: 'msg',
    link: '/products/p1',
  };

  it('creates notifications only for users without an identical unread one', async () => {
    (prismaMock.user.findMany as any).mockResolvedValue([{ id: 'u1' }, { id: 'u2' }]);
    // u1 ha già la notifica non letta → va saltato
    (prismaMock.notification.findMany as any).mockResolvedValue([{ userId: 'u1' }]);
    (prismaMock.notification.createMany as any).mockResolvedValue({ count: 1 });

    await notificationRepository.createForRoles(['ADMIN'] as any, data);

    expect(prismaMock.notification.createMany).toHaveBeenCalledWith({
      data: [{ userId: 'u2', ...data }],
    });
  });

  it('does not create anything when all target users already have the unread notification', async () => {
    (prismaMock.user.findMany as any).mockResolvedValue([{ id: 'u1' }]);
    (prismaMock.notification.findMany as any).mockResolvedValue([{ userId: 'u1' }]);

    const result = await notificationRepository.createForRoles(['ADMIN'] as any, data);

    expect(prismaMock.notification.createMany).not.toHaveBeenCalled();
    expect(result).toEqual({ count: 0 });
  });

  it('returns count 0 when no users match the roles', async () => {
    (prismaMock.user.findMany as any).mockResolvedValue([]);

    const result = await notificationRepository.createForRoles(['ADMIN'] as any, data);

    expect(prismaMock.notification.findMany).not.toHaveBeenCalled();
    expect(result).toEqual({ count: 0 });
  });
});
