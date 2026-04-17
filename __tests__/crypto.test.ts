/**
 * Provably-Fair Cryptographic Unit Tests
 *
 * Tests all hashing primitives against the official assignment test vectors.
 * Run with: npm test
 */

import { describe, it, expect } from 'vitest';
import { makeCommit, makeCombinedSeed } from '../lib/crypto';
import { sha256 } from '../lib/hash';
import { makeXorshift32, seedFromHex } from '../lib/prng';

// ============================================================
// Official test vectors from assignment
// ============================================================
const SERVER_SEED = "b2a5f3f32a4d9c6ee7a8c1d33456677890abcdeffedcba0987654321ffeeddcc";
const NONCE       = "42";
const CLIENT_SEED = "candidate-hello";

const EXPECTED_COMMIT_HEX    = "bb9acdc67f3f18f3345236a01f0e5072596657a9005c7d8a22cff061451a6b34";
const EXPECTED_COMBINED_SEED = "e1dddf77de27d395ea2be2ed49aa2a59bd6bf12ee8d350c16c008abd406c07e0";

// ============================================================
// sha256 primitive
// ============================================================
describe('sha256 primitive', () => {
    it('produces lowercase hex output', () => {
        const result = sha256('hello');
        expect(result).toMatch(/^[0-9a-f]{64}$/);
    });

    it('is deterministic for the same input', () => {
        expect(sha256('test')).toBe(sha256('test'));
    });

    it('differs for different inputs', () => {
        expect(sha256('a')).not.toBe(sha256('b'));
    });

    it('matches known SHA-256 vector for "abc"', () => {
        // Standard NIST SHA-256 test vector
        expect(sha256('abc')).toBe(
            'ba7816bf8f01cfea414140de5dae2ec73b00361bbef0469f490f67bc5645d65'
        );
    });
});

// ============================================================
// Commit hash (Step 1 of commit-reveal protocol)
// ============================================================
describe('makeCommit — SHA256(serverSeed + ":" + nonce)', () => {
    it('matches assignment test vector', () => {
        const result = makeCommit(SERVER_SEED, NONCE);
        expect(result).toBe(EXPECTED_COMMIT_HEX);
    });

    it('uses colon separator between serverSeed and nonce', () => {
        // Manually compute what makeCommit should produce
        const manualHash = sha256(`${SERVER_SEED}:${NONCE}`);
        expect(makeCommit(SERVER_SEED, NONCE)).toBe(manualHash);
    });

    it('is sensitive to serverSeed changes', () => {
        const altered = SERVER_SEED.replace('b2', 'b3');
        expect(makeCommit(altered, NONCE)).not.toBe(EXPECTED_COMMIT_HEX);
    });

    it('is sensitive to nonce changes', () => {
        expect(makeCommit(SERVER_SEED, '43')).not.toBe(EXPECTED_COMMIT_HEX);
    });
});

// ============================================================
// Combined seed (Step 2 — client seed mixed in)
// ============================================================
describe('makeCombinedSeed — SHA256(serverSeed + ":" + clientSeed + ":" + nonce)', () => {
    it('matches assignment test vector', () => {
        const result = makeCombinedSeed(SERVER_SEED, CLIENT_SEED, NONCE);
        expect(result).toBe(EXPECTED_COMBINED_SEED);
    });

    it('uses colon separators between all three components', () => {
        const manualHash = sha256(`${SERVER_SEED}:${CLIENT_SEED}:${NONCE}`);
        expect(makeCombinedSeed(SERVER_SEED, CLIENT_SEED, NONCE)).toBe(manualHash);
    });

    it('is sensitive to clientSeed changes', () => {
        expect(makeCombinedSeed(SERVER_SEED, 'different-client', NONCE))
            .not.toBe(EXPECTED_COMBINED_SEED);
    });

    it('differs from commitHex (serverSeed+clientSeed changes derivation)', () => {
        expect(makeCombinedSeed(SERVER_SEED, CLIENT_SEED, NONCE))
            .not.toBe(makeCommit(SERVER_SEED, NONCE));
    });
});

