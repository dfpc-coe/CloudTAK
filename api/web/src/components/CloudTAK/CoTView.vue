<template>
    <TablerNone
        v-if='!cot'
        :create='false'
        label='No CoT Marker'
    />
    <div
        v-else
        class='d-flex flex-column h-100'
        style='min-height: 0;'
    >
        <div
            :key='String(route.params.uid)'
            class='col-12 border-bottom d-flex cloudtak-accent flex-shrink-0'
            style='border-radius: 0px;'
        >
            <div class='col-12 row my-2 d-flex px-1 py-2'>
                <div class='card-title d-flex'>
                    <div class='col-auto ms-2 my-1'>
                        <PropertyBattery
                            v-if='cot && cot.properties.status && cot.properties.status.battery && !isNaN(parseInt(cot.properties.status.battery))'
                            :battery='Number(cot.properties.status.battery)'
                        />
                        <FeatureIcon
                            v-else
                            :key='cot.properties.type'
                            :size='32'
                            :feature='cot'
                        />
                    </div>
                    <div
                        class='col-auto mx-2'
                        :style='`
                            width: calc(100% - 50px);
                        `'
                    >
                        <CopyField
                            :model-value='cot.properties.callsign'
                            :edit='is_editable'
                            :minheight='44'
                            :hover='is_editable'
                            @submit='updateProperty("callsign", $event)'
                        />
                    </div>
                </div>
                <div class='col-12 d-flex align-items-center flex-nowrap gap-0 my-1 px-1'>
                    <div class='btn-list d-flex flex-nowrap align-items-center gap-0 mb-0'>
                        <IconStarFilled
                            v-if='cot.properties.archived'
                            title='Saved Feature'
                            :size='actionIconSize'
                            stroke='1'
                        />
                        <TablerIconButton
                            v-else-if='cot.is_archivable'
                            title='Save Feature'
                            @click='cot.properties.archived = true'
                        >
                            <IconStar
                                :size='actionIconSize'
                                stroke='1'
                            />
                        </TablerIconButton>

                        <TablerIconButton
                            title='Zoom To'
                            @click='cot.flyTo()'
                        >
                            <IconZoomPan
                                :size='actionIconSize'
                                stroke='1'
                            />
                        </TablerIconButton>

                        <TablerIconButton
                            v-if='cot.geometry.type === "Point"'
                            :title='isLocked ? "Unlock" : "Lock On"'
                            @click='toggleLock'
                        >
                            <IconLock
                                v-if='isLocked'
                                :size='actionIconSize'
                                stroke='1'
                            />
                            <IconLockOpen
                                v-else
                                :size='actionIconSize'
                                stroke='1'
                            />
                        </TablerIconButton>


                        <TablerIconButton
                            v-if='cot.properties.video && cot.properties.video.url'
                            title='View Video Stream'
                            @click='floatStore.addCOT(String(route.params.uid))'
                        >
                            <IconPlayerPlay
                                :size='actionIconSize'
                                stroke='1'
                            />
                        </TablerIconButton>
                        <TablerIconButton
                            title='Share'
                            @click='share = true'
                        >
                            <IconShare2
                                :size='actionIconSize'
                                stroke='1'
                            />
                        </TablerIconButton>
                    </div>
                    <div class='ms-auto btn-list d-flex flex-nowrap align-items-center gap-0 mb-0'>
                        <TablerDropdown
                            v-if='cot.geometry.type === "Point"'
                        >
                            <TablerIconButton
                                title='Load Breadcrumb'
                            >
                                <div style='position: relative; display: inline-flex;'>
                                    <IconRoute
                                        :size='actionIconSize'
                                        stroke='1'
                                    />
                                    <span
                                        v-if='breadcrumbLive'
                                        style='
                                            position: absolute;
                                            top: 0;
                                            right: 0;
                                            width: 9px;
                                            height: 9px;
                                            border-radius: 50%;
                                            background: #e74c3c;
                                            border: 2px solid var(--tblr-body-bg, #1a1a2e);
                                        '
                                    />
                                </div>
                            </TablerIconButton>

                            <template #dropdown>
                                <div
                                    class='py-1'
                                    style='min-width: 260px;'
                                >
                                    <Breadcrumb
                                        :uid='cot.id'
                                        @live='breadcrumbLive = $event'
                                    />
                                </div>
                            </template>
                        </TablerDropdown>

                        <TablerIconButton
                            v-if='is_editable'
                            title='Edit'
                            @click='editGeometry'
                        >
                            <IconPencil
                                :size='actionIconSize'
                                stroke='1'
                            />
                        </TablerIconButton>

                        <TablerDropdown
                            v-if='hasGeoJSONTransforms'
                        >
                            <TablerIconButton
                                title='Transforms'
                            >
                                <svg
                                    :width='actionIconSize'
                                    :height='actionIconSize'
                                    viewBox='0 0 24 24'
                                    fill='none'
                                    stroke='currentColor'
                                    stroke-width='1'
                                    stroke-linecap='round'
                                    stroke-linejoin='round'
                                >
                                    <path
                                        stroke='none'
                                        d='M0 0h24v24H0z'
                                        fill='none'
                                    />
                                    <path d='M12 18m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0' />
                                    <path d='M6 6m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0' />
                                    <path d='M18 6m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0' />
                                    <path d='M6 8v2a2 2 0 0 0 2 2h4a2 2 0 0 0 2 -2v-2' />
                                    <path d='M12 12l0 4' />
                                </svg>
                            </TablerIconButton>

                            <template #dropdown>
                                <div
                                    class='py-1'
                                    style='min-width: 220px;'
                                >
                                    <div
                                        role='button'
                                        class='cloudtak-hover px-2 py-2 d-flex align-items-center rounded'
                                        @click='openBufferInput'
                                    >
                                        <IconAdjustments
                                            stroke='1'
                                            :size='32'
                                        /><div class='mx-2'>
                                            Buffer
                                        </div>
                                    </div>
                                </div>
                            </template>
                        </TablerDropdown>

                        <TablerIconButton
                            v-if='cot.properties.group && !cot.is_self'
                            title='Chat'
                            @click='router.push(`/menu/chats/new?callsign=${cot.properties.callsign}&uid=${cot.id}`)'
                        >
                            <IconMessage
                                :size='actionIconSize'
                                stroke='1'
                            />
                        </TablerIconButton>

                        <TablerDelete
                            v-if='is_editable'
                            displaytype='icon'
                            @delete='deleteCOT'
                        />

                        <TablerDropdown
                            v-if='is_editable'
                        >
                            <TablerIconButton
                                title='Add Properties'
                            >
                                <IconDotsVertical
                                    :size='actionIconSize'
                                    stroke='1'
                                />
                            </TablerIconButton>

                            <template #dropdown>
                                <div
                                    class='py-1'
                                    style='min-width: 260px;'
                                >
                                    <div
                                        v-if='
                                            cot.properties.attachments !== undefined
                                                && cot.properties.links !== undefined
                                                && cot.properties.video !== undefined
                                                && cot.properties.sensor !== undefined
                                                && (cot.geometry.type !== "Polygon" || cot.properties.geofence !== undefined)
                                        '
                                        class='px-2 py-2 text-muted'
                                    >
                                        No Properties to add
                                    </div>
                                    <template v-else>
                                        <div
                                            v-if='cot.properties.attachments === undefined'
                                            role='button'
                                            class='cloudtak-hover px-2 py-2 d-flex align-items-center rounded'
                                            @click='updatePropertyAttachment([])'
                                        >
                                            <IconPaperclip
                                                stroke='1'
                                                :size='32'
                                            /><div class='mx-2'>
                                                Add Attachment
                                            </div>
                                        </div>
                                        <div
                                            v-if='cot.properties.links === undefined'
                                            role='button'
                                            class='cloudtak-hover px-2 py-2 d-flex align-items-center rounded'
                                            @click='updateProperty("links", [])'
                                        >
                                            <IconLink
                                                stroke='1'
                                                :size='32'
                                            /><div class='mx-2'>
                                                Add External Links
                                            </div>
                                        </div>
                                        <div
                                            v-if='cot.properties.video === undefined'
                                            role='button'
                                            class='cloudtak-hover px-2 py-2 d-flex align-items-center rounded'
                                            @click='updateProperty("video", { url: "" })'
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
                                            class='cloudtak-hover px-2 py-2 d-flex align-items-center rounded'
                                            @click='updateProperty("sensor", {})'
                                        >
                                            <IconCone
                                                stroke='1'
                                                :size='32'
                                            /><div class='mx-2'>
                                                Add Sensor
                                            </div>
                                        </div>
                                        <div
                                            v-if='cot.properties.geofence === undefined && cot.geometry.type === "Polygon"'
                                            role='button'
                                            class='cloudtak-hover px-2 py-2 d-flex align-items-center rounded'
                                            @click='updateProperty("geofence", { elevationMonitored: false, tracking: false })'
                                        >
                                            <IconFence
                                                stroke='1'
                                                :size='32'
                                            /><div class='mx-2'>
                                                Add Geofence
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
            <TablerPillGroup
                v-model='mode'
                :options='modeOptions'
                :rounded='false'
                size='default'
                name='btn-mode'
                padding=''
            >
                <template #option='{ option }'>
                    <IconInfoCircle
                        v-if='option.value === "default"'
                        :size='20'
                        stroke='1'
                    />
                    <IconAffiliate
                        v-else-if='option.value === "channels"'
                        :size='20'
                        stroke='1'
                    />
                    <IconCode
                        v-else
                        :size='20'
                        stroke='1'
                    />
                    <span class='mx-2'>{{ option.label }}</span>
                </template>
            </TablerPillGroup>
        </div>

        <div
            v-if='mode === "default"'
            class='overflow-auto overflow-x-hidden cot-view-properties flex-grow-1'
            style='min-height: 0;'
        >
            <div class='row g-0'>
                <div
                    v-if='subscription'
                    class='col-12'
                >
                    <div class='d-flex align-items-center py-2 px-2 my-2 mx-2 rounded cloudtak-accent'>
                        <IconAmbulance
                            :size='32'
                            stroke='1'
                        />
                        <span class='ms-2'>From:</span>
                        <a
                            class='mx-2 cursor-pointer'
                            @click='router.push(`/menu/missions/${subscription.meta.guid}`)'
                            v-text='subscription.meta.name'
                        />
                    </div>
                </div>

                <div class='pt-2 col-12 px-2'>
                    <PropertyType
                        v-if='cot.properties.type.startsWith("a-") || cot.properties.type.startsWith("u-")'
                        :key='cot.properties.type'
                        :edit='is_editable'
                        :model-value='cot.properties.type'
                        @update:model-value='updatePropertyType($event)'
                    />
                </div>

                <div
                    class='pt-2'
                    :class='{
                        "col-md-8": center.length > 2,
                        "col-12": center.length <= 2,
                    }'
                >
                    <Coordinate
                        :key='String(route.params.uid)'
                        :label='cot.geometry.type === "Point" ? "Location" : "Center"'
                        :edit='is_editable'
                        :hover='is_editable'
                        :model-value='center'
                        @update:model-value='updateCoordinates($event)'
                    />
                </div>
                <div
                    v-if='center.length > 2'
                    class='col-md-4 pt-2'
                >
                    <PropertyElevation
                        :key='String(route.params.uid)'
                        label='Elevation'
                        :unit='units.display_elevation'
                        :elevation='center[2]'
                    />
                </div>

                <div
                    v-if='cot && cot.geometry.type === "LineString"'
                    class='col-12 pt-2'
                >
                    <LineLength
                        :key='String(route.params.uid)'
                        :cot='cot'
                        :unit='units.display_distance'
                    />
                </div>

                <div
                    v-if='cot && cot.geometry.type === "Polygon"'
                    class='col-12 pt-2'
                >
                    <PolygonArea
                        :key='String(route.params.uid)'
                        :cot='cot'
                    />
                </div>

                <div
                    v-if='cot && cot.properties.shape && cot.properties.shape.ellipse && cot.properties.shape.ellipse.major === cot.properties.shape.ellipse.minor'
                    class='col-12 pt-2'
                >
                    <PropertyDistance
                        :key='cot.properties.id'
                        label='Radius'
                        :unit='units.display_distance'
                        :model-value='cot.properties.shape.ellipse.major * 0.001'
                    />
                </div>

                <div
                    v-if='cot.properties.speed !== undefined && !isNaN(cot.properties.speed)'
                    class='pt-2'
                    :class='{
                        "col-md-6": cot.properties.course,
                        "col-12": !cot.properties.course,
                    }'
                >
                    <PropertySpeed
                        :key='cot.properties.id'
                        :unit='units.display_speed'
                        :speed='cot.properties.speed'
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
                    <PropertyBearing
                        :key='cot.properties.id'
                        label='Course'
                        :model-value='cot.properties.course'
                    />
                </div>

                <div
                    v-if='cot.properties.contact && cot.properties.contact.phone'
                    class='pt-2'
                >
                    <PropertyPhone
                        :key='cot.properties.id'
                        :phone='cot.properties.contact.phone'
                    />
                </div>
            </div>

            <div
                v-if='username'
                class='col-12 pt-2'
            >
                <PropertyEmail
                    :key='cot.properties.id'
                    :email='username'
                />
            </div>



            <div
                v-if='cot.properties.remarks !== undefined'
                class='col-12 pt-2'
            >
                <SlideDownHeader
                    v-model='remarksExpanded'
                    label='Remarks'
                >
                    <template #icon>
                        <IconBlockquote
                            :size='18'
                            stroke='1'
                            color='#6b7990'
                            class='ms-2 me-1'
                        />
                    </template>

                    <div class='px-2 pt-2'>
                        <CopyField
                            :model-value='cot.properties.remarks'
                            :rows='10'
                            :edit='is_editable'
                            :hover='is_editable'
                            @submit='updateProperty("remarks", $event)'
                        />
                    </div>
                </SlideDownHeader>
            </div>

            <PropertyAttachments
                v-if='!cot.properties.contact'
                :key='cot.properties.id'
                :model-value='cot.properties.attachments || []'
                :subscription='subscription'
                @update:model-value='updatePropertyAttachment($event)'
            />

            <PropertyGeofence
                v-if='cot.properties.geofence'
                :geofence='cot.properties.geofence'
            />

            <PropertyLinks
                v-if='cot.properties.links'
                :cot='cot'
                :edit='is_editable'
            />

            <PropertyTimes
                v-if='!cot.properties.archived'
                :cot='cot'
            />

            <PropertySensor
                v-if='cot.properties.sensor !== undefined'
                :key='cot.properties.id'
                :cot='cot'
            />

            <PropertyMilSym
                v-if='cot.properties.milsym'
                :key='cot.properties.id'
                label='Unit Information'
                :model-value='cot.properties.milsym.id'
            />

            <PropertyStyle
                v-if='is_editable && !cot.is_self'
                :cot='cot'
            />

            <PropertyCreator
                v-if='cot.properties.creator'
                :key='cot.properties.id'
                :creator='cot.properties.creator'
            />

            <PropertyMetadata
                v-if='
                    cot.properties.takv
                        && cot.properties.takv
                        && Object.keys(cot.properties.takv).length
                '
                :cot='cot'
            />
        </div>
        <div
            v-else-if='mode === "channels"'
            class='overflow-auto overflow-x-hidden flex-grow-1'
            style='min-height: 0;'
        >
            <Subscriptions :cot='cot' />
        </div>
        <div
            v-else-if='mode === "raw"'
            class='overflow-auto col-12 flex-grow-1'
            style='min-height: 0;'
        >
            <CopyField
                mode='pre'
                style='
                    width: calc(100% - 100px);
                    height: 100%;
                '
                :model-value='JSON.stringify(cot.as_feature(), null, 4)'
            />
        </div>
    </div>

    <Share
        v-if='share && cot'
        :feats='[cot.as_feature()]'
        @done='share = false'
        @close='share = false'
    />

    <BufferInput
        v-if='bufferCotId'
        :cot-id='bufferCotId'
        @close='bufferCotId = null'
    />
</template>

<script setup lang='ts'>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router'
import FeatureIcon from './util/FeatureIcon.vue';
import BufferInput from './Inputs/BufferInput.vue';
import type COT from '../../base/cot.ts';
import type { COTType } from '../../types.ts';
import { OriginMode } from '../../base/cot.ts'
import Subscription from '../../base/subscription.ts'
import {
    TablerNone,
    TablerDelete,
    TablerDropdown,
    TablerIconButton,
    TablerPillGroup,
} from '@tak-ps/vue-tabler';

import CopyField from './util/CopyField.vue';
import Share from './util/Share.vue';
import LineLength from './util/LineLength.vue';
import PolygonArea from './util/PolygonArea.vue';
import Coordinate from './util/Coordinate.vue';
import PropertyType from './util/PropertyType.vue';
import PropertyBattery from './util/PropertyBattery.vue';
import PropertyDistance from './util/PropertyDistance.vue';
import PropertyBearing from './util/PropertyBearing.vue';
import PropertyMilSym from './util/PropertyMilSym.vue';
import PropertySensor from './util/PropertySensor.vue';
import PropertyPhone from './util/PropertyPhone.vue';
import PropertyCreator from './util/PropertyCreator.vue';
import PropertyEmail from './util/PropertyEmail.vue';
import PropertySpeed from './util/PropertySpeed.vue';
import Breadcrumb from './util/Breadcrumb.vue';
import PropertyElevation from './util/PropertyElevation.vue';
import PropertyAttachments from './util/PropertyAttachments.vue';
import PropertyLinks from './util/PropertyLinks.vue';
import PropertyTimes from './util/PropertyTimes.vue';
import PropertyMetadata from './util/PropertyMetadata.vue';
import PropertyStyle from './util/PropertyStyle.vue';
import PropertyGeofence from './util/PropertyGeofence.vue';
import SlideDownHeader from './util/SlideDownHeader.vue';
import {
    IconPencil,
    IconMovie,
    IconRoute,
    IconCone,
    IconStar,
    IconStarFilled,
    IconMessage,
    IconBlockquote,
    IconDotsVertical,
    IconAmbulance,
    IconPlayerPlay,
    IconShare2,
    IconZoomPan,
    IconCode,
    IconAffiliate,
    IconInfoCircle,
    IconLink,
    IconPaperclip,
    IconFence,
    IconAdjustments,
    IconLock,
    IconLockOpen,
} from '@tabler/icons-vue';
import Subscriptions from './util/Subscriptions.vue';
import { server } from '../../std.ts';
import { useMapStore } from '../../stores/map.ts';
import { useFloatStore } from '../../stores/float.ts';
import ProfileConfig from '../../base/profile.ts';

const mapStore = useMapStore();

const floatStore = useFloatStore();
const route = useRoute();
const router = useRouter();

const cot = ref<COT | undefined>(undefined);

const subscription = ref<Subscription | undefined>();

const share = ref(false);
const units = ref({
    display_speed: 'mi/h',
    display_elevation: 'feet',
    display_distance: 'mile'
});

const username = ref<string | undefined>();
const type = ref<COTType | undefined>();
const mode = ref('default');

const modeOptions = computed(() => {
    const opts = [{ value: 'default', label: 'Info' }];
    if (cot.value?.is_skittle) opts.push({ value: 'channels', label: 'Channels' });
    opts.push({ value: 'raw', label: 'Raw' });
    return opts;
});
const breadcrumbLive = ref(false);
const remarksExpanded = ref(true);
const bufferCotId = ref<string | null>(null);
const actionIconSize = 28;

const currentTime = ref(new Date());
const interval = ref<ReturnType<typeof setInterval> | undefined>();

watch(cot, async () => {
    if (cot.value) {
        if (cot.value.origin.mode === OriginMode.MISSION && cot.value.origin.mode_id) {
            subscription.value = await Subscription.from(cot.value.origin.mode_id, localStorage.token);
        } else {
            subscription.value = undefined;
        }
    }
});

watch(route, async () => {
    mode.value = 'default'
    breadcrumbLive.value = false;
    await load_cot();
    if (cot.value) {
        breadcrumbLive.value = await mapStore.worker.db.breadcrumb.get(cot.value.id);
    }
});

onMounted(async () => {
    await load_cot();
    if (cot.value) {
        breadcrumbLive.value = await mapStore.worker.db.breadcrumb.get(cot.value.id);
    }

    const displaySpeed = await ProfileConfig.get('display_speed');
    if (displaySpeed && displaySpeed.value) {
        units.value.display_speed = displaySpeed.value;
    }

    const displayDistance = await ProfileConfig.get('display_distance');
    if (displayDistance && displayDistance.value) {
        units.value.display_distance = displayDistance.value;
    }

    const displayElevation = await ProfileConfig.get('display_elevation');
    if (displayElevation && displayElevation.value) {
        units.value.display_elevation = displayElevation.value;
    }

    interval.value = setInterval(async () => {
        currentTime.value = new Date();

        if (!cot.value) {
            await load_cot();
        }
    }, 1000)
});

onUnmounted(() => {
    if (interval.value) clearInterval(interval.value);
    if (cot.value && cot.value._liveQuerySubscription) {
        cot.value._liveQuerySubscription.unsubscribe();
    }
});

const is_editable = computed(() => {
    if (!cot.value || !cot.value.is_editable) return false;

    if (!subscription.value) {
        return true
    } else {
        return subscription.value.role && subscription.value.role.permissions.includes("MISSION_WRITE");
    }
});

const center = computed(() => {
    if (!cot.value) return [0,0];

    const arr = [
        Math.round(cot.value.properties.center[0] * 1000000) / 1000000,
        Math.round(cot.value.properties.center[1] * 1000000) / 1000000,
    ]

    if (cot.value.properties.center.length > 2) {
        arr.push(Math.round(cot.value.properties.center[2] * 100) / 100)
    }

    return arr;
})

const isLocked = computed(() => {
    if (!cot.value) return false;
    const id = cot.value.properties.id || cot.value.id;
    return mapStore.locked.length > 0 && mapStore.locked[mapStore.locked.length - 1] === id;
});

const hasGeoJSONTransforms = computed(() => {
    return !!cot.value && cot.value.geometry.type !== 'GeometryCollection';
});

function toggleLock() {
    if (!cot.value) return;
    const id = cot.value.properties.id || cot.value.id;

    if (isLocked.value) {
        mapStore.locked = mapStore.locked.filter(l => l !== id);
    } else {
        mapStore.locked.push(id);
    }
}

async function load_cot() {
    username.value = undefined;

    const baseCOT = (await mapStore.worker.db.get(String(route.params.uid), {
        mission: true
    }))

    if (baseCOT && baseCOT.origin.mode === OriginMode.MISSION && baseCOT.origin.mode_id) {
        subscription.value = await Subscription.from(baseCOT.origin.mode_id, localStorage.token);
    }

    if (baseCOT) {
        if (cot.value && cot.value._liveQuerySubscription) {
            cot.value._liveQuerySubscription.unsubscribe();
        }

        cot.value = baseCOT

        cot.value.reactivity();

        if (cot.value.is_skittle) {
            username.value = await cot.value.username()
        } else {
            username.value = undefined;
        }

        await fetchType();
    }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function updateProperty(key: string, event: any) {
    if (!cot.value) return;

    if (typeof event === 'string' || typeof event === 'number') {
        if (cot.value.properties[key] !== event) {
            cot.value.properties[key] = event;
            cot.value.update({})
        }
    } else {
        cot.value.properties[key] = event;
        cot.value.update({})
    }
}

function updatePropertyType(type: string): void {
    if (!cot.value) return;

    if (type.startsWith('a-') && cot.value.properties.type.startsWith('u-')) {
        cot.value.properties["marker-color"] = '#FFFFFF';
    }

    cot.value.properties.type = type;

    if (!cot.value.properties.icon || !cot.value.properties.icon.includes(':')) {
        cot.value.properties.icon = type;
    }

    cot.value.update({});
}

function updateCoordinates(center: number[]): void {
    if (!cot.value) return;

    cot.value.properties.center = center;

    if (cot.value.geometry.type === 'Point') {
        cot.value.geometry.coordinates = center;
    }

    cot.value.update({});
}

async function editGeometry() {
    if (!cot.value) return;
    mapStore.draw.edit(cot.value);
}

function openBufferInput(): void {
    if (!cot.value) return;
    bufferCotId.value = cot.value.properties.id || String(cot.value.id);
}

async function fetchType() {
    if (!cot.value) return;
    const { data, error } = await server.GET('/api/type/cot/{:type}', {
        params: {
            path: {
                ':type': cot.value.properties.type
            }
        }
    });
    if (error) throw new Error(String(error));
    type.value = data;
}

function updatePropertyAttachment(hashes: string[]) {
    if (!cot.value) return;

    if (!cot.value.properties.attachments) {
        cot.value.properties.attachments = [];
    }

    cot.value.properties.attachments = hashes

    cot.value.update({});
}

async function deleteCOT() {
    if (!cot.value) return;
    await mapStore.worker.db.remove(cot.value.id, {
        mission: !!subscription.value
    });
    bufferCotId.value = null;
    router.push('/');
}
</script>

<style scoped>
:global(html[data-bs-theme='dark'] .cot-view-properties .cloudtak-accent) {
    background-color: #192f45 !important;
    border: 1px solid rgba(255, 255, 255, 0.14);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.grid-transition {
    display: grid;
    grid-template-rows: 0fr;
    transition: grid-template-rows 0.3s ease-out;
}

.grid-transition.expanded {
    grid-template-rows: 1fr;
}

.rotate-180 {
    transform: rotate(-90deg);
}

.transition-transform {
    transition: transform 0.3s ease-out;
}
</style>
