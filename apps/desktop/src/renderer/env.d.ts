export {};

type CairviaBridge = {
  invoke: (channel: string, payload?: unknown) => Promise<unknown>;
  expand: (next: boolean) => void;
  openControlCenter: () => void;
  quit: () => void;
  onLayout: (listener: (expanded: boolean) => void) => () => void;
};

declare global {
  interface Window {
    cairvia: CairviaBridge;
  }
}
