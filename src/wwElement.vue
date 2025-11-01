<template>
  <div class="nextcloud-file-manager" :style="containerStyle">
    <!-- Header with breadcrumbs -->
    <div class="nc-header">
      <div class="nc-breadcrumbs">
        <span
          v-for="(crumb, index) in breadcrumbs"
          :key="index"
          class="nc-breadcrumb"
          @click="navigateToPath(crumb.path)"
        >
          {{ crumb.name }}
          <span v-if="index < breadcrumbs.length - 1" class="separator">/</span>
        </span>
      </div>
      <div class="nc-actions">
        <button
          v-if="props.content?.showUpload"
          @click="triggerFileUpload"
          class="nc-btn nc-btn-primary"
          :style="{ backgroundColor: props.content?.primaryColor }"
          :disabled="loading"
        >
          ↑ Upload
        </button>
        <button
          @click="createFolder"
          class="nc-btn"
          :disabled="loading"
        >
          + Ordner
        </button>
        <button
          @click="refreshDirectory"
          class="nc-btn"
          :disabled="loading"
        >
          ↻
        </button>
      </div>
    </div>

    <!-- Error message -->
    <div v-if="error" class="nc-error">
      {{ error }}
    </div>

    <!-- Loading indicator -->
    <div v-if="loading && !items.length" class="nc-loading">
      Lade...
    </div>

    <!-- File list -->
    <div v-else-if="items.length" class="nc-file-list">
      <div
        v-for="item in items"
        :key="item.path"
        class="nc-file-item"
        @click="handleItemClick(item)"
        :class="{ selected: selectedItem?.path === item.path }"
      >
        <div class="nc-file-icon">
          {{ item.type === 'directory' ? '📁' : getFileIcon(item.mime) }}
        </div>
        <div class="nc-file-info">
          <div class="nc-file-name">{{ item.name }}</div>
          <div class="nc-file-meta">
            {{ item.type === 'directory' ? 'Ordner' : formatFileSize(item.size) }}
            • {{ formatDate(item.lastModified) }}
          </div>
        </div>
        <div class="nc-file-actions" @click.stop>
          <button
            v-if="props.content?.showDownload && item.type === 'file'"
            @click="downloadFile(item)"
            class="nc-btn-icon"
            title="Download"
          >
            ⬇
          </button>
          <button
            v-if="props.content?.showShare"
            @click="shareItem(item)"
            class="nc-btn-icon"
            title="Teilen"
          >
            🔗
          </button>
          <button
            @click="deleteItem(item)"
            class="nc-btn-icon nc-btn-danger"
            title="Löschen"
          >
            🗑
          </button>
        </div>
      </div>
    </div>

    <!-- Empty state -->
    <div v-else-if="!loading" class="nc-empty">
      <p>Dieser Ordner ist leer</p>
    </div>

    <!-- Hidden file input for upload -->
    <input
      ref="fileInput"
      type="file"
      multiple
      style="display: none"
      @change="handleFileSelect"
    />

    <!-- Share modal -->
    <div v-if="shareModal.show" class="nc-modal" @click="closeShareModal">
      <div class="nc-modal-content" @click.stop>
        <div class="nc-modal-header">
          <h3>Teilen: {{ shareModal.item?.name }}</h3>
          <button @click="closeShareModal" class="nc-btn-close">×</button>
        </div>
        <div class="nc-modal-body">
          <div v-if="shareModal.loading" class="nc-loading">
            Erstelle Link...
          </div>
          <div v-else-if="shareModal.shareUrl">
            <p>Öffentlicher Link:</p>
            <div class="nc-share-link">
              <input
                :value="shareModal.shareUrl"
                readonly
                ref="shareLinkInput"
                class="nc-input"
              />
              <button
                @click="copyShareLink"
                class="nc-btn nc-btn-primary"
                :style="{ backgroundColor: props.content?.primaryColor }"
              >
                {{ shareModal.copied ? '✓ Kopiert' : 'Kopieren' }}
              </button>
            </div>
          </div>
          <div v-else-if="shareModal.error" class="nc-error">
            {{ shareModal.error }}
          </div>
        </div>
      </div>
    </div>

    <!-- Upload progress -->
    <div v-if="uploadProgress.show" class="nc-upload-progress">
      <div class="nc-upload-bar">
        <div
          class="nc-upload-fill"
          :style="{ width: uploadProgress.percent + '%', backgroundColor: props.content?.primaryColor }"
        ></div>
      </div>
      <div class="nc-upload-text">
        {{ uploadProgress.fileName }} - {{ uploadProgress.percent }}%
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, watch, onMounted } from 'vue';
import { NextcloudService } from './nextcloudService.js';

