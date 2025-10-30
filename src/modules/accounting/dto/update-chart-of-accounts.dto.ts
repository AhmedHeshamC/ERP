import { PartialType } from '@nestjs/mapped-types';
import { CreateChartOfAccountsDto } from './create-chart-of-accounts.dto';

export class UpdateChartOfAccountsDto extends PartialType(CreateChartOfAccountsDto) {}