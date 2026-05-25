using Lostfast.Application.Common.Interfaces;
using Lostfast.Application.Risk.Commands;
using Lostfast.Application.Strategies;
using Lostfast.Infrastructure.Persistence;
using Lostfast.Infrastructure.Strategies;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

// === Clean Architecture registrations (MVP skeleton) ===
builder.Services.AddScoped<IPreTradeRiskValidator, StubPreTradeRiskValidator>();
builder.Services.AddScoped<CheckTradeRiskCommandHandler>();

// === Strategies Module (Math.NET Numerics powered) ===
builder.Services.AddSingleton<IStrategy, TrendFollowingStrategy>();
builder.Services.AddSingleton<IStrategy, MeanReversionStrategy>();
builder.Services.AddSingleton<IStrategy, BreakoutStrategy>();
builder.Services.AddSingleton<IStrategy, ScalpingMomentumStrategy>();
builder.Services.AddSingleton<IStrategy, SmartMoneyConceptStrategy>();
builder.Services.AddSingleton<IStrategy, SupportResistanceStrategy>();
builder.Services.AddSingleton<IStrategy, PullbackStrategy>();
builder.Services.AddSingleton<IStrategyEngine, StrategyEngine>();

// Strategy + Risk integration + Audit (for future model training)
builder.Services.AddSingleton<IStrategyAuditLogger, InMemoryStrategyAuditLogger>();
builder.Services.AddScoped<StrategyRiskOrchestrator>();

// TODO: Replace with real PostgreSQL connection string from configuration
builder.Services.AddDbContext<LostfastDbContext>(options =>
    options.UseInMemoryDatabase("LostfastMvpSkeleton"));   // In-memory for fastest skeleton start

builder.Services.AddControllers();
builder.Services.AddOpenApi();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();

app.MapControllers();   // Will serve our future controllers

app.Run();
