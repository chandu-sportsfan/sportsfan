import { Injectable } from '@nestjs/common';
import { RecordsRepository } from './records.repository';
import { RecordInsight } from './entities/record.entity';

// ─── Gap Analysis Lookup Table ────────────────────────────────────────────────
// Sourced directly from the "Gap Analysis" sheet in new-records.xlsx (Jun 2026).
// Key: `${event}_${category}`   e.g. '100m_Men', 'JavelinThrow_Women'
//
// Fields:
//   gapChange      – absolute gap change since baseline (negative = widening)
//   baselineGap    – gap at the baseline year
//   baselineYear   – year from which change is measured
//   trendDirection – narrative label from the sheet
//   globalRank     – confirmed World Athletics live rank or 'N/A'

interface GapAnalysisRow {
  gapChange: number;
  baselineGap: number;
  baselineYear: string;
  trendDirection: string;
  globalRank: string;
}

const GAP_ANALYSIS: Record<string, GapAnalysisRow> = {
  // ── Sprint & Hurdles ────────────────────────────────────────────────────────
  '100m_Men': {
    gapChange: 0.17, baselineGap: 0.68, baselineYear: '2016',
    trendDirection: 'Narrowing',
    globalRank: '#230',   // Gurindervir Singh, worldathletics.org Jun 2026
  },
  '100m_Women': {
    gapChange: 0.07, baselineGap: 0.75, baselineYear: '2016',
    trendDirection: 'Narrowing (stalled since 2021)',
    globalRank: 'N/A',   // Dutee Chand retired after Paris 2024
  },
  '200m_Men': {
    gapChange: 0.31, baselineGap: 1.44, baselineYear: '2018',
    trendDirection: 'Narrowing',
    globalRank: '#43',    // Animesh Kujur, worldathletics.org Jun 2026
  },
  '200m_Women': {
    gapChange: 0, baselineGap: 1.48, baselineYear: '2015',
    trendDirection: 'Flat / Stagnant',
    globalRank: 'N/A',   // Saraswati Saha — record from 2002, no active ranking
  },
  '400m_Men': {
    gapChange: 0.42, baselineGap: 2.37, baselineYear: '2016',
    trendDirection: 'Narrowing',
    globalRank: '#65',    // Vishal Thennarasu Kayalvizhi, worldathletics.org Jun 2026
  },
  '400m_Women': {
    gapChange: 0, baselineGap: 3.19, baselineYear: '2015',
    trendDirection: 'Flat / Stagnant',
    globalRank: 'N/A',   // Hima Das, inactive; no current ranking
  },
  '400mH_Men': {
    gapChange: -0.68, baselineGap: 2.18, baselineYear: '2018',
    trendDirection: 'Widening (WR improved faster)',
    globalRank: 'N/A',
  },
  '400mH_Women': {
    gapChange: -1.97, baselineGap: 3.08, baselineYear: '2015',
    trendDirection: 'Widening (WR improved faster)',
    globalRank: 'N/A',   // P.T. Usha, 1984 record; no active ranking
  },
  // ── Throws ─────────────────────────────────────────────────────────────────
  'ShotPut_Men': {
    gapChange: 1.02, baselineGap: 2.81, baselineYear: '2018',
    trendDirection: 'Narrowing',
    globalRank: 'N/A',
  },
  'ShotPut_Women': {
    gapChange: 0.35, baselineGap: 4.57, baselineYear: '2022',
    trendDirection: 'Narrowing (slowly)',
    globalRank: 'N/A',
  },
  'DiscusThrow_Men': {
    gapChange: 0, baselineGap: 7.80, baselineYear: '2015',
    trendDirection: 'Flat / Stagnant (record since 2012)',
    globalRank: 'N/A',   // Vikas Gowda, 2012 record, not actively competing
  },
  'DiscusThrow_Women': {
    gapChange: 5.37, baselineGap: 15.58, baselineYear: '2017',
    trendDirection: 'Narrowing',
    globalRank: 'N/A',
  },
  'JavelinThrow_Men': {
    gapChange: 8.00, baselineGap: 16.25, baselineYear: '2016',
    trendDirection: 'Narrowing sharply (Neeraj Chopra era)',
    globalRank: 'Top 5',  // Neeraj Chopra was World No. 1 in Jun 2025; injury in 2026
  },
  'JavelinThrow_Women': {
    gapChange: 4.99, baselineGap: 13.45, baselineYear: '2015',
    trendDirection: 'Narrowing',
    globalRank: 'N/A',
  },
  'HammerThrow_Men': {
    gapChange: 0, baselineGap: 13.88, baselineYear: '2015',
    trendDirection: 'Flat / Stagnant (record since 2015)',
    globalRank: 'N/A',
  },
  'HammerThrow_Women': {
    gapChange: 1.77, baselineGap: 17.73, baselineYear: '2017',
    trendDirection: 'Narrowing (record broken 24 Jun 2026)',
    globalRank: 'N/A',
  },
  // ── Middle Distance ─────────────────────────────────────────────────────────
  '800m_Men': {
    gapChange: 0.72, baselineGap: 4.74, baselineYear: '2018',
    trendDirection: 'Narrowing',
    globalRank: 'N/A',
  },
  '800m_Women': {
    gapChange: 0, baselineGap: 5.89, baselineYear: '2015',
    trendDirection: 'Flat / Stagnant (record since 2010, unbroken 16 yrs)',
    globalRank: 'N/A',
  },
  '1500m_Men': {
    gapChange: 0, baselineGap: 9.24, baselineYear: '2019',
    trendDirection: 'Flat / Stagnant (record since 2019)',
    globalRank: 'N/A',
  },
  '1500m_Women': {
    gapChange: 0.61, baselineGap: 16.71, baselineYear: '2021',
    trendDirection: 'Narrowing (slowly)',
    globalRank: 'N/A',
  },
  '3000m_Men': {
    gapChange: 15.82, baselineGap: 32.76, baselineYear: '2008',
    trendDirection: 'Narrowing sharply (Gulveer Singh era)',
    globalRank: 'N/A',
  },
  '3000m_Women': {
    gapChange: 0, baselineGap: 51.08, baselineYear: '2022',
    trendDirection: 'Flat / Stagnant (only data point in window)',
    globalRank: 'N/A',
  },
  '5000m_Men': {
    gapChange: 15.37, baselineGap: 43.94, baselineYear: '2023',
    trendDirection: "Narrowing sharply (Gulveer Singh's May 2026 outdoor PB)",
    globalRank: 'N/A',
  },
  '5000m_Women': {
    gapChange: 3.94, baselineGap: 70.14, baselineYear: '2023',
    trendDirection: 'Narrowing',
    globalRank: 'N/A',
  },
  // ── Jumps ───────────────────────────────────────────────────────────────────
  'HighJump_Men': {
    gapChange: 0, baselineGap: 0.16, baselineYear: '2018',
    trendDirection: 'Flat / Stagnant (record since 2018)',
    globalRank: 'N/A',
  },
  'HighJump_Women': {
    gapChange: 0, baselineGap: 0.17, baselineYear: '2012',
    trendDirection: 'Flat / Stagnant (1cm gain in 14 yrs while WR also rose)',
    globalRank: 'N/A',
  },
  'LongJump_Men': {
    gapChange: 0.34, baselineGap: 0.87, baselineYear: '2004',
    trendDirection: 'Narrowing',
    globalRank: 'N/A',
  },
  'LongJump_Women': {
    gapChange: 0, baselineGap: 0.69, baselineYear: '2004',
    trendDirection: 'Flat / Stagnant (record since 2004, unbroken 22 yrs)',
    globalRank: 'N/A',
  },
  'TripleJump_Men': {
    gapChange: 0, baselineGap: 0.92, baselineYear: '2023',
    trendDirection: 'Flat / Stagnant (only data point in window)',
    globalRank: 'N/A',
  },
  'TripleJump_Women': {
    gapChange: -0.17, baselineGap: 1.39, baselineYear: '2015',
    trendDirection: 'Widening (WR jumped in 2021, India flat)',
    globalRank: 'N/A',
  },
  'PoleVault_Men': {
    gapChange: 0.05, baselineGap: 0.90, baselineYear: '2022',
    trendDirection: 'Narrowing (slowly)',
    globalRank: 'N/A',
  },
  'PoleVault_Women': {
    gapChange: 0.02, baselineGap: 0.85, baselineYear: '2022',
    trendDirection: 'Narrowing (slowly)',
    globalRank: 'N/A',
  },
  // ── Relays ──────────────────────────────────────────────────────────────────
  '4x100m_Men': {
    gapChange: 0.20, baselineGap: 2.05, baselineYear: '2010',
    trendDirection: 'Narrowing',
    globalRank: 'N/A',
  },
  '4x100m_Women': {
    gapChange: 0, baselineGap: 2.55, baselineYear: '2021',
    trendDirection: 'Flat / Stagnant (only data point in window)',
    globalRank: 'N/A',
  },
  '4x400m_Men': {
    gapChange: 0, baselineGap: 4.76, baselineYear: '2023',
    trendDirection: 'Flat / Stagnant (only data point in window)',
    globalRank: 'N/A',
  },
  '4x400m_Women': {
    gapChange: 0, baselineGap: 11.72, baselineYear: '2004',
    trendDirection: 'Flat / Stagnant (record since 2004, unbroken 22 yrs)',
    globalRank: 'N/A',
  },
};

