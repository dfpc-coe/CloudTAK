/**
 * KLV / MISB ST 0601 parser for UAS metadata embedded in MPEG-TS / HLS streams.
 * Pure TypeScript, zero dependencies.
 */

// ---- Types ----------------------------------------------------------------

export interface KLVField {
    tag: number;
    name: string;
    rawValue: Uint8Array;
    value: string | number;
    unit: string;
}

export interface KLVParseResult {
    valid: boolean;
    timestamp?: Date;
    fields: Map<number, KLVField>;
}

// ---- Tag Registry ----------------------------------------------------------

interface TagDef {
    name: string;
    unit: string;
    decode: (raw: Uint8Array) => string | number;
}

function mapValue(raw: Uint8Array, min: number, max: number, signed: boolean): number {
    if (raw.length === 0) return 0;
    const intVal = signed ? decodeInt(raw) : decodeUint(raw);
    const maxInt = signed
        ? Math.pow(2, raw.length * 8 - 1) - 1
        : Math.pow(2, raw.length * 8) - 1;
    return min + ((intVal / maxInt) * (max - min));
}

function decodeUint(raw: Uint8Array): number {
    let v = 0;
    for (let i = 0; i < raw.length; i++) {
        v = (v << 8) | raw[i];
    }
    return v >>> 0; // ensure unsigned
}

function decodeInt(raw: Uint8Array): number {
    if (raw.length === 0) return 0;
    const u = decodeUint(raw);
    const bits = raw.length * 8;
    const sign = 1 << (bits - 1);
    if (u & sign) {
        return u - (1 << bits);
    }
    return u;
}

function decodeString(raw: Uint8Array): string {
    return new TextDecoder('utf-8').decode(raw);
}

function decodeTimestamp(raw: Uint8Array): Date {
    // MISB precision timestamp: microseconds since 1 Jan 1970 (8 bytes)
    if (raw.length < 8) return new Date(0);
    const hi = decodeUint(raw.subarray(0, 4));
    const lo = decodeUint(raw.subarray(4, 8));
    const microseconds = hi * 0x100000000 + lo;
    return new Date(microseconds / 1000);
}

const TAG_REGISTRY: Record<number, TagDef> = {
    1:  { name: 'Checksum', unit: '', decode: (r) => '0x' + Array.from(r).map(b => b.toString(16).padStart(2, '0')).join('') },
    2:  { name: 'Precision Timestamp', unit: '', decode: (r) => decodeTimestamp(r).toISOString() },
    3:  { name: 'Mission ID', unit: '', decode: decodeString },
    4:  { name: 'Platform Tail Number', unit: '', decode: decodeString },
    5:  { name: 'Platform Heading', unit: '\u00B0', decode: (r) => +mapValue(r, 0, 360, false).toFixed(2) },
    6:  { name: 'Platform Pitch', unit: '\u00B0', decode: (r) => +mapValue(r, -20, 20, true).toFixed(2) },
    7:  { name: 'Platform Roll', unit: '\u00B0', decode: (r) => +mapValue(r, -50, 50, true).toFixed(2) },
    8:  { name: 'Platform True Airspeed', unit: 'm/s', decode: (r) => decodeUint(r) },
    9:  { name: 'Platform Indicated Airspeed', unit: 'm/s', decode: (r) => decodeUint(r) },
    10: { name: 'Platform Designation', unit: '', decode: decodeString },
    11: { name: 'Image Source Sensor', unit: '', decode: decodeString },
    12: { name: 'Image Coordinate System', unit: '', decode: decodeString },
    13: { name: 'Sensor Latitude', unit: '\u00B0', decode: (r) => +mapValue(r, -90, 90, true).toFixed(6) },
    14: { name: 'Sensor Longitude', unit: '\u00B0', decode: (r) => +mapValue(r, -180, 180, true).toFixed(6) },
    15: { name: 'Sensor True Altitude', unit: 'm', decode: (r) => +mapValue(r, -900, 19000, false).toFixed(1) },
    16: { name: 'Sensor H-FOV', unit: '\u00B0', decode: (r) => +mapValue(r, 0, 180, false).toFixed(2) },
    17: { name: 'Sensor V-FOV', unit: '\u00B0', decode: (r) => +mapValue(r, 0, 180, false).toFixed(2) },
    18: { name: 'Sensor Rel Azimuth', unit: '\u00B0', decode: (r) => +mapValue(r, 0, 360, false).toFixed(2) },
    19: { name: 'Sensor Rel Elevation', unit: '\u00B0', decode: (r) => +mapValue(r, -180, 180, true).toFixed(2) },
    20: { name: 'Sensor Rel Roll', unit: '\u00B0', decode: (r) => +mapValue(r, 0, 360, false).toFixed(2) },
    21: { name: 'Slant Range', unit: 'm', decode: (r) => +mapValue(r, 0, 5000000, false).toFixed(1) },
    22: { name: 'Target Width', unit: 'm', decode: (r) => +mapValue(r, 0, 10000, false).toFixed(1) },
    23: { name: 'Frame Center Lat', unit: '\u00B0', decode: (r) => +mapValue(r, -90, 90, true).toFixed(6) },
    24: { name: 'Frame Center Lon', unit: '\u00B0', decode: (r) => +mapValue(r, -180, 180, true).toFixed(6) },
    25: { name: 'Frame Center Elev', unit: 'm', decode: (r) => +mapValue(r, -900, 19000, false).toFixed(1) },
    40: { name: 'Target Location Lat', unit: '\u00B0', decode: (r) => +mapValue(r, -90, 90, true).toFixed(6) },
    41: { name: 'Target Location Lon', unit: '\u00B0', decode: (r) => +mapValue(r, -180, 180, true).toFixed(6) },
    42: { name: 'Target Location Elev', unit: 'm', decode: (r) => +mapValue(r, -900, 19000, false).toFixed(1) },
    48: { name: 'Security Local Metadata Set', unit: '', decode: (r) => `[${r.length} bytes]` },
    65: { name: 'UAS LDS Version', unit: '', decode: (r) => decodeUint(r) },
};

