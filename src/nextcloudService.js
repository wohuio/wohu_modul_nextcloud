import { createClient } from 'webdav';
import axios from 'axios';

export class NextcloudService {
  constructor(serverUrl, username, appPassword) {
    this.serverUrl = serverUrl?.trim().replace(/\/$/, '');
    this.username = username;
    this.appPassword = appPassword;
    this.client = null;

    if (this.isConfigured()) {
      this.initializeClient();
    }
  }

  isConfigured() {
    return !!(this.serverUrl && this.username && this.appPassword);
  }

  initializeClient() {
    try {
      const webdavUrl = `${this.serverUrl}/remote.php/dav/files/${this.username}`;
      this.client = createClient(webdavUrl, {
        username: this.username,
        password: this.appPassword,
      });
    } catch (error) {
      console.error('Failed to initialize Nextcloud client:', error);
      throw error;
    }
  }

  /**
   * List directory contents
   */
  async listDirectory(path = '/') {
    if (!this.client) {
      throw new Error('Nextcloud client not configured');
    }

    try {
      const contents = await this.client.getDirectoryContents(path);
      return contents.map(item => ({
        name: item.basename,
        path: item.filename,
        type: item.type, // 'file' or 'directory'
        size: item.size,
        lastModified: item.lastmod,
        mime: item.mime,
        etag: item.etag,
      }));
    } catch (error) {
      console.error('Failed to list directory:', error);
      throw error;
    }
  }

  /**
   * Upload file
   */
  async uploadFile(path, file, onProgress) {
    if (!this.client) {
      throw new Error('Nextcloud client not configured');
    }

    try {
      const reader = new FileReader();

      return new Promise((resolve, reject) => {
        reader.onload = async (e) => {
          try {
            await this.client.putFileContents(path, e.target.result, {
              onUploadProgress: (progressEvent) => {
                if (onProgress) {
                  const percentCompleted = Math.round(
                    (progressEvent.loaded * 100) / progressEvent.total
                  );
                  onProgress(percentCompleted);
                }
              },
            });
            resolve({ success: true, path });
          } catch (error) {
            reject(error);
          }
        };

        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsArrayBuffer(file);
      });
    } catch (error) {
      console.error('Failed to upload file:', error);
      throw error;
    }
  }

  /**
   * Download file
   */
  async downloadFile(path) {
    if (!this.client) {
      throw new Error('Nextcloud client not configured');
    }

    try {
      const content = await this.client.getFileContents(path);
      return content;
    } catch (error) {
      console.error('Failed to download file:', error);
      throw error;
    }
  }

  /**
   * Create share link for file/folder
   */
  async createShareLink(path, options = {}) {
    if (!this.isConfigured()) {
      throw new Error('Nextcloud client not configured');
    }

    try {
      const shareUrl = `${this.serverUrl}/ocs/v2.php/apps/files_sharing/api/v1/shares`;
      const params = {
        path: path,
        shareType: 3, // Public link
        permissions: options.permissions || 1, // Read-only by default
        ...(options.password && { password: options.password }),
        ...(options.expireDate && { expireDate: options.expireDate }),
      };

      const response = await axios.post(shareUrl, params, {
        auth: {
          username: this.username,
          password: this.appPassword,
        },
        headers: {
          'OCS-APIRequest': 'true',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        params: {
          format: 'json',
        },
      });

      if (response.data?.ocs?.data?.url) {
        return {
          success: true,
          shareUrl: response.data.ocs.data.url,
          token: response.data.ocs.data.token,
          id: response.data.ocs.data.id,
        };
      }

      throw new Error('Invalid response from share API');
    } catch (error) {
      console.error('Failed to create share link:', error);
      throw error;
    }
  }

  /**
   * Delete file or folder
   */
  async deleteItem(path) {
    if (!this.client) {
      throw new Error('Nextcloud client not configured');
    }

    try {
      await this.client.deleteFile(path);
      return { success: true };
    } catch (error) {
      console.error('Failed to delete item:', error);
      throw error;
    }
  }

  /**
   * Create directory
   */
  async createDirectory(path) {
    if (!this.client) {
      throw new Error('Nextcloud client not configured');
    }

    try {
      await this.client.createDirectory(path);
      return { success: true, path };
    } catch (error) {
      console.error('Failed to create directory:', error);
      throw error;
    }
  }

  /**
   * Get file/folder info
   */
  async getItemInfo(path) {
    if (!this.client) {
      throw new Error('Nextcloud client not configured');
    }

    try {
      const stat = await this.client.stat(path);
      return {
        name: stat.basename,
        path: stat.filename,
        type: stat.type,
        size: stat.size,
        lastModified: stat.lastmod,
        mime: stat.mime,
        etag: stat.etag,
      };
    } catch (error) {
      console.error('Failed to get item info:', error);
      throw error;
    }
  }
}
