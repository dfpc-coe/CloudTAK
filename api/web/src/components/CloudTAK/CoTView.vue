<template>
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
                            :size='32'
                            :stroke='1'
                        />
                        <IconBattery2
                            v-else-if='parseInt(feat.properties.status.battery) <= 50'
                            :size='32'
                            :stroke='1'
                        />
                        <IconBattery3
                            v-else-if='parseInt(feat.properties.status.battery) <= 75'
                            :size='32'
                            :stroke='1'
                        />
                        <IconBattery4
                            v-else-if='parseInt(feat.properties.status.battery) <= 100'
                            :size='32'
                            :stroke='1'
                        />
                    </span>
                    <div class='col-12'>
                        <TablerInput
                            v-if='feat.properties.archived'
                            v-model='feat.properties.callsign'
                        />
                        <div
                            v-else
                            v-text='feat.properties.callsign'
                        />

                        <div>
                            <span
                                class='subheader'
                                v-text='type ? type.full : feat.properties.type'
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
                            :size='32'
                            :stroke='1'
                            class='cursor-pointer'
                            @click='mode === "share" ? mode = "default" : mode = "share"'
                        />
                    </div>
                    <div class='ms-auto btn-list mx-2'>
                        <TablerDelete
                            displaytype='icon'
                            @delete='deleteCOT'
                        />
                        <IconZoomPan
                            v-tooltip='"Zoom To"'
                            :size='32'
                            :stroke='1'
                            class='cursor-pointer'
                            @click='zoomTo'
                        />
                        <IconCode
                            v-if='mode === "default"'
                            v-tooltip='"Raw View"'
                            :size='32'
                            :stroke='1'
                            class='cursor-pointer'
                            @click='mode = "raw"'
                        />
                        <IconX
                            v-if='mode === "raw"'
                            v-tooltip='"Default View"'
                            :size='32'
                            :stroke='1'
                            class='cursor-pointer'
                            @click='mode = "default"'
                        />
                    </div>
                </div>
            </div>
        </div>

        <div
            v-if='mode === "default"'
            class='overflow-auto'
            style='height: calc(100vh - 160px)'
        >
            <div class='row g-0'>
                <div
                    v-if='mission'
                    class='col-12'
                >
                    <div class='d-flex align-items-center py-2 px-2 my-2 mx-2 rounded bg-gray-500'>
                        <IconAmbulance
                            :size='32'
                            :stroke='1'
                        />
                        <span class='mx-2'>This Feature is part of a Data Sync</span>
                    </div>
                </div>

                <div
                    class='pt-2'
                    :class='{
                        "col-md-8": center.length > 2,
                        "col-12": center.length <= 2,
                    }'
                >
                    <Coordinate
                        v-model='center'
                    />
                </div>
                <div
                    v-if='center.length > 2'
                    class='col-md-4 pt-2'
                >
                    <Elevation
                        :unit='profile.display_elevation'
                        :elevation='feat.properties.center[2]'
                    />
                </div>

                <div
                    v-if='!isNaN(feat.properties.speed)'
                    class='pt-2'
                    :class='{
                        "col-md-6": feat.properties.course,
                        "col-12": !feat.properties.course,
                    }'
                >
                    <Speed
                        :unit='profile.display_speed'
                        :speed='feat.properties.speed'
                        class='py-2'
                    />
                </div>

                <div
                    v-if='!isNaN(feat.properties.speed)'
                    class='pt-2'
                    :class='{
                        "col-md-6": feat.properties.course,
                        "col-12": !feat.properties.course,
                    }'
                >
                    <Course
                        :course='feat.properties.course'
                        class='py-2'
                    />
                </div>

                <div
                    v-if='feat.properties.contact && feat.properties.contact.phone'
                    class='pt-2'
                >
                    <Phone
                        :phone='feat.properties.contact.phone'
                    />
                </div>
            </div>

            <Attachments
                v-if='!feat.properties.contact'
                :attachments='feat.properties.attachments || []'
                class='py-2'
                @attachment='addAttachment($event)'
            />

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
                            <tr>
                                <th>Key</th>
                                <th>Value</th>
                            </tr>
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


            <div
                v-if='!feat.properties.archived'
                class='col-12 pb-2'
            >
                <div class='d-flex mx-3'>
                    <label class='subheader'>Times</label>
                    <div class='ms-auto cursor-pointer text-blue subheader'>
                        <span
                            v-if='time === "relative"'
                            @click='time = "absolute"'
                        >Absolute</span>
                        <span
                            v-if='time === "absolute"'
                            @click='time = "relative"'
                        >Relative</span>
                    </div>
                </div>
                <div class='table-responsive rounded mx-2 py-2 px-2'>
                    <table class='table card-table table-hover table-vcenter datatable'>
                        <thead>
                            <tr>
                                <th>Key</th>
                                <th>Value</th>
                            </tr>
                        </thead>
                        <tbody class='bg-gray-500'>
                            <tr>
                                <td>Time</td><td v-text='timediff(feat.properties.time)' />
                            </tr>
                            <tr>
                                <td>Start</td><td v-text='timediff(feat.properties.start)' />
                            </tr>
                            <tr>
                                <td>Stale</td><td v-text='timediff(feat.properties.stale)' />
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
            <TablerToggle
                v-if='isArchivable'
                v-model='feat.properties.archived'
                label='Archived'
                class='mx-2'
            />

            <div
                v-if='feat.properties.video'
                class='col-12 px-1 pb-2'
            >
                <div class='d-flex mx-3'>
                    <label class='subheader'>Video</label>
                </div>

                <CoTVideo
                    v-if='viewer'
                    class='my-2 mx-2'
                    @close='viewer = false'
                    :video='feat.properties.video.url'
                />

                <div class='table-responsive rounded mx-2 py-2 px-2'>
                    <table class='table card-table table-hover table-vcenter datatable'>
                        <thead>
                            <tr>
                                <th>Key</th>
                                <th>Value</th>
                            </tr>
                        </thead>
                        <tbody class='bg-gray-500'>
                            <tr
                                v-for='prop of Object.keys(feat.properties.video)'
                                :key='prop'
                            >
                                <td>
                                    <IconPlayerPlay
                                        v-if='prop === "url"'
                                        v-tooltip='"View Video Stream"'
                                        class='cursor-pointer'
                                        size='32'
                                        stroke='1'
                                        @click='viewer = true'
                                    />
                                    <span
                                        v-else
                                        v-text='prop'
                                    />
                                </td>
                                <td v-text='feat.properties.video[prop]' />
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <CoTStyle
                v-if='feat.properties.archived'
                :key='feat.id'
                v-model='feat'
            />

            <div
                v-if='feat.properties.takv && feat.properties.takv && Object.keys(feat.properties.takv).length'
                class='col-12 px-1 pb-2'
            >
                <label class='subheader px-2'>Metadata</label>
                <div class='table-responsive rounded mx-2 py-2 px-2'>
                    <table class='table card-table table-hover table-vcenter datatable'>
                        <thead>
                            <tr>
                                <th>Key</th>
                                <th>Value</th>
                            </tr>
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
        </div>
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
            <div
                style='height: calc(100vh - 160px)'
                class='overflow-auto'
            >
                <pre v-text='feat' />
            </div>
        </template>
    </template>
