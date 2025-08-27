<template>
    <MenuTemplate
        name='Mission Files'
        :zindex='0'
        :back='false'
        :border='false'
    >
        <template #buttons>
            <TablerIconButton
                v-if='!upload && role && role.permissions.includes("MISSION_WRITE")'
                title='Upload File'
                @click='upload = true'
            >
                <IconPlus
                    :size='32'
                    stroke='1'
                />
            </TablerIconButton>
        </template>

        <TablerLoading
            v-if='loading'
        />
        <TablerAlert
            v-else-if='error'
            :err='error'
        />
        <div
            v-else-if='upload'
            class='mx-2'
        >
            <UploadImport
                mode='Mission'
                :modeid='mission.guid'
                :config='genConfig()'
                @cancel='upload = false'
                @done='upload = false'
            />
        </div>

        <TablerNone
            v-else-if='!mission.contents.length'
            label='Files'
            :create='false'
        />
        <template v-else>
            <div
                v-for='content in mission.contents'
                :key='content.data.uid'
                class='col-12 d-flex px-2 py-2 hover'
            >
                <div>
                    <span
                        class='txt-truncate'
                        v-text='content.data.name'
                    />
                    <div class='col-12'>
                        <span
                            class='subheader'
                            v-text='content.data.submitter'
                        /> - <span
                            class='subheader'
                            v-text='content.data.submissionTime'
                        />
                    </div>
                </div>
                <div class='col-auto ms-auto btn-list'>
                    <TablerDelete
                        v-if='role && role.permissions.includes("MISSION_WRITE")'
                        displaytype='icon'
                        @delete='deleteFile(content.data.hash)'
                    />
                    <TablerIconButton
                        title='Import File'
                        @click='importFile(content.data.name, content.data.hash)'
                    >
                        <IconFileImport
                            :size='32'
                            stroke='1'
                        />
                    </TablerIconButton>
                    <a
                        v-tooltip='"Download Asset"'
                        :href='downloadFile(content.data.hash)'
                    ><IconDownload
                        :size='32'
                        stroke='1'
                        color='white'
                        class='cursor-pointer'
                    /></a>
                </div>
            </div>

            <template v-if='imports.items.length'>
                <label class='subheader px-2'>Imports</label>

                <div
                    v-for='imp in imports.items'
                    :key='imp.id'
                    class='col-12 d-flex px-2 py-2 hover align-items-center cursor-pointer'
                    @click='router.push(`/menu/imports/${imp.id}`)'
                >
                    <Status :status='imp.status' />

                    <div
                        class='mx-2'
                        v-text='imp.name'
                    />
                </div>
            </template>
        </template>
    </MenuTemplate>
</template>

<script setup lang='ts'>
import { ref, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { std, stdurl } from '../../../../std.ts';
import type {
    Mission,
    MissionRole,
    Import,
    ImportList
} from '../../../../types.ts';
import {
    IconPlus,
    IconFileImport,
    IconDownload,
} from '@tabler/icons-vue';
import UploadImport from '../../util/UploadImport.vue';
import Status from '../../../util/StatusDot.vue';
import {
    TablerIconButton,
    TablerLoading,
    TablerAlert,
    TablerNone,
    TablerDelete,
} from '@tak-ps/vue-tabler';

import MenuTemplate from '../../util/MenuTemplate.vue';

const props = defineProps<{
    mission: Mission,
    token?: string,
    role?: MissionRole
}>()

const emit = defineEmits([ 'refresh' ]);

const router = useRouter();

const error = ref<Error | undefined>();
const upload = ref(false);
const loading = ref(false)

const imports = ref<ImportList>({
    total: 0,
    items: []
})

onMounted(async () => {
    await fetchImports();
});

watch(upload, async () => {
    await fetchImports();
});

async function deleteFile(hash: string) {
    await std(`/api/marti/missions/${props.mission.name}/upload/${hash}`, {
        method: 'DELETE'
    });

    emit("refresh");
}

function downloadFile(hash: string): string {
    const url = stdurl(`/api/marti/api/files/${hash}`)
    url.searchParams.append('token', localStorage.token);
    return String(url);
}

function genConfig() {
    return { id: props.mission.name }
}

async function importFile(name: string, hash: string) {
    loading.value = true;

    const imp = await std('/api/import', {
        method: 'POST',
        body: {
            name: name,
            source: 'Mission',
            source_id: hash
        }
    }) as Import;

    router.push(`/menu/imports/${imp.id}`)
}

async function fetchImports() {
    loading.value = true;

    try {
        const url = await stdurl(`/api/import`);
        url.searchParams.append('source', 'Mission');
        url.searchParams.append('source_id', props.mission.guid);
        const imps = await std(url) as ImportList;

        imps.items = imps.items.filter((i) => {
            return !['Success'].includes(i.status);
        });

        imports.value = imps;
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
    }

    loading.value = false;
}
</script>
