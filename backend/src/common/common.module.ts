import { Module } from '@nestjs/common';

import { LoggingModule } from './logging/logging.module';
import { MonitoringModule } from './monitoring/monitoring.module';

@Module({
  imports: [LoggingModule, MonitoringModule],
  exports: [LoggingModule, MonitoringModule],
})
export class CommonModule {}
