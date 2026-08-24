using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

/// <summary>
/// Turns a screenshot into a draft for a day. Deliberately read-only: the draft
/// goes back to the client, which fills the normal form with it, and the day is
/// written through the existing sleep/nutrition upserts once it is confirmed.
/// </summary>
[ApiController]
[Route("api/import")]
[Authorize]
public class ImportController : ControllerBase
{
    // A phone screenshot is well under a megabyte; anything far past that is a
    // photo of something else and not worth sending to the model.
    private const int MaxImageBytes = 6 * 1024 * 1024;

    private readonly ScreenshotImportService _import;

    public ImportController(ScreenshotImportService import)
    {
        _import = import;
    }

    [HttpGet("status")]
    public IActionResult Status() => Ok(new { configured = _import.IsConfigured });

    [HttpPost("screenshot")]
    public async Task<IActionResult> Screenshot([FromBody] ScreenshotImportRequest req, CancellationToken ct = default)
    {
        if (!_import.IsConfigured)
            return StatusCode(503, new { message = "Der Screenshot-Import ist nicht konfiguriert." });

        if (!ScreenshotImportService.IsSupportedKind(req.Kind))
            return BadRequest(new { message = "Unbekannte Art. Erlaubt sind \"sleep\" und \"nutrition\"." });

        if (!ScreenshotImportService.IsSupportedMediaType(req.MediaType))
            return BadRequest(new { message = "Nicht unterstütztes Bildformat." });

        if (string.IsNullOrWhiteSpace(req.ImageBase64))
            return BadRequest(new { message = "Kein Bild übergeben." });

        // Base64 carries four characters per three bytes; comparing the decoded
        // size keeps the limit meaningful.
        if ((long)req.ImageBase64.Length * 3 / 4 > MaxImageBytes)
            return BadRequest(new { message = "Bild ist zu groß." });

        try
        {
            var draft = await _import.ExtractAsync(req.Kind, req.ImageBase64, req.MediaType, req.Date, ct);
            return Ok(new
            {
                draft.Kind,
                Date = draft.Date?.ToString("yyyy-MM-dd"),
                draft.Fields,
                draft.LowConfidence,
                draft.Warnings,
                draft.Notes,
            });
        }
        catch (ScreenshotImportException exc)
        {
            return StatusCode(502, new { message = exc.Message });
        }
    }
}

public record ScreenshotImportRequest(
    string Kind,
    DateOnly Date,
    string ImageBase64,
    string MediaType);
