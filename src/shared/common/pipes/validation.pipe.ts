import {
  PipeTransform,
  Injectable,
  ArgumentMetadata,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { SecurityService } from '../../security/security.service';

@Injectable()
export class ValidationPipe implements PipeTransform<any> {
  private readonly logger = new Logger(ValidationPipe.name);

  constructor(private securityService: SecurityService) {}

  async transform(value: any, { metatype }: ArgumentMetadata) {
    if (!metatype || !this.toValidate(metatype)) {
      return value;
    }

    // Sanitize input values
    const sanitizedValue = this.sanitizeInput(value);

    const object = plainToInstance(metatype, sanitizedValue);
    const errors = await validate(object, {
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      validationError: {
        target: false,
        value: false,
      },
    });

    if (errors.length > 0) {
      const validationErrors = this.formatValidationErrors(errors);
      this.logger.warn(`Validation failed: ${JSON.stringify(validationErrors)}`);
      throw new BadRequestException({
        message: 'Validation failed',
        errors: validationErrors,
      });
    }

    return object;
  }

  private toValidate(metatype: Function): boolean {
    const types: Function[] = [String, Boolean, Number, Array, Object];
    return !types.includes(metatype);
  }

  private sanitizeInput(value: any): any {
    if (typeof value !== 'object' || value === null) {
      return typeof value === 'string' ? this.securityService.sanitizeInput(value) : value;
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.sanitizeInput(item));
    }

    const sanitized: any = {};
    for (const key in value) {
      if (value.hasOwnProperty(key)) {
        if (typeof value[key] === 'string') {
          sanitized[key] = this.securityService.sanitizeInput(value[key]);
        } else if (typeof value[key] === 'object') {
          sanitized[key] = this.sanitizeInput(value[key]);
        } else {
          sanitized[key] = value[key];
        }
      }
    }

    return sanitized;
  }

  private formatValidationErrors(errors: any[]): any[] {
    return errors.map((error) => {
      const constraints = error.constraints;
      const property = error.property;

      if (constraints) {
        return {
          field: property,
          messages: Object.values(constraints),
          value: error.value,
        };
      }

      return {
        field: property,
        message: 'Invalid value',
        value: error.value,
      };
    });
  }
}