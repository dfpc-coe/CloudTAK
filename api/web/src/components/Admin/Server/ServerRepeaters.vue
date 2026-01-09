<template>
    <div>
        <div class='card-header'>
            <h3 class='card-title'>
                TAK Server COT Repeaters
            </h3>
            <div class='ms-auto'>
                <div class='btn-list'>
                    <TablerRefreshButton
                        :loading='loading'
                        @click='fetchList'
                    />
                </div>
            </div>
        </div>
        <TablerLoading v-if='loading' />
        <TablerAlert
            v-else-if='error'
            :err='error'
        />
        <div
            v-else
            class='card-body row'
        >
            <TablerNone
                v-if='list.total === 0'
                label='No Repeaters'
                :create='false'
            />
            <template v-else>
                <template v-for='repeater in list.items'>
                    <div class='col-12 hover d-flex align-items-center px-2 py-2'>
                        <div class='row'>
                            <div class='col-12'>
                                <span v-text='repeater.callsign' />
                            </div>
                            <div class='col-12 subheader'>
                                <span v-text='repeater.cotType' /> - <span
                                    class='cursor-pointer'
                                    @click='relative = !relative'
                                    v-text='relative ? timeDiff(Number(repeater.dateTimeActivated)) : new Date(Number(repeater.dateTimeActivated))'
                                />
                            </div>
                        </div>
                        <div class='ms-auto'>
                            <TablerDelete
                                displaytype='icon'
                                @delete='deleteRepeater(repeater)'
                            />
                        </div>
                    </div>
                </template>
            </template>
        </div>
    </div>
</template>

<script setup lang='ts'>
import { ref, onMounted } from 'vue';
import { std } from '../../../std.ts';
import type { RepeaterList, Repeater } from '../../../types.ts';
import timeDiff from '../../../timediff.ts';
import {
    TablerRefreshButton,
    TablerLoading,
    TablerDelete,
    TablerAlert,
    TablerNone,
} from '@tak-ps/vue-tabler';

const loading = ref(true);
const relative = ref(true);
const error = ref<Error | undefined>();
const list = ref<RepeaterList>({
    total: 0,
    items: []
})

onMounted(async () => {
    await fetchList();
});

async function fetchList() {
    loading.value = true;
    try {
        list.value = await std(`/api/server/repeater`) as RepeaterList;
        loading.value = false;
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
    }
}

async function deleteRepeater(repeater: Repeater) {
    loading.value = true;
    try {
        await std(`/api/server/repeater/${repeater.uid}`, {
            method: 'DELETE'
        })
    
        await fetchList();
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
    }
}
</script>
