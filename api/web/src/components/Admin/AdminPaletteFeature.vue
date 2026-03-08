<template>
    <div>
        <div
            v-if='palette'
            class='card-header'
        >
            <h1 class='card-title d-flex align-items-center'>
                <TablerIconButton
                    title='Back to Palette'
                    @click='router.push(`/admin/palette/${route.params.palette}`)'
                >
                    <IconCircleArrowLeft
                        :size='32'
                        stroke='1'
                    />
                </TablerIconButton>

                <span
                    class='ms-2'
                    v-text='palette.name + "&nbsp;-&nbsp;"'
                />
                <span v-text='route.params.feature === "new" ? "New Feature": paletteFeature.name' />
            </h1>

            <div class='ms-auto btn-list'>
                <TablerDelete
                    v-if='route.params.feature !== "new"'
                    displaytype='icon'
                    @delete='deletePaletteFeature'
                />
                <TablerIconButton
                    v-if='disabled'
                    title='Edit Palette'
                    @click='disabled = false'
                >
                    <IconPencil
                        :size='32'
                        stroke='1'
                    />
                </TablerIconButton>
            </div>
        </div>
        <div class='card-body'>
            <TablerLoading
                v-if='loading || !palette'
                desc='Loading Palette'
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
                            :disabled='disabled'
                        />
                    </div>
                    <div class='col-12'>
                        <TablerEnum
                            v-model='paletteFeature.type'
                            label='Type'
                            :disabled='disabled'
                            :options='[
                                "Point",
                                "LineString",
                                "Polygon"
                            ]'
                        />
                    </div>
                    <div class='col-12'>
                        <CopyField
                            :rows='20'
                            :edit='true'
                            :hover='true'
                            :validate='validateJSON'
                            :model-value='JSON.stringify(paletteFeature.style, null, 4)'
                            @update:model-value='paletteFeature.style = JSON.parse($event)'
                        />
                    </div>
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
import CopyField from '../CloudTAK/util/CopyField.vue';
import { server } from '../../../src/std.ts';
import type { Palette, PaletteFeature } from '../../types.ts';
import { validateJSON } from '../../base/validators.ts';
import {
    TablerInput,
    TablerEnum,
    TablerAlert,
    TablerDelete,
    TablerIconButton,
    TablerLoading
} from '@tak-ps/vue-tabler';
import {
    IconPencil,
    IconCircleArrowLeft,
} from '@tabler/icons-vue'

const route = useRoute();
const router = useRouter();

const error = ref<Error | undefined>();
const disabled = ref(true);
const loading = ref(true);

const palette = ref<Palette | undefined>();
const paletteFeature = ref<PaletteFeature>({
    uuid: randomUUID(),
    type: 'Point',
    name: '',
    created: new Date().toISOString(),
    updated: new Date().toISOString(),
    palette: String(route.params.palette),
    style: {}
});

onMounted(async () => {
    await fetchPalette();

    if (route.params.feature !== "new") {
        await fetchPaletteFeature();
        loading.value = false;
    } else {
        disabled.value = false
        loading.value = false;
    }
});

async function savePaletteFeature() {
    loading.value = true;

    try {
        if (route.params.feature === "new") {
            const res = await server.POST(`/api/palette/{:palette}/feature`, {
                params: {
                    path: {
                        ":palette": String(route.params.palette)
                    }
                },
                body: {
                    type: paletteFeature.value.type as "Point" | "LineString" | "Polygon",
                    name: paletteFeature.value.name,
                    style: paletteFeature.value.style as Record<string, unknown>
                }
            });

            if (res.error) {
                loading.value = false;
                error.value = new Error(res.error.message);
                return;
            }

            if (res.data) paletteFeature.value = res.data;

            disabled.value = true;

            router.push(`/admin/palette/${route.params.palette}`);
        } else {
            const res = await server.PATCH(`/api/palette/{:palette}/feature/{:feature}`, {
                params: {
                    path: {
                        ":palette": String(route.params.palette),
                        ":feature": String(route.params.feature)
                    }
                },
                body: {
                    type: paletteFeature.value.type as "Point" | "LineString" | "Polygon",
                    name: paletteFeature.value.name,
                    style: paletteFeature.value.style as Record<string, unknown>
                }
            });

            if (res.error) {
                loading.value = false;
                error.value = new Error(res.error.message);
                return;
            }

            if (res.data) paletteFeature.value = res.data;

            router.push(`/admin/palette/${route.params.palette}`);
        }
    } catch (err) {
        loading.value = false;
        throw err;
    }
}

async function deletePaletteFeature() {
    loading.value = true;

    try {
        const res = await server.DELETE(`/api/palette/{:palette}/feature/{:feature}`, {
            params: {
                path: {
                    ":palette": String(route.params.palette),
                    ":feature": String(route.params.feature)
                }
            }
        });

        if (res.error) {
            loading.value = false;
            error.value = new Error(res.error.message);
            return;
        }

        router.push(`/admin/palette/${route.params.palette}`);
    } catch (err) {
        loading.value = false;
        throw err;
    }
}

async function fetchPalette() {
    try {
        const res = await server.GET(`/api/palette/{:palette}`, {
            params: {
                path: {
                    ":palette": String(route.params.palette)
                }
            }
        });

        if (res.error) {
            error.value = new Error(res.error.message);
            return;
        }

        if (res.data) palette.value = res.data;
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
    }
}

async function fetchPaletteFeature() {
    try {
        const res = await server.GET(`/api/palette/{:palette}/feature/{:feature}`, {
            params: {
                path: {
                    ":palette": String(route.params.palette),
                    ":feature": String(route.params.feature)
                }
            }
        });

        if (res.error) {
            error.value = new Error(res.error.message);
            return;
        }

        if (res.data) paletteFeature.value = res.data;
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
    }
}
</script>
