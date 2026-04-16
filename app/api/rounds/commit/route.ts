import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { makeCommit } from '@/lib/crypto';

export async function POST() {
    try {
        const serverSeed = crypto.randomBytes(32).toString('hex');
        const nonce = crypto.randomInt(1000000).toString();
        const commitHex = makeCommit(serverSeed, nonce);

        const round = await prisma.round.create({
            data: {
                status: 'CREATED',
                serverSeed,
                nonce,
                commitHex,
            }
        });

        return NextResponse.json({
            roundId: round.id,
            commitHex: round.commitHex
        });
    } catch (error: unknown) {
        console.error("Error creating round commit:", error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
