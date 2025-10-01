<template>
    <TablerModal>
        <button
            type='button'
            class='btn-close'
            aria-label='Close'
            @click='$emit("close")'
        />
        <div class='modal-status bg-yellow' />
        <div class='modal-body py-4'>
            <h3 class='subtitle-header'>
                Asset Transform:
            </h3>

            <TablerLoading
                v-if='loading'
                desc='Creating Transform Job'
            />
            <template v-else>
                <div class='modal-body'>
                    Submit the for conversion into a TAK &amp; Cloud Native Format
                </div>

                <div class='col-12 d-flex'>
                    <div class='ms-auto'>
                        <button
                            class='btn btn-primary'
                            @click='submit'
                        >
                            Submit
                        </button>
                    </div>
                </div>
            </template>
        </div>
    </TablerModal>
</template>

<script setup>
import { ref } from 'vue';
import { useRoute } from 'vue-router';
import { std } from '/src/std.ts';
import {
    TablerModal,
    TablerLoading,
} from '@tak-ps/vue-tabler';

const props = defineProps({
    asset: {
        type: Object,
        required: true
    }
});

const emit = defineEmits([
    'close',
    'done'
]);

const route = useRoute();
const loading = ref(false);

async function submit() {
    loading.value = true;
    await std(`/api/connection/${route.params.connectionid}/data/${route.params.dataid}/asset/${props.asset.name}`, {
        method: 'POST',
    });
    loading.value = false;
    emit('done');
    emit('close');
}
</script>
