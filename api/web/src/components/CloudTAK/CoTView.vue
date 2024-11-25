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
                    <Battery
                        v-if='feat.properties.status && feat.properties.status.battery && !isNaN(parseInt(feat.properties.status.battery))'
                        :battery='Number(feat.properties.status.battery)'
                    />
                    <div class='col-auto'>
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
                        <TablerIconButton
                            v-if='feat.properties.video && feat.properties.video.url'
                            title='View Video Stream'
                            @click='videoStore.add(String(route.params.uid))'
                        >
                            <IconPlayerPlay
                                size='32'
                                stroke='1'
                            />
                        </TablerIconButton>
                        <TablerIconButton
                            title='Share'
                            @click='mode === "share" ? mode = "default" : mode = "share"'
                        >
                            <IconShare2
                                :size='32'
                                stroke='1'
                            />
                        </TablerIconButton>
                    </div>
                    <div class='ms-auto btn-list mx-2'>
                        <TablerDelete
                            displaytype='icon'
                            @delete='deleteCOT'
                        />

                        <TablerIconButton
                            title='Zoom To'
                            @click='zoomTo'
                        >
                            <IconZoomPan
                                :size='32'
                                stroke='1'
                            />
                        </TablerIconButton>

                        <TablerIconButton
                            v-if='feat.properties.group'
                            title='Chat'
                            @click='router.push(`/menu/chats/new?callsign=${feat.properties.callsign}&uid=${feat.id}`)'
                        >
                            <IconMessage
                                :size='32'
                                stroke='1'
                            />
                        </TablerIconButton>

                        <TablerDropdown>
                            <TablerIconButton
                                title='Add Properties'
                            >
                                <IconDotsVertical
                                    :size='32'
                                    stroke='1'
                                />
                            </TablerIconButton>

                            <template #dropdown>
                                <div class='px-1 py-1'>
                                    <div
                                        v-if='
                                            feat.properties.attachments !== undefined
                                                && feat.properties.attachments !== undefined
                                                && feat.properties.sensor !== undefined
                                        '
                                    >
                                        No Properties to add
                                    </div>
                                    <template v-else>
                                        <div
                                            v-if='feat.properties.attachments === undefined'
                                            role='button'
                                            class='hover-dark px-2 py-2 d-flex align-items-center'
                                            @click='feat.properties.attachments = []'
                                        >
                                            <IconPaperclip
                                                stroke='1'
                                                :size='32'
                                            /><div class='mx-2'>
                                                Add Attachment
                                            </div>
                                        </div>
                                        <div
                                            v-if='feat.properties.video === undefined'
                                            role='button'
                                            class='hover-dark px-2 py-2 d-flex align-items-center'
                                            @click='feat.properties.video = { url: "" }'
                                        >
                                            <IconMovie
                                                stroke='1'
                                                :size='32'
                                            /><div class='mx-2'>
                                                Add Video
                                            </div>
                                        </div>
                                        <div
                                            v-if='feat.properties.sensor === undefined'
                                            role='button'
                                            class='hover-dark px-2 py-2 d-flex align-items-center'
                                            @click='feat.properties.sensor = {}'
                                        >
                                            <IconCone
                                                stroke='1'
                                                :size='32'
                                            /><div class='mx-2'>
                                                Add Sensor
                                            </div>
                                        </div>
                                    </template>
                                </div>
                            </template>
                        </TablerDropdown>
                    </div>
                </div>
            </div>
        </div>

        <div class='col-12 px-2 py-2'>
            <div
                class='btn-group w-100'
                role='group'
            >
                <input
                    id='btn-mode-info'
                    type='radio'
                    class='btn-check'
                    name='btn-mode'
                    autocomplete='off'
                    :checked='mode === "default"'
                    @click='mode = "default"'
                >
                <label
                    for='btn-mode-info'
                    type='button'
                    class='btn'
                >
                    <IconInfoCircle
                        :size='20'
                        stroke='1'
                        class='cursor-pointer'
                        @click='mode = "raw"'
                    />
                    <span class='mx-2'>Info</span>
                </label>
                <template v-if='feat.properties.group'>
                    <input
                        id='btn-mode-channels'
                        type='radio'
                        class='btn-check'
                        name='btn-mode'
                        autocomplete='off'
                        :checked='mode === "channels"'
                        @click='mode = "channels"'
                    >
                    <label
                        for='btn-mode-channels'
                        type='button'
                        class='btn'
                    >
                        <IconAffiliate
                            :size='20'
                            stroke='1'
                            class='cursor-pointer'
                        />
                        <span class='mx-2'>Channels</span>
                    </label>
                </template>
                <input
                    id='btn-mode-raw'
                    type='radio'
                    class='btn-check'
                    name='btn-mode'
                    autocomplete='off'
                    :checked='mode === "raw"'
                    @click='mode = "raw"'
                >
                <label
                    for='btn-mode-raw'
                    type='button'
                    class='btn'
                >
                    <IconCode
                        :size='20'
                        stroke='1'
                        class='cursor-pointer'
                    />
                    <span class='mx-2'>Raw</span>
                </label>
            </div>
        </div>

        <div
            v-if='mode === "default"'
            class='overflow-auto'
            style='height: calc(100vh - 225px)'
        >
            <div class='row g-0'>
                <div
                    v-if='feat.origin.mode === OriginMode.MISSION'
                    class='col-12'
                >
                    <div class='d-flex align-items-center py-2 px-2 my-2 mx-2 rounded bg-gray-500'>
                        <IconAmbulance
                            :size='32'
                            stroke='1'
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
                    v-if='profile && center.length > 2'
                    class='col-md-4 pt-2'
                >
                    <Elevation
                        :unit='profile.display_elevation'
                        :elevation='feat.properties.center[2]'
                    />
                </div>

                <div
                    v-if='profile && feat.properties.speed !== undefined && !isNaN(feat.properties.speed)'
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
                    v-if='feat.properties.speed !== undefined && !isNaN(feat.properties.speed)'
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
                v-if='!feat.properties.contact && feat.properties.attachments !== undefined'
                :attachments='feat.properties.attachments || []'
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
                                <td>Time</td><td v-text='timediffFormat(feat.properties.time)' />
                            </tr>
                            <tr>
                                <td>Start</td><td v-text='timediffFormat(feat.properties.start)' />
                            </tr>
                            <tr>
                                <td>Stale</td><td v-text='timediffFormat(feat.properties.stale)' />
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
            <TablerToggle
                v-if='isArchivable'
                v-model='feat.properties.archived'
                label='Saved Feature'
                class='mx-2'
            />

            <CoTSensor
                v-if='feat.properties.sensor !== undefined'
                v-model='feat.properties.sensor'
                class='my-2 mx-2'
            />

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
        <template v-else-if='mode === "channels"'>
            <div
                style='height: calc(100vh - 225px)'
                class='overflow-auto'
            >
                <Subscriptions :uid='feat.id' />
            </div>
        </template>
        <template v-else-if='mode === "raw"'>
            <div
                style='height: calc(100vh - 225px)'
                class='overflow-auto'
            >
                <pre v-text='feat' />
            </div>
        </template>
    </template>
