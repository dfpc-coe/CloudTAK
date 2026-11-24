<template>
    <MenuTemplate
        :name='iconset.name'
        :subtitle='loading || error ? "" : summary'
    >
        <template #buttons>
            <TablerIconButton
                v-if='canEdit'
                title='Add Icons'
                @click='addIcons()'
            >
                <IconPlus
                    :size='32'
                    stroke='1'
                />
            </TablerIconButton>

            <TablerIconButton
                v-if='canEdit'
                title='Settings'
                @click='editIconsetModal = true'
            >
                <IconSettings
                    :size='32'
                    stroke='1'
                />
            </TablerIconButton>

            <TablerDropdown>
                <TablerIconButton title='Download Zip'>
                    <IconDownload
                        :size='32'
                        stroke='1'
                    />
                </TablerIconButton>

                <template #dropdown>
                    <div class='col-12'>
                        <div
                            class='cursor-pointer col-12 cloudtak-hover d-flex align-items-center px-2 py-2'
                            @click='IconsetCache.download(iconset.uid, "tak")'
                        >
                            <IconDownload
                                :size='20'
                                stroke='1.5'
                            />
                            <div class='mx-2 d-flex flex-column'>
                                <span>TAK Compatible</span>
                                <span class='iconset-muted small'>Every icon as PNG</span>
                            </div>
                        </div>
                        <div
                            class='cursor-pointer col-12 cloudtak-hover d-flex align-items-center px-2 py-2'
                            @click='IconsetCache.download(iconset.uid, "cloudtak")'
                        >
                            <IconDownload
                                :size='20'
                                stroke='1.5'
                            />
                            <div class='mx-2 d-flex flex-column'>
                                <span>Full CloudTAK</span>
                                <span class='iconset-muted small'>Original files, including SVGs</span>
                            </div>
                        </div>
                    </div>
                </template>
            </TablerDropdown>

            <TablerRefreshButton
                :loading='loading || !!busy'
                @click='syncIconset'
            />

            <TablerDelete
                v-if='canEdit'
                displaytype='icon'
                @delete='deleteIconset'
            />
        </template>
        <template #default>
            <TablerLoading v-if='loading' />
            <TablerAlert
                v-else-if='error'
                :err='error'
            />
            <div
                v-else
                class='d-flex flex-column gap-3 py-3 px-1'
            >
                <TablerAlert
                    v-if='syncError'
                    :err='syncError'
                />
                <TablerAlert
                    v-if='actionError'
                    :err='actionError'
                />

                <div class='d-flex gap-2'>
                    <div class='flex-grow-1'>
                        <TablerInput
                            v-model='filter'
                            icon='search'
                            placeholder='Filter icons'
                        />
                    </div>
                    <button
                        v-if='canEdit'
                        type='button'
                        class='btn flex-shrink-0'
                        @click='startNewFolder'
                    >
                        <IconFolderPlus
                            :size='18'
                            stroke='1.5'
                            class='me-2'
                        />
                        New folder
                    </button>
                </div>

                <TablerLoading
                    v-if='busy'
                    :desc='busy'
                />
                <div
                    v-else
                    class='d-flex flex-column gap-1'
                >
                    <form
                        v-if='naming && naming.folder === null'
                        class='d-flex align-items-center gap-2 py-1'
                        @submit.prevent='submitName'
                    >
                        <IconFolderPlus
                            :size='18'
                            stroke='1.5'
                            class='iconset-muted flex-shrink-0'
                        />
                        <input
                            ref='nameInput'
                            v-model='naming.value'
                            class='form-control fw-semibold'
                            aria-label='Folder name'
                            placeholder='Folder name'
                            maxlength='48'
                            @keydown.esc='naming = null'
                        >
                        <button
                            type='submit'
                            class='btn btn-primary flex-shrink-0'
                        >
                            Create
                        </button>
                        <TablerIconButton
                            title='Cancel'
                            @click='naming = null'
                        >
                            <IconX
                                :size='20'
                                stroke='1.5'
                            />
                        </TablerIconButton>
                    </form>

                    <TablerNone
                        v-if='!folders.length'
                        :label='filter ? "No matching icons" : "No icons"'
                        :create='false'
                    />

                    <section
                        v-for='folder in folders'
                        :key='folder.name'
                        class='iconset-folder d-flex flex-column gap-2'
                        :class='{ "iconset-folder--drop": dropTarget === folder.name }'
                        @dragover='dragOver($event, folder)'
                        @dragleave='dragLeave($event, folder)'
                        @drop='drop($event, folder)'
                    >
                        <form
                            v-if='naming && naming.folder === folder.name'
                            class='d-flex align-items-center gap-2 py-1'
                            @submit.prevent='submitName'
                        >
                            <IconFolder
                                :size='18'
                                stroke='1.5'
                                class='iconset-muted flex-shrink-0'
                            />
                            <input
                                ref='nameInput'
                                v-model='naming.value'
                                class='form-control fw-semibold'
                                aria-label='Folder name'
                                maxlength='48'
                                @keydown.esc='naming = null'
                            >
                            <button
                                type='submit'
                                class='btn btn-primary flex-shrink-0'
                            >
                                Rename
                            </button>
                            <TablerIconButton
                                title='Cancel rename'
                                @click='naming = null'
                            >
                                <IconX
                                    :size='20'
                                    stroke='1.5'
                                />
                            </TablerIconButton>
                        </form>
                        <div
                            v-else
                            class='d-flex align-items-center'
                        >
                            <button
                                type='button'
                                class='iconset-folder-toggle flex-grow-1 d-flex align-items-center gap-2'
                                :aria-expanded='isOpen(folder)'
                                @click='toggle(folder)'
                            >
                                <component
                                    :is='isOpen(folder) ? IconChevronDown : IconChevronRight'
                                    :size='14'
                                    stroke='2.5'
                                    class='iconset-muted flex-shrink-0'
                                />
                                <IconFolder
                                    :size='18'
                                    stroke='1.5'
                                    class='iconset-muted flex-shrink-0'
                                />
                                <span
                                    class='fw-semibold text-truncate'
                                    v-text='folder.name || "No folder"'
                                />
                                <span
                                    class='iconset-muted'
                                    v-text='folder.icons.length'
                                />
                            </button>
                            <TablerDropdown v-if='canEdit && folder.name'>
                                <TablerIconButton title='Folder actions'>
                                    <IconDotsVertical
                                        :size='20'
                                        stroke='1.5'
                                    />
                                </TablerIconButton>

                                <template #dropdown>
                                    <div class='col-12'>
                                        <div
                                            class='cursor-pointer col-12 cloudtak-hover d-flex align-items-center px-2 py-2'
                                            @click='startRename(folder)'
                                        >
                                            <IconPencil
                                                :size='20'
                                                stroke='1.5'
                                            />
                                            <span class='mx-2'>Rename</span>
                                        </div>
                                        <div
                                            class='cursor-pointer col-12 cloudtak-hover d-flex align-items-center px-2 py-2'
                                            @click='addIcons(folder.name)'
                                        >
                                            <IconPlus
                                                :size='20'
                                                stroke='1.5'
                                            />
                                            <span class='mx-2'>Add icons here</span>
                                        </div>
                                        <div
                                            class='cursor-pointer col-12 cloudtak-hover d-flex align-items-center px-2 py-2'
                                            @click='deleteFolder(folder)'
                                        >
                                            <IconTrash
                                                :size='20'
                                                stroke='1.5'
                                            />
                                            <div class='mx-2 d-flex flex-column'>
                                                <span>Delete folder</span>
                                                <span
                                                    v-if='folder.icons.length'
                                                    class='iconset-muted small'
                                                >Icons move to No folder</span>
                                            </div>
                                        </div>
                                    </div>
                                </template>
                            </TablerDropdown>
                        </div>

                        <template v-if='isOpen(folder)'>
                            <div
                                v-if='folder.icons.length'
                                class='iconset-grid pb-2'
                            >
                                <IconTile
                                    v-for='icon in folder.icons'
                                    :key='icon.name'
                                    :icon='icon'
                                    :src='iconUrl(icon)'
                                    :draggable='canEdit'
                                    @dragstart='dragStart($event, icon)'
                                    @dragend='dropTarget = null'
                                    @click='openIcon(icon)'
                                />
                            </div>
                            <div
                                v-else
                                class='iconset-muted small pb-2'
                            >
                                {{ folder.pending
                                    ? 'Empty. This folder is saved once it holds an icon.'
                                    : 'No icons here.' }}
                            </div>
                        </template>
                    </section>
                </div>
            </div>
        </template>
        <template
            v-if='canEdit && !loading && !error && !appStore.isMobileDetected'
            #footer
        >
            <div class='iconset-footer iconset-muted small text-center px-3 py-2'>
                Drop files on a folder to add them there. Drag an icon to move it.
            </div>
        </template>
    </MenuTemplate>

    <IconsetEditModal
        v-if='editIconsetModal'
        @close='syncIconset'
    />
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import IconsetCache from '../../../base/iconset.ts';
import IconCache from '../../../base/icon.ts';
import { useMapStore } from '../../../stores/map.ts';
import { useAppStore } from '../../../stores/app.ts';
import {
    TablerNone,
    TablerAlert,
    TablerInput,
    TablerDelete,
    TablerLoading,
    TablerDropdown,
    TablerIconButton,
    TablerRefreshButton,
} from '@tak-ps/vue-tabler';
import {
    IconX,
    IconPlus,
    IconTrash,
    IconPencil,
    IconSettings,
    IconFolder,
    IconDownload,
    IconFolderPlus,
    IconChevronDown,
    IconChevronRight,
    IconDotsVertical,
} from '@tabler/icons-vue';
import MenuTemplate from '../util/MenuTemplate.vue';
import IconTile from '../util/IconTile.vue';
import IconsetEditModal from './Iconset/EditModal.vue';
import ProfileConfig from '../../../base/profile.ts';
import type { Iconset } from '../../../types.ts';
import type { DBIcon } from '../../../database.ts';