// ---- 16-byte SMPTE 336M UAS Local Data Set key ----------------------------

const UAS_LOCAL_SET_KEY = new Uint8Array([
    0x06, 0x0E, 0x2B, 0x34, 0x02, 0x0B, 0x01, 0x01,
    0x0E, 0x01, 0x03, 0x01, 0x01, 0x00, 0x00, 0x00,
]);

// ---- Helpers ---------------------------------------------------------------

function findUASLocalSet(data: Uint8Array): number {
    outer:
    for (let i = 0; i <= data.length - 16; i++) {
        for (let j = 0; j < 16; j++) {
            if (data[i + j] !== UAS_LOCAL_SET_KEY[j]) continue outer;
        }
        return i;
    }
    return -1;
}

interface BERResult { value: number; bytesRead: number }

function decodeBERLength(data: Uint8Array, offset: number): BERResult {
    if (offset >= data.length) return { value: 0, bytesRead: 0 };
    const first = data[offset];
    if ((first & 0x80) === 0) {
        // Short form
        return { value: first, bytesRead: 1 };
    }
    // Long form
    const numBytes = first & 0x7F;
    if (numBytes === 0 || offset + 1 + numBytes > data.length) {
        return { value: 0, bytesRead: 1 };
    }
    let value = 0;
    for (let i = 0; i < numBytes; i++) {
        value = (value << 8) | data[offset + 1 + i];
    }
    return { value, bytesRead: 1 + numBytes };
}

function decodeBEROID(data: Uint8Array, offset: number): BERResult {
    if (offset >= data.length) return { value: 0, bytesRead: 0 };
    const first = data[offset];
    if ((first & 0x80) === 0) {
        return { value: first, bytesRead: 1 };
    }
    // Two-byte tag (BER-OID)
    if (offset + 1 >= data.length) return { value: first & 0x7F, bytesRead: 1 };
    const second = data[offset + 1];
    return { value: ((first & 0x7F) << 7) | (second & 0x7F), bytesRead: 2 };
}

function verifyChecksum(data: Uint8Array, setStart: number, setLength: number): boolean {
    // Sum all bytes in the UAS Local Data Set (16-byte key + BER length + value portion)
    // The checksum (tag 1) value should make the running 16-bit sum equal to 0
    let sum = 0;
    const end = Math.min(setStart + setLength, data.length);
    for (let i = setStart; i < end; i++) {
        sum = (sum + data[i]) & 0xFFFF;
    }
    return sum === 0;
}

// ---- Main parser -----------------------------------------------------------

