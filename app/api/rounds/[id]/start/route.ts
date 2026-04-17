import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { makeCombinedSeed } from '@/lib/crypto';
import { makeXorshift32, seedFromHex } from '@/lib/prng';
import { generatePegMap, simulateDrop, PAYTABLE, getPegMapHash } from '@/lib/engine';

export async function POST(
    request: Request,
    { params }: { params: { id: string } }
) {
    try {
        const id = params.id;
        const body = await request.json();
        const { clientSeed, betCents, dropColumn } = body;

        // Type validation
        if (typeof clientSeed !== 'string' || typeof betCents !== 'number' || typeof dropColumn !== 'number') {
            return NextResponse.json({ error: 'Invalid input types' }, { status: 400 });
        }

        // Input validation
        if (clientSeed.trim().length === 0) {
            return NextResponse.json({ error: 'clientSeed must not be empty' }, { status: 400 });
        }
        if (clientSeed.length > 128) {
            return NextResponse.json({ error: 'clientSeed must be 128 chars or less' }, { status: 400 });
        }
        if (betCents <= 0 || !Number.isInteger(betCents)) {
            return NextResponse.json({ error: 'betCents must be a positive integer' }, { status: 400 });
        }
        if (!Number.isInteger(dropColumn) || dropColumn < 0 || dropColumn > 12) {
            return NextResponse.json({ error: 'dropColumn must be integer 0-12' }, { status: 400 });
        }

        // Fetch round — must exist and be in CREATED state
        const round = await prisma.round.findUnique({ where: { id } });
        if (!round) {
            return NextResponse.json({ error: 'Round not found' }, { status: 404 });
        }
        if (round.status !== 'CREATED') {
            return NextResponse.json({
                error: `Round cannot be started: current status is '${round.status}'. Expected 'CREATED'.`
            }, { status: 409 });
        }

        // Pull server-controlled values from DB — NEVER from client request
        const serverSeed = round.serverSeed as string;
        const nonce = round.nonce;

        // Deterministic computation — single PRNG instance, never re-initialized
        // Order is STRICT: generatePegMap MUST consume random numbers before simulateDrop
        const combinedSeedHex = makeCombinedSeed(serverSeed, clientSeed, nonce);
        const rows = 12;
        
        // PRNG ISOLATION: Separate instances ensure simulation starts at index 0
        const randSim = makeXorshift32(seedFromHex(combinedSeedHex));
        const randMap = makeXorshift32(seedFromHex(combinedSeedHex));

        const { path, pathString, binIndex } = simulateDrop(randSim, dropColumn, rows);
        const pegMap = generatePegMap(randMap, rows); 
        const pegMapHash = getPegMapHash(pegMap);
        const payoutMultiplier = PAYTABLE[binIndex];

        // Atomic conditional update: only succeeds if status is still CREATED.
        // This eliminates the race condition where two concurrent /start requests
        // both pass the status check before either write completes.
        const updatedCount = await prisma.round.updateMany({
            where: { id, status: 'CREATED' }, // atomic status guard
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
                pathString,
            }
        });

        if (updatedCount.count === 0) {
            // Another concurrent request already claimed this round
            return NextResponse.json({
                error: 'Round already started by a concurrent request'
            }, { status: 409 });
        }

        return NextResponse.json({
            roundId: id,
            pegMapHash,
            rows,
            path,
            binIndex,
            payoutMultiplier
        });
    } catch (error: unknown) {
        console.error("Error starting game round:", error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
