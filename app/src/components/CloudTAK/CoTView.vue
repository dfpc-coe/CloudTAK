<template>
    <MenuTemplate :scroll='false'>
        <template
            v-if='cot'
            #header
        >
            <div class='flex-shrink-0'>
                <FeatureIcon
                    :key='cot.properties.type'
                    :size='32'
                    :feature='cot'
                />
            </div>
            <div
                class='flex-grow-1 mx-2'
                style='min-width: 0'
            >
                <CopyField
                    :model-value='cot.properties.callsign'
                    :edit='is_editable'
                    :minheight='44'
                    :hover='is_editable'
                    @submit='updateProperty("callsign", $event)'
                />
            </div>
        </template>

        <TablerNone
            v-if='!cot'
            :create='false'
            label='No CoT Marker'
        />
        <div
            v-else
            :key='String(route.params.uid)'
            class='d-flex flex-column h-100'
            style='min-height: 0;'
        >
            <div
                v-if='offlineEntity'
                class='col-12 flex-shrink-0 px-2 pt-2'
            >
                <TablerInlineAlert
                    severity='warning'
                    :title='`${entityLabel(offlineEntity)} Details Unavailable`'
                    :description='`This marker is a CloudTAK ${entityLabel(offlineEntity)} - the ${entityLabel(offlineEntity)} it was generated from could not be loaded from the server.`'
                />
                <TablerButton
                    class='w-100'
                    :disabled='retrying'
                    @click='retryEntity'
                >
                    Retry
                </TablerButton>
            </div>

            <div class='cot-actions d-flex align-items-center flex-nowrap px-2 py-1 border-bottom cloudtak-header flex-shrink-0'>
                <IconStarFilled
                    v-if='cot.properties.archived'
                    title='Saved Feature'
                    :size='actionIconSize'
                    stroke='1'
                    class='text-yellow'
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
                    v-if='cot.is_route || cot.geometry.type === "Point"'
                    :title='isNavigating ? "End Navigation" : "Navigate"'
                    @click='toggleNavigation'
                >
                    <IconNavigationFilled
                        v-if='isNavigating'
                        :size='actionIconSize'
                        stroke='1'
                        class='text-blue'
                    />
                    <IconNavigation
                        v-else
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

                <div class='ms-auto d-flex align-items-center flex-nowrap'>
                    <TablerDropdown
                        v-if='cot.geometry.type === "Point"'
                        :width='260'
                    >
                        <TablerIconButton title='Breadcrumb'>
                            <div class='position-relative d-flex'>
                                <IconRoute
                                    :size='actionIconSize'
                                    stroke='1'
                                />
                                <span
                                    v-if='breadcrumbLive'
                                    class='breadcrumb-live'
                                />
                            </div>
                        </TablerIconButton>

                        <template #dropdown>
                            <div
                                class='py-1'
                                @click.stop
                            >
                                <Breadcrumb
                                    :uid='cot.id'
                                    @live='breadcrumbLive = $event'
                                />
                            </div>
                        </template>
                    </TablerDropdown>

                    <TablerDelete
                        v-if='is_editable'
                        displaytype='icon'
                        :size='actionIconSize'
                        @delete='deleteCOT'
                    />

                    <TablerDropdown
                        v-if='hasMoreActions'
                        :width='240'
                    >
                        <TablerIconButton title='More Actions'>
                            <IconDotsVertical
                                :size='actionIconSize'
                                stroke='1'
                            />
                        </TablerIconButton>

                        <template #dropdown>
                            <MenuDropdownItem
                                v-if='is_editable'
                                label='Edit Geometry'
                                @click='editGeometry'
                            >
                                <template #icon>
                                    <IconPencil
                                        :size='18'
                                        stroke='1.5'
                                    />
                                </template>
                            </MenuDropdownItem>

                            <MenuDropdownItem
                                v-if='canChat'
                                label='Chat'
                                @click='router.push(`/menu/chats/new?callsign=${cot.properties.callsign}&uid=${cot.id}`)'
                            >
                                <template #icon>
                                    <IconMessage
                                        :size='18'
                                        stroke='1.5'
                                    />
                                </template>
                            </MenuDropdownItem>

                            <MenuDropdownItem
                                v-if='hasGeoJSONTransforms'
                                label='Buffer'
                                @click='openBufferInput'
                            >
                                <template #icon>
                                    <IconAdjustments
                                        :size='18'
                                        stroke='1.5'
                                    />
                                </template>
                            </MenuDropdownItem>

                            <MenuDropdownItem
                                v-if='cot.geometry.type === "LineString" && !cot.is_route'
                                label='Convert to Route'
                                @click='cot.toRoute()'
                            >
                                <template #icon>
                                    <IconRoute
                                        :size='18'
                                        stroke='1.5'
                                    />
                                </template>
                            </MenuDropdownItem>

                            <template v-if='is_editable && canAddProperty'>
                                <li><hr class='dropdown-divider'></li>

                                <MenuDropdownItem
                                    v-if='addable.attachments'
                                    label='Add Attachment'
                                    @click='updatePropertyAttachment([])'
                                >
                                    <template #icon>
                                        <IconPaperclip
                                            :size='18'
                                            stroke='1.5'
                                        />
                                    </template>
                                </MenuDropdownItem>

                                <MenuDropdownItem
                                    v-if='addable.links'
                                    label='Add External Links'
                                    @click='updateProperty("links", [])'
                                >
                                    <template #icon>
                                        <IconLink
                                            :size='18'
                                            stroke='1.5'
                                        />
                                    </template>
                                </MenuDropdownItem>

                                <MenuDropdownItem
                                    v-if='addable.video'
                                    label='Add Video'
                                    @click='updateProperty("video", { url: "" })'
                                >
                                    <template #icon>
                                        <IconMovie
                                            :size='18'
                                            stroke='1.5'
                                        />
                                    </template>
                                </MenuDropdownItem>

                                <MenuDropdownItem
                                    v-if='addable.sensor'
                                    label='Add Sensor'
                                    @click='updateProperty("sensor", {})'
                                >
                                    <template #icon>
                                        <IconCone
                                            :size='18'
                                            stroke='1.5'
                                        />
                                    </template>
                                </MenuDropdownItem>

                                <MenuDropdownItem
                                    v-if='addable.geofence'
                                    label='Add Geofence'
                                    @click='updateProperty("geofence", { elevationMonitored: false, tracking: false })'
                                >
                                    <template #icon>
                                        <IconFence
                                            :size='18'
                                            stroke='1.5'
                                        />
                                    </template>
                                </MenuDropdownItem>
                            </template>
                        </template>
                    </TablerDropdown>
                </div>
            </div>

            <div
                class='overflow-auto overflow-x-hidden flex-grow-1'
                style='min-height: 0;'
            >
                <PropertyOrigin
                    v-if='subscription'
                    :key='cot.id'
                    :subscription='subscription'
                    :uid='cot.id'
                />

                <div class='pt-1'>
                    <div
                        v-if='cot.properties.type.startsWith("a-") || cot.properties.type.startsWith("u-") || isSIDCType(cot.properties.type)'
                        class='px-2 py-2'
                    >
                        <!-- Not keyed on the type - a remount would collapse the
                             type selector every time a new type is picked -->
                        <PropertyType
                            :key='cot.properties.id'
                            :edit='is_editable'
                            :model-value='cot.properties.type'
                            @update:model-value='updatePropertyType($event)'
                        />
                    </div>

                    <div
                        v-for='guid of missionLinks'
                        :key='guid'
                        class='px-2 pb-2'
                    >
                        <PropertyMission :guid='guid' />
                    </div>

                    <Coordinate
                        :key='String(route.params.uid)'
                        :label='cot.geometry.type === "Point" ? "Location" : "Center"'
                        :edit='is_editable'
                        :hover='is_editable'
                        :model-value='center'
                        @update:model-value='updateCoordinates($event)'
                    />

                    <PropertyElevation
                        v-if='center.length > 2'
                        :key='String(route.params.uid)'
                        label='Elevation'
                        :unit='units.display_elevation'
                        :elevation='center[2]'
                    />

                    <LineLength
                        v-if='cot.geometry.type === "LineString"'
                        :key='String(route.params.uid)'
                        :geometry='cot.geometry'
                        :unit='units.display_distance'
                    />

                    <PolygonArea
                        v-if='cot.geometry.type === "Polygon"'
                        :key='String(route.params.uid)'
                        :geometry='cot.geometry'
                        :unit='units.display_area'
                    />

                    <PropertyDistance
                        v-if='cot.properties.shape && cot.properties.shape.ellipse && cot.properties.shape.ellipse.major === cot.properties.shape.ellipse.minor'
                        :key='cot.properties.id'
                        label='Radius'
                        :unit='units.display_distance'
                        :edit='is_editable'
                        :hover='is_editable'
                        :model-value='cot.properties.shape.ellipse.major * 0.001'
                        @submit='updateRadius($event)'
                    />

                    <!-- Speed & Course share one row when both are reported -->
                    <PropertyFactRow
                        v-if='hasSpeed && hasCourse'
                        label='Speed'
                        class='py-1'
                    >
                        <div class='row g-2'>
                            <div class='col-6'>
                                <PropertySpeed
                                    :key='cot.properties.id'
                                    :inline='true'
                                    :unit='units.display_speed'
                                    :speed='Number(cot.properties.speed)'
                                />
                            </div>
                            <div class='col-6'>
                                <PropertyBearing
                                    :key='cot.properties.id'
                                    :inline='true'
                                    label='Course'
                                    :model-value='Number(cot.properties.course)'
                                />
                            </div>
                        </div>
                    </PropertyFactRow>

                    <PropertySpeed
                        v-else-if='hasSpeed'
                        :key='cot.properties.id'
                        :unit='units.display_speed'
                        :speed='Number(cot.properties.speed)'
                    />

                    <PropertyBearing
                        v-else-if='hasCourse'
                        :key='cot.properties.id'
                        label='Course'
                        :model-value='Number(cot.properties.course)'
                    />

                    <PropertyPhone
                        v-if='cot.properties.contact && cot.properties.contact.phone'
                        :key='cot.properties.id'
                        :phone='cot.properties.contact.phone'
                    />

                    <PropertyEmail
                        v-if='username'
                        :key='cot.properties.id'
                        :email='username'
                    />

                    <PropertyFactRow
                        v-if='battery !== undefined'
                        label='Battery'
                        class='py-1'
                    >
                        <div class='d-flex align-items-center gap-1'>
                            <PropertyBattery
                                :battery='battery'
                                :size='18'
                            />
                            <span v-text='`${battery}%`' />
                        </div>
                    </PropertyFactRow>

                    <PropertyCreator
                        v-if='cot.creator'
                        :key='cot.properties.id'
                        :creator='cot.creator'
                    />
                </div>

                <PropertyProfile
                    v-if='lineGeometry && terrainBasemapId'
                    :key='`${route.params.uid}-${terrainBasemapId}`'
                    :geometry='lineGeometry'
                    :terrain-basemap-id='terrainBasemapId'
                    :distance-unit='units.display_distance'
                    :elevation-unit='units.display_elevation'
                />

                <PropertyRemarks
                    v-if='cot.properties.remarks !== undefined'
                    :model-value='cot.properties.remarks'
                    :edit='is_editable'
                    @submit='updateProperty("remarks", $event)'
                />

                <PropertyTabs
                    v-model='mode'
                    :tabs='modeOptions'
                    class='mt-2'
                />

                <div v-if='mode === "default"'>
                    <PropertyAttachments
                        v-if='!cot.properties.contact'
                        :key='cot.properties.id'
                        :model-value='cot.properties.attachments || []'
                        :subscription='subscription'
                        :edit='!cot.is_machine_generated'
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

                    <PropertyVideo
                        v-if='cot.properties.video !== undefined'
                        :key='cot.properties.id'
                        :cot='cot'
                    />

                    <PropertySensor
                        v-if='cot.properties.sensor !== undefined'
                        :key='cot.properties.id'
                        :cot='cot'
                    />

                    <PropertyRadSensor
                        v-if='cot.properties.radsensordetail'
                        :radsensordetail='cot.properties.radsensordetail'
                    />

                    <PropertyChemSensor
                        v-if='cot.properties.chemsensordetail'
                        :chemsensordetail='cot.properties.chemsensordetail'
                    />

                    <PropertyBioSensor
                        v-if='cot.properties.biosensordetail'
                        :biosensordetail='cot.properties.biosensordetail'
                    />

                    <PropertyMetadata
                        v-if='cot.properties.takv && Object.keys(cot.properties.takv).length'
                        :cot='cot'
                    />
                </div>
                <div v-else-if='mode === "style"'>
                    <PropertyStyle
                        :geometry='cot.geometry.type'
                        :model-value='cot.properties'
                        @update:model-value='updateStyle($event)'
                    />
                </div>
                <div v-else-if='mode === "channels"'>
                    <Subscriptions :cot='cot' />
                </div>
                <div
                    v-else-if='mode === "debug"'
                    class='px-2 py-2'
                >
                    <CopyField
                        mode='pre'
                        :model-value='JSON.stringify(cot.as_feature(), null, 4)'
                    />
                </div>
            </div>

            <PropertyTimes
                v-if='!cot.properties.archived'
                :cot='cot'
            />
        </div>
    </MenuTemplate>

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
import MenuTemplate from './util/MenuTemplate.vue';
import type COT from '../../base/cot.ts';
import type { DBTaxonomy } from '../../database.ts';
import type { Feature } from '../../types.ts';
import { OriginMode } from '../../base/cot.ts'
import Subscription from '../../base/subscription.ts'
import {
    TablerNone,
    TablerButton,
    TablerDelete,
    TablerDropdown,
    TablerIconButton,
    TablerInlineAlert,
} from '@tak-ps/vue-tabler';

