import fs from 'fs';
import path from 'path';

const MOUNT_PATH = '/mnt/efs';
const RETENTION_DAYS = 7;
const RETENTION_MS = RETENTION_DAYS * 24 * 60 * 60 * 1000;

export const handler = async () => {
    const now = Date.now();
    let deletedCount = 0;

    async function walk(dir) {
        let files;
        try {
            files = await fs.promises.readdir(dir);
        } catch (err) {
            console.error(`Error reading directory ${dir}: ${err}`);
            return;
        }

        for (const file of files) {
            const filePath = path.join(dir, file);
            try {
                const stats = await fs.promises.stat(filePath);
                if (stats.isDirectory()) {
                    await walk(filePath);
                } else {
                    if (now - stats.mtimeMs > RETENTION_MS) {
                        await fs.promises.unlink(filePath);
                        deletedCount++;
                        console.log(`Deleted ${filePath}`);
                    }
                }
            } catch (err) {
                console.error(`Error processing ${filePath}: ${err}`);
            }
        }
    }

    console.log('Starting cleanup...');

    if (fs.existsSync(MOUNT_PATH)) {
        await walk(MOUNT_PATH);
    } else {
        console.log(`Mount path ${MOUNT_PATH} does not exist.`);
    }

    console.log(`Cleanup complete. Deleted ${deletedCount} files.`);
    return { deleted: deletedCount };
};
