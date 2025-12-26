<template>
    <div>
        <div class='card-header'>
            <h3 class='card-title'>
                TAK Server COT Injectors
            </h3>
            <div class='ms-auto btn-list'>
                <TablerIconButton
                    title='New Injector'
                    @click='injector = true'
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
        <div
            v-else
            class='card-body row'
        >
            <TablerNone
                v-if='list.items.length === 0'
                label='No Injectors'
                :create='false'
            />
            <template v-else>
                <template v-for='i in list.items'>
                    <div
                        class='col-12 hover px-2 py-2 rounded cursor-pointer'
                        @click='injector = i'
                    >
                        <div
                            class='subheader'
                            v-text='i.uid'
                        />
                        <pre
                            class='pre'
                            v-text='i.toInject'
                        />
                    </div>
                </template>
            </template>
        </div>
    </div>

    <ServerInjectorModal
        v-if='injector'
        :injector='injector'
        @close='fetchList'
    />
</template>

<script setup lang='ts'>
import { ref, onMounted } from 'vue';
import { std } from '../../../std.ts';
import ServerInjectorModal from './ServerInjectorModal.vue';
import type { InjectorList, Injector } from '../../../types.ts';
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
const injector = ref<boolean | Injector>(false);
const error = ref<Error | undefined>();
const list = ref<InjectorList>({
    total: 0,
    items: []
})

onMounted(async () => {
    await fetchList();
});

async function fetchList() {
    injector.value = false;
    loading.value = true;
    try {
        list.value = await std(`/api/server/injector`) as InjectorList;
        loading.value = false;
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
    }
}
</script>