import CopyField from './util/CopyField.vue';
import Share from './util/Share.vue';
import LineLength from './util/LineLength.vue';
import PolygonArea from './util/PolygonArea.vue';
import Coordinate from './util/Coordinate.vue';
import PropertyProfile from './Property/PropertyProfile.vue';
import PropertyType from './Property/PropertyType.vue';
import PropertyMission from './Property/PropertyMission.vue';
import PropertyOrigin from './Property/PropertyOrigin.vue';
import PropertyRemarks from './Property/PropertyRemarks.vue';
import PropertyBattery from './Property/PropertyBattery.vue';
import PropertyFactRow from './util/PropertyFactRow.vue';
import PropertyTabs, { type PropertyTab } from './util/PropertyTabs.vue';
import MenuDropdownItem from './util/MenuDropdownItem.vue';
import Type2525 from '@tak-ps/node-cot/2525';

function isSIDCType(type: string): boolean {
    return Type2525.isNumericSIDCConvertable(type);
}
import PropertyDistance from './Property/PropertyDistance.vue';
import PropertyBearing from './Property/PropertyBearing.vue';
import PropertySensor from './Property/PropertySensor.vue';
import PropertyPhone from './Property/PropertyPhone.vue';
import PropertyCreator from './Property/PropertyCreator.vue';
import PropertyEmail from './Property/PropertyEmail.vue';
import PropertySpeed from './Property/PropertySpeed.vue';
import Breadcrumb from './util/Breadcrumb.vue';
import PropertyElevation from './Property/PropertyElevation.vue';
import PropertyAttachments from './Property/PropertyAttachments.vue';
import PropertyLinks from './Property/PropertyLinks.vue';
import PropertyVideo from './Property/PropertyVideo.vue';
import PropertyTimes from './Property/PropertyTimes.vue';
import PropertyMetadata from './Property/PropertyMetadata.vue';
import PropertyStyle from './Property/PropertyStyle.vue';
import PropertyGeofence from './Property/PropertyGeofence.vue';
import PropertyRadSensor from './Property/PropertyRadSensor.vue';
import PropertyChemSensor from './Property/PropertyChemSensor.vue';
import PropertyBioSensor from './Property/PropertyBioSensor.vue';
import {
    IconPencil,
    IconMovie,
    IconRoute,
    IconCone,
    IconStar,
    IconStarFilled,
    IconMessage,
    IconDotsVertical,
    IconPlayerPlay,
    IconShare2,
    IconZoomPan,
    IconLink,
    IconPaperclip,
    IconFence,
    IconAdjustments,
    IconLock,
    IconLockOpen,
    IconNavigation,
    IconNavigationFilled,
} from '@tabler/icons-vue';
import Subscriptions from './util/Subscriptions.vue';
import { server } from '../../std.ts';
import { useMapStore } from '../../stores/map.ts';
import { useFloatStore } from '../../stores/float.ts';
import { useDeviceStore } from '../../stores/device.ts';
import ProfileConfig from '../../base/profile.ts';
import OverlayManager from '../../base/overlay.ts';
import { entityLink, entityLabel, entityRoute, entityRouteName } from '../../utils/core-entity.ts';
import type { CoreEntityRef } from '../../utils/core-entity.ts';
import { setCircleRadius } from '../../base/cot/ellipse.ts';

