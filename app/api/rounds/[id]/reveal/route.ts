import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { makeCommit } from '@/lib/crypto';

export async function POST(
    request: Request,
    { params }: { params: { id: string } }
) {
    try {
        const id = params.id;

        // 1. Fetch the round first to verify integrity BEFORE any state changes
        const round = await prisma.round.findUnique({ where: { id } });
        
        if (!round) {
            return NextResponse.json({ error: 'Round not found' }, { status: 404 });
        }

        if (round.status !== 'STARTED') {
            return NextResponse.json({
                error: `Round cannot be revealed: current status is '${round.status}'. Expected 'STARTED'.`
            }, { status: 409 });
        }

        // 2. Cryptographic Integrity Check (CRITICAL)
        // Ensure the serverSeed about to be revealed actually matches the originally committed hash
        if (round.serverSeed) {
            const verificationCheck = makeCommit(round.serverSeed, round.nonce);
            if (verificationCheck !== round.commitHex) {
                // If this fails, the DB is compromised. Do NOT reveal, do NOT update status.
                return NextResponse.json({ 
                    error: 'CRITICAL ERROR: Commit hash mismatch detected! Integrity compromised.' 
                }, { status: 500 });
            }
        }

        // 3. Atomic conditional update: perfectly safe now that integrity is proven
        const updatedCount = await prisma.round.updateMany({
            where: { id, status: 'STARTED' }, // atomic status guard against double-reveals
            data: {
                status: 'REVEALED',
                revealedAt: new Date()
            }
        });

        if (updatedCount.count === 0) {
            // Raced by another request
            return NextResponse.json({
                error: 'Round already revealed by a concurrent request.'
            }, { status: 409 });
        }

        // 4. Return the formally verified and officially revealed serverSeed
        return NextResponse.json({
            serverSeed: round.serverSeed ?? null
        });
    } catch (error: unknown) {
        console.error("Error revealing game round:", error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
