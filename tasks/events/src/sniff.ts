import * as fs from 'fs/promises';

// The magic bytes for a ZIP: "PK\x03\x04".
const ZIP_MAGIC_BYTES = Buffer.from([0x50, 0x4B, 0x03, 0x04]);

export async function isZipFile(filePath: string): Promise<boolean> {
    try {
        const stats = await fs.stat(filePath);
        if (!stats.isFile()) {
            console.error(`Error: Path is not a regular file: '${filePath}'`);
            return false;
        }
    } catch (error: any) {
        if (error.code === 'ENOENT') {
            console.error(`Error: File not found: '${filePath}'`);
        } else {
            console.error(`Error accessing file '${filePath}': ${error.message}`);
        }

        return false;
    }

    let fileHandle: fs.FileHandle | undefined;
    try {
        fileHandle = await fs.open(filePath, 'r');
        const buffer = Buffer.alloc(4);
        await fileHandle.read(buffer, 0, 4, 0);

        return buffer.equals(ZIP_MAGIC_BYTES);
    } catch (error: any) {
        console.error(`Error reading file '${filePath}': ${error.message}`);
        return false;
    } finally {
        if (fileHandle) {
            await fileHandle.close();
        }
    }
}