interface Folder {
    name: string;
    icons: DBIcon[];
    pending: boolean;
}

const DRAG_TYPE = 'application/x-cloudtak-icon';
const OPEN_ALL_LIMIT = 96;

const route = useRoute();
const router = useRouter();
const mapStore = useMapStore();
const appStore = useAppStore();

const uid = String(route.params.iconset);

const loading = ref(true);
const busy = ref('');
const editIconsetModal = ref(false);
const isSystemAdmin = ref(false);
const username = ref('');
const error = ref<Error | undefined>(undefined);
const syncError = ref<Error | undefined>(undefined);
const actionError = ref<Error | undefined>(undefined);

const filter = ref('');
const icons = ref<DBIcon[]>([]);
const pending = ref<string[]>([]);
const open = ref<Set<string> | null>(null);
const dropTarget = ref<string | null>(null);
const naming = ref<{ folder: string | null; value: string } | null>(null);
const nameInput = ref<HTMLInputElement | HTMLInputElement[] | null>(null);

const urls = new Map<string, string>();

const iconset = ref<Iconset>({
    uid: '',
    created: '',
    updated: '',
    version: 0,
    name: '',
    username: null,
    username_internal: false,
    default_group: null,
    default_friendly: null,
    default_hostile: null,
    default_neutral: null,
    default_unknown: null,
    skip_resize: false,
});

