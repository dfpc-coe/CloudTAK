<template>
    <div class='col-12 border rounded my-2'>
        <TablerAlert
            v-if='error'
            :err='error'
        />
        <TablerLoading v-else-if='loading.layer' />
        <template v-else>
            <div class='modal-body mx-2'>
                <TablerInput
                    v-model='editing.name'
                    label='Name'
                    @keyup.enter='editLayer'
                />

                <div class='col-12 d-flex py-3'>
                    <button
                        class='btn btn-secondary'
                        @click='emit("cancel")'
                    >
                        Cancel
                    </button>
                    <div class='ms-auto'>
                        <button
                            class='btn btn-primary'
                            @click='editLayer'
                        >
                            Save
                        </button>
                    </div>
                </div>
            </div>
        </template>
    </div>
</template>

<script setup lang='ts'>
import { ref } from 'vue'
import {
    TablerAlert,
    TablerInput,
    TablerLoading
} from '@tak-ps/vue-tabler';
import Subscription from '../../../../base/subscription.ts';
import type { MissionLayer } from '../../../../types.ts';

const emit = defineEmits(['layer', 'cancel']);
const props = defineProps<{
    subscription: Subscription,
    layer: MissionLayer,
}>();

const error = ref<Error | undefined>();
const loading = ref({
    layer: false,
});
const editing = ref<MissionLayer>(JSON.parse(JSON.stringify(props.layer)) as MissionLayer)

async function editLayer() {
    try {
        loading.value.layer = true;

        await props.subscription.layerUpdate(props.subscription.guid, props.layer.uid, {
            name: editing.value.name
        });

        emit('layer', {
            ...props.layer,
            name: editing.value.name,
        });
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
    }

    loading.value.layer = false;
}
</script>
