<template>
    <TablerNone
        v-if='!cot'
        :create='false'
        label='CoT Marker'
    />
    <template v-else>
        <div
            class='col-12 border-light border-bottom d-flex'
            style='border-radius: 0px;'
        >
            <div class='col-12 card-header row my-2 d-flex'>
                <div class='card-title d-flex'>
                    <div
                        v-if='cot.properties.status && cot.properties.status.battery && !isNaN(parseInt(cot.properties.status.battery))'
                        class='col-auto ms-2 my-1'
                    >
                        <Battery
                            :battery='Number(cot.properties.status.battery)'
                        />
                    </div>

                    <div
                        class='col-auto mx-2'
                        :style='`
                            width: calc(100% - ${hasBattery ? "40px" : "0px"});
                        `'
                    >
                        <CopyField
                            v-model='cot.properties.callsign'
                            :edit='cot.is_editable'
                            :minheight='44'
                            :hover='cot.is_editable'
                        />

                        <div>
                            <span
                                class='subheader'
                                v-text='type ? type.full : cot.properties.type'
                            />
                            <span
                                class='subheader ms-auto'
                                v-text='" (" + (cot.properties.how || "Unknown") + ")"'
                            />
                        </div>
                    </div>
                </div>
                <div class='col-12 d-flex my-2 mx-2'>
                    <div class='btn-list'>
                        <IconStarFilled
                            v-if='cot.properties.archived'
                            title='Saved Feature'
                            :size='32'
                            stroke='1'
                        />
                        <TablerIconButton
                            v-else-if='cot.is_archivable'
                            title='Save Feature'
                            @click='cot.properties.archived = true'
                        >
                            <IconStar
                                :size='32'
                                stroke='1'
                            />
                        </TablerIconButton>

                        <TablerIconButton
                            v-if='cot.properties.video && cot.properties.video.url'
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
                        <TablerDropdown
                            v-if='cot.is_skittle'
                        >
                            <TablerIconButton
                                title='Load Breadcrumb'
                            >
                                <IconRoute
                                    size='32'
                                    stroke='1'
                                />
                            </TablerIconButton>

                            <template #dropdown>
                                <Breadcrumb :uid='cot.id' />
                            </template>
                        </TablerDropdown>

                        <TablerDelete
                            v-if='!cot.is_self'
                            displaytype='icon'
                            @delete='deleteCOT'
                        />

                        <TablerIconButton
                            title='Zoom To'
                            @click='cot.flyTo()'
                        >
                            <IconZoomPan
                                :size='32'
                                stroke='1'
                            />
                        </TablerIconButton>

                        <TablerIconButton
                            v-if='cot.properties.group && !cot.is_self'
                            title='Chat'
                            @click='router.push(`/menu/chats/new?callsign=${cot.properties.callsign}&uid=${cot.id}`)'
                        >
                            <IconMessage
                                :size='32'
                                stroke='1'
                            />
                        </TablerIconButton>

                        <TablerDropdown
                            v-if='cot.is_editable && !cot.is_self'
                        >
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
                                            cot.properties.attachments !== undefined
                                                && cot.properties.attachments !== undefined
                                                && cot.properties.sensor !== undefined
                                        '
                                    >
                                        No Properties to add
                                    </div>
                                    <template v-else>
                                        <div
                                            v-if='cot.properties.attachments === undefined'
                                            role='button'
                                            class='hover-dark px-2 py-2 d-flex align-items-center'
                                            @click='cot.properties.attachments = []'
                                        >
                                            <IconPaperclip
                                                stroke='1'
                                                :size='32'
                                            /><div class='mx-2'>
                                                Add Attachment
                                            </div>
                                        </div>
                                        <div
                                            v-if='cot.properties.video === undefined'
                                            role='button'
                                            class='hover-dark px-2 py-2 d-flex align-items-center'
                                            @click='cot.properties.video = { url: "" }'
                                        >
                                            <IconMovie
                                                stroke='1'
                                                :size='32'
                                            /><div class='mx-2'>
                                                Add Video
                                            </div>
                                        </div>
                                        <div
                                            v-if='cot.properties.sensor === undefined'
                                            role='button'
                                            class='hover-dark px-2 py-2 d-flex align-items-center'
                                            @click='cot.properties.sensor = {}'
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
                <template v-if='cot.is_skittle'>
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
                    v-if='mission'
                    class='col-12'
                >
                    <div class='d-flex align-items-center py-2 px-2 my-2 mx-2 rounded bg-gray-500'>
                        <IconAmbulance
                            :size='32'
                            stroke='1'
                        />
                        <span class='ms-2'>From:</span>
                        <a
                            class='mx-2 cursor-pointer'
                            @click='router.push(`/menu/missions/${mission.meta.guid}`)'
                            v-text='mission.meta.name'
                        />
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
                        :edit='cot.is_editable'
                        :hover='cot.is_editable'
                        :model-value='center'
                        @update:model-value='updateCenter($event)'
                    />
                </div>
                <div
                    v-if='profile && center.length > 2'
                    class='col-md-4 pt-2'
                >
                    <Elevation
                        :unit='profile.display_elevation'
                        :elevation='cot.properties.center[2]'
                    />
                </div>

                <div
                    v-if='cot && cot.geometry.type === "Polygon"'
                    class='col-12 pt-2'
                >
                    <PolygonArea :cot='cot' />
                </div>

                <div
                    v-if='profile && cot.properties.speed !== undefined && !isNaN(cot.properties.speed)'
                    class='pt-2'
                    :class='{
                        "col-md-6": cot.properties.course,
                        "col-12": !cot.properties.course,
                    }'
                >
                    <Speed
                        :unit='profile.display_speed'
                        :speed='cot.properties.speed'
                        class='py-2'
                    />
                </div>

                <div
                    v-if='cot.properties.course !== undefined && !isNaN(cot.properties.course)'
                    class='pt-2'
                    :class='{
                        "col-md-6": cot.properties.course,
                        "col-12": !cot.properties.course,
                    }'
                >
                    <Course
                        :course='cot.properties.course'
                        class='py-2'
                    />
                </div>

                <div
                    v-if='cot.properties.contact && cot.properties.contact.phone'
                    class='pt-2'
                >
                    <Phone
                        :phone='cot.properties.contact.phone'
                    />
                </div>
            </div>

            <div
                v-if='username'
                class='col-12 pt-2'
            >
                <Email
                    :email='username'
                />
            </div>

            <Attachments
                v-if='!cot.properties.contact && cot.properties.attachments !== undefined'
                :attachments='cot.properties.attachments || []'
                @attachment='addAttachment($event)'
            />

            <div
                v-if='cot.properties.remarks !== undefined'
                class='col-12 py-2'
            >
                <label class='subheader mx-2'>Remarks</label>
                <CopyField
                    v-model='cot.properties.remarks'
                    :rows='10'
                    :edit='cot.is_editable'
                    :hover='cot.is_editable'
                    class='mx-1'
                />
            </div>

            <div
                v-if='cot.properties.links'
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
                                v-for='(link, link_it) of cot.properties.links'
                                :key='link_it'
                            >
                                <td v-text='link.remarks' />
                                <td>
                                    <a
                                        :href='link.url'
                                        target='_blank'
                                        v-text='link.url'
                                    />
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>


            <div
                v-if='!cot.properties.archived'
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
                                <td>Time</td><td v-text='timediffFormat(cot.properties.time)' />
                            </tr>
                            <tr>
                                <td>Start</td><td v-text='timediffFormat(cot.properties.start)' />
                            </tr>
                            <tr>
                                <td>Stale</td><td v-text='timediffFormat(cot.properties.stale)' />
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <CoTSensor
                v-if='cot.properties.sensor !== undefined'
                v-model='cot.properties.sensor'
                class='my-2 mx-2'
            />

            <div
                v-if='cot.is_editable && !cot.is_self'
                class='px-1 pb-2 col-12'
            >
                <label class='mx-1 subheader'>COT Style</label>
                <div class='mx-2 py-3'>
                    <div class='row g-2 rounded px-2 bg-gray-500 pb-2'>
                        <template v-if='cot.geometry.type === "Point"'>
                            <div class='col-12'>
                                <IconSelect
                                    v-model='cot.properties.icon'
                                    label='Point Icon'
                                    :size='32'
                                    stroke='1'
                                />
                            </div>
                            <div class='col-12'>
                                <label class='subheader'>Point Colour</label>
                                <TablerInput
                                    v-model='cot.properties["marker-color"]'
                                    label=''
                                    default='#00FF00'
                                    type='color'
                                    class='pb-2'
                                />
                            </div>
                            <div class='col-12'>
                                <label class='subheader'>Point Opacity</label>
                                <TablerRange
                                    v-model='cot.properties["marker-opacity"]'
                                    label=''
                                    :default='1'
                                    :min='0'
                                    :max='1'
                                    :step='0.01'
                                />
                            </div>
                        </template>
                        <template v-else>
                            <div class='col-12'>
                                <label class='subheader'>Line Colour</label>
                                <TablerInput
                                    v-model='cot.properties.stroke'
                                    label=''
                                    type='color'
                                />
                            </div>

                            <div class='col-12'>
                                <label class='subheader'>Line Style</label>
                                <TablerEnum
                                    v-model='cot.properties["stroke-style"]'
                                    label=''
                                    :options='["solid", "dashed", "dotted", "outlined"]'
                                    default='solid'
                                />
                            </div>
                            <div class='col-12'>
                                <label class='subheader'>Line Thickness</label>
                                <TablerRange
                                    v-model='cot.properties["stroke-width"]'
                                    label=''
                                    :default='1'
                                    :min='1'
                                    :max='6'
                                    :step='1'
                                />
                            </div>
                            <div class='col-12'>
                                <label class='subheader'>Line Opacity</label>
                                <TablerRange
                                    v-model='cot.properties["stroke-opacity"]'
                                    label=''
                                    :default='1'
                                    :min='0'
                                    :max='1'
                                    :step='0.01'
                                />
                            </div>
                        </template>
                        <template v-if='cot.geometry.type === "Polygon"'>
                            <div class='col-12'>
                                <label class='subheader'>Fill Colour</label>
                                <TablerInput
                                    v-model='cot.properties.fill'
                                    label=''
                                    type='color'
                                />
                            </div>
                            <div class='col-12 round'>
                                <label class='subheader'>Fill Opacity</label>
                                <TablerRange
                                    v-model='cot.properties["fill-opacity"]'
                                    label=''
                                    :default='1'
                                    :min='0'
                                    :max='1'
                                    :step='0.01'
                                />
                            </div>
                        </template>
                    </div>
                </div>
            </div>

            <div
                v-if='
                    cot.properties.takv
                    && cot.properties.takv
                    && Object.keys(cot.properties.takv).length
                '
                class='col-12 px-1 pb-2'
            >
                <div class='col-12 d-flex align-items-center'>
                    <TablerIconButton
                        v-if='!chevrons.has("metadata")'
                        title='Open Metadata'
                        @click='chevrons.add("metadata")'
                    >
                        <IconChevronRight :size='24' stroke='1' />
                    </TablerIconbutton>

                    <TablerIconButton
                        v-else
                        title='Close Metadata'
                        @click='chevrons.delete("metadata")'
                    >
                        <IconChevronDown :size='24' stroke='1' />
                    </TablerIconbutton>
                    <label class='subheader'>Metadata</label>
                </div>
                <div v-if='chevrons.has("metadata")' class='table-responsive rounded mx-2 py-2 px-2'>
                    <table class='table card-table table-hover table-vcenter datatable'>
                        <thead>
                            <tr>
                                <th>Key</th>
                                <th>Value</th>
                            </tr>
                        </thead>
                        <tbody class='bg-gray-500'>
                            <tr
                                v-for='prop of Object.keys(cot.properties.takv)'
                                :key='prop'
                            >
                                <td v-text='prop' />
                                <!-- @vue-expect-error Not a KeyOf -->
                                <td v-text='cot.properties.takv[prop]' />
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
                    :feats='[cot]'
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
                <Subscriptions :cot='cot' />
            </div>
        </template>
        <template v-else-if='mode === "raw"'>
            <div
                style='height: calc(100vh - 225px)'
                class='overflow-auto'
            >
                <CopyField
                    mode='pre'
                    style='height: calc(100vh - 225px)'
                    :model-value='JSON.stringify(cot.as_feature(), null, 4)'
                />
            </div>
        </template>
    </template>
</template>

<script setup lang='ts'>
import { ref, computed, watch, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router'
import type COT from '../../base/cot.ts';
import type { COTType } from '../../types.ts';
import { OriginMode } from '../../base/cot.ts'
import Mission from '../../base/mission.ts'
import {
    TablerNone,
    TablerInput,
    TablerDelete,
    TablerEnum,
    TablerRange,
    TablerDropdown,
    TablerIconButton,
} from '@tak-ps/vue-tabler';

import CopyField from './util/CopyField.vue';
import IconSelect from '../util/IconSelect.vue';
import Battery from './util/Battery.vue';
import Share from './util/Share.vue';
import PolygonArea from './util/PolygonArea.vue';
import Coordinate from './util/Coordinate.vue';
import Course from './util/Course.vue';
import CoTSensor from './util/Sensor.vue';
import Phone from './util/Phone.vue';
import Email from './util/Email.vue';
import Speed from './util/Speed.vue';
import Breadcrumb from './util/Breadcrumb.vue';
import Elevation from './util/Elevation.vue';
import Attachments from './util/Attachments.vue';
import {
    IconMovie,
    IconRoute,
    IconCone,
    IconStar,
    IconStarFilled,
    IconMessage,
    IconDotsVertical,
    IconChevronRight,
    IconChevronDown,
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
import timediff from '../../timediff.ts';
import { std } from '../../std.ts';
import { useProfileStore } from '../../stores/profile.ts';
import { useMapStore } from '../../stores/map.ts';
import { useVideoStore } from '../../stores/videos.ts';

const mapStore = useMapStore();

const profileStore = useProfileStore();
const videoStore = useVideoStore();
const route = useRoute();
const router = useRouter();

const cot = ref<COT | undefined>(undefined);

const mission = ref<Mission | undefined>();

const chevrons = ref<Set<string>>(new Set());
const username = ref<string | undefined>();
const type = ref<COTType | undefined>();
const mode = ref('default');
const interval = ref<ReturnType<typeof setInterval> | undefined>();
const time = ref('relative');

watch(cot, async () => {
    if (cot.value) {
        if (cot.value.origin.mode === OriginMode.MISSION && cot.value.origin.mode_id) {
            mission.value = await mapStore.worker.db.subscriptionGet(cot.value.origin.mode_id);
        } else {
            mission.value = undefined;
        }
    }
});

watch(route, async () => {
    mode.value = 'default'
    await load_cot();
});

onMounted(async () => {
    await load_cot();

    if (!cot.value) {
        interval.value = setInterval(async () => {
            await load_cot();

            if (cot.value) {
                clearInterval(interval.value);
            }
        }, 1000)
    }
});

const profile = profileStore.profile;

const hasBattery = computed(() => {
    return cot.value && cot.value.properties.status && cot.value.properties.status.battery && !isNaN(parseInt(cot.value.properties.status.battery))
})

const center = computed(() => {
    if (!cot.value) return [0,0];

    return [
        Math.round(cot.value.properties.center[0] * 1000000) / 1000000,
        Math.round(cot.value.properties.center[1] * 1000000) / 1000000,
    ]
})

async function load_cot() {
    username.value = undefined;

    const baseCOT = (await mapStore.worker.db.get(String(route.params.uid), {
        mission: true
    }))

    if (baseCOT && baseCOT.origin.mode === OriginMode.MISSION && baseCOT.origin.mode_id) {
        mission.value = await mapStore.worker.db.subscriptionGet(baseCOT.origin.mode_id);
    }

    if (baseCOT) {
        cot.value = baseCOT.as_proxy();

        if (cot.value.is_skittle) {
            username.value = await cot.value.username()
        } else {
            username.value = undefined;
        }

        await fetchType();
    }
}

function timediffFormat(date: string) {
    if (time.value === 'relative') {
        return timediff(date);
    } else {
        return date;
    }
}

function updateCenter(center: number[]) {
    if (!cot.value) return;

    cot.value.properties.center = center;

    if (cot.value.geometry.type === 'Point') {
        cot.value.geometry.coordinates = center;
    }
}

async function fetchType() {
    if (!cot.value) return;
    type.value = await std(`/api/type/cot/${cot.value.properties.type}`) as COTType
}

function addAttachment(hash: string) {
    if (!cot.value) return;

    if (!cot.value.properties.attachments) {
        cot.value.properties.attachments = [];
    }

    cot.value.properties.attachments.push(hash)
}

async function deleteCOT() {
    if (!cot.value) return;
    await mapStore.worker.db.remove(cot.value.id);
    router.push('/');
}
</script>
