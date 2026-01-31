<template>
  <div class="barcode-scanner">
    <div
      ref="scannerContainer"
      id="barcode-scanner-container"
      class="scanner-viewport"
      :class="{ 'scanner-active': isScanning }"
    ></div>

    <div class="scanner-controls">
      <Button
        v-if="!isScanning"
        label="Avvia Scanner"
        icon="pi pi-camera"
        class="p-button-primary"
        @click="startScanning"
        :loading="starting"
      />
      <Button
        v-else
        label="Stop Scanner"
        icon="pi pi-stop-circle"
        class="p-button-danger"
        @click="stopScanning"
      />
    </div>

    <div v-if="lastScannedCode" class="last-scanned">
      <i class="pi pi-check-circle"></i>
      <span>Ultimo codice: <strong>{{ lastScannedCode }}</strong></span>
    </div>

    <div v-if="errorMessage" class="scanner-error">
      <i class="pi pi-exclamation-triangle"></i>
      <span>{{ errorMessage }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import Button from 'primevue/button';

interface Props {
  active?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  active: false,
});

const emit = defineEmits<{
  (e: 'scanned', code: string): void;
  (e: 'error', message: string): void;
}>();

const scannerContainer = ref<HTMLElement | null>(null);
const isScanning = ref(false);
const starting = ref(false);
const lastScannedCode = ref('');
const errorMessage = ref('');

let html5QrCode: Html5Qrcode | null = null;
let lastScanTime = 0;
const SCAN_COOLDOWN = 2000; // 2 seconds between scans

const playBeep = () => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = 1000;
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.1);
  } catch (e) {
    console.log('Audio not supported');
  }
};

const vibrate = () => {
  if (navigator.vibrate) {
    navigator.vibrate(100);
  }
};

const onScanSuccess = (decodedText: string) => {
  const now = Date.now();
  if (now - lastScanTime < SCAN_COOLDOWN) {
    return; // Cooldown not expired
  }

  lastScanTime = now;
  lastScannedCode.value = decodedText;
  errorMessage.value = '';

  // Feedback
  playBeep();
  vibrate();

  emit('scanned', decodedText);
};

const onScanError = (error: string) => {
  // Ignore common scanning errors (no code found in frame)
  if (error.includes('No MultiFormat Readers') || error.includes('NotFoundException')) {
    return;
  }
  console.warn('Scan error:', error);
};

const startScanning = async () => {
  if (isScanning.value) return;

  try {
    starting.value = true;
    errorMessage.value = '';

    // Initialize scanner if not already done
    if (!html5QrCode) {
      html5QrCode = new Html5Qrcode('barcode-scanner-container');
    }

    // Supported barcode formats
    const formatsToSupport = [
      Html5QrcodeSupportedFormats.EAN_13,
      Html5QrcodeSupportedFormats.EAN_8,
      Html5QrcodeSupportedFormats.CODE_128,
      Html5QrcodeSupportedFormats.CODE_39,
      Html5QrcodeSupportedFormats.UPC_A,
      Html5QrcodeSupportedFormats.UPC_E,
      Html5QrcodeSupportedFormats.QR_CODE,
    ];

    await html5QrCode.start(
      { facingMode: 'environment' }, // Use back camera
      {
        fps: 10,
        qrbox: { width: 250, height: 150 },
        formatsToSupport,
      },
      onScanSuccess,
      onScanError
    );

    isScanning.value = true;
  } catch (err: any) {
    console.error('Failed to start scanner:', err);
    errorMessage.value = err.message || 'Impossibile avviare la fotocamera';
    emit('error', errorMessage.value);
  } finally {
    starting.value = false;
  }
};

const stopScanning = async () => {
  if (!isScanning.value || !html5QrCode) return;

  try {
    await html5QrCode.stop();
    isScanning.value = false;
  } catch (err) {
    console.error('Failed to stop scanner:', err);
  }
};

// Watch for active prop changes
watch(() => props.active, async (newVal) => {
  if (newVal && !isScanning.value) {
    await startScanning();
  } else if (!newVal && isScanning.value) {
    await stopScanning();
  }
});

onMounted(() => {
  if (props.active) {
    startScanning();
  }
});

onUnmounted(async () => {
  if (html5QrCode) {
    try {
      if (isScanning.value) {
        await html5QrCode.stop();
      }
      html5QrCode.clear();
    } catch (e) {
      console.error('Error cleaning up scanner:', e);
    }
  }
});

// Expose methods for parent component
defineExpose({
  startScanning,
  stopScanning,
  isScanning,
});
</script>

<style scoped>
.barcode-scanner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-4);
  width: 100%;
}

.scanner-viewport {
  width: 100%;
  max-width: 400px;
  min-height: 200px;
  background: var(--color-gray-900);
  border-radius: var(--border-radius-lg);
  overflow: hidden;
  position: relative;
}

.scanner-viewport.scanner-active {
  border: 3px solid var(--color-primary-500);
}

.scanner-viewport :deep(video) {
  width: 100% !important;
  border-radius: var(--border-radius-lg);
}

.scanner-viewport :deep(#qr-shaded-region) {
  border-width: 30px !important;
}

.scanner-controls {
  display: flex;
  gap: var(--space-2);
}

.last-scanned {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  background: var(--color-success-100);
  color: var(--color-success-700);
  border-radius: var(--border-radius-md);
  font-size: var(--font-size-sm);
}

.last-scanned i {
  color: var(--color-success);
}

.scanner-error {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  background: var(--color-danger-100);
  color: var(--color-danger-700);
  border-radius: var(--border-radius-md);
  font-size: var(--font-size-sm);
}

.scanner-error i {
  color: var(--color-danger);
}
</style>
