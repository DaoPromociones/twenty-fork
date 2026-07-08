import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type AduanaProjectionAuditStatus =
  | 'accepted'
  | 'replayed'
  | 'quarantined';

export type AduanaProjectionAuthMetadata = {
  timestamp: string;
  nonce: string;
};

@Entity({ name: 'aduanaProjectionAudit', schema: 'core' })
@Index(
  'IDX_ADUANA_PROJECTION_AUDIT_ACCEPTED_WORKSPACE_EVENT',
  ['workspaceId', 'eventId'],
  {
    unique: true,
    where: `"status" = 'accepted' AND "eventId" IS NOT NULL`,
  },
)
@Index(
  'IDX_ADUANA_PROJECTION_AUDIT_WORKSPACE_NONCE',
  ['workspaceId', 'authNonce'],
  { unique: true },
)
export class AduanaProjectionAuditEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  workspaceId: string;

  @Column({ nullable: true, type: 'varchar' })
  eventId: string | null;

  @Column({ type: 'text' })
  rawBody: string;

  @Column({ type: 'jsonb' })
  authMetadata: AduanaProjectionAuthMetadata;

  @Column()
  authNonce: string;

  @Column({ nullable: true, type: 'varchar' })
  canonicalHash: string | null;

  @Column({ type: 'text' })
  status: AduanaProjectionAuditStatus;

  @Column({ nullable: true, type: 'text' })
  quarantineReason: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  receivedAt: Date;
}