export function parseKLV(data: Uint8Array): KLVParseResult {
    const result: KLVParseResult = { valid: false, fields: new Map() };

    const keyOffset = findUASLocalSet(data);
    if (keyOffset < 0) return result;

    let offset = keyOffset + 16; // skip the 16-byte key

    // Decode BER length of the set
    const setLen = decodeBERLength(data, offset);
    if (setLen.bytesRead === 0) return result;
    offset += setLen.bytesRead;

    const setEnd = Math.min(offset + setLen.value, data.length);
    const setStart = keyOffset; // for checksum verification

    // Iterate TLV triplets
    let checksumOk = true;
    while (offset < setEnd) {
        // Tag (BER-OID encoded)
        const tag = decodeBEROID(data, offset);
        if (tag.bytesRead === 0) break;
        offset += tag.bytesRead;

        // Length (BER encoded)
        const len = decodeBERLength(data, offset);
        if (len.bytesRead === 0) break;
        offset += len.bytesRead;

        // Value
        if (offset + len.value > data.length) break;
        const rawValue = data.subarray(offset, offset + len.value);
        offset += len.value;

        // Checksum (tag 1) — verify but don't fail
        if (tag.value === 1) {
            checksumOk = verifyChecksum(data, setStart, setEnd - setStart);
            continue; // don't add checksum to display fields
        }

        const def = TAG_REGISTRY[tag.value];
        if (def) {
            try {
                const decoded = def.decode(rawValue);
                result.fields.set(tag.value, {
                    tag: tag.value,
                    name: def.name,
                    rawValue: new Uint8Array(rawValue),
                    value: decoded,
                    unit: def.unit,
                });

                // Extract timestamp
                if (tag.value === 2 && rawValue.length >= 8) {
                    result.timestamp = decodeTimestamp(rawValue);
                }
            } catch {
                // Skip fields that fail to decode
            }
        }
    }

    if (!checksumOk) {
        // Non-fatal: still return parsed data but note in console
        console.warn('KLV checksum verification failed');
    }

    result.valid = result.fields.size > 0;
    return result;
}

// ---- ID3 PRIV frame extraction ---------------------------------------------

/**
 * Extract KLV data from an ID3v2 PRIV frame (the standard way HLS carries KLV).
 * ID3v2 header: "ID3" + version(2) + flags(1) + size(4 syncsafe).
 * PRIV frame: "PRIV" + size(4) + flags(2) + owner-string + 0x00 + data.
 */
export function parseID3PrivKLV(data: Uint8Array): KLVParseResult | null {
    if (data.length < 10) return null;

    // Check for ID3v2 header
    if (data[0] !== 0x49 || data[1] !== 0x44 || data[2] !== 0x33) {
        // Not an ID3 tag — try direct KLV parse
        return parseKLV(data);
    }

    // Decode syncsafe size
    const size = ((data[6] & 0x7F) << 21) |
                 ((data[7] & 0x7F) << 14) |
                 ((data[8] & 0x7F) << 7)  |
                  (data[9] & 0x7F);

    let offset = 10; // skip ID3 header
    const end = Math.min(10 + size, data.length);

    while (offset + 10 < end) {
        // Frame ID (4 bytes ASCII)
        const frameId = String.fromCharCode(data[offset], data[offset + 1], data[offset + 2], data[offset + 3]);

        // Frame size (4 bytes, big-endian for ID3v2.3, syncsafe for v2.4)
        const frameSize = (data[offset + 4] << 24) |
                          (data[offset + 5] << 16) |
                          (data[offset + 6] << 8)  |
                           data[offset + 7];

        // Frame flags (2 bytes)
        offset += 10;

        if (frameSize <= 0 || offset + frameSize > end) break;

        if (frameId === 'PRIV') {
            // Owner is null-terminated string
            let nullPos = offset;
            while (nullPos < offset + frameSize && data[nullPos] !== 0) {
                nullPos++;
            }

            // KLV data starts after the null terminator
            const klvStart = nullPos + 1;
            if (klvStart < offset + frameSize) {
                const klvData = data.subarray(klvStart, offset + frameSize);
                const parsed = parseKLV(klvData);
                if (parsed.valid) return parsed;
            }
        }

        offset += frameSize;
    }

    // No PRIV frame found — try direct parse on the whole blob
    return parseKLV(data);
}