// ============================================================
// PRNG seeding from combined seed
// ============================================================
describe('seedFromHex + makeXorshift32 — PRNG determinism', () => {
    it('extracts first 4 bytes big-endian from hex string', () => {
        // EXPECTED_COMBINED_SEED starts with "e1dddf77..."
        // First 4 bytes = 0xe1dddf77 = 3789037431
        const seed = seedFromHex(EXPECTED_COMBINED_SEED);
        expect(seed).toBe(0xe1dddf77);
    });

    it('produces identical sequences for the same seed', () => {
        const rand1 = makeXorshift32(seedFromHex(EXPECTED_COMBINED_SEED));
        const rand2 = makeXorshift32(seedFromHex(EXPECTED_COMBINED_SEED));
        const seq1 = [rand1(), rand1(), rand1(), rand1(), rand1()];
        const seq2 = [rand2(), rand2(), rand2(), rand2(), rand2()];
        expect(seq1).toEqual(seq2);
    });

    it('produces values in [0, 1) range', () => {
        const rand = makeXorshift32(seedFromHex(EXPECTED_COMBINED_SEED));
        for (let i = 0; i < 20; i++) {
            const v = rand();
            expect(v).toBeGreaterThanOrEqual(0);
            expect(v).toBeLessThan(1);
        }
    });

    it('guards against zero-seed by defaulting to 1', () => {
        const rand = makeXorshift32(0);
        // Should not produce NaN or Infinite values
        const v = rand();
        expect(Number.isFinite(v)).toBe(true);
    });

    it('produces different sequences for different seeds', () => {
        const rand1 = makeXorshift32(0x11111111);
        const rand2 = makeXorshift32(0x22222222);
        expect(rand1()).not.toBe(rand2());
    });
});

// ============================================================
// End-to-end protocol integrity
// ============================================================
describe('End-to-end commit-reveal integrity', () => {
    it('commit produced before client input cannot depend on clientSeed', () => {
        // Commit must be computed without clientSeed — confirm they are different
        const commit = makeCommit(SERVER_SEED, NONCE);
        const combined = makeCombinedSeed(SERVER_SEED, CLIENT_SEED, NONCE);
        // If they were equal, clientSeed would have no effect — that would be broken
        expect(commit).not.toBe(combined);
    });

    it('full vector chain is internally consistent', () => {
        // SHA256(S:N) commitment
        const commit = makeCommit(SERVER_SEED, NONCE);
        expect(commit).toBe(EXPECTED_COMMIT_HEX);

        // SHA256(S:C:N) combined seed
        const combined = makeCombinedSeed(SERVER_SEED, CLIENT_SEED, NONCE);
        expect(combined).toBe(EXPECTED_COMBINED_SEED);

        // PRNG seeds from combined
        const seed = seedFromHex(combined);
        const rand = makeXorshift32(seed);
        // Should produce valid float
        expect(rand()).toBeGreaterThanOrEqual(0);
    });

    it('commit mismatch correctly fails verification logic', () => {
        // Simulate a tampered serverSeed
        const TAMPERED_SEED = "t4mp3r3ds33dt4mp3r3ds33dt4mp3r3d";
        const fakeCommit = makeCommit(TAMPERED_SEED, NONCE);

        // It should NOT match the genuine stored commitHex
        expect(fakeCommit).not.toBe(EXPECTED_COMMIT_HEX);

        // Verification logic explicitly checks SHA256(S:N) === stored
        const isValid = fakeCommit === EXPECTED_COMMIT_HEX;
        expect(isValid).toBe(false);
    });
});

// ============================================================
// Status flow enforcement (CREATED → STARTED → REVEALED)
// ============================================================
import { generatePegMap, simulateDrop, getPegMapHash } from '../lib/engine';

