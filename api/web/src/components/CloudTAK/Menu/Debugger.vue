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
                label='Features'
                :create='false'
            />
            <template v-else>
                <div
                    v-for='(feature, fit) in history.features'
                    key='fit'
                >
                    <div
                        class='row hover px-2 py-2 cursor-pointer user-select-none'
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
import { ref } from 'vue';
import type { FeatureCollection } from '../../../../src/types.ts';
import CopyField from '../util/CopyField.vue';
import timeDiff from '../../../timediff.ts';
import { std, stdurl } from '../../../../src/std.ts';
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

const error = ref<Error | undefined>();
const loading = ref(false);

const uid = ref('');
const opened = ref<Set<number>>(new Set());
const history = ref<FeatureCollection>({
    type: 'FeatureCollection',
    features: []
});

async function fetchHistory() {
    error.value = undefined;
    loading.value = true;
    opened.value.clear();

    try {
        const url = stdurl(`/api/marti/cot/${uid.value}/all`);
        url.searchParams.set('track', String(false));
        history.value = await std(url) as FeatureCollection;
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err))
    }

    loading.value = false;
}
</script>
