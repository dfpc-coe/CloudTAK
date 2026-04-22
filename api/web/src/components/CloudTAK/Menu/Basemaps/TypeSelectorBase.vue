<template>
    <TypeSelectorSelected
        v-if='showSelectedBanner'
        :type='type'
        @change-type='emit("change-type")'
    />

    <TablerInlineAlert
        v-if='warnSharing'
        severity='danger'
        title='You are disabling sharing'
        description='Disabling sharing will prevent other users from sharing the basemap and will also disable their access if the basemap has already been shared'
        :dismissable='true'
    />

    <div class='col-12 mt-3'>
        <TablerInput
            v-model='editing.name'
            required
            label='Name'
            :error='errors.name'
        >
            <TablerToggle
                v-model='editing.sharing_enabled'
                label='Enable Sharing'
                @change='emit("update:warnSharing", !editing.sharing_enabled)'
            />
        </TablerInput>
    </div>
    <div class='col-md-12'>
        <TablerInput
            v-model='editing.url'
            required
            :label='config.urlLabel'
            :description='config.urlDescription'
            :placeholder='config.urlPlaceholder'
            :error='errors.url'
        >
            <div
                v-if='config.urlTokens.length'
                class='btn-list'
            >
                <TablerBadge
                    v-for='token in config.urlTokens'
                    :key='token.value'
                    v-tooltip='token.tooltip'
                    class='cursor-pointer'
                    background-color='rgba(6, 182, 212, 0.15)'
                    border-color='rgba(6, 182, 212, 0.4)'
                    text-color='#0891b2'
                    @click='editing.url = editing.url + token.value'
                >
                    {{ token.value }}
                </TablerBadge>
            </div>
        </TablerInput>
    </div>

    <label
        class='subheader mt-3 cursor-pointer'
        @click='advanced = !advanced'
    >
        <IconSquareChevronRight
            v-if='!advanced'
            :size='32'
            stroke='1'
        />
        <IconChevronDown
            v-else
            :size='32'
            stroke='1'
        />
        Advanced Options
    </label>

    <div
        v-if='advanced'
        class='col-12'
    >
        <div class='row g-2'>
            <div
                v-if='showTypeField'
                class='col-12 mt-3'
            >
                <TablerEnum
                    v-model='editing.type'
                    required
                    label='Type'
                    :options='["raster", "raster-dem", "vector"]'
                />
            </div>
            <div
                v-if='isSystemAdmin'
                class='col-12 mt-3'
            >
                <TablerEnum
                    :model-value='scope'
                    required
                    label='Access Scope'
                    :options='["user", "server"]'
                    @update:model-value='emit("update:scope", $event)'
                />
            </div>
            <SelectBasemapCollection
                v-model='editing.collection'
                :overlay='editing.overlay'
            />
            <div class='col-12'>
                <TablerInput
                    v-model='editing.attribution'
                    label='Attribution'
                    placeholder='Optional Attribution'
                />
            </div>

            <div
                v-if='editing.type === "vector" && vectorLayers.length'
                class='col-12'
            >
                <HandleForm
                    v-model='vectorTitleField'
                    label='Feature Title Field'
                    description='Feature property used as the vector title. Type {{ to browse fields discovered from vector_layers.'
                    :schema='vectorTitleSchema'
                />
            </div>

            <slot name='advanced' />

            <template v-if='isSystemAdmin'>
                <div class='col-12'>
                    <TablerToggle
                        v-model='editing.overlay'
                        label='Overlay'
                        description='If true, this layer is treated as an overlay on top of base maps'
                    >
                        <TablerBadge>admin</TablerBadge>
                    </TablerToggle>
                </div>
                <div class='col-12'>
                    <TablerToggle
                        v-model='editing.hidden'
                        label='Hidden'
                        description='Hide this layer from the default list'
                    >
                        <TablerBadge>admin</TablerBadge>
                    </TablerToggle>
                </div>
                <div class='col-12'>
                    <TablerInput
                        v-if='editing.frequency !== undefined && editing.frequency !== null'
                        v-model='editing.frequency'
                        label='Update Frequency (Seconds)'
                        description='How often to refresh the tiles in seconds'
                    >
                        <TablerBadge>admin</TablerBadge>
                        <TablerToggle
                            :model-value='true'
                            label='Enabled'
                            @click='editing.frequency = null'
                        />
                    </TablerInput>
                    <div v-else>
                        <TablerToggle
                            :model-value='false'
                            label='Enable Auto-Update Frequency'
                            description='Automatically refresh the tiles periodically'
                            @click='editing.frequency = 60'
                        >
                            <TablerBadge>admin</TablerBadge>
                        </TablerToggle>
                    </div>
                </div>
                <div
                    v-if='editing.type === "vector"'
                    class='col-12'
                >
                    <div class='row g-2 my-2 border rounded'>
                        <div class='col-12'>
                            <TablerToggle
                                v-model='editing.snapping_enabled'
                                label='Enable Snapping'
                                description='Allow drawing tools to snap to the underlying vector features'
                            >
                                <TablerBadge>admin</TablerBadge>
                            </TablerToggle>
                        </div>
                        <div
                            v-if='editing.snapping_enabled'
                            class='col-12'
                        >
                            <TablerEnum
                                v-if='vectorLayerOptions.length'
                                v-model='editing.snapping_layer'
                                label='Snapping Layer'
                                description='Choose the vector layer to snap drawing tools to'
                                :options='vectorLayerOptions'
                            />
                            <TablerInput
                                v-else
                                v-model='editing.snapping_layer'
                                label='Snapping Layer'
                                description='The specific layer name within the vector tiles to snap to'
                            />
                        </div>
                    </div>
                </div>
            </template>
        </div>
    </div>
