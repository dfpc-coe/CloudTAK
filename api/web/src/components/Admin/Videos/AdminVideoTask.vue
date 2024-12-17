<template>
    <div>
        <div class='card-header'>
            <IconCircleArrowLeft
                :size='32'
                stroke='1'
                class='cursor-pointer'
                @click='$router.push("/admin/video")'
            />
            <h1 class='mx-2 card-title d-flex align-items-center'>
                <template v-if='!loading && video && video.status'>
                    <Status
                        v-if='video.status === "RUNNING"'
                        status='Success'
                    />
                    <Status
                        v-else
                        :status='video.status'
                    />
                </template>
                <div class='mx-2'>
                    Video Server
                    <span
                        v-if='video'
                        class='mx-2'
                        v-text='video.id'
                    />
                </div>
            </h1>

            <div class='ms-auto btn-list'>
                <TablerDelete
                    v-if='!loading && video && video.status === "RUNNING" && video.statusDesired === "RUNNING"'
                    v-tooltip='"Delete Server"'
                    displaytype='icon'
                    @delete='fetchDelete'
                />
                <IconRefresh
                    v-tooltip='"Refresh"'
                    :size='32'
                    stroke='1'
                    class='cursor-pointer'
                    @click='fetch'
                />
            </div>
        </div>
        <div>
            <TablerLoading v-if='loading' />
            <TablerAlert
                v-else-if='error'
                :err='error'
            />
            <div
                v-else-if='video'
                class='card-body'
            >
                <div class='datagrid'>
                    <div class='datagrid-item'>
                        <div class='datagrid-title'>
                            Version
                        </div>
                        <div
                            class='datagrid-content'
                            v-text='video.version'
                        />
                    </div>
                    <div class='datagrid-item'>
                        <div class='datagrid-title'>
                            Created
                        </div>
                        <div
                            class='datagrid-content'
                            v-text='video.created'
                        />
                    </div>
                    <div class='datagrid-item'>
                        <div class='datagrid-title'>
                            Desired Status
                        </div>
                        <div
                            class='datagrid-content'
                            v-text='video.statusDesired'
                        />
                    </div>
                    <div class='datagrid-item'>
                        <div class='datagrid-title'>
                            Memory
                        </div>
                        <div
                            class='datagrid-content'
                            v-text='video.memory'
                        />
                    </div>
                    <div class='datagrid-item'>
                        <div class='datagrid-title'>
                            IP Public
                        </div>
                        <div
                            class='datagrid-content'
                            v-text='video.ipPublic'
                        />
                    </div>
                    <div class='datagrid-item'>
                        <div class='datagrid-title'>
                            IP Private
                        </div>
                        <div
                            class='datagrid-content'
                            v-text='video.ipPrivate'
                        />
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang='ts'>
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import type { VideoServer } from '../../../../src/types.ts';
import { std, stdurl } from '../../../../src/std.ts';
import {
    TablerDelete,
    TablerAlert,
    TablerLoading
} from '@tak-ps/vue-tabler';
import Status from '../../util/Status.vue';
import {
    IconRefresh,
    IconCircleArrowLeft,
} from '@tabler/icons-vue'

const router = useRouter();
const route = useRoute();

const error = ref<Error | undefined>();
const loading = ref(true);
const video = ref<VideoServer | undefined>();

onMounted(async () => {
    await fetch();
})

async function fetchDelete() {
    loading.value = true;
    try {
        const url = stdurl(`/api/video/server/${route.params.task}`);
        await std(url, {
            method: 'DELETE'
        });

        router.push("/admin/video");
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
        loading.value = false;
    }
}

async function fetch() {
    loading.value = true;
    try {
        const url = stdurl(`/api/video/server/${route.params.task}`);
        video.value = await std(url) as VideoServer;
    } catch (err) {
        if (err instanceof Error && err.message === 'Could not find Media Server with that ID') {
            router.push('/admin/video');
        } else {
            error.value = err instanceof Error ? err : new Error(String(err));
        }
    }

    loading.value = false;
}
</script>
