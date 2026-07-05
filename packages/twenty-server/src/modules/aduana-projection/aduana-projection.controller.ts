import {
  Controller,
  HttpCode,
  Param,
  Post,
  type RawBodyRequest,
  Req,
  UseGuards,
} from '@nestjs/common';

import { type Request } from 'express';

import { NoPermissionGuard } from 'src/engine/guards/no-permission.guard';
import { PublicEndpointGuard } from 'src/engine/guards/public-endpoint.guard';
import { AduanaProjectionAuthService } from 'src/modules/aduana-projection/services/aduana-projection-auth.service';
import { AduanaProjectionIngestionService } from 'src/modules/aduana-projection/services/aduana-projection-ingestion.service';
import { isDefined } from 'twenty-shared/utils';

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
      throw new Error('Missing Aduana payload');
    }

    const authMetadata = this.authService.verifyRequest({
      method: request.method,
      path: request.path,
      pathWorkspaceId: workspaceId,
      headers: request.headers,
      rawBody: request.rawBody,
    });

    return this.ingestionService.ingest({
      workspaceId,
      authMetadata,
      rawBody: request.rawBody,
    });
  }
}
