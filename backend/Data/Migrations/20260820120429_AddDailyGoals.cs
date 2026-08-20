using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace backend.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddDailyGoals : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "kcal_goal",
                table: "AspNetUsers",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "protein_goal",
                table: "AspNetUsers",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "steps_goal",
                table: "AspNetUsers",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "water_goal_l",
                table: "AspNetUsers",
                type: "numeric",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "kcal_goal",
                table: "AspNetUsers");

            migrationBuilder.DropColumn(
                name: "protein_goal",
                table: "AspNetUsers");

            migrationBuilder.DropColumn(
                name: "steps_goal",
                table: "AspNetUsers");

            migrationBuilder.DropColumn(
                name: "water_goal_l",
                table: "AspNetUsers");
        }
    }
}
