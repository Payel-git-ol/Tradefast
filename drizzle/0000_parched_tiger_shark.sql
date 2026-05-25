CREATE TABLE "ai_insights" (
	"id" serial PRIMARY KEY NOT NULL,
	"run_id" integer,
	"symbol" varchar(20) NOT NULL,
	"model" varchar(60) NOT NULL,
	"summary" text NOT NULL,
	"confidence" real NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytics" (
	"id" serial PRIMARY KEY NOT NULL,
	"run_id" integer,
	"symbol" varchar(20) NOT NULL,
	"consensus_score" real NOT NULL,
	"long_count" integer NOT NULL,
	"short_count" integer NOT NULL,
	"neutral_count" integer NOT NULL,
	"strongest_strategy" varchar(40),
	"strongest_strength" real,
	"last_price" double precision,
	"atr" double precision,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "candles" (
	"id" serial PRIMARY KEY NOT NULL,
	"symbol" varchar(20) NOT NULL,
	"interval" varchar(8) NOT NULL,
	"open_time" timestamp with time zone NOT NULL,
	"open" double precision NOT NULL,
	"high" double precision NOT NULL,
	"low" double precision NOT NULL,
	"close" double precision NOT NULL,
	"volume" double precision NOT NULL
);
--> statement-breakpoint
CREATE TABLE "runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" varchar(16) NOT NULL,
	"symbols" jsonb NOT NULL,
	"status" varchar(16) DEFAULT 'running' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "scrapes" (
	"id" serial PRIMARY KEY NOT NULL,
	"run_id" integer,
	"symbol" varchar(20),
	"url" text NOT NULL,
	"title" text,
	"content" text,
	"content_hash" varchar(64) NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "search_results" (
	"id" serial PRIMARY KEY NOT NULL,
	"query" text NOT NULL,
	"symbol" varchar(20),
	"source" varchar(40) NOT NULL,
	"title" text NOT NULL,
	"url" text,
	"snippet" text,
	"score" real DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "signals" (
	"id" serial PRIMARY KEY NOT NULL,
	"run_id" integer,
	"symbol" varchar(20) NOT NULL,
	"strategy" varchar(40) NOT NULL,
	"direction" varchar(8) NOT NULL,
	"strength" real NOT NULL,
	"reason" text NOT NULL,
	"risk_percent" real DEFAULT 0 NOT NULL,
	"status" varchar(40) DEFAULT 'evaluated' NOT NULL,
	"quantity" double precision,
	"notional" double precision,
	"at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_insights" ADD CONSTRAINT "ai_insights_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics" ADD CONSTRAINT "analytics_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scrapes" ADD CONSTRAINT "scrapes_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signals" ADD CONSTRAINT "signals_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "analytics_run_symbol_uq" ON "analytics" USING btree ("run_id","symbol");--> statement-breakpoint
CREATE UNIQUE INDEX "candles_symbol_interval_time_uq" ON "candles" USING btree ("symbol","interval","open_time");--> statement-breakpoint
CREATE UNIQUE INDEX "scrapes_url_hash_uq" ON "scrapes" USING btree ("url","content_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "search_results_query_title_uq" ON "search_results" USING btree ("query","title");--> statement-breakpoint
CREATE INDEX "search_results_query_idx" ON "search_results" USING btree ("query");--> statement-breakpoint
CREATE INDEX "signals_symbol_idx" ON "signals" USING btree ("symbol");--> statement-breakpoint
CREATE UNIQUE INDEX "signals_run_symbol_strategy_uq" ON "signals" USING btree ("run_id","symbol","strategy");