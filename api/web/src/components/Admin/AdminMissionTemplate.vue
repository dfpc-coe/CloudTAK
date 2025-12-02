<template>
    <div>
        <div class='card-header'>
            <h1
                class='card-title'
            />

            <h1 class='card-title d-flex align-items-center'>
                <TablerIconButton
                    title='Back to List'
                    @click='router.push(`/admin/templates`)'
                >
                    <IconCircleArrowLeft
                        :size='32'
                        stroke='1'
                    />
                </TablerIconButton>


                <span
                    class='ms-2'
                    v-text='route.params.template === "new" ? "New Template": template.name'
                />
            </h1>

            <div class='ms-auto btn-list'>
                <TablerDelete
                    v-if='route.params.template !== "new" && disabled'
                    displaytype='icon'
                    @delete='deleteTemplate'
                />
                <TablerIconButton
                    v-if='disabled'
                    title='Edit Template'
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
                desc='Loading Template'
            />
            <TablerAlert
                v-else-if='error'
                :err='error'
            />
            <template v-else-if='!disabled'>
                <div class='row g-2'>
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
                        />
                    </div>
                    <div class='col-12'>
                        <UploadLogo
                            v-model='template.icon'
                            label='Template Logo'
                        />
                    </div>
                    <div class='col-12 d-flex'>
                        <div class='ms-auto'>
                            <button
                                class='btn btn-primary'
                                @click='saveTemplate'
                            >
                                Save
                            </button>
                        </div>
                    </div>
                </div>
            </template>
            <template v-else>
                <div class='d-flex'>
                    <div
                        v-if='template.icon'
                        class='me-4'
                    >
                        <img
                            :src='template.icon'
                            class='rounded border p-2 bg-white shadow-sm'
                            style='width: 128px; height: 128px; object-fit: contain;'
                        >
                    </div>
                    <div class='flex-fill'>
                        <label class='form-label'>Description</label>
                        <div class='text-muted'>
                            {{ template.description || 'No description provided.' }}
                        </div>
                    </div>
                </div>
            </template>
        </div>
    </div>
</template>

<script setup lang='ts'>
import { v4 as randomUUID } from 'uuid';
import { ref, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { std } from '../../../src/std.ts';
import type { MissionTemplate } from '../../../src/types.ts';
import {
    TablerInput,
    TablerAlert,
    TablerDelete,
    TablerIconButton,
    TablerLoading
} from '@tak-ps/vue-tabler';
import {
    IconCircleArrowLeft,
    IconPencil,
} from '@tabler/icons-vue'
import UploadLogo from '../util/UploadLogo.vue';

const route = useRoute();
const router = useRouter();

const error = ref<Error | undefined>();
const disabled = ref(true);
const loading = ref(true);

const template = ref<MissionTemplate>({
    id: randomUUID(),
    created: new Date().toISOString(),
    updated: new Date().toISOString(),
    name: '',
    icon: '',
    description: '',
});

onMounted(async () => {
    if (route.params.template !== "new") {
        await fetchTemplate();
    } else {
        disabled.value = false
        loading.value = false;
    }
});

async function saveTemplate() {
    loading.value = true;

    try {
        if (route.params.template === "new") {
            template.value = await std(`/api/template/mission`, {
                method: 'POST',
                body: template.value
            }) as MissionTemplate 

            disabled.value = true;
            router.push(`/admin/template/${template.value.id}`);
        } else {
            template.value = await std(`/api/template/mission/${route.params.template}`, {
                method: 'PATCH',
                body: template.value
            }) as MissionTemplate

            disabled.value = true;
        }
        loading.value = false;
    } catch (err) {
        loading.value = false;
        throw err;
    }
}

async function deleteTemplate() {
    loading.value = true;

    try {
        await std(`/api/template/mission/${route.params.template}`, {
            method: 'DELETE'
        })

        router.push('/admin/templates');
    } catch (err) {
        loading.value = false;
        throw err;
    }
}

async function fetchTemplate() {
    loading.value = true;
    try {
        template.value = await std(`/api/template/mission/${route.params.template}`) as MissionTemplate;
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
    } finally {
        loading.value = false;
    }
}
</script>