</template>

<script>
import { mapState } from 'pinia'
import { useMapStore } from '/src/stores/map.ts';
const mapStore = useMapStore();
import {
    TablerNone,
    TablerInput,
    TablerToggle,
    TablerDelete,
    TablerMarkdown
} from '@tak-ps/vue-tabler';
import Share from './util/Share.vue';
import CoTStyle from './util/CoTStyle.vue';
import Coordinate from './util/Coordinate.vue';
import Course from './util/Course.vue';
import CoTVideo from './util/Video.vue';
import Phone from './util/Phone.vue';
import Speed from './util/Speed.vue';
import Elevation from './util/Elevation.vue';
import Attachments from './util/Attachments.vue';
import {
    IconX,
    IconAmbulance,
    IconPlayerPlay,
    IconShare2,
    IconZoomPan,
    IconCode,
    IconBattery1,
    IconBattery2,
    IconBattery3,
    IconBattery4
} from '@tabler/icons-vue';
import timediff from '/src/timediff.ts';
import { std } from '/src/std.ts';
import { useCOTStore } from '/src/stores/cots.ts';
const cotStore = useCOTStore();
import { useProfileStore } from '/src/stores/profile.ts';

export default {
    name: 'CloudTAKCoTView',
    data: function() {
        const base = {
            feat: null,
            mission: false,
            type: null,
            mode: 'default',
            viewer: false,
            icon: null,

            interval: false,

            time: 'relative',
        }

        const { feat, mission } = this.findCOT();

        if (feat) base.feat = feat;
        if (mission) base.mission = mission;

        return base;
    },
    watch: {
        '$route.params.uid': function() {
            const { feat, mission } = this.findCOT();
            this.feat = feat;
            this.mission = mission;

            this.viewer = false;
        },
        feat: {
            deep: true,
            handler: async function() {
                await this.updateStyle();
                await this.fetchType();
            }
        }
    },
    mounted: async function() {
        if (this.feat) {
            await this.fetchType();
        } else {
            this.interval = setInterval(() => {
                const { feat, mission } = this.findCOT();

                if (feat) {
                    this.feat = feat;
                    if (mission) this.mission = mission;
                    clearInterval(this.interval);
                }
            }, 1000)
        }
    },
    computed: {
        ...mapState(useProfileStore, ['profile']),
        isArchivable: function() {
            return !this.feat.properties.group;
        },
        center: function() {
            if (!this.feat) return [0,0];

            return [
                Math.round(this.feat.properties.center[0] * 1000000) / 1000000,
                Math.round(this.feat.properties.center[1] * 1000000) / 1000000,
            ]
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
        timediff: function(date) {
            if (this.time === 'relative') {
                return timediff(date);
            } else {
                return date;
            }
        },
        findCOT: function() {
            const base = {
                mission: null,
                feat: null
            }

            base.feat = cotStore.get(this.$route.params.uid)

            if (!base.feat) {
                for (const sub of cotStore.subscriptions.keys()) {
                    const store = cotStore.subscriptions.get(sub);
                    if (!store) continue;

                    base.feat = store.cots.get(this.$route.params.uid);
                    if (base.feat) {
                        base.mission = sub;
                        break;
                    }
                }
            }

            return base;
        },
        fetchType: async function() {
            this.type = await std(`/api/type/cot/${this.feat.properties.type}`)
        },
        addAttachment: function(hash) {
            if (!this.feat.properties.attachments) {
                this.feat.properties.attachments = [];
            }

            this.feat.properties.attachments.push(hash)
        },
        updateStyle: async function() {
            if (this.feat.properties.archived) {
                await cotStore.add(this.feat);
            }
        },
        deleteCOT: async function() {
            await cotStore.delete(this.feat.id);
            this.$router.push('/');
        },
        zoomTo: function() {
            if (this.feat.geometry.type === "Point") {
                const flyTo = {
                    speed: Infinity,
                    center: this.feat.properties.center,
                    zoom: 14
                };

                if (mapStore.map.getZoom() < 3) flyTo.zoom = 4;
                mapStore.map.flyTo(flyTo)
            } else {
                mapStore.map.fitBounds(this.feat.bounds(), {
                    maxZoom: 14,
                    padding: {
                        top: 20,
                        bottom: 20,
                        left: 20,
                        right: 20
                    },
                    speed: Infinity,
                })
            }
        }
    },
    components: {
        IconX,
        IconCode,
        IconShare2,
        CoTStyle,
        CoTVideo,
        IconZoomPan,
        Elevation,
        Attachments,
        Speed,
        Phone,
        Course,
        Share,
        Coordinate,
        TablerNone,
        TablerInput,
        TablerMarkdown,
        TablerToggle,
        TablerDelete,
        IconAmbulance,
        IconPlayerPlay,
        IconBattery1,
        IconBattery2,
        IconBattery3,
        IconBattery4
    }
}
</script>