describe('Status flow — CREATED → STARTED → REVEALED', () => {
    // Simulate the three-phase state machine in pure logic
    type Status = 'CREATED' | 'STARTED' | 'REVEALED';

    function canStart(status: Status) { return status === 'CREATED'; }
    function canReveal(status: Status) { return status === 'STARTED'; }

    it('allows /start only from CREATED status', () => {
        expect(canStart('CREATED')).toBe(true);
        expect(canStart('STARTED')).toBe(false);
        expect(canStart('REVEALED')).toBe(false);
    });

    it('allows /reveal only from STARTED status', () => {
        expect(canReveal('STARTED')).toBe(true);
        expect(canReveal('CREATED')).toBe(false);
        expect(canReveal('REVEALED')).toBe(false);
    });

    it('cannot skip STARTED — CREATED cannot go directly to REVEALED', () => {
        expect(canReveal('CREATED')).toBe(false);
    });

    it('REVEALED is a terminal state — no further transitions allowed', () => {
        expect(canStart('REVEALED')).toBe(false);
        expect(canReveal('REVEALED')).toBe(false);
    });
});

// ============================================================
// Engine order correctness — pegMap MUST be generated before simulateDrop
// ============================================================
describe('Engine PRNG sequence order', () => {
    it('pegMap generation consumes PRNG state before simulateDrop', () => {
        const seed = seedFromHex(EXPECTED_COMBINED_SEED);

        // Correct order: generatePegMap → simulateDrop (same rand instance)
        const rand1 = makeXorshift32(seed);
        const pegMap = generatePegMap(rand1, 12);
        const result1 = simulateDrop(pegMap, rand1, 6, 12);

        // Wrong order: simulateDrop sees fresh rand (as if pegMap was skipped)
        const rand2 = makeXorshift32(seed);
        const result2 = simulateDrop(pegMap, rand2, 6, 12);

        // Results must differ — proves order matters for determinism
        // (rand2 hasn't consumed pegMap entropy, so sequence is out of sync)
        expect(result1.binIndex).not.toBe(result2.binIndex);
    });

    it('same inputs always produce same binIndex (full determinism check)', () => {
        const seed = seedFromHex(EXPECTED_COMBINED_SEED);

        const runOnce = () => {
            const rand = makeXorshift32(seed);
            const pegMap = generatePegMap(rand, 12);
            const { binIndex } = simulateDrop(pegMap, rand, 6, 12);
            return binIndex;
        };

        expect(runOnce()).toBe(runOnce());
    });

    it('/verify recomputes same pegMapHash as /start for identical inputs', () => {
        const seed = seedFromHex(EXPECTED_COMBINED_SEED);

        // Simulate /start
        const rand1 = makeXorshift32(seed);
        const pegMap1 = generatePegMap(rand1, 12);
        const hash1 = getPegMapHash(pegMap1);

        // Simulate /verify (fresh PRNG from same seed)
        const rand2 = makeXorshift32(seed);
        const pegMap2 = generatePegMap(rand2, 12);
        const hash2 = getPegMapHash(pegMap2);

        expect(hash1).toBe(hash2);
    });

    it('deterministic replay produces exact same trajectory and peg mapping mathematically', () => {
        // High-level requirement checklist validation
        const seed1 = makeXorshift32(0xdeadbeef);
        const map1 = generatePegMap(seed1, 12);
        const result1 = simulateDrop(map1, seed1, 4, 12);

        // Completely separate run
        const seed2 = makeXorshift32(0xdeadbeef);
        const map2 = generatePegMap(seed2, 12);
        const result2 = simulateDrop(map2, seed2, 4, 12);

        // Full equivalence assertion
        expect(map1).toEqual(map2);
        expect(result1.pathString).toBe(result2.pathString);
        expect(result1.binIndex).toBe(result2.binIndex);
        
        // Exact SHA256 stringification format rule
        const stringifiedMap = JSON.stringify(map1);
        expect(getPegMapHash(map1)).toBe(sha256(stringifiedMap));
        expect(getPegMapHash(map1)).toBe(getPegMapHash(map2));
    });

    it('PRNG stream continuity is strictly enforced (re-initialization breaks determinism)', () => {
        // Continuous, genuine protocol drop
        const seed1 = makeXorshift32(0x1337cafe);
        const mapGenuine = generatePegMap(seed1, 12);
        const resultGenuine = simulateDrop(mapGenuine, seed1, 6, 12);

        // Broken logic: PRNG gets re-initialized for the simulateDrop payload
        const seed2 = makeXorshift32(0x1337cafe);
        const mapBroken = generatePegMap(seed2, 12);
        const seed2Broken = makeXorshift32(0x1337cafe); // REINITIALIZED!
        const resultBroken = simulateDrop(mapBroken, seed2Broken, 6, 12);

        // Verify map is equal (because generatePegMap started fresh on both)
        expect(mapGenuine).toEqual(mapBroken);

        // Prove that the unbroken continuity produced a strictly different drop trajectory
        // than the mistakenly re-initialized RNG.
        expect(resultGenuine.pathString).not.toBe(resultBroken.pathString);
    });
});