export default {
  name: 'NextcloudFileManager',
  props: {
    uid: { type: String, required: true },
    content: { type: Object, required: true },
    /* wwEditor:start */
    wwEditorState: { type: Object },
    /* wwEditor:end */
  },
  emits: ['trigger-event'],
  setup(props, { emit }) {
    // ===== Reactive State =====
    const ncService = ref(null);
    const currentPath = ref('/');
    const items = ref([]);
    const loading = ref(false);
    const error = ref(null);
    const selectedItem = ref(null);
    const fileInput = ref(null);
    const shareLinkInput = ref(null);

    const shareModal = ref({
      show: false,
      item: null,
      shareUrl: null,
      loading: false,
      error: null,
      copied: false,
    });

    const uploadProgress = ref({
      show: false,
      fileName: '',
      percent: 0,
    });

    // ===== Computed Properties =====
    const containerStyle = computed(() => ({
      '--bg-color': props.content?.backgroundColor || '#FFFFFF',
      '--text-color': props.content?.textColor || '#000000',
      '--border-radius': props.content?.borderRadius || '8px',
    }));

    const breadcrumbs = computed(() => {
      const parts = currentPath.value.split('/').filter(p => p);
      const crumbs = [{ name: 'Home', path: '/' }];

      let path = '';
      parts.forEach(part => {
        path += '/' + part;
        crumbs.push({ name: part, path });
      });

      return crumbs;
    });

    // ===== Methods =====
    const initializeClient = () => {
      try {
        ncService.value = new NextcloudService(
          props.content?.serverUrl,
          props.content?.username,
          props.content?.appPassword
        );

        if (!ncService.value.isConfigured()) {
          error.value = 'Bitte konfigurieren Sie Server-URL, Benutzername und App-Passwort.';
        } else {
          error.value = null;
        }
      } catch (err) {
        error.value = 'Fehler bei der Initialisierung: ' + err.message;
      }
    };

    const loadDirectory = async () => {
      if (!ncService.value?.isConfigured()) {
        return;
      }

      loading.value = true;
      error.value = null;

      try {
        items.value = await ncService.value.listDirectory(currentPath.value);

        // Sort: directories first, then files
        items.value.sort((a, b) => {
          if (a.type === b.type) {
            return a.name.localeCompare(b.name);
          }
          return a.type === 'directory' ? -1 : 1;
        });

        // Trigger WeWeb event
        emit('trigger-event', {
          name: 'directory-loaded',
          event: { path: currentPath.value, items: items.value },
        });
      } catch (err) {
        error.value = 'Fehler beim Laden: ' + err.message;
        items.value = [];
      } finally {
        loading.value = false;
      }
    };

    const navigateToPath = (path) => {
      currentPath.value = path;
      loadDirectory();
    };

    const handleItemClick = (item) => {
      selectedItem.value = item;

      if (item.type === 'directory') {
        currentPath.value = item.path;
        loadDirectory();
      }

      emit('trigger-event', {
        name: 'item-selected',
        event: { item },
      });
    };

    const refreshDirectory = () => {
      loadDirectory();
    };

    const triggerFileUpload = () => {
      if (fileInput.value) {
        fileInput.value.click();
      }
    };

    const handleFileSelect = async (event) => {
      const files = event.target.files;
      if (!files.length) return;

      for (const file of files) {
        await uploadFile(file);
      }

      // Clear input
      event.target.value = '';
    };

    const uploadFile = async (file) => {
      uploadProgress.value.show = true;
      uploadProgress.value.fileName = file.name;
      uploadProgress.value.percent = 0;

      try {
        const targetPath = currentPath.value + '/' + file.name;

        await ncService.value.uploadFile(targetPath, file, (percent) => {
          uploadProgress.value.percent = percent;
        });

        emit('trigger-event', {
          name: 'file-uploaded',
          event: { fileName: file.name, path: targetPath },
        });

        await loadDirectory();
      } catch (err) {
        error.value = 'Upload fehlgeschlagen: ' + err.message;
      } finally {
        uploadProgress.value.show = false;
      }
    };

    const downloadFile = async (item) => {
      try {
        const content = await ncService.value.downloadFile(item.path);

        const blob = new Blob([content]);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = item.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        emit('trigger-event', {
          name: 'file-downloaded',
          event: { item },
        });
      } catch (err) {
        error.value = 'Download fehlgeschlagen: ' + err.message;
      }
    };

    const shareItem = async (item) => {
      shareModal.value.show = true;
      shareModal.value.item = item;
      shareModal.value.loading = true;
      shareModal.value.shareUrl = null;
      shareModal.value.error = null;
      shareModal.value.copied = false;

      try {
        const result = await ncService.value.createShareLink(item.path);
        shareModal.value.shareUrl = result.shareUrl;

        emit('trigger-event', {
          name: 'share-created',
          event: { item, shareUrl: result.shareUrl },
        });
      } catch (err) {
        shareModal.value.error = 'Fehler beim Teilen: ' + err.message;
      } finally {
        shareModal.value.loading = false;
      }
    };

    const closeShareModal = () => {
      shareModal.value.show = false;
      shareModal.value.item = null;
      shareModal.value.shareUrl = null;
      shareModal.value.copied = false;
    };

    const copyShareLink = () => {
      if (shareLinkInput.value) {
        shareLinkInput.value.select();
        document.execCommand('copy');
        shareModal.value.copied = true;

        setTimeout(() => {
          shareModal.value.copied = false;
        }, 2000);
      }
    };

    const deleteItem = async (item) => {
      if (!confirm(`"${item.name}" wirklich löschen?`)) {
        return;
      }

      try {
        await ncService.value.deleteItem(item.path);

        emit('trigger-event', {
          name: 'item-deleted',
          event: { item },
        });

        await loadDirectory();
      } catch (err) {
        error.value = 'Löschen fehlgeschlagen: ' + err.message;
      }
    };

    const createFolder = async () => {
      const name = prompt('Ordnername:');
      if (!name) return;

      try {
        const path = currentPath.value + '/' + name;
        await ncService.value.createDirectory(path);

        emit('trigger-event', {
          name: 'folder-created',
          event: { name, path },
        });

        await loadDirectory();
      } catch (err) {
        error.value = 'Ordner erstellen fehlgeschlagen: ' + err.message;
      }
    };

    const getFileIcon = (mime) => {
      if (!mime) return '📄';

      if (mime.startsWith('image/')) return '🖼';
      if (mime.startsWith('video/')) return '🎥';
      if (mime.startsWith('audio/')) return '🎵';
      if (mime.includes('pdf')) return '📕';
      if (mime.includes('text/')) return '📝';
      if (mime.includes('zip') || mime.includes('compressed')) return '📦';

      return '📄';
    };

    const formatFileSize = (bytes) => {
      if (!bytes) return '0 B';

      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));

      return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    };

    const formatDate = (dateString) => {
      if (!dateString) return '';

      const date = new Date(dateString);
      return date.toLocaleDateString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    };

    // ===== Watchers =====
    watch([
      () => props.content?.serverUrl,
      () => props.content?.username,
      () => props.content?.appPassword,
    ], () => {
      initializeClient();
      loadDirectory();
    });

    // ===== Lifecycle =====
    onMounted(() => {
      initializeClient();
      currentPath.value = props.content?.initialPath || '/';
      loadDirectory();
    });

    // ===== Return for template =====
    return {
      props,
      currentPath,
      items,
      loading,
      error,
      selectedItem,
      fileInput,
      shareLinkInput,
      shareModal,
      uploadProgress,
      containerStyle,
      breadcrumbs,
      navigateToPath,
      handleItemClick,
      refreshDirectory,
      triggerFileUpload,
      handleFileSelect,
      downloadFile,
      shareItem,
      closeShareModal,
      copyShareLink,
      deleteItem,
      createFolder,
      getFileIcon,
      formatFileSize,
      formatDate,
    };
  },
};
</script>