const mapStore = useMapStore();

const floatStore = useFloatStore();

const deviceStore = useDeviceStore();

const terrainBasemapId = computed<number | null>(() => {
    const terrain = OverlayManager.loaded.find((overlay) => overlay.type === 'raster-dem' && overlay.mode_id);
    return terrain ? Number(terrain.mode_id) : null;
});
const route = useRoute();
const router = useRouter();

const cot = ref<COT | undefined>(undefined);

function updateStyle(properties: Record<string, unknown>): void {
    if (!cot.value) return;
    cot.value.update({ properties: properties as Feature['properties'] });
}

const subscription = ref<Subscription | undefined>();

const share = ref(false);
const units = ref({
    display_speed: 'mi/h',
    display_elevation: 'feet',
    display_distance: 'mile',
    display_area: 'acre'
});

const username = ref<string | undefined>();
const type = ref<DBTaxonomy | undefined>();
const mode = ref('default');

// PropertyStyle has no read-only mode so the tab only exists for editors
const hasStyle = computed(() => is_editable.value && !!cot.value && !cot.value.is_self);

const modeOptions = computed<Array<PropertyTab>>(() => {
    const opts: Array<PropertyTab> = [{ value: 'default', label: 'Details' }];
    if (hasStyle.value) opts.push({ value: 'style', label: 'Style' });
    if (cot.value?.is_skittle) opts.push({ value: 'channels', label: 'Channels' });
    opts.push({ value: 'debug', label: 'Debug' });
    return opts;
});
const breadcrumbLive = ref(false);
const bufferCotId = ref<string | null>(null);
const actionIconSize = 28;

