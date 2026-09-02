import { Global, type MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { RequestContextService } from './request-context';
import { RequestContextMiddleware } from './request-context.middleware';

@Global()
@Module({
  providers: [RequestContextService],
  exports: [RequestContextService],
})
export class CommonModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}
