import * as fs from 'fs/promises';

// The magic bytes for a ZIP: "PK\x03\x04".
const ZIP_MAGIC_BYTES = Buffer.from([0x50, 0x4B, 0x03, 0x04]);

// The magic bytes for PMTiles: "PMTiles" (7 bytes) + version (1 byte = 0x03)
const PMTILES_MAGIC_BYTES = Buffer.from('PMTiles\x03', 'utf8');

export async function isZipFile(filePath: string): Promise<boolean> {
    try {
        const stats = await fs.stat(filePath);
        if (!stats.isFile()) {
            console.error(`Error: Path is not a regular file: '${filePath}'`);
            return false;
        }
    } catch (error) {
        const err = error as Error & { code?: string };
        if (err.code === 'ENOENT') {
            console.error(`Error: File not found: '${filePath}'`);
        } else {
            console.error(`Error accessing file '${filePath}': ${err.message}`);
        }

        return false;
    }

    let fileHandle: fs.FileHandle | undefined;
    try {
        fileHandle = await fs.open(filePath, 'r');
        const buffer = Buffer.alloc(4);
        await fileHandle.read(buffer, 0, 4, 0);

        return buffer.equals(ZIP_MAGIC_BYTES);
    } catch (error) {
        const err = error as Error;
        console.error(`Error reading file '${filePath}': ${err.message}`);
        return false;
    } finally {
        if (fileHandle) {
            await fileHandle.close();
        }
    }
}

/**
 * Check if a file is a valid PMTiles file by verifying the magic number
 * PMTiles files start with "PMTiles" followed by version byte (0x03 for v3)
 * @param filePath Path to the file to check
 * @returns true if the file has a valid PMTiles magic number
 */
export async function isPMTiles(filePath: string): Promise<boolean> {
    try {
        const stats = await fs.stat(filePath);
        if (!stats.isFile()) {
            console.error(`Error: Path is not a regular file: '${filePath}'`);
            return false;
        }
    } catch (error) {
        const err = error as Error & { code?: string };
        if (err.code === 'ENOENT') {
            console.error(`Error: File not found: '${filePath}'`);
        } else {
            console.error(`Error accessing file '${filePath}': ${err.message}`);
        }
        return false;
    }

    let fileHandle: fs.FileHandle | undefined;
    try {
        fileHandle = await fs.open(filePath, 'r');
        const buffer = Buffer.alloc(8);
        await fileHandle.read(buffer, 0, 8, 0);

        return buffer.equals(PMTILES_MAGIC_BYTES);
    } catch (error) {
        const err = error as Error;
        console.error(`Error reading file '${filePath}': ${err.message}`);
        return false;
    } finally {
        if (fileHandle) {
            await fileHandle.close();
        }
    }
}
