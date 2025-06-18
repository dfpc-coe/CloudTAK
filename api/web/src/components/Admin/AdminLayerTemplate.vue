<template>
    <div>
        <div class='card-header'>
            <IconCircleArrowLeft
                :size='32'
                stroke='1'
                class='cursor-pointer'
                @click='$router.push("/admin/layer")'
            />
            <h1 class='mx-2 card-title d-flex align-items-center'>
                <div class='mx-2'>
                    Create Template Layer
                </div>
            </h1>
        </div>
        <div>
            <TablerLoading v-if='loading' />
            <div
                v-else
                class='card-body row g-2'
            >
                <div class='col-12'>
                    <TablerInput
                        v-model='template.name'
                        label='Layer Name'
                    />
                </div>
                <div class='col-12'>
                    <TablerInput
                        v-model='template.description'
                        label='Layer Name'
                        :rows='3'
                    />
                </div>
                <div class='col-12'>
                    <LayerSelect v-model='template.id' />
                </div>

                <div class='col-12 mt-2 d-flex align-items-center'>
                    <div class='ms-auto'>
                        <button
                            :disabled='!template.id'
                            class='btn btn-primary'
                            @click='createTemplate'
                        >
                            Submit
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router';
import { std } from '/src/std.ts';
import LayerSelect from '../util/LayerSelect.vue';
import {
    TablerInput,
    TablerLoading
} from '@tak-ps/vue-tabler';
import {
    IconCircleArrowLeft,
} from '@tabler/icons-vue'

const router = useRouter();
const loading = ref(false);
const template = ref({
    id: null,
    name: '',
    description: ''
});

async function createTemplate() {
    loading.value = true;

    try {
        const layer = await std('/api/template', {
            method: 'POST',
            body: template.value
        });

        router.push(`/admin/layer/${layer.id}`);
    } catch (err) {
        loading.value = false;
        throw err;
    }
}
</script>
