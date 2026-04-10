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
                        label='Name'
                    />
                </div>
                <div class='col-12'>
                    <TablerInput
                        v-model='template.description'
                        label='Description'
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

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router';
import { server } from '../../../src/std.ts';
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
const template = ref<{ id: number | undefined; name: string; description: string }>({
    id: undefined,
    name: '',
    description: ''
});

async function createTemplate() {
    loading.value = true;

    try {
        const layer = await server.POST('/api/template', {
            body: {
                id: template.value.id || 0,
                name: template.value.name,
                description: template.value.description
            }
        });

        if (layer.error) {
            throw new Error(layer.error.message);
        }

        if (layer.data) router.push(`/admin/layer/${layer.data.id}`);
    } finally {
        loading.value = false;
    }
}
</script>
