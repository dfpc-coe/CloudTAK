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
            <div class='col-12 card-header row my-2 d-flex' >
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
                            width: calc(100% - 40px);
                        `'
                    >
                        <CopyField
                            :model-value='cot.properties.callsign'
                            :edit='is_editable'
                            :minheight='44'
                            :hover='is_editable'
                            @update:model-value='updateProperty("callsign", $event)'
                        />
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
                            title='Zoom To'
                            @click='cot.flyTo()'
                        >
                            <IconZoomPan
                                :size='32'
                                stroke='1'
                            />
                        </TablerIconButton>


                        <TablerIconButton
                            v-if='cot.properties.video && cot.properties.video.url'
                            title='View Video Stream'
                            @click='floatStore.addCOT(String(route.params.uid))'
                        >
                            <IconPlayerPlay
                                size='32'
                                stroke='1'
                            />
                        </TablerIconButton>
                        <TablerIconButton
                            title='Share'
                            @click='share = true'
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
                            v-if='is_editable'
                            displaytype='icon'
                            @delete='deleteCOT'
                        />

                        <TablerIconButton
                            v-if='is_editable'
                            title='Edit'
                            @click='editGeometry'
                        >
                            <IconPencil
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
                            v-if='is_editable'
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
                                                && cot.properties.video !== undefined
                                                && cot.properties.sensor !== undefined
                                        '
                                    >
                                        No Properties to add
                                    </div>
                                    <template v-else>
                                        <div
                                            v-if='cot.properties.attachments === undefined'
                                            role='button'
                                            class='hover px-2 py-2 d-flex align-items-center'
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
                                            v-if='cot.properties.video === undefined'
                                            role='button'
                                            class='hover px-2 py-2 d-flex align-items-center'
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
                                            class='hover px-2 py-2 d-flex align-items-center'
                                            @click='updateProperty("sensor", {})'
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
                    v-if='subscription'
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
                            @click='router.push(`/menu/missions/${subscription.meta.guid}`)'
                            v-text='subscription.meta.name'
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
                    <PropertyType
                        v-if='cot.properties.type.startsWith("a-") || cot.properties.type === "u-d-p"'
                        :key='cot.properties.type'
                        :edit='is_editable'
                        :hover='is_editable'
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
                        :unit='units.display_elevation'
                        :elevation='cot.properties.center[2]'
                    />
                </div>

                <div
                    v-if='cot && cot.geometry.type === "LineString"'
                    class='col-12 pt-2'
                >
                    <LineLength
                        :cot='cot'
                        :unit='units.display_distance'
                    />
                </div>

                <div
                    v-if='cot && cot.geometry.type === "Polygon"'
                    class='col-12 pt-2'
                >
                    <PolygonArea
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
                        :modelValue='cot.properties.shape.ellipse.major * 0.001'
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
                        :unit='units.display_speed'
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
                    <PropertyBearing
                        label='Course'
                        :model-value='cot.properties.course'
                        class='py-2'
                    />
                </div>

                <div
                    v-if='cot.properties.contact && cot.properties.contact.phone'
                    class='pt-2'
                >
                    <PropertyPhone
                        :phone='cot.properties.contact.phone'
                    />
                </div>
            </div>

            <div
                v-if='username'
                class='col-12 pt-2'
            >
                <PropertyEmail
                    :email='username'
                />
            </div>

            <div
                v-if='!cot.properties.contact && cot.properties.attachments !== undefined'
                class='col-12 py-2'
            >
                <PropertyAttachments
                    :model-value='cot.properties.attachments'
                    @update:model-value='updatePropertyAttachment($event)'
                />
            </div>

            <div
                v-if='cot.properties.remarks !== undefined'
                class='col-12 py-2'
            >
                <div class='col-12'>
                    <IconBlockquote
                        :size='18'
                        stroke='1'
                        color='#6b7990'
                        class='ms-2 me-1'
                    />
                    <label class='subheader user-select-none'>Remarks</label>
                </div>
                <div class='px-2'>
                    <CopyField
                        :model-value='cot.properties.remarks'
                        :rows='10'
                        :edit='is_editable'
                        :hover='is_editable'
                        @update:model-value='updateProperty("remarks", $event)'
                    />
                </div>
            </div>

            <div
                v-if='cot.properties.geofence'
                class='col-12 py-2'
            >
                <div class='col-12'>
                    <IconFence
                        :size='18'
                        stroke='1'
                        color='#6b7990'
                        class='ms-2 me-1'
                    />
                    <label class='subheader user-select-none'>Geofence</label>
                </div>

                <div class='mx-2 bg-gray-500 row user-select-none'>
                    <TablerToggle
                        label='Elevation Monitored'
                        :model-value='cot.properties.geofence.elevationMonitored'
                        :disabled='true'
                    />

                    <div
                        v-if='cot.properties.geofence.trigger === "Both" || cot.properties.geofence.trigger === "Enter"'
                        class='col-6 py-2'
                    >
                        <IconDoorEnter
                            :size='32'
                            stroke='1'
                            class='mx-2'
                        />
                        <span>Alarm on Enter</span>
                    </div>
                    <div
                        v-if='cot.properties.geofence.trigger === "Both" || cot.properties.geofence.trigger === "Exit"'
                        class='col-6 py-2'
                    >
                        <IconDoorExit
                            :size='32'
                            stroke='1'
                            class='mx-2'
                        />

                        <span>Alarm on Exit</span>
                    </div>
                </div>
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
                    <label class='subheader user-select-none'>Times</label>
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
                                <td>Time</td><td v-text='timeProp' />
                            </tr>
                            <tr>
                                <td>Start</td><td v-text='startProp' />
                            </tr>
                            <tr>
                                <td>Stale</td><td v-text='staleProp' />
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <PropertySensor
                v-if='cot.properties.sensor !== undefined'
                :model-value='cot.properties.sensor'
                class='my-2 mx-2'
                @update:model-value='updateProperty("sensor", $event)'
            />

            <PropertyMilSym
                v-if='cot.properties.milsym'
                label='Unit Information'
                :model-value='cot.properties.milsym.id'
            />

            <div
                v-if='is_editable && !cot.is_self'
                class='pb-2 col-12'
            >
                <div class='col-12'>
                    <IconPaint
                        :size='18'
                        stroke='1'
                        color='#6b7990'
                        class='ms-2 me-1'
                    />
                    <label class='subheader user-select-none'>Style</label>
                </div>
                <div class='px-2 py-3'>
                    <div class='row g-2 rounded px-2 bg-gray-500 pb-2'>
                        <template v-if='cot.geometry.type === "Point"'>
                            <div class='col-12'>
                                <IconSelect
                                    :model-value='cot.properties.icon'
                                    label='Point Icon'
                                    :size='32'
                                    stroke='1'
                                    @update:model-value='updatePropertyIcon($event)'
                                />
                            </div>
                            <div class='col-12'>
                                <label class='subheader user-select-none'>Point Color</label>
                                <TablerInput
                                    :model-value='cot.properties["marker-color"]'
                                    label=''
                                    default='#FFFFFF'
                                    type='color'
                                    class='pb-2'
                                    @update:model-value='updateProperty("marker-color", $event)'
                                />
                            </div>
                            <div class='col-12'>
                                <label class='subheader user-select-none'>Point Opacity</label>
                                <TablerRange
                                    :model-value='cot.properties["marker-opacity"]'
                                    label=''
                                    :default='1'
                                    :min='0'
                                    :max='1'
                                    :step='0.01'
                                    @update:model-value='updateProperty("marker-opacity", $event)'
                                />
                            </div>
                        </template>
                        <template v-else>
                            <div class='col-12'>
                                <label class='subheader user-select-none'>Line Colour</label>
                                <TablerInput
                                    :model-value='cot.properties["stroke"]'
                                    label=''
                                    type='color'
                                    @update:model-value='updateProperty("stroke", $event)'
                                />
                            </div>

                            <div class='col-12'>
                                <label class='subheader user-select-none'>Line Style</label>
                                <TablerEnum
                                    :model-value='cot.properties["stroke-style"]'
                                    label=''
                                    :options='["solid", "dashed", "dotted", "outlined"]'
                                    default='solid'
                                    @update:model-value='updateProperty("stroke-style", $event)'
                                />
                            </div>
                            <div class='col-12'>
                                <label class='subheader user-select-none'>Line Thickness</label>
                                <TablerRange
                                    :model-value='cot.properties["stroke-width"]'
                                    label=''
                                    :default='1'
                                    :min='1'
                                    :max='6'
                                    :step='1'
                                    @update:model-value='updateProperty("stroke-width", $event)'
                                />
                            </div>
                            <div class='col-12'>
                                <label class='subheader user-select-none'>Line Opacity</label>
                                <TablerRange
                                    :model-value='cot.properties["stroke-opacity"]'
                                    label=''
                                    :default='1'
                                    :min='0'
                                    :max='1'
                                    :step='0.01'
                                    @update:model-value='updateProperty("stroke-opacity", $event)'
                                />
                            </div>
                        </template>
                        <template v-if='cot.geometry.type === "Polygon"'>
                            <div class='col-12'>
                                <label class='subheader user-select-none'>Fill Colour</label>
                                <TablerInput
                                    :model-value='cot.properties["fill"]'
                                    label=''
                                    type='color'
                                    @update:model-value='updateProperty("fill", $event)'
                                />
                            </div>
                            <div class='col-12 round'>
                                <label class='subheader user-select-none'>Fill Opacity</label>
                                <TablerRange
                                    :model-value='cot.properties["fill-opacity"]'
                                    label=''
                                    :default='1'
                                    :min='0'
                                    :max='1'
                                    :step='0.01'
                                    @update:model-value='updateProperty("fill-opacity", $event)'
                                />
                            </div>
                        </template>
                    </div>
                </div>
            </div>

            <div
                v-if='cot.properties.creator && cot.properties.creator'
                class='pt-2'
            >
                <PropertyCreator
                    :creator='cot.properties.creator'
                />
            </div>

            <div
                v-if='
                    cot.properties.takv
                        && cot.properties.takv
                        && Object.keys(cot.properties.takv).length
                '
                class='col-12 px-1 pb-2'
            >
                <div
                    class='col-12 py-2 d-flex align-items-center hover cursor-pointer user-select-none'
                    @click='chevrons.has("metadata") ? chevrons.delete("metadata") : chevrons.add("metadata")'
                >
                    <TablerIconButton
                        v-if='!chevrons.has("metadata")'
                        title='Open Metadata'
                    >
                        <IconChevronRight
                            :size='24'
                            stroke='1'
                        />
                    </TablerIconbutton>

                    <TablerIconButton
                        v-else
                        title='Close Metadata'
                    >
                        <IconChevronDown
                            :size='24'
                            stroke='1'
                        />
                    </TablerIconbutton>
                    <label class='subheader user-select-none cursor-pointer'>Metadata</label>
                </div>
                <div
                    v-if='chevrons.has("metadata")'
                    class='table-responsive rounded mx-2 py-2 px-2'
                >
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
                    style='
                        height: calc(100vh - 225px);
                        width: 100%;
                    '
                    :model-value='JSON.stringify(cot.as_feature(), null, 4)'
                />
            </div>
        </template>
    </template>

    <Share
        v-if='share && cot'
        :feats='[cot.as_feature()]'
        @done='share = false'
        @cancel='share = false'
    />
</template>

<script setup lang='ts'>
import { ref, computed, watch, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router'
import FeatureIcon from './util/FeatureIcon.vue';
import type COT from '../../base/cot.ts';
import type { COTType } from '../../types.ts';
import { OriginMode } from '../../base/cot.ts'
import Subscription from '../../base/subscription.ts'
import {
    TablerNone,
    TablerInput,
    TablerDelete,
    TablerToggle,
    TablerEnum,
    TablerRange,
    TablerDropdown,
    TablerIconButton,
} from '@tak-ps/vue-tabler';

import CopyField from './util/CopyField.vue';
import IconSelect from '../util/IconSelect.vue';
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
import {
    IconPencil,
    IconFence,
    IconMovie,
    IconRoute,
    IconCone,
    IconStar,
    IconDoorEnter,
    IconDoorExit,
    IconStarFilled,
    IconMessage,
    IconBlockquote,
    IconDotsVertical,
    IconChevronRight,
    IconChevronDown,
    IconAmbulance,
    IconPlayerPlay,
    IconShare2,
    IconZoomPan,
    IconCode,
    IconPaint,
    IconAffiliate,
    IconInfoCircle,
    IconPaperclip,
} from '@tabler/icons-vue';
import Subscriptions from './util/Subscriptions.vue';
import timediff from '../../timediff.ts';
import { std } from '../../std.ts';
import { useMapStore } from '../../stores/map.ts';
import { useFloatStore } from '../../stores/float.ts';

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

const chevrons = ref<Set<string>>(new Set());
const username = ref<string | undefined>();
const type = ref<COTType | undefined>();
const mode = ref('default');

const currentTime = ref(new Date());
const interval = ref<ReturnType<typeof setInterval> | undefined>();
const time = ref('relative');

watch(cot, async () => {
    if (cot.value) {
        if (cot.value.origin.mode === OriginMode.MISSION && cot.value.origin.mode_id) {
            subscription.value = await mapStore.worker.db.subscriptionGet(cot.value.origin.mode_id);
        } else {
            subscription.value = undefined;
        }
    }
});

watch(route, async () => {
    mode.value = 'default'
    await load_cot();
});

onMounted(async () => {
    await load_cot();

    const profile = await mapStore.worker.profile.load();
    if (profile) {
        units.value.display_speed = profile.display_speed;
        units.value.display_elevation = profile.display_elevation;
        units.value.display_distance = profile.display_distance;
    }

    interval.value = setInterval(async () => {
        currentTime.value = new Date();

        if (!cot.value) {
            await load_cot();
        }
    }, 1000)
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
        subscription.value = await mapStore.worker.db.subscriptionGet(baseCOT.origin.mode_id);
    }

    if (baseCOT) {
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

const staleProp = computed(() => {
    if (!cot.value) return '';
    return (currentTime.value && time.value === 'relative') ? timediff(cot.value.properties.stale) : cot.value.properties.stale;
});

const startProp = computed(() => {
    if (!cot.value) return '';
    return (currentTime.value && time.value === 'relative') ? timediff(cot.value.properties.start) : cot.value.properties.start;
});

const timeProp = computed(() => {
    if (!cot.value) return '';
    return (currentTime.value && time.value === 'relative') ? timediff(cot.value.properties.time) : cot.value.properties.time;
});

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

function updatePropertyIcon(event: string | null) {
    if (!cot.value) return;

    if (event) {
        event = event.replace(/\.png$/g, '').replace(':', '/');
    }

    if (
        event
        && (
            !cot.value.properties.icon
            || (
                cot.value.properties.icon
                && event !== cot.value.properties.icon
            )
        )
    ) {
        cot.value.properties.icon = event;
        cot.value.properties["marker-color"] = '#FFFFFF';
        cot.value.update({});
    } else if (cot.value.properties.icon && !event) {
        if (cot.value.properties.type !== 'u-d-p') {
            cot.value.properties.icon = cot.value.properties.type;
        } else {
            cot.value.properties.icon = undefined;
        }

        cot.value.update({});
    }
}

function updatePropertyType(type: string): void {
    if (!cot.value) return;

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

async function fetchType() {
    if (!cot.value) return;
    type.value = await std(`/api/type/cot/${cot.value.properties.type}`) as COTType
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
    router.push('/');
}
</script>
