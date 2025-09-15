<template>
    <div class='col-12 border rounded py-2 px-2'>
        <TablerAlert
            v-if='error'
            :err='error'
        />
        <TablerLoading v-else-if='loading.layer' />
        <template v-else>
            <div class='modal-body'>
                <TablerInput
                    v-model='layer.name'
                    label='Folder Name'
                    :autofocus='true'
                    @keyup.enter='createLayer'
                />

                <div class='col-12 pt-2 d-flex'>
                    <button
                        class='btn btn-secondary'
                        @click='emit("cancel")'
                    >
                        Cancel
                    </button>
                    <div class='ms-auto'>
                        <button
                            class='btn btn-primary'
                            @click='createLayer'
                        >
                            Create
                        </button>
                    </div>
                </div>
            </div>
        </template>
    </div>
</template>

<script setup lang='ts'>
import { ref } from 'vue';
import {
    TablerAlert,
    TablerInput,
    TablerLoading
} from '@tak-ps/vue-tabler';
import Subscription from '../../../../base/subscription.ts';
import type { Mission, MissionLayer_Create } from '../../../../types.ts';

const emit = defineEmits(['layer', 'cancel']);

const props = defineProps<{
    mission: Mission,
    token?: string,
}>();

const error = ref<Error | undefined>();
const loading = ref({
    layer: false,
});

const layer = ref<MissionLayer_Create>({
    name: '',
    type: 'GROUP'
});

async function createLayer() {
    try {
        loading.value.layer = true;

        const res = await Subscription.layerCreate(props.mission.guid, layer.value, {
            missionToken: props.token
        });

        emit('layer', res);
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
    }

    loading.value.layer = false;
}
</script>
