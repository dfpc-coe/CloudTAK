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
                @done='doneUpload'
            />
        </div>

        <TablerNone
            v-else-if='!props.subscription.meta.contents.length'
            label='No Files'
            :create='false'
        />
        <template v-else>
            <div
                v-if='props.subscription.meta.contents.length'
                class='px-2 py-2'
            >
                <div class='px-2 py-2 round btn-group w-100'>
                    <input
                        id='photos'
                        v-model='mode'
                        value='photos'
                        type='radio'
                        class='btn-check'
                        autocomplete='off'
                    >
                    <label
                        for='photos'
                        type='button'
                        class='btn btn-sm'
                    ><IconPhoto
                        class='me-1'
                        :size='20'
                        stroke='1'
                    />Photos</label>
                    <input
                        id='files'
                        v-model='mode'
                        value='files'
                        type='radio'
                        class='btn-check'
                        autocomplete='off'
                    >
                    <label
                        for='files'
                        type='button'
                        class='btn btn-sm'
                    ><IconFiles
                        class='me-1'
                        :size='20'
                        stroke='1'
                    />Files</label>
                </div>
            </div>
            <TablerNone
                v-if='!filteredContents.length'
                :label='mode === "photos" ? "No Photos" : "No Files"'
                :create='false'
            />
            <div
                v-if='mode === "photos"'
                class='w-100 d-flex flex-wrap align-items-center justify-content-center'
            >
                <div
                    v-for='content in filteredContents'
                    :key='content.data.uid'
                    class='px-2 py-2 hover rounded'
                >
                    <div
                        class='d-flex align-items-center justify-content-center'
                        style='
                            height: 200px;
                            width: 200px;
                        '
                    >
                        <img
                            class='cursor-pointer'
                            style='max-height: 180px; max-width: 100%; object-fit: contain;'
                            :src='downloadAssetUrl(content.data.hash, content.data.name)'
                            @click='openAttachment(content)'
                        >
                    </div>

                    <div
                        class='d-flex align-items-center pt-2'
                        style='
                            height: 30px;
                            width: 200px;
                        '
                    >
                        <span
                            class='mx-2 text-truncate'
                            style='max-width: 140px;'
                            v-text='content.data.name'
                        />

                        <div class='ms-auto'>
                            <TablerIconButton
                                title='Download Asset'
                                @click='downloadFile(content.data.name, content.data.hash)'
                            >
                                <IconDownload
                                    :size='24'
                                    stroke='1'
                                    color='white'
                                    class='cursor-pointer'
                                />
                            </TablerIconButton>
                        </div>
                    </div>
                </div>
            </div>

            <template v-else>
                <StandardItem
                    v-for='content in filteredContents'
                    :key='content.data.uid'
                    class='col-12 d-flex px-2 py-2 mb-2'
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
                </StandardItem>
            </template>
        </template>
    </MenuTemplate>
</template>

<script setup lang='ts'>
import { ref, computed, useTemplateRef } from 'vue';
import { useRouter } from 'vue-router';
import { std, stdurl } from '../../../../std.ts';
import Subscription from '../../../../base/subscription.ts';
import type { Import, Mission, Attachment } from '../../../../types.ts';
import { useFloatStore } from '../../../../stores/float.ts';
import {
    IconPlus,
    IconFileImport,
    IconDownload,
    IconPhoto,
    IconFiles,
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
import StandardItem from '../../util/StandardItem.vue';

const props = defineProps<{
    subscription: Subscription
}>();

const floatStore = useFloatStore();

const emit = defineEmits([ 'refresh' ]);

const router = useRouter();

const error = ref<Error | undefined>();

const mode = ref('photos');

const filteredContents = computed(() => {
    return props.subscription.meta.contents.filter((c) => {
        const isPhoto = /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(c.data.name)
            || (c.data.mimeType && c.data.mimeType.startsWith('image/'));

        if (mode.value === 'photos') {
            return isPhoto;
        } else {
            return !isPhoto;
        }
    });
});

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

async function doneUpload() {
    upload.value = false;
    emit("refresh");
}

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
    url.searchParams.set('token', localStorage.token);
    url.searchParams.set('name', name);

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

function downloadAssetUrl(hash: string, name: string) {
    const url = stdurl(`/api/marti/api/files/${hash}`)
    url.searchParams.set('token', localStorage.token);
    url.searchParams.set('name', name);
    return url.toString();
}

function openAttachment(content: Mission['contents'][number]) {
    const ext = content.data.name.split('.').pop();
    floatStore.addAttachment({
        hash: content.data.hash,
        name: content.data.name,
        ext: ext ? `.${ext}` : '',
        url: downloadAssetUrl(content.data.hash, content.data.name),
        size: content.data.size,
        created: content.data.submissionTime
    } as Attachment);
}
</script>
