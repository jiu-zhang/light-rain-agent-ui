<script setup lang="ts">
import { ref, computed } from 'vue'
import { useChatStore } from '@renderer/stores'
import Icon from '@renderer/components/common/Icon.vue'

const chatStore = useChatStore()

const answer = ref('')
const submitting = ref(false)
const error = ref('')

const payload = computed(() => chatStore.pendingInput)
const show = computed(() => !!payload.value)

const options = computed(() => payload.value?.options?.filter((o) => o.trim()) ?? [])
const hasOptions = computed(() => options.value.length > 0)
const canSubmit = computed(() => hasOptions.value || answer.value.trim().length > 0)

function selectOption(opt: string): void {
  answer.value = opt
}

async function submit(): Promise<void> {
  if (!canSubmit.value || submitting.value) return
  submitting.value = true
  error.value = ''
  try {
    await chatStore.submitPendingInput(hasOptions.value ? answer.value : answer.value.trim())
    answer.value = ''
  } catch {
    error.value = '提交失败，请重试'
  } finally {
    submitting.value = false
  }
}

function cancel(): void {
  chatStore.pendingInput = null
  answer.value = ''
}
</script>

<template>
  <div v-if="show" class="input-modal-overlay">
    <div class="input-modal-box">
      <div class="input-modal-head">
        <Icon name="keyboard" :size="18" class="head-icon" />
        <span>等待你的输入</span>
      </div>
      <p class="input-question">{{ payload?.question }}</p>

      <div v-if="hasOptions" class="input-options">
        <button
          v-for="opt in options"
          :key="opt"
          class="option-btn"
          :class="{ active: answer === opt }"
          @click="selectOption(opt)"
        >
          {{ opt }}
        </button>
      </div>

      <textarea
        v-if="!hasOptions"
        v-model="answer"
        rows="3"
        class="input-textarea"
        placeholder="请输入你的回答..."
        @keydown.enter.exact.prevent="submit"
      ></textarea>

      <div v-if="error" class="input-error">{{ error }}</div>

      <div class="input-actions">
        <button class="action-btn" @click="cancel">中断任务</button>
        <button class="action-btn primary" :disabled="!canSubmit || submitting" @click="submit">
          <Icon v-if="submitting" name="loader" :size="13" class="spin" />
          提交
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.input-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 400;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: overlayIn 0.15s ease;
  backdrop-filter: blur(2px);
}

.input-modal-box {
  width: 420px;
  max-width: 92vw;
  background: var(--bg-elevated);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-xl);
  padding: 24px;
  box-shadow: var(--shadow-xl);
  animation: modalIn 0.2s ease;
}

.input-modal-head {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--accent-primary);
  margin-bottom: 14px;
}

.head-icon {
  color: var(--accent-primary);
}

.input-question {
  font-size: 15px;
  font-weight: 500;
  color: var(--text-primary);
  line-height: 1.6;
  margin-bottom: 18px;
  white-space: pre-wrap;
}

.input-options {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 18px;
}

.option-btn {
  text-align: left;
  padding: 10px 14px;
  border: 1px solid var(--border-color);
  background: var(--bg-tertiary);
  color: var(--text-secondary);
  font-size: 13px;
  border-radius: 10px;
  cursor: pointer;
  transition: all var(--transition-fast);
  font-family: inherit;
}

.option-btn:hover {
  border-color: var(--border-hover);
  color: var(--text-primary);
}

.option-btn.active {
  background: color-mix(in srgb, var(--accent-primary) 12%, transparent);
  border-color: var(--accent-primary);
  color: var(--accent-primary);
}

.input-textarea {
  width: 100%;
  padding: 10px 14px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  color: var(--text-primary);
  font-size: 13px;
  outline: none;
  resize: vertical;
  box-sizing: border-box;
  font-family: inherit;
  margin-bottom: 12px;
}

.input-error {
  font-size: 12px;
  color: var(--accent-error);
  margin-bottom: 10px;
}

.input-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.action-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border: 1px solid var(--border-color);
  background: var(--bg-tertiary);
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 500;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.action-btn:hover:not(:disabled) {
  border-color: var(--border-hover);
  color: var(--text-primary);
  background: var(--bg-hover);
}

.action-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.action-btn.primary {
  background: var(--accent-primary);
  border-color: var(--accent-primary);
  color: white;
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes overlayIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes modalIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
