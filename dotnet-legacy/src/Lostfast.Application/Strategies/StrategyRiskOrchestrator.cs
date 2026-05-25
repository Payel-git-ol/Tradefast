using Lostfast.Application.Common.Interfaces;
using Lostfast.Application.Risk.Commands;
using Lostfast.Domain.Common.ValueObjects;
using Lostfast.Domain.Journal;
using Lostfast.Domain.Strategies;

namespace Lostfast.Application.Strategies;

/// <summary>
/// Orchestrates strategy signals through the mandatory Risk layer.
/// Also logs every decision for future model training.
/// </summary>
public sealed class StrategyRiskOrchestrator
{
    private readonly IStrategyEngine _strategyEngine;
    private readonly IPreTradeRiskValidator _riskValidator;
    private readonly IStrategyAuditLogger _auditLogger;

    public StrategyRiskOrchestrator(
        IStrategyEngine strategyEngine,
        IPreTradeRiskValidator riskValidator,
        IStrategyAuditLogger auditLogger)
    {
        _strategyEngine = strategyEngine;
        _riskValidator = riskValidator;
        _auditLogger = auditLogger;
    }

    public async Task<List<StrategySignalWithRisk>> EvaluateWithRiskAsync(
        IReadOnlyList<Candle> candles,
        string symbol,
        StrategyParameters? parameters = null,
        double accountBalanceUsd = 10000,
        CancellationToken ct = default)
    {
        parameters ??= new StrategyParameters();

        var rawSignals = _strategyEngine.EvaluateAll(candles, parameters);
        var results = new List<StrategySignalWithRisk>();

        var lastCandle = candles.Last();

        // Simple ATR approximation for position sizing (volatility)
        double currentAtr = 0;
        if (candles.Count > 14)
        {
            var recent = candles.TakeLast(15).ToList();
            for (int i = 1; i < recent.Count; i++)
            {
                double tr = Math.Max(recent[i].High - recent[i].Low,
                    Math.Max(Math.Abs(recent[i].High - recent[i-1].Close),
                             Math.Abs(recent[i].Low - recent[i-1].Close)));
                currentAtr += tr;
            }
            currentAtr /= 14;
        }

        foreach (var signal in rawSignals)
        {
            if (signal.Direction == "Neutral" || signal.Strength < parameters.Threshold)
            {
                await _auditLogger.LogAsync(symbol, signal, null, "Skipped (neutral or low strength)");
                results.Add(new StrategySignalWithRisk(signal, null, "Skipped (neutral or low strength)"));
                continue;
            }

            // === Proper volatility-adjusted position sizing ===
            double entryPrice = lastCandle.Close;
            double stopDistance = currentAtr > 0 ? currentAtr * 1.5 : entryPrice * 0.02;
            double stopPrice = signal.Direction == "Long" 
                ? entryPrice - stopDistance 
                : entryPrice + stopDistance;

            double riskPercent = signal.SuggestedRiskPercent > 0 ? signal.SuggestedRiskPercent : parameters.RiskPercent;
            double riskAmount = accountBalanceUsd * (riskPercent / 100.0);
            double quantity = riskAmount / stopDistance;
            quantity = Math.Round(quantity, 6);

            var proposedTrade = BuildProposedTrade(signal, symbol, lastCandle, quantity);

            var riskResult = await _riskValidator.ValidateAsync(proposedTrade, ct);

            string status = riskResult.IsApproved ? "Approved by Risk" : "Rejected by Risk";

            // Log for future ML training
            await _auditLogger.LogAsync(symbol, signal, riskResult, status);

            results.Add(new StrategySignalWithRisk(signal, riskResult, status));
        }

        return results;
    }

    private Trade BuildProposedTrade(TradingSignal signal, string symbol, Candle lastCandle, double quantity)
    {
        var side = signal.Direction == "Long" ? "Buy" : "Sell";
        var price = Money.Create((decimal)lastCandle.Close, "USD");

        return Trade.Open(
            Symbol.Create(symbol),
            side,
            price,
            (decimal)quantity,
            lastCandle.Timestamp);
    }
}

public sealed record StrategySignalWithRisk(
    TradingSignal Signal,
    RiskCheckResult? RiskCheck,
    string Status
);
