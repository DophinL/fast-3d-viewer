/// <reference types="vite/client" />

declare module '*vendor/online3dviewer/source/engine/main.js' {
  export const Direction: Record<string, number>;
  export class ImportSettings {
    defaultColor: { r: number; g: number; b: number };
  }
  export function InputFilesFromFileObjects(files: File[]): unknown[];
  export class ThreeModelLoader {
    LoadModel(inputFiles: unknown[], settings: ImportSettings, callbacks: Record<string, (...args: any[]) => void>): void;
    Destroy(): void;
    RevokeObjectUrls(): void;
  }
}
