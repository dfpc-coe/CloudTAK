<template>
    <TablerLoading v-if='loading || !profile' />
    <template v-else>
        <div class='col-12'>
            <TablerInput
                v-model='profile.tak_callsign'
                :error='validateTextNotEmpty(profile.tak_callsign)'
                :required='true'
                label='User Callsign'
            />
        </div>
        <div class='col-12'>
            <TablerEnum
                v-model='profile.tak_group'
                label='User Group'
                :options='tak_groups'
            />
        </div>
        <div class='col-12'>
            <TablerEnum
                v-model='profile.tak_role'
                label='User Role'
                :options='roles'
            />
        </div>
        <div
            v-if='mode === "router"'
            class='col-12'
        >
            <TablerInput
                v-model='profile.tak_loc_freq'
                label='Location Reporting Frequency (ms)'
            />
        </div>
        <div class='col-12 py-2'>
            <label class='subheader mb-1'>Default Point Type</label>
            <div class='d-flex justify-content-center'>
                <CoordinateType
                    v-model='profile.tak_type'
                    :size='24'
                />
            </div>
        </div>
        <div class='col-12 d-flex py-3'>
            <div class='ms-auto'>
                <button
                    class='btn btn-primary'
                    :disabled='!!validateTextNotEmpty(profile.tak_callsign)'
                    @click='updateProfile'
                >
                    Update
                </button>
            </div>
        </div>
    </template>
</template>

<script setup lang='ts'>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import CoordinateType from './CoordinateType.vue';
import type { Profile } from '../../../../src/types.ts';
import Config from '../../../base/config.ts';
import type { FullConfig } from '../../../base/config.ts';
import {
    TablerInput,
    TablerEnum,
    TablerLoading
} from '@tak-ps/vue-tabler';
import { validateTextNotEmpty } from '../../../base/validators.ts';
import { useMapStore } from '../../../stores/map.ts';
import ProfileConfig from '../../../base/profile.ts';
const mapStore = useMapStore();

const props = defineProps({
    mode: {
        type: String,
        default: 'router'
    },
    forceCallsign: {
        type: Boolean,
        default: false
    }
})

const emit = defineEmits([ 'update' ]);

const loading = ref(true);
const profile = ref<Profile | undefined>();
const groups = ref<Record<string, string>>({});

const roles = ['Team Member', 'Team Lead', 'HQ', 'Sniper', 'Medic', 'Forward Observer', 'RTO', 'K9'];

const router = useRouter();

const tak_groups = computed(() => {
    const result = [];
    for (const g in groups.value) {
        if (groups.value[g]) {
            result.push(`${g} - ${groups.value[g]}`);
        } else {
            result.push(g);
        }
    }

    return result;
});

onMounted(async () => {
    loading.value = true;
    await fetchConfig();

    const p = {
        tak_callsign: (await ProfileConfig.get('tak_callsign'))?.value,
        tak_group: (await ProfileConfig.get('tak_group'))?.value,
        tak_role: (await ProfileConfig.get('tak_role'))?.value,
        tak_type: (await ProfileConfig.get('tak_type'))?.value,
        tak_loc_freq: (await ProfileConfig.get('tak_loc_freq'))?.value
    } as Profile;

    if (p.tak_group && groups.value[p.tak_group]) {
        // @ts-expect-error We expect an enum of Colors
        p.tak_group = `${p.tak_group} - ${groups.value[p.tak_group]}`;
    }

    if (props.forceCallsign) {
        p.tak_callsign = '';
    }

    profile.value = p;
    loading.value = false;
});

const groupKeys: (keyof FullConfig)[] = [
    'group::Yellow',
    'group::Cyan',
    'group::Green',
    'group::Red',
    'group::Purple',
    'group::Orange',
    'group::Blue',
    'group::Magenta',
    'group::White',
    'group::Maroon',
    'group::Dark Blue',
    'group::Teal',
    'group::Dark Green',
    'group::Brown',
];

async function fetchConfig() {
    const config = await Config.list(groupKeys);
    const result: Record<string, string> = {};
    for (const key of groupKeys) {
        const val = config[key];
        result[key.replace('group::', '')] = val ? String(val) : '';
    }
    groups.value = result;
}

async function updateProfile() {
    const p = JSON.parse(JSON.stringify(profile.value)) as Profile;

    p.tak_group = p.tak_group.replace(/\s-\s.*$/, '') as Profile["tak_group"];

    await mapStore.worker.profile.update({
        tak_callsign: p.tak_callsign,
        tak_type: p.tak_type,
        tak_role: p.tak_role,
        tak_group: p.tak_group.replace(/\s-\s.*$/, '') as Profile["tak_group"],
        tak_loc_freq: p.tak_loc_freq
    });

    mapStore.defaultPointType = p.tak_type || 'u-d-p';

    if (props.mode === 'router') {
        router.push("/menu/settings");
    } else {
        emit('update');
    }
}
</script>
