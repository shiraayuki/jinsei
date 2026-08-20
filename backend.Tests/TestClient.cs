using System.Net.Http.Json;

/// <summary>A factory plus a client that has already registered and signed in.</summary>
public sealed class TestApp : IDisposable
{
    public TestWebAppFactory Factory { get; }
    public HttpClient Client { get; }

    private TestApp(TestWebAppFactory factory, HttpClient client)
    {
        Factory = factory;
        Client = client;
    }

    public static async Task<TestApp> SignedInAsync(
        Action<IServiceCollection>? configure = null,
        Dictionary<string, string?>? settings = null)
    {
        var factory = new TestWebAppFactory(configure, settings);
        var client = factory.CreateClient(new Microsoft.AspNetCore.Mvc.Testing.WebApplicationFactoryClientOptions
        {
            HandleCookies = true,
            AllowAutoRedirect = false,
        });

        var res = await client.PostAsJsonAsync("/api/auth/register", new
        {
            email = $"{Guid.NewGuid()}@test.com",
            password = "password123",
            displayName = "Test",
        });
        res.EnsureSuccessStatusCode();

        return new TestApp(factory, client);
    }

    public void Dispose()
    {
        Client.Dispose();
        Factory.Dispose();
    }
}
