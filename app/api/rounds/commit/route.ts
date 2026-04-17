import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { makeCommit } from '@/lib/crypto';

export async function POST() {
    try {
        // 1. Generation
        const serverSeed = crypto.randomBytes(32).toString('hex');
        const nonce = crypto.randomUUID(); // String-based UUID
        const commitHex = makeCommit(serverSeed, nonce);

        // 2. Dev-only integrity log — NEVER log serverSeed in production
        if (process.env.NODE_ENV === 'development') {
            console.log(`[COMMIT_GEN] Round created. CommitHex: ${commitHex}`);
        }

        // 3. Database Integrity Hook
        const verificationCheck = makeCommit(serverSeed, nonce);
        if (verificationCheck !== commitHex) {
            throw new Error("Integrity Mismatch: Generated hash and Verify hash do not match.");
        }

        const round = await prisma.round.create({
            data: {
                status: 'CREATED',
                serverSeed,
                nonce,
                commitHex,
            }
        });

        // 4. Minimal Response Construction (No serverSeed leaked)
        return NextResponse.json({
            roundId: round.id,
            commitHex: round.commitHex,
            nonce: round.nonce
        });
    } catch (error: unknown) {
        console.error("CRITICAL ERROR: Failed to generate or save round commitment.", error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
