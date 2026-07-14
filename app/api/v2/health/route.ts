import { NextResponse } from 'next/server';
import { HealthService } from '../../../../modules/health/health.service';

const healthService = new HealthService();

export async function GET() {
  try {
    const result = healthService.check();
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
