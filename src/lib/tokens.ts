// src/lib/tokens.ts
import crypto from 'crypto';

export function randomToken(len = 24) {
    return crypto.randomBytes(len).toString('base64url'); // url safe
}

export function shortToken(len = 16) {
    return crypto.randomBytes(len).toString('hex'); // unsubscribe tokens
}
