<template>
    <div>
        <div class='card-header'>
            <h3 class='card-title'>
                Layer Config
            </h3>
            <div class='ms-auto btn-list'>
                <TablerIconButton
                    v-if='disabled'
                    title='Edit Layer Config'
                    @click='disabled = false'
                >
                    <IconPencil
                        :size='32'
                        stroke='1'
                    />
                </TablerIconButton>
            </div>
        </div>

        <TablerLoading
            v-if='loading.save'
            desc='Saving Config'
        />
        <TablerLoading
            v-else-if='loading.init'
            desc='Loading Config'
        />
        <div
            v-else
            class='card-body'
        >
            <div class='row g-2'>
                <div class='col-12 d-flex align-items-center'>
                    <label class='subheader'>Exclusion Filters</label>
                    <div class='ms-auto'>
                        <TablerIconButton
                            v-if='!disabled'
                            title='Add Filter'
                            @click='addFilter'
                        >
                            <IconPlus
                                :size='24'
                                stroke='1'
                            />
                        </TablerIconButton>
                    </div>
                </div>
                <div class='col-12 border rounded'>
                    <TablerNone
                        v-if='!outgoing.filters.queries || outgoing.filters.queries.length === 0'
                        label='Exclusion Filters'
                        :compact='true'
                        :create='false'
                    />
                    <template v-else>
                        <template
                            v-for='(filter, filter_idx) of outgoing.filters.queries'
                            :key='outgoing.filters.queries.length + "-" + filter_idx'
                        >
                            <div class='row mx-2 my-2'>
                                <TablerInput
                                    v-model='filter.query'
                                    label='Filter'
                                    :disabled='disabled'
                                >
                                    <TablerDelete
                                        v-if='!disabled'
                                        title='Delete Filter'
                                        :size='24'
                                        displaytype='icon'
                                        @delete='outgoing.filters.queries.splice(filter_idx, 1)'
                                    />
                                </TablerInput>
                            </div>
                        </template>
                    </template>
                </div>

                <div
                    v-if='!disabled'
                    class='col-12 pt-3 d-flex'
                >
                    <button
                        class='btn'
                        @click='reload'
                    >
                        Cancel
                    </button>
                    <div class='ms-auto'>
                        <button
                            class='btn btn-primary'
                            @click='saveOutgoing'
                        >
                            Save
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang='ts'>
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { std } from '../../../std.ts';
import type { ETLLayerOutgoing } from '../../../types.ts';
import {
    TablerIconButton,
    TablerLoading,
    TablerDelete,
    TablerInput,
    TablerNone
} from '@tak-ps/vue-tabler';
import {
    IconPlus,
    IconPencil,
} from '@tabler/icons-vue'

const props = defineProps({
    layer: {
        type: Object,
        required: true
    },
    capabilities: {
        type: Object,
        required: true
    }
})

const route = useRoute();
const emit = defineEmits([
    'refresh',
    'stack'
]);

const disabled = ref(true);

const loading = ref({
    init: true,
    save: false
});

const outgoing = ref<ETLLayerOutgoing>(props.layer.outgoing);

onMounted(() => {
    reload();
    loading.value.init = false;
})

function reload() {
    outgoing.value = props.layer.outgoing;
    disabled.value = true;
}

function addFilter() {
    if (!outgoing.value.filters.queries) outgoing.value.filters.queries = [];

    outgoing.value.filters.queries.push({
        query: ''
    })
}

async function saveOutgoing() {
    loading.value.save = true;

    try {
        await std(`/api/connection/${route.params.connectionid}/layer/${route.params.layerid}/outgoing`, {
            method: 'PATCH',
            body: outgoing.value
        });

        disabled.value = true;

        loading.value.save = false;

        emit('refresh');
        emit('stack');
    } catch (err) {
        loading.value.save = false;
        throw err;
    }
}
</script>
