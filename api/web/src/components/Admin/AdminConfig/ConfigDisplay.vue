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
import { server, std, stdurl } from '../../../std.ts';
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

type DisplayKey = 'stale' | 'distance' | 'elevation' | 'speed' | 'projection' | 'zoom' | 'coordinate' | 'text' | 'icon_rotation';
type DisplayConfigKey = `display::${DisplayKey}`;
type DisplayOptionValue = string | boolean;

interface DisplayOptionEntry {
    value: DisplayOptionValue;
    options: DisplayOptionValue[];
}

type DisplayResponse = Record<DisplayKey, DisplayOptionEntry>;
type DisplayConfig = Record<DisplayConfigKey, DisplayOptionValue>;
type DisplayOptions = Record<DisplayConfigKey, DisplayOptionValue[]>;

const displayKeys: DisplayConfigKey[] = [
    'display::stale',
    'display::distance',
    'display::elevation',
    'display::speed',
    'display::projection',
    'display::zoom',
    'display::coordinate',
    'display::text',
    'display::icon_rotation',
];

function createDisplayConfig(): DisplayConfig {
    return {
        'display::stale': '',
        'display::distance': '',
        'display::elevation': '',
        'display::speed': '',
        'display::projection': '',
        'display::zoom': '',
        'display::coordinate': '',
        'display::text': '',
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
        'display::coordinate': [],
        'display::text': [],
        'display::icon_rotation': [],
    };
}

function labelForKey(key: DisplayConfigKey): string {
    if (key === 'display::icon_rotation') return 'Rotate Icons with Course';
    if (key === 'display::coordinate') return 'Coordinate Format';

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

        const display = data as DisplayResponse;

        for (const key of displayKeys) {
            const shortKey = key.replace('display::', '') as DisplayKey;
            displayOptions.value[key] = display[shortKey].options;
            config.value[key] = display[shortKey].value;
        }
    } catch (error) {
        err.value = error instanceof Error ? error : new Error(String(error));
    }
    loading.value = false;
}

async function save(): Promise<void> {
    loading.value = true;
    err.value = null;
    try {
        await std(stdurl('/api/config'), {
            method: 'PUT',
            body: config.value
        });
        
        await fetch();
        edit.value = false;
    } catch (error) {
        err.value = error instanceof Error ? error : new Error(String(error));
        console.error('Failed to save Display config:', error);
    }

    loading.value = false;
}
</script>
