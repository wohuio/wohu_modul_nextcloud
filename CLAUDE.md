# CLAUDE.md - Nextcloud File Manager for WeWeb

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

## CRITICAL WeWeb Development Requirements

**THESE ARE MANDATORY AND MUST BE FOLLOWED:**

### 1. Safe Property Access (MANDATORY)
- **ALWAYS** use optional chaining (?.) for all `content` references
- All variable references must include type safety checks to prevent crashes
- Properties may be undefined initially or during editor changes

```javascript
// ✅ CORRECT
const value = props.content?.serverUrl || ''
const items = props.content?.items || []

// ❌ WRONG
const value = props.content.serverUrl
```

### 2. Reactivity Requirements (ABSOLUTELY CRITICAL)
- **ALL** props.content properties MUST be fully reactive
- Changes in WeWeb editor must reflect immediately without re-render
- Use `computed()` for derived data, NOT `ref()` or `reactive()`
- NEVER use manual watchers for prop changes

```javascript
// ✅ CORRECT - Fully reactive
const processedData = computed(() => {
  return props.content?.data?.map(item => ({
    ...item,
    color: props.content?.primaryColor || '#0082C9'
  })) || []
})

// ❌ WRONG - Breaks reactivity
const processedData = ref([])
onMounted(() => {
  processedData.value = props.content?.data || []
})
```

### 3. Build Configuration (ABSOLUTELY CRITICAL)
- **NO** custom build configs: webpack.config.js, vite.config.js, rollup.config.js
- **NO** compiler configs: .babelrc, babel.config.js, tsconfig.json
- **ONLY** `@weweb/cli` as devDependency with "latest" version
- Build process handled entirely by WeWeb CLI

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

## WeWeb Component Patterns

### Vue Component Structure (MANDATORY)
```javascript
export default {
  props: {
    content: { type: Object, required: true },
  },
  computed: {
    // Use computed for all derived data
    containerStyle() {
      return {
        backgroundColor: this.content?.backgroundColor || '#FFFFFF',
        color: this.content?.textColor || '#000000',
        borderRadius: this.content?.borderRadius || '8px',
      };
    },
  },
  watch: {
    // Watch connection properties for reinitialization
    'content.serverUrl': 'reinitializeClient',
    'content.username': 'reinitializeClient',
    'content.appPassword': 'reinitializeClient',
  },
  methods: {
    // Trigger WeWeb events
    emitEvent(name, data) {
      this.$emit('trigger-event', {
        name: name,
        event: data,
      });
    },
  },
}
```

### Property Configuration (ww-config.js)

**Property Types:**
- `Text` - String input (bindable)
- `Color` - Color picker
- `OnOff` - Boolean toggle
- `Length` - Size with units (px, %, etc.)
- `TextSelect` - Dropdown selection

**Property Sections:**
```javascript
properties: {
  serverUrl: {
    label: { en: "Server URL", de: "Server-URL" },
    type: "Text",
    defaultValue: "",
    bindable: true,
    section: "settings",  // Groups properties in editor
  },
  primaryColor: {
    label: { en: "Primary Color" },
    type: "Color",
    defaultValue: "#0082C9",
    section: "style",
  },
}
```

### Event Triggering
```javascript
// In ww-config.js - NOT USED IN THIS COMPONENT (using Vue 2 Options API)
// For Vue 3 components, you would define:
// triggerEvents: [...]

// In Vue component - Trigger events
this.$emit('trigger-event', {
  name: 'directoryLoaded',
  event: { path: this.currentPath, items: this.items }
});
```

## Implementation Notes

### Technology Stack
- **WebDAV** for file operations via the `webdav` npm package
- **Nextcloud OCS API** for share link creation via direct axios calls
- **Vue 2 Options API** (NOT Vue 3 Composition API) per WeWeb compatibility
- **Scoped SCSS** for styling

### Authentication
- All API calls authenticated using Basic Auth (username + app password)
- Users must create Nextcloud App Password in Settings → Security
- Credentials stored in bindable properties for WeWeb variable integration

### Component Lifecycle
- Client initializes on mount with connection properties
- Auto-reinitializes when `serverUrl`, `username`, or `appPassword` changes
- File operations trigger WeWeb events for workflow integration
- Upload includes progress callbacks for UI feedback

### Error Handling
- Configuration validation on client initialization
- User-friendly error messages for failed operations
- Confirmation dialogs for destructive actions (delete)

## WeWeb Best Practices Applied

✅ **Safe Property Access**: All `content` references use optional chaining
✅ **Reactive Properties**: Computed properties for dynamic styles
✅ **Event Triggering**: 7 event types for workflow integration
✅ **Scoped Styling**: No global CSS pollution
✅ **Bindable Properties**: All configuration can use WeWeb variables
✅ **User Experience**: Loading states, progress indicators, confirmations
✅ **Documentation**: Comprehensive README and CLAUDE.md
