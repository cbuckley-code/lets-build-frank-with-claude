// ADR-002's named first tool: version, uptime and a greeting.
//
// It exists so the pipeline, the MCP client wiring and the console can all be
// proven before any Azure integration exists. It reports on Frank and nothing
// else — which the description says out loud, so a model does not reach for it
// when it wants environment data.
import { defineTool } from './define.js';

export function makeGetStatus(version: string, startedAt: Date) {
  return defineTool({
    name: 'get_status',
    description:
      "Returns Frank's name, version, uptime in seconds and a greeting. Use it to confirm which " +
      'Frank you are talking to and that he is reachable. It takes no parameters, and reports on ' +
      'Frank himself — it says nothing about Azure or any other system.',
    input: {},
    handler: async () => {
      const uptimeSeconds = Math.max(0, Math.floor((Date.now() - startedAt.getTime()) / 1000));
      return {
        summary: `frank ${version} is up, ${uptimeSeconds}s since start.`,
        name: 'frank',
        version,
        uptimeSeconds,
        startedAt: startedAt.toISOString(),
        greeting: "Hello, I'm Frank. I observe; I don't act.",
      };
    },
  });
}
