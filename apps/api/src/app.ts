import Fastify from 'fastify';
import cors from '@fastify/cors';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { HealthResponseSchema } from '@juris/shared';
import { config } from './config.js';
import { logger } from './logger.js';
import { execSync } from 'node:child_process';

function resolveGitSha(): string {
  if (process.env['GIT_SHA']) return process.env['GIT_SHA'];
  if (process.env['COMMIT_REF']) return process.env['COMMIT_REF'];
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
  } catch {
    return 'unknown';
  }
}

const currentVersion = process.env['npm_package_version'] || '0.1.0';
const currentGitSha = resolveGitSha();

export function buildApp() {
  const server = Fastify({
    loggerInstance: logger,
  }).withTypeProvider<ZodTypeProvider>();

  server.setValidatorCompiler(validatorCompiler);
  server.setSerializerCompiler(serializerCompiler);

  server.register(cors, {
    origin: config.CORS_ORIGINS.split(',').map((o) => o.trim()),
    credentials: true,
  });

  // GET /health - returns minimal health with status, role, version, gitSha
  server.get(
    '/health',
    {
      schema: {
        response: {
          200: HealthResponseSchema,
        },
      },
    },
    async (_request, reply) => {
      return reply.status(200).send({
        status: 'ok',
        role: config.ROLE,
        version: currentVersion,
        gitSha: currentGitSha,
      });
    },
  );

  return server;
}
