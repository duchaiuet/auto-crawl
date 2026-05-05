import { Injectable } from '@nestjs/common';

type MetricEntry = {
  name: string;
  value: number;
  timestamp: string;
  labels?: Record<string, string>;
};

@Injectable()
export class MetricsService {
  private counters = new Map<string, number>();
  private gauges = new Map<string, number>();
  private history: MetricEntry[] = [];

  incrementCounter(name: string, delta = 1, labels?: Record<string, string>): void {
    const next = (this.counters.get(name) ?? 0) + delta;
    this.counters.set(name, next);
    this.pushHistory({ name, value: next, labels, timestamp: new Date().toISOString() });
  }

  setGauge(name: string, value: number, labels?: Record<string, string>): void {
    this.gauges.set(name, value);
    this.pushHistory({ name, value, labels, timestamp: new Date().toISOString() });
  }

  getSnapshot(): {
    counters: Record<string, number>;
    gauges: Record<string, number>;
    recentHistory: MetricEntry[];
  } {
    return {
      counters: Object.fromEntries(this.counters.entries()),
      gauges: Object.fromEntries(this.gauges.entries()),
      recentHistory: [...this.history],
    };
  }

  private pushHistory(entry: MetricEntry): void {
    this.history.push(entry);
    if (this.history.length > 500) {
      this.history.shift();
    }
  }
}
