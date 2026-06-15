<template>
    <MenuTemplate
        name='Display Preferences'
        :loading='loading || !profile'
    >
        <template v-if='profile'>
            <div class='col-12 d-flex flex-column gap-2 py-2'>
                <TablerInput
                    v-model='search'
                    icon='search'
                    placeholder='Search settings...'
                />

                <div class='d-flex flex-column gap-2'>
                    <StandardItem
                        v-for='item of filteredSettings'
                        :key='item.key'
                        :hover='false'
                        class='position-relative'
                    >
                        <Transition name='saved-fade'>
                            <div
                                v-if='savedKey === item.key'
                                class='saved-indicator position-absolute d-flex align-items-center gap-1'
                            >
                                <IconCircleCheck
                                    :size='16'
                                    stroke='1.5'
                                    class='text-success'
                                />
                                <span class='text-success small fw-medium'>Saved</span>
                            </div>
                        </Transition>
                        <div class='d-flex flex-column gap-2 px-3 py-3'>
                            <div class='d-flex align-items-center gap-3'>
                                <div
                                    class='d-flex align-items-center justify-content-center rounded-circle bg-black bg-opacity-25 flex-shrink-0'
                                    style='width: 40px; height: 40px;'
                                >
                                    <component
                                        :is='item.icon'
                                        :size='24'
                                        stroke='1.5'
                                    />
                                </div>
                                <div class='fw-bold text-white'>
                                    {{ item.label }}
                                </div>
                            </div>
                            <div class='col-12'>
                                <TablerEnum
                                    v-if='item.type === "enum"'
                                    v-model='(profile as any)[item.key]'
                                    :options='item.options'
                                />
                                <TablerToggle
                                    v-else
                                    v-model='(profile as any)[item.key]'
                                />
                            </div>
                        </div>
                    </StandardItem>

                    <div
                        v-if='filteredSettings.length === 0'
                        class='text-center text-secondary py-4'
                    >
                        No settings match "{{ search }}"
                    </div>
                </div>
            </div>
        </template>
    </MenuTemplate>
</template>

<script setup lang='ts'>
import { ref, computed, toRaw, onMounted, watch } from 'vue';
import type { Component } from 'vue';
import {
    IconClock,
    IconTypography,
    IconRuler,
    IconMountain,
    IconGauge,
    IconAtom,
    IconWorld,
    IconBrightness,
    IconCrosshair,
    IconZoomIn,
    IconRotate,
    IconCircleCheck,
} from '@tabler/icons-vue';
import MenuTemplate from '../util/MenuTemplate.vue';
import StandardItem from '../util/StandardItem.vue';
import type { Profile, Profile_Update } from '../../../types.ts';
import {
    TablerEnum,
    TablerInput,
    TablerToggle,
} from '@tak-ps/vue-tabler';
import { useMapStore } from '../../../stores/map.ts';
import ProfileConfig from '../../../base/profile.ts';
import { COORD_MODES, type CoordMode } from '../../../base/utils/coordinateFormat.ts';
const mapStore = useMapStore();

type DisplayStyleMode = 'System Default' | 'Light' | 'Dark';
type DisplayProfile = Profile & {
    display_style?: DisplayStyleMode
};
type DisplayProfileUpdate = Profile_Update & {
    display_style?: DisplayStyleMode
};

type SettingItem = {
    key: string;
    label: string;
    icon: Component;
    type: 'enum' | 'toggle';
    options?: string[];
};

const loading = ref(false);
const profile = ref<DisplayProfile | undefined>();
const search = ref('');
const savedKey = ref<string | undefined>();
const coordFormatOptions = COORD_MODES.map((mode) => mode.value);
const styleOptions: DisplayStyleMode[] = ['System Default', 'Light', 'Dark'];

