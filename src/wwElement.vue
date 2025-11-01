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
  props: {
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
        backgroundColor: this.content.backgroundColor,
        color: this.content.textColor,
        borderRadius: this.content.borderRadius,
      };
    },
    breadcrumbs() {
      const parts = this.currentPath.split('/').filter(p => p);
      const crumbs = [{ name: 'Home', path: '/' }];

      let currentPath = '';
      parts.forEach(part => {
        currentPath += '/' + part;
        crumbs.push({ name: part, path: currentPath });
      });

      return crumbs;
    },
  },
  watch: {
    'content.serverUrl': 'reinitializeClient',
    'content.username': 'reinitializeClient',
    'content.appPassword': 'reinitializeClient',
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

    reinitializeClient() {
      this.initializeClient();
      this.loadDirectory();
    },

    async loadDirectory() {
      if (!this.ncService?.isConfigured()) {
        return;
      }

      this.loading = true;
      this.error = null;

      try {
        this.items = await this.ncService.listDirectory(this.currentPath);
        // Sort: directories first, then files
        this.items.sort((a, b) => {
          if (a.type === b.type) {
            return a.name.localeCompare(b.name);
          }
          return a.type === 'directory' ? -1 : 1;
        });

        // Trigger WeWeb event with current items
        this.$emit('trigger-event', {
          name: 'directoryLoaded',
          event: { path: this.currentPath, items: this.items },
        });
      } catch (err) {
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

      // Trigger WeWeb event
      this.$emit('trigger-event', {
        name: 'itemSelected',
        event: { item },
      });
    },

    async refreshDirectory() {
      await this.loadDirectory();
    },

    triggerFileUpload() {
      this.$refs.fileInput.click();
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

        // Trigger WeWeb event
        this.$emit('trigger-event', {
          name: 'fileUploaded',
          event: { fileName: file.name, path: targetPath },
        });

        // Reload directory
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

        // Create download link
        const blob = new Blob([content]);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = item.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        // Trigger WeWeb event
        this.$emit('trigger-event', {
          name: 'fileDownloaded',
          event: { item },
        });
      } catch (err) {
        this.error = 'Download fehlgeschlagen: ' + err.message;
      }
    },

    async shareItem(item) {
      this.shareModal.show = true;
      this.shareModal.item = item;
      this.shareModal.loading = true;
      this.shareModal.shareUrl = null;
      this.shareModal.error = null;
      this.shareModal.copied = false;

      try {
        const result = await this.ncService.createShareLink(item.path);
        this.shareModal.shareUrl = result.shareUrl;

        // Trigger WeWeb event
        this.$emit('trigger-event', {
          name: 'shareCreated',
          event: { item, shareUrl: result.shareUrl },
        });
      } catch (err) {
        this.shareModal.error = 'Fehler beim Teilen: ' + err.message;
      } finally {
        this.shareModal.loading = false;
      }
    },

    closeShareModal() {
      this.shareModal.show = false;
      this.shareModal.item = null;
      this.shareModal.shareUrl = null;
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
      if (!confirm(`"${item.name}" wirklich löschen?`)) {
        return;
      }

      try {
        await this.ncService.deleteItem(item.path);

        // Trigger WeWeb event
        this.$emit('trigger-event', {
          name: 'itemDeleted',
          event: { item },
        });

        await this.loadDirectory();
      } catch (err) {
        this.error = 'Löschen fehlgeschlagen: ' + err.message;
      }
    },

    async createFolder() {
      const name = prompt('Ordnername:');
      if (!name) return;

      try {
        const path = this.currentPath + '/' + name;
        await this.ncService.createDirectory(path);

        // Trigger WeWeb event
        this.$emit('trigger-event', {
          name: 'folderCreated',
          event: { name, path },
        });

        await this.loadDirectory();
      } catch (err) {
        this.error = 'Ordner erstellen fehlgeschlagen: ' + err.message;
      }
    },

    getFileIcon(mime) {
      if (!mime) return '📄';

      if (mime.startsWith('image/')) return '🖼';
      if (mime.startsWith('video/')) return '🎥';
      if (mime.startsWith('audio/')) return '🎵';
      if (mime.includes('pdf')) return '📕';
      if (mime.includes('text/')) return '📝';
      if (mime.includes('zip') || mime.includes('compressed')) return '📦';

      return '📄';
    },

    formatFileSize(bytes) {
      if (!bytes) return '0 B';

      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));

      return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    },

    formatDate(dateString) {
      if (!dateString) return '';

      const date = new Date(dateString);
      return date.toLocaleDateString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    },
  },
};
</script>

<style lang="scss" scoped>
.nextcloud-file-manager {
  width: 100%;
  padding: 20px;
  box-sizing: border-box;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
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

  &:hover {
    background-color: rgba(0, 0, 0, 0.05);
  }

  .separator {
    margin-left: 5px;
    opacity: 0.5;
  }
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

  &:hover:not(:disabled) {
    background-color: #f5f5f5;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.nc-btn-primary {
  color: white;
  border: none;

  &:hover:not(:disabled) {
    opacity: 0.9;
  }
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

  &:last-child {
    border-bottom: none;
  }

  &:hover {
    background-color: rgba(0, 0, 0, 0.02);
  }

  &.selected {
    background-color: rgba(0, 130, 201, 0.1);
  }
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

  &:hover {
    background-color: #f5f5f5;
  }
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

  h3 {
    margin: 0;
    font-size: 18px;
  }
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

  &:hover {
    color: #333;
  }
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
</style>
