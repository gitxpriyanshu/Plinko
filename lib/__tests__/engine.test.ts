import { expect, test, describe } from 'vitest';
import { makeCommit, makeCombinedSeed, sha256 } from '../crypto';
import { makeXorshift32, seedFromHex } from '../prng';
import { generatePegMap, simulateDrop, PAYTABLE } from '../engine';

describe('Plinko Engine specifications', () => {
  const serverSeed = "b2a5f3f32a4d9c6ee7a8c1d33456677890abcdeffedcba0987654321ffeeddcc";
  const nonce = "42";
  const clientSeed = "candidate-hello";

  test('1. Verify the test vector from the spec', () => {
    // sha256(`${serverSeed}:${nonce}`)
    const commit = makeCommit(serverSeed, nonce);
    expect(commit).toBe("bb9acdc67f3f18f3345236a01f0e5072596657a9005c7d8a22cff061451a6b34");

    // makeCombinedSeed(serverSeed, clientSeed, nonce)
    const combinedSeed = makeCombinedSeed(serverSeed, clientSeed, nonce);
    expect(combinedSeed).toBe("e1dddf77de27d395ea2be2ed49aa2a59bd6bf12ee8d350c16c008abd406c07e0");

    // seedFromHex(combinedSeed)
    const seedNumber = seedFromHex(combinedSeed);
    
    // First 5 rand() values
    const rand = makeXorshift32(seedNumber);
    const first5 = [rand(), rand(), rand(), rand(), rand()];
    const expected5 = [0.1106166649, 0.7625129214, 0.0439292176, 0.4578678815, 0.3438999297];

    first5.forEach((val, i) => {
      expect(val).toBeCloseTo(expected5[i], 7); // ±0.0000001 tolerance => 7 decimal places
    });
  });

  test('2. Verify peg map rows 0-2', () => {
    const combinedSeed = makeCombinedSeed(serverSeed, clientSeed, nonce);
    const rand = makeXorshift32(seedFromHex(combinedSeed));
    
    const pegMap = generatePegMap(rand, 12);
    
    expect(pegMap[0]).toEqual([0.422123]);
    expect(pegMap[1]).toEqual([0.552503, 0.408786]);
    expect(pegMap[2]).toEqual([0.491574, 0.468780, 0.436540]);
  });

  test('3. Verify determinism: calling simulateDrop twice gives identical results', () => {
    const combinedSeed = makeCombinedSeed(serverSeed, clientSeed, nonce);
    
    // First run
    const rand1 = makeXorshift32(seedFromHex(combinedSeed));
    const pegMap1 = generatePegMap(rand1, 12);
    const result1 = simulateDrop(pegMap1, rand1, 6, 12);
    
    // Second run
    const rand2 = makeXorshift32(seedFromHex(combinedSeed));
    const pegMap2 = generatePegMap(rand2, 12);
    const result2 = simulateDrop(pegMap2, rand2, 6, 12);
    
    expect(result1.path).toEqual(result2.path);
    expect(result1.binIndex).toEqual(result2.binIndex);
    expect(result1.binIndex).toBe(6);
  });

  test('5. Verify explicit final binIndex correctly mapped to test vectors', () => {
    const combinedSeed = makeCombinedSeed(serverSeed, clientSeed, nonce);
    const rand = makeXorshift32(seedFromHex(combinedSeed));
    const pegMap = generatePegMap(rand, 12);
    const { binIndex, path } = simulateDrop(pegMap, rand, 6, 12);
    
    expect(binIndex).toBe(6);
    expect(path.length).toBe(12);
  });

  test('6. Verify deterministic pegMapHash serialization is locally stable and identical across runs', () => {
    const combinedSeed = makeCombinedSeed(serverSeed, clientSeed, nonce);
    
    // Compute first generator sequence
    const rand1 = makeXorshift32(seedFromHex(combinedSeed));
    const pegMap1 = generatePegMap(rand1, 12);
    const pegMapHash1 = sha256(JSON.stringify(pegMap1));

    // Compute identical secondary sequence ensuring serializations match
    const rand2 = makeXorshift32(seedFromHex(combinedSeed));
    const pegMap2 = generatePegMap(rand2, 12);
    const pegMapHash2 = sha256(JSON.stringify(pegMap2));
    
    expect(pegMapHash1).toEqual(pegMapHash2);
    expect(pegMapHash1).toBeTruthy();
  });
});
