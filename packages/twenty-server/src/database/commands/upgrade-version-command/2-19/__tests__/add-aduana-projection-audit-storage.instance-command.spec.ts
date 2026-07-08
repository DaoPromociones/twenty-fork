import { AddAduanaProjectionAuditStorageFastInstanceCommand } from 'src/database/commands/upgrade-version-command/2-19/2-19-instance-command-fast-1825000001000-add-aduana-projection-audit-storage';

describe('AddAduanaProjectionAuditStorageFastInstanceCommand', () => {
  it('should create audit storage indexes and rollback them', async () => {
    const queries: string[] = [];
    const queryRunner = {
      query: jest.fn(async (query: string) => queries.push(query)),
    };
    const command = new AddAduanaProjectionAuditStorageFastInstanceCommand();

    await command.up(queryRunner as never);
    await command.down(queryRunner as never);

    expect(queries).toEqual(
      expect.arrayContaining([
        expect.stringContaining('CREATE TABLE IF NOT EXISTS "core"."aduanaProjectionAudit"'),
        expect.stringContaining(
          'CREATE UNIQUE INDEX IF NOT EXISTS "IDX_ADUANA_PROJECTION_AUDIT_ACCEPTED_WORKSPACE_EVENT"',
        ),
        expect.stringContaining('WHERE "status" = \'accepted\' AND "eventId" IS NOT NULL'),
        expect.stringContaining(
          'DROP INDEX IF EXISTS "core"."IDX_ADUANA_PROJECTION_AUDIT_WORKSPACE_EVENT"',
        ),
        expect.stringContaining('IDX_ADUANA_PROJECTION_AUDIT_WORKSPACE_NONCE'),
        expect.stringContaining('IDX_ADUANA_PROJECTION_AUDIT_CANONICAL_HASH'),
        expect.stringContaining(
          'DROP INDEX IF EXISTS "core"."IDX_ADUANA_PROJECTION_AUDIT_CANONICAL_HASH"',
        ),
        expect.stringContaining(
          'DROP INDEX IF EXISTS "core"."IDX_ADUANA_PROJECTION_AUDIT_ACCEPTED_WORKSPACE_EVENT"',
        ),
        expect.stringContaining('DROP INDEX IF EXISTS "core"."IDX_ADUANA_PROJECTION_AUDIT_WORKSPACE_NONCE"'),
        expect.stringContaining('DROP TABLE IF EXISTS "core"."aduanaProjectionAudit"'),
      ]),
    );
  });
});
