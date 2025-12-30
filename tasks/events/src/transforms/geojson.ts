import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import type { Message, LocalMessage, Transform, ConvertResponse } from '../types.ts';

export default class GeoJSON implements Transform {
    static register() {
        return {
            inputs: ['.geojsonld', '.geojson', '.json']
        };
    }

    msg: Message;
    local: LocalMessage;

    constructor(
        msg: Message,
        local: LocalMessage
    ) {
        this.msg = msg;
        this.local = local;
    }

    async convert(): Promise<ConvertResponse> {
        const inputFile = path.resolve(this.local.tmpdir, `${this.local.id}${this.local.ext}`);
        const outputFile = path.resolve(this.local.tmpdir, `output-${this.local.id}.geojsonld`);

        let isFeatureCollection = false;

        try {
            const content = await fs.promises.readFile(inputFile, 'utf8');
            const json = JSON.parse(content);

            if (json.type === 'FeatureCollection' && Array.isArray(json.features)) {
                isFeatureCollection = true;
                const writeStream = fs.createWriteStream(outputFile);
                for (const feature of json.features) {
                    writeStream.write(JSON.stringify(feature) + '\n');
                }
                writeStream.end();
                await new Promise((resolve, reject) => {
                    writeStream.on('finish', resolve);
                    writeStream.on('error', reject);
                });
            } else if (json.type === 'Feature') {
                isFeatureCollection = true;
                await fs.promises.writeFile(outputFile, JSON.stringify(json) + '\n');
            }
        } catch {
            // Fallback to line-delimited processing
        }

        if (!isFeatureCollection) {
            const fileStream = fs.createReadStream(inputFile);
            const rl = readline.createInterface({
                input: fileStream,
                crlfDelay: Infinity
            });

            const writeStream = fs.createWriteStream(outputFile);

            for await (const line of rl) {
                if (!line.trim()) continue;
                try {
                    const json = JSON.parse(line);
                    if (json.type === 'Feature') {
                        writeStream.write(JSON.stringify(json) + '\n');
                    } else if (json.type === 'FeatureCollection' && Array.isArray(json.features)) {
                        for (const feature of json.features) {
                            writeStream.write(JSON.stringify(feature) + '\n');
                        }
                    }
                } catch {
                    // Skip invalid lines
                }
            }

            writeStream.end();
            await new Promise((resolve, reject) => {
                writeStream.on('finish', resolve);
                writeStream.on('error', reject);
            });
        }

        return {
            asset: outputFile
        }
    }
}