// The Entity a CoT is a projection of, when it couldn't be opened because
// the device is offline
const offlineEntity = ref<CoreEntityRef | undefined>(undefined);
const retrying = ref(false);

const isNavigating = computed(() => {
    return mapStore.navigation.active
        && !!cot.value
        && mapStore.navigation.cotId === cot.value.id;
});

async function toggleNavigation() {
    if (!cot.value) return;

    if (isNavigating.value) {
        mapStore.stopNavigation();
    } else {
        await mapStore.startNavigation(cot.value.id);
    }
}

const currentTime = ref(new Date());
const interval = ref<ReturnType<typeof setInterval> | undefined>();

watch(cot, async () => {
    if (cot.value) {
        if (cot.value.origin.mode === OriginMode.MISSION && cot.value.origin.mode_id) {
            subscription.value = await Subscription.from(cot.value.origin.mode_id);
        } else {
            subscription.value = undefined;
        }
    }
});

watch(route, async () => {
    mode.value = 'default'
    breadcrumbLive.value = false;
    offlineEntity.value = undefined;
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

    const displayArea = await ProfileConfig.get('display_area');
    if (displayArea && displayArea.value) {
        units.value.display_area = displayArea.value;
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

// Unique GUIDs of the Missions the CoT's Links reference
const missionLinks = computed<string[]>(() => {
    if (!cot.value) return [];

    return [...new Set(
        (cot.value.properties.links || [])
            .map((link) => link.mission)
            .filter((mission): mission is string => !!mission)
    )];
});

const lineGeometry = computed(() => {
    if (!cot.value || cot.value.geometry.type !== 'LineString') return null;
    return cot.value.geometry;
});

const isLocked = computed(() => {
    if (!cot.value) return false;
    const id = cot.value.properties.id || cot.value.id;
    return mapStore.locked.length > 0 && mapStore.locked[mapStore.locked.length - 1] === id;
});

const hasGeoJSONTransforms = computed(() => {
    return !!cot.value && cot.value.geometry.type !== 'GeometryCollection';
});

const canChat = computed(() => {
    return !!cot.value && !!cot.value.properties.group && !cot.value.is_self;
});

const hasMoreActions = computed(() => {
    return is_editable.value || canChat.value || hasGeoJSONTransforms.value;
});

/** Optional property groups the CoT does not carry yet */
const addable = computed(() => {
    if (!cot.value) {
        return { attachments: false, links: false, video: false, sensor: false, geofence: false };
    }

    const properties = cot.value.properties;

    return {
        attachments: properties.attachments === undefined,
        links: properties.links === undefined,
        video: properties.video === undefined,
        sensor: properties.sensor === undefined,
        geofence: properties.geofence === undefined && cot.value.geometry.type === 'Polygon',
    };
});

const canAddProperty = computed(() => Object.values(addable.value).some(Boolean));

const hasSpeed = computed(() => {
    return !!cot.value && cot.value.properties.speed !== undefined && !isNaN(cot.value.properties.speed);
});

const hasCourse = computed(() => {
    return !!cot.value && cot.value.properties.course !== undefined && !isNaN(cot.value.properties.course);
});

const battery = computed<number | undefined>(() => {
    if (!cot.value || !cot.value.properties.status) return undefined;

    const battery = parseInt(String(cot.value.properties.status.battery));
    return isNaN(battery) ? undefined : battery;
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

// load_cot redirects to the Entity View if the network has come back
async function retryEntity(): Promise<void> {
    retrying.value = true;

    try {
        await load_cot();
    } finally {
        retrying.value = false;
    }
}

// Redirecting to the Entity View is only safe if the API can actually serve
// the Entity - anything but a 200 falls back to the offline CoT rendering
async function entityAvailable(entity: CoreEntityRef): Promise<boolean> {
    try {
        const res = entity.kind === 'device'
            ? await server.GET('/api/core/device/{:device}', {
                params: { path: { ':device': entity.id } }
            })
            : await server.GET('/api/core/event/{:event}', {
                params: { path: { ':event': entity.id } }
            });

        return res.response.status === 200;
    } catch (err) {
        console.error(`Failed to load Core ${entityLabel(entity)}`, err);
        return false;
    }
}

async function load_cot() {
    username.value = undefined;

    const baseCOT = (await mapStore.worker.db.get(String(route.params.uid), {
        mission: true
    }))

    if (baseCOT && baseCOT.origin.mode === OriginMode.MISSION && baseCOT.origin.mode_id) {
        subscription.value = await Subscription.from(baseCOT.origin.mode_id);
    }

    if (baseCOT) {
        // The Entity View is the richer representation but is API-only -
        // offline, the CoT remains the best available view of the Entity
        const entity = entityLink(baseCOT.properties.links);
        if (entity && router.hasRoute(entityRouteName(entity))) {
            if (deviceStore.network.isOnline && await entityAvailable(entity)) {
                // replace() so back navigation doesn't immediately redirect again
                await router.replace(entityRoute(entity));
                return;
            }

            offlineEntity.value = entity;
        }

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

    const isSIDC = Type2525.isNumericSIDCConvertable(type);

    // The type property is authoritative - a stale milicon would otherwise be
    // preferred by node-cot's from_geojson when the Feature is converted to a CoT
    if (cot.value.properties.milicon) {
        delete cot.value.properties.milicon;
    }

    if ((type.startsWith('a-') || isSIDC) && cot.value.properties.type.startsWith('u-')) {
        cot.value.properties["marker-color"] = '#FFFFFF';
    }

    cot.value.properties.type = type;

    // An Iconset icon is the user's own pick and survives a type change - the
    // type otherwise drives the icon, and a MIL-STD symbol needs none at all
    // since renderedIcon derives its key from the type
    if (!cot.value.properties.icon || !cot.value.properties.icon.includes(':')) {
        if (isSIDC) {
            delete cot.value.properties.icon;
        } else {
            cot.value.properties.icon = type;
        }
    }

    cot.value.update({});
}

function updateCoordinates(center: number[]): void {
    if (!cot.value) return;

    const properties = JSON.parse(JSON.stringify(cot.value.properties)) as COT['properties'];
    properties.center = center;

    if (cot.value.geometry.type === 'Point') {
        const geometry = {
            ...cot.value.geometry,
            coordinates: center
        } as COT['geometry'];

        void cot.value.update({
            properties,
            geometry
        });

        return;
    }

    void cot.value.update({ properties });
}

function updateRadius(radius: number): void {
    if (!cot.value) return;
    void cot.value.update({
        properties: setCircleRadius(cot.value.properties, radius * 1000)
    });
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

    type.value = await cot.value.resolveType();
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
/* Inline SVGs sit on the text baseline and leave descender space below them,
 * which varies with how deeply each icon is wrapped - block boxes give every
 * action button the same height so the row centers them on one line */
.cot-actions :deep(svg) {
    display: block;
}

.breadcrumb-live {
    position: absolute;
    top: 0;
    right: 0;
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: #e74c3c;
    border: 2px solid var(--tblr-body-bg, #1a1a2e);
}
</style>
