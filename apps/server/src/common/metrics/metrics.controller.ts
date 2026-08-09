import { Controller, Get, Header } from '@nestjs/common';
import { MetricsService } from './metrics.service';

/**
 * Prometheus scrape endpoint.
 *
 * Unauthenticated on purpose, and safe because of what is *not* here: no
 * usernames, no channel names, no gift contents. Four aggregate numbers and a
 * latency histogram, labelled only by instance id. Putting a session behind it
 * would mean the scraper needs credentials, which is how monitoring quietly
 * stops working.
 *
 * It must stay that way. Anything added here that names a user or a channel
 * turns a public endpoint into a disclosure.
 */
@Controller('metrics')
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Get()
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  scrape(): string {
    return this.metrics.render();
  }
}
