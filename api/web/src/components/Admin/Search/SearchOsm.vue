<template>
    <SlideDownHeader
        v-model='isOpen'
        label='OpenStreetMap'
    >
        <template #icon>
            <IconMapPin
                :size='18'
                stroke='1'
                color='#6b7990'
                class='ms-2 me-1'
            />
        </template>
        <template #right>
            <SearchStatus
                class='me-2'
                :status='props.status'
            />
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
        <div class='col-lg-12 py-2 px-2'>
            <TablerLoading v-if='loading' />
            <template v-else>
                <TablerAlert
                    v-if='err'
                    :err='err'
                />
                <div class='row'>
                    <div class='col-lg-12'>
                        <TablerToggle
                            v-model='config["osm::enabled"]'
                            :disabled='!edit'
                            label='OpenStreetMap Search Enabled'
                            description='Forward & reverse geocoding via Photon'
                        />

                        <TablerInput
                            v-if='config["osm::enabled"]'
                            v-model='config["osm::url"]'
                            :disabled='!edit'
                            label='Photon URL'
                            description='The public photon.komoot.io instance is provided on a fair use basis and heavy use will be throttled - point this at a self-hosted Photon for production deployments'
                        />
                    </div>
                </div>
            </template>
        </div>
    </SlideDownHeader>
</template>

<script setup lang="ts">
import SlideDownHeader from '../../CloudTAK/util/SlideDownHeader.vue';
import SearchStatus from './SearchStatus.vue';
import type { SearchProviderStatus } from '../../../types.ts';
import { ref, watch, onMounted } from 'vue';
import { server } from '../../../std.ts';
import {
    TablerLoading,
    TablerInput,
    TablerToggle,
    TablerIconButton,
    TablerAlert
} from '@tak-ps/vue-tabler';
import {
    IconPencil,
    IconDeviceFloppy,
    IconX,
    IconMapPin
} from '@tabler/icons-vue';

interface OsmConfig {
    'osm::enabled': boolean;
    'osm::url': string;
}

const props = defineProps<{
    status?: SearchProviderStatus;
}>();

const isOpen = ref<boolean>(false);
const loading = ref<boolean>(false);
const edit = ref<boolean>(false);
const err = ref<Error | null>(null);

const config = ref<OsmConfig>({
    'osm::enabled': false,
    'osm::url': 'https://photon.komoot.io',
});

onMounted(() => {
    if (isOpen.value) void fetch();
});

watch(isOpen, (newState) => {
    if (newState && !edit.value) void fetch();
});

async function fetch(): Promise<void> {
    loading.value = true;
    err.value = null;
    try {
        const { data, error } = await server.GET('/api/config', {
            params: {
                query: {
                    keys: Object.keys(config.value).join(',')
                }
            }
        });
        if (error) throw new Error(error.message);

        config.value = {
            'osm::enabled': data['osm::enabled'] ?? false,
            'osm::url': data['osm::url'] ?? 'https://photon.komoot.io',
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
        edit.value = false;
    } catch (error) {
        err.value = error instanceof Error ? error : new Error(String(error));
        console.error('Failed to save OSM config:', error);
    }
    loading.value = false;
}
</script>