const canEdit = computed(() => !!iconset.value.username || isSystemAdmin.value);

const folderNames = computed(() => {
    const names = new Set<string>();
    for (const icon of icons.value) {
        const folder = IconCache.folder(icon.path);
        if (folder) names.add(folder);
    }
    return names;
});

const summary = computed(() => {
    let audience = 'Everyone';
    if (iconset.value.username) {
        audience = iconset.value.username === username.value ? 'Only you' : `Only ${iconset.value.username}`;
    }

    return [
        plural(icons.value.length, 'icon'),
        plural(folderNames.value.size, 'folder'),
        audience
    ].join(' · ');
});

const folders = computed<Folder[]>(() => {
    const needle = filter.value.trim().toLowerCase();
    const grouped = new Map<string, DBIcon[]>();

    for (const icon of icons.value) {
        if (
            needle
            && !icon.path.toLowerCase().includes(needle)
            && !(icon.type2525b || '').toLowerCase().includes(needle)
        ) continue;

        const folder = IconCache.folder(icon.path);
        const list = grouped.get(folder);
        if (list) list.push(icon);
        else grouped.set(folder, [icon]);
    }

    if (!needle) {
        for (const name of pending.value) {
            if (!grouped.has(name)) grouped.set(name, []);
        }

        if (icons.value.length && !grouped.has('')) grouped.set('', []);
    }

    return Array.from(grouped.entries())
        .map(([name, list]) => ({
            name,
            icons: list,
            pending: !folderNames.value.has(name) && name !== ''
        }))
        .sort((a, b) => {
            if (!a.name) return 1;
            if (!b.name) return -1;
            return a.name.localeCompare(b.name);
        });
});

onMounted(async () => {
    const [isSysAdmin, profileUsername] = await Promise.all([
        ProfileConfig.get('system_admin'),
        ProfileConfig.get('username')
    ]);
    isSystemAdmin.value = isSysAdmin?.value ?? false;
    username.value = profileUsername?.value ?? '';

    await refresh({ autoSync: true });
});

