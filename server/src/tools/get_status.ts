// ADR-002: the first tool. Proves the pipeline, client wiring and console
// before any Azure integration exists.
import { defineTool } from './define.js';

export function makeGetStatus(version: string) {
  return defineTool({
    name: 'get_status',
    description:
      "Returns Frank's version, uptime in seconds, and a greeting. Use it to check that " +
      'Frank is reachable and which build is running. It takes no parameters.',
    input: {},
    handler: async () => {
      const uptimeSeconds = Math.floor(process.uptime());
      return {
        summary: `Frank ${version} is up and has been running for ${uptimeSeconds} seconds.`,
        version,
        uptimeSeconds,
        greeting: "Hello, I'm Frank. I observe; I don't act.",
      };
    },
  });
}
