import jwt from 'jsonwebtoken';
import Err from '@openaddresses/batch-error';
import Auth, { AuthUserAccess } from '../lib/auth.js';
import Config from '../lib/config.js';
import Schema from '@openaddresses/batch-schema';
import { Type } from '@sinclair/typebox'
import { UAParser } from 'ua-parser-js';
import { X509Certificate } from 'crypto';
import {
    generateRegistrationOptions,
    verifyRegistrationResponse,
    generateAuthenticationOptions,
    verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import type {
    AuthenticatorTransportFuture,
    RegistrationResponseJSON as WebAuthnRegistrationResponseJSON,
    AuthenticationResponseJSON as WebAuthnAuthenticationResponseJSON,
} from '@simplewebauthn/server';

function rpFromConfig(config: Config, req?: { headers: { origin?: string } }): { rpID: string; origin: string | string[] } {
    const url = new URL(config.API_URL);
    const origins: string[] = [url.origin];

    if (url.hostname === 'localhost' && req?.headers.origin && req.headers.origin !== url.origin) {
        try {
            const reqOrigin = new URL(req.headers.origin);
            if (reqOrigin.hostname === 'localhost') {
                origins.push(req.headers.origin);
            }
        } catch { /* ignore invalid origin */ }
    }

    return {
        rpID: url.hostname,
        origin: origins.length === 1 ? origins[0] : origins,
    };
}

export default async function router(schema: Schema, config: Config) {
    const rpName = 'CloudTAK';

    const RegistrationResponseJSON = Type.Object({
        id: Type.String(),
        rawId: Type.String(),
        response: Type.Object({
            clientDataJSON: Type.String(),
            attestationObject: Type.String(),
            authenticatorData: Type.Optional(Type.String()),
            transports: Type.Optional(Type.Array(Type.String())),
            publicKeyAlgorithm: Type.Optional(Type.Number()),
            publicKey: Type.Optional(Type.String()),
        }),
        authenticatorAttachment: Type.Optional(Type.String()),
        clientExtensionResults: Type.Record(Type.String(), Type.Unknown()),
        type: Type.String(),
    });

    const AuthenticationResponseJSON = Type.Object({
        id: Type.String(),
        rawId: Type.String(),
        response: Type.Object({
            clientDataJSON: Type.String(),
            authenticatorData: Type.String(),
            signature: Type.String(),
            userHandle: Type.Optional(Type.String()),
        }),
        authenticatorAttachment: Type.Optional(Type.String()),
        clientExtensionResults: Type.Record(Type.String(), Type.Unknown()),
        type: Type.String(),
    });

    async function assertPasskeysEnabled(): Promise<void> {
        const settings = await config.models.Setting.typedMany({
            'passkey::enabled': true,
        });
        if (!settings['passkey::enabled']) {
            throw new Err(403, null, 'Passkey authentication is disabled');
        }
    }

    await schema.get('/login/passkey', {
        name: 'List Passkeys',
        group: 'Login',
        description: 'List passkeys for the authenticated user',
        res: Type.Object({
            total: Type.Integer(),
            items: Type.Array(Type.Object({
                id: Type.Integer(),
                name: Type.String(),
                credential_id: Type.String(),
                created: Type.String(),
                last_used: Type.Union([Type.String(), Type.Null()]),
            }))
        })
    }, async (req, res) => {
        try {
            await assertPasskeysEnabled();
            const user = await Auth.as_user(config, req);
            const passkeys = await config.models.ProfilePasskey.forUser(user.email);

            res.json({
                total: passkeys.length,
                items: passkeys.map((p) => ({
                    id: p.id,
                    name: p.name,
                    credential_id: p.credential_id,
                    created: p.created,
                    last_used: p.last_used,
                }))
            });
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.post('/login/passkey/register/options', {
        name: 'Passkey Registration Options',
        group: 'Login',
        description: 'Generate WebAuthn registration options for the authenticated user',
        res: Type.Object({
            rp: Type.Object({
                name: Type.String(),
                id: Type.Optional(Type.String()),
            }),
            user: Type.Object({
                id: Type.String(),
                name: Type.String(),
                displayName: Type.String(),
            }),
            challenge: Type.String(),
            pubKeyCredParams: Type.Array(Type.Object({
                alg: Type.Number(),
                type: Type.String(),
            })),
            timeout: Type.Optional(Type.Number()),
            excludeCredentials: Type.Optional(Type.Array(Type.Object({
                id: Type.String(),
                type: Type.String(),
                transports: Type.Optional(Type.Array(Type.String())),
            }))),
            authenticatorSelection: Type.Optional(Type.Object({
                authenticatorAttachment: Type.Optional(Type.String()),
                requireResidentKey: Type.Optional(Type.Boolean()),
                residentKey: Type.Optional(Type.String()),
                userVerification: Type.Optional(Type.String()),
            })),
            attestation: Type.Optional(Type.String()),
            extensions: Type.Optional(Type.Unknown()),
        })
    }, async (req, res) => {
        try {
            await assertPasskeysEnabled();
            const user = await Auth.as_user(config, req);
            const { rpID } = rpFromConfig(config);

            const existingPasskeys = await config.models.ProfilePasskey.forUser(user.email);

            const options = await generateRegistrationOptions({
                rpName,
                rpID,
                userName: user.email,
                attestationType: 'none',
                excludeCredentials: existingPasskeys.map((p) => ({
                    id: p.credential_id,
                    transports: (p.transports || []) as AuthenticatorTransportFuture[],
                })),
                authenticatorSelection: {
                    residentKey: 'preferred',
                    userVerification: 'preferred',
                },
            });

            await config.models.ProfilePasskey.setChallenge(`reg:${user.email}`, options.challenge);

            res.json({ ...options });
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.post('/login/passkey/register', {
        name: 'Passkey Registration Verify',
        group: 'Login',
        description: 'Verify WebAuthn registration and store credential',
        body: Type.Object({
            name: Type.String({ default: '' }),
            credential: RegistrationResponseJSON,
        }),
        res: Type.Object({
            id: Type.Integer(),
            name: Type.String(),
            credential_id: Type.String(),
            created: Type.String(),
        })
    }, async (req, res) => {
        try {
            await assertPasskeysEnabled();
            const user = await Auth.as_user(config, req);
            const { rpID, origin } = rpFromConfig(config, req);

            const expectedChallenge = await config.models.ProfilePasskey.consumeChallenge(`reg:${user.email}`);

            let verification;
            try {
                verification = await verifyRegistrationResponse({
                    response: req.body.credential as WebAuthnRegistrationResponseJSON,
                    expectedChallenge,
                    expectedOrigin: origin,
                    expectedRPID: rpID,
                    requireUserVerification: false,
                });
            } catch (e) {
                throw new Err(400, e instanceof Error ? e : null, 'Invalid registration credential');
            }

            if (!verification.verified || !verification.registrationInfo) {
                throw new Err(400, null, 'Registration verification failed');
            }

            const { credential } = verification.registrationInfo;

            const passkey = await config.models.ProfilePasskey.generate({
                username: user.email,
                credential_id: credential.id,
                public_key: Buffer.from(credential.publicKey).toString('base64url'),
                counter: credential.counter,
                transports: req.body.credential.response?.transports || [],
                name: req.body.name || '',
                created: new Date().toISOString(),
            });

            res.json({
                id: passkey.id,
                name: passkey.name,
                credential_id: passkey.credential_id,
                created: passkey.created,
            });
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.post('/login/passkey/authenticate/options', {
        name: 'Passkey Authentication Options',
        group: 'Login',
        description: 'Generate WebAuthn authentication options',
        body: Type.Object({}),
        res: Type.Object({
            challenge: Type.String(),
            timeout: Type.Optional(Type.Number()),
            rpId: Type.Optional(Type.String()),
            allowCredentials: Type.Optional(Type.Array(Type.Object({
                id: Type.String(),
                type: Type.String(),
                transports: Type.Optional(Type.Array(Type.String())),
            }))),
            userVerification: Type.Optional(Type.String()),
            extensions: Type.Optional(Type.Unknown()),
        })
    }, async (req, res) => {
        try {
            await assertPasskeysEnabled();
            const { rpID } = rpFromConfig(config);

            const options = await generateAuthenticationOptions({
                rpID,
                userVerification: 'preferred',
            });

            await config.models.ProfilePasskey.setChallenge(`auth:${options.challenge}`, options.challenge);

            res.json({ ...options });
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.post('/login/passkey/authenticate', {
        name: 'Passkey Authentication Verify',
        group: 'Login',
        description: 'Verify WebAuthn authentication and return JWT',
        body: Type.Object({
            credential: AuthenticationResponseJSON,
        }),
        res: Type.Object({
            token: Type.String(),
            access: Type.Enum(AuthUserAccess),
            email: Type.String(),
            certRenewalRequired: Type.Optional(Type.Boolean()),
        })
    }, async (req, res) => {
        try {
            await assertPasskeysEnabled();
            const { rpID, origin } = rpFromConfig(config, req);

            const credentialId = req.body.credential.id;
            if (!credentialId || typeof credentialId !== 'string') {
                throw new Err(400, null, 'Missing credential id');
            }

            let passkey;
            try {
                passkey = await config.models.ProfilePasskey.byCredentialId(credentialId);
            } catch {
                throw new Err(401, null, 'Unknown credential');
            }

            const challengeKey = `auth:${req.body.credential.response?.clientDataJSON
                    ? (() => {
                        try {
                            const clientData = JSON.parse(
                                Buffer.from(req.body.credential.response.clientDataJSON, 'base64url').toString()
                            );
                            return clientData.challenge || '';
                        } catch { return ''; }
                    })()
                    : ''}`;

            const expectedChallenge = await config.models.ProfilePasskey.consumeChallenge(challengeKey);

            let verification;
            try {
                verification = await verifyAuthenticationResponse({
                    response: req.body.credential as WebAuthnAuthenticationResponseJSON,
                    expectedChallenge,
                    expectedOrigin: origin,
                    expectedRPID: rpID,
                    requireUserVerification: false,
                    credential: {
                        id: passkey.credential_id,
                        publicKey: Buffer.from(passkey.public_key, 'base64url'),
                        counter: passkey.counter,
                        transports: (passkey.transports || []) as AuthenticatorTransportFuture[],
                    },
                });
            } catch (e) {
                throw new Err(401, e instanceof Error ? e : null, 'Authentication verification failed');
            }

            if (!verification.verified) {
                throw new Err(401, null, 'Authentication verification failed');
            }

            await config.models.ProfilePasskey.updateCounter(
                passkey.id,
                verification.authenticationInfo.newCounter,
            );

            const profile = await config.models.Profile.from(passkey.username);

            let access = AuthUserAccess.USER;
            if (profile.system_admin) {
                access = AuthUserAccess.ADMIN;
            } else if (profile.agency_admin && profile.agency_admin.length) {
                access = AuthUserAccess.AGENCY;
            }

            const userAgent = req.headers['user-agent'] || '';
            const ua = UAParser(userAgent);

            const session = await config.models.ProfileSession.generate({
                username: profile.username,
                created: new Date().toISOString(),
                ip: String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'Unknown'),
                device_type: ua.device.type || 'Desktop',
                browser: [ua.browser.name, ua.browser.version].filter(Boolean).join(' ') || 'Unknown',
                os: [ua.os.name, ua.os.version].filter(Boolean).join(' ') || 'Unknown',
                user_agent: userAgent,
            });

            await config.models.Profile.commit(profile.username, {
                last_login: new Date().toISOString()
            });

            let certRenewalRequired = false;
            try {
                const cert = new X509Certificate(profile.auth.cert);
                const certExpiry = new Date(cert.validTo);
                if (Number.isNaN(certExpiry.getTime()) || certExpiry.getTime() < Date.now() + (7 * 24 * 60 * 60 * 1000)) {
                    certRenewalRequired = true;
                }
            } catch {
                certRenewalRequired = true;
            }

            res.json({
                access,
                email: profile.username,
                token: jwt.sign(
                    { access, email: profile.username, s: session.id },
                    config.SigningSecret,
                    { expiresIn: '16h' }
                ),
                ...(certRenewalRequired ? { certRenewalRequired: true } : {}),
            });
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.delete('/login/passkey/:id', {
        name: 'Delete Passkey',
        group: 'Login',
        description: 'Delete a passkey belonging to the authenticated user',
        params: Type.Object({
            id: Type.Integer(),
        }),
        res: Type.Object({
            status: Type.Integer(),
            message: Type.String(),
        })
    }, async (req, res) => {
        try {
            await assertPasskeysEnabled();
            const user = await Auth.as_user(config, req);

            const passkey = await config.models.ProfilePasskey.from(req.params.id);
            if (passkey.username !== user.email) {
                throw new Err(403, null, 'Cannot delete another user\'s passkey');
            }

            await config.models.ProfilePasskey.delete(req.params.id);

            res.json({ status: 200, message: 'Passkey deleted' });
        } catch (err) {
            Err.respond(err, res);
        }
    });
}
