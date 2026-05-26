import 'reflect-metadata';

import { Module, type DynamicModule } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ApolloDriver, type ApolloDriverConfig } from '@nestjs/apollo';
import { GraphQLModule } from '@nestjs/graphql';

import { LOSTFAST_FACADE, LostfastResolver, type LostfastApiFacade } from './graphql.js';

@Module({})
class LostfastBackendModule {
  static register(facade: LostfastApiFacade): DynamicModule {
    return {
      module: LostfastBackendModule,
      imports: [
        GraphQLModule.forRoot<ApolloDriverConfig>({
          driver: ApolloDriver,
          autoSchemaFile: true,
          sortSchema: true,
          path: '/graphql',
        }),
      ],
      providers: [{ provide: LOSTFAST_FACADE, useValue: facade }, LostfastResolver],
    };
  }
}

export interface LostfastBackendOptions {
  host?: string;
  port?: number;
}

export interface LostfastBackendHandle {
  url: string;
  close(): Promise<void>;
}

export async function startLostfastBackend(
  facade: LostfastApiFacade,
  options: LostfastBackendOptions = {},
): Promise<LostfastBackendHandle> {
  const host = options.host ?? '127.0.0.1';
  const port = options.port ?? 0;
  const app = await NestFactory.create(LostfastBackendModule.register(facade), { logger: false });

  await app.listen(port, host);
  const baseUrl = (await app.getUrl()).replace(/\/$/u, '');
  return {
    url: `${baseUrl}/graphql`,
    close: () => app.close(),
  };
}
