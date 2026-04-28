<template>
    <SlideDownHeader
        v-model='isOpen'
        label='Display Defaults'
    >
        <template #right>
            <TablerIconButton
                v-if='!edit && isOpen'
                title='Edit'
                @click.stop='edit = true'
            >
                <IconPencil stroke='1' />
            </TablerIconButton>
            <div
                v-else-if='edit && isOpen'
                class='d-flex gap-1'
            >
                <TablerIconButton
                    color='rgba(var(--tblr-primary-rgb), 0.14)'
                    title='Save'
                    @click.stop='save'
                >
                    <IconDeviceFloppy
                        color='rgb(var(--tblr-primary-rgb))'
                        stroke='1'
                    />
                </TablerIconButton>
                <TablerIconButton
                    title='Cancel'
                    @click.stop='edit = false; fetch()'
                >
                    <IconX stroke='1' />
                </TablerIconButton>
            </div>
        </template>
        <div class='col-lg-12 py-2 px-2 border rounded'>
            <TablerLoading v-if='loading' />
            <template v-else>
                <TablerAlert
                    v-if='err'
                    :err='err'
                />
                <div class='row'>
                    <TablerInlineAlert
                        title='Application Behavior'
                        description='These are the default display settings for new users. Existing users will not be affected.'
                    />

                    <div
                        v-for='key in displayKeys'
                        :key='key'
                        class='col-lg-12'
                    >
                        <TablerEnum
                            v-model='config[key]'
                            :label='labelForKey(key)'
                            :options='displayOptions[key]'
                            :disabled='!edit'
                        />
                    </div>
                </div>
            </template>
        </div>
    </SlideDownHeader>
</template>

<script setup lang="ts">
import SlideDownHeader from '../../CloudTAK/util/SlideDownHeader.vue';
import { ref, watch, onMounted } from 'vue';
import { server } from '../../../std.ts';
import type { paths } from '@cloudtak/api-types';
import {
    TablerLoading,
    TablerEnum,
    TablerInlineAlert,
    TablerIconButton,
    TablerAlert
} from '@tak-ps/vue-tabler';
import {
    IconPencil,
    IconDeviceFloppy,
    IconX
} from '@tabler/icons-vue';

type DisplayKey = 'stale' | 'distance' | 'elevation' | 'speed' | 'projection' | 'zoom' | 'style' | 'coordinate' | 'text' | 'icon_rotation';
type DisplayConfigKey = `display::${DisplayKey}`;
type DisplayResponse = paths['/api/config/display']['get']['responses']['200']['content']['application/json'];
type DisplayConfig = {
    [K in DisplayConfigKey]: DisplayResponse[K extends `display::${infer S extends DisplayKey}` ? S : never]['value'];
};
type DisplayOptions = {
    [K in DisplayConfigKey]: DisplayResponse[K extends `display::${infer S extends DisplayKey}` ? S : never]['options'];
};

const displayKeys: DisplayConfigKey[] = [
    'display::stale',
    'display::distance',
    'display::elevation',
    'display::speed',
    'display::projection',
    'display::zoom',
    'display::style',
    'display::coordinate',
    'display::text',
    'display::icon_rotation',
];

function createDisplayConfig(): DisplayConfig {
    return {
        'display::stale': '10 Minutes',
        'display::distance': 'mile',
        'display::elevation': 'feet',
        'display::speed': 'mi/h',
        'display::projection': 'globe',
        'display::zoom': 'conditional',
        'display::style': 'System Default',
        'display::coordinate': 'dd',
        'display::text': 'Medium',
        'display::icon_rotation': true,
    };
}

function createDisplayOptions(): DisplayOptions {
    return {
        'display::stale': [],
        'display::distance': [],
        'display::elevation': [],
        'display::speed': [],
        'display::projection': [],
        'display::zoom': [],
        'display::style': [],
        'display::coordinate': [],
        'display::text': [],
        'display::icon_rotation': [],
    };
}

function labelForKey(key: DisplayConfigKey): string {
    if (key === 'display::icon_rotation') return 'Rotate Icons with Course';
    if (key === 'display::coordinate') return 'Coordinate Format';
    if (key === 'display::style') return 'Light / Dark Style';

    return key
        .replace('display::', '')
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (character) => character.toUpperCase());
}

const isOpen = ref<boolean>(false);
const loading = ref<boolean>(false);
const edit = ref<boolean>(false);
const err = ref<Error | null>(null);

const config = ref<DisplayConfig>(createDisplayConfig());
const displayOptions = ref<DisplayOptions>(createDisplayOptions());

onMounted(() => {
     if (isOpen.value) void fetch();
});

watch(isOpen, (newState) => {
    if (newState && !edit.value) void fetch();
});

async function fetch(): Promise<void> {
    loading.value = true;
    err.value = null;
    config.value = createDisplayConfig();
    displayOptions.value = createDisplayOptions();

    try {
        const { data, error } = await server.GET('/api/config/display');
        if (error) throw new Error(error.message);

        displayOptions.value = {
            'display::stale': data.stale.options,
            'display::distance': data.distance.options,
            'display::elevation': data.elevation.options,
            'display::speed': data.speed.options,
            'display::projection': data.projection.options,
            'display::zoom': data.zoom.options,
            'display::style': data.style.options,
            'display::coordinate': data.coordinate.options,
            'display::text': data.text.options,
            'display::icon_rotation': data.icon_rotation.options,
        };

        config.value = {
            'display::stale': data.stale.value,
            'display::distance': data.distance.value,
            'display::elevation': data.elevation.value,
            'display::speed': data.speed.value,
            'display::projection': data.projection.value,
            'display::zoom': data.zoom.value,
            'display::style': data.style.value,
            'display::coordinate': data.coordinate.value,
            'display::text': data.text.value,
            'display::icon_rotation': data.icon_rotation.value,
        };
    } catch (error) {
        err.value = error instanceof Error ? error : new Error(String(error));
    }
    loading.value = false;
}

async function save(): Promise<void> {
    loading.value = true;
    err.value = null;
    try {
        const { error } = await server.PUT('/api/config', {
            body: config.value
        });
        if (error) throw new Error(error.message);
        
        await fetch();
        edit.value = false;
    } catch (error) {
        err.value = error instanceof Error ? error : new Error(String(error));
        console.error('Failed to save Display config:', error);
    }

    loading.value = false;
}
</script>
