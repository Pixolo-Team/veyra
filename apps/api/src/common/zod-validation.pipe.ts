import { BadRequestException, type PipeTransform } from '@nestjs/common';
import type { ZodType, infer as ZodInfer } from 'zod';

/**
 * Validates a route input against a zod schema from `@veyra/contracts`.
 *
 *   @Body(new ZodValidationPipe(loginRequestSchema)) body: LoginRequest
 *
 * We use this instead of class-validator so the FE and BE share one schema.
 */
export class ZodValidationPipe<T extends ZodType> implements PipeTransform {
  constructor(private readonly schema: T) {}

  transform(value: unknown): ZodInfer<T> {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        message: 'Validation failed',
        issues: result.error.issues.map((i) => ({
          path: i.path.join('.'),
          message: i.message,
        })),
      });
    }
    return result.data;
  }
}
