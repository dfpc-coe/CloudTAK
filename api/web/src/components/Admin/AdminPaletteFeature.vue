<template>
    <div>
        <div
            v-if='palette'
            class='card-header'
        >
            <h1 class='card-title'>
                <span v-text='palette.name' /> -
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
                            default='Point'
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
} from '@tabler/icons-vue'

const route = useRoute();
const router = useRouter();

const error = ref<Error | undefined>();
const disabled = ref(true);
const loading = ref(true);

const palette = ref<Palette | undefined>();
const paletteFeature = ref<Palette>({
    uuid: crypto.randomUUID(),
    name: '',
    created: new Date().toISOString(),
    updated: new Date().toISOString(),
    palette: route.params.palette,
    style: {}
});

onMounted(async () => {
    await fetchPalette();

    if (route.params.feature !== "new") {

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
                body: palette.value
            }) as PaletteFeature

            disabled.value = true;
            router.push(`/admin/palette/${palette.value.uuid}`);
        } else {
            palette.value = await std(`/api/palette/${route.params.palette}/feature/${route.params.feature}`, {
                method: 'PATCH',
                body: palette.value
            }) as PaletteFeature

            disabled.value = true;
        }
    } catch (err) {
        throw err;
    } finally {
        loading.value = false;
    }
}

async function deletePaletteFeature() {
    loading.value = true;

    try {
        await std(`/api/palette/${route.params.palette}`, {
            method: 'DELETE'
        })

        router.push('/admin/palette');
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
