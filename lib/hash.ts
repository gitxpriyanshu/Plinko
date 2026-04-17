import crypto from 'crypto';

/**
 * Returns lowercase hex SHA-256 of the input string.
 * This is used for generating the stable pegMapHash.
 */
export function sha256(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
}
