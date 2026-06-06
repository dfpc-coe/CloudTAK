import fs from 'node:fs';
import readline from 'node:readline';

/**
 * Count the number of features in a line-delimited GeoJSON file
 * @param filePath Path to the .geojsonld file
 * @returns Number of features
 */
export async function countFeatures(filePath: string): Promise<number> {
    let count = 0;
    const readStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({
        input: readStream,
        crlfDelay: Infinity,
    });

    for await (const line of rl) {
        if (!line.trim()) continue;
        try {
            const feat = JSON.parse(line);
            if (feat.type === 'Feature' || feat.type === 'FeatureCollection') {
                count++;
            }
        } catch {
            // Skip invalid lines
        }
    }

    return count;
}
