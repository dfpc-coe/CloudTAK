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
            <Upload
                ref='upload'
                :url='stdurl(`/api/marti/missions/${props.mission.name}/upload`)'
                :headers='uploadHeaders'
                :autoupload='false'
                format='raw'
                method='POST'
                @staged='uploadStaged($event)'
                @error='error = $event'
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
                <div
                    style='width: calc(100% - 120px)'
                >
                    <div class='col-12'>
                        <div
                            class='text-truncate'
                            v-text='content.data.name'
                        />
                        <div>
                            <span
                                class='subheader'
                                v-text='content.data.submitter'
                            /> - <span
                                class='subheader'
                                v-text='content.data.submissionTime'
                            />
                        </div>
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
        </template>
    </MenuTemplate>
</template>

<script setup lang='ts'>
import { ref, computed, useTemplateRef } from 'vue';
import { useRouter } from 'vue-router';
import { std, stdurl } from '../../../../std.ts';
import type {
    Mission,
    MissionRole,
    Import,
} from '../../../../types.ts';
import {
    IconPlus,
    IconFileImport,
    IconDownload,
} from '@tabler/icons-vue';
import Upload from '../../../util/Upload.vue';
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

const uploadRef = useTemplateRef<typeof Upload>('upload');
const upload = ref(false);

const loading = ref(false)

async function deleteFile(hash: string) {
    await std(`/api/marti/missions/${props.mission.name}/upload/${hash}`, {
        method: 'DELETE'
    });

    emit("refresh");
}

const uploadHeaders = computed(() => {
    const headers: Record<string, string> = {
        Authorization: `Bearer ${localStorage.token}`,
    }

    if (props.token) {
        headers.MissionAuthorization = props.token;
    };

    return headers;
});

async function uploadStaged(ev: { name: string }) {

    if (uploadRef.value) {
        await uploadRef.value.upload({
            query: {
                name: ev.name
            }
        });
    } else {
        throw new Error("Upload Not Found");
    }

    emit("refresh");
}

function downloadFile(hash: string): string {
    const url = stdurl(`/api/marti/api/files/${hash}`)
    url.searchParams.append('token', localStorage.token);
    return String(url);
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
</script>
