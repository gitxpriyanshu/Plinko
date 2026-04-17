import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { makeCommit, makeCombinedSeed } from '@/lib/crypto';
import { makeXorshift32, seedFromHex } from '@/lib/prng';
import { generatePegMap, simulateDrop, getPegMapHash } from '@/lib/engine';

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
        const rows = 12;
        
        // PRNG ISOLATION: Separate instances ensure simulation starts at index 0
        const randSim = makeXorshift32(seedFromHex(combinedSeed));
        const randMap = makeXorshift32(seedFromHex(combinedSeed));

        const { binIndex, pathString } = simulateDrop(randSim, dropColumn, rows);
        const pegMap = generatePegMap(randMap, rows);
        const pegMapHash = getPegMapHash(pegMap);

        let isValid: boolean | null = null;
        let checks = undefined;
        let message = "No roundId provided, only computed values shown";

        if (roundId) {
            const round = await prisma.round.findUnique({ where: { id: roundId } });
            if (round) {
                const commitMatch = commitHex === round.commitHex;
                const combinedSeedMatch = combinedSeed === round.combinedSeed;
                const pegMapMatch = pegMapHash === round.pegMapHash;
                const binMatch = binIndex === round.binIndex;

                isValid = commitMatch && combinedSeedMatch && pegMapMatch && binMatch;
                checks = {
                    commitMatch,
                    combinedSeedMatch,
                    pegMapMatch,
                    binMatch
                };
                message = isValid ? "Match Verified" : "Mismatch Detected";
            } else {
                message = "Record Not Found in Database";
            }
        }

        return NextResponse.json({
            commitHex,
            combinedSeed,
            pegMapHash,
            binIndex,
            pathString,
            isValid,
            message,
            checks
        });
    } catch (error: unknown) {
        console.error("Error verifying game round:", error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
