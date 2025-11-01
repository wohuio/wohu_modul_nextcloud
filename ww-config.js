export default {
  editor: {
    label: {
      en: "Nextcloud File Manager",
      de: "Nextcloud Datei-Manager",
    },
  },
  properties: {
    // Nextcloud Connection
    serverUrl: {
      label: {
        en: "Nextcloud Server URL",
        de: "Nextcloud Server-URL",
      },
      type: "Text",
      defaultValue: "",
      bindable: true,
      section: "settings",
    },
    username: {
      label: {
        en: "Username",
        de: "Benutzername",
      },
      type: "Text",
      defaultValue: "",
      bindable: true,
      section: "settings",
    },
    appPassword: {
      label: {
        en: "App Password/Token",
        de: "App-Passwort/Token",
      },
      type: "Text",
      defaultValue: "",
      bindable: true,
      section: "settings",
    },

    // Display Options
    initialPath: {
      label: {
        en: "Initial Path",
        de: "Anfangspfad",
      },
      type: "Text",
      defaultValue: "/",
      section: "settings",
    },
    showUpload: {
      label: {
        en: "Show Upload Button",
        de: "Upload-Button anzeigen",
      },
      type: "OnOff",
      defaultValue: true,
      section: "settings",
    },
    showShare: {
      label: {
        en: "Show Share Button",
        de: "Teilen-Button anzeigen",
      },
      type: "OnOff",
      defaultValue: true,
      section: "settings",
    },
    showDownload: {
      label: {
        en: "Show Download Button",
        de: "Download-Button anzeigen",
      },
      type: "OnOff",
      defaultValue: true,
      section: "settings",
    },

    // Styling
    primaryColor: {
      label: {
        en: "Primary Color",
        de: "Primärfarbe",
      },
      type: "Color",
      defaultValue: "#0082C9",
      section: "style",
    },
    backgroundColor: {
      label: {
        en: "Background Color",
        de: "Hintergrundfarbe",
      },
      type: "Color",
      defaultValue: "#FFFFFF",
      section: "style",
    },
    textColor: {
      label: {
        en: "Text Color",
        de: "Textfarbe",
      },
      type: "Color",
      defaultValue: "#000000",
      section: "style",
    },
    borderRadius: {
      label: {
        en: "Border Radius",
        de: "Eckenradius",
      },
      type: "Length",
      defaultValue: "8px",
      section: "style",
    },
  },
};
