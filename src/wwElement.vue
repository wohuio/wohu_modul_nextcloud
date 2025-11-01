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
          v-if="content.showUpload"
          @click="triggerFileUpload"
          class="nc-btn nc-btn-primary"
          :style="{ backgroundColor: content.primaryColor }"
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
        :class="{ selected: selectedItem && selectedItem.path === item.path }"
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
            v-if="content.showDownload && item.type === 'file'"
            @click="downloadFile(item)"
            class="nc-btn-icon"
            title="Download"
          >
            ⬇
          </button>
          <button
            v-if="content.showShare"
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
          <h3>Teilen: {{ shareModal.item ? shareModal.item.name : '' }}</h3>
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
                :style="{ backgroundColor: content.primaryColor }"
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
          :style="{ width: uploadProgress.percent + '%', backgroundColor: content.primaryColor }"
        ></div>
      </div>
      <div class="nc-upload-text">
        {{ uploadProgress.fileName }} - {{ uploadProgress.percent }}%
      </div>
    </div>
  </div>
</template>

<script>
import { NextcloudService } from './nextcloudService.js';

export default {
  name: 'NextcloudFileManager',
  props: {
    uid: { type: String, required: true },
    content: { type: Object, required: true },
  },
  data() {
    return {
      ncService: null,
      currentPath: '/',
      items: [],
      loading: false,
      error: null,
      selectedItem: null,
      shareModal: {
        show: false,
        item: null,
        shareUrl: null,
        loading: false,
        error: null,
        copied: false,
      },
      uploadProgress: {
        show: false,
        fileName: '',
        percent: 0,
      },
    };
  },
  computed: {
    containerStyle() {
      return {
        '--bg-color': this.content.backgroundColor || '#FFFFFF',
        '--text-color': this.content.textColor || '#000000',
        '--border-radius': this.content.borderRadius || '8px',
      };
    },
    breadcrumbs() {
      const parts = this.currentPath.split('/').filter(p => p);
      const crumbs = [{ name: 'Home', path: '/' }];

      let path = '';
      parts.forEach(part => {
        path += '/' + part;
        crumbs.push({ name: part, path });
      });

      return crumbs;
    },
  },
  watch: {
    'content.serverUrl': function() {
      this.initializeClient();
      this.loadDirectory();
    },
    'content.username': function() {
      this.initializeClient();
      this.loadDirectory();
    },
    'content.appPassword': function() {
      this.initializeClient();
      this.loadDirectory();
    },
  },
  mounted() {
    this.initializeClient();
    this.currentPath = this.content.initialPath || '/';
    this.loadDirectory();
  },
  methods: {
    initializeClient() {
      try {
        this.ncService = new NextcloudService(
          this.content.serverUrl,
          this.content.username,
          this.content.appPassword
        );

        if (!this.ncService.isConfigured()) {
          this.error = 'Bitte konfigurieren Sie Server-URL, Benutzername und App-Passwort.';
        } else {
          this.error = null;
        }
      } catch (err) {
        this.error = 'Fehler bei der Initialisierung: ' + err.message;
      }
    },

    async loadDirectory() {
      if (!this.ncService || !this.ncService.isConfigured()) {
        return;
      }

      this.loading = true;
      this.error = null;

      try {
        console.log('Loading directory:', this.currentPath);
        console.log('Server URL:', this.content.serverUrl);
        console.log('Username:', this.content.username);

        this.items = await this.ncService.listDirectory(this.currentPath);

        console.log('Loaded items:', this.items.length);

        // Sort: directories first, then files
        this.items.sort((a, b) => {
          if (a.type === b.type) {
            return a.name.localeCompare(b.name);
          }
          return a.type === 'directory' ? -1 : 1;
        });

        // Trigger WeWeb event
        this.$emit('trigger-event', {
          name: 'directory-loaded',
          event: { path: this.currentPath, items: this.items },
        });
      } catch (err) {
        console.error('Load directory error:', err);
        this.error = 'Fehler beim Laden: ' + err.message;
        this.items = [];
      } finally {
        this.loading = false;
      }
    },

    navigateToPath(path) {
      this.currentPath = path;
      this.loadDirectory();
    },

    handleItemClick(item) {
      this.selectedItem = item;

      if (item.type === 'directory') {
        this.currentPath = item.path;
        this.loadDirectory();
      }

      this.$emit('trigger-event', {
        name: 'item-selected',
        event: { item },
      });
    },

    refreshDirectory() {
      this.loadDirectory();
    },

    triggerFileUpload() {
      if (this.$refs.fileInput) {
        this.$refs.fileInput.click();
      }
    },

    async handleFileSelect(event) {
      const files = event.target.files;
      if (!files.length) return;

      for (const file of files) {
        await this.uploadFile(file);
      }

      // Clear input
      event.target.value = '';
    },

    async uploadFile(file) {
      this.uploadProgress.show = true;
      this.uploadProgress.fileName = file.name;
      this.uploadProgress.percent = 0;

      try {
        const targetPath = this.currentPath + '/' + file.name;

        await this.ncService.uploadFile(targetPath, file, (percent) => {
          this.uploadProgress.percent = percent;
        });

        this.$emit('trigger-event', {
          name: 'file-uploaded',
          event: { fileName: file.name, path: targetPath },
        });

        await this.loadDirectory();
      } catch (err) {
        this.error = 'Upload fehlgeschlagen: ' + err.message;
      } finally {
        this.uploadProgress.show = false;
      }
    },

    async downloadFile(item) {
      try {
        const content = await this.ncService.downloadFile(item.path);

        const blob = new Blob([content]);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = item.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        this.$emit('trigger-event', {
          name: 'file-downloaded',
          event: { item },
        });
      } catch (err) {
        this.error = 'Download fehlgeschlagen: ' + err.message;
      }
    },

    async shareItem(item) {
      this.shareModal.show = true;
      this.shareModal.item = item;
      this.shareModal.shareUrl = null;
      this.shareModal.loading = true;
      this.shareModal.error = null;
      this.shareModal.copied = false;

      try {
        const result = await this.ncService.createShareLink(item.path);
        this.shareModal.shareUrl = result.shareUrl;

        this.$emit('trigger-event', {
          name: 'share-created',
          event: { item, shareUrl: result.shareUrl },
        });
      } catch (err) {
        this.shareModal.error = 'Fehler beim Erstellen des Links: ' + err.message;
      } finally {
        this.shareModal.loading = false;
      }
    },

    closeShareModal() {
      this.shareModal.show = false;
      this.shareModal.copied = false;
    },

    copyShareLink() {
      if (this.$refs.shareLinkInput) {
        this.$refs.shareLinkInput.select();
        document.execCommand('copy');
        this.shareModal.copied = true;

        setTimeout(() => {
          this.shareModal.copied = false;
        }, 2000);
      }
    },

    async deleteItem(item) {
      const confirmed = confirm(`Möchten Sie "${item.name}" wirklich löschen?`);
      if (!confirmed) return;

      try {
        await this.ncService.deleteItem(item.path);

        this.$emit('trigger-event', {
          name: 'item-deleted',
          event: { item },
        });

        await this.loadDirectory();
      } catch (err) {
        this.error = 'Löschen fehlgeschlagen: ' + err.message;
      }
    },

    async createFolder() {
      const folderName = prompt('Ordnername:');
      if (!folderName) return;

      try {
        const newPath = this.currentPath + '/' + folderName;
        await this.ncService.createDirectory(newPath);

        this.$emit('trigger-event', {
          name: 'folder-created',
          event: { name: folderName, path: newPath },
        });

        await this.loadDirectory();
      } catch (err) {
        this.error = 'Ordner erstellen fehlgeschlagen: ' + err.message;
      }
    },

    getFileIcon(mime) {
      if (!mime) return '📄';
      if (mime.startsWith('image/')) return '🖼️';
      if (mime.startsWith('video/')) return '🎥';
      if (mime.startsWith('audio/')) return '🎵';
      if (mime.includes('pdf')) return '📕';
      if (mime.includes('word') || mime.includes('document')) return '📘';
      if (mime.includes('excel') || mime.includes('spreadsheet')) return '📊';
      if (mime.includes('powerpoint') || mime.includes('presentation')) return '📙';
      if (mime.includes('zip') || mime.includes('compressed')) return '📦';
      return '📄';
    },

    formatFileSize(bytes) {
      if (!bytes || bytes === 0) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    },

    formatDate(dateString) {
      if (!dateString) return '';
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return dateString;
      return date.toLocaleDateString('de-DE') + ' ' + date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    },
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
  gap: 5px;
  flex-wrap: wrap;
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
  margin: 0 5px;
  color: rgba(0, 0, 0, 0.3);
}

.nc-actions {
  display: flex;
  gap: 10px;
}

.nc-btn {
  padding: 8px 16px;
  border: 1px solid rgba(0, 0, 0, 0.2);
  border-radius: 4px;
  background-color: white;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.nc-btn:hover:not(:disabled) {
  background-color: rgba(0, 0, 0, 0.05);
}

.nc-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.nc-btn-primary {
  background-color: #0082C9;
  color: white;
  border-color: #0082C9;
}

.nc-btn-primary:hover:not(:disabled) {
  background-color: #006ba8;
}

.nc-error {
  padding: 12px;
  background-color: #fee;
  border: 1px solid #fcc;
  border-radius: 4px;
  color: #c00;
  margin-bottom: 15px;
}

.nc-loading {
  text-align: center;
  padding: 40px;
  color: rgba(0, 0, 0, 0.5);
}

.nc-file-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.nc-file-item {
  display: flex;
  align-items: center;
  padding: 12px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.nc-file-item:hover {
  background-color: rgba(0, 0, 0, 0.02);
  border-color: rgba(0, 0, 0, 0.2);
}

.nc-file-item.selected {
  background-color: rgba(0, 130, 201, 0.1);
  border-color: #0082C9;
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
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.nc-file-meta {
  font-size: 12px;
  color: rgba(0, 0, 0, 0.5);
  margin-top: 2px;
}

.nc-file-actions {
  display: flex;
  gap: 8px;
  margin-left: 12px;
}

.nc-btn-icon {
  padding: 6px 10px;
  border: 1px solid rgba(0, 0, 0, 0.2);
  border-radius: 4px;
  background-color: white;
  cursor: pointer;
  font-size: 16px;
  transition: all 0.2s;
}

.nc-btn-icon:hover {
  background-color: rgba(0, 0, 0, 0.05);
}

.nc-btn-danger:hover {
  background-color: #fee;
  border-color: #fcc;
}

.nc-empty {
  text-align: center;
  padding: 40px;
  color: rgba(0, 0, 0, 0.5);
}

.nc-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.nc-modal-content {
  background-color: white;
  border-radius: 8px;
  padding: 24px;
  max-width: 500px;
  width: 90%;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.nc-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.nc-modal-header h3 {
  margin: 0;
  font-size: 18px;
}

.nc-btn-close {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.nc-btn-close:hover {
  background-color: rgba(0, 0, 0, 0.05);
}

.nc-modal-body {
  min-height: 60px;
}

.nc-share-link {
  display: flex;
  gap: 10px;
  margin-top: 10px;
}

.nc-input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid rgba(0, 0, 0, 0.2);
  border-radius: 4px;
  font-family: monospace;
  font-size: 13px;
}

.nc-upload-progress {
  position: fixed;
  bottom: 20px;
  right: 20px;
  background-color: white;
  padding: 16px;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  min-width: 300px;
  z-index: 1000;
}

.nc-upload-bar {
  width: 100%;
  height: 8px;
  background-color: rgba(0, 0, 0, 0.1);
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 8px;
}

.nc-upload-fill {
  height: 100%;
  background-color: #0082C9;
  transition: width 0.3s;
}

.nc-upload-text {
  font-size: 13px;
  color: rgba(0, 0, 0, 0.7);
}

@media (max-width: 768px) {
  .nextcloud-file-manager {
    padding: 12px;
  }

  .nc-header {
    flex-direction: column;
    align-items: stretch;
  }

  .nc-actions {
    justify-content: flex-end;
  }

  .nc-file-item {
    padding: 10px;
  }

  .nc-file-icon {
    font-size: 20px;
    margin-right: 10px;
  }

  .nc-file-actions {
    flex-direction: column;
    gap: 4px;
  }

  .nc-btn-icon {
    padding: 4px 8px;
    font-size: 14px;
  }
}
</style>
