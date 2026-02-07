<template>
    <div class="folder-manager">
        <!-- Folders List -->
        <div class="d-flex flex-column gap-2">
            <template
                v-for="folder in folders"
                :key="folder[folderKey]"
            >
                <StandardItem
                    :id="`foldertarget-${folder[folderKey]}`"
                    class="px-3 py-3 user-select-none"
                    :style="hoverFolder === folder ? 'background-color: rgba(255, 255, 255, 0.1);' : ''"
                    @drop.stop.prevent="onFolderDrop(folder)"
                    @dragover.prevent="dragOverFolder(folder)"
                    @dragleave="dragLeaveFolder()"
                    @click="toggleFolder(folder)"
                >
                    <div class="d-flex align-items-center justify-content-between">
                        <div class="d-flex align-items-center">
                            <IconChevronRight
                                v-if="!folder.opened"
                                :size="20"
                                stroke="1"
                            />
                            <IconChevronDown
                                v-else
                                :size="20"
                                stroke="1"
                            />
                            <IconFolder
                                class="mx-2"
                                :size="20"
                                stroke="2"
                            />
                            <span
                                class="fw-bold"
                                v-text="folder.name.replace(/(^\/|\/$)/g, '')"
                            />
                        </div>

                        <div class="ms-auto d-flex align-items-center gap-2">
                            <slot name="folder-actions" :folder="folder">
                                <span class="badge rounded-pill bg-secondary bg-opacity-25 text-white-50">{{ folderCount(folder) }}</span>
                                <TablerIconButton
                                    title="Rename Folder"
                                    @click.stop="openEditModal(folder)"
                                >
                                    <IconPencil
                                        :size="20"
                                        stroke="1"
                                    />
                                </TablerIconButton>
                                <TablerDelete
                                    displaytype="Icon"
                                    :size="20"
                                    @delete="emit('delete-folder', folder)"
                                />
                            </slot>
                        </div>
                    </div>
                    
                    <div
                        v-if="folder.opened"
                        class="mt-3"
                        @click.stop
                    >
                        <div
                            :id="`folder-${folder[folderKey]}`"
                            :ref="(el) => setFolderRef(el, folder)"
                            class="folder w-100"
                            style="min-height: 40px;"
                        >
                            <TablerLoading v-if="folder.loading" />
                            <template v-else>
                                <div
                                    v-if="folderItems(folder).length === 0"
                                    class="text-center text-muted fst-italic py-2 small user-select-none opacity-50 pe-none position-absolute w-100"
                                    style="margin-top: -8px;"
                                >
                                    Folder is empty
                                </div>
                                <slot
                                    v-for="file of folderItems(folder)"
                                    name="file"
                                    :file="file"
                                />
                            </template>
                        </div>
                    </div>
                </StandardItem>
            </template>
        </div>

        <!-- Root Files -->
        <div
            id="general"
            ref="rootFilesRef"
            class="mt-2"
        >
            <slot
                v-for="file of rootItems"
                name="file"
                :file="file"
            />
        </div>

        <!-- Create/Rename Modal -->
        <TablerModal
            v-if="folderModal.shown"
        >
            <div class="modal-status bg-white" />
            <button
                type="button"
                class="btn-close"
                aria-label="Close"
                @click="folderModal.shown = false"
            />
            <div class="modal-header text-white">
                <div class="modal-title">
                    {{ folderModal.editingFolder ? 'Rename Folder' : 'Create Folder' }}
                </div>
            </div>
            <div class="modal-body">
                <TablerInput
                    v-model="folderModal.name"
                    label="Folder Name"
                    placeholder="Operations"
                    @submit="submitFolder"
                />
            </div>
            <div class="modal-footer">
                <TablerButton
                    class="w-100"
                    variant="primary"
                    @click="submitFolder"
                >
                    {{ folderModal.editingFolder ? 'Save' : 'Create' }}
                </TablerButton>
            </div>
        </TablerModal>
    </div>
</template>

