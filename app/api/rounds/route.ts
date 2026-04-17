import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const limitStr = searchParams.get('limit') || '20';
        const limit = parseInt(limitStr, 10);

        if (isNaN(limit) || limit <= 0) {
            return NextResponse.json({ error: 'Invalid limit value' }, { status: 400 });
        }

        const rounds = await prisma.round.findMany({
            where: {
                status: 'REVEALED'
            },
            select: {
                id: true,
                createdAt: true,
                binIndex: true,
                payoutMultiplier: true,
                betCents: true,
                serverSeed: true,
                clientSeed: true,
                nonce: true,
                dropColumn: true
            },
            orderBy: {
                createdAt: 'desc'
            },
            take: limit
        });

        return NextResponse.json(rounds);
    } catch (error: unknown) {
        console.error("Error retrieving historical rounds:", error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
