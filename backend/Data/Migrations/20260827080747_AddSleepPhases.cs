using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace backend.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddSleepPhases : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "awake_minutes",
                table: "sleep_entries",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "deep_minutes",
                table: "sleep_entries",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "light_minutes",
                table: "sleep_entries",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "rem_minutes",
                table: "sleep_entries",
                type: "integer",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "awake_minutes",
                table: "sleep_entries");

            migrationBuilder.DropColumn(
                name: "deep_minutes",
                table: "sleep_entries");

            migrationBuilder.DropColumn(
                name: "light_minutes",
                table: "sleep_entries");

            migrationBuilder.DropColumn(
                name: "rem_minutes",
                table: "sleep_entries");
        }
    }
}
