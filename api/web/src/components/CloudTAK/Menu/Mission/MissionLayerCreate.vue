<template>
    <div class='col-12 border rounded my-2'>
        <TablerAlert
            v-if='error'
            :err='error'
        />
        <TablerLoading v-else-if='loading.layer' />
        <template v-else>
            <div class='modal-body row g-2'>
                <TablerInput
                    v-model='layer.name'
                    label='Name'
                    @keyup.enter='createLayer'
                />

                <label
                    class='subheader mt-3 cursor-pointer'
                    @click='advanced = !advanced'
                >
                    <IconSquareChevronRight
                        v-if='!advanced'
                        :size='32'
                        stroke='1'
                    />
                    <IconChevronDown
                        v-else
                        :size='32'
                        stroke='1'
                    />
                    Advanced Options
                </label>

                <div
                    v-if='advanced'
                    class='col-12'
                >
                    <div class='row g-2'>
                        <div class='col-12'>
                            <TablerEnum
                                v-model='layer.type'
                                label='Layer Type'
                                :options='["GROUP", "UID", "CONTENTS", "MAPLAYER", "ITEM"]'
                            />
                        </div>
                    </div>
                </div>

                <div class='col-12 d-flex'>
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
                            Create Layer
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
    IconSquareChevronRight,
    IconChevronDown,
} from '@tabler/icons-vue';
import {
    TablerAlert,
    TablerInput,
    TablerEnum,
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

const advanced = ref(false);
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
