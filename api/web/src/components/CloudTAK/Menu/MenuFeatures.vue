<template>
    <MenuTemplate
        name='Saved Features'
        :loading='loading || !mapStore.isLoaded'
    >
        <template #default>
            <template
                v-for='path of paths'
                :key='path'
            >
                <div
                    class='d-flex align-items-center px-3 py-2 me-2 hover-button cursor-pointer user-select-none'
                    @click='path.opened ? closePath(path) : openPath(path)'
                >
                    <IconChevronRight
                        v-if='!path.opened'
                        :size='20'
                        stroke='1'
                    />
                    <IconChevronDown
                        v-else
                        :size='20'
                        stroke='1'
                    />
                    <IconFolder
                        class='mx-2'
                        :size='20'
                        stroke='2'
                    />
                    <span v-text='path.name.replace(/(^\/|\/$)/g, "")' />
                </div>
                <div
                    v-if='path.opened'
                    class='ms-2'
                >
                    <TablerLoading v-if='path.loading' />
                    <template v-else>
                        <Feature
                            v-for='cot of path.cots.values()'
                            :key='cot.id'
                            :feature='cot'
                        />
                    </template>
                </div>
            </template>

            <Feature
                v-for='cot of cots.values()'
                :key='cot.id'
                :delete-button='true'
                :info-button='true'
                :feature='cot'
            />
        </template>
    </MenuTemplate>
</template>

<script setup lang='ts'>
import { ref, onMounted } from 'vue';
import COT from '../../../base/cot.ts';
import MenuTemplate from '../util/MenuTemplate.vue';
import Feature from '../util/Feature.vue';
import {
    TablerLoading
} from '@tak-ps/vue-tabler';
import {
    IconFolder,
    IconChevronRight,
    IconChevronDown
} from '@tabler/icons-vue';
import { useMapStore } from '../../../stores/map.ts';

const mapStore = useMapStore();

type Path = {
    name: string;
    opened: boolean;
    loading: boolean;
    cots: Set<COT>;
};

const cots = ref<Set<COT>>(new Set());
const paths = ref<Array<Path>>();

const loading = ref(true);

onMounted(async () => {
    cots.value = await mapStore.worker.db.pathFeatures();

    paths.value = (await mapStore.worker.db.paths())
        .map(p => p.path)
        .sort((a) => {
            return a === '/' ? 1 : -1;
        }).filter((path) => {
            return path !== '/'
        }).map((path) => {
            return {
                name: path,
                opened: false,
                loading: false,
                cots: new Set()
            }
        });

    loading.value = false
});

async function closePath(path: Path): Promise<void> {
    path.opened = false;
}

async function openPath(path: Path): Promise<void> {
    path.opened = true;
    path.loading = true;
    path.cots = await mapStore.worker.db.pathFeatures(path.name);
    path.loading = false;
}

</script>
