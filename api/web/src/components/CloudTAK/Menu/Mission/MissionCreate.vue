<template>
    <div class='col-12'>
        <div class='modal-header'>
            <div class='row'>
                <div class='col-auto'>
                    <IconLock
                        v-if='mission.passwordProtected'
                        :size='32'
                        stroke='1'
                    />
                    <IconLockOpen
                        v-else
                        :size='32'
                        stroke='1'
                    />
                </div>
                <div class='col-auto row'>
                    <div class='col-12'>
                        <span>Create Mission</span>
                    </div>
                </div>
            </div>
        </div>
        <TablerLoading
            v-if='loading'
            desc='Saving Mission'
        />
        <template v-else>
            <div class='modal-body row g-2'>
                <div class='col-12'>
                    <TablerInput
                        v-model='mission.name'
                        :error='missionNameValidity'
                        label='Name'
                    />
                </div>

                <div
                    v-if='templates.length || templatesLoading'
                    class='col-12'
                >
                    <div class='d-flex align-items-center mb-2'>
                        <label class='subheader my-0'>Templates</label>
                        <div class='ms-auto'>
                            <TablerIconButton
                                v-if='!showSearch'
                                title='Search Templates'
                                @click='showSearch = true'
                            >
                                <IconSearch
                                    :size='20'
                                    stroke='1'
                                />
                            </TablerIconButton>
                            <TablerIconButton
                                v-else
                                title='Close Search'
                                @click='showSearch = false; templatesPaging.filter = "";'
                            >
                                <IconX
                                    :size='20'
                                    stroke='1'
                                />
                            </TablerIconButton>
                        </div>
                    </div>

                    <div
                        v-if='showSearch'
                        class='mb-2'
                    >
                        <TablerInput
                            v-model='templatesPaging.filter'
                            placeholder='Search Templates...'
                            :autofocus='true'
                        />
                    </div>

                    <TablerLoading
                        v-if='templatesLoading'
                        desc='Loading Templates'
                    />
                    <div
                        v-else-if='templates.length'
                        class='row g-2'
                    >
                        <div
                            v-for='template in templates'
                            :key='template.id'
                            class='col-3'
                            @click='selectedTemplate = template.id'
                        >
                            <div
                                class='card p-2 text-center cursor-pointer h-100 d-flex flex-column align-items-center justify-content-center'
                                :class='{ "bg-primary-lt": selectedTemplate === template.id }'
                            >
                                <img
                                    v-if='template.icon'
                                    :src='template.icon'
                                    class='mb-2'
                                    style='height: 32px; width: 32px; object-fit: contain;'
                                    :style='template.icon.includes("image/svg+xml") ? "filter: brightness(0) invert(1);" : ""'
                                >
                                <IconLayout
                                    v-else
                                    :size='32'
                                    stroke='1'
                                    class='mb-2'
                                />
                                <div class='small lh-1'>
                                    {{ template.name }}
                                </div>
                            </div>
                        </div>
                    </div>
                    <div
                        v-else
                        class='text-center fst-italic text-muted'
                    >
                        No Templates Found
                    </div>
                </div>

                <div class='col-12'>
                    <TablerInput
                        v-model='mission.description'
                        label='Description'
                    />
                </div>

                <div class='col-12'>
                    <label class='px-2 w-100'>Channels</label>

                    <GroupSelect
                        v-model='mission.groups'
                        :active='true'
                        direction='IN'
                    />
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
                        <div class='col-12'>
                            <label class='px-2 w-100'>Keywords</label>
                            <TagEntry
                                placeholder='Enter Keywords'
                                @tags='mission.keywords = $event'
                            />
                        </div>

                        <div class='col-12'>
                            <TablerToggle
                                v-model='mission.passwordProtected'
                                label='Password Protected'
                            />
                            <TablerInput
                                v-if='mission.passwordProtected'
                                v-model='mission.password'
                                :disabled='!mission.passwordProtected'
                                type='password'
                                label='Password'
                            />
                        </div>

                        <div class='col-12'>
                            <TablerEnum
                                v-model='mission.role'
                                label='Default Role'
                                :options='["Read-Only", "Subscriber", "Owner"]'
                            />
                        </div>
                    </div>
                </div>

                <div class='col-12 d-flex'>
                    <div class='ms-auto'>
                        <button
                            class='btn btn-primary'
                            @click='createMission'
                        >
                            Create Mission
                        </button>
                    </div>
                </div>
            </div>
        </template>
    </div>