<script setup lang="ts" generic="TFolder extends { name: string, opened: boolean, loading: boolean, count?: number } & Record<string, any>, TFile extends Record<string, any>">
import { ref, watch, nextTick, onMounted, onBeforeUnmount, computed } from 'vue';
import Sortable, { type SortableEvent } from 'sortablejs';
import StandardItem from './StandardItem.vue';
import {
    TablerModal,
    TablerInput,
    TablerButton,
    TablerIconButton,
    TablerDelete,
    TablerLoading
} from '@tak-ps/vue-tabler';
import {
    IconFolder,
    IconChevronRight,
    IconChevronDown,
    IconPencil
} from '@tabler/icons-vue';

const props = withDefaults(defineProps<{
    folders: TFolder[];
    files: TFile[] | Set<TFile> | Map<string | number, TFile>;
    folderKey?: keyof TFolder;
    fileKey?: keyof TFile;
    folderItemsKey?: keyof TFolder; // Key to access items in a folder object
}>(), {
    folderKey: 'id',
    fileKey: 'id',
    folderItemsKey: 'items'
});

const emit = defineEmits<{
    (e: 'folder-open', folder: TFolder): void;
    (e: 'folder-close', folder: TFolder): void;
    (e: 'create-folder', name: string): void;
    (e: 'rename-folder', payload: { folder: TFolder, name: string }): void;
    (e: 'delete-folder', folder: TFolder): void;
    (e: 'move-file', payload: { id: string, targetId: string | null }): void; // targetId null for root
    (e: 'drop-file-on-folder', payload: { id: string, folder: TFolder }): void;
}>();

const rootFilesRef = ref<HTMLElement | null>(null);
const folderSortables = new Map<string, Sortable>();
let rootSortable: Sortable | null = null;

const folderModal = ref<{
    shown: boolean;
    name: string;
    editingFolder?: TFolder;
}>({
    shown: false,
    name: ''
});

const hoverFolder = ref<TFolder | undefined>();
const hoverTimer = ref<ReturnType<typeof setTimeout> | undefined>();
const dragging = ref(false);
const draggedId = ref<string | undefined>();

// Helpers to get items as Array
const rootItems = computed((): TFile[] => {
    if (Array.isArray(props.files)) return props.files;
    if (props.files instanceof Set) return Array.from(props.files);
    if (props.files instanceof Map) return Array.from(props.files.values());
    return [];
});

function folderItems(folder: TFolder): TFile[] {
    const items = folder[props.folderItemsKey];
    if (!items) return [];
    if (Array.isArray(items)) return items;
    if (items instanceof Set) return Array.from(items);
    if (items instanceof Map) return Array.from(items.values());
    return [];
}

function folderCount(folder: TFolder): number {
    // If folder has 'count' prop, use it, otherwise count items
    if (typeof folder.count === 'number') return folder.count;
    return folderItems(folder).length;
}

// Actions
function toggleFolder(folder: TFolder) {
    if (folder.opened) {
        emit('folder-close', folder);
    } else {
        emit('folder-open', folder);
    }
}

function openEditModal(folder: TFolder) {
    folderModal.value.name = folder.name;
    folderModal.value.editingFolder = folder;
    folderModal.value.shown = true;
}

function openCreateModal() {
    folderModal.value.name = '';
    folderModal.value.editingFolder = undefined;
    folderModal.value.shown = true;
}

function submitFolder() {
    if (!folderModal.value.name) return;
    
    if (folderModal.value.editingFolder) {
        emit('rename-folder', { 
            folder: folderModal.value.editingFolder, 
            name: folderModal.value.name 
        });
    } else {
        emit('create-folder', folderModal.value.name);
    }
    folderModal.value.shown = false;
    folderModal.value.name = '';
}

// Drag and Drop Logic
function onFeatureAdd(ev: SortableEvent): void {
    const id = ev.item.id;
    if (!id) return;

    const target = ev.to.id;
    if (!target) return;

    let targetFolderId: string | null = null;

    if (target === 'general') {
        targetFolderId = null;
    } else {
        // format is "folder-{id}"
        targetFolderId = target.replace('folder-', '');
    }
    
    emit('move-file', { id, targetId: targetFolderId });
}

