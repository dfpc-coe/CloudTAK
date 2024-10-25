<template>
    <div>
        <div class='card-header'>
            <TablerIconButton
                title='Back'
                @click='$router.push("/admin/user")'
            ><IconCircleArrowLeft :size='32' stroke='1'/></TablerIconButton>

            <h1
                class='card-title mx-2'
                v-text='`User: ${$route.params.user}`'
            />

            <div class='ms-auto btn-list'>
                <TablerIconButton
                    v-if='!edit'
                    title='Edit User'
                    @click='edit = true'
                ><IconSettings :size='32' stroke='1' /></TablerIconButton>
                <TablerIconButton
                    title='Refresh'
                    @click='fetchUserLoading'
                ><IconRefresh :size='32' stroke='1' /></TablerIconButton>
            </div>
        </div>
        <div class='card-body'>
            <TablerLoading v-if='loading' />
            <template v-else-if='edit'>
                <div class='col-12 pb-4'>
                    <TablerToggle
                        label='System Administrator'
                        v-model='user.system_admin'
                    />
                </div>

                <div class='col-12 d-flex align-items-center'>
                    <button @click='fetchUserLoading' class='btn btn-secondary'>Cancel</button>

                    <div class='ms-auto'>
                        <button @click='saveUser' class='btn btn-primary'>Save</button>
                    </div>
                </div>
            </template>
            <template v-else>
                <div class='datagrid'>
                    <template v-for='ele in getKeys(user)'>
                        <div
                            v-if='user[ele]'
                            class='datagrid-item'
                        >
                            <div
                                class='datagrid-title'
                                v-text='ele'
                            />

                            <template v-if='ele === "tak_loc"'>
                                <div
                                    class='datagrid-content'
                                    v-text='user.tak_loc ? user.tak_loc.coordinates.join(",") : "Unset"'
                                />
                            </template>
                            <template v-else-if='ele === "agency_admin"'>
                                <div
                                    class='datagrid-content'
                                    v-text='user.agency_admin.length ? user.agency_admin : "None"'
                                />
                            </template>
                            <template v-else>
                                <div
                                    class='datagrid-content'
                                    v-text='user[ele]'
                                />
                            </template>
                        </div>
                    </template>
                </div>
            </template>
        </div>
    </div>
</template>

<script setup lang='ts'>
import { std, stdurl } from '../../std.ts';
import type { User } from '../../types.ts';
import {
    TablerLoading,
    TablerToggle,
    TablerIconButton
} from '@tak-ps/vue-tabler';
import {
    IconRefresh,
    IconSettings,
    IconCircleArrowLeft,
} from '@tabler/icons-vue'

import { ref } from 'vue';
import { useRoute } from 'vue-router'

const route = useRoute()

async function fetchUser(): Promise<User> {
    const url = stdurl(`/api/user/${route.params.user}`);
    return await std(url) as User;
}

const loading = ref(false);
const edit = ref(false);
const user = ref<User>(await fetchUser());
const getKeys = <T extends object>(obj: T) => Object.keys(obj) as Array<keyof T>

async function saveUser(): Promise<void> {
    edit.value = false;
    loading.value = true;
    const url = stdurl(`/api/user/${route.params.user}`);
    user.value = await std(url, {
        method: 'PATCH',
        body: {
            system_admin: user.value.system_admin
        }
    }) as User;
    loading.value = false;
}

async function fetchUserLoading(): Promise<void> {
    edit.value = false;
    loading.value = true;
    const url = stdurl(`/api/user/${route.params.user}`);
    user.value = await std(url) as User;
    loading.value = false;
}
</script>
