import { Module } from '@nestjs/common';

import { ADUANA_PROJECTION_DENIED_MUTATION_HOOKS } from 'src/modules/aduana-projection/query-hooks/aduana-projection-mutation-denial.pre-query.hook';

@Module({
  providers: ADUANA_PROJECTION_DENIED_MUTATION_HOOKS.map(({ Hook }) => Hook),
})
export class AduanaProjectionQueryHookModule {}
