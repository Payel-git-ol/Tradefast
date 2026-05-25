using MathNet.Numerics.Statistics;
using Lostfast.Domain.Strategies;

namespace Lostfast.Infrastructure.Strategies;

public static class TechnicalIndicators
{
    public static double[] Sma(double[] prices, int period)
    {
        var result = new double[prices.Length];
        for (int i = 0; i < prices.Length; i++)
        {
            if (i < period - 1)
            {
                result[i] = double.NaN;
            }
            else
            {
                result[i] = prices.Skip(i - period + 1).Take(period).Average();
            }
        }
        return result;
    }

    public static double[] Ema(double[] prices, int period)
    {
        var result = new double[prices.Length];
        double multiplier = 2.0 / (period + 1);
        result[0] = prices[0];

        for (int i = 1; i < prices.Length; i++)
        {
            result[i] = (prices[i] * multiplier) + (result[i - 1] * (1 - multiplier));
        }
        return result;
    }

    public static (double[] Upper, double[] Middle, double[] Lower) BollingerBands(double[] prices, int period, double stdDevMultiplier = 2.0)
    {
        var sma = Sma(prices, period);
        var upper = new double[prices.Length];
        var lower = new double[prices.Length];

        for (int i = 0; i < prices.Length; i++)
        {
            if (i < period - 1)
            {
                upper[i] = double.NaN;
                lower[i] = double.NaN;
            }
            else
            {
                var slice = prices.Skip(i - period + 1).Take(period).ToArray();
                double std = slice.StandardDeviation();
                upper[i] = sma[i] + (stdDevMultiplier * std);
                lower[i] = sma[i] - (stdDevMultiplier * std);
            }
        }
        return (upper, sma, lower);
    }

    public static double[] Rsi(double[] prices, int period = 14)
    {
        var rsi = new double[prices.Length];
        var gains = new double[prices.Length];
        var losses = new double[prices.Length];

        for (int i = 1; i < prices.Length; i++)
        {
            double change = prices[i] - prices[i - 1];
            gains[i] = Math.Max(change, 0);
            losses[i] = Math.Max(-change, 0);
        }

        double avgGain = gains.Skip(1).Take(period).Average();
        double avgLoss = losses.Skip(1).Take(period).Average();

        for (int i = 0; i < prices.Length; i++)
        {
            if (i < period)
            {
                rsi[i] = double.NaN;
            }
            else if (i == period)
            {
                double rs = avgGain / avgLoss;
                rsi[i] = 100 - (100 / (1 + rs));
            }
            else
            {
                avgGain = ((avgGain * (period - 1)) + gains[i]) / period;
                avgLoss = ((avgLoss * (period - 1)) + losses[i]) / period;
                double rs = avgGain / avgLoss;
                rsi[i] = 100 - (100 / (1 + rs));
            }
        }
        return rsi;
    }

    public static double LinearRegressionSlope(double[] values)
    {
        if (values.Length < 2) return 0;

        int n = values.Length;
        var x = Enumerable.Range(0, n).Select(i => (double)i).ToArray();
        double meanX = x.Average();
        double meanY = values.Average();

        double numerator = 0;
        double denominator = 0;

        for (int i = 0; i < n; i++)
        {
            numerator += (x[i] - meanX) * (values[i] - meanY);
            denominator += Math.Pow(x[i] - meanX, 2);
        }

        return denominator == 0 ? 0 : numerator / denominator;
    }

    /// <summary>
    /// Average True Range (ATR) - key for volatility-based position sizing
    /// </summary>
    public static double[] Atr(IReadOnlyList<Candle> candles, int period = 14)
    {
        var atr = new double[candles.Count];
        double[] trueRanges = new double[candles.Count];

        for (int i = 1; i < candles.Count; i++)
        {
            var high = candles[i].High;
            var low = candles[i].Low;
            var prevClose = candles[i - 1].Close;

            double tr1 = high - low;
            double tr2 = Math.Abs(high - prevClose);
            double tr3 = Math.Abs(low - prevClose);

            trueRanges[i] = Math.Max(tr1, Math.Max(tr2, tr3));
        }

        // Simple moving average of TR for ATR
        for (int i = 0; i < candles.Count; i++)
        {
            if (i < period)
            {
                atr[i] = double.NaN;
            }
            else
            {
                atr[i] = trueRanges.Skip(i - period + 1).Take(period).Average();
            }
        }

        return atr;
    }
}
