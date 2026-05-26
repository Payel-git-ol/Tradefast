import { Inject } from '@nestjs/common';
import { Field, Float, Int, Mutation, ObjectType, Query, Resolver } from '@nestjs/graphql';

import type { StatusReport } from '../app/lostfast.js';
import type { RunReport } from '../pipeline/collector.js';

export const LOSTFAST_FACADE = Symbol('LOSTFAST_FACADE');

export interface LostfastApiFacade {
  readonly driver: string;
  status(): Promise<StatusReport>;
  strategies(): { id: string; title: string }[];
  start(): Promise<RunReport>;
  update(): Promise<RunReport>;
  clear(): Promise<number>;
}

@ObjectType()
export class TableCountDto {
  @Field(() => String)
  name!: string;

  @Field(() => Int)
  count!: number;
}

@ObjectType()
export class StrategyDto {
  @Field(() => String)
  id!: string;

  @Field(() => String)
  title!: string;
}

@ObjectType()
export class AnalyticsDto {
  @Field(() => String)
  symbol!: string;

  @Field(() => Float)
  consensusScore!: number;

  @Field(() => Int)
  longCount!: number;

  @Field(() => Int)
  shortCount!: number;

  @Field(() => Int)
  neutralCount!: number;

  @Field(() => String, { nullable: true })
  strongestStrategy!: string | null;

  @Field(() => Float, { nullable: true })
  strongestStrength!: number | null;

  @Field(() => Float, { nullable: true })
  lastPrice!: number | null;

  @Field(() => Float, { nullable: true })
  atr!: number | null;
}

@ObjectType()
export class StatusDto {
  @Field(() => String)
  driver!: string;

  @Field(() => [TableCountDto])
  counts!: TableCountDto[];

  @Field(() => Int, { nullable: true })
  latestRunId!: number | null;

  @Field(() => [AnalyticsDto])
  latestAnalytics!: AnalyticsDto[];
}

@ObjectType()
export class SymbolRunDto {
  @Field(() => String)
  symbol!: string;

  @Field(() => Int)
  candlesAdded!: number;

  @Field(() => Int)
  signalsInserted!: number;

  @Field(() => Int)
  signalsUpdated!: number;

  @Field(() => Int)
  signalsUnchanged!: number;

  @Field(() => Int)
  scrapesAdded!: number;

  @Field(() => String)
  insight!: string;
}

@ObjectType()
export class RunReportDto {
  @Field(() => Int)
  runId!: number;

  @Field(() => String)
  kind!: string;

  @Field(() => [SymbolRunDto])
  symbols!: SymbolRunDto[];

  @Field(() => Int)
  searchResults!: number;

  @Field(() => Int)
  durationMs!: number;
}

@Resolver()
export class LostfastResolver {
  constructor(@Inject(LOSTFAST_FACADE) private readonly lostfast: LostfastApiFacade) {}

  @Query(() => StatusDto)
  async status(): Promise<StatusDto> {
    const status = await this.lostfast.status();
    return {
      driver: status.driver,
      counts: Object.entries(status.counts).map(([name, count]) => ({ name, count })),
      latestRunId: status.latestRunId ?? null,
      latestAnalytics: status.latestAnalytics.map((row) => ({
        symbol: row.symbol,
        consensusScore: row.consensusScore,
        longCount: row.longCount,
        shortCount: row.shortCount,
        neutralCount: row.neutralCount,
        strongestStrategy: row.strongestStrategy ?? null,
        strongestStrength: row.strongestStrength ?? null,
        lastPrice: row.lastPrice ?? null,
        atr: row.atr ?? null,
      })),
    };
  }

  @Query(() => [StrategyDto])
  async strategies(): Promise<StrategyDto[]> {
    return this.lostfast.strategies();
  }

  @Mutation(() => RunReportDto)
  async start(): Promise<RunReportDto> {
    return toRunDto(await this.lostfast.start());
  }

  @Mutation(() => RunReportDto)
  async update(): Promise<RunReportDto> {
    return toRunDto(await this.lostfast.update());
  }

  @Mutation(() => Int)
  async clear(): Promise<number> {
    return this.lostfast.clear();
  }
}

function toRunDto(report: RunReport): RunReportDto {
  return {
    runId: report.runId,
    kind: report.kind,
    symbols: report.symbols.map((symbol) => ({
      symbol: symbol.symbol,
      candlesAdded: symbol.candlesAdded,
      signalsInserted: symbol.signalsInserted,
      signalsUpdated: symbol.signalsUpdated,
      signalsUnchanged: symbol.signalsUnchanged,
      scrapesAdded: symbol.scrapesAdded,
      insight: symbol.insight,
    })),
    searchResults: report.searchResults,
    durationMs: report.durationMs,
  };
}
