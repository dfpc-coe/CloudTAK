<template>
    <div>
        <div class='card-header'>
            <IconCircleArrowLeft
                class='cursor-pointer'
                :size='32'
                stroke='1'
                @click='$router.push("/admin/user")'
            />

            <h1
                class='card-title mx-2'
                v-text='`User: ${$route.params.user}`'
            />

            <div class='ms-auto btn-list'>
                <TablerIconButton
                    title='Refresh'
                    @click='fetchUserLoading'
                ><IconRefresh :size='32' stroke='1'/></TablerIconButton>
            </div>
        </div>
        <div class='card-body'>
            <TablerLoading v-if='loading' />
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
import type { User, UserList } from '../../types.ts';
import {
    TablerLoading,
    TablerIconButton
} from '@tak-ps/vue-tabler';
import {
    IconRefresh,
    IconCircleArrowLeft,
} from '@tabler/icons-vue'

import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router'

const route = useRoute()

async function fetchUser(): Promise<User> {
    const url = stdurl(`/api/user/${route.params.user}`);
    return await std(url) as User;
}

const loading = ref(false);
const user = ref<User>(await fetchUser());

const getKeys = <T extends object>(obj: T) => Object.keys(obj) as Array<keyof T>

async function fetchUserLoading(): Promise<void> {
    loading.value = true;
    const url = stdurl(`/api/user/${route.params.user}`);
    user.value = await std(url) as User;
    loading.value = false;
}
</script>
