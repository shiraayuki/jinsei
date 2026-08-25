using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace backend.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddTrainingAndSleepGoals : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "sleep_goal_minutes",
                table: "AspNetUsers",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "weekly_sets_goal",
                table: "AspNetUsers",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "weekly_workouts_goal",
                table: "AspNetUsers",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "weight_goal_kg",
                table: "AspNetUsers",
                type: "numeric",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "sleep_goal_minutes",
                table: "AspNetUsers");

            migrationBuilder.DropColumn(
                name: "weekly_sets_goal",
                table: "AspNetUsers");

            migrationBuilder.DropColumn(
                name: "weekly_workouts_goal",
                table: "AspNetUsers");

            migrationBuilder.DropColumn(
                name: "weight_goal_kg",
                table: "AspNetUsers");
        }
    }
}
