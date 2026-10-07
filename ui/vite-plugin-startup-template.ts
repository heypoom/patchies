import type { Plugin } from 'vite';
import {
  startupTemplatePath,
  startupTemplateSources,
  writeStartupTemplate
} from './scripts/startup-template.js';

export const startupTemplate = (): Plugin => ({
  name: 'patchies-startup-template',

  buildStart() {
    writeStartupTemplate();

    for (const path of startupTemplateSources) {
      this.addWatchFile(path);
    }
  },

  configureServer(server) {
    server.watcher.add([...startupTemplateSources, startupTemplatePath]);

    const regenerate = (path: string) => {
      if (startupTemplateSources.includes(path)) {
        writeStartupTemplate();
      }
    };

    server.watcher.on('change', regenerate);
    server.httpServer?.once('close', () => server.watcher.off('change', regenerate));
  }
});
