<template>
    <div class='col-12 row g-0'>
        <div class='col-12'>
            <label class='subheader mx-2'>Magnetic Declination</label>
        </div>
        <TablerLoading
            v-if='loading'
            desc='Loading magnetic data...'
        />
        <TablerAlert
            v-else-if='error'
            :err='error'
        />
        <div
            v-else-if='magnetic'
            class='col-12 px-2 py-2 rounded'
            style='border: 1px solid var(--tblr-border-color);'
        >
            <div class='d-flex align-items-center justify-content-center py-3'>
                <div
                    class='position-relative d-flex justify-content-center align-items-center'
                    style='width: 100px; height: 100px;'
                >
                    <!-- True North -->
                    <div
                        class='position-absolute d-flex flex-column align-items-center'
                        style='height: 100%; top: 0;'
                    >
                        <div class='small font-weight-bold mb-1'>
                            TN
                        </div>
                        <div
                            style='width: 2px; height: 40px; background-color: currentColor;'
                            class='cloudtak-bg'
                        />
                        <div
                            style='width: 8px; height: 8px; border-radius: 50%;'
                            class='cloudtak-bg mt-auto mb-auto'
                        />
                        <div
                            style='width: 2px; height: 40px; background-color: currentColor;'
                            class='cloudtak-bg'
                        />
                    </div>

                    <!-- Magnetic North -->
                    <div
                        class='position-absolute d-flex flex-column align-items-center'
                        style='height: 100%; top: 0; transition: transform 0.3s ease;'
                        :style='{ transform: `rotate(${magnetic.declination}deg)` }'
                    >
                        <div class='small font-weight-bold text-red mb-1'>
                            MN
                        </div>
                        <div
                            style='width: 2px; height: 40px;'
                            class='bg-red'
                        />
                        <div
                            style='width: 8px; height: 8px; border-radius: 50%;'
                            class='bg-red mt-auto mb-auto'
                        />
                        <div
                            style='width: 2px; height: 40px;'
                            class='bg-red'
                        />
                    </div>
                </div>

                <div class='ms-4'>
                    <div class='h2 mb-0'>
                        {{ Math.abs(magnetic.declination).toFixed(1) }}° {{ magnetic.declination > 0 ? 'E' : 'W' }}
                    </div>
                    <div class='text-muted small'>
                        Inclination: {{ magnetic.inclination.toFixed(1) }}°
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang='ts'>
import { ref, onMounted } from 'vue';
import type { SearchReverseMagnetic } from '../../../types.ts';
import { server } from '../../../std.ts';
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
const magnetic = ref<SearchReverseMagnetic['magnetic'] | null>(null);

onMounted(async () => {
    try {
        const { data, error: reqError } = await server.GET('/api/search/reverse/{:longitude}/{:latitude}/magnetic', {
            params: {
                path: { ':longitude': props.longitude, ':latitude': props.latitude },
            },
        });

        if (reqError) throw new Error(String(reqError));
        magnetic.value = data.magnetic;
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
    } finally {
        loading.value = false;
    }
});
</script>