</template>

<script setup lang='ts'>
import { ref, computed, watch, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router'
import type { LngLatBoundsLike, FlyToOptions, LngLatLike } from 'maplibre-gl'
import type COT from '../../../src/stores/base/cot.ts';
import type { COTType } from '../../../src/types.ts';
import { useMapStore } from '../../../src/stores/map.ts';
import { OriginMode } from '../../../src/stores/base/cot.ts'
import {
    TablerNone,
    TablerInput,
    TablerToggle,
    TablerDelete,
    TablerMarkdown,
    TablerDropdown,
    TablerIconButton,
} from '@tak-ps/vue-tabler';
import Battery from './util/Battery.vue';
import Share from './util/Share.vue';
import CoTStyle from './util/CoTStyle.vue';
import Coordinate from './util/Coordinate.vue';
import Course from './util/Course.vue';
import CoTSensor from './util/Sensor.vue';
import Phone from './util/Phone.vue';
import Speed from './util/Speed.vue';
import Elevation from './util/Elevation.vue';
import Attachments from './util/Attachments.vue';
import {
    IconMovie,
    IconCone,
    IconMessage,
    IconDotsVertical,
    IconAmbulance,
    IconPlayerPlay,
    IconShare2,
    IconZoomPan,
    IconCode,
    IconAffiliate,
    IconInfoCircle,
    IconPaperclip,
} from '@tabler/icons-vue';
import Subscriptions from './util/Subscriptions.vue';
import timediff from '../../../src/timediff.ts';
import { std } from '../../../src/std.ts';
import { useCOTStore } from '../../../src/stores/cots.ts';
const cotStore = useCOTStore();
import { useProfileStore } from '../../../src/stores/profile.ts';
import { useVideoStore } from '../../../src/stores/videos.ts';

const mapStore = useMapStore();
const profileStore = useProfileStore();
const videoStore = useVideoStore();
const route = useRoute();
const router = useRouter();

const feat = ref<COT | undefined>(cotStore.get(String(route.params.uid), {
    mission: true
}))

const type = ref<COTType | undefined>();
const mode = ref('default');
const interval = ref<ReturnType<typeof setInterval> | undefined>();
const time = ref('relative');

watch(route, () => {
    mode.value = 'default'

    feat.value = cotStore.get(String(route.params.uid), {
        mission: true
    })
});

onMounted(async () => {
    if (feat.value) {
        await fetchType();
    } else {
        interval.value = setInterval(() => {
            feat.value = cotStore.get(String(route.params.uid), {
                mission: true
            })

            if (feat.value) {
                clearInterval(interval.value);
            }
        }, 1000)
    }
});

const profile = profileStore.profile;

const isArchivable = computed(() => {
    if (!feat.value) return false;
    return !feat.value.properties.group;
})

const center = computed(() => {
    if (!feat.value) return [0,0];

    return [
        Math.round(feat.value.properties.center[0] * 1000000) / 1000000,
        Math.round(feat.value.properties.center[1] * 1000000) / 1000000,
    ]
})

const remarks = computed(() => {
    if (!feat.value) return '';

    return (feat.value.properties.remarks || '')
        .replace(/\n/g, '</br>')
        .replace(/(http(s)?:\/\/.*?(\s|$))/g, '[$1]($1) ')
        .trim()
})

function timediffFormat(date: string) {
    if (time.value === 'relative') {
        return timediff(date);
    } else {
        return date;
    }
}

async function fetchType() {
    if (!feat.value) return;
    type.value = await std(`/api/type/cot/${feat.value.properties.type}`) as COTType
}

function addAttachment(hash: string) {
    if (!feat.value) return;

    if (!feat.value.properties.attachments) {
        feat.value.properties.attachments = [];
    }

    feat.value.properties.attachments.push(hash)
}

async function deleteCOT() {
    if (!feat.value) return;
    await cotStore.delete(feat.value.id);
    router.push('/');
}

function zoomTo() {
    if (!feat.value) return;
    if (!mapStore.map) throw new Error('Map not initialized');

    if (feat.value.geometry.type === "Point") {
        const flyTo: FlyToOptions = {
            speed: Infinity,
            center: feat.value.properties.center as LngLatLike,
            zoom: 14
        };

        if (mapStore.map.getZoom() < 3) {
            flyTo.zoom = 4;
        }

        mapStore.map.flyTo(flyTo)
    } else {
        mapStore.map.fitBounds(feat.value.bounds() as LngLatBoundsLike, {
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
</script>