@Injectable()
export class RecordsService {
  constructor(private readonly repository: RecordsRepository) {}

  /** Returns National / Olympic / World records for a given event + category. */
  getRecords(event: string, category: string) {
    return this.repository.getRecords(event, category);
  }

  /** Returns yearly trend data for an event. */
  getTrends(event: string) {
    return this.repository.getTrends(event);
  }

  /** Returns gap-to-world-record progress data for an event. */
  getProgress(event: string) {
    return this.repository.getProgress(event);
  }

  /** Returns all featured stories. */
  getStories() {
    return this.repository.getStories();
  }

  /**
   * Computes the performance insight for a given event + category.
   * Gap reduction and trend direction are sourced from the Excel Gap Analysis sheet.
   */
  async getInsight(event: string, category: string): Promise<RecordInsight | null> {
    const records = await this.repository.getRecords(event, category);

    const national = records.find((r) => r.type === 'National');
    const world = records.find((r) => r.type === 'World');

    if (!national || !world) return null;

    const isTimeEvent =
      event.includes('m') &&
      !event.includes('Jump') &&
      !event.includes('Throw') &&
      !event.includes('Put') &&
      !event.includes('Vault');

    const unit = isTimeEvent ? 's' : 'm';
    const diff = Math.abs(national.numericValue - world.numericValue);
    const percentage = ((diff / world.numericValue) * 100).toFixed(1);
    const formattedDiff = `${diff.toFixed(2)}${unit}`;

    // ── Gap analysis from the Excel sheet ────────────────────────────────────
    const key = `${event}_${category}`;
    const gap = GAP_ANALYSIS[key];

    let gapReductionPercent = '0';
    let trendDirection = 'Insufficient data';
    let baselineYear = '—';
    let globalRank = 'N/A';

    if (gap) {
      const reduction =
        gap.baselineGap !== 0
          ? ((gap.gapChange / gap.baselineGap) * 100).toFixed(1)
          : '0';
      gapReductionPercent = reduction;
      trendDirection = gap.trendDirection;
      baselineYear = gap.baselineYear;
      globalRank = gap.globalRank;
    }

    return {
      diff,
      percentage,
      formattedDiff,
      unit,
      gapReductionPercent,
      globalRank,
      trendDirection,
      baselineYear,
    };
  }
}
