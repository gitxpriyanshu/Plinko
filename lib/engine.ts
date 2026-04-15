/**
 * Bounds a value between a min and max
 */
function clamp(val: number, min: number, max: number): number {
    if (val < min) return min;
    if (val > max) return max;
    return val;
}

/**
 * Generates the peg bias map for the Plinko board.
 * For row r (0-indexed), creates r+1 pegs.
 * leftBias = 0.5 + (rand() - 0.5) * 0.2, rounded to 6 decimal places.
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
 * Simulates dropping a ball through the Plinko board.
 * Returns the path taken and the final bin index.
 */
export function simulateDrop(
    pegMap: number[][],
    rand: () => number,
    dropColumn: number,
    rows = 12
): { path: ('L' | 'R')[], binIndex: number } {
    const adj = (dropColumn - Math.floor(rows / 2)) * 0.01;
    let pos = 0;
    const path: ('L' | 'R')[] = [];

    for (let r = 0; r < rows; r++) {
        const peg = pegMap[r][Math.min(pos, r)];
        const bias = clamp(peg + adj, 0, 1);
        const rnd = rand();
        
        if (rnd < bias) {
            path.push('L');
        } else {
            path.push('R');
            pos += 1; // Moving right increases the position index in the next row
        }
    }
    
    return { path, binIndex: pos };
}

/**
 * Symmetric array of 13 multipliers for bins 0..12
 * Example table providing rewards structured for standard 12-row setups.
 */
export const PAYTABLE: number[] = [10, 5, 3, 2, 1.5, 1, 0.5, 1, 1.5, 2, 3, 5, 10];
