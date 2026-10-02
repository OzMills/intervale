/// <reference lib="webworker" />

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: ReadonlyArray<unknown>;
};

const precacheManifest = self.__WB_MANIFEST;
void precacheManifest;
