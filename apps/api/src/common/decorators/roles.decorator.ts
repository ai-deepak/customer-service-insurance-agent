import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../dto/base.dto';

export const Roles = (...roles: UserRole[]) => SetMetadata('roles', roles);
