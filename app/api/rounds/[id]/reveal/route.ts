import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(
    request: Request,
    { params }: { params: { id: string } }
) {
    try {
        const id = params.id;
        const round = await prisma.round.findUnique({ where: { id } });
        
        if (!round || round.status !== 'STARTED') {
            return NextResponse.json({ error: 'Round not found or not in STARTED status' }, { status: 400 });
        }

        const updatedRound = await prisma.round.update({
            where: { id },
            data: {
                status: 'REVEALED',
                revealedAt: new Date()
            }
        });

        return NextResponse.json({
            serverSeed: updatedRound.serverSeed,
            nonce: updatedRound.nonce
        });
    } catch (error) {
        console.error("Error revealing game round:", error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
