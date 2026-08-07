import type { Provider } from "../types.ts";
import { comtradeProvider } from "./comtrade.ts";
import { importYetiProvider } from "./importyeti.ts";

export { comtradeProvider, importYetiProvider };

export function createMockRegistry(providers: Provider[] = [comtradeProvider, importYetiProvider]): Provider[] {
  return providers;
}
