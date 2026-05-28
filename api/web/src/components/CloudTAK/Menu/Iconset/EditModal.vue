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

<script setup lang="ts">
import { useRoute } from 'vue-router'
import { ref, onMounted } from 'vue'
import { server } from '../../../../std.ts';
import type { Iconset } from '../../../../types.ts';
import IconsetManager from '../../../../base/iconset.ts';
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
const schema = ref<Record<string, unknown>>({});
type SchemaResponse = { body?: Record<string, unknown> };

const iconset = ref<Partial<Iconset> & {
    scope?: 'server' | 'user';
    name?: string;
    internal?: boolean;
    public?: boolean;
}>({
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
    iconset.value = await IconsetManager.get(String(route.params.iconset));
    loading.value.iconset = false;
}

async function submit() {
    if (route.params.iconset) {
        await IconsetManager.update(String(route.params.iconset), {
            ...(iconset.value.public !== undefined ? { public: iconset.value.public } : {}),
            ...(iconset.value.default_group ? { default_group: iconset.value.default_group } : {}),
            ...(iconset.value.default_friendly ? { default_friendly: iconset.value.default_friendly } : {}),
            ...(iconset.value.default_hostile ? { default_hostile: iconset.value.default_hostile } : {}),
            ...(iconset.value.default_neutral ? { default_neutral: iconset.value.default_neutral } : {}),
            ...(iconset.value.default_unknown ? { default_unknown: iconset.value.default_unknown } : {}),
            ...(iconset.value.skip_resize !== undefined ? { skip_resize: iconset.value.skip_resize } : {}),
        });
    } else {
        if (!iconset.value.uid || iconset.value.version === undefined || !iconset.value.name || iconset.value.internal === undefined) {
            throw new Error('Iconset form is incomplete');
        }

        await IconsetManager.create({
            uid: iconset.value.uid,
            version: iconset.value.version,
            name: iconset.value.name,
            internal: iconset.value.internal,
            ...(iconset.value.scope ? { scope: iconset.value.scope } : {}),
            ...(iconset.value.default_group ? { default_group: iconset.value.default_group } : {}),
            ...(iconset.value.default_friendly ? { default_friendly: iconset.value.default_friendly } : {}),
            ...(iconset.value.default_hostile ? { default_hostile: iconset.value.default_hostile } : {}),
            ...(iconset.value.default_neutral ? { default_neutral: iconset.value.default_neutral } : {}),
            ...(iconset.value.default_unknown ? { default_unknown: iconset.value.default_unknown } : {}),
            ...(iconset.value.skip_resize !== undefined ? { skip_resize: iconset.value.skip_resize } : {}),
        });
    }

    emit('close');
}

async function regen() {
    loading.value.iconset = true;
    await IconsetManager.regenerate(String(route.params.iconset));
    loading.value.iconset = false;
}

async function fetchSchema() {
    const res = await server.GET('/api/schema', {
        params: {
            query: {
                method: route.params.iconset ? 'PATCH' : 'POST',
                url: route.params.iconset ? '/iconset/:iconset' : '/iconset',
            }
        }
    });

    if (res.error) throw new Error(res.error.message);

    schema.value = ((res.data as SchemaResponse).body) ?? {};
}
</script>
