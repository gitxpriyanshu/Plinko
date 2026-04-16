import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
    request: Request,
    { params }: { params: { id: string } }
) {
    try {
        const id = params.id;
        const round = await prisma.round.findUnique({ where: { id } });
        
        if (!round) {
            return NextResponse.json({ error: 'Round not found' }, { status: 404 });
        }

        const safeRound = { 
            ...round,
            ...(round.status !== 'REVEALED' ? { serverSeed: null, nonce: null } : {})
        };
        
        return NextResponse.json(safeRound);
    } catch (error) {
        console.error("Error retrieving round data:", error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
