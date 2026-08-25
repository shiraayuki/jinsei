using System.Security.Cryptography;
using System.Text;

/// <summary>
/// The credential a phone shortcut carries instead of a session cookie.
///
/// Only the hash is stored, so a database dump does not hand out a working
/// token — and the plaintext is shown exactly once, when it is created. Losing
/// it costs a tap on "replace", which is cheaper than keeping a usable secret
/// lying in a table next to the data it protects.
/// </summary>
public static class IngestTokens
{
    /// <summary>A fresh token: 32 random bytes, URL-safe so it survives a shortcut field.</summary>
    public static string Create() =>
        Convert.ToBase64String(RandomNumberGenerator.GetBytes(32))
            .Replace('+', '-')
            .Replace('/', '_')
            .TrimEnd('=');

    public static string Hash(string token) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token)));

    /// <summary>
    /// Compares in constant time. The set of tokens is tiny and the endpoint is
    /// on a private network, but a timing side channel is free to avoid.
    /// </summary>
    public static bool Matches(string token, string storedHash) =>
        CryptographicOperations.FixedTimeEquals(
            Encoding.UTF8.GetBytes(Hash(token)),
            Encoding.UTF8.GetBytes(storedHash));
}
