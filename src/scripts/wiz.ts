/**
 * Command-line tool for trying the Wiz protocol layer against real bulbs.
 *
 *   npm run wiz -- discover [broadcastAddress]
 *   npm run wiz -- status <ip>
 *   npm run wiz -- config <ip>
 *   npm run wiz -- set <ip> '<json params>'   e.g. '{"state":true,"dimming":30}'
 *
 * Requires a build first (`npm run build`).
 */
import {
  capabilitiesFromModule,
  findScene,
  type SetPilotParams,
  WizClient,
  WizError,
} from '../wiz/index.js';

const client = new WizClient();

async function main(args: string[]): Promise<void> {
  const [command, ip, extra] = args;

  switch (command) {
    case 'discover': {
      const found = await client.discover({ broadcastAddress: ip });
      if (found.length === 0) {
        console.log('No Wiz devices answered.');
        return;
      }
      for (const bulb of found) {
        const config = await client.getSystemConfig(bulb).catch(() => null);
        const kind = config
          ? capabilitiesFromModule(config.moduleName).kind
          : '?';
        console.log(
          [
            bulb.ip.padEnd(15),
            bulb.mac,
            (config?.moduleName ?? '?').padEnd(18),
            (config?.fwVersion ?? '?').padEnd(8),
            kind,
          ].join('  '),
        );
      }
      return;
    }

    case 'status': {
      const state = await client.getPilot({ ip: required(ip, 'ip') });
      const scene =
        state.sceneId === undefined ? undefined : findScene(state.sceneId);
      console.log(JSON.stringify({ ...state, scene: scene?.name }, null, 2));
      return;
    }

    case 'config': {
      const address = { ip: required(ip, 'ip') };
      const config = await client.getSystemConfig(address);
      const model = await client.getModelConfig(address);
      console.log(
        JSON.stringify(
          {
            ...config,
            cctRange: model?.cctRange,
            minDimLevel: model?.minDimLevel,
            capabilities: capabilitiesFromModule(config.moduleName, model),
          },
          null,
          2,
        ),
      );
      return;
    }

    case 'set': {
      const params = JSON.parse(required(extra, 'params')) as SetPilotParams;
      await client.setPilot({ ip: required(ip, 'ip') }, params);
      console.log('OK');
      return;
    }

    default:
      console.log(
        'Usage: npm run wiz -- discover [broadcast] | status <ip> | config <ip> | set <ip> <json>',
      );
      process.exitCode = 1;
  }
}

function required(value: string | undefined, name: string): string {
  if (!value) throw new Error(`missing <${name}>`);
  return value;
}

try {
  await main(process.argv.slice(2));
} catch (error) {
  const label = error instanceof WizError ? error.name : 'Error';
  console.error(`${label}: ${(error as Error).message}`);
  process.exitCode = 1;
}
