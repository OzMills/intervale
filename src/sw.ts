/// <reference lib="webworker" />

export {};

declare global {
  interface WorkerGlobalScope {
    __WB_MANIFEST: ReadonlyArray<unknown>;
  }
}

const precacheManifest = self.__WB_MANIFEST;
void precacheManifest;
