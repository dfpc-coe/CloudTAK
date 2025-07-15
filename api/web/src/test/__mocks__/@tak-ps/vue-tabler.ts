// Mock @tak-ps/vue-tabler components
export const TablerLoading = {
  name: 'TablerLoading',
  template: '<div data-testid="tabler-loading">{{ desc || "Loading..." }}</div>',
  props: ['desc'],
}

export const TablerInput = {
  name: 'TablerInput',
  template: `
    <div data-testid="tabler-input">
      <input 
        :type="type || 'text'"
        :placeholder="placeholder" 
        :value="modelValue"
        @input="$emit('update:modelValue', $event.target.value)"
        @keyup="$emit('keyup', $event)"
        data-testid="tabler-input-field"
      />
    </div>
  `,
  props: ['modelValue', 'type', 'placeholder', 'icon', 'label'],
  emits: ['update:modelValue', 'keyup'],
}

export default {
  TablerLoading,
  TablerInput,
}