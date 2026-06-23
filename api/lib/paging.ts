import { generate, generateSecret as _generateSecret, verify } from 'otplib';
import { ProfilePaging_Type } from './enums.js';

/**
 * Generate a new random TOTP secret (base32, 20-byte entropy).
 */
export async function generateSecret(): Promise<string> {
    return await _generateSecret({ length: 20 });
}

/**
 * Generate the current TOTP code from a seed.
 * The code changes every 30 seconds (RFC 6238 default).
 */
export async function generateCode(seed: string): Promise<string> {
    return await generate({ secret: seed });
}

/**
 * Verify a 6-digit TOTP code against a seed.
 * Allows a ±1 window (one previous/next period) to account for clock skew.
 */
export async function verifyCode(code: string, seed: string): Promise<boolean> {
    const result = await verify({ token: code, secret: seed, window: 1 } as any);
    return typeof result === 'boolean' ? result : Boolean((result as any)?.valid);
}

/**
 * Pluggable sender abstraction.
 * Real delivery providers (AWS SNS, SES, FCM) can be wired in later by
 * replacing the stub implementations below.
 */
export async function sendCode(
    type: ProfilePaging_Type,
    value: string,
    code: string,
): Promise<void> {
    switch (type) {
        case ProfilePaging_Type.SMS:
            // TODO: integrate AWS SNS or Twilio
            console.log(`[PagingSender] SMS verification code ${code} sent to ${value}`);
            break;
        case ProfilePaging_Type.EMAIL:
            // TODO: integrate AWS SES or nodemailer
            console.log(`[PagingSender] Email verification code ${code} sent to ${value}`);
            break;
        case ProfilePaging_Type.PUSH:
            // TODO: integrate Firebase Cloud Messaging using the stored FCM token (value)
            console.log(`[PagingSender] Push verification code ${code} sent to ${value}`);
            break;
        default:
            console.warn(`[PagingSender] Unknown paging type: ${type}`);
    }
}
