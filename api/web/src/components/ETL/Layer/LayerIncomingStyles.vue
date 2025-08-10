<template>
    <div>
        <div class='card-header sticky-top'>
            <h3 class='card-title'>
                Style Overrides
            </h3>
            <div class='ms-auto btn-list'>
                <TablerIconButton
                    v-if='disabled'
                    title='Edit Style'
                    @click='disabled = false'
                >
                    <IconPencil
                        :size='32'
                        stroke='1'
                    />
                </TablerIconButton>
                <template v-else-if='!loading.save'>
                    <div class='btn-list d-flex align-items-center'>
                        <TablerToggle
                            v-model='enabled'
                            label='Styling Enabled'
                        />

                        <button
                            class='btn btn-primary btn-icon px-2'
                            @click='saveLayer'
                        >
                            <IconDeviceFloppy
                                v-tooltip='"Save Style"'
                                :size='32'
                                stroke='1'
                            />
                        </button>
                    </div>
                </template>
            </div>
        </div>

        <TablerAlert
            v-if='!props.capabilities'
            title='Missing Capabilities'
            :err='new Error("Layer failed to return an incoming input schema on the Capabilities object")'
        />
        <TablerLoading
            v-else-if='loading.save'
            desc='Saving Styles'
        />
        <TablerLoading
            v-else-if='loading.init'
            desc='Loading Styles'
        />
        <TablerNone
            v-else-if='!enabled'
            label='Style Overrides'
            :create='false'
        />
        <template v-else>
            <div class='card-body'>
                <StyleSingle
                    v-model='style'
                    :schema='capabilities.incoming.schema.output'
                    :disabled='disabled'
                />
            </div>

            <div class='col-12 d-flex align-items-center card-header'>
                <h3 class='card-title'>
                    Query Mode
                </h3>
                <div class='ms-auto btn-list'>
                    <button
                        class='btn'
                        @click='help("query")'
                    >
                        <IconHelp
                            v-tooltip='"JSONata Help"'
                            :size='32'
                            stroke='1'
                        />
                    </button>
                    <button
                        v-if='query !== null'
                        class='btn'
                        @click='query = null'
                    >
                        <IconX
                            v-tooltip='"Return to list"'
                            :size='32'
                            stroke='1'
                        />
                    </button>
                    <template v-if='!disabled'>
                        <button
                            v-if='query === null'
                            class='btn'
                            @click='newQuery'
                        >
                            <IconPlus
                                v-tooltip='"New Query"'
                                :size='32'
                                stroke='1'
                            />
                        </button>
                    </template>
                </div>
            </div>
            <template v-if='query === null && !queries.length'>
                <TablerNone
                    label='Queries'
                    :create='false'
                    @create='newQuery'
                />
            </template>
            <template v-if='query === null && queries'>
                <div
                    role='menu'
                    class='list-group list-group-flush px-2 py-2'
                >
                    <div
                        v-for='(q, q_idx) in queries'
                        :key='q_idx'
                        class='my-1'
                    >
                        <div
                            tabindex='0'
                            role='menuitem'
                            class='cursor-pointer hover list-group-item list-group-item-action'
                            @click='query = q_idx'
                        >
                            <div class='d-flex'>
                                <div
                                    class='align-self-center'
                                    v-text='q.query'
                                />
                                <div class='ms-auto'>
                                    <IconTrash
                                        v-if='!disabled'
                                        :size='32'
                                        stroke='1'
                                        @click.stop='queries.splice(q_idx, 1)'
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </template>
            <template v-else-if='query !== null'>
                <div class='card-body'>
                    <div class='col-md-12 hover rounded px-2 py-2'>
                        <TablerInput
                            v-model='queries[query].query'
                            :disabled='disabled'
                            placeholder='JSONata Query'
                            label='JSONata Query'
                            :error='error_query'
                        />
                    </div>

                    <div
                        class='px-2 py-2 round btn-group w-100'
                        role='group'
                    >
                        <input
                            id='query-style'
                            type='radio'
                            class='btn-check'
                            autocomplete='off'
                            :checked='!queries[query].delete'
                            :disabled='disabled'
                            @click='queries[query].delete = false'
                        >
                        <label
                            for='query-style'
                            type='button'
                            class='btn btn-sm'
                        >
                            <IconBrush
                                :size='32'
                                stroke='1'
                            />
                            <span class='mx-2'>Style Query</span>
                        </label>

                        <input
                            id='query-delete'
                            type='radio'
                            class='btn-check'
                            autocomplete='off'
                            :disabled='disabled'
                            :checked='queries[query].delete'
                            @click='queries[query].delete = true'
                        >
                        <label
                            for='query-delete'
                            type='button'
                            class='btn btn-sm'
                        >
                            <IconTrash
                                :size='32'
                                stroke='1'
                            />
                            <span class='mx-2'>Delete Features</span>
                        </label>
                    </div>

                    <template v-if='queries[query].delete'>
                        <div class='border rounded mx-2 d-flex justify-content-center'>
                            <div class='mx-2 my-2'>
                                <IconTrash
                                    size='24'
                                    :stroke='1'
                                />
                                All features matching this query will not be submitted to the TAK Server
                            </div>
                        </div>
                    </template>
                    <template v-else>
                        <StyleSingle
                            v-model='queries[query].styles'
                            :schema='capabilities.incoming.schema.output'
                            :disabled='disabled'
                        />
                    </template>
                </div>
            </template>
        </template>
    </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router'
