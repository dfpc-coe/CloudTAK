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
                                            @click.stop='update(d)'
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

<script setup lang='ts'>
import { ref, watch, onMounted } from 'vue';
import { server } from '../../std.ts';
import type { ETLData, APIList } from '../../types.ts';
import {
    IconTrash,
    IconSettings
} from '@tabler/icons-vue';
import {
    TablerLoading,
    TablerDropdown
} from '@tak-ps/vue-tabler';

const props = withDefaults(defineProps<{
    connection?: number;
    modelValue?: number | null;
    disabled?: boolean;
}>(), {
    connection: undefined,
    modelValue: undefined,
    disabled: false,
});

const emit = defineEmits<{
    (e: 'update:modelValue', value: string | number | null): void;
}>();

const loading = ref<boolean>(true);
const selected = ref<{ id: string | number; name: string; connection?: number }>({
    id: '',
    name: ''
});
const data = ref<APIList<ETLData>>({
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

function update(d?: { id: string | number; name: string } | PointerEvent) {
    if (d && !(d instanceof Event)) {
        selected.value.id = d.id;
        selected.value.name = d.name;
    } else {
        selected.value.id = '';
        selected.value.name = '';
    }
}

async function fetch() {
    const res = await server.GET('/api/connection/{:connectionid}/data/{:dataid}', {
        params: {
            path: {
                ':connectionid': Number(props.connection),
                ':dataid': Number(props.modelValue)
            }
        }
    });

    if (res.error) throw new Error(res.error.message);
    selected.value = res.data as typeof selected.value;
}

async function listData() {
    const res = await server.GET('/api/connection/{:connectionid}/data', {
        params: {
            path: {
                ':connectionid': Number(props.connection)
            },
            query: {
                filter: '',
                limit: 100,
                page: 0,
                order: 'asc',
                sort: 'name'
            }
        }
    });

    if (res.error) throw new Error(res.error.message);
    data.value = res.data as typeof data.value;
}
</script>
