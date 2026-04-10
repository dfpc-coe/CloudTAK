<template>
    <div
        ref='container'
        class='hb-container'
    >
        <div
            ref='backdrop'
            class='hb-backdrop'
            :style='backdropStyle'
        >
            <span
                v-for='(segment, index) in highlightedSegments'
                :key='index'
                :style='segment.style'
            >{{ segment.text }}</span>
        </div>
        <TablerInput
            ref='inputComponent'
            v-model='internalValue'
            class='hb-input'
            :label='props.label'
            :description='props.description'
            :rows='inputRows'
            :placeholder='props.placeholder'
            :disabled='props.disabled'
            @focus='isFocused = true'
            @blur='isFocused = false'
            @update:model-value='handleModelUpdate'
        />
        <ul 
            v-if='showSuggestions && filteredVariables.length' 
            class='hb-suggestions' 
            :style='{ top: `${suggestionPos.y}px`, left: `${suggestionPos.x}px` }'
        >
            <li 
                v-for='(opt, i) in filteredVariables' 
                :key='opt.key'
                :class='{ active: i === activeIndex }'
                @mousedown.prevent='selectSuggestion(opt)'
            >
                <span class='var-name'>{{ opt.key }}</span>
                <span
                    v-if='opt.hasChildren'
                    class='var-indicator'
                >
                    ❯
                </span>
            </li>
        </ul>
        <div
            v-if='isFocused'
            class='hb-helper form-hint'
        >
            <span>Type:</span>
            <span
                v-pre
                class='hb-helper-token'
            >
                {{
            </span>
            <span>to see template suggestions</span>
        </div>
    </div>
</template>

<script setup lang='ts'>
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue';
import { TablerInput } from '@tak-ps/vue-tabler';

interface SchemaNode {
  type?: string;
  properties?: Record<string, SchemaNode>;
  [key: string]: unknown;
}

const props = withDefaults(defineProps<{
  modelValue?: string | number;
  label?: string;
  description?: string;
  placeholder?: string;
  disabled?: boolean;
  rows?: number | string;
  schema?: SchemaNode;
}>(), {
  modelValue: '',
  label: undefined,
  description: undefined,
  placeholder: undefined,
  disabled: false,
  rows: 1,
  schema: () => ({
    type: "object",
    properties: {
      user: {
        type: "object",
        properties: {
          id: { type: "string" },
          profile: {
            type: "object",
            properties: {
              avatar_url: { type: "string" },
              bio: { type: "string" }
            }
          }
        }
      },
      system_date: { type: "string" }
    }
  })
});

const emit = defineEmits<{
  (e: 'update:modelValue', value: string | number): void;
}>();

const normalizeValue = (value: string | number | undefined | null): string => {
  if (value === undefined || value === null) return '';
  return String(value);
};

const getResolvedRows = (rows: number | string, value: string | number): number => {
  if (rows === '') {
    const lineCount = normalizeValue(value).split('\n').length;
    return Math.max(2, lineCount);
  }

  if (typeof rows === 'string') {
    const parsedRows = Number(rows);
    if (!Number.isNaN(parsedRows) && parsedRows > 0) return parsedRows;
  }

  if (typeof rows === 'number' && rows > 0) return rows;

  return 1;
};

const inputComponent = ref<InstanceType<typeof TablerInput> | null>(null);
const textarea = ref<HTMLTextAreaElement | HTMLInputElement | null>(null);
const container = ref<HTMLElement | null>(null);
const backdrop = ref<HTMLElement | null>(null);
const internalValue = ref<string>(normalizeValue(props.modelValue));
const isFocused = ref<boolean>(false);
const showSuggestions = ref<boolean>(false);
const suggestionPos = ref<{ x: number; y: number }>({ x: 0, y: 0 });
const activeIndex = ref<number>(0);
const currentPath = ref<string>('');
const backdropStyle = ref<Record<string, string>>({});

const inputRows = computed(() => {
  return getResolvedRows(props.rows, internalValue.value);
});

let resizeObserver: ResizeObserver | undefined;

const getNativeInput = (): HTMLTextAreaElement | HTMLInputElement | null => {
  return inputComponent.value?.$el?.querySelector('textarea, input') ?? null;
};

const handleNativeInput = (e: Event) => {
  handleInput(e.target as HTMLTextAreaElement | HTMLInputElement);
  syncBackdropMetrics();
};

const observeNativeInput = () => {
  if (typeof ResizeObserver === 'undefined' || !textarea.value) return;

  resizeObserver?.disconnect();
  resizeObserver = new ResizeObserver(() => {
    syncBackdropMetrics();
  });
  resizeObserver.observe(textarea.value);
};

const syncBackdropMetrics = () => {
  if (!textarea.value || !container.value) return;

  const inputRect = textarea.value.getBoundingClientRect();
  const containerRect = container.value.getBoundingClientRect();
  const inputStyle = window.getComputedStyle(textarea.value);
  const bodyColor = inputStyle.getPropertyValue('--tblr-body-color').trim();
  const emphasisColor = inputStyle.getPropertyValue('--tblr-emphasis-color').trim();
  const formsBackground = inputStyle.getPropertyValue('--tblr-bg-forms').trim();
  const disabledBackground = inputStyle.getPropertyValue('--tblr-bg-surface-secondary').trim();

  backdropStyle.value = {
    top: `${inputRect.top - containerRect.top}px`,
    left: `${inputRect.left - containerRect.left}px`,
    width: `${inputRect.width}px`,
    height: `${inputRect.height}px`,
    backgroundColor: props.disabled ? disabledBackground || formsBackground : formsBackground,
    paddingTop: inputStyle.paddingTop,
    paddingRight: inputStyle.paddingRight,
    paddingBottom: inputStyle.paddingBottom,
    paddingLeft: inputStyle.paddingLeft,
    borderRadius: inputStyle.borderRadius,
    boxSizing: inputStyle.boxSizing,
    fontFamily: inputStyle.fontFamily,
    fontSize: inputStyle.fontSize,
    fontStyle: inputStyle.fontStyle,
    fontWeight: inputStyle.fontWeight,
    letterSpacing: inputStyle.letterSpacing,
    lineHeight: inputStyle.lineHeight,
    textAlign: inputStyle.textAlign,
    textIndent: inputStyle.textIndent,
    textTransform: inputStyle.textTransform,
    tabSize: inputStyle.tabSize,
    color: bodyColor || emphasisColor || 'var(--tblr-body-color, #e5e7eb)',
    whiteSpace: textarea.value.tagName === 'TEXTAREA' ? 'pre-wrap' : 'pre',
    overflowWrap: textarea.value.tagName === 'TEXTAREA' ? 'break-word' : 'normal'
  };

  syncScroll();
};

const getCaretCoords = () => {
  if (!textarea.value || !container.value) return null;

  const inputRect = textarea.value.getBoundingClientRect();
  const containerRect = container.value.getBoundingClientRect();
  const inputStyle = window.getComputedStyle(textarea.value);
  const mirror = document.createElement('div');
  const marker = document.createElement('span');
  const valueBeforeCursor = textarea.value.value.slice(0, textarea.value.selectionStart ?? 0);
  const properties = [
    'boxSizing',
    'width',
    'height',
    'overflowX',
    'overflowY',
    'borderTopWidth',
    'borderRightWidth',
    'borderBottomWidth',
    'borderLeftWidth',
    'paddingTop',
    'paddingRight',
    'paddingBottom',
    'paddingLeft',
    'fontFamily',
    'fontSize',
    'fontStyle',
    'fontWeight',
    'letterSpacing',
    'lineHeight',
    'textAlign',
    'textIndent',
    'textTransform',
    'tabSize'
  ];

  mirror.style.position = 'absolute';
  mirror.style.visibility = 'hidden';
  mirror.style.pointerEvents = 'none';
  mirror.style.top = '0';
  mirror.style.left = '-9999px';
  mirror.style.whiteSpace = textarea.value.tagName === 'TEXTAREA' ? 'pre-wrap' : 'pre';
  mirror.style.overflowWrap = textarea.value.tagName === 'TEXTAREA' ? 'break-word' : 'normal';

  for (const property of properties) {
    (mirror.style as unknown as Record<string, string>)[property] = (inputStyle as unknown as Record<string, string>)[property];
  }

  mirror.textContent = valueBeforeCursor;
  if (textarea.value.tagName === 'TEXTAREA' && valueBeforeCursor.endsWith('\n')) {
    mirror.textContent += ' ';
  }

  marker.textContent = textarea.value.value.slice(textarea.value.selectionStart ?? 0) || '.';
  mirror.appendChild(marker);
  document.body.appendChild(mirror);

  const mirrorRect = mirror.getBoundingClientRect();
  const markerRect = marker.getBoundingClientRect();

  document.body.removeChild(mirror);

  return {
    x: inputRect.left - containerRect.left + markerRect.left - mirrorRect.left - textarea.value.scrollLeft,
    y: inputRect.top - containerRect.top + markerRect.top - mirrorRect.top - textarea.value.scrollTop,
    lineHeight: Number.parseFloat(inputStyle.lineHeight) || 0
  };
};

const bindNativeInput = () => {
  const nextTextarea = getNativeInput();
  if (textarea.value === nextTextarea) return;

  if (textarea.value) {
    textarea.value.removeEventListener('input', handleNativeInput);
    textarea.value.removeEventListener('scroll', syncScroll);
    textarea.value.removeEventListener('keydown', handleKeyDown);
  }

  textarea.value = nextTextarea;

  if (textarea.value) {
    textarea.value.spellcheck = false;
    textarea.value.addEventListener('input', handleNativeInput);
    textarea.value.addEventListener('scroll', syncScroll);
    textarea.value.addEventListener('keydown', handleKeyDown);
    observeNativeInput();
    syncBackdropMetrics();
  }
};

// --- Helper: Resolve path in JSON Schema ---
const getTargetSchema = (pathString: string): SchemaNode | null => {
  const parts = pathString.split('.').filter(p => p);
  let current = props.schema;

  for (const part of parts) {
    if (current?.properties && current.properties[part]) {
      current = current.properties[part];
    } else {
      return null;
    }
  }
  return current;
};

// --- Logic ---
const handleInput = (target: HTMLTextAreaElement | HTMLInputElement | null) => {
  if (!target) return;

  const cursor = target.selectionStart ?? 0;
  const textBefore = internalValue.value.substring(0, cursor);
  const match = textBefore.match(/\{\{([^}]*)$/);

  if (match) {
    showSuggestions.value = true;
    currentPath.value = match[1].trim();
    updateCursorCoords();
    activeIndex.value = 0;
  } else {
    showSuggestions.value = false;
  }
};

const handleModelUpdate = async () => {
  await nextTick();
  bindNativeInput();
  handleInput(textarea.value);
};

const filteredVariables = computed(() => {
  const parts = currentPath.value.split('.');
  const lastPart = parts.pop();
  const parentPath = parts.join('.');

  const target = parentPath === '' ? props.schema : getTargetSchema(parentPath);

  if (!target || !target.properties) return [];

  return Object.keys(target.properties)
    .filter(key => key.startsWith(lastPart!))
    .map(key => ({
      key,
      hasChildren: !!target.properties![key].properties
    }));
});

const getSelectedPath = (key: string): string => {
  const parts = currentPath.value.split('.');

  if (!parts.length) return key;

  parts[parts.length - 1] = key;
  return parts.filter((part) => part !== '').join('.');
};

const selectSuggestion = (option: { key: string; hasChildren: boolean }) => {
  if (!textarea.value) return;

  const cursor = textarea.value.selectionStart ?? 0;
  const textBefore = internalValue.value.substring(0, cursor);
  const textAfter = internalValue.value.substring(cursor);
  const selectedPath = getSelectedPath(option.key);

  const replacement = option.hasChildren ? selectedPath + '.' : selectedPath + '}}';
  const newBefore = textBefore.replace(/([a-zA-Z0-9_.]*)$/, replacement);
  internalValue.value = newBefore + textAfter;

  if (!option.hasChildren) {
    showSuggestions.value = false;
  } else {
    currentPath.value = `${selectedPath}.`;
    activeIndex.value = 0;
  }

  nextTick(() => {
    textarea.value?.focus();
    textarea.value?.setSelectionRange(newBefore.length, newBefore.length);

    if (option.hasChildren) {
      updateCursorCoords();
    }
  });
};

const highlightedSegments = computed(() => {
  const content = internalValue.value;
  const hbsRegex = /(\{\{\{?#?\/?)\s*([a-zA-Z0-9_.]+)\s*(\}?\}\})/g;
  const segments: { text: string; style: string | undefined }[] = [];
  let lastIndex = 0;

  for (const match of content.matchAll(hbsRegex)) {
    const index = match.index ?? 0;
    const [fullMatch, open, path, close] = match;

    if (index > lastIndex) {
      segments.push({ text: content.slice(lastIndex, index), style: undefined });
    }

    const isValid = getTargetSchema(path) !== null;
    const delimiterStyle = 'color: var(--tblr-warning-text-emphasis, var(--tblr-warning, #f59f00));';
    const pathStyle = isValid
      ? 'color: var(--tblr-primary-text-emphasis, rgb(var(--tblr-primary-rgb, 32, 107, 196)));'
      : 'color: var(--tblr-danger-text-emphasis, rgb(var(--tblr-danger-rgb, 214, 57, 57))); text-decoration: underline wavy;';

    segments.push({ text: open, style: delimiterStyle });
    segments.push({ text: path, style: pathStyle });
    segments.push({ text: close, style: delimiterStyle });

    lastIndex = index + fullMatch.length;
  }

  if (lastIndex < content.length || !segments.length) {
    segments.push({ text: content.slice(lastIndex), style: undefined });
  }

  return segments;
});

const handleKeyDown = (e: Event) => {
  const ke = e as KeyboardEvent;
  if (!showSuggestions.value || !filteredVariables.value.length) return;
  if (ke.key === 'ArrowDown') {
    ke.preventDefault();
    activeIndex.value = (activeIndex.value + 1) % filteredVariables.value.length;
  } else if (ke.key === 'ArrowUp') {
    ke.preventDefault();
    activeIndex.value = (activeIndex.value - 1 + filteredVariables.value.length) % filteredVariables.value.length;
  } else if (ke.key === 'Enter' || ke.key === 'Tab') {
    ke.preventDefault();
    selectSuggestion(filteredVariables.value[activeIndex.value]);
  } else if (ke.key === 'Escape') {
    showSuggestions.value = false;
  }
};

const updateCursorCoords = () => {
  const coords = getCaretCoords();
  if (!coords) return;

  suggestionPos.value = {
    x: coords.x,
    y: coords.y + coords.lineHeight
  };
};

const syncScroll = () => {
  if (!backdrop.value || !textarea.value) return;

  backdrop.value.scrollTop = textarea.value.scrollTop;
  backdrop.value.scrollLeft = textarea.value.scrollLeft;
};

onMounted(async () => {
  await nextTick();
  bindNativeInput();
  window.addEventListener('resize', syncBackdropMetrics);
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  window.removeEventListener('resize', syncBackdropMetrics);

  if (!textarea.value) return;

  textarea.value.removeEventListener('input', handleNativeInput);
  textarea.value.removeEventListener('scroll', syncScroll);
  textarea.value.removeEventListener('keydown', handleKeyDown);
});

watch(() => props.modelValue, (v) => internalValue.value = normalizeValue(v));
watch(internalValue, (v) => emit('update:modelValue', v));
watch(() => props.rows, async () => {
  await nextTick();
  bindNativeInput();
});
watch(() => props.disabled, async () => {
  await nextTick();
  syncBackdropMetrics();
});
</script>

<style scoped>
.hb-container { position: relative; }
.hb-backdrop { position: absolute; z-index: 1; pointer-events: none; overflow: hidden; }
.hb-input { position: relative; z-index: 2; margin: 0; --bs-gutter-x: 0; }
.hb-input :deep(.form-control) {
    color: transparent;
    caret-color: var(--tblr-emphasis-color, var(--tblr-body-color, #e5e7eb));
    background-color: transparent !important;
    -webkit-text-fill-color: transparent;
}
.hb-input :deep(.form-control:focus) { background-color: transparent !important; }
.hb-input :deep(.form-control:disabled) { background-color: transparent !important; }
.hb-input :deep(.form-control::placeholder) { color: var(--tblr-secondary, #667382); }
.hb-suggestions {
    position: absolute; z-index: 100; background: var(--tblr-bg-surface, #fff); border: 1px solid var(--tblr-border-color, #dce1e7);
    list-style: none; padding: 4px 0; margin: 0; box-shadow: var(--tblr-box-shadow-dropdown, 0 0.5rem 1rem rgba(0, 0, 0, 0.15));
    border-radius: var(--tblr-border-radius, 4px); min-width: 180px;
}
.hb-suggestions li { padding: 6px 12px; cursor: pointer; display: flex; justify-content: space-between; align-items: center; }
.hb-suggestions li.active { background: var(--tblr-primary, #206bc4); color: var(--tblr-bg-surface, #fff); }
.hb-helper { display: flex; align-items: center; gap: 0.375rem; margin-top: 0.375rem; }
.hb-helper-token {
    display: inline-flex;
    align-items: center;
    padding: 0.125rem 0.375rem;
    border-radius: var(--tblr-border-radius-sm, 4px);
    background: var(--tblr-bg-surface-secondary, rgba(127, 127, 127, 0.12));
    color: var(--tblr-emphasis-color, var(--tblr-body-color, #e5e7eb));
    font-family: var(--tblr-font-monospace, monospace);
    font-size: 0.75rem;
    line-height: 1.2;
}
.var-indicator { font-size: 10px; opacity: 0.6; }
</style>
