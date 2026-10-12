import { SetMetadata } from '@nestjs/common';
import { AuthRole } from '../auth/auth.types';
import { ROLES_KEY } from '../auth/role.guard';

export const Roles = (...roles: AuthRole[]) => SetMetadata(ROLES_KEY, roles);
