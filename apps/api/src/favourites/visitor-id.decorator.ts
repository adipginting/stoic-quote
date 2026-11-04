import { BadRequestException, createParamDecorator } from '@nestjs/common';
import { ExecutionContext } from '@nestjs/common';

export const VISITOR_ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;

export const VisitorId = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string => {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
    }>();
    const header = request.headers['x-visitor-id'];
    const value = Array.isArray(header) ? header[0] : header;
    if (typeof value !== 'string' || !VISITOR_ID_PATTERN.test(value)) {
      throw new BadRequestException(
        'x-visitor-id header is required and must match /^[A-Za-z0-9_-]{8,64}$/',
      );
    }
    return value;
  },
);
