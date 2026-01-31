<template>
  <div class="images-manager">
    <!-- Add Image Section with Tabs -->
    <div class="add-image-section">
      <div class="add-mode-tabs">
        <Button
          :label="'Upload File'"
          :icon="'pi pi-upload'"
          :class="addMode === 'upload' ? '' : 'p-button-outlined'"
          @click="addMode = 'upload'"
          size="small"
        />
        <Button
          :label="'URL'"
          :icon="'pi pi-link'"
          :class="addMode === 'url' ? '' : 'p-button-outlined'"
          @click="addMode = 'url'"
          size="small"
        />
      </div>

      <!-- Upload Mode -->
      <div v-if="addMode === 'upload'" class="upload-section">
        <FileUpload
          mode="basic"
          name="image"
          accept="image/*"
          :maxFileSize="10000000"
          @select="onFileSelect"
          :auto="false"
          chooseLabel="Scegli Immagine"
          class="upload-button"
          :disabled="uploading"
        />
        <Button
          v-if="selectedFile"
          icon="pi pi-cloud-upload"
          label="Carica"
          @click="uploadFile"
          :loading="uploading"
          class="ml-2"
        />
        <span v-if="selectedFile" class="selected-file ml-2">
          {{ selectedFile.name }}
        </span>
        <small class="help-text">Formati supportati: JPEG, PNG, GIF, WebP. Max 10MB.</small>
      </div>

      <!-- URL Mode -->
      <div v-else class="url-section">
        <div class="p-inputgroup">
          <InputText
            v-model="newImageUrl"
            placeholder="URL immagine..."
            class="flex-1"
            @keyup.enter="addImageByUrl"
          />
          <Button
            icon="pi pi-plus"
            label="Aggiungi"
            @click="addImageByUrl"
            :loading="adding"
            :disabled="!newImageUrl.trim()"
          />
        </div>
        <small class="help-text">Inserisci l'URL dell'immagine da aggiungere</small>
      </div>
    </div>

    <!-- Images Grid -->
    <div v-if="images.length > 0" class="images-grid">
      <div
        v-for="(image, index) in images"
        :key="image.id"
        class="image-card"
        :class="{ 'is-main': image.isMain }"
        draggable="true"
        @dragstart="onDragStart(index, $event)"
        @dragover.prevent
        @drop="onDrop(index)"
        @dragend="onDragEnd"
      >
        <div class="image-preview">
          <img :src="getImageSrc(image.src)" :alt="image.alt || 'Product image'" @error="onImageError($event)" />
          <div class="image-actions">
            <Button
              v-if="!image.isMain"
              icon="pi pi-star"
              class="p-button-rounded p-button-sm p-button-warning"
              v-tooltip.top="'Imposta come principale'"
              @click="setAsMain(image)"
              :loading="settingMain === image.id"
            />
            <Button
              icon="pi pi-pencil"
              class="p-button-rounded p-button-sm p-button-info"
              v-tooltip.top="'Modifica'"
              @click="editImage(image)"
            />
            <Button
              icon="pi pi-trash"
              class="p-button-rounded p-button-sm p-button-danger"
              v-tooltip.top="'Elimina'"
              @click="confirmDelete(image)"
              :loading="deleting === image.id"
            />
          </div>
        </div>
        <div class="image-info">
          <span v-if="image.isMain" class="main-badge">
            <i class="pi pi-star-fill"></i> Principale
          </span>
          <span v-else class="position-badge">{{ index + 1 }}</span>
          <small class="image-name" v-if="image.name">{{ image.name }}</small>
        </div>
        <div class="drag-handle">
          <i class="pi pi-bars"></i>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else class="empty-state">
      <i class="pi pi-images"></i>
      <p>Nessuna immagine</p>
      <small>Carica un file o inserisci un URL per aggiungere immagini</small>
    </div>

    <!-- Edit Dialog -->
    <Dialog
      v-model:visible="editDialogVisible"
      header="Modifica Immagine"
      :modal="true"
      :style="{ width: '500px' }"
    >
      <div class="edit-form" v-if="editingImage">
        <div class="field">
          <label>URL Immagine</label>
          <InputText v-model="editingImage.src" class="w-full" />
        </div>
        <div class="field">
          <label>Testo Alternativo (ALT)</label>
          <InputText v-model="editingImage.alt" class="w-full" placeholder="Descrizione immagine" />
        </div>
        <div class="field">
          <label>Nome</label>
          <InputText v-model="editingImage.name" class="w-full" placeholder="Nome file" />
        </div>
        <div class="preview-section">
          <img :src="getImageSrc(editingImage.src)" alt="Preview" class="preview-image" @error="onImageError($event)" />
        </div>
      </div>
      <template #footer>
        <Button label="Annulla" icon="pi pi-times" class="p-button-text" @click="editDialogVisible = false" />
        <Button label="Salva" icon="pi pi-check" @click="saveImage" :loading="saving" />
      </template>
    </Dialog>

    <!-- Delete Confirmation -->
    <ConfirmDialog />
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';
import InputText from 'primevue/inputtext';
import Button from 'primevue/button';
import Dialog from 'primevue/dialog';
import FileUpload from 'primevue/fileupload';
import ConfirmDialog from 'primevue/confirmdialog';
import { useConfirm } from 'primevue/useconfirm';
import { useToast } from 'primevue/usetoast';
import api from '../services/api.service';

