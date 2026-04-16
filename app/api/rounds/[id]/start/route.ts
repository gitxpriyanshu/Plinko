import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { makeCombinedSeed, sha256 } from '@/lib/crypto';
import { makeXorshift32, seedFromHex } from '@/lib/prng';
import { generatePegMap, simulateDrop, PAYTABLE } from '@/lib/engine';

export async function POST(
    request: Request,
    { params }: { params: { id: string } }
) {
    try {
        const id = params.id;
        const body = await request.json();
        const { clientSeed, betCents, dropColumn } = body;

        if (typeof clientSeed !== 'string' || typeof betCents !== 'number' || typeof dropColumn !== 'number') {
            return NextResponse.json({ error: 'Invalid input types' }, { status: 400 });
        }

        if (betCents <= 0) {
            return NextResponse.json({ error: 'betCents must be > 0' }, { status: 400 });
        }

        if (dropColumn < 0 || dropColumn > 12) {
            return NextResponse.json({ error: 'dropColumn must be 0-12' }, { status: 400 });
        }

        const round = await prisma.round.findUnique({ where: { id } });
        
        if (!round || round.status !== 'CREATED') {
            return NextResponse.json({ error: 'Round not found or not in CREATED status' }, { status: 400 });
        }
        
        const serverSeed = round.serverSeed as string;
        const nonce = round.nonce;

        const combinedSeedHex = makeCombinedSeed(serverSeed, clientSeed, nonce);
        const rand = makeXorshift32(seedFromHex(combinedSeedHex));
        
        const rows = 12;
        const pegMap = generatePegMap(rand, rows);
        const pegMapHash = sha256(JSON.stringify(pegMap));
        
        const { path, binIndex } = simulateDrop(pegMap, rand, dropColumn, rows);
        const payoutMultiplier = PAYTABLE[binIndex];

        const updatedRound = await prisma.round.update({
            where: { id },
            data: {
                status: 'STARTED',
                clientSeed,
                combinedSeed: combinedSeedHex,
                pegMapHash,
                dropColumn,
                binIndex,
                payoutMultiplier,
                betCents,
                pathJson: path,
            }
        });

        return NextResponse.json({
            roundId: updatedRound.id,
            pegMapHash,
            pegMap,
            rows,
            binIndex,
            path,
            payoutMultiplier
        });
    } catch (error: unknown) {
        console.error("Error verifying game round:", error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
