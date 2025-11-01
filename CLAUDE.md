# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **WeWeb custom element** named `wohu_modul_nextcloud` - a complete Nextcloud file manager integration for WeWeb. WeWeb elements are Vue.js components that can be integrated into the WeWeb no-code platform.

### Features
- **File Browser** - Navigate Nextcloud directories with breadcrumb navigation
- **Upload** - Multi-file upload with progress tracking
- **Download** - Direct file download from Nextcloud
- **Share** - Create public share links via Nextcloud OCS API
- **File Management** - Create folders, delete items

## Development Commands

### Local Development
```bash
npm i                              # Install dependencies (axios, webdav)
npm run serve --port=[PORT]        # Serve locally (default port varies)
```

After running `serve`, add the custom element in the WeWeb editor via the developer popup.

### Build
```bash
npm run build                      # Build for production
```

## Architecture

### File Structure

**Core Files:**
- `src/wwElement.vue` - Main Vue component with file manager UI (Vue 2 Options API)
- `src/nextcloudService.js` - Nextcloud API service wrapper (WebDAV + OCS API)
- `ww-config.js` - Element configuration and property definitions
- `ww-manifest.json` - WeWeb registration metadata
- `package.json` - Project metadata and dependencies

### Nextcloud Service (`nextcloudService.js`)

The `NextcloudService` class provides methods for:
- **Connection**: WebDAV client initialization with server URL, username, and app password
- **Directory Operations**: `listDirectory()`, `createDirectory()`
- **File Operations**: `uploadFile()`, `downloadFile()`, `getItemInfo()`, `deleteItem()`
- **Sharing**: `createShareLink()` using Nextcloud OCS API

**Example Usage:**
```javascript
const service = new NextcloudService(serverUrl, username, appPassword);
const items = await service.listDirectory('/Documents');
await service.uploadFile('/Documents/file.pdf', fileObject, onProgress);
const share = await service.createShareLink('/Documents/file.pdf');
```

### Component Properties (ww-config.js)

**Connection Settings:**
- `serverUrl` - Nextcloud server URL (e.g., `https://cloud.example.com`)
- `username` - Nextcloud username
- `appPassword` - Nextcloud app password/token (bindable for security)

**Display Options:**
- `initialPath` - Starting directory (default: `/`)
- `showUpload` - Show/hide upload button
- `showShare` - Show/hide share button
- `showDownload` - Show/hide download button

**Styling:**
- `primaryColor` - Primary color for buttons (default: Nextcloud blue `#0082C9`)
- `backgroundColor` - Background color
- `textColor` - Text color
- `borderRadius` - Border radius for container

### WeWeb Events

The element triggers the following events for WeWeb workflows:

- `directoryLoaded` - Fired when directory contents are loaded
  - Event data: `{ path, items }`
- `itemSelected` - Fired when user clicks on a file/folder
  - Event data: `{ item }`
- `fileUploaded` - Fired after successful file upload
  - Event data: `{ fileName, path }`
- `fileDownloaded` - Fired after file download starts
  - Event data: `{ item }`
- `shareCreated` - Fired when share link is created
  - Event data: `{ item, shareUrl }`
- `itemDeleted` - Fired after item deletion
  - Event data: `{ item }`
- `folderCreated` - Fired after folder creation
  - Event data: `{ name, path }`

### Authentication Setup

Users need to create a Nextcloud App Password:
1. Go to Nextcloud Settings → Security
2. Create a new App Password
3. Use the generated token in the `appPassword` property

## Implementation Notes

- Uses **WebDAV** for file operations via the `webdav` npm package
- Uses **Nextcloud OCS API** for share link creation via direct axios calls
- All API calls are authenticated using Basic Auth (username + app password)
- File uploads support progress callbacks for UI feedback
- Component auto-reinitializes client when connection properties change
- Vue 2 Options API is used (not Vue 3 Composition API) per WeWeb compatibility
