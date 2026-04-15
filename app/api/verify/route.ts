import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { makeCommit, makeCombinedSeed, sha256 } from '@/lib/crypto';
import { makeXorshift32, seedFromHex } from '@/lib/prng';
import { generatePegMap, simulateDrop } from '@/lib/engine';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const serverSeed = searchParams.get('serverSeed');
        const clientSeed = searchParams.get('clientSeed');
        const nonce = searchParams.get('nonce');
        const dropColumnStr = searchParams.get('dropColumn');
        const roundId = searchParams.get('roundId');

        if (!serverSeed || clientSeed === null || !nonce || !dropColumnStr) {
            return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
        }

        const dropColumn = parseInt(dropColumnStr, 10);
        if (isNaN(dropColumn) || dropColumn < 0 || dropColumn > 12) {
            return NextResponse.json({ error: 'Invalid dropColumn value' }, { status: 400 });
        }

        const commitHex = makeCommit(serverSeed, nonce);
        const combinedSeed = makeCombinedSeed(serverSeed, clientSeed, nonce);
        const rand = makeXorshift32(seedFromHex(combinedSeed));
        
        const rows = 12;
        const pegMap = generatePegMap(rand, rows);
        const pegMapHash = sha256(JSON.stringify(pegMap));
        
        const { binIndex } = simulateDrop(pegMap, rand, dropColumn, rows);

        let match: boolean | null = null;
        
        let round = null;
        if (roundId) {
            round = await prisma.round.findUnique({ where: { id: roundId } });
        } else {
            // Fallback search attempting to locate the specific round cryptographically naturally
            round = await prisma.round.findFirst({ 
                where: { serverSeed, nonce } 
            });
        }

        if (round) {
            match = (
                round.commitHex === commitHex &&
                round.pegMapHash === pegMapHash &&
                round.binIndex === binIndex && 
                round.dropColumn === dropColumn
            );
        } else {
            // Record completely missing or deleted
            match = false;
        }

        return NextResponse.json({
            commitHex,
            combinedSeed,
            pegMapHash,
            binIndex,
            match
        });
    } catch (error) {
        console.error("Error verifying game round:", error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
