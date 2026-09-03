using System.ComponentModel;
using System.Diagnostics;

/// <summary>
/// Shells out to the `claude` CLI, headless, for one prompt.
///
/// No API key: this runs under whatever OS user already ran `claude login`
/// interactively, riding that Pro subscription instead of a metered one. The
/// prompt goes through <see cref="ProcessStartInfo.ArgumentList"/> rather than
/// a shell command line, so nothing needs escaping and nothing goes through
/// /bin/sh.
/// </summary>
public class ClaudeCliClient
{
    private readonly IConfiguration _config;
    private readonly ILogger<ClaudeCliClient> _log;

    public ClaudeCliClient(IConfiguration config, ILogger<ClaudeCliClient> log)
    {
        _config = config;
        _log = log;
    }

    private string Cli => _config["Claude:Cli"] is { Length: > 0 } cli ? cli : "claude";

    private TimeSpan Timeout => TimeSpan.FromSeconds(_config.GetValue("Claude:TimeoutSeconds", 180));

    public async Task<string> RunAsync(string prompt, CancellationToken ct = default)
    {
        var info = new ProcessStartInfo
        {
            FileName = Cli,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
        };
        info.ArgumentList.Add("-p");
        info.ArgumentList.Add(prompt);

        using var process = new Process { StartInfo = info };
        using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
        cts.CancelAfter(Timeout);

        try
        {
            process.Start();
        }
        catch (Win32Exception exc)
        {
            throw new ClaudeCliException($"claude CLI nicht gefunden (\"{Cli}\") — ist es installiert und im PATH?", exc);
        }

        var stdoutTask = process.StandardOutput.ReadToEndAsync(cts.Token);
        var stderrTask = process.StandardError.ReadToEndAsync(cts.Token);

        try
        {
            await process.WaitForExitAsync(cts.Token);
        }
        catch (OperationCanceledException) when (!ct.IsCancellationRequested)
        {
            TryKill(process);
            throw new ClaudeCliException("claude CLI hat nicht rechtzeitig geantwortet.");
        }

        var stdout = await stdoutTask;
        var stderr = await stderrTask;

        if (process.ExitCode != 0)
        {
            _log.LogWarning("claude CLI exited with {Code}: {Stderr}", process.ExitCode, stderr);
            throw new ClaudeCliException($"claude CLI meldete Fehler {process.ExitCode}: {Excerpt(stderr)}");
        }

        if (string.IsNullOrWhiteSpace(stdout))
            throw new ClaudeCliException("claude CLI lieferte keine Antwort.");

        return stdout.Trim();
    }

    private static void TryKill(Process process)
    {
        try { process.Kill(entireProcessTree: true); }
        catch { /* already gone */ }
    }

    private static string Excerpt(string text) => text.Length > 400 ? text[..400] : text;
}

public class ClaudeCliException : Exception
{
    public ClaudeCliException(string message, Exception? inner = null) : base(message, inner) { }
}
