import type { EchoApi } from './index';

declare global {
  interface Window {
    echoApi: EchoApi;
  }
}
