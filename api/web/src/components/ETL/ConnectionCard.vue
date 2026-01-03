<template>
    <div class='w-100'>
        <div class='d-flex align-items-center w-100'>
            <ConnectionStatus :connection='connection' />

            <div class='mx-2 d-flex flex-column'>
                <div
                    class='card-title m-0'
                    :class='{ "cursor-pointer": clickable }'
                    @click='clickable ? router.push(`/connection/${connection.id}`) : null'
                    v-text='connection.name'
                />
                <div
                    v-if='connection.username'
                    class='subheader'
                >
                    By <span v-text='connection.username' />
                </div>
            </div>

            <div class='ms-auto d-flex align-items-center btn-list'>
                <AgencyBadge :connection='connection' />

                <TablerIconButton
                    v-if='!connection.readonly'
                    title='Cycle Connection'
                    @click='cycle'
                >
                    <IconPlugConnected
                        :size='32'
                        stroke='1'
                    />
                </TablerIconButton>

                <TablerRefreshButton
                    :loading='loading'
                    @click='refresh'
                />

                <TablerIconButton
                    title='Edit'
                    @click='router.push(`/connection/${connection.id}/edit`)'
                >
                    <IconSettings
                        :size='32'
                        stroke='1'
                    />
                </TablerIconButton>
            </div>
        </div>
        <div
            v-if='expanded'
            class='col-12 mt-2'
        >
            <TablerMarkdown :markdown='connection.description' />

            <div class='datagrid mt-3'>
                <div class='datagrid-item'>
                    <div class='datagrid-title'>
                        Certificate Valid From
                    </div>
                    <div
                        class='datagrid-content'
                        v-text='connection.certificate.validFrom'
                    />
                </div>
                <div class='datagrid-item'>
                    <div class='datagrid-title'>
                        Certificate Valid To
                    </div>
                    <div
                        class='datagrid-content d-flex'
                        :class='{
                            "rounded bg-red text-white px-2 py-1": new Date(connection.certificate.validTo) < new Date()
                        }'
                    >
                        <div v-text='connection.certificate.validTo' />
                        <div
                            v-if='new Date(connection.certificate.validTo) < new Date()'
                            class='ms-auto'
                        >
                            Expired Certificate
                        </div>
                    </div>
                </div>
                <div class='datagrid-item'>
                    <div class='datagrid-title'>
                        Certificate Subject
                    </div>
                    <div
                        class='datagrid-content'
                        v-text='connection.certificate.subject'
                    />
                </div>
            </div>

            <div class='mt-2'>
                Last updated <span v-text='timeDiff(connection.updated)' />
            </div>
        </div>
    </div>
</template>

<script setup lang='ts'>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import type { ETLConnection } from '../../types';
import { std } from '../../std';
import timeDiff from '../../timediff';
import ConnectionStatus from './Connection/StatusDot.vue';
import AgencyBadge from './Connection/AgencyBadge.vue';
import {
    TablerIconButton,
    TablerRefreshButton,
    TablerMarkdown
} from '@tak-ps/vue-tabler';
import {
    IconPlugConnected,
    IconSettings
} from '@tabler/icons-vue';

const router = useRouter();

const props = withDefaults(defineProps<{
    connection: ETLConnection;
    clickable?: boolean;
    expanded?: boolean;
}>(), {
    clickable: false,
    expanded: false
});

const emit = defineEmits(['update:connection']);

const loading = ref(false);

async function cycle() {
    loading.value = true;
    try {
        const updated = await std(`/api/connection/${props.connection.id}/refresh`, {
            method: 'POST'
        }) as ETLConnection;
        emit('update:connection', updated);
    } catch (err) {
        console.error(err);
    }
    loading.value = false;
}

async function refresh() {
    loading.value = true;
    try {
        const updated = await std(`/api/connection/${props.connection.id}`) as ETLConnection;
        emit('update:connection', updated);
    } catch (err) {
        console.error(err);
    }
    loading.value = false;
}
</script>
