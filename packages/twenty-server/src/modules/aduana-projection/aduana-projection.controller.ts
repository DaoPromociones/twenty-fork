import {
  BadRequestException,
  Controller,
  HttpCode,
  Param,
  Post,
  type RawBodyRequest,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';

import { type Request } from 'express';

import { NoPermissionGuard } from 'src/engine/guards/no-permission.guard';
import { PublicEndpointGuard } from 'src/engine/guards/public-endpoint.guard';
import {
  type AduanaProjectionAuthenticatedRequest,
  AduanaProjectionAuthService,
} from 'src/modules/aduana-projection/services/aduana-projection-auth.service';
import { AduanaProjectionIngestionService } from 'src/modules/aduana-projection/services/aduana-projection-ingestion.service';
import { isDefined } from 'twenty-shared/utils';

const ADUANA_PROJECTION_AUTH_REJECTION_MESSAGES = new Set([
  'workspace mismatch',
  'stale timestamp',
  'replayed nonce',
  'bad signature',
]);

@Controller()
export class AduanaProjectionController {
  constructor(
    private readonly authService: AduanaProjectionAuthService,
    private readonly ingestionService: AduanaProjectionIngestionService,
  ) {}

  @Post(['webhooks/aduana/projection/:workspaceId'])
  @UseGuards(PublicEndpointGuard, NoPermissionGuard)
  @HttpCode(200)
  async handleProjectionWebhook(
    @Param('workspaceId') workspaceId: string,
    @Req() request: RawBodyRequest<Request>,
  ) {
    if (!isDefined(request.rawBody)) {
      throw new BadRequestException('Missing Aduana payload');
    }

    let authMetadata: AduanaProjectionAuthenticatedRequest;

    try {
      authMetadata = this.authService.verifyRequest({
        method: request.method,
        path: request.path,
        pathWorkspaceId: workspaceId,
        headers: request.headers,
        rawBody: request.rawBody,
      });
    } catch (error) {
      if (
        error instanceof Error &&
        ADUANA_PROJECTION_AUTH_REJECTION_MESSAGES.has(error.message)
      ) {
        throw new UnauthorizedException('Aduana projection authentication failed');
      }

      throw error;
    }

    return this.ingestionService.ingest({
      workspaceId,
      authMetadata,
      rawBody: request.rawBody,
    });
  }
}