interface ProductImage {
  id: string;
  src: string;
  alt?: string;
  name?: string;
  position: number;
  isMain: boolean;
}

interface Props {
  productId: string;
}

const props = defineProps<Props>();
const confirm = useConfirm();
const toast = useToast();

const images = ref<ProductImage[]>([]);
const loading = ref(false);
const adding = ref(false);
const uploading = ref(false);
const saving = ref(false);
const deleting = ref<string | null>(null);
const settingMain = ref<string | null>(null);
const newImageUrl = ref('');
const editDialogVisible = ref(false);
const editingImage = ref<ProductImage | null>(null);
const dragIndex = ref<number | null>(null);
const addMode = ref<'upload' | 'url'>('upload');
const selectedFile = ref<File | null>(null);

// Base URL del server per le immagini uploadate
const getImageSrc = (src: string) => {
  if (!src) return '';
  if (src.startsWith('http://') || src.startsWith('https://')) {
    return src;
  }
  // Immagine locale - costruisci URL completo
  return `${import.meta.env.VITE_API_URL?.replace('/api/v1', '') || 'http://localhost:3100'}${src}`;
};

const loadImages = async () => {
  if (!props.productId) return;

  try {
    loading.value = true;
    const response = await api.get(`/products/${props.productId}/images`);
    if (response.success) {
      images.value = response.data || [];
    }
  } catch (error) {
    console.error('Error loading images:', error);
  } finally {
    loading.value = false;
  }
};

const onFileSelect = (event: any) => {
  if (event.files && event.files.length > 0) {
    selectedFile.value = event.files[0];
  }
};

