<template>
<div
    class='position-absolute end-0 bottom-0 text-white py-2 bg-dark'
    style='z-index: 1; width: 400px; top: 56px;'
>
    <div class='col-12 border-light border-bottom d-flex'>
        <div class='col-12 card-header row mx-1 my-2 d-flex'>
            <div class='card-title d-flex'>
                <span
                    v-if='feat.properties.status && !isNaN(parseInt(feat.properties.status.battery))'
                    class='d-flex'
                    style='margin-right: 10px;'
                    v-tooltip='feat.properties.status.battery + "% Battery"'
                >
                    <IconBattery1 v-if='parseInt(feat.properties.status.battery) <= 25' size='32'/>
                    <IconBattery2 v-else-if='parseInt(feat.properties.status.battery) <= 50' size='32'/>
                    <IconBattery3 v-else-if='parseInt(feat.properties.status.battery) <= 75' size='32'/>
                    <IconBattery4 v-else-if='parseInt(feat.properties.status.battery) <= 100' size='32'/>
                </span>
                <div class='col-12'>
                    <TablerInput v-if='isUserDrawn' v-model='feat.properties.callsign'/>
                    <div v-else v-text='feat.properties.callsign'></div>

                    <div>
                        <span class='subheader' v-text='feat.properties.type'/>
                        <span class='subheader ms-auto' v-text='" (" + (feat.properties.how || "Unknown") + ")"'/>
                    </div>
                </div>
            </div>
            <div class='col-12 d-flex my-2'>
                <div class='btn-list'>
                    <IconShare2 @click='mode === "share" ? mode = "default" : mode = "share"' size='32' class='cursor-pointer' v-tooltip='"Share"'/>
                </div>
                <div class='ms-auto btn-list mx-2'>
                    <IconZoomPan @click='zoomTo' size='32' class='cursor-pointer' v-tooltip='"Zoom To"'/>

                    <IconCode v-if='mode === "default"' @click='mode = "raw"' size='32' class='cursor-pointer' v-tooltip='"Raw View"'/>
                    <IconX v-if='mode === "raw"' @click='mode = "default"' size='32' class='cursor-pointer' v-tooltip='"Default View"'/>
                </div>
            </div>
        </div>
    </div>

    <template v-if='mode === "default"'>
        <Coordinate
            v-model='center'
            class='py-2'
        />

        <Speed
            v-if='!isNaN(feat.properties.speed)'
            :unit='profile.display_speed'
            :speed='feat.properties.speed'
            class='py-2'
        />

        <div v-if='feat.properties.contact && feat.properties.contact.phone' class='col-12 px-3 pb-2'>
            <label class='subheader'>Phone</label>
            <div v-text='phone(feat.properties.contact.phone)' class='bg-gray-500 rounded mx-2 py-2 px-2'/>
        </div>
        <div v-if='!isNaN(feat.properties.course)' class='col-12 py-2'>
            <label class='subheader mx-2'>Course</label>
            <div v-text='feat.properties.course' class='bg-gray-500 rounded mx-2 py-2 px-2'/>
        </div>

        <div class='col-12 py-2'>
            <label class='subheader mx-2'>Remarks</label>
            <div class='bg-gray-500 rounded mx-2 py-2 px-2'>
                <TablerMarkdown
                    :markdown='remarks'
                    class='mx-1'
                />
            </div>
        </div>

        <div v-if='feat.properties.links' class='col-12 py-2'>
            <div class='table-responsive rounded mx-2 py-2 px-2'>
                <table class="table card-table table-hover table-vcenter datatable">
                    <thead>
                        <th>Key</th>
                        <th>Value</th>
                    </thead>
                    <tbody class='bg-gray-500'>
                        <tr :key='link_it' v-for='(link, link_it) of feat.properties.links'>
                            <td v-text='link.remarks'/>
                            <td><a :href='link.url' v-text='link.url'/></td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>


        <div class='col-12 pb-2'>
            <label class='subheader mx-3'>Times</label>
            <div class='table-responsive rounded mx-2 py-2 px-2'>
                <table class="table card-table table-hover table-vcenter datatable">
                    <thead>
                        <th>Key</th>
                        <th>Value</th>
                    </thead>
                    <tbody class='bg-gray-500'>
                        <tr>
                            <td>Time</td><td v-text='feat.properties.time'></td>
                        </tr>
                        <tr>
                            <td>Start</td><td v-text='feat.properties.start'></td>
                        </tr>
                        <tr>
                            <td>Stale</td><td v-text='feat.properties.stale'></td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>

        <template v-if='isUserDrawn'>
            <CoTStyle v-model='feat'/>
        </template>

        <div v-if='feat.properties.takv && feat.properties.takv && Object.keys(feat.properties.takv).length' class='col-12 px-1 pb-2'>
            <label class='subheader px-2'>Metadata</label>
            <div class='table-responsive rounded mx-2 py-2 px-2'>
                <table class="table card-table table-hover table-vcenter datatable">
                    <thead>
                        <th>Key</th>
                        <th>Value</th>
                    </thead>
                    <tbody class='bg-gray-500'>
                        <tr :key='prop' v-for='prop of Object.keys(feat.properties.takv)'>
                            <td v-text='prop'/>
                            <td v-text='feat.properties.takv[prop]'/>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    </template>
    <template v-else-if='mode === "share"'>
        <div class='overflow-auto'>
            <Share
                @done='mode = "default"'
                @cancel='mode = "default"'
                style='height: 70vh'
                :feats='[feat]'
            />
        </div>
    </template>
    <template v-else-if='mode === "raw"'>
        <pre v-text='feat'/>
    </template>