function dragOverFolder(folder: TFolder): void {
    if (!dragging.value || folder.opened) return;

    if (!folder.opened) {
        hoverFolder.value = folder;
        if (!hoverTimer.value) {
            hoverTimer.value = setTimeout(() => {
                emit('folder-open', folder);
                
                clearTimeout(hoverTimer.value);
                hoverTimer.value = undefined;
            }, 500);
        }
    }
}

function dragLeaveFolder(): void {
    hoverFolder.value = undefined;

    if (hoverTimer.value) {
        clearTimeout(hoverTimer.value);
        hoverTimer.value = undefined;
    }
}

function onFolderDrop(folder: TFolder) {
    // If dropped on the header (not inside sortable area, which is only present if opened)
    // Actually if it's opened, the sortable area is below. The header is the droppable target.
    // If already opened, we generally drag into the sortable area.
    // This handler is for dropping onto the folder item itself (header).
    if (folder.opened) return; // Let user drag into list

    if (!draggedId.value) return;
    
    emit('drop-file-on-folder', { id: draggedId.value, folder });
}

// Sortable Management
const sortableOptions = {
    sort: true,
    group: 'features',
    handle: '.drag-handle',
    dataIdAttr: 'id',
    onAdd: onFeatureAdd,
    onStart: (evt: SortableEvent) => {
        dragging.value = true;
        draggedId.value = evt.item.id;
    },
    onEnd: () => {
        dragging.value = false;
        draggedId.value = undefined;
    }
};

function initRootSortable() {
    if (rootFilesRef.value) {
        if (rootSortable) rootSortable.destroy();
        rootSortable = new Sortable(rootFilesRef.value, sortableOptions);
    }
}

function setFolderRef(el: Element | ComponentPublicInstance | null, folder: TFolder) {
    if (!el) {
        // Element removed (folder closed)
        const sortable = folderSortables.get(String(folder[props.folderKey]));
        if (sortable) {
            sortable.destroy();
            folderSortables.delete(String(folder[props.folderKey]));
        }
        return;
    }

    const folderId = String(folder[props.folderKey]);
    
    // Check if we already have a sortable for this folder that matches this element
    // Actually setFolderRef is called on render. 
    // If we already have one, destroy and recreate? Only if el changed?
    // Sortable binds to element.
    
    const htmlEl = el as HTMLElement;

    // Use a small delay/nextTick to ensure DOM is ready? 
    // But this is a ref callback.
    
    // We can't easily check if Sortable is attached to *this* exact element instance without storing the element.
    // But simplifying:
    
    const existing = folderSortables.get(folderId);
    if (existing) {
        // If element is same, do nothing?
        // Sortable doesn't expose 'el' easily on instance type def sometimes, but we can assume re-init is safer or check equality.
        // Actually, ref callback is called when element is mounted/updated.
        // Let's just re-init if needed or assume Vue handles it correctly.
        // Better: store the element alongside Sortable
        // For simplicity, just destroy and create.
        existing.destroy();
    }
    
    folderSortables.set(folderId, new Sortable(htmlEl, sortableOptions));
}

// Watchers
watch(() => props.folders, () => {
    // Folders list changed. 
    // Root sortable might need re-init if root container changed? No, root container is static `ref="rootFilesRef"`.
    // But if items changed? Sortable operates on DOM.
    // If folders are added/removed, the v-for updates.
}, { deep: true });

watch(() => props.files, () => {
    // If files list changes (DOM nodes added/removed), Sortable generally handles it, 
    // but if the list was empty and now has items, we might need to be careful?
    // Sortable is attached to the container. Data changes -> Vue DOM changes -> Sortable sees it.
}, { deep: true });


onMounted(() => {
    initRootSortable();
});

onBeforeUnmount(() => {
    if (rootSortable) rootSortable.destroy();
    folderSortables.forEach(s => s.destroy());
    folderSortables.clear();
});

defineExpose({
    openCreateModal
});

</script>

<style scoped>
.folder-manager {
    /* ... */
}
</style>
