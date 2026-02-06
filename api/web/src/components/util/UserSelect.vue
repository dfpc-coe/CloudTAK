<template>
    <div class='w-100 px-2 py-2'>
        <TablerLoading
            v-if='loading'
            desc='Loading User...'
            :inline='true'
        />
        <template v-else>
            <div class='d-flex align-items-center'>
                <span
                    v-if='selected'
                    v-text='selected.username'
                />
                <span v-else>Publically Shared - No User Selected</span>

                <div
                    v-if='!props.disabled'
                    class='btn-list ms-auto'
                >
                    <TablerIconButton
                        v-if='selected'
                        title='Remove Selected'
                        @click='selected = undefined'
                    >
                        <IconTrash
                            :size='32'
                            stroke='1'
                        />
                    </TablerIconButton>
                    <TablerDropdown>
                        <template #default>
                            <TablerIconButton
                                title='User Select'
                                class='dropdown-toggle'
                            >
                                <IconSettings
                                    :size='32'
                                    stroke='1'
                                />
                            </TablerIconButton>
                        </template>
                        <template #dropdown>
                            <div class='card'>
                                <div class='card-body'>
                                    <TablerInput
                                        v-model='paging.filter'
                                        icon='search'
                                        placeholder='Filter...'
                                    />
                                    <div
                                        v-for='user of list.items'
                                        :key='user.username'
                                        tabindex='0'
                                        class='cursor-pointer my-1 hover px-2 py-1'
                                        @keyup.enter='selected = user'
                                        @click='selected = user'
                                    >
                                        <div class='d-flex'>
                                            <span style='width: 24px;'>
                                                <IconUser
                                                    :size='24'
                                                    stroke='1'
                                                />
                                            </span>
                                            <span
                                                v-text='user.username'
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </template>
                    </TablerDropdown>
                </div>
            </div>
        </template>
    </div>
</template>

<script setup lang='ts'>
import { ref, onMounted, watch } from 'vue'
import { std, stdurl } from '../../std.ts';
import type { User, UserList } from '../../types.ts';
import {
    IconTrash,
    IconUser,
    IconSettings
} from '@tabler/icons-vue';
import {
    TablerIconButton,
    TablerInput,
    TablerLoading,
    TablerDropdown
} from '@tak-ps/vue-tabler';

const props = defineProps<{
    modelValue: string | undefined,
    disabled?: boolean
}>();

const emit = defineEmits(['update:modelValue']);

const loading = ref(true);
const selected = ref<UserList['items'][number] | undefined>()
const paging = ref({
    filter: ''
})
const list = ref<UserList>({
    total: 0,
    items: []
})

watch(selected, () => {
    emit('update:modelValue', selected.value
        ? selected.value.username
        : undefined
    );
})

watch(paging.value, async () => {
    await listUsers();
});

watch(props, async () => {
    if (props.modelValue) {
        await getUser();
    }
});

onMounted(async () => {
    if (props.modelValue) {
        await getUser();
    }

    await listUsers();

    loading.value = false;
});

async function getUser() {
    loading.value = true;
    selected.value = await std(`/api/user/${props.modelValue}`) as User;
    loading.value = false;
}

async function listUsers() {
    const url = stdurl(`/api/user`);
    url.searchParams.set('filter', paging.value.filter);
    list.value = await std(url) as UserList;
}
</script>
