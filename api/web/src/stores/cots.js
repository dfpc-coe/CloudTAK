import { defineStore } from 'pinia'
import moment from 'moment';

export const useCOTStore = defineStore('cots', {
    state: () => {
        return {
            cots: new Map(),    // Store all on-screen CoT messages
        }
    },
    actions: {
        collection: function() {
            return {
                type: 'FeatureCollection',
                features:  Array.from(this.cots.values()).map((cot) => {
                    cot.properties['icon-opacity'] = moment().subtract(5, 'minutes').isBefore(moment(cot.properties.stale)) ? 1 : 0.5;
                    return cot;
                })
            }
        },
        get: function(id) {
            return this.cots.get(id);
        },
        has: function(id) {
            return this.cots.has(id);
        },
        delete: function(id) {
            this.cots.delete(id);
        },
        clear: function() {
            this.cots.clear();
        },
        add: function(feat) {
            //Vector Tiles only support integer IDs
            feat.properties.id = feat.id;

            if (feat.properties.icon) {
                // Format of icon needs to change for spritesheet
                feat.properties.icon = feat.properties.icon.replace('/', ':').replace(/.png$/, '');
            } else {
                feat.properties.icon = `${feat.properties.type}`;
            }


            // MapLibre Opacity must be of range 0-1
            if (feat.properties['fill-opacity']) feat.properties['fill-opacity'] = feat.properties['fill-opacity'] / 255;
            else feat.properties['fill-opacity'] = 1;
            if (feat.properties['stroke-opacity']) feat.properties['stroke-opacity'] = feat.properties['stroke-opacity'] / 255;
            else feat.properties['stroke-opacity'] = 1;

            this.cots.set(feat.id, feat);
        }
    }
})
