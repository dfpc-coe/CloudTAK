<template>
    <div>
        <div class='card-header'>
            <h1
                class='card-title'
                v-text='route.params.palette === "new" ? "New Palette": palette.name'
            />

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
                    @delete='deletePalette'
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
                v-if='loading'
                desc='Loading Palette'
            />
            <TablerAlert
                v-else-if='error'
                :err='error'
            />
            <template v-else-if='!disabled'>
                <div class='row g-2'>
                    <div class='col-12'>
                        <TablerInput
                            v-model='palette.name'
                            label='Name'
                        />
                    </div>
                    <div class='col-12 d-flex'>
                        <div class='ms-auto'>
                            <button
                                class='btn btn-primary'
                                @click='savePalette'
                            >
                                Save
                            </button>
                        </div>
                    </div>
                </div>
            </template>
            <template v-else>
                <TablerNone
                    v-if='!palette.features.length'
                    label='Palette Features'
                    :create='false'
                />
            </template>
        </div>
    </div>
</template>

<script setup lang='ts'>
import { ref, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { std } from '../../../src/std.ts';
import type { Palette } from '../../../src/types.ts';
import {
    TablerNone,
    TablerInput,
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

const palette = ref<Palette>({
    uuid: crypto.randomUUID(),
    name: '',
    features: []
});

onMounted(async () => {
    if (route.params.palette !== "new") {
        await fetchPalette();
    } else {
        disabled.value = false
        loading.value = false;
    }
});

async function savePalette() {
    loading.value = true;

    try {
        if (route.params.palette === "new") {
            palette.value = await std(`/api/palette`, {
                method: 'POST',
                body: palette.value
            }) as Palette

            disabled.value = true;
            router.push(`/admin/palette/${palette.value.uuid}`);
        } else {
            palette.value = await std(`/api/palette/${route.params.palette}`, {
                method: 'PATCH',
                body: palette.value
            }) as Palette

            disabled.value = true;
        }
        loading.value = false;
    } catch (err) {
        loading.value = false;
        throw err;
    }
}

async function deletePalette() {
    loading.value = true;

    try {
        await std(`/api/palette/${route.params.palette}`, {
            method: 'DELETE'
        })

        router.push('/admin/palette');
    } catch (err) {
        loading.value = false;
        throw err;
    }
}

async function fetchPalette() {
    loading.value = true;
    try {
        palette.value = await std(`/api/palette/${route.params.palette}`) as PaletteList;
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
    } finally {
        loading.value = false;
    }
}
</script>
