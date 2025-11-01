# Nextcloud File Manager for WeWeb

A complete Nextcloud integration element for [WeWeb](https://www.weweb.io/) with file browsing, upload, download, and sharing capabilities.

## Features

- 📁 **File Browser** - Navigate Nextcloud directories with intuitive breadcrumb navigation
- ⬆️ **Upload Files** - Multi-file upload with real-time progress tracking
- ⬇️ **Download Files** - Direct file downloads from Nextcloud
- 🔗 **Share Links** - Create public share links via Nextcloud OCS API
- 📂 **Folder Management** - Create and delete folders
- 🗑️ **File Management** - Delete files and folders
- 🎨 **Customizable Styling** - Configure colors, border radius, and visibility options
- ⚡ **WeWeb Events** - Trigger workflows on file operations

## Installation

### 1. Install Dependencies

```bash
npm install
```

This will install:
- `axios` - For Nextcloud OCS API calls
- `webdav` - For WebDAV file operations

### 2. Development Server

```bash
npm run serve --port=8080
```

Then in WeWeb editor:
1. Open the developer popup
2. Add your custom element with the local development URL

### 3. Build for Production

```bash
npm run build
```

## Nextcloud Setup

### Create an App Password

For security, use Nextcloud App Passwords instead of your main password:

1. Log into your Nextcloud instance
2. Go to **Settings** → **Security**
3. Under "Devices & sessions", create a new **App Password**
4. Copy the generated token
5. Use this token in the `appPassword` property

## WeWeb Configuration

### Required Properties

Configure these in the WeWeb editor:

| Property | Type | Description | Example |
|----------|------|-------------|---------|
| `serverUrl` | Text | Nextcloud server URL | `https://cloud.example.com` |
| `username` | Text | Nextcloud username | `john.doe` |
| `appPassword` | Text | App password/token | `xxxxx-xxxxx-xxxxx-xxxxx` |

### Optional Properties

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `initialPath` | Text | `/` | Starting directory path |
| `showUpload` | Toggle | `true` | Show upload button |
| `showShare` | Toggle | `true` | Show share button |
| `showDownload` | Toggle | `true` | Show download button |
| `primaryColor` | Color | `#0082C9` | Primary button color |
| `backgroundColor` | Color | `#FFFFFF` | Background color |
| `textColor` | Color | `#000000` | Text color |
| `borderRadius` | Length | `8px` | Container border radius |

## WeWeb Events

Use these events to trigger workflows in WeWeb:

| Event Name | When Triggered | Event Data |
|------------|----------------|------------|
| `directoryLoaded` | Directory contents loaded | `{ path, items }` |
| `itemSelected` | File/folder clicked | `{ item }` |
| `fileUploaded` | File uploaded successfully | `{ fileName, path }` |
| `fileDownloaded` | File download started | `{ item }` |
| `shareCreated` | Share link created | `{ item, shareUrl }` |
| `itemDeleted` | File/folder deleted | `{ item }` |
| `folderCreated` | Folder created | `{ name, path }` |

## Features in Detail

### File Browser
- Breadcrumb navigation for easy directory traversal
- Automatic sorting (folders first, then files)
- File type icons (documents, images, videos, etc.)
- File size and last modified date display

### Upload
- Multiple file selection support
- Real-time upload progress indicator
- Automatic directory refresh after upload

### Sharing
- Creates public share links via Nextcloud OCS API
- One-click copy to clipboard
- Modal interface for share link display

### File Management
- Delete files and folders with confirmation
- Create new folders with custom names
- Download files directly to browser

## Technical Details

- **WebDAV** for file operations (browse, upload, download, delete)
- **Nextcloud OCS API** for sharing functionality
- **Vue 2 Options API** for WeWeb compatibility
- **Scoped SCSS** styling
- **Basic Authentication** with username + app password

## Browser Compatibility

- Modern browsers with ES6+ support
- File upload requires File API support
- Share link copying uses `document.execCommand('copy')`

## License

MIT

## Support

For issues and feature requests, please contact the development team.
