/**
 * Runs a command without a shell. Node-only (used by provisioning and
 * rollout, which work on git checkouts), so it is injected rather than
 * imported where a Worker might load it.
 */
import { execFile } from 'node:child_process';

export interface CommandResult {
  code: number;
  stdout: string;
  stderr: string;
}

export type CommandRunner = (
  command: string,
  args: string[],
  options: { cwd: string; env?: Record<string, string> }
) => Promise<CommandResult>;

export const runCommand: CommandRunner = (command, args, options) =>
  new Promise((resolve) => {
    execFile(
      command,
      args,
      {
        cwd: options.cwd,
        env: { ...process.env, ...options.env },
        maxBuffer: 32 * 1024 * 1024,
        timeout: 15 * 60_000
      },
      (error, stdout, stderr) => {
        const code = error ? (typeof error.code === 'number' ? error.code : 1) : 0;
        resolve({ code, stdout: String(stdout), stderr: String(stderr) });
      }
    );
  });

export class CommandError extends Error {
  constructor(
    readonly command: string,
    readonly result: CommandResult
  ) {
    super(
      `${command} failed (${result.code}): ${(result.stderr || result.stdout).trim().slice(-500)}`
    );
  }
}

/** Run and throw on a non-zero exit. */
export async function must(
  run: CommandRunner,
  command: string,
  args: string[],
  options: { cwd: string; env?: Record<string, string> }
): Promise<CommandResult> {
  const result = await run(command, args, options);
  if (result.code !== 0) throw new CommandError(`${command} ${args.join(' ')}`, result);
  return result;
}
