<template>
    <div>
        <div class='card-header'>
            <h1 class='card-title d-flex align-items-center'>
                <TablerIconButton
                    title='Back to Template'
                    @click='router.push(`/admin/template/${route.params.template}`)'
                >
                    <IconCircleArrowLeft
                        :size='32'
                        stroke='1'
                    />
                </TablerIconButton>

                <span
                    class='ms-2'
                    v-text='route.params.feature === "new" ? "New Palette Feature" : paletteFeature.name'
                />
            </h1>

            <div class='ms-auto btn-list'>
                <TablerDelete
                    v-if='route.params.feature !== "new"'
                    displaytype='icon'
                    @delete='deletePaletteFeature'
                />
            </div>
        </div>
        <div class='card-body'>
            <TablerLoading
                v-if='loading'
                desc='Loading Palette Feature'
            />
            <TablerAlert
                v-else-if='error'
                :err='error'
            />
            <template v-else>
                <div class='row g-2'>
                    <div class='col-12'>
                        <TablerInput
                            v-model='paletteFeature.name'
                            label='Name'
                        />
                    </div>
                    <div class='col-12'>
                        <TablerEnum
                            v-model='paletteFeature.type'
                            label='Geometry Type'
                            :options='[
                                "Point",
                                "LineString",
                                "Polygon"
                            ]'
                        />
                    </div>
                    <PropertyStyle
                        :geometry='paletteFeature.type'
                        :model-value='paletteFeature.style'
                        @update:model-value='paletteFeature.style = $event'
                    />
                </div>

                <div class='col-12 d-flex pt-4'>
                    <div class='ms-auto'>
                        <button
                            class='btn btn-primary'
                            @click='savePaletteFeature'
                        >
                            Save
                        </button>
                    </div>
                </div>
            </template>
        </div>
    </div>
</template>

<script setup lang='ts'>
import { v4 as randomUUID } from 'uuid';
import { ref, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { server } from '../../../src/std.ts';
import type { PaletteFeature } from '../../types.ts';
import PropertyStyle from '../CloudTAK/Property/PropertyStyle.vue';
import {
    TablerInput,
    TablerEnum,
    TablerAlert,
    TablerDelete,
    TablerIconButton,
    TablerLoading
} from '@tak-ps/vue-tabler';
import {
    IconCircleArrowLeft,
} from '@tabler/icons-vue'

const route = useRoute();
const router = useRouter();

const error = ref<Error | undefined>();
const loading = ref(true);

const paletteFeature = ref<PaletteFeature>({
    uuid: randomUUID(),
    type: 'Point',
    name: '',
    created: new Date().toISOString(),
    updated: new Date().toISOString(),
    template: String(route.params.template),
    style: {}
});

onMounted(async () => {
    if (route.params.feature !== "new") {
        await fetchPaletteFeature();
    }

    loading.value = false;
});

async function savePaletteFeature() {
    loading.value = true;

    try {
        if (route.params.feature === "new") {
            const res = await server.POST(`/api/template/mission/{:mission}/palette`, {
                params: { path: { ':mission': String(route.params.template) } },
                body: {
                    type: paletteFeature.value.type as "Point" | "LineString" | "Polygon",
                    name: paletteFeature.value.name,
                    style: paletteFeature.value.style as unknown as Record<string, string>
                }
            });

            if (res.error) throw new Error(res.error.message);
            paletteFeature.value = res.data as PaletteFeature;
        } else {
            const res = await server.PATCH(`/api/template/mission/{:mission}/palette/{:feature}`, {
                params: { path: { ':mission': String(route.params.template), ':feature': String(route.params.feature) } },
                body: {
                    type: paletteFeature.value.type as "Point" | "LineString" | "Polygon",
                    name: paletteFeature.value.name,
                    style: paletteFeature.value.style as unknown as Record<string, string>
                }
            });

            if (res.error) throw new Error(res.error.message);
            paletteFeature.value = res.data as PaletteFeature;
        }

        router.push(`/admin/template/${route.params.template}`);
    } catch (err) {
        loading.value = false;
        throw err;
    }
}

async function deletePaletteFeature() {
    loading.value = true;

    try {
        const res = await server.DELETE(`/api/template/mission/{:mission}/palette/{:feature}`, {
            params: { path: { ':mission': String(route.params.template), ':feature': String(route.params.feature) } }
        });

        if (res.error) throw new Error(res.error.message);
        router.push(`/admin/template/${route.params.template}`);
    } catch (err) {
        loading.value = false;
        throw err;
    }
}

async function fetchPaletteFeature() {
    try {
        const res = await server.GET(`/api/template/mission/{:mission}/palette/{:feature}`, {
            params: { path: { ':mission': String(route.params.template), ':feature': String(route.params.feature) } }
        });

        if (res.error) throw new Error(res.error.message);
        paletteFeature.value = res.data as PaletteFeature;
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
    }
}
</script>
