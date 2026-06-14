<template>
    <div class='col-12 row g-0'>
        <div class='col-12'>
            <label class='subheader mx-2'>Location</label>
        </div>
        <TablerLoading
            v-if='loading'
            desc='Loading location...'
        />
        <TablerAlert
            v-else-if='error'
            :err='error'
        />
        <div
            v-else-if='reverse'
            class='col-12 d-flex align-items-center py-2 px-2 rounded'
            style='border: 1px solid var(--tblr-border-color);'
        >
            <IconMapPin
                size='32'
                stroke='1'
            />

            <div class='mx-2'>
                <div
                    class='h3 mb-0'
                    v-text='reverse.ShortLabel'
                />
                <div
                    class='text-muted small'
                    v-text='reverse.LongLabel.replace(new RegExp(`^.*${reverse.ShortLabel}, `), "")'
                />
            </div>
        </div>
        <div
            v-else
            class='col-12 d-flex py-2 px-2'
        >
            <div
                class='mx-2'
                style='font-size: 20px;'
            >
                No Features Found
            </div>
        </div>
    </div>
</template>

<script setup lang='ts'>
import { ref, onMounted } from 'vue';
import type { SearchReverseReverse } from '../../../types.ts';
import { server } from '../../../std.ts';
import {
    IconMapPin
} from '@tabler/icons-vue';
import {
    TablerLoading,
    TablerAlert
} from '@tak-ps/vue-tabler';

const props = defineProps<{
    longitude: number;
    latitude: number;
}>();

const loading = ref(true);
const error = ref<Error | undefined>();
const reverse = ref<SearchReverseReverse['reverse']>(null);

onMounted(async () => {
    try {
        const { data, error: reqError } = await server.GET('/api/search/reverse/{:longitude}/{:latitude}/reverse', {
            params: {
                path: { ':longitude': props.longitude, ':latitude': props.latitude },
                query: {},
            },
        });

        if (reqError) throw new Error(String(reqError));
        reverse.value = data.reverse;
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
    } finally {
        loading.value = false;
    }
});
</script>
