<template>
    <TablerModal size='xl'>
        <button
            type='button'
            class='btn-close'
            aria-label='Close'
            @click='$emit("close")'
        />
        <div class='modal-status bg-yellow' />
        <div class='modal-header'>
            <div class='modal-title'>
                ESRI Layer Filter
            </div>
        </div>
        <div class='modal-body row g-2'>
            <TablerInput
                v-model='filter.query'
                label='SQL Query'
                :disabled='disabled'
            />

            <div class='d-flex px-4'>
                <div class='ms-auto'>
                    <button
                        class='btn btn-secondary'
                        @click='fetch'
                    >
                        Test Query
                    </button>
                </div>
            </div>

            <TablerAlert
                v-if='err'
                :err='err'
                title='Query Error'
            />
            <TablerLoading
                v-if='loading.count'
                desc='Loading Features'
            />
            <template v-else-if='list.features.features'>
                <pre v-text='features' />
            </template>
        </div>
        <div class='modal-footer'>
            <button
                class='btn me-auto'
                @click='$emit("close")'
            >
                Close
            </button>
            <button
                class='btn btn-primary'
                @click='save'
            >
                Save Filter
            </button>
        </div>
    </TablerModal>
</template>

<script setup>
import { ref, computed } from 'vue';
import { std, stdurl } from '/src/std.ts';
import {
    TablerAlert,
    TablerModal,
    TablerInput,
    TablerLoading
} from '@tak-ps/vue-tabler';

const props = defineProps({
    disabled: {
        type: Boolean,
        default: false
    },
    modelValue: {
        type: String,
        default: ''
    },
    layer: {
        type: String
    },
    token: {
        type: String
    }
});

const emit = defineEmits([
    'close',
    'update:modelValue'
]);

const err = ref(null);
const loading = ref({
    count: false
});
const filter = ref({
    query: props.modelValue || ''
});
const list = ref({
    count: 0,
    features: {}
});

const features = computed(() => {
    return list.value.features.features.map((feat) => {
        return JSON.stringify(feat);
    }).join('\n');
});

function save() {
    emit('update:modelValue', filter.value.query);
    emit('close');
}

async function fetch() {
    err.value = false;
    loading.value.count = true;

    try {
        const url = stdurl('/api/esri/server/layer');
        url.searchParams.append('query', filter.value.query);
        url.searchParams.append('layer', props.layer);
        if (props.token) url.searchParams.append('token', props.token);

        list.value = await std(url, {
            method: 'GET',
            body: props.body
        });
    } catch (error) {
        err.value = error;
    }

    loading.value.count = false;
}
</script>
