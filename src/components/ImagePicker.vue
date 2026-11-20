<script setup>
import { ref } from 'vue'
import { toDataUrl } from '../image'
import Icon from './Icon.vue'

const props = defineProps({
  modelValue: String,
  size: { type: Number, default: 56 },
  max: { type: Number, default: 320 },
  png: Boolean,
  disabled: Boolean
})
const emit = defineEmits(['update:modelValue'])
const err = ref('')

async function pick(e) {
  const file = e.target.files?.[0]
  e.target.value = ''
  if (!file) return
  err.value = ''
  try {
    emit('update:modelValue', await toDataUrl(file, { max: props.max, png: props.png }))
  } catch {
    err.value = 'Image illisible'
  }
}
</script>

<template>
  <div class="img-pick">
    <label class="img-box" :class="{ disabled }" :style="{ width: size + 'px', height: size + 'px' }" title="Choisir une image">
      <img v-if="modelValue" :src="modelValue" alt="" />
      <Icon v-else name="image" :size="Math.round(size / 2.5)" />
      <input type="file" accept="image/*" hidden :disabled="disabled" @change="pick" />
    </label>
    <button v-if="modelValue && !disabled" type="button" class="link-btn" @click="emit('update:modelValue', '')">Retirer</button>
    <span v-if="err" class="small" style="color: var(--bad)">{{ err }}</span>
  </div>
</template>