</template>

<script setup lang='ts'>
import { ref, computed, watch, onMounted } from 'vue';
import { server } from '../../../../std.ts';
import type { Mission_Create, MissionTemplate } from '../../../../types.ts';
import { useMapStore } from '../../../../stores/map.ts'
import {
    IconLock,
    IconLockOpen,
    IconSquareChevronRight,
    IconChevronDown,
    IconSearch,
    IconX,
    IconLayout
} from '@tabler/icons-vue';
import GroupSelect from '../../util/GroupSelect.vue';
import TagEntry from '../../util/TagEntry.vue';
import Overlay from '../../../../base/overlay.ts';
import {
    TablerInput,
    TablerEnum,
    TablerToggle,
    TablerLoading,
    TablerIconButton
} from '@tak-ps/vue-tabler';

const mapStore = useMapStore();
const emit = defineEmits(['mission']);

const attempted = ref(false);
const loading = ref(false);
const advanced = ref(false);

const templates = ref<MissionTemplate[]>([]);
const templatesLoading = ref(false);
const showSearch = ref(false);

const templatesPaging = ref({
    filter: ''
});

const selectedTemplate = ref<string | null>(null);

const mission = ref({
    name: '',
    password: '',
    passwordProtected: false,
    role: 'Subscriber',
    description: '',
    groups: [],
    keywords: [],
    hashtags: ''
});

watch(templatesPaging, async () => {
    await listTemplates();
}, { deep: true });

onMounted(async () => {
    await listTemplates();
});

async function listTemplates() {
    templatesLoading.value = true;

    const res = await server.GET('/api/template/mission', {
        params: {
            query: {
                limit: 10,
                sort: 'created',
                page: 0,
                order: 'desc',
                filter: templatesPaging.value.filter || ''
            }
        }
    })

    if (res.error) throw new Error(res.error.message);

    if (!res.data.items.length && !templatesPaging.value.filter) {
        templates.value = [];
    } else {
        templates.value = [{
            id: 'default',
            name: 'Default',
            icon: '',
            description: '',
            created: '',
            updated: ''
        }, ...res.data.items];

        if (!selectedTemplate.value) selectedTemplate.value = 'default';
    }
    templatesLoading.value = false;
}

const missionNameValidity = computed<string>(() => {
    // eslint-disable-next-line no-useless-escape
    if (!mission.value.name.match(/^[\p{L}\p{N}\w\d\s\.\(\)!=@#$&^*_\-\+\[\]\{\}:,\.\/\|\\]*$/u)) {
        return 'Contains Invalid Character'
    } else if (mission.value.name.length > 1024) {
        return 'Exceeds 1024 Characters'
    } else if (attempted.value && mission.value.name.length === 0) {
        return 'Cannot be empty'
    }

    return '';
});

async function createMission() {
    attempted.value = true;

    if (missionNameValidity.value) return;

    loading.value = true;
    try {
        loading.value = true;

        const body: Mission_Create = {
            name: mission.value.name,
            group: mission.value.groups,
            description: mission.value.description || '',
            keywords: mission.value.keywords || []
        };

        if (mission.value.role === 'Subscriber') body.defaultRole = 'MISSION_SUBSCRIBER';
        if (mission.value.role === 'Read-Only') body.defaultRole = 'MISSION_READONLY_SUBSCRIBER';
        if (mission.value.role === 'Owner') body.defaultRole = 'MISSION_OWNER';

        if (mission.value.passwordProtected) body.password = mission.value.password;

        if (selectedTemplate.value !== 'default') {
            if (!body.keywords) body.keywords = [];
            body.keywords.push(`template:${selectedTemplate.value}`);
        }

        const res = await server.POST('/api/marti/mission', {
            body
        });

        if (res.error) throw new Error(res.error.message);

        const missionOverlay = await Overlay.create({
            name: res.data.name,
            url: `/mission/${encodeURIComponent(res.data.name)}`,
            type: 'geojson',
            mode: 'mission',
            token: res.data.token,
            mode_id: res.data.guid,
        })

        mapStore.overlays.push(missionOverlay);

        await mapStore.loadMission(res.data.guid);

        emit('mission', res.data);

        loading.value = false;
    } catch (err) {
        loading.value = false;
        throw err;
    }
}
</script>
