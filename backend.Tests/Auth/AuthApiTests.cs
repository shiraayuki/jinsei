using System.Net;
using System.Net.Http.Json;

public class AuthApiTests : IDisposable
{
    private readonly TestWebAppFactory _factory;
    private readonly HttpClient _client;

    public AuthApiTests()
    {
        _factory = new TestWebAppFactory();
        _client = _factory.CreateClient();
    }

    public void Dispose() => _factory.Dispose();

    [Fact]
    public async Task Register_ValidCredentials_Returns200()
    {
        var res = await _client.PostAsJsonAsync("/api/auth/register", new
        {
            email = "newuser@example.com",
            password = "password123",
            displayName = "Test User",
        });

        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
    }

    [Fact]
    public async Task Register_WeakPassword_ReturnsBadRequest()
    {
        var res = await _client.PostAsJsonAsync("/api/auth/register", new
        {
            email = "weak@example.com",
            password = "short",
            displayName = (string?)null,
        });

        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
    }

    [Fact]
    public async Task Login_WrongPassword_Returns401()
    {
        var res = await _client.PostAsJsonAsync("/api/auth/login", new
        {
            email = "noone@example.com",
            password = "wrong",
        });

        Assert.Equal(HttpStatusCode.Unauthorized, res.StatusCode);
    }

    [Fact]
    public async Task Me_Unauthenticated_Returns401()
    {
        var res = await _client.GetAsync("/api/auth/me");
        Assert.Equal(HttpStatusCode.Unauthorized, res.StatusCode);
    }

    [Fact]
    public async Task Register_ThenMe_ReturnsUser()
    {
        const string email = "me@example.com";
        await _client.PostAsJsonAsync("/api/auth/register", new
        {
            email,
            password = "password123",
            displayName = "Me User",
        });

        var res = await _client.GetAsync("/api/auth/me");
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);

        var body = await res.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>();
        Assert.Equal(email, body.GetProperty("email").GetString());
    }
}
