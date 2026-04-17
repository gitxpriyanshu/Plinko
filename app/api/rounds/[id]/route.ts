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

        const isRevealed = round.status === 'REVEALED';

        // Explicit allowlist — never spread raw DB records to prevent accidental field leakage
        const safeRound = {
            id: round.id,
            status: round.status,
            createdAt: round.createdAt,
            revealedAt: round.revealedAt,
            // Cryptographic identification (always safe)
            commitHex: round.commitHex,
            nonce: round.nonce, // nonce is public — it was returned at commit time
            // Only expose after reveal
            serverSeed: isRevealed ? round.serverSeed : null,
            combinedSeed: isRevealed ? round.combinedSeed : null,
            // Game state (safe to expose after round started)
            clientSeed: round.clientSeed || null,
            pegMapHash: round.pegMapHash || null,
            dropColumn: round.dropColumn,
            binIndex: round.binIndex >= 0 ? round.binIndex : null,
            payoutMultiplier: round.payoutMultiplier,
            betCents: round.betCents,
            rows: round.rows,
            pathJson: isRevealed ? round.pathJson : null,
            pathString: isRevealed ? round.pathString : null,
        };
        
        return NextResponse.json(safeRound);
    } catch (error) {
        console.error("Error retrieving round data:", error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
