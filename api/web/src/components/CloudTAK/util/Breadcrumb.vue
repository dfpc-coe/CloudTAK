<template>
    <div class='col-12 px-2'>
        <TablerLoading
            v-if='loading'
            desc='Loading Breadcrumb'
        />
        <template v-else>
            <label class='subheader text-white'><IconRoute
                :size='24'
                stroke='1'
            />Breadcrumb Loader</label>

            <div class='border border-white rounded my-2 row g-2 px-2 py-2'>
                <div class='col-12'>
                    <TablerEnum
                        v-model='query.relative'
                        default='1 Hour'
                        :options='[
                            "1 Hour",
                            "4 Hours",
                            "8 Hours",
                            "24 Hours"
                        ]'
                    />
                </div>

                <div class='col-12'>
                    <TablerButton
                        class='btn-primary w-100'
                        @click.stop.prevent='loadBreadcrumb'
                    >
                        Submit
                    </TablerButton>
                </div>
            </div>
        </template>
    </div>
</template>

<script setup lang='ts'>
import { ref } from 'vue';
import { std, stdurl } from '../../../std.ts';
import type { FeatureCollection } from '../../../types.ts';
import {
    IconRoute
} from '@tabler/icons-vue';
import {
    TablerEnum,
    TablerButton,
    TablerLoading
} from '@tak-ps/vue-tabler';
import { useMapStore } from '../../../stores/map.ts';

const mapStore = useMapStore();

const props = defineProps<{
    uid: string
}>();

const query = ref({
    relative: '1 Hour'
});
const loading = ref(false);

async function loadBreadcrumb() {
    loading.value = true;

    try {
        const url = stdurl(`/api/marti/cot/${props.uid}/all`)

        url.searchParams.append('secago', String(60 * 60 * Number(query.value.relative.split(' ')[0])))
        url.searchParams.append('track', String(true))
        const crumb = await std(url) as FeatureCollection;

        for (const feat of crumb.features) {
            await mapStore.worker.db.add(feat)
        }

        loading.value = false;
    } catch (err) {
        loading.value = false;
        throw err;
    }
}
</script>
