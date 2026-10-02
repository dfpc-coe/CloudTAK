<template>
    <MenuTemplate name='COT Debugger'>
        <template #default>
            <div class='my-2 mx-2 d-flex align-items-center'>
                <TablerInput
                    v-model='uid'
                    icon='search'
                    class='pe-2'
                    style='
                        width: calc(100% - 52px);
                    '
                    placeholder='COT UID'
                />
                <button
                    class='btn btn-primary'
                    style='height: 35px;'
                    @click='fetchHistory'
                >
                    <IconSearch
                        :size='32'
                        stroke='1'
                    />
                </button>
            </div>

            <TablerLoading v-if='loading' />
            <TablerAlert
                v-else-if='error'
                title='Historic Features Error'
                :err='error'
            />
            <TablerNone
                v-else-if='!history.features.length'
                label='No Features'
                :create='false'
            />
            <template v-else>
                <div
                    v-for='(feature, fit) in history.features'
                    key='fit'
                >
                    <div
                        class='row cloudtak-hover px-2 py-2 cursor-pointer user-select-none'
                        @click='opened.has(fit) ? opened.delete(fit) : opened.add(fit)'
                    >
                        <div
                            class='col-12'
                            v-text='feature.properties.callsign'
                        />
                        <div
                            class='col-md-6 col-12 subheader'
                            v-text='feature.properties.time'
                        />
                        <div
                            class='col-md-6 col-12 subheader d-flex align-items-center'
                        >
                            <div
                                class='ms-auto'
                                v-text='timeDiff(feature.properties.time)'
                            />
                        </div>
                    </div>

                    <div v-if='opened.has(fit)'>
                        <CopyField
                            mode='pre'
                            :model-value='JSON.stringify(feature, null, 4)'
                        />
                    </div>
                </div>
            </template>
        </template>
    </MenuTemplate>
</template>

<script setup lang='ts'>
import { ref, shallowRef } from 'vue';
import type { paths } from '@cloudtak/api-types';
import CopyField from '../util/CopyField.vue';
import timeDiff from '../../../timediff.ts';
import { server } from '../../../../src/std.ts';
import {
    TablerNone,
    TablerInput,
    TablerAlert,
    TablerLoading
} from '@tak-ps/vue-tabler';
import {
    IconSearch,
} from '@tabler/icons-vue';
import MenuTemplate from '../util/MenuTemplate.vue';

type DebuggerHistory = paths['/api/marti/cot/{:uid}/all']['get']['responses']['200']['content']['application/json'];

const error = ref<Error | undefined>();
const loading = ref(false);

const uid = ref('');
const opened = ref<Set<number>>(new Set());
const history = shallowRef<DebuggerHistory>({
    type: 'FeatureCollection',
    features: []
});

async function fetchHistory() {
    error.value = undefined;
    loading.value = true;
    opened.value.clear();

    try {
        const { data, error: apiError } = await server.GET('/api/marti/cot/{:uid}/all', {
            params: {
                path: {
                    ':uid': uid.value
                },
                query: {
                    track: false
                }
            }
        });

        if (apiError || !data) throw new Error(String(apiError || 'No data'));

        history.value = data;
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err))
    }

    loading.value = false;
}
</script>
