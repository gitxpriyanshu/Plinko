import crypto from 'crypto';

/**
 * Returns lowercase hex SHA-256 of the input string
 */
export function sha256(input: string): string {
    return crypto.createHash('sha256').update(input).digest('hex');
}

/**
 * Generates the commit hash from serverSeed and nonce
 */
export function makeCommit(serverSeed: string, nonce: string): string {
    return sha256(`${serverSeed}:${nonce}`);
}

/**
 * Generates the combined seed hash from serverSeed, clientSeed, and nonce
 */
export function makeCombinedSeed(serverSeed: string, clientSeed: string, nonce: string): string {
    return sha256(`${serverSeed}:${clientSeed}:${nonce}`);
}
