using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace backend.Data.Migrations
{
    public partial class AddExerciseRestPreferences : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "exercise_rest_preferences",
                columns: table => new
                {
                    user_id = table.Column<string>(type: "text", nullable: false),
                    exercise_id = table.Column<Guid>(type: "uuid", nullable: false),
                    rest_seconds = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_exercise_rest_preferences", x => new { x.user_id, x.exercise_id });
                    table.ForeignKey(
                        name: "fk_exercise_rest_preferences_users_user_id",
                        column: x => x.user_id,
                        principalTable: "AspNetUsers",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_exercise_rest_preferences_exercises_exercise_id",
                        column: x => x.exercise_id,
                        principalTable: "exercises",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_exercise_rest_preferences_exercise_id",
                table: "exercise_rest_preferences",
                column: "exercise_id");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "exercise_rest_preferences");
        }
    }
}
