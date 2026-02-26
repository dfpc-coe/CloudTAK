<template>
    <div class='card'>
        <div class='card-header d-flex align-items-center'>
            <IconRoute
                :size='20'
                stroke='1'
                class='me-2'
            />
            <h3 class='card-title mb-0'>
                Breadcrumb
            </h3>
        </div>

        <div class='card-body p-0'>
            <!-- Live Breadcrumb -->
            <div class='px-3 py-2 d-flex align-items-center justify-content-between'>
                <div class='d-flex align-items-center'>
                    <IconRadar
                        :size='18'
                        stroke='1'
                        class='me-2 text-muted'
                    />
                    <span class='text-body'>Live Trail</span>
                </div>
                <TablerToggle
                    v-model='liveEnabled'
                    @update:model-value='onLiveToggle'
                />
            </div>

            <div class='dropdown-divider my-0' />

            <!-- Historical Loader -->
            <TablerLoading
                v-if='loading'
                desc='Loading…'
                :inline='true'
            />
            <template v-else>
                <div class='px-3 pt-2 pb-1 d-flex align-items-center'>
                    <IconHistory
                        :size='18'
                        stroke='1'
                        class='me-2 text-muted'
                    />
                    <span class='text-body'>Load History</span>
                </div>

                <div class='px-3 pb-2'>
                    <TablerEnum
                        v-model='query.relative'
                        :options='["1 Hour", "4 Hours", "8 Hours", "24 Hours"]'
                    />
                </div>

                <div class='px-3 pb-3'>
                    <TablerButton
                        class='btn-primary w-100'
                        @click.stop.prevent='loadBreadcrumb'
                    >
                        Load
                    </TablerButton>
                </div>
            </template>
        </div>
    </div>
</template>

<script setup lang='ts'>
import { ref, onMounted } from 'vue';
import { server } from '../../../std.ts';
import {
    IconRoute,
    IconRadar,
    IconHistory,
} from '@tabler/icons-vue';
import {
    TablerEnum,
    TablerButton,
    TablerLoading,
    TablerToggle
} from '@tak-ps/vue-tabler';
import { useMapStore } from '../../../stores/map.ts';

const mapStore = useMapStore();

const props = defineProps<{
    uid: string
}>();

const emit = defineEmits<{
    live: [enabled: boolean]
}>();

const query = ref({
    relative: '1 Hour'
});
const loading = ref(false);
const liveEnabled = ref(false);

onMounted(async () => {
    liveEnabled.value = await mapStore.worker.db.breadcrumb.get(props.uid);
});

async function onLiveToggle(enabled: boolean): Promise<void> {
    await mapStore.worker.db.breadcrumb.set(props.uid, enabled);
    emit('live', enabled);
}

async function loadBreadcrumb() {
    loading.value = true;

    try {
        const { data: crumb, error } = await server.GET('/api/marti/cot/{:uid}/all', {
            params: {
                path: {
                    ':uid': props.uid
                },
                query: {
                    secago: String(60 * 60 * Number(query.value.relative.split(' ')[0])),
                    track: true
                }
            }
        });
        if (error || !crumb) throw new Error(String(error || 'No data'));

        for (const feat of crumb.features) {
            if (feat.geometry.type === 'LineString' && String(feat.id).endsWith('-track')) {
                // Merge the historical track into the live breadcrumb trail (or seed it)
                await mapStore.worker.db.breadcrumb.merge(
                    props.uid,
                    feat.geometry.coordinates as number[][]
                );
            } else {
                // @ts-expect-error Feature types are slightly incompatible
                await mapStore.worker.db.add(feat);
            }
        }

        loading.value = false;
    } catch (err) {
        loading.value = false;
        throw err;
    }
}
</script>
