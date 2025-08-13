<template>
    <div>
        <div class='card-header'>
            <TablerIconButton
                title='Back'
                @click='router.push("/admin/user")'
            >
                <IconCircleArrowLeft
                    :size='32'
                    stroke='1'
                />
            </TablerIconButton>

            <div class='card-title d-flex align-items-center'>
                <StatusDot
                    :dark='true'
                    :status='user.active ? "Success" : "Unknown"'
                />
                <span
                    class='mx-2'
                    v-text='route.params.user'
                />
            </div>

            <div class='ms-auto btn-list'>
                <TablerIconButton
                    v-if='!edit'
                    title='Edit User'
                    @click='edit = true'
                >
                    <IconSettings
                        :size='32'
                        stroke='1'
                    />
                </TablerIconButton>
                <TablerRefreshButton
                    :loading='loading'
                    @click='fetchUserLoading'
                />
            </div>
        </div>
        <div class='card-body'>
            <TablerLoading v-if='loading' />
            <template v-else-if='edit'>
                <div class='col-12 pb-4'>
                    <TablerToggle
                        v-model='user.system_admin'
                        label='System Administrator'
                    />
                </div>

                <div class='col-12 d-flex align-items-center'>
                    <button
                        class='btn btn-secondary'
                        @click='fetchUserLoading'
                    >
                        Cancel
                    </button>

                    <div class='ms-auto'>
                        <button
                            class='btn btn-primary'
                            @click='saveUser'
                        >
                            Save
                        </button>
                    </div>
                </div>
            </template>
            <template v-else>
                <div class='datagrid'>
                    <template v-for='ele in getRemainingKeys(user)'>
                        <div
                            v-if='user[ele]'
                            class='datagrid-item'
                        >
                            <div
                                class='datagrid-title'
                                v-text='ele'
                            />

                            <template v-if='ele === "agency_admin"'>
                                <div
                                    class='datagrid-content'
                                    v-text='user.agency_admin.length ? user.agency_admin : "None"'
                                />
                            </template>
                            <template v-else-if='ele === "username"'>
                                <CopyField
                                    :model-value='user.username'
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

                <div
                    class='col-lg-12 hover py-2 mt-2 cursor-pointer'
                    @click='opened.has("tak") ? opened.delete("tak") : opened.add("tak")'
                >
                    <IconChevronDown v-if='opened.has("tak")' />
                    <IconChevronRight v-else />

                    <span class='mx-2 user-select-none'>TAK Broadcast</span>
                </div>

                <div
                    v-if='opened.has("tak")'
                    class='col-lg-12 card-body border rounded'
                >
                    <div class='datagrid'>
                        <template v-for='ele in getTAKKeys(user)'>
                            <div
                                v-if='user[ele]'
                                class='datagrid-item'
                            >
                                <div
                                    class='datagrid-title'
                                    v-text='ele'
                                />

                                <template v-if='ele === "tak_loc"'>
                                    <CopyField
                                        :model-value='user.tak_loc ? user.tak_loc.coordinates.map(c => Math.round(c * 1000000) / 1000000).join(",") : "Unset"'
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
                </div>

                <div
                    class='col-lg-12 hover py-2 mt-2 cursor-pointer'
                    @click='opened.has("display") ? opened.delete("display") : opened.add("display")'
                >
                    <IconChevronDown v-if='opened.has("display")' />
                    <IconChevronRight v-else />

                    <span class='mx-2 user-select-none'>Display Settings</span>
                </div>
                <div
                    v-if='opened.has("display")'
                    class='col-lg-12 card-body border rounded'
                >
                    <div class='datagrid'>
                        <template v-for='ele in getDisplayKeys(user)'>
                            <div
                                v-if='user[ele]'
                                class='datagrid-item'
                            >
                                <div
                                    class='datagrid-title'
                                    v-text='ele'
                                />
                                <div
                                    class='datagrid-content'
                                    v-text='user[ele]'
                                />
                            </div>
                        </template>
                    </div>
                </div>

                <div
                    class='col-lg-12 hover py-2 mt-2 cursor-pointer'
                    @click='opened.has("fusion") ? opened.delete("fusion") : opened.add("fusion")'
                >
                    <IconChevronDown v-if='opened.has("fusion")' />
                    <IconChevronRight v-else />

                    <span class='mx-2 user-select-none'>Fused Sensors</span>
                </div>
                <div
                    v-if='opened.has("fusion")'
                    class='col-lg-12 card-body border rounded'
                >
                    Fused Sensors
                </div>
            </template>
        </div>
    </div>
</template>

<script setup lang='ts'>
import { std, stdurl } from '../../std.ts';
import type { User } from '../../types.ts';
import CopyField from '../CloudTAK/util/CopyField.vue';
import StatusDot from '../util/StatusDot.vue';
import {
    TablerLoading,
    TablerToggle,
    TablerIconButton,
    TablerRefreshButton
} from '@tak-ps/vue-tabler';
import {
    IconSettings,
    IconChevronDown,
    IconChevronRight,
    IconCircleArrowLeft,
} from '@tabler/icons-vue'

import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

async function fetchUser(): Promise<User> {
    const url = stdurl(`/api/user/${route.params.user}`);
    return await std(url) as User;
}

const opened = ref<Set<string>>(new Set());

const loading = ref(false);
const edit = ref(false);
const user = ref<User>(await fetchUser());

const getRemainingKeys = <T extends object>(obj: T) => Object.keys(obj).filter((key) => {
    return !key.startsWith('display') && !key.startsWith('tak');
}) as Array<keyof T>

const getDisplayKeys = <T extends object>(obj: T) => Object.keys(obj).filter((key) => {
    return key.startsWith('display');
}) as Array<keyof T>

const getTAKKeys = <T extends object>(obj: T) => Object.keys(obj).filter((key) => {
    return key.startsWith('tak');
}) as Array<keyof T>

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
