<template>
    <div
        class='position-absolute end-0 bottom-0 text-white bg-dark'
        style='z-index: 1; width: 400px; top: 56px;'
    >
        <div
            class='position-relative h-100 container px-0 overflow-auto'
            style='height: calc(100%)'
        >
            <TablerNone
                v-if='!feat'
                :create='false'
                label='CoT Marker'
            />
            <template v-else>
                <div
                    class='col-12 border-light border-bottom d-flex'
                    style='border-radius: 0px;'
                >
                    <div class='col-12 card-header row mx-1 my-2 d-flex'>
                        <div class='card-title d-flex'>
                            <span
                                v-if='feat.properties.status && !isNaN(parseInt(feat.properties.status.battery))'
                                v-tooltip='feat.properties.status.battery + "% Battery"'
                                class='d-flex'
                                style='margin-right: 10px;'
                            >
                                <IconBattery1
                                    v-if='parseInt(feat.properties.status.battery) <= 25'
                                    size='32'
                                />
                                <IconBattery2
                                    v-else-if='parseInt(feat.properties.status.battery) <= 50'
                                    size='32'
                                />
                                <IconBattery3
                                    v-else-if='parseInt(feat.properties.status.battery) <= 75'
                                    size='32'
                                />
                                <IconBattery4
                                    v-else-if='parseInt(feat.properties.status.battery) <= 100'
                                    size='32'
                                />
                            </span>
                            <div class='col-12'>
                                <TablerInput
                                    v-if='isUserDrawn'
                                    v-model='feat.properties.callsign'
                                />
                                <div
                                    v-else
                                    v-text='feat.properties.callsign'
                                />

                                <div>
                                    <span
                                        class='subheader'
                                        v-text='feat.properties.type'
                                    />
                                    <span
                                        class='subheader ms-auto'
                                        v-text='" (" + (feat.properties.how || "Unknown") + ")"'
                                    />
                                </div>
                            </div>
                        </div>
                        <div class='col-12 d-flex my-2'>
                            <div class='btn-list'>
                                <IconShare2
                                    v-tooltip='"Share"'
                                    size='32'
                                    class='cursor-pointer'
                                    @click='mode === "share" ? mode = "default" : mode = "share"'
                                />
                            </div>
                            <div class='ms-auto btn-list mx-2'>
                                <IconZoomPan
                                    v-tooltip='"Zoom To"'
                                    size='32'
                                    class='cursor-pointer'
                                    @click='zoomTo'
                                />

                                <IconCode
                                    v-if='mode === "default"'
                                    v-tooltip='"Raw View"'
                                    size='32'
                                    class='cursor-pointer'
                                    @click='mode = "raw"'
                                />
                                <IconX
                                    v-if='mode === "raw"'
                                    v-tooltip='"Default View"'
                                    size='32'
                                    class='cursor-pointer'
                                    @click='mode = "default"'
                                />
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

                    <div
                        v-if='feat.properties.contact && feat.properties.contact.phone'
                        class='col-12 px-2 pb-2'
                    >
                        <label class='subheader'>Phone</label>
                        <div
                            class='bg-gray-500 rounded mx-2 px-2 py-2'
                            v-text='phone(feat.properties.contact.phone)'
                        />
                    </div>
                    <div
                        v-if='!isNaN(feat.properties.course)'
                        class='col-12 py-2'
                    >
                        <label class='subheader mx-2'>Course</label>
                        <div
                            class='bg-gray-500 rounded mx-2 py-2 px-2'
                            v-text='feat.properties.course'
                        />
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

                    <div
                        v-if='feat.properties.links'
                        class='col-12 py-2'
                    >
                        <div class='table-responsive rounded mx-2 py-2 px-2'>
                            <table class='table card-table table-hover table-vcenter datatable'>
                                <thead>
                                    <th>Key</th>
                                    <th>Value</th>
                                </thead>
                                <tbody class='bg-gray-500'>
                                    <tr
                                        v-for='(link, link_it) of feat.properties.links'
                                        :key='link_it'
                                    >
                                        <td v-text='link.remarks' />
                                        <td>
                                            <a
                                                :href='link.url'
                                                v-text='link.url'
                                            />
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>


                    <div class='col-12 pb-2'>
                        <label class='subheader mx-3'>Times</label>
                        <div class='table-responsive rounded mx-2 py-2 px-2'>
                            <table class='table card-table table-hover table-vcenter datatable'>
                                <thead>
                                    <th>Key</th>
                                    <th>Value</th>
                                </thead>
                                <tbody class='bg-gray-500'>
                                    <tr>
                                        <td>Time</td><td v-text='feat.properties.time' />
                                    </tr>
                                    <tr>
                                        <td>Start</td><td v-text='feat.properties.start' />
                                    </tr>
                                    <tr>
                                        <td>Stale</td><td v-text='feat.properties.stale' />
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <template v-if='isUserDrawn'>
                        <CoTStyle v-model='feat' />
                    </template>

                    <div
                        v-if='feat.properties.takv && feat.properties.takv && Object.keys(feat.properties.takv).length'
                        class='col-12 px-1 pb-2'
                    >
                        <label class='subheader px-2'>Metadata</label>
                        <div class='table-responsive rounded mx-2 py-2 px-2'>
                            <table class='table card-table table-hover table-vcenter datatable'>
                                <thead>
                                    <th>Key</th>
                                    <th>Value</th>
                                </thead>
                                <tbody class='bg-gray-500'>
                                    <tr
                                        v-for='prop of Object.keys(feat.properties.takv)'
                                        :key='prop'
                                    >
                                        <td v-text='prop' />
                                        <td v-text='feat.properties.takv[prop]' />
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </template>
                <template v-else-if='mode === "share"'>
                    <div class='overflow-auto'>
                        <Share
                            style='height: 70vh'
                            :feats='[feat]'
                            @done='mode = "default"'
                            @cancel='mode = "default"'
                        />
                    </div>
                </template>
                <template v-else-if='mode === "raw"'>
                    <pre v-text='feat' />
                </template>
            </template>
        </div>
    </div>
