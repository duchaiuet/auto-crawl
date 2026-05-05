import { Controller, Get } from '@nestjs/common';

import { MetricsService } from './metrics.service';

@Controller('monitoring')
export class MonitoringController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get('summary')
  getSummary(): ReturnType<MetricsService['getSnapshot']> {
    return this.metricsService.getSnapshot();
  }
}
