using Microsoft.AspNetCore.Mvc;
using Lostfast.Application.Strategies;
using Lostfast.Domain.Strategies;
using Lostfast.Infrastructure.Strategies;

namespace Lostfast.Api.Controllers;

[ApiController]
[Route("api/strategies")]
public class StrategiesController : ControllerBase
{
    private readonly IStrategyEngine _engine;
    private readonly StrategyRiskOrchestrator _orchestrator;

    public StrategiesController(IStrategyEngine engine, StrategyRiskOrchestrator orchestrator)
    {
        _engine = engine;
        _orchestrator = orchestrator;
    }

    [HttpPost("evaluate")]
    public IActionResult Evaluate([FromBody] EvaluateRequest request)
    {
        if (request.Candles == null || request.Candles.Count < 20)
            return BadRequest("Need at least 20 candles for reliable evaluation");

        var candles = request.Candles.Select(c => new Candle(
            c.Timestamp,
            c.Open,
            c.High,
            c.Low,
            c.Close,
            c.Volume
        )).ToList();

        var parameters = new StrategyParameters(
            LookbackPeriod: request.LookbackPeriod,
            Threshold: request.Threshold,
            RiskPercent: request.RiskPercent
        );

        var signals = _engine.EvaluateAll(candles, parameters);

        return Ok(new
        {
            GeneratedAt = DateTime.UtcNow,
            Symbol = request.Symbol,
            Signals = signals,
            Strongest = _engine.GetStrongestSignal(candles, parameters)
        });
    }

    /// <summary>
    /// Основной endpoint для Варианта В: стратегии + обязательная проверка риска
    /// </summary>
    [HttpPost("evaluate-with-risk")]
    public async Task<IActionResult> EvaluateWithRisk([FromBody] EvaluateRequest request, CancellationToken ct)
    {
        if (request.Candles == null || request.Candles.Count < 20)
            return BadRequest("Need at least 20 candles for reliable evaluation");

        var candles = request.Candles.Select(c => new Candle(
            c.Timestamp,
            c.Open,
            c.High,
            c.Low,
            c.Close,
            c.Volume
        )).ToList();

        var parameters = new StrategyParameters(
            LookbackPeriod: request.LookbackPeriod,
            Threshold: request.Threshold,
            RiskPercent: request.RiskPercent
        );

        var results = await _orchestrator.EvaluateWithRiskAsync(candles, request.Symbol, parameters, 10000, ct);

        return Ok(new
        {
            GeneratedAt = DateTime.UtcNow,
            Symbol = request.Symbol,
            Results = results
        });
    }
}

public record EvaluateRequest(
    string Symbol,
    List<CandleDto> Candles,
    int LookbackPeriod = 20,
    double Threshold = 0.5,
    double RiskPercent = 0.5
);

public record CandleDto(
    DateTime Timestamp,
    double Open,
    double High,
    double Low,
    double Close,
    double Volume = 0
);