<style scoped>
.nextcloud-file-manager {
  width: 100%;
  padding: 20px;
  box-sizing: border-box;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  background-color: var(--bg-color);
  color: var(--text-color);
  border-radius: var(--border-radius);
}

.nc-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  flex-wrap: wrap;
  gap: 10px;
}

.nc-breadcrumbs {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 5px;
}

.nc-breadcrumb {
  cursor: pointer;
  padding: 5px 10px;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.nc-breadcrumb:hover {
  background-color: rgba(0, 0, 0, 0.05);
}

.nc-breadcrumb .separator {
  margin-left: 5px;
  opacity: 0.5;
}

.nc-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.nc-btn {
  padding: 8px 16px;
  border: 1px solid #ddd;
  background: white;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.nc-btn:hover:not(:disabled) {
  background-color: #f5f5f5;
}

.nc-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.nc-btn-primary {
  color: white;
  border: none;
}

.nc-btn-primary:hover:not(:disabled) {
  opacity: 0.9;
}

.nc-error {
  padding: 12px;
  background-color: #fee;
  color: #c33;
  border-radius: 6px;
  margin-bottom: 15px;
}

.nc-loading {
  text-align: center;
  padding: 40px;
  opacity: 0.6;
}

.nc-file-list {
  border: 1px solid #ddd;
  border-radius: 8px;
  overflow: hidden;
}

.nc-file-item {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #eee;
  cursor: pointer;
  transition: background-color 0.2s;
}

.nc-file-item:last-child {
  border-bottom: none;
}

.nc-file-item:hover {
  background-color: rgba(0, 0, 0, 0.02);
}

.nc-file-item.selected {
  background-color: rgba(0, 130, 201, 0.1);
}

.nc-file-icon {
  font-size: 24px;
  margin-right: 12px;
  flex-shrink: 0;
}

.nc-file-info {
  flex: 1;
  min-width: 0;
}

.nc-file-name {
  font-weight: 500;
  margin-bottom: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.nc-file-meta {
  font-size: 12px;
  opacity: 0.6;
}

.nc-file-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

.nc-btn-icon {
  width: 32px;
  height: 32px;
  border: 1px solid #ddd;
  background: white;
  border-radius: 4px;
  cursor: pointer;
  font-size: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.nc-btn-icon:hover {
  background-color: #f5f5f5;
}

.nc-btn-danger:hover {
  background-color: #fee;
  border-color: #c33;
}

.nc-empty {
  text-align: center;
  padding: 60px 20px;
  opacity: 0.5;
}

.nc-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.nc-modal-content {
  background: white;
  border-radius: 12px;
  max-width: 500px;
  width: 90%;
  max-height: 90vh;
  overflow: auto;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
}

.nc-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid #eee;
}

.nc-modal-header h3 {
  margin: 0;
  font-size: 18px;
}

.nc-btn-close {
  width: 32px;
  height: 32px;
  border: none;
  background: none;
  font-size: 28px;
  cursor: pointer;
  color: #999;
  line-height: 1;
  padding: 0;
}

.nc-btn-close:hover {
  color: #333;
}

.nc-modal-body {
  padding: 20px;
}

.nc-share-link {
  display: flex;
  gap: 10px;
  margin-top: 10px;
}

.nc-input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  font-family: monospace;
}

.nc-upload-progress {
  position: fixed;
  bottom: 20px;
  right: 20px;
  background: white;
  padding: 16px;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  min-width: 300px;
  z-index: 999;
}

.nc-upload-bar {
  height: 8px;
  background-color: #eee;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 8px;
}

.nc-upload-fill {
  height: 100%;
  transition: width 0.3s;
  border-radius: 4px;
}

.nc-upload-text {
  font-size: 12px;
  opacity: 0.8;
}

@media (max-width: 768px) {
  .nextcloud-file-manager {
    padding: 12px;
  }

  .nc-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .nc-actions {
    width: 100%;
  }
}
</style>