</div>
</template>

<script>
import { mapState } from 'pinia'
import { useMapStore } from '/src/stores/map.ts';
const mapStore = useMapStore();
import {
    TablerInput,
    TablerMarkdown
} from '@tak-ps/vue-tabler';
import Share from './util/Share.vue';
import CoTStyle from './util/CoTStyle.vue';
import Coordinate from './util/Coordinate.vue';
import Speed from './util/Speed.vue';
import phone from 'phone';
import {
    IconX,
    IconShare2,
    IconZoomPan,
    IconCode,
    IconBattery1,
    IconBattery2,
    IconBattery3,
    IconBattery4
} from '@tabler/icons-vue';
import { useCOTStore } from '/src/stores/cots.ts';
const cotStore = useCOTStore();
import { useProfileStore } from '/src/stores/profile.js';

export default {
    name: 'CloudTAKCoTView',
    props: {
        cot: {
            type: Object,
            required: true
        }
    },
    watch: {
        feat: {
            deep: true,
            handler: function() {
                this.updateStyle();
            }
        }
    },
    data: function() {
        return {
            mode: 'default',
            feat: cotStore.get(this.cot.properties.id),
            icon: null
        }
    },
    mounted: function() {
        if (this.isUserDrawn) {
            if (mapStore.map.getLayer('cots-edit-fill')) {
                mapStore.map.removeLayer('cots-edit-fill');
            }
            if (mapStore.map.getLayer('cots-edit-line')) {
                mapStore.map.removeLayer('cots-edit-line');
            }

            mapStore.map.addLayer({
                id: 'cots-edit-fill',
                type: 'fill',
                source: 'cots',
                filter: ['==', ['get', 'id'], this.cot.properties.id],
                paint: {
                    'fill-color': this.cot.properties.fill,
                    'fill-opacity': this.cot.properties['fill-opacity']
                },
            });
            mapStore.map.addLayer({
                id: 'cots-edit-line',
                type: 'line',
                source: 'cots',
                filter: ['==', ['get', 'id'], this.cot.properties.id],
                paint: {
                    'line-color': this.cot.properties.stroke,
                    'line-opacity': this.cot.properties['stroke-opacity'],
                    'line-width': this.cot.properties['stroke-width']
                },
            });
        }
    },
    unmounted: function() {
        if (this.isUserDrawn) {
            mapStore.map.removeLayer('cots-edit-fill');
            mapStore.map.removeLayer('cots-edit-line');
        }

        cotStore.update(this.feat);
    },
    computed: {
        ...mapState(useProfileStore, ['profile']),
        isUserDrawn: function() {
            return this.cot.properties.type.toLowerCase().startsWith("u-d");
        },
        center: function() {
            return JSON.parse(this.cot.properties.center);
        },
        remarks: function() {
            return this.cot.properties.remarks.replace(/(http(s)?:\/\/.*?(\s|$))/g, '[$1]($1) ');
        }
    },
    methods: {
        phone: function(number) {
            const p = phone(number);

            if (!p.isValid) return number;

            if (p.countryCode === '+1') {
                return `${p.phoneNumber.slice(0, 2)} (${p.phoneNumber.slice(2, 5)}) ${p.phoneNumber.slice(5, 8)}-${p.phoneNumber.slice(8, 12)}`;
            } else {
                return p;
            }
        },
        updateStyle: function() {
            mapStore.map.setPaintProperty('cots-edit-fill', 'fill-color', this.feat.properties.fill);
            mapStore.map.setPaintProperty('cots-edit-fill', 'fill-opacity', Number(this.feat.properties['fill-opacity']));
            mapStore.map.setPaintProperty('cots-edit-line', 'line-color', this.feat.properties.stroke);
            mapStore.map.setPaintProperty('cots-edit-line', 'line-width', Number(this.feat.properties['stroke-width']));
            mapStore.map.setPaintProperty('cots-edit-line', 'line-opacity', Number(this.feat.properties['stroke-opacity']));
        },
        zoomTo: function() {
            mapStore.map.flyTo({
                center: this.center,
                zoom: 14
            })
        }
    },
    components: {
        IconX,
        IconCode,
        IconShare2,
        CoTStyle,
        IconZoomPan,
        Speed,
        Share,
        Coordinate,
        TablerInput,
        TablerMarkdown,
        IconBattery1,
        IconBattery2,
        IconBattery3,
        IconBattery4
    }
}
</script>
