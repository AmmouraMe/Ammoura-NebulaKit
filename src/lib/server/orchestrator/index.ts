/**
 * Ammoura as the control room over per-client NebulaKit sites.
 * Plan: plans/ammoura-as-orchestrator.md (umbrella repo).
 *
 * Worker-safe exports only. Node-only pieces (provisioning, rollout, the
 * command runner, the file registry) are imported from their own modules by
 * the CLI, never from here.
 */
export * from './registry';
export * from './site-client';
export * from './updates';
export * from './service';
