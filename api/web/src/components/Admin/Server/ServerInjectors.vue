<template>
    <div>
        <div class='card-header'>
            <h3 class='card-title'>
                TAK Server COT Injectors
            </h3>
            <div class='ms-auto btn-list'>
                <TablerIconButton
                    title='New Injector'
                    @click=''
                >
                    <IconPlus
                        :size='32'
                        stroke='1'
                    />
                </TablerIconButton>

                <TablerRefreshButton
                    :loading='loading'
                    @click='fetchList'
                />
            </div>
        </div>
        <TablerLoading v-if='loading' />
        <TablerAlert
            v-else-if='error'
            :err='error'
        />
        <div v-else class='card-body row'>
            <TablerNone
                v-if='list.items.length === 0'
                label='Injectors'
                :create='false'
            />
            <template v-else>
                <template v-for='injector in list.items'>
                    <span v-text='injector.uid'/>
                    <span v-text='injector.toInject'/>
                </template>
            </template>
        </div>
    </div>
</template>

<script setup lang='ts'>
import { ref, onMounted } from 'vue';
import { std } from '../../../std.ts';
import type { InjectorList } from '../../../types.ts';
import {
    TablerRefreshButton,
    TablerIconButton,
    TablerLoading,
    TablerAlert,
    TablerNone,
} from '@tak-ps/vue-tabler';

import {
    IconPlus
} from '@tabler/icons-vue';

const loading = ref(true);
const error = ref<Error | undefined>();
const list = ref<InjectorList>({
    total: 0,
    items: []
})

onMounted(async () => {
    await fetchList();
});

async function fetchList() {
    loading.value = true;
    try {
        list.value = await std(`/api/server/injector`) as InjectorList;
        loading.value = false;
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
    }
}
</script>
