/**
 * Takes a uint32 seed and returns a PRNG function
 * Each call returns the next float in [0, 1) using xorshift32 algorithm
 */
export function makeXorshift32(seed: number): () => number {
    let state = seed >>> 0;
    if (state === 0) {
        state = 1; // Xorshift32 state must be non-zero
    }

    return function() {
        state ^= state << 13;
        state ^= state >>> 17;
        state ^= state << 5;
        
        return (state >>> 0) / 4294967296;
    };
}

/**
 * Reads the first 4 bytes of a hex string as a big-endian uint32
 */
export function seedFromHex(hexString: string): number {
    const first4BytesHex = hexString.substring(0, 8).padStart(8, '0');
    return parseInt(first4BytesHex, 16);
}