onUnmounted(() => {
    revokeUrls();
});

function plural(count: number, noun: string): string {
    return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

function revokeUrls(): void {
    for (const url of urls.values()) URL.revokeObjectURL(url);
    urls.clear();
}

function iconUrl(icon: DBIcon): string {
    let url = urls.get(icon.name);
    if (!url) {
        url = URL.createObjectURL(icon.data);
        urls.set(icon.name, url);
    }
    return url;
}

function isOpen(folder: Folder): boolean {
    return !!filter.value.trim() || !!open.value?.has(folder.name);
}

function toggle(folder: Folder): void {
    const next = new Set(open.value);
    if (!next.delete(folder.name)) next.add(folder.name);
    open.value = next;
}

function openIcon(icon: DBIcon): void {
    router.push(`/menu/iconset/${icon.iconset}/${encodeURIComponent(icon.path)}`);
}

function addIcons(folder?: string): void {
    router.push({
        path: `/menu/iconset/${uid}/new`,
        query: folder ? { folder } : undefined
    });
}

async function focusNameInput(): Promise<void> {
    await nextTick();
    const el = Array.isArray(nameInput.value) ? nameInput.value[0] : nameInput.value;
    el?.focus();
    el?.select();
}

function startNewFolder(): void {
    naming.value = { folder: null, value: '' };
    void focusNameInput();
}

function startRename(folder: Folder): void {
    naming.value = { folder: folder.name, value: folder.name };
    void focusNameInput();
}

async function submitName(): Promise<void> {
    if (!naming.value) return;

    const from = naming.value.folder;
    const to = naming.value.value.trim().replace(/^\/+|\/+$/g, '');
    naming.value = null;
    actionError.value = undefined;

    if (!to || to === from) return;

    if (to.split('/').some((segment) => !segment.trim() || segment === '.' || segment === '..')) {
        actionError.value = new Error('Folder names cannot contain empty, "." or ".." segments');
        return;
    }

    if (from === null) {
        if (!folderNames.value.has(to) && !pending.value.includes(to)) pending.value.push(to);
        open.value = new Set(open.value).add(to);
        return;
    }

    const moving = icons.value.filter((icon) => IconCache.folder(icon.path) === from);
    pending.value = pending.value.filter((name) => name !== from);

    if (!moving.length) {
        pending.value.push(to);
    } else {
        await moveIcons(moving, to, `Renaming ${from}`);
    }

    if (open.value?.has(from)) open.value = new Set(open.value).add(to);
}

async function deleteFolder(folder: Folder): Promise<void> {
    pending.value = pending.value.filter((name) => name !== folder.name);
    if (!folder.icons.length) return;

    const moving = icons.value.filter((icon) => IconCache.folder(icon.path) === folder.name);
    await moveIcons(moving, '', `Removing ${folder.name}`);
}

async function moveIcons(moving: DBIcon[], folder: string, desc: string): Promise<void> {
    actionError.value = undefined;

    const taken = new Set(icons.value.map((icon) => icon.path));
    const targets = moving.map((icon) => {
        const leaf = IconCache.leaf(icon.path);
        return { icon, path: folder ? `${folder}/${leaf}` : leaf };
    }).filter(({ icon, path }) => icon.path !== path);

    if (!targets.length) return;

    const clash = targets.find(({ path }) => taken.has(path));
    if (clash) {
        actionError.value = new Error(`${folder || 'No folder'} already has an icon named "${IconCache.leaf(clash.path)}"`);
        return;
    }

    await mutate(desc, async () => {
        for (const { icon, path } of targets) {
            await IconCache.rename(icon, path);
        }

        if (targets.length > 1) await IconsetCache.regenerate(uid);
    });

    pending.value = pending.value.filter((name) => name !== folder);
}

async function uploadFiles(files: File[], folder: string): Promise<void> {
    const images = files.filter((file) => /\.(png|svg)$/i.test(file.name));
    if (!images.length) {
        actionError.value = new Error('Only PNG and SVG files can be added as icons');
        return;
    }

    await mutate(`Adding ${plural(images.length, 'icon')}`, async () => {
        await IconCache.upload(uid, images, folder);
    });

    pending.value = pending.value.filter((name) => name !== folder);
}

/** Run a server mutation, then resync the iconset whether or not it succeeded */
async function mutate(desc: string, fn: () => Promise<void>): Promise<void> {
    busy.value = desc;
    actionError.value = undefined;

    try {
        await fn();
    } catch (err) {
        actionError.value = err instanceof Error ? err : new Error(String(err));
    }

    try {
        await mapStore.icons.refresh(uid);
        await load();
    } catch (err) {
        actionError.value ??= err instanceof Error ? err : new Error(String(err));
    } finally {
        busy.value = '';
    }
}

function dragStart(event: DragEvent, icon: DBIcon): void {
    if (!canEdit.value || !event.dataTransfer) return;

    event.dataTransfer.setData(DRAG_TYPE, icon.name);
    event.dataTransfer.effectAllowed = 'move';
}

function accepts(event: DragEvent): boolean {
    const types = event.dataTransfer?.types;
    return canEdit.value && !!types && (types.includes(DRAG_TYPE) || types.includes('Files'));
}

function dragOver(event: DragEvent, folder: Folder): void {
    if (!accepts(event)) return;

    event.preventDefault();
    dropTarget.value = folder.name;
}

function dragLeave(event: DragEvent, folder: Folder): void {
    const related = event.relatedTarget;
    if (related instanceof Node && (event.currentTarget as HTMLElement).contains(related)) return;
    if (dropTarget.value === folder.name) dropTarget.value = null;
}

async function drop(event: DragEvent, folder: Folder): Promise<void> {
    if (!accepts(event) || !event.dataTransfer) return;

    event.preventDefault();
    dropTarget.value = null;

    const name = event.dataTransfer.getData(DRAG_TYPE);
    if (name) {
        const icon = icons.value.find((candidate) => candidate.name === name);
        if (icon) await moveIcons([icon], folder.name, `Moving ${IconCache.leaf(icon.path)}`);
    } else if (event.dataTransfer.files.length) {
        await uploadFiles(Array.from(event.dataTransfer.files), folder.name);
    }
}

async function refresh(opts: { autoSync?: boolean } = {}): Promise<void> {
    loading.value = true;
    error.value = undefined;
    editIconsetModal.value = false;

    try {
        const missingIds = (await IconCache.list(uid)).some((icon) => icon.id === undefined);
        if (opts.autoSync && (missingIds || IconCache.stale(await IconsetCache.from(uid)))) {
            try {
                await mapStore.icons.refresh(uid);
            } catch (err) {
                syncError.value = err instanceof Error ? err : new Error(String(err));
            }
        }

        await load();
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
    } finally {
        loading.value = false;
    }
}

async function load(): Promise<void> {
    const cached = await IconsetCache.from(uid);
    if (!cached) throw new Error('Iconset not available offline. Refresh to sync this iconset.');

    const list = await IconCache.list(uid);

    revokeUrls();
    iconset.value = { ...iconset.value, ...cached };
    icons.value = list;

    if (!open.value) {
        const names = new Set(list.map((icon) => IconCache.folder(icon.path)));
        const sorted = Array.from(names).sort((a, b) => {
            if (!a) return 1;
            if (!b) return -1;
            return a.localeCompare(b);
        });

        open.value = new Set(list.length <= OPEN_ALL_LIMIT ? sorted : sorted.slice(0, 1));
    }
}

async function syncIconset(): Promise<void> {
    loading.value = true;
    syncError.value = undefined;
    actionError.value = undefined;

    try {
        await mapStore.icons.refresh(uid);
    } catch (err) {
        syncError.value = err instanceof Error ? err : new Error(String(err));
    }

    await refresh();
}

async function deleteIconset(): Promise<void> {
    loading.value = true;
    await mapStore.icons.deleteIconset(uid);
    router.push('/menu/iconsets');
}
</script>

<style scoped>
.iconset-muted {
    color: var(--tblr-secondary-color);
}

.iconset-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(88px, 1fr));
    gap: 0.5rem;
}

.iconset-folder {
    border-radius: 8px;
    outline: 2px solid transparent;
    outline-offset: 4px;
}

.iconset-folder--drop {
    outline-color: var(--tblr-primary);
    background: rgba(var(--tblr-primary-rgb), 0.08);
}

.iconset-folder-toggle {
    min-width: 0;
    min-height: 44px;
    padding: 0;
    color: inherit;
    font: inherit;
    text-align: left;
    background: none;
    border: 0;
    border-radius: 6px;
}

.iconset-folder-toggle:focus-visible {
    outline: 2px solid var(--tblr-primary);
}

.iconset-footer {
    border-top: 1px solid var(--tblr-border-color);
}
</style>
