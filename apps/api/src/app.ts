import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { HealthResponseSchema } from '@juris/shared';
import { config } from './config.js';
import { logger } from './logger.js';
import { documentRoutes } from './routes/documents.js';
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

  server.register(multipart, {
    limits: {
      fileSize: config.MAX_FILE_SIZE_BYTES,
      files: 1,
    },
  });

  // Register document routes
  server.register(documentRoutes);

  // GET /health and /api/health
  const healthOpts = {
    schema: {
      response: {
        200: HealthResponseSchema,
      },
    },
  };

  server.get('/health', healthOpts, async (_request, reply) => {
    return reply.status(200).send({
      status: 'ok',
      role: config.ROLE,
      version: currentVersion,
      gitSha: currentGitSha,
    });
  });

  server.get('/api/health', healthOpts, async (_request, reply) => {
    return reply.status(200).send({
      status: 'ok',
      role: config.ROLE,
      version: currentVersion,
      gitSha: currentGitSha,
    });
  });

  return server;
}
