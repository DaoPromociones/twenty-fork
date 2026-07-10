import { Module } from '@nestjs/common';
import { TypeOrmModule, type TypeOrmModuleOptions } from '@nestjs/typeorm';

import { DataSource, type DataSourceOptions } from 'typeorm';

import { AddAduanaProjectionAuditStorageFastInstanceCommand } from 'src/database/commands/upgrade-version-command/2-19/2-19-instance-command-fast-1783517693762-add-aduana-projection-audit-storage';
import { installUpgradeAwareRepositoryProxy } from 'src/engine/twenty-orm/upgrade-aware/install-upgrade-aware-repository-proxy';
import { AduanaProjectionAuditEntity } from 'src/modules/aduana-projection/aduana-projection-audit.entity';
import { AduanaProjectionModule } from 'src/modules/aduana-projection/aduana-projection.module';

export const buildAduanaReceiverProofDataSourceOptions = (): TypeOrmModuleOptions => ({
  type: 'postgres',
  url: process.env.PG_DATABASE_URL,
  schema: 'core',
  entities: [AduanaProjectionAuditEntity],
  synchronize: false,
  migrationsRun: false,
  retryAttempts: 0,
  logging: process.env.NODE_ENV === 'test' ? [] : ['error'],
  ssl:
    process.env.PG_SSL_ALLOW_SELF_SIGNED === 'true'
      ? {
          rejectUnauthorized: false,
        }
      : undefined,
  extra: {
    query_timeout: Number(process.env.PG_DATABASE_PRIMARY_TIMEOUT_MS ?? 10000),
    idleTimeoutMillis: Number(process.env.PG_POOL_IDLE_TIMEOUT_MS ?? 600000),
    allowExitOnIdle: process.env.PG_POOL_ALLOW_EXIT_ON_IDLE === 'true',
  },
});

const prepareAduanaProjectionAuditStorage = async (
  dataSource: DataSource,
): Promise<void> => {
  const queryRunner = dataSource.createQueryRunner();

  await queryRunner.connect();
  try {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    await queryRunner.query('CREATE SCHEMA IF NOT EXISTS "core"');
    await new AddAduanaProjectionAuditStorageFastInstanceCommand().up(
      queryRunner,
    );
  } finally {
    await queryRunner.release();
  }
};

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: buildAduanaReceiverProofDataSourceOptions,
      dataSourceFactory: async (options) => {
        const dataSource = new DataSource(options as DataSourceOptions);

        await dataSource.initialize();
        installUpgradeAwareRepositoryProxy(dataSource);
        await prepareAduanaProjectionAuditStorage(dataSource);

        return dataSource;
      },
    }),
    AduanaProjectionModule,
  ],
})
export class AduanaProjectionReceiverProofModule {}