const settings: SettingItem[] = [
    {
        key: 'display_stale',
        label: 'Remove Stale Elements',
        icon: IconClock,
        type: 'enum',
        options: ['Immediate', '10 Minutes', '30 Minutes', '1 Hour', 'Never'],
    },
    {
        key: 'display_text',
        label: 'Text Size',
        icon: IconTypography,
        type: 'enum',
        options: ['Small', 'Medium', 'Large'],
    },
    {
        key: 'display_distance',
        label: 'Distance Unit',
        icon: IconRuler,
        type: 'enum',
        options: ['meter', 'kilometer', 'mile'],
    },
    {
        key: 'display_elevation',
        label: 'Elevation Unit',
        icon: IconMountain,
        type: 'enum',
        options: ['meter', 'feet'],
    },
    {
        key: 'display_speed',
        label: 'Speed Unit',
        icon: IconGauge,
        type: 'enum',
        options: ['m/s', 'km/h', 'mi/h'],
    },
    {
        key: 'display_radiation_dose',
        label: 'Radiation Dose Unit',
        icon: IconAtom,
        type: 'enum',
        options: ['sieverts', 'rems'],
    },
    {
        key: 'display_projection',
        label: 'Display Projection',
        icon: IconWorld,
        type: 'enum',
        options: ['globe', 'mercator'],
    },
    {
        key: 'display_style',
        label: 'Light / Dark Style',
        icon: IconBrightness,
        type: 'enum',
        options: styleOptions,
    },
    {
        key: 'display_coordinate',
        label: 'Coordinate Format',
        icon: IconCrosshair,
        type: 'enum',
        options: coordFormatOptions,
    },
    {
        key: 'display_zoom',
        label: 'Display Zoom Controls',
        icon: IconZoomIn,
        type: 'enum',
        options: ['always', 'conditional', 'never'],
    },
    {
        key: 'display_icon_rotation',
        label: 'Rotate Icons with Course',
        icon: IconRotate,
        type: 'toggle',
    },
];

const filteredSettings = computed(() => {
    const query = search.value.trim().toLowerCase();
    if (!query) return settings;
    return settings.filter((item) =>
        item.label.toLowerCase().includes(query)
    );
});

async function getProfile() {
    return {
        display_stale: (await ProfileConfig.get('display_stale'))?.value,
        display_text: (await ProfileConfig.get('display_text'))?.value,
        display_distance: (await ProfileConfig.get('display_distance'))?.value,
        display_elevation: (await ProfileConfig.get('display_elevation'))?.value,
        display_speed: (await ProfileConfig.get('display_speed'))?.value,
        display_radiation_dose: (await ProfileConfig.get('display_radiation_dose'))?.value,
        display_projection: (await ProfileConfig.get('display_projection'))?.value,
        display_style: (await ProfileConfig.get('display_style' as keyof Profile))?.value as DisplayStyleMode | undefined,
        display_coordinate: (await ProfileConfig.get('display_coordinate'))?.value,
        display_zoom: (await ProfileConfig.get('display_zoom'))?.value,
        display_icon_rotation: (await ProfileConfig.get('display_icon_rotation'))?.value,
    } as DisplayProfile;
}

onMounted(async () => {
    loading.value = true;
    profile.value = await getProfile();

    // Snapshot initial values so the watcher doesn't fire on first load
    for (const item of settings) {
        previousValues[item.key] = (profile.value as DisplayProfile)[item.key as keyof DisplayProfile];
    }

    loading.value = false;
});

let saveTimeout: ReturnType<typeof setTimeout> | undefined;
let previousValues: Record<string, unknown> = {};

watch(
    () => profile.value,
    async (newProfile) => {
        if (!newProfile || loading.value) return;

        // Determine which key changed by comparing against the snapshot taken after last save
        for (const item of settings) {
            const current = (newProfile as DisplayProfile)[item.key as keyof DisplayProfile];
            if (current !== previousValues[item.key]) {
                savedKey.value = item.key;
                break;
            }
        }

        // Snapshot current values before the async save
        previousValues = {};
        for (const item of settings) {
            previousValues[item.key] = (newProfile as DisplayProfile)[item.key as keyof DisplayProfile];
        }

        await mapStore.worker.profile.update(toRaw(newProfile) as DisplayProfileUpdate);

        // Update distance unit
        mapStore.updateDistanceUnit(newProfile.display_distance);

        // Immediately update coordinate format and icon rotation to avoid requiring page reload
        mapStore.coordFormat = (newProfile.display_coordinate as CoordMode) || 'dd';
        mapStore.updateIconRotation(newProfile.display_icon_rotation as unknown as boolean);

        if (saveTimeout) clearTimeout(saveTimeout);
        saveTimeout = setTimeout(() => {
            savedKey.value = undefined;
        }, 2000);
    },
    { deep: true }
);
</script>

<style scoped>
.saved-indicator {
    top: 10px;
    right: 12px;
    z-index: 1;
}

.saved-fade-enter-active {
    transition: opacity 0.2s ease-in;
}

.saved-fade-leave-active {
    transition: opacity 1.4s ease-out;
}

.saved-fade-enter-from,
.saved-fade-leave-to {
    opacity: 0;
}

.saved-fade-enter-to,
.saved-fade-leave-from {
    opacity: 1;
}
</style>
