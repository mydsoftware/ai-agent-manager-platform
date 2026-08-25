import { PrismaClient } from "@prisma/client";
import { executeAgentLoop } from "./agent-loop";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
export const prisma = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export type AgentRuntimeInput = {
  agentId: string;
  tenantId: string;
  userId: string;
  input: unknown;
  maxIterations?: number;
};

export const LOOP_MAX_TOKENS = 1200;

export function estimateCredits(tokens = LOOP_MAX_TOKENS): number {
  return Math.max(1, Math.ceil(tokens / 1000));
}

export function actualCredits(tokensUsed: number): number {
  return Math.max(1, Math.ceil((tokensUsed || 0) / 1000));
}

async function reserveCredits(tenantId: string, amount: number): Promise<boolean> {
  const result = await prisma.tenant.updateMany({
    where: { id: tenantId, credits: { gte: amount } },
    data: { credits: { decrement: amount } },
  });
  return result.count === 1;
}

async function adjustCredits(tenantId: string, delta: number): Promise<void> {
  if (delta === 0) return;
  if (delta > 0) {
    await prisma.tenant.update({ where: { id: tenantId }, data: { credits: { increment: delta } } });
    return;
  }
  await prisma.$executeRaw`UPDATE tenants SET credits = GREATEST(0, credits - ${-delta}) WHERE id = ${tenantId}`;
}

export type MeteredRun = {
  run: { id: string };
  agent: { id: string; name: string; systemPrompt: string | null; tools: unknown; riskLevel: string; approvalPolicy: string };
  complete: (result: { text?: string; events?: unknown[]; tokensUsed: number; iterations: number; trace?: unknown[] }) => Promise<any>;
  fail: (error: unknown) => Promise<any>;
};

export async function openMeteredRun(input: {
  agentId: string;
  tenantId: string;
  userId: string;
  input: unknown;
}): Promise<MeteredRun> {
  const user = await prisma.user.findFirst({
    where: { id: input.userId, isActive: true, tenants: { some: { id: input.tenantId } } },
    select: { id: true },
  });
  if (!user) throw new Error("UNAUTHORIZED");

  const agent = await prisma.agent.findFirst({
    where: { id: input.agentId, tenantId: input.tenantId, isActive: true },
  });
  if (!agent) throw new Error("AGENT_NOT_FOUND");

  const reserved = estimateCredits();
  const ok = await reserveCredits(input.tenantId, reserved);
  if (!ok) throw new Error("INSUFFICIENT_CREDITS");

  let runId: string;
  try {
    const run = await prisma.agentRun.create({
      data: {
        agentId: agent.id,
        tenantId: input.tenantId,
        status: "RUNNING",
        input: input.input as any,
        startedAt: new Date(),
      },
    });
    runId = run.id;
  } catch (error) {
    await adjustCredits(input.tenantId, reserved);
    throw error;
  }

  const startedAt = Date.now();

  async function settle(result: { tokensUsed: number; iterations: number; status: "COMPLETED" | "FAILED"; text?: string; events?: unknown[]; trace?: unknown[]; error?: string }) {
    const used = actualCredits(result.tokensUsed);
    const delta = reserved - used;
    const tenant = await prisma.tenant.findUnique({ where: { id: input.tenantId }, select: { credits: true } });
    const telemetry = {
      latencyMs: Date.now() - startedAt,
      iterations: result.iterations,
      tokensUsed: result.tokensUsed,
      creditsUsed: used,
      creditsReserved: reserved,
    };
    try {
      await adjustCredits(input.tenantId, delta);
    } catch (error) {
      console.error("credit settlement failed", error);
    }
    return prisma.agentRun.update({
      where: { id: runId },
      data: {
        status: result.status,
        output:
          result.status === "COMPLETED"
            ? ({ text: result.text ?? "", events: result.events ?? [], trace: result.trace ?? [], telemetry } as any)
            : { telemetry },
        tokensUsed: result.tokensUsed,
        creditsUsed: used,
        iterations: result.iterations,
        error: result.error,
        finishedAt: new Date(),
      },
    });
  }

  return {
    run: { id: runId },
    agent,
    async complete(result) {
      return settle({ ...result, status: "COMPLETED" });
    },
    async fail(error) {
      const message = error instanceof Error ? error.message : "AGENT_RUN_FAILED";
      return settle({ tokensUsed: 0, iterations: 0, status: "FAILED", error: message });
    },
  };
}

export async function runAgent(input: AgentRuntimeInput) {
  const metered = await openMeteredRun(input);
  try {
    const result = await executeAgentLoop({
      agent: metered.agent,
      tenantId: input.tenantId,
      userId: input.userId,
      input: input.input,
      maxIterations: input.maxIterations,
    });
    return await metered.complete({
      text: result.text,
      tokensUsed: result.tokensUsed,
      iterations: result.iterations,
      trace: result.trace,
    });
  } catch (error) {
    return metered.fail(error);
  }
}