import { std } from '../../../std.ts';
import {
    IconX,
    IconPlus,
    IconHelp,
    IconTrash,
    IconPencil,
    IconBrush,
    IconDeviceFloppy
} from '@tabler/icons-vue'
import jsonata from 'jsonata';
import {
    TablerAlert,
    TablerInput,
    TablerToggle,
    TablerNone,
    TablerLoading,
    TablerIconButton
} from '@tak-ps/vue-tabler';
import StyleSingle from './utils/StyleSingle.vue';

const props = defineProps({
    layer: {
        type: Object,
        required: true
    },
    capabilities: {
        type: Object,
        required: true
    }
});

const emit = defineEmits(['refresh']);

const route = useRoute();

const disabled = ref(true);
const loading = ref({
    init: true,
    save: false
});

const enabled = ref(props.layer.incoming.enabled_styles);

const style = ref({
    callsign: '',
    remarks: '',
    links: [],
});

const queries = ref([]);
const query = ref(null);

const error_query = computed(() => {
    if (!query.value) return '';

    try {
        jsonata(queries.value[query.value].query)
        return '';
    } catch (err) {
        return err.message;
    }
});

onMounted(() => {
    reload();
    loading.value.init = false;
});

function reload() {
    const clone = JSON.parse(JSON.stringify(props.layer.incoming.styles));
    queries.value = clone.queries || [];
    delete clone.queries;

    style.value = Object.assign(style.value, JSON.parse(JSON.stringify(props.layer.incoming.styles)));

    disabled.value = true;
}

function help(topic) {
    if (topic === "query") {
        window.open('http://docs.jsonata.org/simple', '_blank');
    }
}

function newQuery() {
    queries.value.push({
        query: '',
        styles: {}
    })

    query.value = queries.value.length - 1;
}

async function saveLayer() {
    loading.value.save = true;

    try {
        await std(`/api/connection/${route.params.connectionid}/layer/${route.params.layerid}/incoming`, {
            method: 'PATCH',
            body: {
                enabled_styles: enabled.value,
                styles: {
                    ...style.value,
                    queries: queries.value
                }
            }
        });

        disabled.value = true;
        loading.value.save = false;
        query.value = null;

        emit('refresh');
    } catch (err) {
        loading.value.save = false;
        throw err;
    }
}
</script>
