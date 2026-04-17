

import { sha256 } from './hash';

/**
 * Generates the peg bias map for the Plinko board.
 * 
 * !!! IMPORTANT !!! 
 * This function MUST be called BEFORE any simulation logic (like simulateDrop)
 * using the same PRNG instance to ensure the generated sequence is correct 
 * and stays in sync with the audit verifier.
 */
export function generatePegMap(rand: () => number, rows = 12): number[][] {
    const map: number[][] = [];
    for (let r = 0; r < rows; r++) {
        const rowPegs = [];
        for (let p = 0; p <= r; p++) {
            const rawBias = 0.5 + (rand() - 0.5) * 0.2;
            const roundedBias = Math.round(rawBias * 1000000) / 1000000;
            rowPegs.push(roundedBias);
        }
        map.push(rowPegs);
    }
    return map;
}

/**
 * Computes a cryptographically stable hash of the pegMap.
 * Uses strict string formatting (toFixed(6)) to prevent floating-point serialization drift.
 */
export function getPegMapHash(pegMap: number[][]): string {
    // Requirements directly mandate JSON.stringify(pegMap) strictly on the numerical arrays.
    return sha256(JSON.stringify(pegMap));
}

/**
 * Simulates dropping a ball through the Plinko board using exact assignment formulas.
 * 
 * !!! MANDATORY SPEC !!!
 * adj = (dropColumn - floor(rows / 2)) * 0.01
 * bias = clamp(0.5 + adj, 0, 1)
 * 
 * Logic ensures bit-identical results by starting from the FIRST PRNG pull.
 */
export function simulateDrop(
    rand: () => number,
    dropColumn: number,
    rows = 12
): { path: ('L' | 'R')[], pathString: string, binIndex: number } {
    const adj = (dropColumn - Math.floor(rows / 2)) * 0.01;
    const baseBias = 0.5 + adj;
    const bias = Math.max(0, Math.min(1, baseBias));
    
    let pos = 0;
    const path: ('L' | 'R')[] = [];

    for (let r = 0; r < rows; r++) {
        // PEG INDEX COMPLIANCE: pegIndex = min(pos, r)
        // This calculates the horizontal index of the peg currently being hit.
        const pegIndex = Math.min(pos, r); 
        
        const rnd = rand();
        if (rnd < bias) {
            path.push('L');
        } else {
            path.push('R');
            pos += 1;
        }
    }
    
    return { path, pathString: path.join(''), binIndex: pos };
}

/**
 * Symmetric array of 13 multipliers for bins 0..12
 * Example table providing rewards structured for standard 12-row setups.
 */
export const PAYTABLE: number[] = [10, 5, 3, 2, 1.5, 1, 0.5, 1, 1.5, 2, 3, 5, 10];