</template>

<script>
import { mapState } from 'pinia'
import { useMapStore } from '/src/stores/map.ts';
const mapStore = useMapStore();
import {
    TablerNone,
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
import { useProfileStore } from '/src/stores/profile.ts';

export default {
    name: 'CloudTAKCoTView',
    data: function() {
        const feat = cotStore.get(this.$route.params.uid)

        return {
            feat,
            mode: 'default',
            icon: null
        }
    },
    watch: {
        '$route.params.uid': function() {
            const feat = cotStore.get(this.$route.params.uid)
            this.feat = feat;
        },
        feat: {
            deep: true,
            handler: async function() {
                await this.updateStyle();
            }
        }
    },
    unmounted: async function() {
        if (this.feat) await cotStore.add(this.feat);
    },
    computed: {
        ...mapState(useProfileStore, ['profile']),
        isUserDrawn: function() {
            if (!this.feat) return false;
            return this.feat.properties.type.toLowerCase().startsWith("u-d");
        },
        center: function() {
            if (!this.feat) return [0,0];
            return this.feat.properties.center;
        },
        remarks: function() {
            if (!this.feat) return '';

            return this.feat.properties.remarks
                .replace(/\n/g, '</br>')
                .replace(/(http(s)?:\/\/.*?(\s|$))/g, '[$1]($1) ')
                .trim()
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
        updateStyle: async function() {
            if (this.isUserDrawn) {
                await cotStore.add(this.feat);
            }
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
        TablerNone,
        TablerInput,
        TablerMarkdown,
        IconBattery1,
        IconBattery2,
        IconBattery3,
        IconBattery4
    }
}
</script>
