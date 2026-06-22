<template>
    <div>
        <TablerBadge
            v-if='connection.agency'
            class='cursor-pointer'
            background-color='rgba(59, 130, 246, 0.15)'
            border-color='rgba(59, 130, 246, 0.3)'
            text-color='#2563eb'
            hover-background-color='rgba(59, 130, 246, 0.25)'
            hover-border-color='rgba(59, 130, 246, 0.5)'
            style='height: 20px'
            @click='info.shown = true'
        >
            Agency
        </TablerBadge>
        <TablerBadge
            v-else
            background-color='rgba(239, 68, 68, 0.15)'
            border-color='rgba(239, 68, 68, 0.3)'
            text-color='#dc2626'
            style='height: 20px'
        >
            Admin
        </TablerBadge>

        <TablerModal v-if='info.shown'>
            <div class='modal-status bg-yellow' />
            <button
                type='button'
                class='btn-close'
                aria-label='Close'
                @click='info.shown = false'
            />

            <TablerLoading
                v-if='!agency'
                desc='Loading Agency...'
            />
            <template v-else>
                <div class='modal-header'>
                    <div
                        class='modal-title'
                        v-text='agency.name'
                    />
                </div>

                <div class='modal-body'>
                    <div class='datagrid'>
                        <div class='datagrid-item'>
                            <div class='datagrid-title'>
                                Description
                            </div>
                            <div
                                class='datagrid-content'
                                v-text='"No Description"'
                            />
                        </div>
                    </div>
                </div>
            </template>
            <div class='modal-footer'>
                <button
                    class='btn btn-primary'
                    @click='info.shown = false'
                >
                    Close
                </button>
            </div>
        </TablerModal>
    </div>
</template>

<script setup lang='ts'>
import { ref, watch, onMounted } from 'vue';
import {
    TablerBadge,
    TablerModal,
    TablerLoading
} from '@tak-ps/vue-tabler';
import type { ETLConnection, ETLAgency } from '../../../types.ts';
import { server } from '../../../std.ts';

const props = defineProps<{
    connection: ETLConnection,
}>()

const info = ref({ shown: false });
const agency = ref<ETLAgency | undefined>();

watch(info, async () => {
    await fetch()
});

onMounted(async () => {
    if (props.connection.agency) {
        await fetch()
    }
});

async function fetch() {
    if (!props.connection.agency) {
        agency.value = undefined;
        return;
    }

    const res = await server.GET('/api/agency/{:agencyid}', {
        params: {
            path: {
                ':agencyid': props.connection.agency,
            }
        }
    });

    if (res.error) throw new Error(res.error.message);

    agency.value = res.data as ETLAgency;
}
</script>