const uploadFile = async () => {
  if (!selectedFile.value || !props.productId) return;

  try {
    uploading.value = true;

    const formData = new FormData();
    formData.append('image', selectedFile.value);

    // Usa fetch diretto per multipart
    const token = localStorage.getItem('token');
    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3100';

    const response = await fetch(`${baseUrl}/api/v1/products/${props.productId}/images/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    });

    const result = await response.json();

    if (result.success) {
      images.value.push(result.data);
      selectedFile.value = null;
      toast.add({
        severity: 'success',
        summary: 'Immagine caricata',
        detail: 'Immagine caricata con successo',
        life: 3000,
      });
    } else {
      throw new Error(result.error || 'Errore upload');
    }
  } catch (error: any) {
    toast.add({
      severity: 'error',
      summary: 'Errore Upload',
      detail: error.message || 'Errore durante il caricamento',
      life: 5000,
    });
  } finally {
    uploading.value = false;
  }
};

const addImageByUrl = async () => {
  if (!newImageUrl.value.trim()) return;

  try {
    adding.value = true;
    const response = await api.post(`/products/${props.productId}/images`, {
      src: newImageUrl.value.trim(),
    });

    if (response.success) {
      images.value.push(response.data);
      newImageUrl.value = '';
      toast.add({
        severity: 'success',
        summary: 'Immagine aggiunta',
        life: 3000,
      });
    }
  } catch (error: any) {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: error.message || 'Errore aggiunta immagine',
      life: 3000,
    });
  } finally {
    adding.value = false;
  }
};

const editImage = (image: ProductImage) => {
  editingImage.value = { ...image };
  editDialogVisible.value = true;
};

const saveImage = async () => {
  if (!editingImage.value) return;

  try {
    saving.value = true;
    const response = await api.put(
      `/products/${props.productId}/images/${editingImage.value.id}`,
      {
        src: editingImage.value.src,
        alt: editingImage.value.alt,
        name: editingImage.value.name,
      }
    );

    if (response.success) {
      const index = images.value.findIndex(i => i.id === editingImage.value!.id);
      if (index !== -1) {
        images.value[index] = response.data;
      }
      editDialogVisible.value = false;
      toast.add({
        severity: 'success',
        summary: 'Immagine aggiornata',
        life: 3000,
      });
    }
  } catch (error: any) {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: error.message || 'Errore salvataggio',
      life: 3000,
    });
  } finally {
    saving.value = false;
  }
};

const setAsMain = async (image: ProductImage) => {
  try {
    settingMain.value = image.id;
    const response = await api.put(`/products/${props.productId}/images/${image.id}/main`);

    if (response.success) {
      // Update local state
      images.value.forEach(img => {
        img.isMain = img.id === image.id;
      });
      // Riordina per mettere la principale prima
      images.value.sort((a, b) => {
        if (a.isMain) return -1;
        if (b.isMain) return 1;
        return a.position - b.position;
      });
      toast.add({
        severity: 'success',
        summary: 'Immagine principale aggiornata',
        life: 3000,
      });
    }
  } catch (error: any) {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: error.message,
      life: 3000,
    });
  } finally {
    settingMain.value = null;
  }
};

const confirmDelete = (image: ProductImage) => {
  confirm.require({
    message: 'Sei sicuro di voler eliminare questa immagine?',
    header: 'Conferma Eliminazione',
    icon: 'pi pi-exclamation-triangle',
    acceptClass: 'p-button-danger',
    accept: () => deleteImage(image),
  });
};

const deleteImage = async (image: ProductImage) => {
  try {
    deleting.value = image.id;
    const response = await api.delete(`/products/${props.productId}/images/${image.id}`);

    if (response.success) {
      images.value = images.value.filter(i => i.id !== image.id);
      toast.add({
        severity: 'success',
        summary: 'Immagine eliminata',
        life: 3000,
      });
    }
  } catch (error: any) {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: error.message,
      life: 3000,
    });
  } finally {
    deleting.value = null;
  }
};

// Drag & Drop
const onDragStart = (index: number, event: DragEvent) => {
  dragIndex.value = index;
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move';
  }
};

const onDrop = async (targetIndex: number) => {
  if (dragIndex.value === null || dragIndex.value === targetIndex) return;

  // Riordina localmente
  const draggedItem = images.value[dragIndex.value];
  images.value.splice(dragIndex.value, 1);
  images.value.splice(targetIndex, 0, draggedItem);

  // Salva nuovo ordine
  try {
    const imageIds = images.value.map(img => img.id);
    await api.put(`/products/${props.productId}/images/reorder`, { imageIds });

    // Aggiorna isMain e position localmente
    images.value.forEach((img, idx) => {
      img.position = idx;
      img.isMain = idx === 0;
    });
  } catch (error: any) {
    toast.add({
      severity: 'error',
      summary: 'Errore riordino',
      detail: error.message,
      life: 3000,
    });
    // Ricarica per stato corretto
    loadImages();
  }
};

const onDragEnd = () => {
  dragIndex.value = null;
};

const onImageError = (event: Event) => {
  const img = event.target as HTMLImageElement;
  img.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iI2VlZSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjYWFhIiBmb250LXNpemU9IjEyIj5ObyBJbWFnZTwvdGV4dD48L3N2Zz4=';
};

watch(() => props.productId, () => {
  loadImages();
}, { immediate: true });

onMounted(() => {
  if (props.productId) {
    loadImages();
  }
});
</script>

<style scoped>
.images-manager {
  padding: 1rem 0;
}

.add-image-section {
  margin-bottom: 1.5rem;
}

.add-mode-tabs {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.upload-section,
.url-section {
  max-width: 600px;
}

.upload-section {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
}

.selected-file {
  color: #64748b;
  font-size: 0.9rem;
}

.help-text {
  display: block;
  margin-top: 0.5rem;
  color: #64748b;
  width: 100%;
}

.url-section .p-inputgroup {
  max-width: 100%;
}

.images-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 1rem;
}

.image-card {
  position: relative;
  background: #f8fafc;
  border-radius: 8px;
  overflow: hidden;
  border: 2px solid #e2e8f0;
  transition: all 0.2s ease;
  cursor: grab;
}

.image-card:hover {
  border-color: #3b82f6;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.image-card.is-main {
  border-color: #22c55e;
  border-width: 3px;
}

.image-card:active {
  cursor: grabbing;
}

.image-preview {
  position: relative;
  aspect-ratio: 1;
  overflow: hidden;
}

.image-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.image-actions {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.image-card:hover .image-actions {
  opacity: 1;
}

.image-info {
  padding: 0.5rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
}

.main-badge {
  background: #22c55e;
  color: white;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.position-badge {
  background: #64748b;
  color: white;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
}

.image-name {
  color: #64748b;
  font-size: 0.75rem;
  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
  max-width: 100%;
}

.drag-handle {
  position: absolute;
  top: 0.5rem;
  left: 0.5rem;
  background: rgba(255, 255, 255, 0.9);
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  color: #64748b;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.image-card:hover .drag-handle {
  opacity: 1;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem;
  color: #9ca3af;
  text-align: center;
}

.empty-state i {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.empty-state p {
  font-size: 1.1rem;
  margin-bottom: 0.5rem;
}

/* Edit Dialog */
.edit-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.edit-form .field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.edit-form label {
  font-weight: 600;
  color: #475569;
}

.preview-section {
  margin-top: 1rem;
  text-align: center;
}

.preview-image {
  max-width: 100%;
  max-height: 200px;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
}

.w-full {
  width: 100%;
}

.ml-2 {
  margin-left: 0.5rem;
}

/* Upload button styling */
:deep(.upload-button .p-button) {
  background: #3b82f6;
}
</style>
