import { type QueryRunner } from 'typeorm';

import { RegisteredInstanceCommand } from 'src/engine/core-modules/upgrade/decorators/registered-instance-command.decorator';
import { type FastInstanceCommand } from 'src/engine/core-modules/upgrade/interfaces/fast-instance-command.interface';

@RegisteredInstanceCommand('2.19.0', 1783517693762)
export class AddAduanaProjectionAuditStorageFastInstanceCommand
  implements FastInstanceCommand
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "core"."aduanaProjectionAudit" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "workspaceId" uuid NOT NULL,
        "eventId" character varying,
        "rawBody" text NOT NULL,
        "authMetadata" jsonb NOT NULL,
        "authNonce" character varying NOT NULL,
        "canonicalHash" character varying,
        "status" text NOT NULL,
        "quarantineReason" text,
        "receivedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_ADUANA_PROJECTION_AUDIT" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "core"."IDX_ADUANA_PROJECTION_AUDIT_WORKSPACE_EVENT"`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_ADUANA_PROJECTION_AUDIT_ACCEPTED_WORKSPACE_EVENT" ON "core"."aduanaProjectionAudit" ("workspaceId", "eventId") WHERE "status" = 'accepted' AND "eventId" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_ADUANA_PROJECTION_AUDIT_WORKSPACE_NONCE" ON "core"."aduanaProjectionAudit" ("workspaceId", "authNonce")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "core"."IDX_ADUANA_PROJECTION_AUDIT_WORKSPACE_NONCE"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "core"."IDX_ADUANA_PROJECTION_AUDIT_ACCEPTED_WORKSPACE_EVENT"`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "core"."aduanaProjectionAudit"`,
    );
  }
}
