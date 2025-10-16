<template>
    <div>
        <span
            v-if='connection.agency'
            class='badge border text-white cursor-pointer'
            :class='{
                "bg-blue": !muted,
                "bg-blue-lt": muted
            }'
            style='height: 20px'
            @click='info.shown = true'
            v-text='`Agency`'
        />
        <span
            v-else
            class='badge border text-white'
            :class='{
                "bg-red": !muted,
                "bg-red-lt": muted
            }'
            style='height: 20px'
            v-text='`Admin`'
        />

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
    TablerModal,
    TablerLoading
} from '@tak-ps/vue-tabler';
import type { ETLConnection, ETLAgency } from '../../../types.ts';
import { std } from '../../../std.ts';

const props = defineProps<{
    connection: ETLConnection,
    muted?: boolean
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
    agency.value = await std(`/api/agency/${props.connection.agency}`) as ETLAgency;
}
</script>
