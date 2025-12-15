<template>
    <div class='w-100'>
        <TablerLoading
            v-if='loading'
            :inline='true'
        />
        <template v-else>
            <div class='d-flex align-items-center mx-2'>
                <template v-if='selected.id'>
                    <span
                        class='cursor-pointer'
                        @click='$router.push(`/connection/${selected.connection}/data/${selected.id}`)'
                        v-text='selected.name'
                    />
                </template>
                <template v-else>
                    <span>No Data Sync Selected - Data will output as CoTs directly to the Connection</span>
                </template>

                <div
                    v-if='!disabled'
                    class='btn-list ms-auto'
                >
                    <IconTrash
                        v-if='selected.id'
                        :size='32'
                        stroke='1'
                        class='cursor-pointer'
                        @click='update'
                    />
                    <TablerDropdown>
                        <template #default>
                            <IconSettings
                                :size='32'
                                stroke='1'
                                class='cursor-pointer dropdown-toggle'
                            />
                        </template>
                        <template #dropdown>
                            <div class='table-resposive'>
                                <table class='table table-hover'>
                                    <thead>
                                        <tr>
                                            <th>(Status) Name</th>
                                        </tr>
                                    </thead>
                                    <tbody class='table-tbody'>
                                        <tr
                                            v-for='d of data.items'
                                            :key='d.id'
                                            class='cursor-pointer'
                                            @click='update(d)'
                                        >
                                            <td>
                                                <div class='d-flex align-items-center'>
                                                    <span
                                                        class='mt-2'
                                                        v-text='d.name'
                                                    />
                                                </div>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </template>
                    </TablerDropdown>
                </div>
            </div>
        </template>
    </div>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue';
import { std } from '/src/std.ts';
import {
    IconTrash,
    IconSettings
} from '@tabler/icons-vue';
import {
    TablerLoading,
    TablerDropdown
} from '@tak-ps/vue-tabler';

const props = defineProps({
    connection: {
        type: Number,
        default: undefined
    },
    modelValue: {
        type: Number,
        default: undefined
    },
    disabled: {
        type: Boolean,
        default: false
    }
});

const emit = defineEmits(['update:modelValue']);

const loading = ref(true);
const selected = ref({
    id: '',
    name: ''
});
const data = ref({
    total: 0,
    items: []
});

watch(() => selected.value.id, () => {
    if (selected.value.id) {
        emit('update:modelValue', selected.value.id);
    } else {
        emit('update:modelValue', null);
    }
});

watch(() => props.modelValue, () => {
    if (props.modelValue) fetch();
});

onMounted(async () => {
    if (props.modelValue) await fetch();
    await listData();
    loading.value = false;
});

function update(d) {
    if (d) {
        selected.value.id = d.id;
        selected.value.name = d.name;
    } else {
        selected.value.id = '';
        selected.value.name = '';
    }
}

async function fetch() {
    selected.value = await std(`/api/connection/${props.connection}/data/${props.modelValue}`);
}

async function listData() {
    data.value = await std(`/api/connection/${props.connection}/data`);
}
</script>