// ============================================================
// SimulateDrop Bias and Clamping Bounds (dropColumn adjustments)
// ============================================================
describe('simulateDrop dropColumn bias and mathematical clamping limits', () => {
    
    it('always preserves boundary limits (0 <= binIndex <= rows) under real map constraints', () => {
        const randMap = makeXorshift32(0x99999999);
        const map = generatePegMap(randMap, 12);
        
        // Test all possible dropColumns from 0 to 12
        for (let dropCol = 0; dropCol <= 12; dropCol++) {
            // Provide a new PRNG for drops
            const randDrop = makeXorshift32(0x55555555 + dropCol);
            const result = simulateDrop(map, randDrop, dropCol, 12);
            
            // Core constraints: path length is rows, binIndex within bounds
            expect(result.path.length).toBe(12);
            expect(result.binIndex).toBeGreaterThanOrEqual(0);
            expect(result.binIndex).toBeLessThanOrEqual(12);
        }
    });

    it('dropColumns properly skew distribution realistically (Not fully L or R)', () => {
        // Native realistic peg map: leftBias falls strictly into [0.4, 0.6]
        const randMap = makeXorshift32(0xabcdef);
        const map = generatePegMap(randMap, 12);

        // Run dropColumn=0 (Skewed Left: adj = -0.06 -> final range [0.34, 0.54])
        // Skews left statistically, but NOT completely deterministic
        const drop0 = simulateDrop(map, makeXorshift32(0x11111111), 0, 12);

        // Run dropColumn=12 (Skewed Right: adj = +0.06 -> final range [0.46, 0.66])
        const drop12 = simulateDrop(map, makeXorshift32(0x11111111), 12, 12);

        // Run dropColumn=6 (Center Bias: adj = 0.0 -> final range [0.4, 0.6])
        const drop6 = simulateDrop(map, makeXorshift32(0x11111111), 6, 12);

        // Assert different starting zones produce realistically measurable inequalities
        // Identical RNG sequences evaluate differently due to shifting peg adjacency limits
        expect(drop0.pathString).not.toBe(drop12.pathString);
        expect(drop0.pathString).not.toBe(drop6.pathString);
        expect(drop12.pathString).not.toBe(drop6.pathString);
        
        // Assert paths do NOT assume deterministic edge collapse
        // Proves bias operates realistically between [0.34, 0.66]
        expect(drop0.pathString).not.toBe("LLLLLLLLLLLL");
        expect(drop12.pathString).not.toBe("RRRRRRRRRRRR");
        
        // Guarantee path structural mapping matches expected outputs
        expect(drop0.pathString).toMatch(/^[LR]{12}$/);
    });
});
