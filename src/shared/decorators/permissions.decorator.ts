import { SetMetadata } from '@nestjs/common';
import { Permissions } from '../common/constants';

export const PERMISSIONS_KEY = 'permissions';
export const HasPermission = (...permissions: string[]) => SetMetadata(PERMISSIONS_KEY, permissions);