// Browser-compatible Nextcloud service using Fetch API
export class NextcloudService {
  constructor(serverUrl, username, appPassword) {
    this.serverUrl = serverUrl?.trim().replace(/\/$/, '');
    this.username = username;
    this.appPassword = appPassword;
    this.webdavUrl = `${this.serverUrl}/remote.php/dav/files/${this.username}`;
  }

  isConfigured() {
    return !!(this.serverUrl && this.username && this.appPassword);
  }

  getAuthHeaders() {
    const credentials = btoa(`${this.username}:${this.appPassword}`);
    return {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/xml',
    };
  }

  /**
   * List directory contents using WebDAV PROPFIND
   */
  async listDirectory(path = '/') {
    if (!this.isConfigured()) {
      throw new Error('Nextcloud client not configured');
    }

    try {
      const url = `${this.webdavUrl}${path}`;
      const response = await fetch(url, {
        method: 'PROPFIND',
        headers: this.getAuthHeaders(),
        body: '<?xml version="1.0"?><d:propfind xmlns:d="DAV:"><d:prop><d:getlastmodified/><d:getcontentlength/><d:resourcetype/><d:getcontenttype/></d:prop></d:propfind>',
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const xmlText = await response.text();
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
      const responses = xmlDoc.querySelectorAll('response');

      const items = [];
      responses.forEach((responseNode, index) => {
        if (index === 0) return; // Skip first (current directory)

        const href = responseNode.querySelector('href')?.textContent || '';
        const resourceType = responseNode.querySelector('resourcetype collection');
        const name = decodeURIComponent(href.split('/').filter(p => p).pop() || '');
        const size = parseInt(responseNode.querySelector('getcontentlength')?.textContent || '0');
        const lastModified = responseNode.querySelector('getlastmodified')?.textContent || '';
        const contentType = responseNode.querySelector('getcontenttype')?.textContent || '';

        items.push({
          name,
          path: decodeURIComponent(href.replace(`/remote.php/dav/files/${this.username}`, '')),
          type: resourceType ? 'directory' : 'file',
          size,
          lastModified,
          mime: contentType,
        });
      });

      return items;
    } catch (error) {
      console.error('Failed to list directory:', error);
      throw error;
    }
  }

  /**
   * Upload file using WebDAV PUT
   */
  async uploadFile(path, file, onProgress) {
    if (!this.isConfigured()) {
      throw new Error('Nextcloud client not configured');
    }

    try {
      const url = `${this.webdavUrl}${path}`;

      // For progress tracking, we need XMLHttpRequest
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable && onProgress) {
            const percentCompleted = Math.round((e.loaded * 100) / e.total);
            onProgress(percentCompleted);
          }
        });

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve({ success: true, path });
          } else {
            reject(new Error(`HTTP ${xhr.status}: ${xhr.statusText}`));
          }
        });

        xhr.addEventListener('error', () => {
          reject(new Error('Upload failed'));
        });

        xhr.open('PUT', url);
        const credentials = btoa(`${this.username}:${this.appPassword}`);
        xhr.setRequestHeader('Authorization', `Basic ${credentials}`);
        xhr.send(file);
      });
    } catch (error) {
      console.error('Failed to upload file:', error);
      throw error;
    }
  }

  /**
   * Download file using WebDAV GET
   */
  async downloadFile(path) {
    if (!this.isConfigured()) {
      throw new Error('Nextcloud client not configured');
    }

    try {
      const url = `${this.webdavUrl}${path}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.blob();
    } catch (error) {
      console.error('Failed to download file:', error);
      throw error;
    }
  }

  /**
   * Create share link using Nextcloud OCS API
   */
  async createShareLink(path, options = {}) {
    if (!this.isConfigured()) {
      throw new Error('Nextcloud client not configured');
    }

    try {
      const shareUrl = `${this.serverUrl}/ocs/v2.php/apps/files_sharing/api/v1/shares?format=json`;

      const formData = new URLSearchParams();
      formData.append('path', path);
      formData.append('shareType', '3'); // Public link
      formData.append('permissions', options.permissions || '1'); // Read-only

      if (options.password) {
        formData.append('password', options.password);
      }
      if (options.expireDate) {
        formData.append('expireDate', options.expireDate);
      }

      const response = await fetch(shareUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${btoa(`${this.username}:${this.appPassword}`)}`,
          'OCS-APIRequest': 'true',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data?.ocs?.data?.url) {
        return {
          success: true,
          shareUrl: data.ocs.data.url,
          token: data.ocs.data.token,
          id: data.ocs.data.id,
        };
      }

      throw new Error('Invalid response from share API');
    } catch (error) {
      console.error('Failed to create share link:', error);
      throw error;
    }
  }

  /**
   * Delete file or folder using WebDAV DELETE
   */
  async deleteItem(path) {
    if (!this.isConfigured()) {
      throw new Error('Nextcloud client not configured');
    }

    try {
      const url = `${this.webdavUrl}${path}`;
      const response = await fetch(url, {
        method: 'DELETE',
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return { success: true };
    } catch (error) {
      console.error('Failed to delete item:', error);
      throw error;
    }
  }

  /**
   * Create directory using WebDAV MKCOL
   */
  async createDirectory(path) {
    if (!this.isConfigured()) {
      throw new Error('Nextcloud client not configured');
    }

    try {
      const url = `${this.webdavUrl}${path}`;
      const response = await fetch(url, {
        method: 'MKCOL',
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return { success: true, path };
    } catch (error) {
      console.error('Failed to create directory:', error);
      throw error;
    }
  }

  /**
   * Get file/folder info using WebDAV PROPFIND
   */
  async getItemInfo(path) {
    if (!this.isConfigured()) {
      throw new Error('Nextcloud client not configured');
    }

    try {
      const url = `${this.webdavUrl}${path}`;
      const response = await fetch(url, {
        method: 'PROPFIND',
        headers: {
          ...this.getAuthHeaders(),
          'Depth': '0',
        },
        body: '<?xml version="1.0"?><d:propfind xmlns:d="DAV:"><d:prop><d:getlastmodified/><d:getcontentlength/><d:resourcetype/><d:getcontenttype/></d:prop></d:propfind>',
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const xmlText = await response.text();
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
      const responseNode = xmlDoc.querySelector('response');

      if (!responseNode) {
        throw new Error('Invalid response');
      }

      const href = responseNode.querySelector('href')?.textContent || '';
      const resourceType = responseNode.querySelector('resourcetype collection');
      const name = decodeURIComponent(href.split('/').filter(p => p).pop() || '');
      const size = parseInt(responseNode.querySelector('getcontentlength')?.textContent || '0');
      const lastModified = responseNode.querySelector('getlastmodified')?.textContent || '';
      const contentType = responseNode.querySelector('getcontenttype')?.textContent || '';

      return {
        name,
        path: decodeURIComponent(href.replace(`/remote.php/dav/files/${this.username}`, '')),
        type: resourceType ? 'directory' : 'file',
        size,
        lastModified,
        mime: contentType,
      };
    } catch (error) {
      console.error('Failed to get item info:', error);
      throw error;
    }
  }
}
