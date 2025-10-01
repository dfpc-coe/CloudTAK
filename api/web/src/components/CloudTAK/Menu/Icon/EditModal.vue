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
                v-text='editing.name || "Unnamed"'
            />
        </div>

        <TablerLoading
            v-if='loading.icon'
            desc='Loading Icon'
        />
        <div
            v-else
            class='mx-4 my-4'
        >
            <TablerSchema
                v-model='editing'
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
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { std, stdurl } from '/src/std.ts';
import {
    TablerModal,
    TablerLoading,
    TablerSchema
} from '@tak-ps/vue-tabler';

const props = defineProps({
    icon: {
        type: Object,
        required: true
    }
});

const emit = defineEmits([
    'close'
]);

const route = useRoute();

const loading = ref({
    icon: true
});
const schema = ref({});
const editing = ref({});

onMounted(async () => {
    await fetchSchema();

    if (route.params.icon) {
        await fetch();
    } else {
        loading.value.icon = false;
    }
});

async function fetch() {
    loading.value.icon = true;
    editing.value = await std(`/api/iconset/${route.params.iconset}/icon/${encodeURIComponent(props.icon.name)}`);
    loading.value.icon = false;
}

async function submit() {
    const url = await stdurl(`/api/iconset/${route.params.iconset}/icon/${props.icon.id ? encodeURIComponent(props.icon.name) : ''}`);

    await std(url, {
        method: props.icon.id ? 'PATCH' : 'POST',
        body: editing.value
    });

    emit('close')
}

async function fetchSchema() {
    const url = await stdurl(`/api/schema`);
    url.searchParams.append('method', props.icon.id ? 'PATCH' : 'POST');
    url.searchParams.append('url', props.icon.id ? '/iconset/:iconset/icon/:icon' : '/iconset/:iconset/icon');
    schema.value = (await std(url)).body;
}
</script>
