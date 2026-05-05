import { Module } from '@nestjs/common';

import { CaptionsService } from './captions.service';

@Module({
  providers: [CaptionsService],
  exports: [CaptionsService],
})
export class CaptionsModule {}
