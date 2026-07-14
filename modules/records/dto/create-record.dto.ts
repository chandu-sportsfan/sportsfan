export class CreateRecordDto {
  event: string;
  category: string;
  type: 'National' | 'Olympic' | 'World';
  performance: string;
  athlete: string;
  date: string;
  venue: string;
  championship: string;
  color: string;
  numericValue: number;
}
