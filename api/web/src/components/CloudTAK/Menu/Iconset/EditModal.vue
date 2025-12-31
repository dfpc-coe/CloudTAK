<template>
    <TablerModal size='xl'>
        <div class='modal-status bg-red' />
        <button
            type='button'
            class='btn-close'
            aria-label='Close'
            @click='$emit("close")'
        />

        <div class='modal-header'>
            <div
                class='strong d-flex align-items-center'
                v-text='iconset.name || "Unnamed"'
            />
            <div class='ms-auto'>
                <TablerIconButton
                    v-if='route.params.iconset'
                    title='Regenerate Spritesheet'
                    @click='regen'
                >
                    <IconWand />
                </TablerIconButton>
            </div>
        </div>

        <TablerLoading
            v-if='loading.iconset'
            desc='Loading Iconset'
        />
        <div
            v-else
            class='mx-4 my-4'
        >
            <TablerSchema
                v-model='iconset'
                :schema='schema'
            />

            <div class='d-flex'>
                <div class='ms-auto'>
                    <div
                        class='btn btn-primary'
                        @click='submit'
                    >
                        Submit
                    </div>
                </div>
            </div>
        </div>
    </TablerModal>
</template>

<script setup>
import { useRoute } from 'vue-router'
import { ref, onMounted } from 'vue'
import { std, stdurl } from '../../../../std.ts';
import {
    TablerModal,
    TablerLoading,
    TablerSchema,
    TablerIconButton
} from '@tak-ps/vue-tabler';
import { IconWand } from '@tabler/icons-vue';

const emit = defineEmits([ 'close' ]);

const route = useRoute();
const loading = ref({
    iconset: true
});
const schema = ref({});
const iconset = ref({
    scope: 'user'
});

onMounted(async () => {
    await fetchSchema();

    if (route.params.iconset) {
        await fetch();
    } else {
        loading.value.iconset = false;
    }
});

async function fetch() {
    loading.value.iconset = true;
    iconset.value = await std(`/api/iconset/${route.params.iconset}`);
    loading.value.iconset = false;
}

async function submit() {
    const url = await stdurl(`/api/iconset/${route.params.iconset ||''}`);

    await std(url, {
        method: route.params.iconset ? 'PATCH' : 'POST',
        body: iconset.value
    });

    emit('close');
}

async function regen() {
    loading.value.iconset = true;
    await std(`/api/iconset/${route.params.iconset}/regen`, {
        method: 'POST'
    });
    loading.value.iconset = false;
}

async function fetchSchema() {
    const url = await stdurl(`/api/schema`);
    url.searchParams.append('method', route.params.iconset ? 'PATCH' : 'POST');
    url.searchParams.append('url', route.params.iconset ? '/iconset/:iconset' : '/iconset');
    schema.value = (await std(url)).body;
}
</script>
