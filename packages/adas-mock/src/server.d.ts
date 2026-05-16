import { type ScenarioName } from "./scenario-runner.js";
export interface MockServerOptions {
    port: number;
    scenario: ScenarioName;
    loop?: boolean;
}
/**
 * WebSocket server that streams raw ADAS signal frames to all connected clients.
 * No scenario labels are ever sent — only raw VSS signal values.
 */
export declare function createMockServer(options: MockServerOptions): {
    start: () => void;
    stop: () => void;
};
//# sourceMappingURL=server.d.ts.map