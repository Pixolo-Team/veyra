import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CompanyDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getForUser(
    _user: unknown,
    companyId: string,
  ) {
    // Verify company exists
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
    });
    if (!company) throw new Error('Company not found');

    // Get all rooms for this company (both discloser and recipient)
    const discloserRooms = await this.prisma.room.findMany({
      where: { discloserCompanyId: companyId },
      include: { documents: true },
    });
    const recipientRooms = await this.prisma.room.findMany({
      where: { recipientCompanyId: companyId },
      include: { documents: true },
    });

    const allRooms = [...discloserRooms, ...recipientRooms];
    const totalDocuments = allRooms.reduce(
      (sum, room) => sum + (room.documents?.length || 0),
      0,
    );

    return {
      companyId: company.id,
      companyName: company.name,
      viewer: {
        side: 'discloser' as const,
        role: 'admin' as const,
        participantId: 'admin' as const,
      },
      checklist: { modules: [], completedCount: 0, totalCount: 0 },
      threads: { open: 0, resolved: 0, myOpen: 0, myTotal: 0 },
      documents: { total: totalDocuments, unopened: 0, unread: 0, revised: 0, unresolved: 0, withFeedback: 0 },
      coverage: { viewed: 0, total: totalDocuments, pct: null },
      dossierOpened: { viewed: 0, total: totalDocuments, pct: null },
      recipient: null,
      downloads: { count: 0 },
      reading: { mySeconds: 0, totalSeconds: 0, leaderboard: [] },
      medians: { replySeconds: null, resolveSeconds: null },
      participants: null,
      attention: [],
    };
  }
}