</template>

<script setup lang='ts'>
import { computed, ref } from 'vue';
import {
    TablerBadge,
    TablerInlineAlert,
    TablerToggle,
    TablerEnum,
    TablerInput,
} from '@tak-ps/vue-tabler';
import { IconChevronDown, IconSquareChevronRight } from '@tabler/icons-vue';
import HandleForm from '../../../util/HandleForm.vue';
import SelectBasemapCollection from '../../util/SelectBasemapCollection.vue';
import TypeSelectorSelected from './TypeSelectorSelected.vue';
import { BasemapTypeConfig } from './types.ts';
import type { BasemapSourceType, EditingBasemap, VectorLayerDescriptor } from './types.ts';

const editing = defineModel<EditingBasemap>('editing', { required: true });

const props = defineProps<{
    basemapId?: number;
    vectorLayers: VectorLayerDescriptor[];
    errors: Record<'name' | 'url', string>;
    type: BasemapSourceType;
    scope: 'user' | 'server';
    warnSharing: boolean;
    isSystemAdmin: boolean;
}>();

const emit = defineEmits<{
    'change-type': [];
    'update:scope': [value: 'user' | 'server'];
    'update:warnSharing': [value: boolean];
}>();

const config = BasemapTypeConfig[props.type];
const showSelectedBanner = computed(() => !props.basemapId);
const showTypeField = computed(() => {
    return props.type !== 'featureserver'
        && props.type !== 'mapserver'
        && props.type !== 'imageserver';
});
const advanced = ref(false);

const vectorTitleSchema = computed(() => {
    const fields = new Set<string>();

    for (const layer of props.vectorLayers || []) {
        for (const field of Object.keys(layer.fields || {})) {
            fields.add(field);
        }
    }

    return {
        type: 'object',
        properties: Object.fromEntries(Array.from(fields).sort().map((field) => {
            return [field, { type: 'string' }];
        }))
    };
});

const vectorTitleField = computed({
    get: () => {
        return editing.value.title || '';
    },
    set: (value: string) => {
        editing.value.title = value.trim();
    }
});

const vectorLayerOptions = computed(() => {
    const ids = new Set<string>();

    for (const layer of props.vectorLayers || []) {
        if (layer.id) ids.add(layer.id);
    }

    const current = editing.value.snapping_layer;
    if (current) ids.add(current);

    return Array.from(ids).sort();
});
</script>
