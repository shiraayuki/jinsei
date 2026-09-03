using Microsoft.EntityFrameworkCore;

// One-shot: `dotnet run -- vapid` prints a fresh key pair for configuration.
// It belongs on the command line rather than behind an endpoint — it is run
// once, and its output is pasted into a config file by hand.
if (args.Length > 0 && args[0] == "vapid")
{
    var (publicKey, privateKey) = PushService.GenerateKeys();
    Console.WriteLine($"Push:VapidPublicKey  {publicKey}");
    Console.WriteLine($"Push:VapidPrivateKey {privateKey}");
    return;
}

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("Default"))
           .UseSnakeCaseNamingConvention());

builder.Services.AddIdentity<AppUser, Microsoft.AspNetCore.Identity.IdentityRole>(options =>
    {
        options.Password.RequireDigit = true;
        options.Password.RequireUppercase = false;
        options.Password.RequireNonAlphanumeric = false;
        options.Password.RequiredLength = 10;
        options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(10);
        options.Lockout.MaxFailedAccessAttempts = 5;
        options.Lockout.AllowedForNewUsers = true;
    })
    .AddEntityFrameworkStores<AppDbContext>();

builder.Services.ConfigureApplicationCookie(options =>
{
    options.Cookie.HttpOnly = true;
    options.Cookie.SameSite = SameSiteMode.Lax;
    options.Cookie.SecurePolicy = builder.Environment.IsDevelopment()
        ? CookieSecurePolicy.SameAsRequest
        : CookieSecurePolicy.Always;
    options.SlidingExpiration = true;
    options.ExpireTimeSpan = TimeSpan.FromDays(30);
    options.Events.OnRedirectToLogin = ctx =>
    {
        ctx.Response.StatusCode = 401;
        return Task.CompletedTask;
    };
    options.Events.OnRedirectToAccessDenied = ctx =>
    {
        ctx.Response.StatusCode = 403;
        return Task.CompletedTask;
    };
});

if (builder.Environment.IsDevelopment())
{
    builder.Services.AddCors(options =>
        options.AddDefaultPolicy(policy =>
            policy.WithOrigins("http://localhost:5173")
                  .AllowCredentials()
                  .AllowAnyHeader()
                  .AllowAnyMethod()));
}

builder.Services.AddMemoryCache();
builder.Services.AddHttpClient<HevyClient>();
builder.Services.AddScoped<WorkoutSyncService>();
builder.Services.AddHttpClient<GeminiClient>();
builder.Services.AddScoped<ScreenshotImportService>();
builder.Services.AddScoped<EnergyService>();
builder.Services.AddHttpClient<Lib.Net.Http.WebPush.PushServiceClient>();
builder.Services.AddScoped<PushService>();
builder.Services.AddScoped<WeekReviewService>();
builder.Services.AddScoped<ClaudeCliClient>();
builder.Services.AddScoped<DailyReportService>();
builder.Services.AddHostedService<HevySyncScheduler>();
builder.Services.AddHostedService<CalorieTargetScheduler>();
builder.Services.AddHostedService<NotificationScheduler>();
builder.Services.AddHostedService<DailyReportScheduler>();
builder.Services.AddControllers();

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    if (db.Database.ProviderName != "Microsoft.EntityFrameworkCore.InMemory")
        db.Database.Migrate();
    else
        db.Database.EnsureCreated();
}

if (app.Environment.IsDevelopment())
    app.UseCors();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();

public partial class Program { };
