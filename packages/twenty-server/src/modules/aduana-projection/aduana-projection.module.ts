import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { provideWorkspaceScopedRepository } from 'src/engine/twenty-orm/workspace-scoped-repository/provide-workspace-scoped-repository';
import { AduanaProjectionAuditEntity } from 'src/modules/aduana-projection/aduana-projection-audit.entity';
import { AduanaProjectionController } from 'src/modules/aduana-projection/aduana-projection.controller';
import { AduanaProjectionAuthService } from 'src/modules/aduana-projection/services/aduana-projection-auth.service';
import { AduanaProjectionIngestionService } from 'src/modules/aduana-projection/services/aduana-projection-ingestion.service';
import { AduanaProjectionSecretResolverService } from 'src/modules/aduana-projection/services/aduana-projection-secret-resolver.service';

@Module({
  imports: [TypeOrmModule.forFeature([AduanaProjectionAuditEntity])],
  controllers: [AduanaProjectionController],
  providers: [
    AduanaProjectionAuthService,
    AduanaProjectionIngestionService,
    AduanaProjectionSecretResolverService,
    provideWorkspaceScopedRepository(AduanaProjectionAuditEntity),
  ],
})
export class AduanaProjectionModule {}
