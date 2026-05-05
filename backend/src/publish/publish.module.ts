import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';

import { CaptionsModule } from '../captions/captions.module';
import { QUEUE_NAMES } from '../queues/constants/queue.constants';
import { PublishService } from './publish.service';

@Module({
  imports: [BullModule.registerQueue({ name: QUEUE_NAMES.PUBLISH }), CaptionsModule],
  providers: [PublishService],
  exports: [PublishService],
})
export class PublishModule {}
