<template>
    <MenuTemplate
        name='Mission Files'
        :zindex='0'
        :back='false'
        :border='false'
        :standalone='false'
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
            v-else-if='!contents || !contents.length'
            label='No Files'
            :create='false'
        />
        <template v-else>
            <div
                v-if='contents.length'
                class='px-2 py-2'
            >
                <TablerPillGroup
                    v-model='mode'
                    :options='[
                        { value: "photos", label: "Photos" },
                        { value: "files", label: "Files" }
                    ]'
                >
                    <template #option='{ option }'>
                        <IconPhoto
                            v-if='option.value === "photos"'
                            class='me-1'
                            :size='20'
                            stroke='1'
                        />
                        <IconFiles
                            v-else
                            class='me-1'
                            :size='20'
                            stroke='1'
                        />
                        {{ option.label }}
                    </template>
                </TablerPillGroup>
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
                    :key='content.uid'
                    class='px-2 py-2 cloudtak-hover rounded'
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
                            :src='downloadAssetUrl(content.hash, content.name)'
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
                            v-text='content.name'
                        />

                        <div class='ms-auto d-flex'>
                            <TablerDelete
                                v-if='props.subscription.role && props.subscription.role.permissions.includes("MISSION_WRITE")'
                                displaytype='icon'
                                :size='24'
                                @delete='deleteFile(content.hash)'
                            />
                            <TablerIconButton
                                title='Download Asset'
                                @click='downloadFile(content.name, content.hash)'
                            >
                                <IconDownload
                                    :size='24'
                                    stroke='1'
                                    color='currentColor'
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
                    :key='content.uid'
                    class='col-12 d-flex px-2 py-2 mb-2'
                >
                    <div
                        style='width: calc(100% - 120px)'
                    >
                        <div class='col-12'>
                            <div
                                class='text-break'
                                v-text='content.name'
                            />
                            <div>
                                <span
                                    class='subheader'
                                    v-text='content.submitter'
                                /> - <span
                                    class='subheader'
                                    v-text='content.submissionTime'
                                />
                            </div>
                        </div>
                    </div>
                    <div class='col-auto'>
                        <div class='d-flex ms-auto'>
                            <TablerDelete
                                v-if='props.subscription.role && props.subscription.role.permissions.includes("MISSION_WRITE")'
                                displaytype='icon'
                                @delete='deleteFile(content.hash)'
                            />
                            <TablerIconButton
                                title='Import File'
                                @click='importFile(content.name, content.hash)'
                            >
                                <IconFileImport
                                    :size='32'
                                    stroke='1'
                                />
                            </TablerIconButton>
                            <TablerIconButton
                                title='Download Asset'
                                @click='downloadFile(content.name, content.hash)'
                            >
                                <IconDownload
                                    :size='32'
                                    stroke='1'
                                    color='currentColor'
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
import { from } from 'rxjs';
import { liveQuery } from 'dexie';
import { useObservable } from '@vueuse/rxjs';
import type { Ref } from 'vue';
import { useRouter } from 'vue-router';
import { std, stdurl, server } from '../../../../std.ts';
import Subscription from '../../../../base/subscription.ts';
import type { DBSubscriptionContent } from '../../../../base/database.ts';
import type { Attachment } from '../../../../types.ts';
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
    TablerPillGroup,
} from '@tak-ps/vue-tabler';

import MenuTemplate from '../../util/MenuTemplate.vue';
import StandardItem from '../../util/StandardItem.vue';

const props = defineProps<{
    subscription: Subscription
}>();

const floatStore = useFloatStore();

const router = useRouter();

const error = ref<Error | undefined>();

const mode = ref('photos');

const contents: Ref<Array<DBSubscriptionContent>> = useObservable(
    from(liveQuery(async () => {
        return await props.subscription.contents.list();
    }))
);

const filteredContents = computed(() => {
    return (contents.value || []).filter((c) => {
        // If is Photo and not a tif or image/tiff

        const isPhoto = (
            /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(c.name)
            || (c.mimeType && c.mimeType.startsWith('image/'))
        ) && (
            !/\.(tif|tiff)$/i.test(c.name)
            && c.mimeType !== 'image/tiff'
        );

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
    await props.subscription.contents.delete(hash);
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
    await props.subscription.fetch();
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

    await props.subscription.fetch();
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

    const res = await server.POST('/api/import', {
        body: {
            name: name,
            source: 'Mission',
            source_id: hash
        }
    });
    if (res.error) throw new Error(res.error.message);

    router.push(`/menu/imports/${res.data.id}`)
}

function downloadAssetUrl(hash: string, name: string) {
    const url = stdurl(`/api/marti/api/files/${hash}`)
    url.searchParams.set('token', localStorage.token);
    url.searchParams.set('name', name);
    return url.toString();
}

function openAttachment(content: DBSubscriptionContent) {
    const ext = content.name.split('.').pop();
    floatStore.addAttachment({
        hash: content.hash,
        name: content.name,
        ext: ext ? `.${ext}` : '',
        url: downloadAssetUrl(content.hash, content.name),
        size: content.size,
        created: content.submissionTime
    } as Attachment);
}
</script>
