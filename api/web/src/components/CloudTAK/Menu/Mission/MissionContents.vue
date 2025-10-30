<template>
    <MenuTemplate
        name='Mission Files'
        :zindex='0'
        :back='false'
        :border='false'
    >
        <template #buttons>
            <TablerIconButton
                v-if='!upload && props.subscription.role && props.subscription.role.permissions.includes("MISSION_WRITE")'
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
                :url='stdurl(`/api/marti/missions/${props.subscription.guid}/upload`)'
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
            v-else-if='!props.subscription.meta.contents.length'
            label='Files'
            :create='false'
        />
        <template v-else>
            <div
                v-for='content in props.subscription.meta.contents'
                :key='content.data.uid'
                class='col-12 d-flex px-2 py-2 hover rounded'
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
                <div class='col-auto'>
                    <div class='d-flex ms-auto'>
                        <TablerDelete
                            v-if='props.subscription.role && props.subscription.role.permissions.includes("MISSION_WRITE")'
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
                        <TablerIconButton
                            title='Download Asset'
                            @click='downloadFile(content.data.name, content.data.hash)'
                        >
                            <IconDownload
                                :size='32'
                                stroke='1'
                                color='white'
                                class='cursor-pointer'
                            />
                        </TablerIconButton>
                    </div>
                </div>
            </div>
        </template>
    </MenuTemplate>
</template>

<script setup lang='ts'>
import { ref, computed, useTemplateRef } from 'vue';
import { useRouter } from 'vue-router';
import { std, stdurl } from '../../../../std.ts';
import Subscription from '../../../../base/subscription.ts';
import type { Import } from '../../../../types.ts';
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
    subscription: Subscription
}>();

const emit = defineEmits([ 'refresh' ]);

const router = useRouter();

const error = ref<Error | undefined>();

const uploadRef = useTemplateRef<typeof Upload>('upload');
const upload = ref(false);

const loading = ref(false)

async function deleteFile(hash: string) {
    await std(`/api/marti/missions/${props.subscription.guid}/upload/${hash}`, {
        method: 'DELETE'
    });

    emit("refresh");
}

const uploadHeaders = computed(() => {
    const headers: Record<string, string> = {
        Authorization: `Bearer ${localStorage.token}`,
    }

    if (props.subscription.token) {
        headers.MissionAuthorization = props.subscription.token;
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

async function downloadFile(name: string, hash: string): Promise<void> {
    const url = stdurl(`/api/marti/api/files/${hash}`)
    url.searchParams.append('token', localStorage.token);
    url.searchParams.append('name', name);

    await std(url, {
        download: true
    })
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
