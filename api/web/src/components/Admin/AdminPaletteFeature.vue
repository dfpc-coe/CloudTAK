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
                    <IconCircleArrowLeft :size='32' stroke='1'/>
                </TablerIconButton>

                <span class='ms-2' v-text='palette.name + "&nbsp;-&nbsp;"' />
                <span v-text='route.params.feature === "new" ? "New Feature": paletteFeature.name' />
            </h1>

            <div class='ms-auto btn-list'>
                <TablerIconButton
                    v-if='disabled'
                    title='Add Palette Feature'
                    @click='router.push(`/admin/palette/${route.params.palette}/feature/new`)'
                >
                    <IconPlus
                        :size='32'
                        stroke='1'
                    />
                </TablerIconButton>
                <TablerDelete
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
                            :model-value='JSON.stringify(environment, null, 4)'
                            @update:model-value='environment = JSON.parse($event)'
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
import { ref, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import CopyField from '../CloudTAK/util/CopyField.vue';
import { std, stdurl, stdclick } from '../../../src/std.ts';
import type { Palette, PaletteFeature } from '../../../src/types.ts';
import {
    TablerNone,
    TablerInput,
    TablerEnum,
    TablerAlert,
    TablerDelete,
    TablerIconButton,
    TablerLoading
} from '@tak-ps/vue-tabler';
import {
    IconPlus,
    IconPencil,
    IconCircleArrowLeft,
} from '@tabler/icons-vue'

const route = useRoute();
const router = useRouter();

const error = ref<Error | undefined>();
const disabled = ref(true);
const loading = ref(true);

const palette = ref<Palette | undefined>();
const paletteFeature = ref<Palette>({
    uuid: crypto.randomUUID(),
    type: 'Point',
    name: '',
    created: new Date().toISOString(),
    updated: new Date().toISOString(),
    palette: route.params.palette,
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

function validateJSON(text) {
    try {
        JSON.parse(text);
    } catch (err) {
        return err instanceof Error ? err.message : String(err);
    }

    return true;
}

async function savePaletteFeature() {
    loading.value = true;

    try {
        if (route.params.feature === "new") {
            palette.value = await std(`/api/palette/${route.params.palette}/feature`, {
                method: 'POST',
                body: paletteFeature.value
            }) as PaletteFeature

            disabled.value = true;

            router.push(`/admin/palette/${route.params.palette}`);
        } else {
            palette.value = await std(`/api/palette/${route.params.palette}/feature/${route.params.feature}`, {
                method: 'PATCH',
                body: paletteFeature.value
            }) as PaletteFeature

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
        await std(`/api/palette/${route.params.palette}/feature/${route.params.feature}`, {
            method: 'DELETE'
        })

        router.push(`/admin/palette/${route.params.palette}`);
    } catch (err) {
        throw err;
    } finally {
        loading.value = false;
    }
}

async function fetchPalette() {
    try {
        palette.value = await std(`/api/palette/${route.params.palette}`) as PaletteList;
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
    }
}

async function fetchPaletteFeature() {
    try {
        paletteFeature.value = await std(`/api/palette/${route.params.palette}/feature/${route.params.feature}`) as PaletteFeature;
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
    }
}
</script>
